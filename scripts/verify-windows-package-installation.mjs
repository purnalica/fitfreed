import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedWindowsNsisArtifactName,
  windowsPackageContract,
} from "./windows-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const installationScript = path.join(
  repositoryRoot,
  "scripts",
  "verify-windows-package-installation.ps1",
);

const expectedInstallation = Object.freeze({
  applicationDataDirectory: windowsPackageContract.applicationDataDirectory,
  desktopShortcut: windowsPackageContract.desktopShortcut,
  executable: windowsPackageContract.executable,
  installDirectory: windowsPackageContract.installDirectory,
  startMenuShortcut: windowsPackageContract.startMenuShortcut,
  uninstaller: windowsPackageContract.uninstaller,
  uninstallRegistry: windowsPackageContract.uninstallRegistry,
});

function unexpectedFields(object, allowed) {
  return Object.keys(object ?? {}).filter((field) => !allowed.includes(field)).sort();
}

export function validateWindowsInstallationFacts(facts, expectedVersion) {
  const errors = [];
  for (const [object, allowed, label] of [
    [facts, ["architecture", "installation", "installMode", "package", "packageFormat", "platform", "removal", "schemaVersion"], "top-level"],
    [facts?.package, ["fileDescription", "fileVersion", "productName", "productVersion", "signatureStatus", "version"], "package"],
    [facts?.installation, ["applicationDataDirectory", "desktopShortcut", "executable", "executableSignatureStatus", "homepage", "installDirectory", "publisher", "startMenuShortcut", "uninstaller", "uninstallerSignatureStatus", "uninstallRegistry", "webview2Available"], "installation"],
    [facts?.removal, ["applicationDataPreserved", "packageFilesRemoved", "registrationRemoved", "shortcutsRemoved"], "removal"],
  ]) {
    const fields = unexpectedFields(object, allowed);
    if (fields.length > 0) errors.push(`Windows installation ${label} has unexpected fields: ${fields.join(", ")}`);
  }
  if (facts?.schemaVersion !== 1) errors.push("Windows installation schema version must be 1");
  if (facts?.platform !== "windows" || facts?.architecture !== windowsPackageContract.architecture) {
    errors.push("Windows installation target must be windows x86_64");
  }
  if (facts?.packageFormat !== windowsPackageContract.target) {
    errors.push("Windows package format must be nsis");
  }
  if (facts?.installMode !== windowsPackageContract.installMode) {
    errors.push("Windows install mode must be currentUser");
  }
  const packageFacts = facts?.package ?? {};
  if (packageFacts.productName !== windowsPackageContract.bundleProductName) {
    errors.push("Windows package product name must be FitFreed");
  }
  if (packageFacts.version !== expectedVersion
      || packageFacts.fileVersion !== expectedVersion
      || packageFacts.productVersion !== expectedVersion) {
    errors.push(`Windows package version metadata must be ${expectedVersion}`);
  }
  if (packageFacts.fileDescription !== windowsPackageContract.bundleProductName) {
    errors.push("Windows package file description must be FitFreed");
  }
  if (packageFacts.signatureStatus !== "NotSigned") {
    errors.push("the ordinary Windows package must remain unsigned");
  }
  const installation = facts?.installation ?? {};
  if (installation.publisher !== windowsPackageContract.publisher) {
    errors.push(`Windows package publisher must be ${windowsPackageContract.publisher}`);
  }
  if (installation.homepage !== windowsPackageContract.homepage) {
    errors.push(`Windows package homepage must be ${windowsPackageContract.homepage}`);
  }
  for (const [field, expected] of Object.entries(expectedInstallation)) {
    if (installation[field] !== expected) {
      errors.push(`Windows ${field.replaceAll(/([A-Z])/g, " $1").toLowerCase()} must be ${expected}`);
    }
  }
  if (installation.executableSignatureStatus !== "NotSigned"
      || installation.uninstallerSignatureStatus !== "NotSigned") {
    errors.push("ordinary installed Windows binaries must remain unsigned");
  }
  if (installation.webview2Available !== true) {
    errors.push("WebView2 must be available after package installation");
  }
  const removal = facts?.removal ?? {};
  for (const [field, label] of [
    ["packageFilesRemoved", "package files"],
    ["registrationRemoved", "registration"],
    ["shortcutsRemoved", "shortcuts"],
    ["applicationDataPreserved", "application data"],
  ]) {
    if (removal[field] !== true) errors.push(`Windows removal must preserve or remove ${label} as declared`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return facts;
}

export function findWindowsNsisPackage(directory, version) {
  const packages = readdirSync(directory)
    .filter((entry) => entry.toLowerCase().endsWith(".exe"))
    .map((entry) => path.join(directory, entry));
  if (packages.length !== 1) {
    throw new Error(`expected exactly one Windows NSIS artifact, found ${packages.length}`);
  }
  const expectedName = expectedWindowsNsisArtifactName(version);
  if (path.basename(packages[0]) !== expectedName) {
    throw new Error(`Windows NSIS artifact name must be ${expectedName}`);
  }
  return packages[0];
}

export function windowsInstallationPowerShellCommand({
  architecture = process.arch,
  packagePath,
  platform = process.platform,
  version,
}) {
  if (platform !== windowsPackageContract.platform || architecture !== "x64") {
    throw new Error("Windows package installation requires x86-64 Windows");
  }
  if (!versionPattern.test(version ?? "")) throw new Error("invalid package version");
  if (!path.isAbsolute(packagePath)) throw new Error("Windows package path must be absolute");
  const expectedName = expectedWindowsNsisArtifactName(version);
  if (path.basename(packagePath) !== expectedName) {
    throw new Error(`Windows NSIS artifact name must be ${expectedName}`);
  }
  return {
    file: "powershell.exe",
    arguments: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      installationScript,
      "-PackagePath",
      packagePath,
      "-ExpectedVersion",
      version,
      "-ExpectedProductName",
      windowsPackageContract.bundleProductName,
      "-ExpectedPublisher",
      windowsPackageContract.publisher,
      "-ExpectedHomepage",
      windowsPackageContract.homepage,
      "-ExpectedExecutable",
      expectedInstallation.executable,
      "-ExpectedIdentifier",
      windowsPackageContract.applicationIdentifier,
    ],
  };
}

export function verifyWindowsPackageInstallation({
  architecture = process.arch,
  packagePath,
  platform = process.platform,
  run = spawnSync,
  version,
}) {
  if (!existsSync(packagePath) || !statSync(packagePath).isFile()) {
    throw new Error("the exact Windows NSIS artifact is unavailable for installation");
  }
  const command = windowsInstallationPowerShellCommand({
    architecture,
    packagePath,
    platform,
    version,
  });
  const result = run(command.file, command.arguments, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error("Windows package installation adapter could not start");
  if (result.status !== 0) {
    const phase = result.stderr?.match(/FITFREED_PHASE=([a-z-]+)/)?.[1] ?? "native-adapter";
    throw new Error(`Windows package installation failed during ${phase}`);
  }
  try {
    return validateWindowsInstallationFacts(JSON.parse(result.stdout.trim()), version);
  } catch (error) {
    if (error.message.startsWith("Windows installation")) throw error;
    throw new Error("Windows package installation returned invalid evidence");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const version = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ).version;
    const packagePath = findWindowsNsisPackage(
      path.join(repositoryRoot, "src-tauri", "target", "release", "bundle", "nsis"),
      version,
    );
    process.stdout.write(`${JSON.stringify(verifyWindowsPackageInstallation({ packagePath, version }))}\n`);
  } catch (error) {
    process.stderr.write(`Windows package installation verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
