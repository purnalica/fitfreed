import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { publicUpdateEndpoint } from "./public-origin.mjs";

const expectedMetadataEndpoint = publicUpdateEndpoint;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validators = new Map([1, 2].map((version) => [
  version,
  ajv.compile(JSON.parse(readFileSync(
    new URL(`../schemas/public-update-configuration-v${version}.schema.json`, import.meta.url),
    "utf8",
  ))),
]));

export function validatePublicUpdateConfiguration(configuration) {
  const errors = [];
  const validateSchema = validators.get(configuration?.schemaVersion);
  if (!validateSchema) {
    errors.push("public update configuration version is unsupported");
  } else if (!validateSchema(configuration)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `public update configuration violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  if (configuration?.metadataEndpoint !== expectedMetadataEndpoint) {
    errors.push(`public update endpoint must be ${expectedMetadataEndpoint}`);
  }
  const keyIds = new Set();
  for (const key of configuration?.keys ?? []) {
    if (keyIds.has(key.id)) errors.push(`duplicate public update key identifier: ${key.id}`);
    keyIds.add(key.id);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return configuration;
}

export function publicUpdateBuildEnvironment(configuration, requireActive = true) {
  const validated = validatePublicUpdateConfiguration(configuration);
  if (validated.status === "inactive") {
    if (requireActive) throw new Error("public update channel is inactive");
    return {};
  }
  const trust = Object.fromEntries(
    [...validated.keys]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map(({ id, publicKey }) => [id, publicKey]),
  );
  return {
    FITFREED_PUBLIC_UPDATE_CONTRACT: validated.contract,
    FITFREED_PUBLIC_UPDATE_ENDPOINT: validated.metadataEndpoint,
    FITFREED_PUBLIC_UPDATE_TRUST: JSON.stringify(trust),
  };
}

export function loadPublicUpdateConfiguration(repositoryRoot) {
  const configurationPath = path.join(repositoryRoot, "release/public-update-channel.json");
  return validatePublicUpdateConfiguration(
    JSON.parse(readFileSync(configurationPath, "utf8")),
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const configuration = loadPublicUpdateConfiguration(repositoryRoot);
    process.stdout.write(
      `${JSON.stringify({
        format: configuration.format,
        schemaVersion: configuration.schemaVersion,
        status: configuration.status,
        contract: configuration.contract,
        metadataEndpoint: configuration.metadataEndpoint,
        keyCount: configuration.keys.length,
      })}\n`,
    );
  } catch (error) {
    process.stderr.write(`Public update configuration check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
