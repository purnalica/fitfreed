import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWindowsUpdateRecoveryTransition,
  validateWindowsUpdateRecoveryV3,
} from "./update-recovery-v3.mjs";

const installDirectory = "C:\\Users\\Synthetic\\AppData\\Local\\FitFreed";
const applicationDataDirectory =
  "C:\\Users\\Synthetic\\AppData\\Roaming\\org.fitfreed.desktop";

function packageEvidence(relativePath, version, marker) {
  return {
    relativePath,
    version,
    sourceUrl: `https://fitfreed.org/updates/${version}/FitFreed_${version}_x64-setup.exe`,
    sizeBytes: 1024,
    sha256: marker.repeat(64),
    signingKeyId: "stable.synthetic-1",
    updaterSignature: Buffer.from(`synthetic signature ${marker}`).toString("base64"),
  };
}

function manifest() {
  return {
    format: "org.fitfreed.update-recovery",
    schemaVersion: 3,
    recoveryId: "a".repeat(64),
    phase: "prepared",
    preparedAt: "2026-09-04T08:00:00Z",
    replacementProcess: null,
    platform: {
      os: "windows",
      architecture: "x86_64",
      packageKind: "nsis",
      installationScope: "current-user",
      updateTarget: "windows-x86_64-nsis",
    },
    source: {
      version: "0.1.0",
      librarySchemaVersion: 37,
      libraryPath: `${applicationDataDirectory}\\fitfreed.sqlite`,
      nativePackage: {
        productName: "FitFreed",
        version: "0.1.0",
        architecture: "x86_64",
        installDirectory,
        executablePath: `${installDirectory}\\fitfreed.exe`,
        uninstallerPath: `${installDirectory}\\uninstall.exe`,
        applicationDataDirectory,
      },
    },
    target: {
      version: "0.2.0",
      librarySchemaVersion: 38,
      trustedSequence: 2,
      trustedPayloadSha256: "b".repeat(64),
    },
    predecessorPackage: packageEvidence("previous/package.exe", "0.1.0", "c"),
    runnablePredecessor: {
      relativePath: "previous/runnable",
      executableRelativePath: "fitfreed.exe",
      uninstallerRelativePath: "uninstall.exe",
      treeSha256: "d".repeat(64),
      sourcePackageSha256: "c".repeat(64),
    },
    libraryBackup: {
      relativePath: "previous/fitfreed.sqlite",
      sizeBytes: 4096,
      sha256: "e".repeat(64),
    },
    targetPackage: packageEvidence("candidate/package.exe", "0.2.0", "f"),
    nativeRecovery: { attempts: 0, lastFailure: null },
  };
}

function replacementProcess() {
  return {
    processId: 1234,
    creationTimeFiletime: "134174016000000000",
    executablePath: `${installDirectory}\\fitfreed.exe`,
    launchNonce: "1".repeat(64),
    confirmationDeadline: "2026-09-04T08:01:00Z",
  };
}

test("accepts prepared and native-recovery-unavailable Windows recovery states", () => {
  const prepared = manifest();
  assert.equal(validateWindowsUpdateRecoveryV3(prepared), prepared);

  const unavailable = manifest();
  unavailable.phase = "native-recovery-unavailable";
  unavailable.replacementProcess = replacementProcess();
  unavailable.nativeRecovery = { attempts: 1, lastFailure: "installer-failed" };
  assert.equal(validateWindowsUpdateRecoveryV3(unavailable), unavailable);
});

test("rejects cross-version, cross-package, unsafe URL, and digest relationships", () => {
  for (const [mutate, expected] of [
    [(value) => { value.source.nativePackage.version = "0.0.9"; }, /source native package version/],
    [(value) => { value.predecessorPackage.version = "0.0.9"; }, /predecessor package version/],
    [(value) => { value.targetPackage.version = "0.3.0"; }, /target package version/],
    [(value) => { value.target.version = "0.1.0"; }, /must be newer/],
    [(value) => { value.target.librarySchemaVersion = 36; }, /cannot precede/],
    [(value) => { value.runnablePredecessor.sourcePackageSha256 = "9".repeat(64); }, /bind the predecessor/],
    [(value) => { value.predecessorPackage.sourceUrl += "?temporary=credential"; }, /credential-free/],
    [(value) => { value.targetPackage.relativePath = "previous/package.exe"; }, /must be equal/],
  ]) {
    const candidate = manifest();
    mutate(candidate);
    assert.throws(() => validateWindowsUpdateRecoveryV3(candidate), expected);
  }
});

