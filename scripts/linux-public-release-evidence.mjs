import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { linuxPackageInventoryName } from "./linux-package-inventory.mjs";
import { publicUpdateEndpoint } from "./public-origin.mjs";

const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const revision = /^[0-9a-f]{40,64}$/;
const sha256 = /^[0-9a-f]{64}$/;
const updateTarget = "linux-x86_64-deb";
const requiredKinds = new Set([
  "linux-x86_64-deb",
  "linux-package-inventory",
  "updater-signature",
  "stable-update-envelope",
  "cyclonedx-sbom",
  "upgrade-matrix",
  "release-notes",
]);
const singleKinds = new Set([...requiredKinds].filter((kind) => kind !== "cyclonedx-sbom"));
const schema = JSON.parse(
  readFileSync(new URL("../schemas/release-manifest-v4.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function invalidPath(candidate) {
  return (
    typeof candidate !== "string"
    || candidate.length === 0
    || path.isAbsolute(candidate)
    || candidate.includes("/")
    || candidate.includes("\\")
    || candidate === "."
    || candidate === ".."
  );
}

export function createLinuxPublicReleaseManifest({
  version,
  revision: sourceRevision,
  generatedAt,
  storageSchemaVersion,
  releaseKeyId,
  updateKeyId,
  updateSequence,
  generators,
  artifacts,
}) {
  const debianPackage = expectedLinuxDebianArtifactName(version);
  const sortedArtifacts = [...artifacts].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
  const manifest = {
    format: "org.fitfreed.release-manifest",
    schemaVersion: 4,
    release: {
      version,
      revision: sourceRevision,
      generatedAt,
      channel: "public-stable",
    },
    target: {
      os: "linux",
      architecture: "x86_64",
      packageFormat: "deb",
      updateTarget,
      supportedDistributions: [
        { id: "ubuntu", version: "24.04", edition: "desktop" },
        { id: "ubuntu", version: "26.04", edition: "desktop" },
      ],
    },
    application: {
      productName: "FitFreed",
      identifier: "org.fitfreed.desktop",
      executable: "fitfreed",
      storageSchemaVersion,
    },
    trust: {
      nativePackageIdentity: {
        status: "not-provided",
        reason: "no-selected-linux-platform-signature",
      },
      releaseSignature: {
        algorithm: "minisign-ed25519",
        keyId: releaseKeyId,
        subjectPath: "SHA256SUMS",
        signaturePath: "SHA256SUMS.minisig",
      },
      updaterSignature: {
        algorithm: "minisign-ed25519",
        keyId: updateKeyId,
        subjectPath: debianPackage,
        signaturePath: `${debianPackage}.sig`,
      },
    },
    update: {
      contract: "stable-v2",
      metadataEndpoint: publicUpdateEndpoint,
      keyId: updateKeyId,
      sequence: updateSequence,
      target: updateTarget,
    },
    generators,
    artifacts: sortedArtifacts,
    provenanceRequirements: {
      provider: "github-artifact-attestations",
      digestBoundSubjects: sortedArtifacts.map(
        ({ path: artifactPath, sha256: artifactSha256 }) => ({
          path: artifactPath,
          sha256: artifactSha256,
        }),
      ),
      generatedSubjects: ["release-manifest.json", "SHA256SUMS", "SHA256SUMS.minisig"],
    },
  };
  validateLinuxPublicReleaseManifest(manifest);
  return manifest;
}

export function validateLinuxPublicReleaseManifest(manifest) {
  const errors = [];
  if (!validateSchema(manifest)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `Linux public manifest schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  if (manifest?.schemaVersion !== 4) errors.push("unsupported Linux public manifest schema version");
  if (!semanticVersion.test(manifest?.release?.version ?? "")) {
    errors.push("invalid Linux public release version");
  }
  if (!revision.test(manifest?.release?.revision ?? "")) errors.push("invalid Git revision");
  if (Number.isNaN(Date.parse(manifest?.release?.generatedAt ?? ""))) {
    errors.push("invalid Linux public release generation time");
  }
  if (manifest?.update?.metadataEndpoint !== publicUpdateEndpoint) {
    errors.push("Linux public release manifest update endpoint is not canonical");
  }
  if (manifest?.target?.updateTarget !== updateTarget || manifest?.update?.target !== updateTarget) {
    errors.push(`Linux public release update target must be ${updateTarget}`);
  }
  if (manifest?.trust?.updaterSignature?.keyId !== manifest?.update?.keyId) {
    errors.push("Linux public updater signature key must match the update envelope key");
  }

  const paths = new Set();
  const artifactsByKind = new Map();
  let previousPath;
  for (const artifact of manifest?.artifacts ?? []) {
    if (invalidPath(artifact.path)) errors.push(`invalid Linux public artifact path: ${artifact.path}`);
    if (paths.has(artifact.path)) errors.push(`duplicate Linux public artifact path: ${artifact.path}`);
    if (previousPath !== undefined && previousPath.localeCompare(artifact.path, "en") > 0) {
      errors.push("Linux public artifact paths must be sorted");
    }
    previousPath = artifact.path;
    paths.add(artifact.path);
    const sameKind = artifactsByKind.get(artifact.kind) ?? [];
    sameKind.push(artifact);
    artifactsByKind.set(artifact.kind, sameKind);
    if (!Number.isSafeInteger(artifact.size) || artifact.size < 1) {
      errors.push(`invalid Linux public artifact size: ${artifact.path}`);
    }
    if (!sha256.test(artifact.sha256 ?? "")) {
      errors.push(`invalid Linux public artifact digest: ${artifact.path}`);
    }
  }
  for (const kind of requiredKinds) {
    if (!artifactsByKind.has(kind)) errors.push(`Linux public manifest has no ${kind}`);
  }
  for (const kind of singleKinds) {
    if ((artifactsByKind.get(kind) ?? []).length !== 1) {
      errors.push(`Linux public manifest must contain exactly one ${kind}`);
    }
  }

  const version = manifest?.release?.version;
  const debianPackage = expectedLinuxDebianArtifactName(version);
  const expectedPathsByKind = new Map([
    ["linux-x86_64-deb", debianPackage],
    ["linux-package-inventory", linuxPackageInventoryName(version)],
    ["updater-signature", `${debianPackage}.sig`],
    ["stable-update-envelope", "stable.json"],
    ["upgrade-matrix", "supported-upgrades.json"],
    ["release-notes", "RELEASE_NOTES.md"],
  ]);
  for (const [kind, expectedPath] of expectedPathsByKind) {
    const actualPath = artifactsByKind.get(kind)?.[0]?.path;
    if (actualPath !== expectedPath) errors.push(`${kind} must be named ${expectedPath}`);
  }
  if (
    manifest?.trust?.updaterSignature?.subjectPath !== debianPackage
    || manifest?.trust?.updaterSignature?.signaturePath !== `${debianPackage}.sig`
  ) {
    errors.push("Linux public updater signature subjects must match the Debian artifact");
  }

  const expectedSubjects = [...(manifest?.artifacts ?? [])]
    .sort((left, right) => left.path.localeCompare(right.path, "en"))
    .map(({ path: artifactPath, sha256: artifactSha256 }) => ({
      path: artifactPath,
      sha256: artifactSha256,
    }));
  if (
    JSON.stringify(manifest?.provenanceRequirements?.digestBoundSubjects)
    !== JSON.stringify(expectedSubjects)
  ) {
    errors.push("Linux public provenance subjects must match every manifest artifact");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return manifest;
}
