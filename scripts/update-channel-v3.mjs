import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  compareSemanticVersions,
  validateUpgradeMatrixDocument,
} from "./upgrade-matrix.mjs";

const maximumValidityMilliseconds = 14 * 24 * 60 * 60 * 1_000;

function compileValidators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return {
    envelope: ajv.compile(JSON.parse(readFileSync(
      new URL("../schemas/update-channel-envelope-v3.schema.json", import.meta.url),
      "utf8",
    ))),
    payload: ajv.compile(JSON.parse(readFileSync(
      new URL("../schemas/update-channel-payload-v3.schema.json", import.meta.url),
      "utf8",
    ))),
    errorsText: (errors) => ajv.errorsText(errors),
  };
}

const validators = compileValidators();

function validateDocument(validator, document, name) {
  if (!validator(document)) {
    throw new Error(`${name} failed its JSON Schema: ${validators.errorsText(validator.errors)}`);
  }
}

function immutableHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.username === ""
      && url.password === ""
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

function compareRecoveryArtifacts(left, right) {
  const versionOrder = compareSemanticVersions(left.version, right.version);
  return versionOrder === 0 ? left.target.localeCompare(right.target, "en") : versionOrder;
}

function sameRecoveryDeclaration(left, right) {
  return left.version === right.version
    && left.target === right.target
    && isDeepStrictEqual(left.librarySchemaVersions, right.librarySchemaVersions);
}

export function deriveRecoveryArtifactRequirements(upgradeMatrix) {
  validateUpgradeMatrixDocument(upgradeMatrix);
  if (upgradeMatrix.schemaVersion !== 2) {
    throw new Error("recoverable stable updates require upgrade matrix version 2");
  }
  return upgradeMatrix.supportedApplicationBaselines
    .flatMap(({ version, targets, librarySchemaVersions }) => targets
      .filter((target) => target === "linux-x86_64-deb" || target === "windows-x86_64-nsis")
      .map((target) => ({
        version,
        target,
        librarySchemaVersions: [...librarySchemaVersions],
      })))
    .sort(compareRecoveryArtifacts);
}

function validateTemporalPolicy(payload, errors) {
  const issued = Date.parse(payload.issuedAt);
  const expires = Date.parse(payload.expiresAt);
  const published = Date.parse(payload.release.publishedAt);
  if (
    !Number.isFinite(issued)
    || !Number.isFinite(expires)
    || !Number.isFinite(published)
    || expires <= issued
    || expires - issued > maximumValidityMilliseconds
    || published > issued
  ) {
    errors.push("stable update channel time policy is invalid");
  }
}

export function validateStableUpdateV3Payload(payload, expectedRecoveryArtifacts) {
  validateDocument(validators.payload, payload, "stable update payload version 3");
  if (!Array.isArray(expectedRecoveryArtifacts)) {
    throw new Error("declared application recovery baselines are unavailable");
  }

  const errors = [];
  validateTemporalPolicy(payload, errors);
  const { librarySchema, platforms, recoveryArtifacts } = payload.release;
  if (
    librarySchema.maximumReadableVersion < librarySchema.minimumReadableVersion
    || librarySchema.targetVersion < librarySchema.minimumReadableVersion
  ) {
    errors.push("stable update library schema policy is invalid");
  }
  for (const artifact of Object.values(platforms)) {
    if (!immutableHttpsUrl(artifact.url)) {
      errors.push("update artifact URL must be credential-free HTTPS without a query or fragment");
    }
  }

  for (const [index, artifact] of recoveryArtifacts.entries()) {
    if (index > 0 && compareRecoveryArtifacts(recoveryArtifacts[index - 1], artifact) >= 0) {
      errors.push("recovery artifacts must be unique and ordered by version and target");
    }
    if (!(artifact.target in platforms)) {
      errors.push(`recovery artifact has no current release target: ${artifact.target}`);
    }
    const expectedPackageKind = artifact.target === "linux-x86_64-deb" ? "deb" : "nsis";
    if (artifact.packageKind !== expectedPackageKind) {
      errors.push(`recovery artifact package kind does not match ${artifact.target}`);
    }
    if (compareSemanticVersions(artifact.version, payload.release.version) >= 0) {
      errors.push("recovery artifact version must be older than the release");
    }
    if (
      artifact.librarySchemaVersions.some((version, schemaIndex) =>
        version < librarySchema.minimumReadableVersion
        || version > librarySchema.maximumReadableVersion
        || (schemaIndex > 0 && artifact.librarySchemaVersions[schemaIndex - 1] >= version))
    ) {
      errors.push("recovery artifact library schemas must be ordered within the readable source range");
    }
    if (!immutableHttpsUrl(artifact.url)) {
      errors.push("recovery artifact URL must be credential-free HTTPS without a query or fragment");
    }
  }

  const expected = expectedRecoveryArtifacts
    .map(({ version, target, librarySchemaVersions }) => ({
      version,
      target,
      librarySchemaVersions,
    }))
    .sort(compareRecoveryArtifacts);
  if (
    expected.length !== recoveryArtifacts.length
    || recoveryArtifacts.some((artifact, index) => !sameRecoveryDeclaration(artifact, expected[index]))
  ) {
    errors.push("signed recovery evidence does not match the declared application baselines");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return payload;
}

export function validateStableUpdateV3Envelope(envelope, signedPayload) {
  validateDocument(validators.envelope, envelope, "stable update envelope version 3");
  const errors = [];
  let decodedPayload;
  try {
    const bytes = Buffer.from(envelope.fitfreed.payloadBase64, "base64");
    if (bytes.toString("base64") !== envelope.fitfreed.payloadBase64) {
      errors.push("stable update envelope payload uses non-canonical Base64");
    } else {
      decodedPayload = JSON.parse(bytes.toString("utf8"));
    }
  } catch {
    errors.push("stable update envelope payload is not UTF-8 JSON");
  }
  if (!isDeepStrictEqual(decodedPayload, signedPayload)) {
    errors.push("stable update envelope does not carry the supplied signed payload");
  }
  if (envelope.version !== signedPayload?.release?.version) {
    errors.push("stable update compatibility version mirror does not match signed policy");
  }
  const signedPlatforms = signedPayload?.release?.platforms ?? {};
  if (Object.keys(envelope.platforms).length !== Object.keys(signedPlatforms).length) {
    errors.push("stable update compatibility platform mirror does not match signed policy");
  }
  for (const [target, artifact] of Object.entries(signedPlatforms)) {
    const mirror = envelope.platforms[target];
    if (!mirror || mirror.url !== artifact.url || mirror.signature !== artifact.tauriSignature) {
      errors.push(`stable update compatibility mirror does not match signed target: ${target}`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return envelope;
}
