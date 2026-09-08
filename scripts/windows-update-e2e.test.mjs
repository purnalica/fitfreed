import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { windowsPathTextsEqual } from "./windows-path-text.mjs";
import {
  coordinateWindowsOfflineRecoveryRetry,
  createWindowsUpdateTransportGate,
  expectedWindowsUpdatePackageName,
  settleWindowsUpdateScenarioTasks,
  validateWindowsUpdateEvidence,
  windowsInstallerFailureHook,
  windowsMissingCandidateVariant,
  windowsPredecessorGateHook,
  windowsUpdateBuildArguments,
  windowsUpdatePackageActionCommand,
  windowsUpdateRecoveryProcessNames,
  windowsUpdateScenarioPlan,
  windowsUpdateTauriInvocation,
} from "./verify-packaged-windows-update.mjs";
import { createWindowsUpdateFailureEvidence } from "../test/update-e2e/support/windows-update-failure-evidence.mjs";
import { runProcessReplacingAction } from "../test/update-e2e/support/process-replacing-action.mjs";

test("matches only equivalent ordinary and verbatim Windows paths", () => {
  const ordinaryDrive = String.raw`C:\FitFreedTests\Profile\fitfreed.sqlite`;
  const verbatimDrive = String.raw`\\?\C:\FitFreedTests\Profile\fitfreed.sqlite`;
  const ordinaryUnc = String.raw`\\server\share\FitFreed\fitfreed.sqlite`;
  const verbatimUnc = String.raw`\\?\UNC\server\share\FitFreed\fitfreed.sqlite`;

  assert.equal(windowsPathTextsEqual(verbatimDrive, ordinaryDrive), true);
  assert.equal(windowsPathTextsEqual(ordinaryDrive, verbatimDrive), true);
  assert.equal(
    windowsPathTextsEqual(verbatimDrive, ordinaryDrive.toLowerCase()),
    true,
  );
  assert.equal(windowsPathTextsEqual(verbatimUnc, ordinaryUnc), true);
  assert.equal(
    windowsPathTextsEqual(
      verbatimDrive,
      String.raw`C:\FitFreedTests\Other\fitfreed.sqlite`,
    ),
    false,
  );
  assert.equal(
    windowsPathTextsEqual(
      String.raw`\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\FitFreed`,
      String.raw`GLOBALROOT\Device\HarddiskVolumeShadowCopy1\FitFreed`,
    ),
    false,
  );
});

test("defines initial release-shaped Windows recovery journeys", () => {
  assert.deepEqual(windowsUpdateScenarioPlan(), [
    {
      name: "success",
      candidateVariant: "ordinary",
      rejectCandidate: false,
      interruptWatchdog: false,
      expectedOutcome: "updated",
      expectedVersion: "0.2.0",
    },
    {
      name: "installer-failure",
      candidateVariant: "installer-failure",
      rejectCandidate: false,
      interruptWatchdog: false,
      expectedOutcome: "recovered",
      expectedVersion: "0.1.0",
    },
    {
      name: "candidate-failure",
      candidateVariant: "ordinary",
      rejectCandidate: true,
      interruptWatchdog: false,
      expectedOutcome: "recovered",
      expectedVersion: "0.1.0",
    },
    {
      name: "recovery-retry",
      candidateVariant: "ordinary",
      gatePredecessor: true,
      rejectCandidate: true,
      interruptWatchdog: false,
      expectedOutcome: "recovered",
      expectedVersion: "0.1.0",
    },
    {
      name: "recovery-exhaustion",
      candidateVariant: "ordinary",
      gatePredecessor: true,
      rejectCandidate: true,
      interruptWatchdog: false,
      expectedOutcome: "manual-reinstall-required",
      expectedVersion: "0.2.0",
    },
    {
      name: "restart-resumption",
      candidateVariant: "ordinary",
      rejectCandidate: false,
      interruptWatchdog: true,
      expectedOutcome: "updated",
      expectedVersion: "0.2.0",
    },
  ]);
});

test("builds only instrumented production-identity NSIS packages", () => {
  const configuration = path.resolve(".artifacts/windows-update-e2e/tauri-build.json");
  assert.deepEqual(windowsUpdateBuildArguments(configuration, "win32", "x64"), [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "nsis",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    "--config",
    "src-tauri/tauri.windows.conf.json",
    "--config",
    configuration,
    "--ignore-version-mismatches",
  ]);
  assert.throws(
    () => windowsUpdateBuildArguments("relative.json", "win32", "x64"),
    /absolute/,
  );
  assert.throws(
    () => windowsUpdateBuildArguments(configuration, "linux", "x64"),
    /x86-64 Windows/,
  );
  assert.throws(
    () => windowsUpdateBuildArguments(configuration, "win32", "arm64"),
    /x86-64 Windows/,
  );
  assert.equal(
    expectedWindowsUpdatePackageName("0.1.0"),
    "FitFreed_0.1.0_x64-setup.exe",
  );
});

