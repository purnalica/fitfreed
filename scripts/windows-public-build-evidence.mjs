import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { publicUpdateEndpoint } from "./public-origin.mjs";
import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";
import { windowsPackageInventoryName } from "./windows-package-inventory.mjs";

const schemaV1 = JSON.parse(
  readFileSync(
    new URL("../schemas/windows-public-build-evidence-v1.schema.json", import.meta.url),
    "utf8",
  ),
);
const schemaV2 = JSON.parse(
  readFileSync(
    new URL("../schemas/windows-public-build-evidence-v2.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(schemaV1);
const schemaValidators = new Map([
  [1, ajv.getSchema(schemaV1.$id)],
  [2, ajv.compile(schemaV2)],
]);

const authenticodeVerification = Object.freeze([
  Object.freeze({ id: "windows-package-contract", result: "passed" }),
  Object.freeze({ id: "windows-public-setup-trust", result: "passed" }),
  Object.freeze({ id: "windows-current-user-installation", result: "passed" }),
  Object.freeze({ id: "windows-installed-authenticode", result: "passed" }),
  Object.freeze({ id: "windows-package-inventory", result: "passed" }),
  Object.freeze({ id: "windows-clean-removal", result: "passed" }),
]);
const unsignedPreviewVerification = Object.freeze([
  Object.freeze({ id: "windows-package-contract", result: "passed" }),
  Object.freeze({ id: "windows-unsigned-setup", result: "passed" }),
  Object.freeze({ id: "windows-current-user-installation", result: "passed" }),
  Object.freeze({ id: "windows-installed-binaries-unsigned", result: "passed" }),
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
  trustProfile = "public-authenticode",
  updateTrustedKeyIds,
  version,
}) {
  const unsignedPreview = trustProfile === "public-unsigned-preview";
  const verification = unsignedPreview
    ? unsignedPreviewVerification
    : authenticodeVerification;
  const evidence = {
    format: "org.fitfreed.windows-public-build-evidence",
    schemaVersion: unsignedPreview ? 2 : 1,
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
    trust: unsignedPreview
      ? {
        profile: "public-unsigned-preview",
        authenticode: {
          status: "not-provided",
          publisherIdentity: "unknown",
          reason: "unsigned-preview",
        },
      }
      : { authenticodeCertificateSha256 },
    ...(unsignedPreview ? {
      limitations: {
        exactWindows11Admission: false,
        smartAppControlMayBlock: true,
        smartScreenContinuationMayBeRequired: true,
        managedPolicyMayBlock: true,
      },
    } : {}),
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
  const validateSchema = schemaValidators.get(evidence?.schemaVersion);
  if (!validateSchema) {
    errors.push("unsupported Windows public build evidence schema version");
  } else if (!validateSchema(evidence)) {
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
  const expectedVerification = evidence?.schemaVersion === 2
    ? unsignedPreviewVerification
    : authenticodeVerification;
  if (JSON.stringify(evidence?.verification) !== JSON.stringify(expectedVerification)) {
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
