import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { linuxPackageInventoryName } from "./linux-package-inventory.mjs";

const schema = JSON.parse(
  readFileSync(
    new URL("../schemas/linux-public-build-evidence-v1.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const verification = Object.freeze([
  Object.freeze({ id: "linux-package-contract", result: "passed" }),
  Object.freeze({ id: "linux-package-inventory", result: "passed" }),
  Object.freeze({ id: "ubuntu-24.04-clean-installation", result: "passed" }),
  Object.freeze({ id: "ubuntu-24.04-clean-removal", result: "passed" }),
]);

export function createLinuxPublicBuildEvidence({
  version,
  revision,
  generatedAt,
  storageSchemaVersion,
  packageArtifact,
  inventoryArtifact,
}) {
  const evidence = {
    format: "org.fitfreed.linux-public-build-evidence",
    schemaVersion: 1,
    release: { version, revision, generatedAt },
    target: {
      id: "linux-x86_64-deb",
      os: "linux",
      architecture: "x86_64",
      packageFormat: "deb",
      buildDistribution: { id: "ubuntu", version: "24.04" },
    },
    application: {
      productName: "FitFreed",
      identifier: "org.fitfreed.desktop",
      executable: "fitfreed",
      storageSchemaVersion,
    },
    artifacts: {
      package: packageArtifact,
      inventory: inventoryArtifact,
    },
    verification: verification.map((entry) => ({ ...entry })),
  };
  validateLinuxPublicBuildEvidence(evidence);
  return evidence;
}

export function validateLinuxPublicBuildEvidence(evidence) {
  const errors = [];
  if (!validateSchema(evidence)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `Linux public build evidence schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  const version = evidence?.release?.version;
  const packageName = expectedLinuxDebianArtifactName(version);
  const inventoryName = linuxPackageInventoryName(version);
  if (evidence?.artifacts?.package?.path !== packageName) {
    errors.push(`Linux public build package must be named ${packageName}`);
  }
  if (evidence?.artifacts?.inventory?.path !== inventoryName) {
    errors.push(`Linux public build inventory must be named ${inventoryName}`);
  }
  if (JSON.stringify(evidence?.verification) !== JSON.stringify(verification)) {
    errors.push("Linux public build verification set is incomplete or reordered");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return evidence;
}
