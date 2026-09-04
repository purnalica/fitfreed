import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  packPublicReleaseCandidate,
  unpackPublicReleaseCandidate,
  validatePublicCandidateArchiveEntries,
} from "./public-release-transport.mjs";
import {
  createPublicReleaseCandidateFixture,
  publicUpdateConfiguration,
} from "./test-support/public-release-candidate.mjs";
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

test("moves one exact verified public candidate across the approval boundary", () => {
  const input = createPublicReleaseCandidateFixture();
  const archivePath = path.join(input.root, "candidate.tar.gz");
  const acceptedDirectory = path.join(input.root, "accepted");

  const packed = packPublicReleaseCandidate({
    candidateDirectory: input.root,
    archivePath,
    publicUpdateConfiguration,
  });
  const unpacked = unpackPublicReleaseCandidate({
    archivePath,
    expectedSha256: packed.archiveSha256,
    candidateDirectory: acceptedDirectory,
    publicUpdateConfiguration,
  });

  assert.deepEqual(unpacked, packed);
  assert.equal(unpacked.version, "0.1.0");
  assert.equal(unpacked.revision, input.revision);
  assert.ok(existsSync(path.join(acceptedDirectory, "release", "release-manifest.json")));
  assert.ok(existsSync(path.join(acceptedDirectory, "pages", "updates", "stable.json")));
});

test("moves one complete expanding platform set across the approval boundary", () => {
  const input = createExpandingPublicReleaseCandidateFixture();
  const archivePath = path.join(input.root, "expanding-candidate.tar.gz");
  const acceptedDirectory = path.join(input.root, "accepted");
  const trust = {
    publicReleaseSigningConfiguration: expandingPublicReleaseSigningConfiguration,
    publicUpdateConfiguration: expandingPublicUpdateConfiguration,
  };

  const packed = packPublicReleaseCandidate({
    archivePath,
    candidateDirectory: input.root,
    ...trust,
  });
  const unpacked = unpackPublicReleaseCandidate({
    archivePath,
    candidateDirectory: acceptedDirectory,
    expectedSha256: packed.archiveSha256,
    ...trust,
  });

  assert.deepEqual(unpacked, packed);
  assert.deepEqual(unpacked.targets, ["darwin-aarch64", "linux-x86_64-deb"]);
});

test("moves one complete three-platform set across the approval boundary", () => {
  const input = createCompletePlatformReleaseCandidateFixture();
  const archivePath = path.join(input.root, "complete-candidate.tar.gz");
  const acceptedDirectory = path.join(input.root, "accepted");
  const trust = {
    publicReleaseSigningConfiguration: completePlatformReleaseSigningConfiguration,
    publicUpdateConfiguration: completePlatformUpdateConfiguration,
  };

  const packed = packPublicReleaseCandidate({
    archivePath,
    candidateDirectory: input.root,
    ...trust,
  });
  const unpacked = unpackPublicReleaseCandidate({
    archivePath,
    candidateDirectory: acceptedDirectory,
    expectedSha256: packed.archiveSha256,
    ...trust,
  });

  assert.deepEqual(unpacked, packed);
  assert.deepEqual(unpacked.targets, [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]);
});

test("rejects mutated transport bytes without creating an accepted candidate", () => {
  const input = createPublicReleaseCandidateFixture();
  const archivePath = path.join(input.root, "candidate.tar.gz");
  const acceptedDirectory = path.join(input.root, "accepted");
  const packed = packPublicReleaseCandidate({
    candidateDirectory: input.root,
    archivePath,
    publicUpdateConfiguration,
  });
  writeFileSync(archivePath, "mutated candidate transport");

  assert.throws(() => unpackPublicReleaseCandidate({
    archivePath,
    expectedSha256: packed.archiveSha256,
    candidateDirectory: acceptedDirectory,
    publicUpdateConfiguration,
  }), /digest mismatch/);
  assert.equal(existsSync(acceptedDirectory), false);
});

test("rejects entries outside the closed release and Pages roots", () => {
  assert.deepEqual(validatePublicCandidateArchiveEntries(
    "release/\nrelease/file\npages/\npages/updates/stable.json",
  ), { entryCount: 4 });
  for (const entries of [
    "release/\n../private-key",
    "release/\npages/\n/absolute",
    "release/\npages/\nunexpected/file",
    "release/\npages/\npages\\escaped",
  ]) {
    assert.throws(() => validatePublicCandidateArchiveEntries(entries), /unsafe/);
  }
});