test("keeps the recovery process outside the NSIS product image-name boundary", () => {
  assert.deepEqual(windowsUpdateRecoveryProcessNames(), {
    product: "fitfreed.exe",
    recovery: "fitfreed-update-recovery.exe",
  });
  const verifier = readFileSync(
    path.resolve("scripts/verify-packaged-windows-update.mjs"),
    "utf8",
  );
  assert.match(
    verifier,
    /await verifyWindowsRecoveryProcessSurvival\(candidatePackages\.get\("ordinary"\)\)/u,
  );
  assert.match(verifier, /await waitForProcessExit\([\s\S]*productProbe/u);
  assert.match(
    verifier,
    /Candidate installation terminated the dedicated recovery process/u,
  );
  const journey = readFileSync(
    path.resolve("test/update-e2e/windows-update-journey.mjs"),
    "utf8",
  );
  assert.match(
    journey,
    /function replaceWithFallbackSession[\s\S]*previous\/runnable\/fitfreed\.exe/u,
  );
  assert.match(
    journey,
    /function interruptAndResume[\s\S]*previous\/runnable\/fitfreed-update-recovery\.exe/u,
  );
  assert.match(
    journey,
    /const recoveryFallbackArgument = "--fitfreed-update-recovery-fallback"/u,
  );
  assert.match(
    journey,
    /startSession\(fallbackExecutable, \[\s*recoveryFallbackArgument,\s*applicationBinary,\s*\]\)/u,
  );
});

test("invokes every Tauri update operation through the portable Node.js entry point", () => {
  const invocation = windowsUpdateTauriInvocation([
    "signer",
    "generate",
    "--ci",
  ]);

  assert.equal(invocation.program, process.execPath);
  assert.match(
    invocation.arguments[0],
    /node_modules[/\\]@tauri-apps[/\\]cli[/\\]tauri\.js$/,
  );
  assert.deepEqual(invocation.arguments.slice(1), ["signer", "generate", "--ci"]);

  const verifier = readFileSync(
    path.resolve("scripts/verify-packaged-windows-update.mjs"),
    "utf8",
  );
  assert.doesNotMatch(verifier, /run\("npm"/u);
  assert.match(
    verifier,
    /FITFREED_UPDATE_E2E_PACKAGE_SCRIPT: windowsInstalledPackageActionScript/u,
  );
  assert.doesNotMatch(verifier, /\bpackageActionScript\b/u);
});

test("coordinates a local Windows recovery retry while update transport is unavailable", async () => {
  const events = [];
  const transport = createWindowsUpdateTransportGate();
  transport.allowRequest();
  await coordinateWindowsOfflineRecoveryRetry({
    updateTransport: {
      closeTransport() {
        events.push("transport-closed");
        transport.close();
      },
      openTransport() {
        events.push("transport-opened");
        transport.open();
      },
      assertOfflineRecoveryUsedNoTransport() {
        events.push("transport-unused");
        transport.assertUnusedWhileClosed();
      },
    },
    async grantRecovery() {
      events.push("recovery-granted");
    },
    async waitForRecoveryCompletion() {
      events.push("recovery-complete");
    },
    releaseNoticeVerification() {
      events.push("notice-released");
    },
  });
  assert.deepEqual(events, [
    "transport-closed",
    "recovery-granted",
    "recovery-complete",
    "transport-unused",
    "transport-opened",
    "notice-released",
  ]);

  transport.close();
  assert.equal(transport.allowRequest("/stable.json?ignored=private"), false);
  assert.throws(
    () => transport.assertUnusedWhileClosed(),
    /reached update transport.*\/stable\.json/u,
  );
});

test("preserves the primary Windows journey failure while aborting offline coordination", async () => {
  const controller = new AbortController();
  const journeyFailure = new Error("journey failed first");
  const offlineRecovery = new Promise((resolve) => {
    controller.signal.addEventListener("abort", resolve, { once: true });
  });

  await assert.rejects(
    settleWindowsUpdateScenarioTasks({
      journey: Promise.reject(journeyFailure),
      offlineRecovery,
      abortOfflineRecovery: () => controller.abort(),
    }),
    (error) => error === journeyFailure,
  );
  assert.equal(controller.signal.aborted, true);
});

test("retains both Windows journey and offline-coordinator failures in causal order", async () => {
  const controller = new AbortController();
  const journeyFailure = new Error("journey failed first");
  const coordinationFailure = new Error("offline cleanup also failed");
  const offlineRecovery = new Promise((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(coordinationFailure),
      { once: true },
    );
  });

  await assert.rejects(
    settleWindowsUpdateScenarioTasks({
      journey: Promise.reject(journeyFailure),
      offlineRecovery,
      abortOfflineRecovery: () => controller.abort(),
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.deepEqual(error.errors, [journeyFailure, coordinationFailure]);
      assert.match(error.message, /journey failed first.*offline cleanup also failed/u);
      return true;
    },
  );
});

test("accepts WebDriver session loss only after exact native process replacement", async () => {
  const events = [];
  await runProcessReplacingAction({
    async runAction() {
      events.push("action");
      throw new Error(
        "invalid session id: WebDriverError: Session synthetic not found when running execute/sync",
      );
    },
    async verifyExactProcessReplacement() {
      events.push("replacement");
    },
  });
  assert.deepEqual(events, ["action", "replacement"]);

  await assert.rejects(
    runProcessReplacingAction({
      runAction: () => Promise.reject(new Error("element is not clickable")),
      verifyExactProcessReplacement: () => Promise.resolve(),
    }),
    /element is not clickable/u,
  );
  await assert.rejects(
    runProcessReplacingAction({
      runAction: () => Promise.reject(new Error("invalid session id")),
      verifyExactProcessReplacement: () => Promise.reject(new Error("process remains live")),
    }),
    /process remains live/u,
  );
});

test("gates only recovery-time predecessor installation in the synthetic NSIS package", () => {
  assert.equal(
    windowsPredecessorGateHook(),
    [
      "!macro NSIS_HOOK_PREINSTALL",
      '  ReadEnvStr $0 "FITFREED_E2E_WINDOWS_PREDECESSOR_INSTALL_READY"',
      "  StrCmp $0 \"\" fitfreed_predecessor_install_allowed",
      '  IfFileExists "$0" fitfreed_predecessor_install_allowed',
      "  SetErrorLevel 5",
      "  Quit",
      "fitfreed_predecessor_install_allowed:",
      "!macroend",
      "",
    ].join("\n"),
  );
  const verifier = readFileSync(
    path.resolve("scripts/verify-packaged-windows-update.mjs"),
    "utf8",
  );
  assert.match(verifier, /installerHooks: predecessorGateHookPath/);
  assert.match(
    verifier,
    /buildNsisPackage\(currentVersion, publicKey, "predecessor-gated"\)/,
  );
  assert.match(verifier, /updateTransport\.closeTransport\(\)/);
  assert.match(verifier, /updateTransport\.assertOfflineRecoveryUsedNoTransport\(\)/);
});

test("builds installer failure as a signed NSIS preinstall variant", () => {
  assert.equal(
    windowsInstallerFailureHook(),
    [
      "!macro NSIS_HOOK_PREINSTALL",
      "  SetErrorLevel 1",
      "  Quit",
      "!macroend",
      "",
    ].join("\n"),
  );
  const verifier = readFileSync(
    path.resolve("scripts/verify-packaged-windows-update.mjs"),
    "utf8",
  );
  assert.match(verifier, /installerHooks: installerFailureHookPath/);
  assert.match(verifier, /candidate-installer-failure\.exe/);
  assert.match(verifier, /signFile\(retained\)/);
  assert.match(verifier, /candidatePackages\.get\(scenario\.candidateVariant\)/);
});

test("defers a failure-only candidate build until a scenario first requires it", () => {
  const available = new Map([["ordinary", "ordinary-package"]]);

  assert.equal(
    windowsMissingCandidateVariant(available, windowsUpdateScenarioPlan()[0]),
    undefined,
  );
  assert.equal(
    windowsMissingCandidateVariant(available, windowsUpdateScenarioPlan()[1]),
    "installer-failure",
  );
  available.set("installer-failure", "failure-package");
  assert.equal(
    windowsMissingCandidateVariant(available, windowsUpdateScenarioPlan()[1]),
    undefined,
  );

  const verifier = readFileSync(
    path.resolve("scripts/verify-packaged-windows-update.mjs"),
    "utf8",
  );
  const initialCandidates = verifier.match(
    /const candidatePackages = new Map\(\[(?<entries>[\s\S]*?)\]\);/u,
  )?.groups?.entries ?? "";
  assert.match(initialCandidates, /"ordinary"/u);
  assert.doesNotMatch(initialCandidates, /"installer-failure"/u);
  assert.match(
    verifier,
    /windowsMissingCandidateVariant\(candidatePackages, scenario\)[\s\S]*buildNsisPackage\(candidateVersion, publicKey, missingVariant\)/u,
  );
});

test("accepts only privacy-safe evidence matching the declared scenario", () => {
  const evidence = {
    activeRecovery: false,
    installedVersion: "0.1.0",
    libraryState: "locale-preserved",
    locale: "es-ES",
    outcome: "recovered",
    retainedAttempt: false,
    scenario: "candidate-failure",
  };
  assert.deepEqual(validateWindowsUpdateEvidence(evidence), evidence);
  const recoveryRetry = {
    ...evidence,
    scenario: "recovery-retry",
  };
  assert.deepEqual(validateWindowsUpdateEvidence(recoveryRetry), recoveryRetry);
  const exhaustion = {
    ...evidence,
    activeRecovery: true,
    installedVersion: "0.2.0",
    outcome: "manual-reinstall-required",
    retainedAttempt: true,
    scenario: "recovery-exhaustion",
  };
  assert.deepEqual(validateWindowsUpdateEvidence(exhaustion), exhaustion);
  assert.throws(
    () => validateWindowsUpdateEvidence({ ...evidence, installedVersion: "0.2.0" }),
    /invalid/,
  );
  assert.throws(
    () => validateWindowsUpdateEvidence({ ...evidence, privatePath: "C:\\Users\\person" }),
    /unexpected fields/,
  );
});

test("projects a closed privacy-safe Windows update failure snapshot", () => {
  const privateRecoveryId = "private-recovery-id";
  const privatePath = String.raw`D:\confidential-fixture\FitFreed\fitfreed.sqlite`;
  const privateUrl = "https://private.invalid/update";
  const privateHash = "a".repeat(64);
  const evidence = createWindowsUpdateFailureEvidence({
    scenario: "success",
    journeyStage: "terminal-outcome",
    activePointerState: "present",
    attemptManifest: {
      state: "present",
      value: {
        recoveryId: privateRecoveryId,
        phase: "launching",
        replacementProcess: {
          processId: 424_242,
          executablePath: privatePath,
        },
        nativeRecovery: {
          attempts: 0,
          lastFailure: null,
        },
        source: { libraryPath: privatePath },
        targetPackage: { sourceUrl: privateUrl, sha256: privateHash },
      },
    },
    retainedOutcome: {
      state: "absent",
    },
    installedVersion: "0.2.0",
    installedApplicationProcessCount: 1,
    runnablePredecessorProcessCount: 0,
  });

  assert.deepEqual(evidence, {
    check: "packaged-windows-update-failure",
    schemaVersion: 1,
    scenario: "success",
    journeyStage: "terminal-outcome",
    activePointerState: "present",
    attemptManifestState: "present",
    phase: "launching",
    nativeRecoveryAttempts: 0,
    nativeRecoveryLastFailure: null,
    replacementProcessRecorded: true,
    retainedOutcomeState: "absent",
    retainedOutcome: null,
    installedVersion: "0.2.0",
    installedApplicationProcessCount: 1,
    runnablePredecessorProcessCount: 0,
  });
  const serialized = JSON.stringify(evidence);
  for (const privateValue of [
    privateRecoveryId,
    privatePath,
    privateUrl,
    privateHash,
    "424242",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue.replaceAll("\\", "\\\\")));
  }
});

test("records absent or unreadable Windows update failure state without raw values", () => {
  assert.deepEqual(
    createWindowsUpdateFailureEvidence({
      scenario: "candidate-failure",
      journeyStage: "recovery-published",
      activePointerState: "absent",
      attemptManifest: {
        state: "unreadable",
        value: { phase: "private-unknown-phase", privatePath: "/private/value" },
      },
      retainedOutcome: {
        state: "unreadable",
        value: { outcome: "private-unknown-outcome", recoveryId: "private-id" },
      },
      installedVersion: undefined,
      installedApplicationProcessCount: undefined,
      runnablePredecessorProcessCount: undefined,
    }),
    {
      check: "packaged-windows-update-failure",
      schemaVersion: 1,
      scenario: "candidate-failure",
      journeyStage: "recovery-published",
      activePointerState: "absent",
      attemptManifestState: "unreadable",
      phase: null,
      nativeRecoveryAttempts: null,
      nativeRecoveryLastFailure: null,
      replacementProcessRecorded: null,
      retainedOutcomeState: "unreadable",
      retainedOutcome: null,
      installedVersion: null,
      installedApplicationProcessCount: null,
      runnablePredecessorProcessCount: null,
    },
  );
});

test("rejects open Windows update failure evidence dimensions", () => {
  const valid = {
    scenario: "success",
    journeyStage: "application-start",
    activePointerState: "absent",
    attemptManifest: { state: "absent" },
    retainedOutcome: { state: "absent" },
    installedVersion: "0.1.0",
    installedApplicationProcessCount: 0,
    runnablePredecessorProcessCount: 0,
  };

  assert.throws(
    () => createWindowsUpdateFailureEvidence({ ...valid, scenario: "private-scenario" }),
    /scenario/,
  );
  assert.throws(
    () => createWindowsUpdateFailureEvidence({ ...valid, journeyStage: privatePathForTest() }),
    /journey stage/,
  );
  assert.throws(
    () => createWindowsUpdateFailureEvidence({
      ...valid,
      installedApplicationProcessCount: 11,
    }),
    /process count/,
  );
  assert.throws(
    () => createWindowsUpdateFailureEvidence({ ...valid, installedVersion: "private" }),
    /version/,
  );
  assert.throws(
    () => createWindowsUpdateFailureEvidence({ ...valid, privatePath: privatePathForTest() }),
    /unexpected fields/,
  );
});

function privatePathForTest() {
  return String.raw`D:\confidential-fixture\stage`;
}

test("delegates lifecycle operations to a fixed-identity non-interactive Windows boundary", () => {
  const packagePath = path.resolve(
    ".artifacts/windows-update-e2e/packages/FitFreed_0.1.0_x64-setup.exe",
  );
  assert.deepEqual(
    windowsUpdatePackageActionCommand({
      action: "install",
      architecture: "x64",
      packagePath,
      platform: "win32",
      version: "0.1.0",
    }),
    {
      file: "powershell.exe",
      arguments: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.resolve("scripts/run-installed-windows-package.ps1"),
        "-Action",
        "install",
        "-PackagePath",
        packagePath,
        "-ExpectedVersion",
        "0.1.0",
      ],
    },
  );
  assert.throws(
    () => windowsUpdatePackageActionCommand({
      action: "delete",
      architecture: "x64",
      platform: "win32",
    }),
    /unsupported/,
  );
  assert.deepEqual(
    windowsUpdatePackageActionCommand({
      action: "preflight",
      architecture: "x64",
      platform: "win32",
    }).arguments.slice(-2),
    ["-Action", "preflight"],
  );

  const source = readFileSync(path.resolve("scripts/run-installed-windows-package.ps1"), "utf8");
  assert.match(source, /org\.fitfreed\.desktop/);
  assert.match(source, /Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed/);
  assert.match(source, /Get-CimInstance Win32_Process/);
  assert.match(source, /ReparsePoint/);
  assert.doesNotMatch(source, /Remove-Item\s+-Path\s+\$env:/);
});

