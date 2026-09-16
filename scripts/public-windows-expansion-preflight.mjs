import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectPublicReleasePreflight,
} from "./public-release-preflight.mjs";
import { inspectPublicWindowsExpansionWorkflow } from "./public-windows-expansion-workflow.mjs";
import {
  assertIndependentPublicSigningKeys,
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { validateUpgradeMatrixDocument } from "./upgrade-matrix.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryName = "purnalica/fitfreed";
const predecessorTargets = ["darwin-aarch64", "linux-x86_64-deb"];

export function validateWindowsExpansionPrerequisites({
  predecessorRelease,
  releaseKeyId,
  releaseSigningConfiguration,
  updateConfiguration,
  updateKeyId,
  upgradeMatrix,
}) {
  if (upgradeMatrix?.schemaVersion !== 2) {
    throw new Error("Windows expansion requires a target-aware upgrade matrix");
  }
  const predecessor = upgradeMatrix.supportedApplicationBaselines?.at(-1);
  if (!predecessor) {
    throw new Error("Windows expansion requires a published application baseline");
  }
  if (JSON.stringify(predecessor.targets) !== JSON.stringify(predecessorTargets)) {
    throw new Error("Windows expansion predecessor must contain exactly public macOS and Linux");
  }
  if (
    predecessorRelease?.tagName !== `v${predecessor.version}`
    || predecessorRelease?.isDraft !== false
    || predecessorRelease?.isPrerelease !== false
    || predecessorRelease?.isImmutable !== true
  ) {
    throw new Error("Windows expansion requires the exact immutable public Release predecessor tag");
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
    throw new Error("immutable public macOS and Linux predecessor Release is unavailable");
  }
}

export function inspectPublicWindowsExpansionPreflight({
  environment = process.env,
  inspectWorkflow = inspectPublicWindowsExpansionWorkflow,
  releaseKeyId,
  updateKeyId,
  version,
}) {
  if (
    !version
    || !updateKeyId
    || !releaseKeyId
    || typeof inspectWorkflow !== "function"
  ) {
    throw new Error(
      "usage: npm run preflight:windows-expansion -- <version> <update-key-id> <release-key-id>",
    );
  }
  const upgradeMatrix = validateUpgradeMatrixDocument(JSON.parse(readFileSync(
    path.join(repositoryRoot, "release/upgrade-matrix.json"),
    "utf8",
  )));
  const predecessorVersion = upgradeMatrix.supportedApplicationBaselines.at(-1)?.version;
  const prerequisites = validateWindowsExpansionPrerequisites({
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
    inspectWorkflow,
    updateKeyId,
    version,
  });
  return {
    ...base,
    ...prerequisites,
    windowsTrustProfile: "public-unsigned-preview",
  };
}

function main() {
  const [version, updateKeyId, releaseKeyId] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(inspectPublicWindowsExpansionPreflight({
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
    process.stderr.write(`Public Windows expansion preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
