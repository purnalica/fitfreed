import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverCompletePlatformRecoveryPackages } from "./complete-platform-recovery-discovery.mjs";
import { loadPublicReleaseSigningConfiguration } from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { deriveRecoveryArtifactRequirements } from "./update-channel-v3.mjs";
import { validateUpgradeMatrixDocument } from "./upgrade-matrix.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const repositoryName = "purnalica/fitfreed";

function defaultDownloadRelease(version, releaseDirectory) {
  try {
    execFileSync("gh", [
      "release",
      "download",
      `v${version}`,
      "--repo",
      repositoryName,
      "--dir",
      releaseDirectory,
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch {
    throw new Error(`immutable predecessor Release v${version} could not be downloaded`);
  }
}

function validateDownloadedBoundary(releaseDirectory) {
  const entries = readdirSync(releaseDirectory, { withFileTypes: true });
  if (entries.length < 1 || entries.some((entry) => !entry.isFile())) {
    throw new Error("downloaded predecessor Release contains a non-file or no assets");
  }
  for (const { name } of entries) {
    const metadata = lstatSync(path.join(releaseDirectory, name));
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 1) {
      throw new Error("downloaded predecessor Release assets must be non-empty regular files");
    }
  }
}

function defaultVerifyEvidence({ evidenceDirectory, matrix }) {
  return discoverCompletePlatformRecoveryPackages({
    evidenceDirectory,
    publicReleaseSigningConfiguration:
      loadPublicReleaseSigningConfiguration(repositoryRoot),
    publicUpdateConfiguration: loadPublicUpdateConfiguration(repositoryRoot),
    upgradeMatrix: matrix,
  });
}

export function downloadCompletePlatformPredecessors({
  downloadRelease = defaultDownloadRelease,
  matrix,
  outputDirectory,
  verifyEvidence = defaultVerifyEvidence,
}) {
  const validatedMatrix = validateUpgradeMatrixDocument(matrix);
  const output = path.resolve(outputDirectory);
  if (output === path.parse(output).root) {
    throw new Error("predecessor evidence destination is unsafe");
  }
  if (existsSync(output)) {
    throw new Error("predecessor evidence destination already exists");
  }
  const predecessorVersions = [...new Set(
    deriveRecoveryArtifactRequirements(validatedMatrix).map(({ version }) => version),
  )];
  if (predecessorVersions.length < 1) {
    throw new Error("complete-platform release requires at least one package predecessor");
  }
  const parent = path.dirname(output);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(path.join(parent, `.${path.basename(output)}.tmp-`));
  let promoted = false;
  try {
    for (const version of predecessorVersions) {
      const releaseDirectory = path.join(staging, version, "release");
      mkdirSync(releaseDirectory, { recursive: true });
      downloadRelease(version, releaseDirectory);
      validateDownloadedBoundary(releaseDirectory);
    }
    const verified = verifyEvidence({ evidenceDirectory: staging, matrix: validatedMatrix });
    renameSync(staging, output);
    promoted = true;
    return {
      predecessorVersions,
      recoveryPackageCount: verified.recoveryPackages.length,
    };
  } catch (error) {
    if (promoted) rmSync(output, { force: true, recursive: true });
    throw error;
  } finally {
    rmSync(staging, { force: true, recursive: true });
  }
}

function main() {
  const [outputDirectory] = process.argv.slice(2);
  if (!outputDirectory) {
    throw new Error(
      "usage: node scripts/download-complete-platform-predecessors.mjs <output-directory>",
    );
  }
  const matrix = validateUpgradeMatrixDocument(JSON.parse(readFileSync(
    path.join(repositoryRoot, "release/upgrade-matrix.json"),
    "utf8",
  )));
  process.stdout.write(`${JSON.stringify(downloadCompletePlatformPredecessors({
    matrix,
    outputDirectory,
  }))}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Complete-platform predecessor download failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
