import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createPublicReleaseCandidateFixture,
  publicUpdateConfiguration,
} from "./test-support/public-release-candidate.mjs";
import {
  verifyPublicReleaseCandidate,
  verifyPublicReleaseDistribution,
} from "./verify-public-release.mjs";

test("verifies one complete release and byte-identical minimal Pages snapshot", () => {
  const candidate = createPublicReleaseCandidateFixture();
  const result = verifyPublicReleaseCandidate(candidate.root, publicUpdateConfiguration);

  assert.equal(result.version, "0.1.0");
  assert.equal(result.revision, candidate.revision);
  assert.equal(result.updateSequence, 1);
  assert.equal(result.attestationSubjectCount, 9);
  assert.equal(result.diskImage, path.join(
    candidate.releaseDirectory,
    "FitFreed_0.1.0_aarch64.dmg",
  ));
});

test("verifies the exact distributed file set without requiring an unpacked application", () => {
  const candidate = createPublicReleaseCandidateFixture();
  rmSync(path.join(candidate.releaseDirectory, "FitFreed.app"), { recursive: true });

  const result = verifyPublicReleaseDistribution(
    candidate.releaseDirectory,
    candidate.pagesDirectory,
    publicUpdateConfiguration,
  );
  assert.equal(result.version, "0.1.0");
  assert.equal(result.attestationSubjectCount, 9);
});

test("rejects release mutation and Pages divergence", () => {
  const mutatedRelease = createPublicReleaseCandidateFixture();
  writeFileSync(
    path.join(mutatedRelease.releaseDirectory, "FitFreed_0.1.0_aarch64.app.tar.gz"),
    "mutated updater archive",
  );
  assert.throws(
    () => verifyPublicReleaseCandidate(mutatedRelease.root, publicUpdateConfiguration),
    /size mismatch.*digest mismatch.*checksum mismatch.*Pages byte mismatch/s,
  );

  const mutatedPages = createPublicReleaseCandidateFixture();
  const pagesArchive = path.join(
    mutatedPages.pagesDirectory,
    "updates",
    "0.1.0",
    "FitFreed_0.1.0_aarch64.app.tar.gz",
  );
  writeFileSync(pagesArchive, `${readFileSync(pagesArchive)}mutated`);
  assert.throws(
    () => verifyPublicReleaseCandidate(mutatedPages.root, publicUpdateConfiguration),
    /Pages byte mismatch/,
  );
});

test("cryptographically rejects mutated stable metadata", () => {
  const candidate = createPublicReleaseCandidateFixture();
  const stablePath = path.join(candidate.releaseDirectory, "stable.json");
  const envelope = JSON.parse(readFileSync(stablePath, "utf8"));
  const signatureLines = Buffer.from(
    envelope.fitfreed.signatureBase64,
    "base64",
  ).toString("utf8").trimEnd().split("\n");
  const signatureRecord = Buffer.from(signatureLines[1], "base64");
  signatureRecord[10] ^= 1;
  signatureLines[1] = signatureRecord.toString("base64");
  envelope.fitfreed.signatureBase64 = Buffer.from(`${signatureLines.join("\n")}\n`)
    .toString("base64");
  writeFileSync(stablePath, `${JSON.stringify(envelope)}\n`);

  assert.throws(
    () => verifyPublicReleaseCandidate(candidate.root, publicUpdateConfiguration),
    /invalid stable update evidence: Minisign payload signature is invalid/,
  );
});
