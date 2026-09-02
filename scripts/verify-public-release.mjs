import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePublicReleaseManifest } from "./public-release-evidence.mjs";
import {
  loadPublicUpdateConfiguration,
  validatePublicUpdateConfiguration,
} from "./public-update-configuration.mjs";
import { verifyStableUpdateEvidence } from "./public-update-verification.mjs";
import { inspectArtifact, sha256File } from "./release-evidence.mjs";
import { validateUpgradeMatrix } from "./upgrade-matrix.mjs";

const checksumLine = /^([0-9a-f]{64})  ([^/]+)$/;

function verifyManifestArtifacts(releaseDirectory, manifest, errors, requireApplication) {
  for (const expected of manifest.artifacts) {
    if (!requireApplication && expected.kind === "macos-application-bundle") continue;
    try {
      const actual = inspectArtifact(releaseDirectory, expected.path, expected.kind);
      if (actual.size !== expected.size) errors.push(`size mismatch: ${expected.path}`);
      if (actual.sha256 !== expected.sha256) errors.push(`digest mismatch: ${expected.path}`);
    } catch (error) {
      errors.push(`cannot inspect ${expected.path}: ${error.message}`);
    }
  }
}

function verifyUpgradeMatrix(releaseDirectory, manifest, errors) {
  try {
    const matrixArtifact = manifest.artifacts.find(({ kind }) => kind === "upgrade-matrix");
    const matrix = JSON.parse(readFileSync(path.join(releaseDirectory, matrixArtifact.path), "utf8"));
    validateUpgradeMatrix(matrix, {
      releaseVersion: manifest.release.version,
      currentLibrarySchemaVersion: manifest.application.storageSchemaVersion,
      migrationVersions: Array.from(
        { length: manifest.application.storageSchemaVersion },
        (_, index) => index + 1,
      ),
    });
  } catch (error) {
    errors.push(`invalid public upgrade matrix: ${error.message}`);
  }
}

function checksumEntries(releaseDirectory, errors) {
  const entries = new Map();
  const lines = readFileSync(path.join(releaseDirectory, "SHA256SUMS"), "utf8")
    .trimEnd()
    .split("\n");
  for (const [index, line] of lines.entries()) {
    const match = line.match(checksumLine);
    if (!match) {
      errors.push(`invalid public checksum line ${index + 1}`);
      continue;
    }
    const [, digest, relativePath] = match;
    if (entries.has(relativePath)) {
      errors.push(`duplicate public checksum: ${relativePath}`);
    } else {
      entries.set(relativePath, digest);
    }
  }
  return entries;
}

function verifyChecksums(releaseDirectory, manifest, errors) {
  const entries = checksumEntries(releaseDirectory, errors);
  const expectedFiles = [
    ...manifest.artifacts
      .filter(({ kind }) => kind !== "macos-application-bundle")
      .map(({ path: artifactPath }) => artifactPath),
    "release-manifest.json",
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actualFiles = readdirSync(releaseDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== "SHA256SUMS")
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    errors.push("public checksum subjects do not match the regular evidence set");
  }
  for (const filename of expectedFiles) {
    const expectedDigest = entries.get(filename);
    if (!expectedDigest) {
      errors.push(`missing public checksum: ${filename}`);
    } else if (sha256File(path.join(releaseDirectory, filename)) !== expectedDigest) {
      errors.push(`public checksum mismatch: ${filename}`);
    }
  }
  for (const filename of entries.keys()) {
    if (!expectedFiles.includes(filename)) errors.push(`unexpected public checksum: ${filename}`);
  }

  const expectedEntries = new Set([
    ...manifest.artifacts.map(({ path: artifactPath }) => artifactPath),
    "release-manifest.json",
    "SHA256SUMS",
  ]);
  for (const { name } of readdirSync(releaseDirectory, { withFileTypes: true })) {
    if (!expectedEntries.has(name)) errors.push(`unexpected public release entry: ${name}`);
  }
}

