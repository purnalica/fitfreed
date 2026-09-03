import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { linuxPackageInventoryName } from "./linux-package-inventory.mjs";
import { publicUpdateEndpoint } from "./public-origin.mjs";
import { validateReviewedReleaseNotes } from "./release-notes.mjs";
import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";
import { windowsPackageInventoryName } from "./windows-package-inventory.mjs";

const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const revision = /^[0-9a-f]{40,64}$/;
const sha256 = /^[0-9a-f]{64}$/;
const macosTarget = "darwin-aarch64";
const linuxTarget = "linux-x86_64-deb";
const windowsTarget = "windows-x86_64-nsis";
const releaseTarget = "release";
const targetSet = Object.freeze([macosTarget, linuxTarget, windowsTarget]);
const requiredKinds = new Set([
  "macos-application-bundle",
  "macos-disk-image",
  "macos-updater-archive",
  "macos-updater-signature",
  "linux-x86_64-deb",
  "linux-package-inventory",
  "linux-build-evidence",
  "linux-updater-signature",
  "windows-x86_64-nsis",
  "windows-package-inventory",
  "windows-build-evidence",
  "windows-updater-signature",
  "stable-update-envelope",
  "cyclonedx-sbom",
  "upgrade-matrix",
  "release-notes",
]);
const singleKinds = new Set([...requiredKinds].filter((kind) => kind !== "cyclonedx-sbom"));
const targetsByKind = new Map([
  ["macos-application-bundle", macosTarget],
  ["macos-disk-image", macosTarget],
  ["macos-updater-archive", macosTarget],
  ["macos-updater-signature", macosTarget],
  ["linux-x86_64-deb", linuxTarget],
  ["linux-package-inventory", linuxTarget],
  ["linux-build-evidence", linuxTarget],
  ["linux-updater-signature", linuxTarget],
  ["windows-x86_64-nsis", windowsTarget],
  ["windows-package-inventory", windowsTarget],
  ["windows-build-evidence", windowsTarget],
  ["windows-updater-signature", windowsTarget],
  ["stable-update-envelope", releaseTarget],
  ["cyclonedx-sbom", releaseTarget],
  ["upgrade-matrix", releaseTarget],
  ["release-notes", releaseTarget],
]);
const predecessorSchema = JSON.parse(
  readFileSync(new URL("../schemas/release-manifest-v6.schema.json", import.meta.url), "utf8"),
);
const schema = JSON.parse(
  readFileSync(new URL("../schemas/release-manifest-v7.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(predecessorSchema);
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

function macosArtifactNames(version) {
  const updaterArchive = `FitFreed_${version}_aarch64.app.tar.gz`;
  return {
    application: "FitFreed.app",
    diskImage: `FitFreed_${version}_aarch64.dmg`,
    updaterArchive,
    updaterSignature: `${updaterArchive}.sig`,
  };
}

function linuxArtifactNames(version) {
  const packageName = expectedLinuxDebianArtifactName(version);
  return {
    buildEvidence: `${packageName}.build.json`,
    package: packageName,
    inventory: linuxPackageInventoryName(version),
    updaterSignature: `${packageName}.sig`,
  };
}

function windowsArtifactNames(version) {
  const packageName = expectedWindowsNsisArtifactName(version);
  return {
    buildEvidence: `${packageName}.build.json`,
    package: packageName,
    inventory: windowsPackageInventoryName(version),
    updaterSignature: `${packageName}.sig`,
  };
}

function expectedPaths(version) {
  const macos = macosArtifactNames(version);
  const linux = linuxArtifactNames(version);
  const windows = windowsArtifactNames(version);
  return new Map([
    ["macos-application-bundle", macos.application],
    ["macos-disk-image", macos.diskImage],
    ["macos-updater-archive", macos.updaterArchive],
    ["macos-updater-signature", macos.updaterSignature],
    ["linux-x86_64-deb", linux.package],
    ["linux-package-inventory", linux.inventory],
    ["linux-build-evidence", linux.buildEvidence],
    ["linux-updater-signature", linux.updaterSignature],
    ["windows-x86_64-nsis", windows.package],
    ["windows-package-inventory", windows.inventory],
    ["windows-build-evidence", windows.buildEvidence],
    ["windows-updater-signature", windows.updaterSignature],
    ["stable-update-envelope", "stable.json"],
    ["upgrade-matrix", "supported-upgrades.json"],
    ["release-notes", "RELEASE_NOTES.md"],
  ]);
}

function updaterSignatures(version, updateKeyId) {
  const macos = macosArtifactNames(version);
  const linux = linuxArtifactNames(version);
  const windows = windowsArtifactNames(version);
  return [
    {
      target: macosTarget,
      algorithm: "minisign-ed25519",
      keyId: updateKeyId,
      subjectPath: macos.updaterArchive,
      signaturePath: macos.updaterSignature,
    },
    {
      target: linuxTarget,
      algorithm: "minisign-ed25519",
      keyId: updateKeyId,
      subjectPath: linux.package,
      signaturePath: linux.updaterSignature,
    },
    {
      target: windowsTarget,
      algorithm: "minisign-ed25519",
      keyId: updateKeyId,
      subjectPath: windows.package,
      signaturePath: windows.updaterSignature,
    },
  ];
}

export function createCompletePlatformReleaseManifest({
  version,
  revision: sourceRevision,
  generatedAt,
  storageSchemaVersion,
  releaseKeyId,
  updateKeyId,
  updateSequence,
  macosCertificateSha256,
  macosTeamIdentifier,
  windowsCertificateSha256,
  generators,
  artifacts,
}) {
  const sortedArtifacts = [...artifacts].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
  const manifest = {
    format: "org.fitfreed.release-manifest",
    schemaVersion: 7,
    release: {
      version,
      revision: sourceRevision,
      generatedAt,
      channel: "public-stable",
    },
    application: {
      productName: "FitFreed",
      identifier: "org.fitfreed.desktop",
      executable: "fitfreed",
      storageSchemaVersion,
    },
    platforms: [
      {
        target: macosTarget,
        os: "macos",
        architecture: "aarch64",
        minimumSystemVersion: "15.0",
        trust: {
          codeSigning: {
            identity: "developer-id-application",
            certificateSha256: macosCertificateSha256,
            teamIdentifier: macosTeamIdentifier,
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
      },
      {
        target: linuxTarget,
        os: "linux",
        architecture: "x86_64",
        packageFormat: "deb",
        supportedDistributions: [
          { id: "ubuntu", version: "24.04", edition: "desktop" },
          { id: "ubuntu", version: "26.04", edition: "desktop" },
        ],
        trust: {
          nativePackageIdentity: {
            status: "not-provided",
            reason: "no-selected-linux-platform-signature",
          },
        },
      },
      {
        target: windowsTarget,
        os: "windows",
        architecture: "x86_64",
        operatingSystemFamily: "windows-11",
        supportPolicy: "supported-editions-at-candidate-issuance",
        packageFormat: "nsis",
        installMode: "currentUser",
        webviewInstallMode: "offlineInstaller",
        trust: {
          authenticode: {
            status: "valid",
            digestAlgorithm: "sha256",
            certificateSha256: windowsCertificateSha256,
            rfc3161Timestamp: true,
          },
        },
      },
    ],
    trust: {
      releaseSignature: {
        algorithm: "minisign-ed25519",
        keyId: releaseKeyId,
        subjectPath: "SHA256SUMS",
        signaturePath: "SHA256SUMS.minisig",
      },
      updaterSignatures: updaterSignatures(version, updateKeyId),
    },
    update: {
      contract: "stable-v3",
      metadataEndpoint: publicUpdateEndpoint,
      keyId: updateKeyId,
      sequence: updateSequence,
      targets: [...targetSet],
    },
    generators,
    artifacts: sortedArtifacts,
    provenanceRequirements: {
      provider: "github-artifact-attestations",
      digestBoundSubjects: sortedArtifacts
        .filter(({ kind }) => kind !== "macos-application-bundle")
        .map(({ path: artifactPath, sha256: artifactSha256 }) => ({
          path: artifactPath,
          sha256: artifactSha256,
        })),
      generatedSubjects: ["release-manifest.json", "SHA256SUMS", "SHA256SUMS.minisig"],
    },
  };
  validateCompletePlatformReleaseManifest(manifest);
  return manifest;
}

export function renderCompletePlatformReleaseNotes({
  revision: sourceRevision,
  storageSchemaVersion,
  version,
}, reviewedNotes) {
  const validatedNotes = validateReviewedReleaseNotes(reviewedNotes);
  return `# FitFreed ${version}

Source revision: \`${sourceRevision}\`
Targets: Apple Silicon macOS, x86-64 Ubuntu Desktop, and x86-64 Windows 11
Storage schema: ${storageSchemaVersion}
Compatibility matrix: \`supported-upgrades.json\`
Update channel: authenticated \`stable-v3\`

The macOS application and disk image are Developer ID signed and Apple notarized. The Windows NSIS setup is
Authenticode signed and timestamped. The Linux Debian package has no selected platform-native signature. Verify
\`SHA256SUMS\`, \`SHA256SUMS.minisig\`, and the GitHub artifact attestations before installation. FitFreed is
distributed without warranty under the project disclaimer.

${validatedNotes}`;
}

export function validateCompletePlatformReleaseManifest(manifest) {
  const errors = [];
  if (!validateSchema(manifest)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `complete-platform manifest schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  if (manifest?.schemaVersion !== 7) {
    errors.push("unsupported complete-platform manifest schema version");
  }
  if (!semanticVersion.test(manifest?.release?.version ?? "")) {
    errors.push("invalid complete-platform release version");
  }
  if (!revision.test(manifest?.release?.revision ?? "")) errors.push("invalid Git revision");
  if (Number.isNaN(Date.parse(manifest?.release?.generatedAt ?? ""))) {
    errors.push("invalid complete-platform release generation time");
  }
  if (manifest?.update?.metadataEndpoint !== publicUpdateEndpoint) {
    errors.push("complete-platform release update endpoint is not canonical");
  }
  if (
    JSON.stringify(manifest?.platforms?.map(({ target }) => target))
    !== JSON.stringify(targetSet)
  ) {
    errors.push("complete-platform set must contain macOS, Linux, and Windows in order");
  }
  if (JSON.stringify(manifest?.update?.targets) !== JSON.stringify(targetSet)) {
    errors.push("complete-platform update target set must contain macOS, Linux, and Windows");
  }

  const paths = new Set();
  const artifactsByKind = new Map();
  let previousPath;
  for (const artifact of manifest?.artifacts ?? []) {
    if (invalidPath(artifact.path)) {
      errors.push(`invalid complete-platform artifact path: ${artifact.path}`);
    }
    if (paths.has(artifact.path)) {
      errors.push(`duplicate complete-platform artifact path: ${artifact.path}`);
    }
    if (previousPath !== undefined && previousPath.localeCompare(artifact.path, "en") > 0) {
      errors.push("complete-platform artifact paths must be sorted");
    }
    previousPath = artifact.path;
    paths.add(artifact.path);
    const sameKind = artifactsByKind.get(artifact.kind) ?? [];
    sameKind.push(artifact);
    artifactsByKind.set(artifact.kind, sameKind);
    if (!Number.isSafeInteger(artifact.size) || artifact.size < 1) {
      errors.push(`invalid complete-platform artifact size: ${artifact.path}`);
    }
    if (!sha256.test(artifact.sha256 ?? "")) {
      errors.push(`invalid complete-platform artifact digest: ${artifact.path}`);
    }
    const expectedTarget = targetsByKind.get(artifact.kind);
    if (expectedTarget !== undefined && artifact.target !== expectedTarget) {
      errors.push(`${artifact.kind} target must be ${expectedTarget}`);
    }
  }
  for (const kind of requiredKinds) {
    if (!artifactsByKind.has(kind)) errors.push(`complete-platform manifest has no ${kind}`);
  }
  for (const kind of singleKinds) {
    if ((artifactsByKind.get(kind) ?? []).length !== 1) {
      errors.push(`complete-platform manifest must contain exactly one ${kind}`);
    }
  }

  for (const [kind, expectedPath] of expectedPaths(manifest?.release?.version)) {
    const actualPath = artifactsByKind.get(kind)?.[0]?.path;
    if (actualPath !== expectedPath) errors.push(`${kind} must be named ${expectedPath}`);
  }

  const expectedUpdaterSignatures = updaterSignatures(
    manifest?.release?.version,
    manifest?.update?.keyId,
  );
  if (
    JSON.stringify(manifest?.trust?.updaterSignatures)
    !== JSON.stringify(expectedUpdaterSignatures)
  ) {
    errors.push("complete-platform updater signature key and subjects must match every target");
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
    errors.push("complete-platform provenance subjects must match every regular manifest artifact");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return manifest;
}
