import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { publicUpdateUrl } from "./public-origin.mjs";
import { validatePublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { promoteStagedDirectory } from "./release-evidence.mjs";
import { createUpdateEnvelope, createUpdatePayload } from "./update-e2e-contract.mjs";

const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const maximumValidityMilliseconds = 14 * 24 * 60 * 60 * 1_000;

function compileValidators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return {
    payload: ajv.compile(
      JSON.parse(
        readFileSync(
          new URL("../schemas/update-channel-payload-v2.schema.json", import.meta.url),
          "utf8",
        ),
      ),
    ),
    envelope: ajv.compile(
      JSON.parse(
        readFileSync(
          new URL("../schemas/update-channel-envelope-v2.schema.json", import.meta.url),
          "utf8",
        ),
      ),
    ),
    errorsText: (errors) => ajv.errorsText(errors),
  };
}

const validators = compileValidators();

function validateDocument(validator, document, name) {
  if (!validator(document)) {
    throw new Error(`${name} failed its JSON Schema: ${validators.errorsText(validator.errors)}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateTemporalPolicy(issuedAt, expiresAt, publishedAt) {
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  const published = Date.parse(publishedAt);
  if (
    !Number.isFinite(issued)
    || !Number.isFinite(expires)
    || !Number.isFinite(published)
    || expires <= issued
    || expires - issued > maximumValidityMilliseconds
    || published > issued
  ) {
    throw new Error("public update channel time policy is invalid");
  }
}

function publicPackageName(version, target) {
  if (!semanticVersion.test(version)) throw new Error("public update version is invalid");
  if (target === "darwin-aarch64") return `FitFreed_${version}_aarch64.app.tar.gz`;
  if (target === "linux-x86_64-deb") return expectedLinuxDebianArtifactName(version);
  throw new Error("public update target is unsupported");
}

export function stageStableUpdateChannel({
  outputDirectory,
  configuration,
  packages,
  signingKeyId,
  version,
  sequence,
  issuedAt,
  expiresAt,
  publishedAt,
  minimumSupportedVersion,
  minimumReadableSchemaVersion,
  maximumReadableSchemaVersion,
  targetSchemaVersion,
  releaseNotes,
  withdrawnVersions,
  signPayload,
}) {
  const validatedConfiguration = validatePublicUpdateConfiguration(configuration);
  if (validatedConfiguration.status !== "active") {
    throw new Error("public update channel is inactive");
  }
  if (!validatedConfiguration.keys.some(({ id }) => id === signingKeyId)) {
    throw new Error("metadata signing key is outside the active public trust set");
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("public update sequence is invalid");
  }
  if (
    !Number.isSafeInteger(minimumReadableSchemaVersion)
    || !Number.isSafeInteger(maximumReadableSchemaVersion)
    || !Number.isSafeInteger(targetSchemaVersion)
    || minimumReadableSchemaVersion < 1
    || maximumReadableSchemaVersion < minimumReadableSchemaVersion
    || targetSchemaVersion < minimumReadableSchemaVersion
  ) {
    throw new Error("public update library schema policy is invalid");
  }
  validateTemporalPolicy(issuedAt, expiresAt, publishedAt);
  if (typeof signPayload !== "function") throw new Error("metadata signing authority is unavailable");

  const resolvedOutputDirectory = path.resolve(outputDirectory);
  if (resolvedOutputDirectory === path.parse(resolvedOutputDirectory).root) {
    throw new Error("public update staging directory is unsafe");
  }
  if (!Array.isArray(packages) || packages.length === 0) {
    throw new Error("public update packages are unavailable");
  }
  const packageTargets = new Set();
  const packageEvidence = packages
    .map(({ packagePath, packageSignaturePath, target }) => {
      const packageName = publicPackageName(version, target);
      if (packageTargets.has(target)) throw new Error(`public update target is duplicated: ${target}`);
      packageTargets.add(target);
      const packageMetadata = statSync(packagePath);
      if (!packageMetadata.isFile() || packageMetadata.size < 1) {
        throw new Error("public update package is invalid");
      }
      const packageSignature = readFileSync(packageSignaturePath, "utf8").trim();
      const packageBytes = readFileSync(packagePath);
      return {
        packageBytes,
        packageName,
        packagePath,
        packageSha256: sha256(packageBytes),
        packageSignature,
        packageSize: packageMetadata.size,
        packageUrl: publicUpdateUrl(`${version}/${packageName}`),
        target,
      };
    })
    .sort((left, right) => left.target.localeCompare(right.target, "en"));
  if (
    packageTargets.has("linux-x86_64-deb")
    && !packageTargets.has("darwin-aarch64")
  ) {
    throw new Error("the Linux public update target requires the existing macOS target");
  }
  const platforms = Object.fromEntries(
    packageEvidence.map((artifact) => [
      artifact.target,
      {
        url: artifact.packageUrl,
        size: artifact.packageSize,
        sha256: artifact.packageSha256,
        tauriSignature: artifact.packageSignature,
      },
    ]),
  );
  const payload = createUpdatePayload({
    contractSchemaVersion: 2,
    channel: "stable",
    sequence,
    releaseVersion: version,
    issuedAt,
    expiresAt,
    publishedAt,
    minimumSupportedVersion,
    releaseNotes,
    withdrawnVersions,
    platforms,
    minimumReadableSchemaVersion,
    schemaVersion: targetSchemaVersion,
    maximumReadableSchemaVersion,
    targetSchemaVersion,
  });
  validateDocument(validators.payload, payload, "public stable update payload");
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const metadataSignature = signPayload(payloadBytes);
  const envelope = createUpdateEnvelope({
    payload,
    payloadBytes,
    metadataSignature,
    keyId: signingKeyId,
  });
  validateDocument(validators.envelope, envelope, "public stable update envelope");

  const operationId = randomUUID();
  const stagingDirectory = `${resolvedOutputDirectory}.staging-${operationId}`;
  rmSync(stagingDirectory, { recursive: true, force: true });
  try {
    const packageDirectory = path.join(stagingDirectory, "updates", version);
    mkdirSync(packageDirectory, { recursive: true });
    for (const artifact of packageEvidence) {
      copyFileSync(artifact.packagePath, path.join(packageDirectory, artifact.packageName));
    }
    writeFileSync(
      path.join(stagingDirectory, "updates", "stable.json"),
      `${JSON.stringify(envelope)}\n`,
    );
    promoteStagedDirectory(stagingDirectory, resolvedOutputDirectory, operationId);
  } catch (error) {
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }

  return {
    version,
    sequence,
    keyId: signingKeyId,
    payloadSha256: sha256(payloadBytes),
    targets: packageEvidence.map(({ target }) => target),
    outputDirectory: resolvedOutputDirectory,
  };
}