function verifyStableUpdate(releaseDirectory, manifest, configuration, errors) {
  try {
    verifyStableUpdateEvidence({
      releaseDirectory,
      manifest,
      publicUpdateConfiguration: configuration,
      packageKind: "macos-updater-archive",
      target: "darwin-aarch64",
    });
  } catch (error) {
    errors.push(`invalid stable update evidence: ${error.message}`);
  }
}

function relativeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(path.relative(root, entryPath));
      else throw new Error(`unsupported public candidate entry: ${entry.name}`);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function verifyPublicReleaseDirectories(
  releaseDirectory,
  pagesDirectory,
  publicUpdateConfiguration,
  requireApplication,
) {
  const configuration = validatePublicUpdateConfiguration(publicUpdateConfiguration);
  if (configuration.status !== "active") throw new Error("public update channel is inactive");
  const manifest = JSON.parse(
    readFileSync(path.join(releaseDirectory, "release-manifest.json"), "utf8"),
  );
  validatePublicReleaseManifest(manifest);
  const errors = [];
  verifyManifestArtifacts(releaseDirectory, manifest, errors, requireApplication);
  verifyUpgradeMatrix(releaseDirectory, manifest, errors);
  verifyChecksums(releaseDirectory, manifest, errors);
  verifyStableUpdate(releaseDirectory, manifest, configuration, errors);

  const archive = manifest.artifacts.find(({ kind }) => kind === "macos-updater-archive");
  const expectedPagesFiles = [
    path.join("updates", manifest.release.version, archive.path),
    path.join("updates", "stable.json"),
  ].sort((left, right) => left.localeCompare(right, "en"));
  try {
    if (JSON.stringify(relativeFiles(pagesDirectory)) !== JSON.stringify(expectedPagesFiles)) {
      errors.push("Pages staging contains an unexpected public file set");
    }
    for (const [releaseName, pagesName] of [
      [archive.path, path.join("updates", manifest.release.version, archive.path)],
      ["stable.json", path.join("updates", "stable.json")],
    ]) {
      const releaseDigest = sha256File(path.join(releaseDirectory, releaseName));
      const pagesDigest = sha256File(path.join(pagesDirectory, pagesName));
      if (releaseDigest !== pagesDigest) errors.push(`Pages byte mismatch: ${pagesName}`);
    }
  } catch (error) {
    errors.push(`invalid Pages staging: ${error.message}`);
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    version: manifest.release.version,
    revision: manifest.release.revision,
    diskImage: path.join(
      releaseDirectory,
      manifest.artifacts.find(({ kind }) => kind === "macos-disk-image").path,
    ),
    updateSequence: manifest.update.sequence,
    attestationSubjectCount:
      manifest.provenanceRequirements.digestBoundSubjects.length
      + manifest.provenanceRequirements.generatedSubjects.length,
  };
}

export function verifyPublicReleaseCandidate(candidateDirectory, publicUpdateConfiguration) {
  const root = path.resolve(candidateDirectory);
  return verifyPublicReleaseDirectories(
    path.join(root, "release"),
    path.join(root, "pages"),
    publicUpdateConfiguration,
    true,
  );
}

export function verifyPublicReleaseDistribution(
  releaseDirectory,
  pagesDirectory,
  publicUpdateConfiguration,
) {
  return verifyPublicReleaseDirectories(
    path.resolve(releaseDirectory),
    path.resolve(pagesDirectory),
    publicUpdateConfiguration,
    false,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const candidateDirectory = process.argv[2];
    if (!candidateDirectory) {
      throw new Error("usage: node scripts/verify-public-release.mjs <candidate-directory>");
    }
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const configuration = loadPublicUpdateConfiguration(repositoryRoot);
    process.stdout.write(
      `${JSON.stringify(verifyPublicReleaseCandidate(candidateDirectory, configuration))}\n`,
    );
  } catch (error) {
    process.stderr.write(`Public release verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
