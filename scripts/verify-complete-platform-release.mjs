import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateCompletePlatformReleaseManifest } from "./complete-platform-release-evidence.mjs";
import {
  verifyExpandedPublicReleaseEvidence,
  verifyExpandedPublicReleaseSet,
} from "./verify-expanding-public-release.mjs";
import {
  loadPublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import {
  loadPublicUpdateConfiguration,
} from "./public-update-configuration.mjs";
import { validateWindowsPackageInventory } from "./windows-package-inventory.mjs";
import { validateWindowsPublicBuildEvidence } from "./windows-public-build-evidence.mjs";

const completeTargetKinds = Object.freeze({
  "darwin-aarch64": {
    packageKind: "macos-updater-archive",
    signatureKind: "macos-updater-signature",
  },
  "linux-x86_64-deb": {
    packageKind: "linux-x86_64-deb",
    signatureKind: "linux-updater-signature",
  },
  "windows-x86_64-nsis": {
    packageKind: "windows-x86_64-nsis",
    signatureKind: "windows-updater-signature",
  },
});

function onlyArtifact(manifest, kind) {
  const matches = manifest.artifacts.filter((artifact) => artifact.kind === kind);
  if (matches.length !== 1) {
    throw new Error(`complete-platform release must contain exactly one ${kind}`);
  }
  return matches[0];
}

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function sameArtifact(actual, expected) {
  return actual.path === expected.path
    && actual.kind === expected.kind
    && actual.size === expected.size
    && actual.sha256 === expected.sha256;
}

function verifyWindowsEvidence(releaseDirectory, manifest, updateConfiguration) {
  const packageArtifact = onlyArtifact(manifest, "windows-x86_64-nsis");
  const inventoryArtifact = onlyArtifact(manifest, "windows-package-inventory");
  const buildArtifact = onlyArtifact(manifest, "windows-build-evidence");
  const windowsPlatform = manifest.platforms.find(
    ({ target }) => target === "windows-x86_64-nsis",
  );
  const expectedCertificate = windowsPlatform.trust.authenticode.certificateSha256;

  const inventory = validateWindowsPackageInventory(JSON.parse(
    readFileSync(path.join(releaseDirectory, inventoryArtifact.path), "utf8"),
  ));
  if (
    inventory.artifact.path !== packageArtifact.path
    || inventory.artifact.size !== packageArtifact.size
    || inventory.artifact.sha256 !== packageArtifact.sha256
  ) {
    throw new Error("Windows package inventory does not bind the complete-platform package");
  }
  if (inventory.identity.version !== manifest.release.version) {
    throw new Error("Windows package inventory version does not match the complete-platform manifest");
  }
  const signatures = [
    inventory.signatures.setup,
    inventory.signatures.executable,
    inventory.signatures.uninstaller,
  ];
  if (
    inventory.signatures.profile !== "public-authenticode"
    || signatures.some(({ certificateSha256, status, timestamped }) =>
      certificateSha256 !== expectedCertificate || status !== "Valid" || timestamped !== true)
  ) {
    throw new Error("Windows Authenticode trust does not match the complete-platform manifest");
  }

  const buildEvidence = validateWindowsPublicBuildEvidence(JSON.parse(
    readFileSync(path.join(releaseDirectory, buildArtifact.path), "utf8"),
  ));
  if (buildEvidence.release.version !== manifest.release.version) {
    throw new Error("Windows build evidence version does not match the complete-platform manifest");
  }
  if (buildEvidence.release.revision !== manifest.release.revision) {
    throw new Error("Windows build evidence revision does not match the complete-platform manifest");
  }
  if (
    buildEvidence.application.storageSchemaVersion
    !== manifest.application.storageSchemaVersion
  ) {
    throw new Error("Windows build evidence storage schema does not match the complete-platform manifest");
  }
  if (buildEvidence.trust.authenticodeCertificateSha256 !== expectedCertificate) {
    throw new Error("Windows Authenticode trust does not match the complete-platform build evidence");
  }
  for (const [name, expected] of [
    ["package", packageArtifact],
    ["inventory", inventoryArtifact],
  ]) {
    if (!sameArtifact(buildEvidence.artifacts[name], expected)) {
      throw new Error(`Windows build evidence ${name} does not bind the complete-platform artifact`);
    }
  }
  const expectedKeyIds = updateConfiguration.keys
    .map(({ id }) => id)
    .sort(byteOrder);
  if (
    buildEvidence.update.contract !== updateConfiguration.contract
    || buildEvidence.update.metadataEndpoint !== updateConfiguration.metadataEndpoint
    || JSON.stringify(buildEvidence.update.trustedKeyIds) !== JSON.stringify(expectedKeyIds)
  ) {
    throw new Error("Windows build evidence update trust does not match the complete-platform release");
  }
}

function verifyCompletePlatformRelease(
  releaseDirectory,
  pagesDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
  includeApplication,
) {
  return verifyExpandedPublicReleaseSet({
    additionalEvidenceVerifiers: [verifyWindowsEvidence],
    includeApplication,
    pagesDirectory,
    publicReleaseSigningConfiguration,
    publicUpdateConfiguration,
    releaseDirectory,
    resultProperties(manifest) {
      const windowsArtifact = onlyArtifact(manifest, "windows-x86_64-nsis");
      const windowsPlatform = manifest.platforms.find(
        ({ target }) => target === "windows-x86_64-nsis",
      );
      return {
        windowsCertificateSha256:
          windowsPlatform.trust.authenticode.certificateSha256,
        windowsPackage: path.join(releaseDirectory, windowsArtifact.path),
      };
    },
    targetKinds: completeTargetKinds,
    validateManifest: validateCompletePlatformReleaseManifest,
  });
}

export function verifyCompletePlatformReleaseCandidate(
  candidateDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
) {
  const root = path.resolve(candidateDirectory);
  return verifyCompletePlatformRelease(
    path.join(root, "release"),
    path.join(root, "pages"),
    publicUpdateConfiguration,
    publicReleaseSigningConfiguration,
    true,
  );
}

export function verifyCompletePlatformReleaseDistribution(
  releaseDirectory,
  pagesDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
) {
  return verifyCompletePlatformRelease(
    path.resolve(releaseDirectory),
    path.resolve(pagesDirectory),
    publicUpdateConfiguration,
    publicReleaseSigningConfiguration,
    false,
  );
}

export function verifyCompletePlatformReleaseEvidenceDirectory(
  releaseDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
) {
  const resolvedReleaseDirectory = path.resolve(releaseDirectory);
  return verifyExpandedPublicReleaseEvidence({
    additionalEvidenceVerifiers: [verifyWindowsEvidence],
    includeApplication: false,
    publicReleaseSigningConfiguration,
    publicUpdateConfiguration,
    releaseDirectory: resolvedReleaseDirectory,
    resultProperties(manifest) {
      const windowsArtifact = onlyArtifact(manifest, "windows-x86_64-nsis");
      const windowsPlatform = manifest.platforms.find(
        ({ target }) => target === "windows-x86_64-nsis",
      );
      return {
        windowsCertificateSha256:
          windowsPlatform.trust.authenticode.certificateSha256,
        windowsPackage: path.join(resolvedReleaseDirectory, windowsArtifact.path),
      };
    },
    targetKinds: completeTargetKinds,
    validateManifest: validateCompletePlatformReleaseManifest,
  }).result;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const candidateDirectory = process.argv[2];
    if (!candidateDirectory) {
      throw new Error(
        "usage: node scripts/verify-complete-platform-release.mjs <candidate-directory>",
      );
    }
    const repositoryRoot = path.resolve(import.meta.dirname, "..");
    process.stdout.write(`${JSON.stringify(verifyCompletePlatformReleaseCandidate(
      candidateDirectory,
      loadPublicUpdateConfiguration(repositoryRoot),
      loadPublicReleaseSigningConfiguration(repositoryRoot),
    ))}\n`);
  } catch (error) {
    process.stderr.write(`Complete-platform release verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
