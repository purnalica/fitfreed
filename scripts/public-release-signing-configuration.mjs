import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(
  readFileSync(
    new URL(
      "../schemas/public-release-signing-configuration-v1.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);

export function validatePublicReleaseSigningConfiguration(configuration) {
  const errors = [];
  if (!validateSchema(configuration)) {
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
