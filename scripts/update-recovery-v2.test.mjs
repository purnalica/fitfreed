import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLinuxUpdateRecoveryTransition,
  validateLinuxUpdateRecoveryV2,
} from "./update-recovery-v2.mjs";

function packageEvidence(relativePath, version, marker) {
  return {
    relativePath,
    version,
    sourceUrl: `https://fitfreed.org/updates/${version}/FitFreed_${version}_amd64.deb`,
    sizeBytes: 1024,
    sha256: marker.repeat(64),
    signingKeyId: "stable.synthetic-1",
    updaterSignature: Buffer.from(`synthetic signature ${marker}`).toString("base64"),
  };
}

function manifest() {
  return {
    format: "org.fitfreed.update-recovery",
    schemaVersion: 2,
    recoveryId: "a".repeat(64),
    phase: "prepared",
    preparedAt: "2026-09-02T08:00:00Z",
    replacementProcess: null,
    platform: {
      os: "linux",
      architecture: "x86_64",
      packageKind: "deb",
      updateTarget: "linux-x86_64-deb",
    },
    source: {
      version: "0.1.0",
      librarySchemaVersion: 37,
      libraryPath: "/var/lib/fitfreed-test/fitfreed.sqlite",
      nativePackage: {
        name: "fitfreed",
        version: "0.1.0",
        architecture: "amd64",
        executablePath: "/usr/bin/fitfreed",
        desktopEntryPath: "/usr/share/applications/fitfreed.desktop",
      },
    },
    target: {
      version: "0.2.0",
      librarySchemaVersion: 38,
      trustedSequence: 2,
      trustedPayloadSha256: "b".repeat(64),
    },
    predecessorPackage: packageEvidence("previous/package.deb", "0.1.0", "c"),
    runnablePredecessor: {
      relativePath: "previous/runnable",
      executableRelativePath: "usr/bin/fitfreed",
      treeSha256: "d".repeat(64),
      sourcePackageSha256: "c".repeat(64),
    },
    libraryBackup: {
      relativePath: "previous/fitfreed.sqlite",
      sizeBytes: 4096,
      sha256: "e".repeat(64),
    },
    targetPackage: packageEvidence("candidate/package.deb", "0.2.0", "f"),
    nativeRecovery: { attempts: 0, lastFailure: null },
  };
}

function replacementProcess() {
  return {
    processId: 1234,
    bootId: "12345678-1234-4123-8123-123456789abc",
    startTimeClockTicks: 987654,
    executablePath: "/usr/bin/fitfreed",
    launchNonce: "1".repeat(64),
    confirmationDeadline: "2026-09-02T08:01:00Z",
  };
}

test("accepts prepared and native-recovery-unavailable Linux recovery states", () => {
  const prepared = manifest();
  assert.equal(validateLinuxUpdateRecoveryV2(prepared), prepared);

  const unavailable = manifest();
  unavailable.phase = "native-recovery-unavailable";
  unavailable.replacementProcess = replacementProcess();
  unavailable.nativeRecovery = {
    attempts: 1,
    lastFailure: "authorization-unavailable",
  };
  assert.equal(validateLinuxUpdateRecoveryV2(unavailable), unavailable);
});

test("rejects cross-version, cross-package, unsafe URL, and digest relationships", () => {
  for (const [mutate, expected] of [
    [(value) => { value.source.nativePackage.version = "0.0.9"; }, /source native package version/],
    [(value) => { value.predecessorPackage.version = "0.0.9"; }, /predecessor package version/],
    [(value) => { value.targetPackage.version = "0.3.0"; }, /target package version/],
    [(value) => { value.target.version = "0.1.0"; }, /must be newer/],
    [(value) => { value.target.librarySchemaVersion = 36; }, /cannot precede/],
    [(value) => { value.runnablePredecessor.sourcePackageSha256 = "9".repeat(64); }, /bind the predecessor/],
    [(value) => { value.predecessorPackage.sourceUrl = `https://credential${String.fromCharCode(64)}example.test/package.deb`; }, /credential-free/],
    [(value) => { value.targetPackage.sourceUrl += "?temporary=credential"; }, /credential-free/],
    [(value) => { value.predecessorPackage.relativePath = "candidate/package.deb"; }, /must be equal/],
  ]) {
    const candidate = manifest();
    mutate(candidate);
    assert.throws(() => validateLinuxUpdateRecoveryV2(candidate), expected);
  }
});

test("uses Semantic Version precedence when deciding whether the target is newer", () => {
  const candidate = manifest();
  candidate.source.version = "1.0.0-beta.10";
  candidate.source.nativePackage.version = "1.0.0-beta.10";
  candidate.predecessorPackage.version = "1.0.0-beta.10";
  candidate.target.version = "1.0.0-beta.2";
  candidate.targetPackage.version = "1.0.0-beta.2";

  assert.throws(() => validateLinuxUpdateRecoveryV2(candidate), /must be newer/);
});

test("rejects lifecycle evidence that does not match its persisted phase", () => {
  const launching = manifest();
  launching.phase = "launching";
  assert.throws(() => validateLinuxUpdateRecoveryV2(launching), /requires replacement process/);

  const preparedWithProcess = manifest();
  preparedWithProcess.replacementProcess = replacementProcess();
  assert.throws(
    () => validateLinuxUpdateRecoveryV2(preparedWithProcess),
    /cannot contain replacement process/,
  );

  const unavailable = manifest();
  unavailable.phase = "native-recovery-unavailable";
  assert.throws(() => validateLinuxUpdateRecoveryV2(unavailable), /persisted failed attempt/);

  const failed = manifest();
  failed.phase = "recovery-failed";
  failed.nativeRecovery = { attempts: 2, lastFailure: "package-manager-failed" };
  assert.throws(() => validateLinuxUpdateRecoveryV2(failed), /three persisted attempts/);

  const recovered = manifest();
  recovered.phase = "recovered";
  assert.throws(() => validateLinuxUpdateRecoveryV2(recovered), /successful persisted attempt/);
});

test("accepts only the documented Linux recovery transitions", () => {
  const allowed = [
    ["prepared", "replacement-started"],
    ["replacement-started", "replacement-installed"],
    ["replacement-started", "recovering"],
    ["replacement-installed", "launching"],
    ["replacement-installed", "recovering"],
    ["launching", "confirmed"],
    ["launching", "recovering"],
    ["recovering", "recovered"],
    ["recovering", "native-recovery-unavailable"],
    ["recovering", "recovery-failed"],
    ["native-recovery-unavailable", "recovering"],
  ];

  for (const [current, next] of allowed) {
    assert.equal(assertLinuxUpdateRecoveryTransition(current, next), next);
  }
  for (const [current, next] of [
    ["prepared", "prepared"],
    ["prepared", "launching"],
    ["confirmed", "recovering"],
    ["recovered", "prepared"],
    ["recovery-failed", "recovering"],
    ["unknown", "prepared"],
    ["prepared", "unknown"],
  ]) {
    assert.throws(
      () => assertLinuxUpdateRecoveryTransition(current, next),
      /invalid Linux update recovery transition/,
    );
  }
});
