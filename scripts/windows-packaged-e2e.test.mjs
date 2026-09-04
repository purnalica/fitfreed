import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  expectedWindowsE2eNsisArtifactName,
  resolveWindowsE2eNsisPackage,
  windowsPackagedE2eContract,
  windowsPackageActionCommand,
} from "./run-packaged-windows-e2e.mjs";

test("defines an installed Windows E2E package that cannot replace FitFreed", () => {
  assert.deepEqual(windowsPackagedE2eContract, {
    applicationIdentifier: "org.fitfreed.desktop.e2e",
    architecture: "x64",
    executable: "fitfreed-e2e.exe",
    installDirectory: "%LOCALAPPDATA%\\fitfreed-e2e",
    packageName: "fitfreed-e2e",
    platform: "win32",
    uninstallRegistry:
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\fitfreed-e2e",
  });
});

test("resolves exactly one generated isolated NSIS package", () => {
  const directory = path.resolve("src-tauri/target/e2e/release/bundle/nsis");
  const expectedName = expectedWindowsE2eNsisArtifactName("0.1.0");
  assert.equal(expectedName, "fitfreed-e2e_0.1.0_x64-setup.exe");
  assert.equal(
    resolveWindowsE2eNsisPackage(directory, [expectedName], "0.1.0"),
    path.join(directory, expectedName),
  );
  assert.throws(
    () => resolveWindowsE2eNsisPackage(directory, [], "0.1.0"),
    /exactly one/,
  );
  assert.throws(
    () => resolveWindowsE2eNsisPackage(
      directory,
      [expectedName, "unexpected.exe"],
      "0.1.0",
    ),
    /exactly one/,
  );
  assert.throws(
    () => resolveWindowsE2eNsisPackage(directory, ["../outside.exe"], "0.1.0"),
    /safe file name/,
  );
});

test("constructs bounded PowerShell actions for the exact isolated package", () => {
  const packagePath = path.resolve(
    "src-tauri/target/e2e/release/bundle/nsis/fitfreed-e2e_0.1.0_x64-setup.exe",
  );
  const command = windowsPackageActionCommand({
    action: "install",
    architecture: "x64",
    packagePath,
    platform: "win32",
    version: "0.1.0",
  });

  assert.equal(command.file, "powershell.exe");
  assert.deepEqual(command.arguments.slice(0, 6), [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
  ]);
  assert.equal(command.arguments.includes("install"), true);
  assert.equal(command.arguments.includes(packagePath), true);
  assert.throws(
    () => windowsPackageActionCommand({
      action: "replace",
      architecture: "x64",
      packagePath,
      platform: "win32",
      version: "0.1.0",
    }),
    /unsupported Windows E2E package action/,
  );
  assert.throws(
    () => windowsPackageActionCommand({
      action: "install",
      architecture: "arm64",
      packagePath,
      platform: "win32",
      version: "0.1.0",
    }),
    /requires x86-64 Windows/,
  );
});

test("runs installed Windows capability parity only inside complete hosted verification", () => {
  const packageManifest = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
  const workflow = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
  const job = workflow.match(
    /  packaged-windows-e2e:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body ?? "";

  assert.equal(
    packageManifest.scripts["verify:windows-e2e"],
    "npm run prebuild:e2e && npm run build:e2e:windows-package && npm run test:e2e:windows-package",
  );
  assert.equal(
    packageManifest.scripts["build:e2e:windows-package"],
    "node scripts/build-windows-e2e-package.mjs",
  );
  assert.equal(
    packageManifest.scripts["test:e2e:windows-package"],
    "node scripts/run-packaged-windows-e2e.mjs",
  );
  assert.match(job, /^    needs: quality$/m);
  assert.match(job, /^    if: needs\.quality\.outputs\.full-verification == 'true'$/m);
  assert.match(job, /^    runs-on: windows-2025$/m);
  assert.match(job, /npm run verify:windows-e2e/);
  assert.match(job, /\.artifacts\/e2e\/evidence/);
  assert.match(
    workflow,
    /needs: \[quality, windows-host, packaged-macos-e2e, packaged-linux-e2e, packaged-linux-update-e2e, packaged-windows-e2e\]/,
  );
  assert.match(workflow, /needs\.packaged-windows-e2e\.result == 'success'/);
});
