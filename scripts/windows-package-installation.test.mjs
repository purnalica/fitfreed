import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const packageBytes = "synthetic package";
const packageSha256 = createHash("sha256").update(packageBytes).digest("hex");

function unsignedSignature(fileSha256) {
  return {
    status: "NotSigned",
    certificateSha256: null,
    timestamped: false,
    fileSha256,
  };
}

function publicSignature(fileSha256, certificateSha256 = "c".repeat(64)) {
  return {
    status: "Valid",
    certificateSha256,
    timestamped: true,
    fileSha256,
  };
}

const expectedFacts = Object.freeze({
  schemaVersion: 2,
  signatureProfile: "unsigned-engineering",
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
    signature: unsignedSignature(packageSha256),
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
    executableSignature: unsignedSignature("a".repeat(64)),
    uninstallerSignature: unsignedSignature("b".repeat(64)),
    installedEntries: [
      { path: "fitfreed.exe", size: 8192, sha256: "a".repeat(64) },
      { path: "uninstall.exe", size: 4096, sha256: "b".repeat(64) },
    ],
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
  assert.deepEqual(
    validateWindowsInstallationFacts(expectedFacts, "0.1.0", {
      packageSha256,
      signatureProfile: "unsigned-engineering",
    }),
    expectedFacts,
  );

  for (const [mutate, expected] of [
    [(facts) => { facts.installMode = "perMachine"; }, /currentUser/],
    [(facts) => { facts.package.productName = "fitfreed"; }, /product name/],
    [(facts) => { facts.installation.publisher = "unknown"; }, /publisher/],
    [(facts) => { facts.installation.installDirectory = "C:\\FitFreed"; }, /install directory/],
    [(facts) => { facts.installation.executableSignature.status = "Valid"; }, /unsigned/],
    [(facts) => { facts.package.signature.fileSha256 = "d".repeat(64); }, /setup digest/],
    [(facts) => { facts.installation.executableSignature.fileSha256 = "d".repeat(64); }, /executable digest/],
    [(facts) => { facts.installation.installedEntries.reverse(); }, /byte-sorted/],
    [(facts) => { facts.installation.installedEntries[0].path = "../fitfreed.exe"; }, /safe and relative/],
    [(facts) => { facts.installation.installedEntries[0].sha256 = "A".repeat(64); }, /lowercase SHA-256/],
    [(facts) => { facts.installation.installedEntries.pop(); }, /uninstall\.exe/],
    [(facts) => { facts.installation.webview2Available = false; }, /WebView2/],
    [(facts) => { facts.removal.applicationDataPreserved = false; }, /application data/],
    [(facts) => { facts.unexpected = true; }, /unexpected fields/],
  ]) {
    const invalid = structuredClone(expectedFacts);
    mutate(invalid);
    assert.throws(
      () => validateWindowsInstallationFacts(invalid, "0.1.0", {
        packageSha256,
        signatureProfile: "unsigned-engineering",
      }),
      expected,
    );
  }
});

test("accepts public installation evidence only when every exact binary uses the admitted certificate", () => {
  const publicFacts = structuredClone(expectedFacts);
  publicFacts.signatureProfile = "public-authenticode";
  publicFacts.package.signature = publicSignature(packageSha256);
  publicFacts.installation.executableSignature = publicSignature("a".repeat(64));
  publicFacts.installation.uninstallerSignature = publicSignature("b".repeat(64));

  assert.deepEqual(
    validateWindowsInstallationFacts(publicFacts, "0.1.0", {
      certificateSha256: "c".repeat(64),
      packageSha256,
      signatureProfile: "public-authenticode",
    }),
    publicFacts,
  );

  for (const [mutate, expected] of [
    [(facts) => { facts.package.signature.timestamped = false; }, /timestamp/],
    [(facts) => { facts.installation.uninstallerSignature.certificateSha256 = "d".repeat(64); }, /certificate/],
    [(facts) => { facts.signatureProfile = "unsigned-engineering"; }, /profile/],
  ]) {
    const invalid = structuredClone(publicFacts);
    mutate(invalid);
    assert.throws(
      () => validateWindowsInstallationFacts(invalid, "0.1.0", {
        certificateSha256: "c".repeat(64),
        packageSha256,
        signatureProfile: "public-authenticode",
      }),
      expected,
    );
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
    "-SignatureProfile",
    "unsigned-engineering",
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

test("passes public trust inputs to the native adapter without inheriting signing authority", () => {
  const packagePath = path.resolve("synthetic/FitFreed_0.1.0_x64-setup.exe");
  const command = windowsInstallationPowerShellCommand({
    architecture: "x64",
    certificateSha256: "c".repeat(64),
    packagePath,
    platform: "win32",
    signatureProfile: "public-authenticode",
    signToolPath: "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\signtool.exe",
    version: "0.1.0",
  });

  assert.deepEqual(command.arguments.slice(-8), [
    "-SignatureProfile",
    "public-authenticode",
    "-ExpectedCertificateSha256",
    "c".repeat(64),
    "-SignToolPath",
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\signtool.exe",
    "-TrustScriptPath",
    path.resolve("scripts/windows-authenticode-trust.ps1"),
  ]);
  assert.throws(
    () => windowsInstallationPowerShellCommand({
      architecture: "x64",
      packagePath,
      platform: "win32",
      signatureProfile: "public-authenticode",
      signToolPath: "C:\\Tools\\not-signtool.exe",
      version: "0.1.0",
    }),
    /certificate|signtool/,
  );
});

test("returns only validated native evidence and bounds native failures", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-package-test-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, "FitFreed_0.1.0_x64-setup.exe");
  writeFileSync(packagePath, packageBytes);
  const options = {
    architecture: "x64",
    packagePath,
    platform: "win32",
    version: "0.1.0",
  };

  assert.deepEqual(
    verifyWindowsPackageInstallation({
      ...options,
      environment: {
        PATH: "C:\\Windows\\System32",
        FITFREED_WINDOWS_CERTIFICATE_SHA1: "protected",
      },
      run: (_file, _arguments, runOptions) => {
        assert.equal(runOptions.env.FITFREED_WINDOWS_CERTIFICATE_SHA1, undefined);
        return { status: 0, stderr: "", stdout: JSON.stringify(expectedFacts) };
      },
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
