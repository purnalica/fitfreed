import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateCompletePlatformReleaseManifest } from "./complete-platform-release-evidence.mjs";
import {
  verifyCompletePlatformReleaseCandidate,
  verifyCompletePlatformReleaseDistribution,
} from "./verify-complete-platform-release.mjs";
import { validateExpandingPublicReleaseManifest } from "./expanding-public-release-evidence.mjs";
import { loadPublicReleaseSigningConfiguration } from "./public-release-signing-configuration.mjs";
import { validatePublicReleaseManifest } from "./public-release-evidence.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import {
  verifyExpandingPublicReleaseCandidate,
  verifyExpandingPublicReleaseDistribution,
} from "./verify-expanding-public-release.mjs";
import {
  verifyPublicReleaseCandidate,
  verifyPublicReleaseDistribution,
} from "./verify-public-release.mjs";

export function validateSupportedPublicReleaseManifest(manifest) {
  if (manifest?.schemaVersion === 3) return validatePublicReleaseManifest(manifest);
  if (manifest?.schemaVersion === 6) return validateExpandingPublicReleaseManifest(manifest);
  if (manifest?.schemaVersion === 7) return validateCompletePlatformReleaseManifest(manifest);
  throw new Error("unsupported public release manifest schema version");
}

export function verifySupportedPublicReleaseDistribution({
  pagesDirectory,
  publicReleaseSigningConfiguration,
  publicUpdateConfiguration,
  releaseDirectory,
}) {
  const manifest = readSupportedPublicReleaseManifest(releaseDirectory);
  if (manifest.schemaVersion === 3) {
    return verifyPublicReleaseDistribution(
      releaseDirectory,
      pagesDirectory,
      publicUpdateConfiguration,
    );
  }
  if (!publicReleaseSigningConfiguration) {
    throw new Error("platform-expansion release-signing trust is unavailable");
  }
  if (manifest.schemaVersion === 7) {
    return verifyCompletePlatformReleaseDistribution(
      releaseDirectory,
      pagesDirectory,
      publicUpdateConfiguration,
      publicReleaseSigningConfiguration,
    );
  }
  return verifyExpandingPublicReleaseDistribution(
    releaseDirectory,
    pagesDirectory,
    publicUpdateConfiguration,
    publicReleaseSigningConfiguration,
  );
}

export function readSupportedPublicReleaseManifest(releaseDirectory) {
  return validateSupportedPublicReleaseManifest(JSON.parse(
    readFileSync(path.join(releaseDirectory, "release-manifest.json"), "utf8"),
  ));
}

export function verifySupportedPublicReleaseCandidate({
  candidateDirectory,
  publicReleaseSigningConfiguration,
  publicUpdateConfiguration,
}) {
  const releaseDirectory = path.resolve(candidateDirectory, "release");
  const manifest = readSupportedPublicReleaseManifest(releaseDirectory);
  if (manifest.schemaVersion === 3) {
    return {
      manifest,
      verified: verifyPublicReleaseCandidate(
        candidateDirectory,
        publicUpdateConfiguration,
      ),
    };
  }
  if (!publicReleaseSigningConfiguration) {
    throw new Error("platform-expansion release-signing trust is unavailable");
  }
  if (manifest.schemaVersion === 7) {
    return {
      manifest,
      verified: verifyCompletePlatformReleaseCandidate(
        candidateDirectory,
        publicUpdateConfiguration,
        publicReleaseSigningConfiguration,
      ),
    };
  }
  return {
    manifest,
    verified: verifyExpandingPublicReleaseCandidate(
      candidateDirectory,
      publicUpdateConfiguration,
      publicReleaseSigningConfiguration,
    ),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const candidateDirectory = process.argv[2];
    if (!candidateDirectory) {
      throw new Error(
        "usage: node scripts/public-release-candidate-verification.mjs <candidate-directory>",
      );
    }
    const repositoryRoot = path.resolve(import.meta.dirname, "..");
    const { verified } = verifySupportedPublicReleaseCandidate({
      candidateDirectory,
      publicReleaseSigningConfiguration:
        loadPublicReleaseSigningConfiguration(repositoryRoot),
      publicUpdateConfiguration: loadPublicUpdateConfiguration(repositoryRoot),
    });
    process.stdout.write(`${JSON.stringify(verified)}\n`);
  } catch (error) {
    process.stderr.write(`Public release verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
