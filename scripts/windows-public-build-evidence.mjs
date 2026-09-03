import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { publicUpdateEndpoint } from "./public-origin.mjs";
import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";
import { windowsPackageInventoryName } from "./windows-package-inventory.mjs";

const schema = JSON.parse(
  readFileSync(
    new URL("../schemas/windows-public-build-evidence-v1.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const verification = Object.freeze([
  Object.freeze({ id: "windows-package-contract", result: "passed" }),
  Object.freeze({ id: "windows-public-setup-trust", result: "passed" }),
  Object.freeze({ id: "windows-current-user-installation", result: "passed" }),
  Object.freeze({ id: "windows-installed-authenticode", result: "passed" }),
  Object.freeze({ id: "windows-package-inventory", result: "passed" }),
  Object.freeze({ id: "windows-clean-removal", result: "passed" }),
]);

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

export function createWindowsPublicBuildEvidence({
  authenticodeCertificateSha256,
  generatedAt,
  inventoryArtifact,
  packageArtifact,
  revision,
  storageSchemaVersion,
  updateTrustedKeyIds,
  version,
}) {
  const evidence = {
    format: "org.fitfreed.windows-public-build-evidence",
    schemaVersion: 1,
    release: { version, revision, generatedAt },
    target: {
      id: "windows-x86_64-nsis",
      os: "windows",
      architecture: "x86_64",
      packageFormat: "nsis",
      installMode: "currentUser",
    },
    application: {
      productName: "FitFreed",
      identifier: "org.fitfreed.desktop",
      executable: "fitfreed.exe",
      storageSchemaVersion,
    },
    artifacts: {
      package: packageArtifact,
      inventory: inventoryArtifact,
    },
    trust: { authenticodeCertificateSha256 },
    update: {
      contract: "stable-v3",
      metadataEndpoint: publicUpdateEndpoint,
      trustedKeyIds: updateTrustedKeyIds,
    },
    verification: verification.map((entry) => ({ ...entry })),
  };
  validateWindowsPublicBuildEvidence(evidence);
  return evidence;
}

export function validateWindowsPublicBuildEvidence(evidence) {
  const errors = [];
  if (!validateSchema(evidence)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `Windows public build evidence schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  const version = evidence?.release?.version;
  let packageName;
  try {
    packageName = expectedWindowsNsisArtifactName(version);
  } catch {
    errors.push("Windows public build evidence release version is invalid");
  }
  if (packageName) {
    const expectedArtifacts = {
      package: packageName,
      inventory: windowsPackageInventoryName(version),
    };
    for (const [field, expectedPath] of Object.entries(expectedArtifacts)) {
      if (evidence?.artifacts?.[field]?.path !== expectedPath) {
        errors.push(`Windows public build ${field} must be named ${expectedPath}`);
      }
    }
  }
  if (JSON.stringify(evidence?.verification) !== JSON.stringify(verification)) {
    errors.push("Windows public build verification set is incomplete or reordered");
  }
  const trustedKeyIds = evidence?.update?.trustedKeyIds ?? [];
  const expectedKeyIds = [...new Set(trustedKeyIds)].sort(byteOrder);
  if (JSON.stringify(trustedKeyIds) !== JSON.stringify(expectedKeyIds)) {
    errors.push("Windows public build trusted update key identifiers must be unique and sorted");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return evidence;
}