test("rejects native path relationships that do not describe one installation", () => {
  for (const [mutate, expected] of [
    [(value) => { value.source.nativePackage.executablePath = "C:\\Other\\fitfreed.exe"; }, /executable path/],
    [(value) => { value.source.nativePackage.uninstallerPath = "C:\\Other\\uninstall.exe"; }, /uninstaller path/],
    [(value) => { value.source.libraryPath = "C:\\Other\\fitfreed.sqlite"; }, /library path/],
    [(value) => { value.replacementProcess = replacementProcess(); value.phase = "launching"; value.replacementProcess.executablePath = "C:\\Other\\fitfreed.exe"; }, /replacement executable path/],
  ]) {
    const candidate = manifest();
    mutate(candidate);
    assert.throws(() => validateWindowsUpdateRecoveryV3(candidate), expected);
  }
});

test("rejects another recovery contract and lossy Windows process identity", () => {
  for (const [mutate, expected] of [
    [(value) => { value.schemaVersion = 2; }, /schema violation/],
    [(value) => { value.platform.packageKind = "deb"; }, /schema violation/],
    [(value) => { value.source.libraryPath = "relative\\fitfreed.sqlite"; }, /schema violation/],
    [(value) => {
      value.phase = "launching";
      value.replacementProcess = replacementProcess();
      value.replacementProcess.creationTimeFiletime = 134174016000000000;
    }, /schema violation/],
    [(value) => {
      value.phase = "launching";
      value.replacementProcess = replacementProcess();
      value.replacementProcess.creationTimeFiletime = "0";
    }, /schema violation/],
  ]) {
    const candidate = manifest();
    mutate(candidate);
    assert.throws(() => validateWindowsUpdateRecoveryV3(candidate), expected);
  }
});

test("uses Semantic Version precedence when deciding whether the target is newer", () => {
  const candidate = manifest();
  candidate.source.version = "1.0.0-beta.10";
  candidate.source.nativePackage.version = "1.0.0-beta.10";
  candidate.predecessorPackage.version = "1.0.0-beta.10";
  candidate.target.version = "1.0.0-beta.2";
  candidate.targetPackage.version = "1.0.0-beta.2";

  assert.throws(() => validateWindowsUpdateRecoveryV3(candidate), /must be newer/);
});

test("rejects lifecycle evidence that does not match its persisted phase", () => {
  const launching = manifest();
  launching.phase = "launching";
  assert.throws(() => validateWindowsUpdateRecoveryV3(launching), /requires replacement process/);

  const preparedWithProcess = manifest();
  preparedWithProcess.replacementProcess = replacementProcess();
  assert.throws(
    () => validateWindowsUpdateRecoveryV3(preparedWithProcess),
    /cannot contain replacement process/,
  );

  const unavailable = manifest();
  unavailable.phase = "native-recovery-unavailable";
  assert.throws(() => validateWindowsUpdateRecoveryV3(unavailable), /persisted failed attempt/);

  const failed = manifest();
  failed.phase = "recovery-failed";
  failed.nativeRecovery = { attempts: 2, lastFailure: "installer-failed" };
  assert.throws(() => validateWindowsUpdateRecoveryV3(failed), /three persisted attempts/);

  const recovered = manifest();
  recovered.phase = "recovered";
  assert.throws(() => validateWindowsUpdateRecoveryV3(recovered), /successful persisted attempt/);
});

test("accepts only the documented Windows recovery transitions", () => {
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
    assert.equal(assertWindowsUpdateRecoveryTransition(current, next), next);
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
      () => assertWindowsUpdateRecoveryTransition(current, next),
      /invalid Windows update recovery transition/,
    );
  }
});
