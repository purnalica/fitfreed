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

import { validatePublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { promoteStagedDirectory } from "./release-evidence.mjs";
import { createUpdateEnvelope, createUpdatePayload } from "./update-e2e-contract.mjs";

const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const publicUpdateOrigin = "https://purnalica.github.io";
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

function publicPackageName(version) {
  if (!semanticVersion.test(version)) throw new Error("public update version is invalid");
  return `FitFreed_${version}_aarch64.app.tar.gz`;
}

export function stageStableUpdateChannel({
  outputDirectory,
  configuration,
  packagePath,
  packageSignaturePath,
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
  const packageMetadata = statSync(packagePath);
  if (!packageMetadata.isFile() || packageMetadata.size < 1) {
    throw new Error("public update package is invalid");
  }
  const packageSignature = readFileSync(packageSignaturePath, "utf8").trim();
  const packageName = publicPackageName(version);
  const packageUrl = new URL(
    `/fitfreed/updates/${version}/${packageName}`,
    publicUpdateOrigin,
  ).toString();
  const packageBytes = readFileSync(packagePath);
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
    target: "darwin-aarch64",
    packageUrl,
    packageSize: packageMetadata.size,
    packageSha256: sha256(packageBytes),
    packageSignature,
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
    copyFileSync(packagePath, path.join(packageDirectory, packageName));
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
    packageSha256: sha256(packageBytes),
    packageSize: packageMetadata.size,
    packageUrl,
    outputDirectory: resolvedOutputDirectory,
  };
}
