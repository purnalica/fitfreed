import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { deriveRecoveryArtifactRequirements } from "./update-channel-v3.mjs";
import { verifyLinuxReleaseEvidenceDirectory } from "./verify-linux-public-release.mjs";

function exactDirectories(directory, expectedNames, label) {
  if (!existsSync(directory)) throw new Error(`${label} is unavailable`);
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

function verifyEvidenceLayout(evidenceDirectory, requirements) {
  const requirementsByVersion = new Map();
  for (const requirement of requirements) {
    const targets = requirementsByVersion.get(requirement.version) ?? [];
    targets.push(requirement.target);
    requirementsByVersion.set(requirement.version, targets);
  }
  exactDirectories(
    evidenceDirectory,
    [...requirementsByVersion.keys()],
    "predecessor release evidence",
  );
  for (const [version, targets] of requirementsByVersion) {
    const versionDirectory = path.join(evidenceDirectory, version);
    exactDirectories(versionDirectory, targets, `predecessor evidence for ${version}`);
    for (const target of targets) {
      exactDirectories(
        path.join(versionDirectory, target),
        ["release"],
        `predecessor evidence for ${version}:${target}`,
      );
    }
  }
}

export function discoverAuthenticatedRecoveryPackages({
  upgradeMatrix,
  evidenceDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
}) {
  const requirements = deriveRecoveryArtifactRequirements(upgradeMatrix);
  if (requirements.length === 0) {
    if (evidenceDirectory !== undefined && existsSync(evidenceDirectory)) {
      exactDirectories(evidenceDirectory, [], "predecessor release evidence");
    }
    return { expectedRecoveryArtifacts: [], recoveryPackages: [] };
  }
  if (typeof evidenceDirectory !== "string" || evidenceDirectory.length === 0) {
    throw new Error("predecessor release evidence is unavailable");
  }
  const resolvedEvidenceDirectory = path.resolve(evidenceDirectory);
  if (resolvedEvidenceDirectory === path.parse(resolvedEvidenceDirectory).root) {
    throw new Error("predecessor release evidence directory is unsafe");
  }
  verifyEvidenceLayout(resolvedEvidenceDirectory, requirements);

  const recoveryPackages = requirements.map((requirement) => {
    if (requirement.target !== "linux-x86_64-deb") {
      throw new Error(`predecessor evidence target is unsupported: ${requirement.target}`);
    }
    const releaseDirectory = path.join(
      resolvedEvidenceDirectory,
      requirement.version,
      requirement.target,
      "release",
    );
    const verified = verifyLinuxReleaseEvidenceDirectory(
      releaseDirectory,
      publicUpdateConfiguration,
      publicReleaseSigningConfiguration,
    );
    if (verified.version !== requirement.version || verified.target !== requirement.target) {
      throw new Error(
        `predecessor release identity does not match ${requirement.version}:${requirement.target}`,
      );
    }
    return {
      ...requirement,
      packagePath: verified.packagePath,
      packageSignaturePath: verified.packageSignaturePath,
    };
  });
  return {
    expectedRecoveryArtifacts: requirements,
    recoveryPackages,
  };
}
