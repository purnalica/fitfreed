import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createLinuxPublicReleaseCandidateFixture,
  linuxPublicReleaseSigningConfiguration,
  linuxPublicUpdateConfiguration,
} from "./test-support/linux-public-release-candidate.mjs";
import { verifyLinuxPublicReleaseCandidate } from "./verify-linux-public-release.mjs";

test("verifies the complete signed Linux candidate and multiplatform Pages snapshot", () => {
  const candidate = createLinuxPublicReleaseCandidateFixture();
  const result = verifyLinuxPublicReleaseCandidate(
    candidate.root,
    linuxPublicUpdateConfiguration,
    linuxPublicReleaseSigningConfiguration,
  );

  assert.equal(result.version, "0.1.0");
  assert.equal(result.revision, candidate.revision);
  assert.equal(result.updateSequence, 2);
  assert.equal(candidate.manifest.schemaVersion, 5);
  assert.equal(candidate.manifest.update.contract, "stable-v3");
  assert.equal(result.releaseKeyId, "linux-release.synthetic-1");
  assert.equal(result.attestationSubjectCount, 10);
  assert.equal(result.debianPackage, path.join(
    candidate.releaseDirectory,
    candidate.linuxPackageName,
  ));
});

test("rejects a release signature that no longer authenticates the checksum bytes", () => {
  const candidate = createLinuxPublicReleaseCandidateFixture();
  const signaturePath = path.join(candidate.releaseDirectory, "SHA256SUMS.minisig");
  const lines = readFileSync(signaturePath, "utf8").trimEnd().split("\n");
  const signatureRecord = Buffer.from(lines[1], "base64");
  signatureRecord[10] ^= 1;
  lines[1] = signatureRecord.toString("base64");
  writeFileSync(signaturePath, `${lines.join("\n")}\n`);

  assert.throws(
    () => verifyLinuxPublicReleaseCandidate(
      candidate.root,
      linuxPublicUpdateConfiguration,
      linuxPublicReleaseSigningConfiguration,
    ),
    /Minisign payload signature is invalid/,
  );
});

test("rejects package-inventory and Pages divergence", () => {
  const inventoryCandidate = createLinuxPublicReleaseCandidateFixture();
  const inventoryPath = path.join(
    inventoryCandidate.releaseDirectory,
    `${inventoryCandidate.linuxPackageName}.inventory.json`,
  );
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  inventory.artifact.sha256 = "0".repeat(64);
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  assert.throws(
    () => verifyLinuxPublicReleaseCandidate(
      inventoryCandidate.root,
      linuxPublicUpdateConfiguration,
      linuxPublicReleaseSigningConfiguration,
    ),
    /digest mismatch/,
  );

  const pagesCandidate = createLinuxPublicReleaseCandidateFixture();
  rmSync(path.join(
    pagesCandidate.pagesDirectory,
    "updates",
    "0.1.0",
    "FitFreed_0.1.0_aarch64.app.tar.gz",
  ));
  assert.throws(
    () => verifyLinuxPublicReleaseCandidate(
      pagesCandidate.root,
      linuxPublicUpdateConfiguration,
      linuxPublicReleaseSigningConfiguration,
    ),
    /ENOENT/,
  );
});

test("verifies every authenticated predecessor retained in the Pages snapshot", () => {
  const candidate = createLinuxPublicReleaseCandidateFixture({ withPredecessor: true });
  assert.equal(
    verifyLinuxPublicReleaseCandidate(
      candidate.root,
      linuxPublicUpdateConfiguration,
      linuxPublicReleaseSigningConfiguration,
    ).version,
    "0.2.0",
  );

  const predecessorPath = path.join(
    candidate.pagesDirectory,
    "updates",
    "0.1.0",
    "FitFreed_0.1.0_amd64.deb",
  );
  writeFileSync(predecessorPath, "changed predecessor bytes");
  assert.throws(
    () => verifyLinuxPublicReleaseCandidate(
      candidate.root,
      linuxPublicUpdateConfiguration,
      linuxPublicReleaseSigningConfiguration,
    ),
    /predecessor bytes do not match stable metadata/,
  );
});
