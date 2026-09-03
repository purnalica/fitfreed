import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectPublicLinuxExpansionWorkflow } from "./public-linux-expansion-workflow.mjs";
import { inspectPublicReleasePreflight } from "./public-release-preflight.mjs";
import {
  assertIndependentPublicSigningKeys,
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { validateUpgradeMatrixDocument } from "./upgrade-matrix.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryName = "purnalica/fitfreed";

export function validateLinuxExpansionPrerequisites({
  predecessorRelease,
  releaseKeyId,
  releaseSigningConfiguration,
  updateConfiguration,
  updateKeyId,
  upgradeMatrix,
}) {
  if (upgradeMatrix?.schemaVersion !== 2) {
    throw new Error("Linux expansion requires a target-aware upgrade matrix");
  }
  const predecessor = upgradeMatrix.supportedApplicationBaselines?.at(-1);
  if (!predecessor) {
    throw new Error("Linux expansion requires a published application baseline");
  }
  if (!predecessor.targets?.includes("darwin-aarch64")) {
    throw new Error("Linux expansion predecessor must contain the public macOS target");
  }
  if (
    predecessorRelease?.tagName !== `v${predecessor.version}`
    || predecessorRelease?.isDraft !== false
    || predecessorRelease?.isPrerelease !== false
    || predecessorRelease?.isImmutable !== true
  ) {
    throw new Error("Linux expansion requires the exact immutable public Release predecessor tag");
  }
  if (
    releaseSigningConfiguration?.schemaVersion !== 2
    || releaseSigningConfiguration?.purpose !== "public-release-checksums"
  ) {
    throw new Error("platform-neutral public release-signing trust is required");
  }
  const validatedSigning = validatePublicReleaseSigningConfiguration(
    releaseSigningConfiguration,
  );
  if (validatedSigning.status !== "active") {
    throw new Error("platform-neutral public release-signing trust is inactive");
  }
  if (!validatedSigning.keys.some(({ id }) => id === releaseKeyId)) {
    throw new Error("release checksum signing key is outside the active trust set");
  }
  assertIndependentPublicSigningKeys({
    releaseKeyId,
    releaseSigningConfiguration: validatedSigning,
    updateConfiguration,
    updateKeyId,
  });
  return {
    predecessorTargets: [...predecessor.targets],
    predecessorVersion: predecessor.version,
    releaseKeyId,
  };
}

function readPredecessorRelease(version) {
  try {
    return JSON.parse(execFileSync("gh", [
      "release",
      "view",
      `v${version}`,
      "--repo",
      repositoryName,
      "--json",
      "tagName,isDraft,isPrerelease,isImmutable",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }));
  } catch {
    throw new Error("immutable public macOS predecessor Release is unavailable");
  }
}

export function inspectPublicLinuxExpansionPreflight({
  environment = process.env,
  releaseKeyId,
  updateKeyId,
  version,
}) {
  if (!version || !updateKeyId || !releaseKeyId) {
    throw new Error(
      "usage: npm run preflight:linux-expansion -- <version> <update-key-id> <release-key-id>",
    );
  }
  const upgradeMatrix = validateUpgradeMatrixDocument(JSON.parse(readFileSync(
    path.join(repositoryRoot, "release/upgrade-matrix.json"),
    "utf8",
  )));
  const predecessorVersion = upgradeMatrix.supportedApplicationBaselines.at(-1)?.version;
  const prerequisites = validateLinuxExpansionPrerequisites({
    predecessorRelease: predecessorVersion
      ? readPredecessorRelease(predecessorVersion)
      : undefined,
    releaseKeyId,
    releaseSigningConfiguration: loadPublicReleaseSigningConfiguration(repositoryRoot),
    updateConfiguration: loadPublicUpdateConfiguration(repositoryRoot),
    updateKeyId,
    upgradeMatrix,
  });
  const base = inspectPublicReleasePreflight({
    environment,
    expectedUpdateContract: "stable-v3",
    inspectWorkflow: inspectPublicLinuxExpansionWorkflow,
    updateKeyId,
    version,
  });
  return { ...base, ...prerequisites };
}

function main() {
  const [version, updateKeyId, releaseKeyId] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(inspectPublicLinuxExpansionPreflight({
    releaseKeyId,
    updateKeyId,
    version,
  }))}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Public platform-expansion preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
