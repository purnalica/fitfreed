import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { releasePublicKeyFingerprint } from "./release-signature.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validators = new Map([1, 2].map((version) => {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        `../schemas/public-release-signing-configuration-v${version}.schema.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
  return [version, ajv.compile(schema)];
}));

export function validatePublicReleaseSigningConfiguration(configuration) {
  const errors = [];
  const validateSchema = validators.get(configuration?.schemaVersion);
  if (!validateSchema) {
    errors.push("unsupported public release-signing configuration schema version");
  } else if (!validateSchema(configuration)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `public release-signing configuration violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  const keyIds = new Set();
  for (const key of configuration?.keys ?? []) {
    if (keyIds.has(key.id)) {
      errors.push(`duplicate public release-signing key identifier: ${key.id}`);
    }
    keyIds.add(key.id);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return configuration;
}

export function assertIndependentPublicSigningKeys({
  releaseKeyId,
  releaseSigningConfiguration,
  updateConfiguration,
  updateKeyId,
}) {
  const releaseKey = releaseSigningConfiguration?.keys?.find(
    ({ id }) => id === releaseKeyId,
  );
  const updateKey = updateConfiguration?.keys?.find(({ id }) => id === updateKeyId);
  if (!releaseKey || !updateKey) {
    throw new Error("selected public signing trust is incomplete");
  }
  if (
    releasePublicKeyFingerprint(releaseKey.publicKey)
    === releasePublicKeyFingerprint(updateKey.publicKey)
  ) {
    throw new Error("update and release checksum signing require independent public keys");
  }
  return { releaseKeyId, updateKeyId };
}

export function loadPublicReleaseSigningConfiguration(repositoryRoot) {
  return validatePublicReleaseSigningConfiguration(
    JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "release/public-release-signing.json"),
        "utf8",
      ),
    ),
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const repositoryRoot = path.resolve(import.meta.dirname, "..");
    const configuration = loadPublicReleaseSigningConfiguration(repositoryRoot);
    process.stdout.write(
      `${JSON.stringify({
        format: configuration.format,
        schemaVersion: configuration.schemaVersion,
        status: configuration.status,
        purpose: configuration.purpose,
        algorithm: configuration.algorithm,
        keyCount: configuration.keys.length,
      })}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Public release-signing configuration check failed: ${error.message}\n`,
    );
    process.exitCode = 1;
  }
}
