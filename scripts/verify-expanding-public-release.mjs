import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateExpandingPublicReleaseManifest } from "./expanding-public-release-evidence.mjs";
import { validateLinuxPackageInventory } from "./linux-package-inventory.mjs";
import { validateLinuxPublicBuildEvidence } from "./linux-public-build-evidence.mjs";
import { publicUpdateUrl } from "./public-origin.mjs";
import {
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import {
  loadPublicUpdateConfiguration,
  validatePublicUpdateConfiguration,
} from "./public-update-configuration.mjs";
import { publicUpdatePackageName } from "./public-update-staging.mjs";
import { verifyStableUpdateEvidence } from "./public-update-verification.mjs";
import {
  decodeReleasePublicKey,
  decodeTauriSignatureText,
  verifyMinisign,
} from "./release-signature.mjs";
import { inspectArtifact, sha256File } from "./release-evidence.mjs";
import { validateUpgradeMatrix } from "./upgrade-matrix.mjs";

const checksumLine = /^([0-9a-f]{64})  ([^/]+)$/;
const targetKinds = Object.freeze({
  "darwin-aarch64": {
    packageKind: "macos-updater-archive",
    signatureKind: "macos-updater-signature",
  },
  "linux-x86_64-deb": {
    packageKind: "linux-x86_64-deb",
    signatureKind: "linux-updater-signature",
  },
});

function onlyArtifact(manifest, kind) {
  const matches = manifest.artifacts.filter((artifact) => artifact.kind === kind);
  if (matches.length !== 1) {
    throw new Error(`expanding public release must contain exactly one ${kind}`);
  }
  return matches[0];
}

function verifyManifestArtifacts(releaseDirectory, manifest) {
  for (const expected of manifest.artifacts) {
    const actual = inspectArtifact(releaseDirectory, expected.path, expected.kind);
    if (actual.size !== expected.size) throw new Error(`size mismatch: ${expected.path}`);
    if (actual.sha256 !== expected.sha256) throw new Error(`digest mismatch: ${expected.path}`);
  }
}

function verifyLinuxEvidence(releaseDirectory, manifest) {
  const packageArtifact = onlyArtifact(manifest, "linux-x86_64-deb");
  const inventoryArtifact = onlyArtifact(manifest, "linux-package-inventory");
  const buildArtifact = onlyArtifact(manifest, "linux-build-evidence");
  const inventory = validateLinuxPackageInventory(JSON.parse(
    readFileSync(path.join(releaseDirectory, inventoryArtifact.path), "utf8"),
  ));
  if (
    inventory.artifact.path !== packageArtifact.path
    || inventory.artifact.size !== packageArtifact.size
    || inventory.artifact.sha256 !== packageArtifact.sha256
  ) {
    throw new Error("Linux package inventory does not bind the expansion package");
  }
  if (inventory.control.version !== manifest.release.version) {
    throw new Error("Linux package inventory version does not match the expansion manifest");
  }

  const buildEvidence = validateLinuxPublicBuildEvidence(JSON.parse(
    readFileSync(path.join(releaseDirectory, buildArtifact.path), "utf8"),
  ));
  if (buildEvidence.release.version !== manifest.release.version) {
    throw new Error("Linux build evidence version does not match the expansion manifest");
  }
  if (buildEvidence.release.revision !== manifest.release.revision) {
    throw new Error("Linux build evidence revision does not match the expansion manifest");
  }
  if (
    buildEvidence.application.storageSchemaVersion
    !== manifest.application.storageSchemaVersion
  ) {
    throw new Error("Linux build evidence storage schema does not match the expansion manifest");
  }
  for (const [name, expected] of [
    ["package", packageArtifact],
    ["inventory", inventoryArtifact],
  ]) {
    const actual = buildEvidence.artifacts[name];
    if (
      actual.path !== expected.path
      || actual.kind !== expected.kind
      || actual.size !== expected.size
      || actual.sha256 !== expected.sha256
    ) {
      throw new Error(`Linux build evidence ${name} does not bind the expansion artifact`);
    }
  }
}

function verifyUpgradeMatrix(releaseDirectory, manifest) {
  const matrixArtifact = onlyArtifact(manifest, "upgrade-matrix");
  const matrix = JSON.parse(readFileSync(path.join(releaseDirectory, matrixArtifact.path), "utf8"));
  validateUpgradeMatrix(matrix, {
    releaseVersion: manifest.release.version,
    currentLibrarySchemaVersion: manifest.application.storageSchemaVersion,
    migrationVersions: Array.from(
      { length: manifest.application.storageSchemaVersion },
      (_, index) => index + 1,
    ),
  });
  return matrix;
}

function checksumEntries(releaseDirectory) {
  const entries = new Map();
  const lines = readFileSync(path.join(releaseDirectory, "SHA256SUMS"), "utf8")
    .trimEnd()
    .split("\n");
  for (const [index, line] of lines.entries()) {
    const match = line.match(checksumLine);
    if (!match) throw new Error(`invalid expanding public checksum line ${index + 1}`);
    const [, digest, relativePath] = match;
    if (entries.has(relativePath)) {
      throw new Error(`duplicate expanding public checksum: ${relativePath}`);
    }
    entries.set(relativePath, digest);
  }
  return entries;
}

function verifyChecksums(releaseDirectory, manifest) {
  const entries = checksumEntries(releaseDirectory);
  const expectedSubjects = [
    ...manifest.artifacts
      .filter(({ kind }) => kind !== "macos-application-bundle")
      .map(({ path: artifactPath }) => artifactPath),
    "release-manifest.json",
  ].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify([...entries.keys()]) !== JSON.stringify(expectedSubjects)) {
    throw new Error("expanding public checksum subjects do not match the manifest evidence set");
  }
  for (const [filename, digest] of entries) {
    if (sha256File(path.join(releaseDirectory, filename)) !== digest) {
      throw new Error(`expanding public checksum mismatch: ${filename}`);
    }
  }

  const expectedEntries = new Set([
    ...manifest.artifacts.map(({ path: artifactPath }) => artifactPath),
    "release-manifest.json",
    "SHA256SUMS",
    "SHA256SUMS.minisig",
  ]);
  const actualEntries = readdirSync(releaseDirectory, { withFileTypes: true });
  if (
    actualEntries.length !== expectedEntries.size
    || actualEntries.some(({ name }) => !expectedEntries.has(name))
    || actualEntries.some((entry) =>
      entry.name === "FitFreed.app" ? !entry.isDirectory() : !entry.isFile())
  ) {
    throw new Error("expanding public release contains an unexpected entry");
  }
}

