import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  windowsInstalledPackageActionCommand,
  windowsInstalledPackageActionScript,
} from "./windows-installed-package.mjs";

test("exposes one fixed production-package lifecycle boundary", () => {
  const packagePath = path.resolve("synthetic/FitFreed_0.1.0_x64-setup.exe");
  assert.equal(
    windowsInstalledPackageActionScript,
    path.resolve("scripts/run-installed-windows-package.ps1"),
  );
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
  assert.deepEqual(
    windowsInstalledPackageActionCommand({
      action: "verify-data",
      architecture: "x64",
      platform: "win32",
    }).arguments.slice(-2),
    ["-Action", "verify-data"],
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
  const cleanup = readFileSync(
    path.resolve("scripts/windows-application-data-cleanup.ps1"),
    "utf8",
  );
  assert.match(source, /org\.fitfreed\.desktop/);
  assert.match(source, /Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed/);
  assert.match(source, /Get-CimInstance Win32_Process/);
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
    /\. \(Join-Path \$PSScriptRoot "windows-application-data-cleanup\.ps1"\)/,
  );
  assert.match(
    source,
    /if \(\$Action -eq "reset-data"\)[\s\S]*Get-InstalledVersion[\s\S]*Stop-OwnedProcesses[\s\S]*Remove-ValidatedApplicationData -Directory \$roamingDataDirectory -Description "production roaming application data"[\s\S]*Remove-ValidatedApplicationData -Directory \$localDataDirectory -Description "production local application data"[\s\S]*exit 0/,
  );
  assert.match(
    source,
    /function Assert-PrivateAcl[\s\S]*AreAccessRulesProtected[\s\S]*GetAccessRules/,
  );
  assert.match(
    source,
    /if \(\$Action -eq "verify-data"\)[\s\S]*fitfreed\.sqlite[\s\S]*Assert-PrivateAcl \$roamingDataDirectory \$true[\s\S]*Assert-PrivateAcl \$library \$false/,
  );
  assert.match(cleanup, /function Remove-ValidatedApplicationData/);
  assert.match(cleanup, /for \(\$attempt = 0; \$attempt -lt 300; \$attempt \+= 1\)/);
  assert.match(cleanup, /Get-Item -LiteralPath \$Directory -Force -ErrorAction Stop/);
  assert.match(cleanup, /ReparsePoint/);
  assert.match(cleanup, /Get-ChildItem -LiteralPath \$Directory -Recurse -Force -ErrorAction Stop/);
  assert.match(cleanup, /Remove-Item -LiteralPath \$Directory -Recurse -Force -ErrorAction Stop/);
  assert.match(
    cleanup,
    /Remove-Item[\s\S]*if \(-not \(Test-Path -LiteralPath \$Directory\)\) \{ return \}/,
  );
  assert.match(cleanup, /Start-Sleep -Milliseconds 100/);
  assert.match(cleanup, /throw "\$Description remains after bounded cleanup"/);
  assert.doesNotMatch(source, /Remove-Item\s+-Path\s+\$env:/);
  assert.doesNotMatch(cleanup, /Remove-Item\s+-Path\s+\$env:/);
});