test("runs native Windows update recovery in the focused or candidate hosted lane", () => {
  const packageManifest = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
  const workflow = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
  const job = workflow.match(
    /  packaged-windows-e2e:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body ?? "";

  assert.equal(
    packageManifest.scripts["verify:windows-update-e2e"],
    "npm run icons && node scripts/verify-packaged-windows-update.mjs",
  );
  assert.match(job, /npm run verify:windows-e2e/);
  assert.match(job, /npm run verify:windows-update-e2e/);
  assert.match(job, /path: \|\n\s+\.artifacts\/e2e\/evidence\n\s+\.artifacts\/windows-update-e2e\/evidence/);
});

test("stops only revalidated exact Windows processes and tolerates an exit race", () => {
  const journey = readFileSync(
    path.resolve("test/update-e2e/windows-update-journey.mjs"),
    "utf8",
  );
  assert.match(journey, /spawnSync\("taskkill\.exe"/);
  assert.match(journey, /await stopApplication\(watchdogExecutable\)/);
  assert.doesNotMatch(journey, /execFileSync\("taskkill\.exe"/);
});

test("retains the closed Windows update failure snapshot before cleanup", () => {
  const journey = readFileSync(
    path.resolve("test/update-e2e/windows-update-journey.mjs"),
    "utf8",
  );
  const failureHandler = journey.indexOf("} catch (error) {");
  const evidenceWrite = journey.indexOf(
    "await writeWindowsUpdateFailureEvidence",
    failureHandler,
  );
  const cleanup = journey.indexOf("} finally {", failureHandler);

  assert.notEqual(failureHandler, -1);
  assert.notEqual(evidenceWrite, -1);
  assert.notEqual(cleanup, -1);
  assert.equal(evidenceWrite < cleanup, true);
  assert.match(journey, /failure-state\.json/u);
  assert.match(journey, /let recovery;/u);
});
