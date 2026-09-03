import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  completePlatformReleaseSigningConfiguration,
  completePlatformUpdateConfiguration,
  createCompletePlatformReleaseCandidateFixture,
} from "./test-support/complete-platform-release-candidate.mjs";
import {
  verifyCompletePlatformReleaseCandidate,
  verifyCompletePlatformReleaseDistribution,
} from "./verify-complete-platform-release.mjs";

function verify(candidate) {
  return verifyCompletePlatformReleaseCandidate(
    candidate.root,
    completePlatformUpdateConfiguration,
    completePlatformReleaseSigningConfiguration,
  );
}

test("verifies one complete macOS, Linux, and Windows release candidate", (context) => {
  const candidate = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(candidate.root, { force: true, recursive: true }));

  const result = verify(candidate);

  assert.equal(result.version, "0.3.0");
  assert.equal(result.revision, candidate.revision);
  assert.equal(result.updateSequence, 3);
  assert.deepEqual(result.targets, [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]);
  assert.equal(
    result.windowsPackage,
    path.join(candidate.releaseDirectory, candidate.windowsPackageName),
  );
  assert.equal(result.windowsCertificateSha256, candidate.windowsCertificateSha256);
  assert.equal(result.attestationSubjectCount, 21);
});

test("reopens the exact distributed set without the candidate-only application", (context) => {
  const candidate = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(candidate.root, { force: true, recursive: true }));
  rmSync(path.join(candidate.releaseDirectory, "FitFreed.app"), {
    force: true,
    recursive: true,
  });

  const result = verifyCompletePlatformReleaseDistribution(
    candidate.releaseDirectory,
    candidate.pagesDirectory,
    completePlatformUpdateConfiguration,
    completePlatformReleaseSigningConfiguration,
  );

  assert.equal(result.version, "0.3.0");
  assert.deepEqual(result.targets, [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]);
});

test("rejects Windows inventory and build evidence that do not bind the package", (context) => {
  const inventoryCandidate = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(inventoryCandidate.root, { force: true, recursive: true }));
  const inventoryPath = path.join(
    inventoryCandidate.releaseDirectory,
    inventoryCandidate.windowsInventoryName,
  );
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  inventory.artifact.sha256 = "f".repeat(64);
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  assert.throws(() => verify(inventoryCandidate), /Windows package inventory does not bind/);

  const buildCandidate = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(buildCandidate.root, { force: true, recursive: true }));
  const buildPath = path.join(
    buildCandidate.releaseDirectory,
    buildCandidate.windowsBuildEvidenceName,
  );
  const build = JSON.parse(readFileSync(buildPath, "utf8"));
  build.release.revision = "f".repeat(40);
  writeFileSync(buildPath, `${JSON.stringify(build, null, 2)}\n`);
  assert.throws(() => verify(buildCandidate), /Windows build evidence revision does not match/);
});

test("rejects Windows Authenticode trust that diverges across evidence", (context) => {
  const candidate = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(candidate.root, { force: true, recursive: true }));
  const manifestPath = path.join(candidate.releaseDirectory, "release-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.platforms[2].trust.authenticode.certificateSha256 = "e".repeat(64);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  assert.throws(() => verify(candidate), /Windows Authenticode trust does not match/);
});

test("rejects a Windows package or Pages copy that diverges from signed evidence", (context) => {
  const packageCandidate = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(packageCandidate.root, { force: true, recursive: true }));
  writeFileSync(
    path.join(packageCandidate.releaseDirectory, packageCandidate.windowsPackageName),
    "changed setup bytes",
  );
  assert.throws(() => verify(packageCandidate), /size mismatch|digest mismatch|stable updater/);

  const pagesCandidate = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(pagesCandidate.root, { force: true, recursive: true }));
  rmSync(path.join(
    pagesCandidate.pagesDirectory,
    "updates",
    pagesCandidate.version,
    pagesCandidate.windowsPackageName,
  ));
  assert.throws(() => verify(pagesCandidate), /Pages|ENOENT/);
});

test("rejects an unexpected or incomplete release entry set", (context) => {
  const unexpected = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(unexpected.root, { force: true, recursive: true }));
  writeFileSync(path.join(unexpected.releaseDirectory, "untracked.exe"), "unexpected");
  assert.throws(() => verify(unexpected), /unexpected entry/);

  const incomplete = createCompletePlatformReleaseCandidateFixture();
  context.after(() => rmSync(incomplete.root, { force: true, recursive: true }));
  rmSync(path.join(incomplete.releaseDirectory, `${incomplete.windowsPackageName}.sig`));
  assert.throws(() => verify(incomplete), /ENOENT|signature|entry/);
});