function verifyReleaseSignature(releaseDirectory, manifest, signingConfiguration) {
  const configuration = validatePublicReleaseSigningConfiguration(signingConfiguration);
  if (configuration.status !== "active") {
    throw new Error("public release-signing trust is inactive");
  }
  const keyId = manifest.trust.releaseSignature.keyId;
  const trustedKey = configuration.keys.find(({ id }) => id === keyId);
  if (!trustedKey) throw new Error("expanding release-signing key is outside configured trust");
  verifyMinisign({
    payload: readFileSync(path.join(releaseDirectory, "SHA256SUMS")),
    publicKeyText: decodeReleasePublicKey(trustedKey.publicKey),
    signatureText: readFileSync(path.join(releaseDirectory, "SHA256SUMS.minisig"), "utf8"),
  });
}

function relativeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(path.relative(root, entryPath));
      else throw new Error(`unsupported expanding Pages entry: ${entry.name}`);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function verifyPagesSnapshot(
  releaseDirectory,
  pagesDirectory,
  manifest,
  stable,
  publicUpdateConfiguration,
) {
  const expectedTargets = manifest.update.targets;
  const actualTargets = Object.keys(stable.payload.release.platforms).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (JSON.stringify(actualTargets) !== JSON.stringify([...expectedTargets].sort())) {
    throw new Error("expanding Pages target set does not match manifest evidence");
  }

  const trustedKey = publicUpdateConfiguration.keys.find(
    ({ id }) => id === stable.envelope.fitfreed.keyId,
  );
  const publicKeyText = decodeReleasePublicKey(trustedKey.publicKey);
  const expectedFiles = [path.join("updates", "stable.json")];
  for (const target of expectedTargets) {
    const evidence = stable.payload.release.platforms[target];
    const { packageKind } = targetKinds[target];
    const packageArtifact = onlyArtifact(manifest, packageKind);
    if (evidence.url !== publicUpdateUrl(`${manifest.release.version}/${packageArtifact.path}`)) {
      throw new Error(`expanding Pages update URL is not canonical: ${target}`);
    }
    const relativePath = path.join("updates", manifest.release.version, packageArtifact.path);
    expectedFiles.push(relativePath);
    const packagePath = path.join(pagesDirectory, relativePath);
    const bytes = readFileSync(packagePath);
    if (
      bytes.length !== packageArtifact.size
      || sha256File(packagePath) !== packageArtifact.sha256
      || sha256File(path.join(releaseDirectory, packageArtifact.path)) !== packageArtifact.sha256
    ) {
      throw new Error(`expanding Pages package bytes diverge from release evidence: ${target}`);
    }
    verifyMinisign({
      payload: bytes,
      publicKeyText,
      signatureText: decodeTauriSignatureText(evidence.tauriSignature),
    });
  }
  for (const evidence of stable.payload.release.recoveryArtifacts ?? []) {
    const filename = publicUpdatePackageName(evidence.version, evidence.target);
    if (evidence.url !== publicUpdateUrl(`${evidence.version}/${filename}`)) {
      throw new Error(
        `expanding Pages predecessor URL is not canonical: ${evidence.version}:${evidence.target}`,
      );
    }
    const relativePath = path.join("updates", evidence.version, filename);
    expectedFiles.push(relativePath);
    const bytes = readFileSync(path.join(pagesDirectory, relativePath));
    if (bytes.length !== evidence.size || sha256File(path.join(pagesDirectory, relativePath)) !== evidence.sha256) {
      throw new Error(
        `expanding Pages predecessor bytes diverge from stable metadata: ${evidence.version}:${evidence.target}`,
      );
    }
    verifyMinisign({
      payload: bytes,
      publicKeyText,
      signatureText: decodeTauriSignatureText(evidence.tauriSignature),
    });
  }
  expectedFiles.sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(relativeFiles(pagesDirectory)) !== JSON.stringify(expectedFiles)) {
    throw new Error("expanding Pages staging contains an unexpected public file set");
  }
  if (
    sha256File(path.join(releaseDirectory, "stable.json"))
    !== sha256File(path.join(pagesDirectory, "updates", "stable.json"))
  ) {
    throw new Error("expanding Pages stable metadata bytes diverge from release evidence");
  }
}

