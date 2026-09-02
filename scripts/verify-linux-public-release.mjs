import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateLinuxPublicReleaseManifest } from "./linux-public-release-evidence.mjs";
import { validateLinuxPackageInventory } from "./linux-package-inventory.mjs";
import { publicUpdateUrl } from "./public-origin.mjs";
import {
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import {
  loadPublicUpdateConfiguration,
  validatePublicUpdateConfiguration,
} from "./public-update-configuration.mjs";
import { verifyStableUpdateEvidence } from "./public-update-verification.mjs";
import { publicUpdatePackageName } from "./public-update-staging.mjs";
import {
  decodeReleasePublicKey,
  decodeTauriSignatureText,
  verifyMinisign,
} from "./release-signature.mjs";
import { inspectArtifact, sha256File } from "./release-evidence.mjs";
import { validateUpgradeMatrix } from "./upgrade-matrix.mjs";

const checksumLine = /^([0-9a-f]{64})  ([^/]+)$/;

function onlyArtifact(manifest, kind) {
  const matches = manifest.artifacts.filter((artifact) => artifact.kind === kind);
  if (matches.length !== 1) throw new Error(`Linux public release must contain exactly one ${kind}`);
  return matches[0];
}

function verifyManifestArtifacts(releaseDirectory, manifest) {
  for (const expected of manifest.artifacts) {
    const actual = inspectArtifact(releaseDirectory, expected.path, expected.kind);
    if (actual.size !== expected.size) throw new Error(`size mismatch: ${expected.path}`);
    if (actual.sha256 !== expected.sha256) throw new Error(`digest mismatch: ${expected.path}`);
  }
}

function verifyPackageInventory(releaseDirectory, manifest) {
  const packageArtifact = onlyArtifact(manifest, "linux-x86_64-deb");
  const inventoryArtifact = onlyArtifact(manifest, "linux-package-inventory");
  const inventory = validateLinuxPackageInventory(JSON.parse(
    readFileSync(path.join(releaseDirectory, inventoryArtifact.path), "utf8"),
  ));
  if (
    inventory.artifact.path !== packageArtifact.path
    || inventory.artifact.size !== packageArtifact.size
    || inventory.artifact.sha256 !== packageArtifact.sha256
  ) {
    throw new Error("Linux package inventory does not bind the manifest package");
  }
  if (inventory.control.version !== manifest.release.version) {
    throw new Error("Linux package inventory version does not match the manifest");
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
    if (!match) throw new Error(`invalid Linux public checksum line ${index + 1}`);
    const [, digest, relativePath] = match;
    if (entries.has(relativePath)) throw new Error(`duplicate Linux public checksum: ${relativePath}`);
    entries.set(relativePath, digest);
  }
  return entries;
}

function verifyChecksums(releaseDirectory, manifest) {
  const entries = checksumEntries(releaseDirectory);
  const expectedSubjects = [
    ...manifest.artifacts.map(({ path: artifactPath }) => artifactPath),
    "release-manifest.json",
  ].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify([...entries.keys()]) !== JSON.stringify(expectedSubjects)) {
    throw new Error("Linux public checksum subjects do not match the manifest evidence set");
  }
  for (const [filename, digest] of entries) {
    if (sha256File(path.join(releaseDirectory, filename)) !== digest) {
      throw new Error(`Linux public checksum mismatch: ${filename}`);
    }
  }
  const expectedFiles = new Set([
    ...expectedSubjects,
    "SHA256SUMS",
    "SHA256SUMS.minisig",
  ]);
  const actualEntries = readdirSync(releaseDirectory, { withFileTypes: true });
  if (
    actualEntries.some((entry) => !entry.isFile())
    || actualEntries.length !== expectedFiles.size
    || actualEntries.some(({ name }) => !expectedFiles.has(name))
  ) {
    throw new Error("Linux public release contains an unexpected entry");
  }
}

function verifyReleaseSignature(releaseDirectory, manifest, signingConfiguration) {
  const configuration = validatePublicReleaseSigningConfiguration(signingConfiguration);
  if (configuration.status !== "active") throw new Error("public release-signing trust is inactive");
  const keyId = manifest.trust.releaseSignature.keyId;
  const trustedKey = configuration.keys.find(({ id }) => id === keyId);
  if (!trustedKey) throw new Error("Linux release-signing key is outside configured trust");
  verifyMinisign({
    payload: readFileSync(path.join(releaseDirectory, "SHA256SUMS")),
    publicKeyText: decodeReleasePublicKey(trustedKey.publicKey),
    signatureText: readFileSync(path.join(releaseDirectory, "SHA256SUMS.minisig"), "utf8"),
  });
}

function verifyUpdaterSignature(releaseDirectory, manifest, updateConfiguration) {
  const configuration = validatePublicUpdateConfiguration(updateConfiguration);
  if (configuration.status !== "active") throw new Error("public update channel is inactive");
  const keyId = manifest.trust.updaterSignature.keyId;
  const trustedKey = configuration.keys.find(({ id }) => id === keyId);
  if (!trustedKey) throw new Error("Linux updater-signing key is outside configured trust");
  const packageArtifact = onlyArtifact(manifest, "linux-x86_64-deb");
  const signatureArtifact = onlyArtifact(manifest, "updater-signature");
  verifyMinisign({
    payload: readFileSync(path.join(releaseDirectory, packageArtifact.path)),
    publicKeyText: decodeReleasePublicKey(trustedKey.publicKey),
    signatureText: decodeTauriSignatureText(
      readFileSync(path.join(releaseDirectory, signatureArtifact.path), "utf8").trim(),
    ),
  });
}

