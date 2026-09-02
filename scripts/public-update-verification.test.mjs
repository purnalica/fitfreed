import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { publicUpdateEndpoint } from "./public-origin.mjs";
import { inspectArtifact } from "./release-evidence.mjs";
import { stageStableUpdateChannel } from "./public-update-staging.mjs";
import { verifyStableUpdateEvidence } from "./public-update-verification.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";

const authority = createSyntheticMinisignAuthority();

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-stable-v3-verification-"));
  const releaseDirectory = path.join(root, "release");
  const pagesDirectory = path.join(root, "pages");
  const inputsDirectory = path.join(root, "inputs");
  mkdirSync(releaseDirectory);
  mkdirSync(inputsDirectory);

  const version = "0.2.0";
  const currentPackageName = expectedLinuxDebianArtifactName(version);
  const currentPackagePath = path.join(releaseDirectory, currentPackageName);
  const currentPackageBytes = Buffer.from("synthetic current Debian package");
  writeFileSync(currentPackagePath, currentPackageBytes);
  writeFileSync(
    `${currentPackagePath}.sig`,
    authority.signTauri(currentPackageBytes, currentPackageName),
  );

  const macosPackageName = `FitFreed_${version}_aarch64.app.tar.gz`;
  const macosPackagePath = path.join(inputsDirectory, macosPackageName);
  const macosPackageBytes = Buffer.from("synthetic current macOS package");
  writeFileSync(macosPackagePath, macosPackageBytes);
  writeFileSync(
    `${macosPackagePath}.sig`,
    authority.signTauri(macosPackageBytes, macosPackageName),
  );

  const predecessorVersion = "0.1.0";
  const predecessorPackageName = expectedLinuxDebianArtifactName(predecessorVersion);
  const predecessorPackagePath = path.join(inputsDirectory, predecessorPackageName);
  const predecessorPackageBytes = Buffer.from("synthetic predecessor Debian package");
  writeFileSync(predecessorPackagePath, predecessorPackageBytes);
  writeFileSync(
    `${predecessorPackagePath}.sig`,
    authority.signTauri(predecessorPackageBytes, predecessorPackageName),
  );

  const configuration = {
    format: "org.fitfreed.public-update-configuration",
    schemaVersion: 2,
    status: "active",
    contract: "stable-v3",
    metadataEndpoint: publicUpdateEndpoint,
    keys: [{ id: "stable.synthetic-1", publicKey: authority.publicKey }],
  };
  const upgradeMatrix = {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 2,
    release: { version, librarySchemaVersion: 38 },
    supportedApplicationBaselines: [{
      version: predecessorVersion,
      targets: ["darwin-aarch64", "linux-x86_64-deb"],
      librarySchemaVersions: [36, 37],
    }],
    supportedLibrarySchemaVersions: Array.from({ length: 38 }, (_, index) => index + 1),
  };
  stageStableUpdateChannel({
    outputDirectory: pagesDirectory,
    configuration,
    packages: [
      {
        packagePath: macosPackagePath,
        packageSignaturePath: `${macosPackagePath}.sig`,
        target: "darwin-aarch64",
      },
      {
        packagePath: currentPackagePath,
        packageSignaturePath: `${currentPackagePath}.sig`,
        target: "linux-x86_64-deb",
      },
    ],
    recoveryPackages: [{
      version: predecessorVersion,
      target: "linux-x86_64-deb",
      librarySchemaVersions: [36, 37],
      packagePath: predecessorPackagePath,
      packageSignaturePath: `${predecessorPackagePath}.sig`,
    }],
    expectedRecoveryArtifacts: [{
      version: predecessorVersion,
      target: "linux-x86_64-deb",
      librarySchemaVersions: [36, 37],
    }],
    signingKeyId: "stable.synthetic-1",
    version,
    sequence: 3,
    issuedAt: "2026-09-02T08:00:00.000Z",
    expiresAt: "2026-09-09T08:00:00.000Z",
    publishedAt: "2026-09-02T08:00:00.000Z",
    minimumSupportedVersion: predecessorVersion,
    minimumReadableSchemaVersion: 1,
    maximumReadableSchemaVersion: 38,
    targetSchemaVersion: 38,
    releaseNotes: {
      "en-US": "Synthetic recoverable release.",
      "es-ES": "Versión recuperable sintética.",
    },
    withdrawnVersions: [],
    signPayload: (payload) => authority.signTauri(payload, "stable-payload.json"),
  });
  copyFileSync(
    path.join(pagesDirectory, "updates", "stable.json"),
    path.join(releaseDirectory, "stable.json"),
  );

  const manifest = {
    release: { version },
    application: { storageSchemaVersion: 38 },
    update: { contract: "stable-v3", keyId: "stable.synthetic-1", sequence: 3 },
    artifacts: [
      inspectArtifact(releaseDirectory, currentPackageName, "linux-x86_64-deb"),
      inspectArtifact(releaseDirectory, `${currentPackageName}.sig`, "updater-signature"),
      inspectArtifact(releaseDirectory, "stable.json", "stable-update-envelope"),
    ],
  };
  return { configuration, manifest, releaseDirectory, upgradeMatrix };
}

test("verifies stable-v3 metadata against the release and upgrade matrix", () => {
  const candidate = fixture();

  const result = verifyStableUpdateEvidence({
    releaseDirectory: candidate.releaseDirectory,
    manifest: candidate.manifest,
    publicUpdateConfiguration: candidate.configuration,
    upgradeMatrix: candidate.upgradeMatrix,
    packageKind: "linux-x86_64-deb",
    target: "linux-x86_64-deb",
  });

  assert.equal(result.payload.schemaVersion, 3);
  assert.equal(result.payload.release.recoveryArtifacts.length, 1);
  assert.equal(result.payload.release.recoveryArtifacts[0].version, "0.1.0");
});

test("rejects stable-v3 metadata that diverges from the upgrade matrix", () => {
  const candidate = fixture();
  candidate.upgradeMatrix.supportedApplicationBaselines = [];

  assert.throws(
    () => verifyStableUpdateEvidence({
      releaseDirectory: candidate.releaseDirectory,
      manifest: candidate.manifest,
      publicUpdateConfiguration: candidate.configuration,
      upgradeMatrix: candidate.upgradeMatrix,
      packageKind: "linux-x86_64-deb",
      target: "linux-x86_64-deb",
    }),
    /does not match the declared application baselines/,
  );
});

test("rejects a release manifest and public configuration contract mismatch", () => {
  const candidate = fixture();
  candidate.manifest.update.contract = "stable-v2";

  assert.throws(
    () => verifyStableUpdateEvidence({
      releaseDirectory: candidate.releaseDirectory,
      manifest: candidate.manifest,
      publicUpdateConfiguration: candidate.configuration,
      upgradeMatrix: candidate.upgradeMatrix,
      packageKind: "linux-x86_64-deb",
      target: "linux-x86_64-deb",
    }),
    /contracts do not match/,
  );
});
