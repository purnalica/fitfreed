import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  expectedWindowsUpdatePackageName,
  validateWindowsUpdateEvidence,
  windowsUpdateBuildArguments,
  windowsUpdatePackageActionCommand,
  windowsUpdateScenarioPlan,
} from "./verify-packaged-windows-update.mjs";

test("defines success, candidate rejection, and interrupted-watchdog recovery journeys", () => {
  assert.deepEqual(windowsUpdateScenarioPlan(), [
    {
      name: "success",
      rejectCandidate: false,
      interruptWatchdog: false,
      expectedOutcome: "updated",
      expectedVersion: "0.2.0",
    },
    {
      name: "candidate-failure",
      rejectCandidate: true,
      interruptWatchdog: false,
      expectedOutcome: "recovered",
      expectedVersion: "0.1.0",
    },
    {
      name: "restart-resumption",
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
  assert.throws(
    () => validateWindowsUpdateEvidence({ ...evidence, installedVersion: "0.2.0" }),
    /invalid/,
  );
  assert.throws(
    () => validateWindowsUpdateEvidence({ ...evidence, privatePath: "C:\\Users\\person" }),
    /unexpected fields/,
  );
});

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
        path.resolve("scripts/run-packaged-windows-update.ps1"),
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

  const source = readFileSync(path.resolve("scripts/run-packaged-windows-update.ps1"), "utf8");
  assert.match(source, /org\.fitfreed\.desktop/);
  assert.match(source, /Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed/);
  assert.match(source, /Get-CimInstance Win32_Process/);
  assert.match(source, /ReparsePoint/);
  assert.doesNotMatch(source, /Remove-Item\s+-Path\s+\$env:/);
});

test("runs native Windows update recovery in the existing complete hosted lane", () => {
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
