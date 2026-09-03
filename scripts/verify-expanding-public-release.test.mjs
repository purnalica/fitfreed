import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createExpandingPublicReleaseCandidateFixture,
  expandingPublicReleaseSigningConfiguration,
  expandingPublicUpdateConfiguration,
} from "./test-support/expanding-public-release-candidate.mjs";
import {
  verifyExpandingPublicReleaseCandidate,
  verifyExpandingPublicReleaseDistribution,
} from "./verify-expanding-public-release.mjs";

function verify(candidate) {
  return verifyExpandingPublicReleaseCandidate(
    candidate.root,
    expandingPublicUpdateConfiguration,
    expandingPublicReleaseSigningConfiguration,
  );
}

test("verifies one complete macOS and Linux expansion candidate", () => {
  const candidate = createExpandingPublicReleaseCandidateFixture();
  const result = verify(candidate);

  assert.equal(result.version, "0.2.0");
  assert.equal(result.revision, candidate.revision);
  assert.equal(result.updateSequence, 2);
  assert.deepEqual(result.targets, ["darwin-aarch64", "linux-x86_64-deb"]);
  assert.equal(result.releaseKeyId, "expansion-release.synthetic-1");
  assert.equal(result.attestationSubjectCount, 17);
});

test("reopens the exact distributed asset set without an unpacked application", () => {
  const candidate = createExpandingPublicReleaseCandidateFixture();
  rmSync(path.join(candidate.releaseDirectory, "FitFreed.app"), {
    force: true,
    recursive: true,
  });

  const result = verifyExpandingPublicReleaseDistribution(
    candidate.releaseDirectory,
    candidate.pagesDirectory,
    expandingPublicUpdateConfiguration,
    expandingPublicReleaseSigningConfiguration,
  );

  assert.equal(result.version, "0.2.0");
  assert.deepEqual(result.targets, ["darwin-aarch64", "linux-x86_64-deb"]);
});

test("rejects a target available in Pages but absent from release evidence", () => {
  const candidate = createExpandingPublicReleaseCandidateFixture();
  const manifestPath = path.join(candidate.releaseDirectory, "release-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.artifacts = manifest.artifacts.filter(
    ({ kind }) => kind !== "macos-updater-archive",
  );
  manifest.provenanceRequirements.digestBoundSubjects =
    manifest.provenanceRequirements.digestBoundSubjects.filter(
      ({ path: artifactPath }) => artifactPath !== candidate.macosUpdaterName,
    );
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  assert.throws(() => verify(candidate), /macos-updater-archive|manifest evidence/);
});

test("rejects mixed source identity in the Linux builder statement", () => {
  const candidate = createExpandingPublicReleaseCandidateFixture();
  const evidencePath = path.join(candidate.releaseDirectory, candidate.linuxBuildEvidenceName);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  evidence.release.revision = "f".repeat(40);
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  assert.throws(() => verify(candidate), /Linux build evidence revision does not match/);
});

test("rejects an updater package or signature that diverges from stable metadata", () => {
  const packageCandidate = createExpandingPublicReleaseCandidateFixture();
  writeFileSync(
    path.join(packageCandidate.releaseDirectory, packageCandidate.macosUpdaterName),
    "changed updater bytes",
  );
  assert.throws(() => verify(packageCandidate), /digest mismatch|size mismatch|stable updater/);

  const signatureCandidate = createExpandingPublicReleaseCandidateFixture();
  writeFileSync(
    path.join(signatureCandidate.releaseDirectory, `${signatureCandidate.linuxPackageName}.sig`),
    "changed signature",
  );
  assert.throws(() => verify(signatureCandidate), /digest mismatch|size mismatch|signature/);
});

test("rejects an incomplete release directory or Pages snapshot", () => {
  const releaseCandidate = createExpandingPublicReleaseCandidateFixture();
  rmSync(path.join(releaseCandidate.releaseDirectory, "SHA256SUMS.minisig"));
  assert.throws(() => verify(releaseCandidate), /ENOENT|signature|entry/);

  const pagesCandidate = createExpandingPublicReleaseCandidateFixture();
  rmSync(path.join(
    pagesCandidate.pagesDirectory,
    "updates",
    "0.2.0",
    pagesCandidate.linuxPackageName,
  ));
  assert.throws(() => verify(pagesCandidate), /Pages|ENOENT/);
});
