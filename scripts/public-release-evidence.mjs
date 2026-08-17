import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const revision = /^[0-9a-f]{40,64}$/;
const sha256 = /^[0-9a-f]{64}$/;
const requiredKinds = new Set([
  "macos-application-bundle",
  "macos-disk-image",
  "macos-updater-archive",
  "updater-signature",
  "stable-update-envelope",
  "cyclonedx-sbom",
  "upgrade-matrix",
  "release-notes",
]);
const singleKinds = new Set([
  "macos-application-bundle",
  "macos-disk-image",
  "macos-updater-archive",
  "updater-signature",
  "stable-update-envelope",
  "upgrade-matrix",
  "release-notes",
]);
const schema = JSON.parse(
  readFileSync(new URL("../schemas/release-manifest-v3.schema.json", import.meta.url), "utf8"),
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
    || candidate.split("/").includes("..")
  );
}

export function createPublicReleaseManifest({
  version,
  revision: sourceRevision,
  generatedAt,
  storageSchemaVersion,
  certificateSha256,
  teamIdentifier,
  updateKeyId,
  updateSequence,
  generators,
  artifacts,
}) {
  const sortedArtifacts = [...artifacts].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
  const digestBoundSubjects = sortedArtifacts
    .filter(({ kind }) => kind !== "macos-application-bundle")
    .map(({ path: artifactPath, sha256: artifactSha256 }) => ({
      path: artifactPath,
      sha256: artifactSha256,
    }));
  const manifest = {
    format: "org.fitfreed.release-manifest",
    schemaVersion: 3,
    release: {
      version,
      revision: sourceRevision,
      generatedAt,
      channel: "public-stable",
      signed: true,
      notarized: true,
    },
    target: {
      os: "macos",
      architecture: "aarch64",
      minimumSystemVersion: "15.0",
    },
    application: {
      productName: "FitFreed",
      bundleIdentifier: "org.fitfreed.desktop",
      executable: "fitfreed",
      storageSchemaVersion,
    },
    trust: {
      codeSigning: {
        identity: "developer-id-application",
        certificateSha256,
        teamIdentifier,
        hardenedRuntime: true,
        secureTimestamp: true,
      },
      notarization: {
        service: "apple-notary-service",
        applicationStapled: true,
        diskImageStapled: true,
        gatekeeperAccepted: true,
      },
    },
    update: {
      contract: "stable-v2",
      metadataEndpoint: "https://purnalica.github.io/fitfreed/updates/stable.json",
      keyId: updateKeyId,
      sequence: updateSequence,
    },
    generators,
    artifacts: sortedArtifacts,
    provenanceRequirements: {
      provider: "github-artifact-attestations",
      digestBoundSubjects,
      generatedSubjects: ["release-manifest.json", "SHA256SUMS"],
    },
  };
  validatePublicReleaseManifest(manifest);
  return manifest;
}

export function validatePublicReleaseManifest(manifest) {
  const errors = [];
  if (!validateSchema(manifest)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `public manifest schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  if (manifest?.schemaVersion !== 3) errors.push("unsupported public manifest schema version");
  if (!semanticVersion.test(manifest?.release?.version ?? "")) {
    errors.push("invalid public release version");
  }
  if (!revision.test(manifest?.release?.revision ?? "")) errors.push("invalid Git revision");
  if (Number.isNaN(Date.parse(manifest?.release?.generatedAt ?? ""))) {
    errors.push("invalid public release generation time");
  }

  const paths = new Set();
  const artifactsByKind = new Map();
  for (const artifact of manifest?.artifacts ?? []) {
    if (invalidPath(artifact.path)) errors.push(`invalid public artifact path: ${artifact.path}`);
    if (paths.has(artifact.path)) errors.push(`duplicate public artifact path: ${artifact.path}`);
    paths.add(artifact.path);
    const sameKind = artifactsByKind.get(artifact.kind) ?? [];
    sameKind.push(artifact);
    artifactsByKind.set(artifact.kind, sameKind);
    if (!Number.isSafeInteger(artifact.size) || artifact.size < 1) {
      errors.push(`invalid public artifact size: ${artifact.path}`);
    }
    if (!sha256.test(artifact.sha256 ?? "")) {
      errors.push(`invalid public artifact digest: ${artifact.path}`);
    }
  }
  for (const kind of requiredKinds) {
    if (!artifactsByKind.has(kind)) errors.push(`public release manifest has no ${kind}`);
  }
  for (const kind of singleKinds) {
    if ((artifactsByKind.get(kind) ?? []).length !== 1) {
      errors.push(`public release manifest must contain exactly one ${kind}`);
    }
  }
  const upgradeMatrix = artifactsByKind.get("upgrade-matrix")?.[0];
  if (upgradeMatrix?.path !== "supported-upgrades.json") {
    errors.push("public upgrade matrix must be named supported-upgrades.json");
  }
  const releaseNotes = artifactsByKind.get("release-notes")?.[0];
  if (releaseNotes?.path !== "RELEASE_NOTES.md") {
    errors.push("public release notes must be named RELEASE_NOTES.md");
  }

  const expectedSubjects = [...(manifest?.artifacts ?? [])]
    .filter(({ kind }) => kind !== "macos-application-bundle")
    .sort((left, right) => left.path.localeCompare(right.path, "en"))
    .map(({ path: artifactPath, sha256: artifactSha256 }) => ({
      path: artifactPath,
      sha256: artifactSha256,
    }));
  if (
    JSON.stringify(manifest?.provenanceRequirements?.digestBoundSubjects)
    !== JSON.stringify(expectedSubjects)
  ) {
    errors.push("public provenance subjects must match every regular manifest artifact");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return manifest;
}
