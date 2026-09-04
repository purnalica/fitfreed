import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { windowsInstalledPackageActionCommand } from "./windows-installed-package.mjs";

test("exposes one fixed production-package lifecycle boundary", () => {
  const packagePath = path.resolve("synthetic/FitFreed_0.1.0_x64-setup.exe");
  assert.deepEqual(
    windowsInstalledPackageActionCommand({
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
  assert.deepEqual(
    windowsInstalledPackageActionCommand({
      action: "reset-data",
      architecture: "x64",
      platform: "win32",
    }).arguments.slice(-2),
    ["-Action", "reset-data"],
  );
  assert.throws(
    () => windowsInstalledPackageActionCommand({
      action: "delete",
      architecture: "x64",
      platform: "win32",
    }),
    /unsupported/,
  );
  assert.throws(
    () => windowsInstalledPackageActionCommand({
      action: "install",
      architecture: "x64",
      packagePath: path.resolve("synthetic/other.exe"),
      platform: "win32",
      version: "0.1.0",
    }),
    /package name/,
  );
});

test("protects cleanup with exact identity, process-path, and reparse checks", () => {
  const source = readFileSync(
    path.resolve("scripts/run-installed-windows-package.ps1"),
    "utf8",
  );
  assert.match(source, /org\.fitfreed\.desktop/);
  assert.match(source, /Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed/);
  assert.match(source, /Get-CimInstance Win32_Process/);
  assert.match(source, /ReparsePoint/);
  assert.match(
    source,
    /GetFolderPath\(\[Environment\+SpecialFolder\]::ApplicationData\)/,
  );
  assert.match(
    source,
    /GetFolderPath\(\[Environment\+SpecialFolder\]::LocalApplicationData\)/,
  );
  assert.match(
    source,
    /if \(\$Action -eq "reset-data"\)[\s\S]*Get-InstalledVersion[\s\S]*Stop-OwnedProcesses[\s\S]*Remove-OwnedData \$roamingDataDirectory[\s\S]*Remove-OwnedData \$localDataDirectory[\s\S]*exit 0/,
  );
  assert.doesNotMatch(source, /Remove-Item\s+-Path\s+\$env:/);
});
