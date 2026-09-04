import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { deriveRecoveryArtifactRequirements } from "./update-channel-v3.mjs";
import { verifyCompletePlatformReleaseEvidenceDirectory } from "./verify-complete-platform-release.mjs";
import { verifyExpandingPublicReleaseEvidenceDirectory } from "./verify-expanding-public-release.mjs";

const recoveryKinds = Object.freeze({
  "linux-x86_64-deb": {
    package: "linux-x86_64-deb",
    signature: "linux-updater-signature",
  },
  "windows-x86_64-nsis": {
    package: "windows-x86_64-nsis",
    signature: "windows-updater-signature",
  },
});

function exactDirectories(directory, expectedNames, label) {
  if (!existsSync(directory)) throw new Error(`${label} is unavailable`);
  if (!lstatSync(directory).isDirectory()) {
    throw new Error(`${label} is not a directory boundary`);
  }
  const entries = readdirSync(directory, { withFileTypes: true });
  const actualNames = entries.map(({ name }) => name).sort((left, right) =>
    left.localeCompare(right, "en"));
  const sortedExpectedNames = [...expectedNames].sort((left, right) =>
    left.localeCompare(right, "en"));
  if (
    entries.some((entry) => !entry.isDirectory())
    || JSON.stringify(actualNames) !== JSON.stringify(sortedExpectedNames)
  ) {
    throw new Error(`${label} does not match the declared recovery baselines`);
  }
}

function onlyArtifact(manifest, kind) {
  const matches = manifest.artifacts.filter((artifact) => artifact.kind === kind);
  if (matches.length !== 1) {
    throw new Error(`predecessor release must contain exactly one ${kind}`);
  }
  return matches[0];
}

function verifyPredecessor({
  directory,
  publicReleaseSigningConfiguration,
  publicUpdateConfiguration,
}) {
  exactDirectories(directory, ["release"], "predecessor release version");
  const releaseDirectory = path.join(directory, "release");
  const manifest = JSON.parse(readFileSync(
    path.join(releaseDirectory, "release-manifest.json"),
    "utf8",
  ));
  const verify = {
    6: verifyExpandingPublicReleaseEvidenceDirectory,
    7: verifyCompletePlatformReleaseEvidenceDirectory,
  }[manifest.schemaVersion];
  if (verify === undefined) {
    throw new Error(
      `unsupported predecessor release manifest version: ${manifest.schemaVersion}`,
    );
  }
  const verified = verify(
    releaseDirectory,
    publicUpdateConfiguration,
    publicReleaseSigningConfiguration,
  );
  return { manifest, verified };
}

export function discoverCompletePlatformRecoveryPackages({
  evidenceDirectory,
  publicReleaseSigningConfiguration,
  publicUpdateConfiguration,
  upgradeMatrix,
}) {
  const requirements = deriveRecoveryArtifactRequirements(upgradeMatrix);
  const versions = [...new Set(requirements.map(({ version }) => version))];
  if (requirements.length === 0) {
    if (evidenceDirectory !== undefined && existsSync(evidenceDirectory)) {
      exactDirectories(evidenceDirectory, [], "predecessor release evidence");
    }
    return { expectedRecoveryArtifacts: [], recoveryPackages: [] };
  }
  if (typeof evidenceDirectory !== "string" || evidenceDirectory.length === 0) {
    throw new Error("predecessor release evidence is unavailable");
  }
  const root = path.resolve(evidenceDirectory);
  if (root === path.parse(root).root) {
    throw new Error("predecessor release evidence directory is unsafe");
  }
  exactDirectories(root, versions, "predecessor release evidence");

  const predecessors = new Map(versions.map((version) => [
    version,
    verifyPredecessor({
      directory: path.join(root, version),
      publicReleaseSigningConfiguration,
      publicUpdateConfiguration,
    }),
  ]));
  const recoveryPackages = requirements.map((requirement) => {
    const predecessor = predecessors.get(requirement.version);
    if (
      predecessor.verified.version !== requirement.version
      || !predecessor.verified.targets.includes(requirement.target)
    ) {
      throw new Error(
        `predecessor release identity does not match ${requirement.version}:${requirement.target}`,
      );
    }
    const kinds = recoveryKinds[requirement.target];
    if (kinds === undefined) {
      throw new Error(`predecessor recovery target is unsupported: ${requirement.target}`);
    }
    const releaseDirectory = path.join(root, requirement.version, "release");
    return {
      ...requirement,
      packagePath: path.join(
        releaseDirectory,
        onlyArtifact(predecessor.manifest, kinds.package).path,
      ),
      packageSignaturePath: path.join(
        releaseDirectory,
        onlyArtifact(predecessor.manifest, kinds.signature).path,
      ),
    };
  });
  return { expectedRecoveryArtifacts: requirements, recoveryPackages };
}
