import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  recordWindowsVerificationEvidence,
  verifyWindowsVerificationEvidence,
} from "./windows-verification-evidence.mjs";

const fingerprint = "a".repeat(64);

test("records and reopens exact immutable Windows host evidence", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-evidence-"));
  try {
    assert.deepEqual(recordWindowsVerificationEvidence(root, fingerprint), {
      executableFingerprint: fingerprint,
      lane: "windows-2025-x86_64-host",
      schemaVersion: 1,
    });
    assert.equal(verifyWindowsVerificationEvidence(root, fingerprint), true);
    assert.equal(verifyWindowsVerificationEvidence(root, "b".repeat(64)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed for absent, malformed, or non-closed evidence", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-evidence-"));
  try {
    assert.equal(verifyWindowsVerificationEvidence(path.join(root, "absent"), fingerprint), false);
    mkdirSync(path.join(root, "malformed"));
    writeFileSync(path.join(root, "malformed", "windows-host.json"), "not-json");
    assert.equal(verifyWindowsVerificationEvidence(path.join(root, "malformed"), fingerprint), false);

    const closed = path.join(root, "closed");
    recordWindowsVerificationEvidence(closed, fingerprint);
    writeFileSync(path.join(closed, "unexpected"), "unexpected");
    assert.equal(verifyWindowsVerificationEvidence(closed, fingerprint), false);
    assert.throws(
      () => recordWindowsVerificationEvidence(root, "not-a-fingerprint"),
      /fingerprint/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