export function verifyLinuxReleaseEvidenceDirectory(
  releaseDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
) {
  const manifest = validateLinuxPublicReleaseManifest(JSON.parse(
    readFileSync(path.join(releaseDirectory, "release-manifest.json"), "utf8"),
  ));
  verifyManifestArtifacts(releaseDirectory, manifest);
  verifyPackageInventory(releaseDirectory, manifest);
  const upgradeMatrix = verifyUpgradeMatrix(releaseDirectory, manifest);
  verifyChecksums(releaseDirectory, manifest);
  verifyReleaseSignature(releaseDirectory, manifest, publicReleaseSigningConfiguration);
  verifyUpdaterSignature(releaseDirectory, manifest, publicUpdateConfiguration);
  const packageArtifact = onlyArtifact(manifest, "linux-x86_64-deb");
  const signatureArtifact = onlyArtifact(manifest, "updater-signature");
  return {
    manifest,
    packagePath: path.join(releaseDirectory, packageArtifact.path),
    packageSignaturePath: path.join(releaseDirectory, signatureArtifact.path),
    target: manifest.target.updateTarget,
    upgradeMatrix,
    version: manifest.release.version,
  };
}

function relativeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(path.relative(root, entryPath));
      else throw new Error(`unsupported Linux Pages entry: ${entry.name}`);
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
  const expectedFiles = [path.join("updates", "stable.json")];
  const trustedKey = publicUpdateConfiguration.keys.find(
    ({ id }) => id === stable.envelope.fitfreed.keyId,
  );
  const publicKeyText = decodeReleasePublicKey(trustedKey.publicKey);
  for (const [target, evidence] of Object.entries(stable.payload.release.platforms)) {
    const url = new URL(evidence.url);
    const filename = path.posix.basename(url.pathname);
    if (evidence.url !== publicUpdateUrl(`${manifest.release.version}/${filename}`)) {
      throw new Error(`Linux Pages update URL is not canonical: ${target}`);
    }
    const relativePath = path.join("updates", manifest.release.version, filename);
    expectedFiles.push(relativePath);
    const packagePath = path.join(pagesDirectory, relativePath);
    const bytes = readFileSync(packagePath);
    if (bytes.length !== evidence.size || sha256File(packagePath) !== evidence.sha256) {
      throw new Error(`Linux Pages package bytes do not match stable metadata: ${target}`);
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
        `Linux Pages predecessor URL is not canonical: ${evidence.version}:${evidence.target}`,
      );
    }
    const relativePath = path.join("updates", evidence.version, filename);
    expectedFiles.push(relativePath);
    const packagePath = path.join(pagesDirectory, relativePath);
    const bytes = readFileSync(packagePath);
    if (bytes.length !== evidence.size || sha256File(packagePath) !== evidence.sha256) {
      throw new Error(
        `Linux Pages predecessor bytes do not match stable metadata: ${evidence.version}:${evidence.target}`,
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
    throw new Error("Linux Pages staging contains an unexpected public file set");
  }
  if (
    sha256File(path.join(releaseDirectory, "stable.json"))
    !== sha256File(path.join(pagesDirectory, "updates", "stable.json"))
  ) {
    throw new Error("Linux Pages stable metadata bytes diverge from release evidence");
  }
  const packageArtifact = onlyArtifact(manifest, "linux-x86_64-deb");
  if (
    sha256File(path.join(releaseDirectory, packageArtifact.path))
    !== sha256File(
      path.join(pagesDirectory, "updates", manifest.release.version, packageArtifact.path),
    )
  ) {
    throw new Error("Linux Pages Debian bytes diverge from release evidence");
  }
}

export function verifyLinuxPublicReleaseCandidate(
  candidateDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
) {
  const root = path.resolve(candidateDirectory);
  const releaseDirectory = path.join(root, "release");
  const pagesDirectory = path.join(root, "pages");
  const updateConfiguration = validatePublicUpdateConfiguration(publicUpdateConfiguration);
  if (updateConfiguration.status !== "active") throw new Error("public update channel is inactive");
  const { manifest, upgradeMatrix } = verifyLinuxReleaseEvidenceDirectory(
    releaseDirectory,
    updateConfiguration,
    publicReleaseSigningConfiguration,
  );
  const stable = verifyStableUpdateEvidence({
    releaseDirectory,
    manifest,
    publicUpdateConfiguration: updateConfiguration,
    packageKind: "linux-x86_64-deb",
    target: "linux-x86_64-deb",
    upgradeMatrix,
  });
  if (
    JSON.stringify(Object.keys(stable.payload.release.platforms).sort())
    !== JSON.stringify(["darwin-aarch64", "linux-x86_64-deb"])
  ) {
    throw new Error("Linux stable update must contain exactly the published macOS and Linux targets");
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
    debianPackage: path.join(
      releaseDirectory,
      onlyArtifact(manifest, "linux-x86_64-deb").path,
    ),
    releaseKeyId: manifest.trust.releaseSignature.keyId,
    revision: manifest.release.revision,
    updateSequence: manifest.update.sequence,
    version: manifest.release.version,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const candidateDirectory = process.argv[2];
    if (!candidateDirectory) {
      throw new Error("usage: node scripts/verify-linux-public-release.mjs <candidate-directory>");
    }
    const repositoryRoot = path.resolve(import.meta.dirname, "..");
    process.stdout.write(`${JSON.stringify(verifyLinuxPublicReleaseCandidate(
      candidateDirectory,
      loadPublicUpdateConfiguration(repositoryRoot),
      loadPublicReleaseSigningConfiguration(repositoryRoot),
    ))}\n`);
  } catch (error) {
    process.stderr.write(`Linux public release verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
