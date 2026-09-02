import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverAuthenticatedRecoveryPackages } from "./recovery-package-discovery.mjs";
import {
  createLinuxPublicReleaseCandidateFixture,
  linuxPublicReleaseSigningConfiguration,
  linuxPublicUpdateConfiguration,
} from "./test-support/linux-public-release-candidate.mjs";

function upgradeMatrix() {
  return {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 2,
    release: { version: "0.2.0", librarySchemaVersion: 37 },
    supportedApplicationBaselines: [{
      version: "0.1.0",
      targets: ["darwin-aarch64", "linux-x86_64-deb"],
      librarySchemaVersions: [36, 37],
    }],
    supportedLibrarySchemaVersions: Array.from({ length: 37 }, (_, index) => index + 1),
  };
}

function fixture() {
  const previousRelease = createLinuxPublicReleaseCandidateFixture();
  const evidenceDirectory = mkdtempSync(path.join(tmpdir(), "fitfreed-predecessors-"));
  const targetDirectory = path.join(
    evidenceDirectory,
    "0.1.0",
    "linux-x86_64-deb",
  );
  mkdirSync(targetDirectory, { recursive: true });
  renameSync(previousRelease.releaseDirectory, path.join(targetDirectory, "release"));
  return { evidenceDirectory, previousRelease };
}

function discover(evidenceDirectory, matrix = upgradeMatrix()) {
  return discoverAuthenticatedRecoveryPackages({
    upgradeMatrix: matrix,
    evidenceDirectory,
    publicUpdateConfiguration: linuxPublicUpdateConfiguration,
    publicReleaseSigningConfiguration: linuxPublicReleaseSigningConfiguration,
  });
}

test("discovers an exact predecessor only after reopening its signed release evidence", () => {
  const candidate = fixture();

  const result = discover(candidate.evidenceDirectory);

  assert.deepEqual(result.expectedRecoveryArtifacts, [{
    version: "0.1.0",
    target: "linux-x86_64-deb",
    librarySchemaVersions: [36, 37],
  }]);
  assert.equal(
    result.recoveryPackages[0].packagePath,
    path.join(
      candidate.evidenceDirectory,
      "0.1.0",
      "linux-x86_64-deb",
      "release",
      "FitFreed_0.1.0_amd64.deb",
    ),
  );
});

test("rejects changed predecessor bytes and stale evidence", () => {
  const changed = fixture();
  writeFileSync(
    path.join(
      changed.evidenceDirectory,
      "0.1.0",
      "linux-x86_64-deb",
      "release",
      "FitFreed_0.1.0_amd64.deb",
    ),
    "changed predecessor bytes",
  );
  assert.throws(() => discover(changed.evidenceDirectory), /(size|digest) mismatch/);

  const stale = fixture();
  mkdirSync(path.join(stale.evidenceDirectory, "0.0.9"));
  assert.throws(
    () => discover(stale.evidenceDirectory),
    /does not match the declared recovery baselines/,
  );
});

test("requires no predecessor directory for an initial release", () => {
  const matrix = upgradeMatrix();
  matrix.release.version = "0.1.0";
  matrix.supportedApplicationBaselines = [];

  assert.deepEqual(discover(undefined, matrix), {
    expectedRecoveryArtifacts: [],
    recoveryPackages: [],
  });
});
