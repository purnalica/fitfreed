import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverCompletePlatformRecoveryPackages } from "./complete-platform-recovery-discovery.mjs";
import {
  completePlatformReleaseSigningConfiguration,
  completePlatformUpdateConfiguration,
  createCompletePlatformReleaseCandidateFixture,
} from "./test-support/complete-platform-release-candidate.mjs";
import {
  createExpandingPublicReleaseCandidateFixture,
  expandingPublicReleaseSigningConfiguration,
  expandingPublicUpdateConfiguration,
} from "./test-support/expanding-public-release-candidate.mjs";

function immutableReleaseEvidence(context, candidate) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-complete-predecessors-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  context.after(() => rmSync(candidate.root, { force: true, recursive: true }));
  const version = candidate.manifest.release.version;
  const versionDirectory = path.join(root, version);
  mkdirSync(versionDirectory);
  rmSync(path.join(candidate.releaseDirectory, "FitFreed.app"), {
    force: true,
    recursive: true,
  });
  renameSync(candidate.releaseDirectory, path.join(versionDirectory, "release"));
  return { root, version };
}

function matrix(version, baselineVersion, targets) {
  return {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 2,
    release: { version, librarySchemaVersion: 37 },
    supportedApplicationBaselines: [{
      version: baselineVersion,
      targets,
      librarySchemaVersions: [36, 37],
    }],
    supportedLibrarySchemaVersions: Array.from({ length: 37 }, (_, index) => index + 1),
  };
}

test("reopens a distributed macOS and Linux release before admitting recovery bytes", (context) => {
  const candidate = createExpandingPublicReleaseCandidateFixture();
  const evidence = immutableReleaseEvidence(context, candidate);

  const result = discoverCompletePlatformRecoveryPackages({
    evidenceDirectory: evidence.root,
    publicReleaseSigningConfiguration: expandingPublicReleaseSigningConfiguration,
    publicUpdateConfiguration: expandingPublicUpdateConfiguration,
    upgradeMatrix: matrix("0.3.0", evidence.version, [
      "darwin-aarch64",
      "linux-x86_64-deb",
    ]),
  });

  assert.deepEqual(result.expectedRecoveryArtifacts, [{
    librarySchemaVersions: [36, 37],
    target: "linux-x86_64-deb",
    version: evidence.version,
  }]);
  assert.equal(
    result.recoveryPackages[0].packagePath,
    path.join(
      evidence.root,
      evidence.version,
      "release",
      `FitFreed_${evidence.version}_amd64.deb`,
    ),
  );
  assert.equal(
    result.recoveryPackages[0].packageSignaturePath,
    `${result.recoveryPackages[0].packagePath}.sig`,
  );
});

test("reopens a distributed complete release once for Linux and Windows recovery", (context) => {
  const candidate = createCompletePlatformReleaseCandidateFixture();
  const evidence = immutableReleaseEvidence(context, candidate);

  const result = discoverCompletePlatformRecoveryPackages({
    evidenceDirectory: evidence.root,
    publicReleaseSigningConfiguration: completePlatformReleaseSigningConfiguration,
    publicUpdateConfiguration: completePlatformUpdateConfiguration,
    upgradeMatrix: matrix("0.4.0", evidence.version, [
      "darwin-aarch64",
      "linux-x86_64-deb",
      "windows-x86_64-nsis",
    ]),
  });

  assert.deepEqual(
    result.recoveryPackages.map(({ target, packagePath }) => [target, path.basename(packagePath)]),
    [
      ["linux-x86_64-deb", `FitFreed_${evidence.version}_amd64.deb`],
      ["windows-x86_64-nsis", `FitFreed_${evidence.version}_x64-setup.exe`],
    ],
  );
});

test("rejects changed, stale, and unsupported predecessor evidence", (context) => {
  const changedCandidate = createExpandingPublicReleaseCandidateFixture();
  const changed = immutableReleaseEvidence(context, changedCandidate);
  writeFileSync(
    path.join(
      changed.root,
      changed.version,
      "release",
      `FitFreed_${changed.version}_amd64.deb`,
    ),
    "changed predecessor bytes",
  );
  assert.throws(
    () => discoverCompletePlatformRecoveryPackages({
      evidenceDirectory: changed.root,
      publicReleaseSigningConfiguration: expandingPublicReleaseSigningConfiguration,
      publicUpdateConfiguration: expandingPublicUpdateConfiguration,
      upgradeMatrix: matrix("0.3.0", changed.version, ["linux-x86_64-deb"]),
    }),
    /(size|digest) mismatch/,
  );

  const staleCandidate = createExpandingPublicReleaseCandidateFixture();
  const stale = immutableReleaseEvidence(context, staleCandidate);
  mkdirSync(path.join(stale.root, "0.0.1"));
  assert.throws(
    () => discoverCompletePlatformRecoveryPackages({
      evidenceDirectory: stale.root,
      publicReleaseSigningConfiguration: expandingPublicReleaseSigningConfiguration,
      publicUpdateConfiguration: expandingPublicUpdateConfiguration,
      upgradeMatrix: matrix("0.3.0", stale.version, ["linux-x86_64-deb"]),
    }),
    /does not match the declared recovery baselines/,
  );

  const unsupportedCandidate = createExpandingPublicReleaseCandidateFixture();
  const unsupported = immutableReleaseEvidence(context, unsupportedCandidate);
  const manifestPath = path.join(
    unsupported.root,
    unsupported.version,
    "release",
    "release-manifest.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.schemaVersion = 5;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(
    () => discoverCompletePlatformRecoveryPackages({
      evidenceDirectory: unsupported.root,
      publicReleaseSigningConfiguration: expandingPublicReleaseSigningConfiguration,
      publicUpdateConfiguration: expandingPublicUpdateConfiguration,
      upgradeMatrix: matrix("0.3.0", unsupported.version, ["linux-x86_64-deb"]),
    }),
    /unsupported predecessor release manifest version/,
  );
});

test("requires no predecessor evidence when the matrix declares no package baseline", () => {
  assert.deepEqual(discoverCompletePlatformRecoveryPackages({
    evidenceDirectory: undefined,
    publicReleaseSigningConfiguration: {},
    publicUpdateConfiguration: {},
    upgradeMatrix: {
      format: "org.fitfreed.upgrade-matrix",
      schemaVersion: 2,
      release: { version: "0.1.0", librarySchemaVersion: 37 },
      supportedApplicationBaselines: [],
      supportedLibrarySchemaVersions: Array.from(
        { length: 37 },
        (_, index) => index + 1,
      ),
    },
  }), {
    expectedRecoveryArtifacts: [],
    recoveryPackages: [],
  });
});

test("rejects a redirected predecessor evidence root", (context) => {
  const candidate = createExpandingPublicReleaseCandidateFixture();
  const evidence = immutableReleaseEvidence(context, candidate);
  const link = `${evidence.root}-link`;
  context.after(() => rmSync(link, { force: true }));
  symlinkSync(evidence.root, link);

  assert.throws(
    () => discoverCompletePlatformRecoveryPackages({
      evidenceDirectory: link,
      publicReleaseSigningConfiguration: expandingPublicReleaseSigningConfiguration,
      publicUpdateConfiguration: expandingPublicUpdateConfiguration,
      upgradeMatrix: matrix("0.3.0", evidence.version, ["linux-x86_64-deb"]),
    }),
    /predecessor release evidence is not a directory boundary/,
  );
});