export function verifyExpandingPublicReleaseCandidate(
  candidateDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
) {
  const root = path.resolve(candidateDirectory);
  const releaseDirectory = path.join(root, "release");
  const pagesDirectory = path.join(root, "pages");
  const updateConfiguration = validatePublicUpdateConfiguration(publicUpdateConfiguration);
  if (updateConfiguration.status !== "active") throw new Error("public update channel is inactive");
  const manifest = validateExpandingPublicReleaseManifest(JSON.parse(
    readFileSync(path.join(releaseDirectory, "release-manifest.json"), "utf8"),
  ));
  verifyLinuxEvidence(releaseDirectory, manifest);
  verifyManifestArtifacts(releaseDirectory, manifest);
  const upgradeMatrix = verifyUpgradeMatrix(releaseDirectory, manifest);
  verifyChecksums(releaseDirectory, manifest);
  verifyReleaseSignature(releaseDirectory, manifest, publicReleaseSigningConfiguration);

  let stable;
  for (const target of manifest.update.targets) {
    const { packageKind, signatureKind } = targetKinds[target];
    const verified = verifyStableUpdateEvidence({
      releaseDirectory,
      manifest,
      publicUpdateConfiguration: updateConfiguration,
      packageKind,
      signatureKind,
      target,
      upgradeMatrix,
    });
    stable ??= verified;
  }
  verifyPagesSnapshot(
    releaseDirectory,
    pagesDirectory,
    manifest,
    stable,
    updateConfiguration,
  );
  return {
    attestationSubjectCount:
      manifest.provenanceRequirements.digestBoundSubjects.length
      + manifest.provenanceRequirements.generatedSubjects.length,
    releaseKeyId: manifest.trust.releaseSignature.keyId,
    revision: manifest.release.revision,
    targets: [...manifest.update.targets],
    updateSequence: manifest.update.sequence,
    version: manifest.release.version,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const candidateDirectory = process.argv[2];
    if (!candidateDirectory) {
      throw new Error("usage: node scripts/verify-expanding-public-release.mjs <candidate-directory>");
    }
    const repositoryRoot = path.resolve(import.meta.dirname, "..");
    process.stdout.write(`${JSON.stringify(verifyExpandingPublicReleaseCandidate(
      candidateDirectory,
      loadPublicUpdateConfiguration(repositoryRoot),
      loadPublicReleaseSigningConfiguration(repositoryRoot),
    ))}\n`);
  } catch (error) {
    process.stderr.write(`Expanding public release verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
