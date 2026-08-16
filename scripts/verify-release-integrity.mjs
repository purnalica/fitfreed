import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectArtifact,
  sha256File,
  validateReleaseManifest,
} from "./release-evidence.mjs";

const checksumLine = /^([0-9a-f]{64})  (.+)$/;

export function verifyReleaseIntegrity(releaseDirectory) {
  const root = path.resolve(releaseDirectory);
  const manifest = JSON.parse(readFileSync(path.join(root, "release-manifest.json"), "utf8"));
  validateReleaseManifest(manifest);

  const errors = [];
  for (const expected of manifest.artifacts) {
    try {
      const actual = inspectArtifact(root, expected.path, expected.kind);
      if (actual.size !== expected.size) errors.push(`size mismatch: ${expected.path}`);
      if (actual.sha256 !== expected.sha256) errors.push(`digest mismatch: ${expected.path}`);
    } catch (error) {
      errors.push(`cannot inspect ${expected.path}: ${error.message}`);
    }
  }

  const checksumEntries = new Map();
  for (const [index, line] of readFileSync(path.join(root, "SHA256SUMS"), "utf8")
    .trimEnd()
    .split("\n")
    .entries()) {
    const match = line.match(checksumLine);
    if (!match) {
      errors.push(`invalid checksum line ${index + 1}`);
      continue;
    }
    const [, digest, relativePath] = match;
    if (
      path.isAbsolute(relativePath) ||
      relativePath.split("/").includes("..") ||
      checksumEntries.has(relativePath)
    ) {
      errors.push(`invalid checksum path: ${relativePath}`);
      continue;
    }
    checksumEntries.set(relativePath, digest);
  }

  const regularEvidence = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== "SHA256SUMS")
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right, "en"));
  const expectedEntries = new Set([
    ...manifest.artifacts.map(({ path: artifactPath }) => artifactPath),
    "release-manifest.json",
    "RELEASE_NOTES.md",
    "SHA256SUMS",
  ]);
  for (const { name } of readdirSync(root, { withFileTypes: true })) {
    if (!expectedEntries.has(name)) errors.push(`unexpected release entry: ${name}`);
  }
  for (const relativePath of regularEvidence) {
    const expectedDigest = checksumEntries.get(relativePath);
    if (!expectedDigest) {
      errors.push(`missing checksum: ${relativePath}`);
    } else if (sha256File(path.join(root, relativePath)) !== expectedDigest) {
      errors.push(`checksum mismatch: ${relativePath}`);
    }
  }
  for (const relativePath of checksumEntries.keys()) {
    const candidate = path.join(root, relativePath);
    try {
      if (!lstatSync(candidate).isFile()) errors.push(`checksum target is not a file: ${relativePath}`);
    } catch {
      errors.push(`checksum target is missing: ${relativePath}`);
    }
    if (!regularEvidence.includes(relativePath)) errors.push(`unexpected checksum: ${relativePath}`);
  }

  const diskImages = manifest.artifacts.filter(({ kind }) => kind === "macos-disk-image");
  if (diskImages.length !== 1) errors.push("release manifest must identify exactly one disk image");
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    version: manifest.release.version,
    revision: manifest.release.revision,
    architecture: manifest.target.architecture,
    diskImage: path.join(root, diskImages[0].path),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    if (!process.argv[2]) throw new Error("usage: node scripts/verify-release-integrity.mjs <release-directory>");
    process.stdout.write(`${JSON.stringify(verifyReleaseIntegrity(process.argv[2]))}\n`);
  } catch (error) {
    process.stderr.write(`Release integrity verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
