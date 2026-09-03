import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findWindowsNsisPackage,
  validateWindowsInstallationFacts,
  verifyWindowsPackageInstallation,
  windowsInstallationPowerShellCommand,
} from "./verify-windows-package-installation.mjs";

const expectedFacts = Object.freeze({
  schemaVersion: 1,
  platform: "windows",
  architecture: "x86_64",
  packageFormat: "nsis",
  installMode: "currentUser",
  package: {
    productName: "FitFreed",
    version: "0.1.0",
    fileDescription: "FitFreed",
    fileVersion: "0.1.0",
    productVersion: "0.1.0",
    signatureStatus: "NotSigned",
  },
  installation: {
    applicationDataDirectory: "%APPDATA%\\org.fitfreed.desktop",
    publisher: "FitFreed contributors",
    homepage: "https://fitfreed.org/",
    installDirectory: "%LOCALAPPDATA%\\FitFreed",
    executable: "fitfreed.exe",
    uninstaller: "uninstall.exe",
    uninstallRegistry:
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed",
    startMenuShortcut:
      "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\FitFreed.lnk",
    desktopShortcut: "%USERPROFILE%\\Desktop\\FitFreed.lnk",
    executableSignatureStatus: "NotSigned",
    uninstallerSignatureStatus: "NotSigned",
    webview2Available: true,
  },
  removal: {
    packageFilesRemoved: true,
    registrationRemoved: true,
    shortcutsRemoved: true,
    applicationDataPreserved: true,
  },
});

test("accepts only the complete unsigned engineering installation outcome", () => {
  assert.deepEqual(validateWindowsInstallationFacts(expectedFacts, "0.1.0"), expectedFacts);

  for (const [mutate, expected] of [
    [(facts) => { facts.installMode = "perMachine"; }, /currentUser/],
    [(facts) => { facts.package.productName = "fitfreed"; }, /product name/],
    [(facts) => { facts.installation.publisher = "unknown"; }, /publisher/],
    [(facts) => { facts.installation.installDirectory = "C:\\FitFreed"; }, /install directory/],
    [(facts) => { facts.installation.executableSignatureStatus = "Valid"; }, /unsigned/],
    [(facts) => { facts.installation.webview2Available = false; }, /WebView2/],
    [(facts) => { facts.removal.applicationDataPreserved = false; }, /application data/],
    [(facts) => { facts.unexpected = true; }, /unexpected fields/],
  ]) {
    const invalid = structuredClone(expectedFacts);
    mutate(invalid);
    assert.throws(() => validateWindowsInstallationFacts(invalid, "0.1.0"), expected);
  }
});

test("selects exactly one version-derived NSIS setup", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-package-test-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  assert.throws(() => findWindowsNsisPackage(directory, "0.1.0"), /exactly one/);
  const packagePath = path.join(directory, "FitFreed_0.1.0_x64-setup.exe");
  writeFileSync(packagePath, "synthetic package");
  assert.equal(findWindowsNsisPackage(directory, "0.1.0"), packagePath);
  writeFileSync(path.join(directory, "unexpected.exe"), "unexpected");
  assert.throws(() => findWindowsNsisPackage(directory, "0.1.0"), /exactly one/);
});

test("passes the closed package identity to the native installation adapter", () => {
  const packagePath = path.resolve("synthetic/FitFreed_0.1.0_x64-setup.exe");
  const command = windowsInstallationPowerShellCommand({
    architecture: "x64",
    packagePath,
    platform: "win32",
    version: "0.1.0",
  });

  assert.equal(command.file, "powershell.exe");
  assert.deepEqual(command.arguments, [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.resolve("scripts/verify-windows-package-installation.ps1"),
    "-PackagePath",
    packagePath,
    "-ExpectedVersion",
    "0.1.0",
    "-ExpectedProductName",
    "FitFreed",
    "-ExpectedPublisher",
    "FitFreed contributors",
    "-ExpectedHomepage",
    "https://fitfreed.org/",
    "-ExpectedExecutable",
    "fitfreed.exe",
    "-ExpectedIdentifier",
    "org.fitfreed.desktop",
  ]);
  for (const options of [
    { platform: "linux" },
    { architecture: "arm64" },
    { packagePath: path.resolve("synthetic/another.exe") },
    { version: "0.1.0; unexpected" },
  ]) {
    assert.throws(
      () => windowsInstallationPowerShellCommand({
        architecture: "x64",
        packagePath,
        platform: "win32",
        version: "0.1.0",
        ...options,
      }),
      /requires|artifact name|invalid package version/,
    );
  }
});

test("returns only validated native evidence and bounds native failures", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-package-test-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, "FitFreed_0.1.0_x64-setup.exe");
  writeFileSync(packagePath, "synthetic package");
  const options = {
    architecture: "x64",
    packagePath,
    platform: "win32",
    version: "0.1.0",
  };

  assert.deepEqual(
    verifyWindowsPackageInstallation({
      ...options,
      run: () => ({ status: 0, stderr: "", stdout: JSON.stringify(expectedFacts) }),
    }),
    expectedFacts,
  );
  assert.throws(
    () => verifyWindowsPackageInstallation({
      ...options,
      run: () => ({ status: 17, stderr: "private path\nFITFREED_PHASE=registry-identity\n" }),
    }),
    /^Error: Windows package installation failed during registry-identity$/,
  );
  assert.throws(
    () => verifyWindowsPackageInstallation({
      ...options,
      run: () => ({ status: 0, stderr: "", stdout: "not-json" }),
    }),
    /^Error: Windows package installation returned invalid evidence$/,
  );
});
