import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedWindowsNsisArtifactName,
  windowsPackageContract,
} from "./windows-package-contract.mjs";
import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const installationScript = path.join(
  repositoryRoot,
  "scripts",
  "verify-windows-package-installation.ps1",
);
const trustScript = path.join(
  repositoryRoot,
  "scripts",
  "windows-authenticode-trust.ps1",
);
const signatureProfiles = new Set(["public-authenticode", "unsigned-engineering"]);

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

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function safeInstalledPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 4096) {
    return false;
  }
  if (candidate.startsWith("/") || candidate.includes("\\") || candidate.includes("\0")) {
    return false;
  }
  return candidate.split("/").every(
    (segment) => segment !== "" && segment !== "." && segment !== ".."
      && !/[<>:"|?*\u0000-\u001f]/.test(segment),
  );
}

function validateSignatureFacts(signature, {
  certificateSha256,
  expectedDigest,
  label,
  signatureProfile,
}) {
  const errors = [];
  const fields = unexpectedFields(
    signature,
    ["certificateSha256", "fileSha256", "status", "timestamped"],
  );
  if (fields.length > 0) {
    errors.push(`Windows installation ${label} signature has unexpected fields: ${fields.join(", ")}`);
  }
  const isPublic = signatureProfile === "public-authenticode";
  const expectedStatus = isPublic ? "Valid" : "NotSigned";
  if (signature?.status !== expectedStatus) {
    errors.push(`Windows installation ${label} signature must be ${isPublic ? "public and valid" : "unsigned"}`);
  }
  if (signature?.certificateSha256 !== (isPublic ? certificateSha256 : null)) {
    errors.push(`Windows installation ${label} signature uses an unexpected certificate`);
  }
  if (signature?.timestamped !== isPublic) {
    errors.push(`Windows installation ${label} signature has an unexpected timestamp state`);
  }
  if (!sha256Pattern.test(signature?.fileSha256 ?? "")) {
    errors.push(`Windows installation ${label} signature requires a lowercase SHA-256 digest`);
  } else if (signature.fileSha256 !== expectedDigest) {
    errors.push(`Windows installation ${label} digest does not bind the inspected file`);
  }
  return errors;
}

export function validateWindowsInstallationFacts(facts, expectedVersion, {
  certificateSha256,
  packageSha256,
  signatureProfile,
}) {
  const errors = [];
  for (const [object, allowed, label] of [
    [facts, ["architecture", "installation", "installMode", "package", "packageFormat", "platform", "removal", "schemaVersion", "signatureProfile"], "top-level"],
    [facts?.package, ["fileDescription", "fileVersion", "productName", "productVersion", "signature", "version"], "package"],
    [facts?.installation, ["applicationDataDirectory", "desktopShortcut", "executable", "executableSignature", "homepage", "installDirectory", "installedEntries", "publisher", "startMenuShortcut", "uninstaller", "uninstallerSignature", "uninstallRegistry", "webview2Available"], "installation"],
    [facts?.removal, ["applicationDataPreserved", "packageFilesRemoved", "registrationRemoved", "shortcutsRemoved"], "removal"],
  ]) {
    const fields = unexpectedFields(object, allowed);
    if (fields.length > 0) errors.push(`Windows installation ${label} has unexpected fields: ${fields.join(", ")}`);
  }
  if (facts?.schemaVersion !== 2) errors.push("Windows installation schema version must be 2");
  if (!signatureProfiles.has(signatureProfile) || facts?.signatureProfile !== signatureProfile) {
    errors.push("Windows installation signature profile does not match the requested profile");
  }
  if (!sha256Pattern.test(packageSha256 ?? "")) {
    errors.push("Windows installation requires the exact setup digest");
  }
  if (
    signatureProfile === "public-authenticode"
    && !sha256Pattern.test(certificateSha256 ?? "")
  ) {
    errors.push("Windows installation public profile requires an admitted certificate fingerprint");
  }
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
  errors.push(...validateSignatureFacts(packageFacts.signature, {
    certificateSha256,
    expectedDigest: packageSha256,
    label: "setup",
    signatureProfile,
  }));
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
  if (installation.webview2Available !== true) {
    errors.push("WebView2 must be available after package installation");
  }
  const installedEntries = Array.isArray(installation.installedEntries)
    ? installation.installedEntries
    : [];
  const entryPaths = [];
  for (const entry of installedEntries) {
    const fields = unexpectedFields(entry, ["path", "sha256", "size"]);
    if (fields.length > 0) {
      errors.push(`Windows installation entry has unexpected fields: ${fields.join(", ")}`);
    }
    if (!safeInstalledPath(entry?.path)) {
      errors.push("Windows installation entry path must be safe and relative");
    } else {
      entryPaths.push(entry.path);
    }
    if (!Number.isSafeInteger(entry?.size) || entry.size < 0) {
      errors.push("Windows installation entry size must be a non-negative safe integer");
    }
    if (!sha256Pattern.test(entry?.sha256 ?? "")) {
      errors.push("Windows installation entry digest must be lowercase SHA-256");
    }
  }
  const expectedEntryPaths = [...new Set(entryPaths)].sort(byteOrder);
  if (installedEntries.length === 0
      || JSON.stringify(entryPaths) !== JSON.stringify(expectedEntryPaths)) {
    errors.push("Windows installation entries must have unique byte-sorted paths");
  }
  const entriesByPath = new Map(installedEntries.map((entry) => [entry?.path, entry]));
  for (const requiredPath of [windowsPackageContract.executable, windowsPackageContract.uninstaller]) {
    if (!entriesByPath.has(requiredPath)) {
      errors.push(`Windows installation entries must contain ${requiredPath}`);
    }
  }
  errors.push(...validateSignatureFacts(installation.executableSignature, {
    certificateSha256,
    expectedDigest: entriesByPath.get(windowsPackageContract.executable)?.sha256,
    label: "executable",
    signatureProfile,
  }));
  errors.push(...validateSignatureFacts(installation.uninstallerSignature, {
    certificateSha256,
    expectedDigest: entriesByPath.get(windowsPackageContract.uninstaller)?.sha256,
    label: "uninstaller",
    signatureProfile,
  }));
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
  certificateSha256,
  packagePath,
  platform = process.platform,
  signatureProfile = "unsigned-engineering",
  signToolPath,
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
  if (!signatureProfiles.has(signatureProfile)) {
    throw new Error("unsupported Windows installation signature profile");
  }
  const arguments_ = [
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
    "-SignatureProfile",
    signatureProfile,
  ];
  if (signatureProfile === "public-authenticode") {
    if (!sha256Pattern.test(certificateSha256 ?? "")) {
      throw new Error("public Windows installation requires a certificate fingerprint");
    }
    if (
      typeof signToolPath !== "string"
      || !path.win32.isAbsolute(signToolPath)
      || path.win32.basename(signToolPath).toLowerCase() !== "signtool.exe"
    ) {
      throw new Error("public Windows installation requires an absolute signtool.exe path");
    }
    arguments_.push(
      "-ExpectedCertificateSha256",
      certificateSha256,
      "-SignToolPath",
      signToolPath,
      "-TrustScriptPath",
      trustScript,
    );
  }
  return {
    file: "powershell.exe",
    arguments: arguments_,
  };
}

export function verifyWindowsPackageInstallation({
  architecture = process.arch,
  certificateSha256,
  environment = process.env,
  packagePath,
  platform = process.platform,
  run = spawnSync,
  signatureProfile = "unsigned-engineering",
  signToolPath,
  version,
}) {
  if (!existsSync(packagePath) || !statSync(packagePath).isFile()) {
    throw new Error("the exact Windows NSIS artifact is unavailable for installation");
  }
  const command = windowsInstallationPowerShellCommand({
    architecture,
    certificateSha256,
    packagePath,
    platform,
    signatureProfile,
    signToolPath,
    version,
  });
  const result = run(command.file, command.arguments, {
    encoding: "utf8",
    env: windowsNativeToolEnvironment(environment),
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error("Windows package installation adapter could not start");
  if (result.status !== 0) {
    const phase = result.stderr?.match(/FITFREED_PHASE=([a-z-]+)/)?.[1] ?? "native-adapter";
    throw new Error(`Windows package installation failed during ${phase}`);
  }
  try {
    const packageSha256 = createHash("sha256").update(readFileSync(packagePath)).digest("hex");
    return validateWindowsInstallationFacts(JSON.parse(result.stdout.trim()), version, {
      certificateSha256,
      packageSha256,
      signatureProfile,
    });
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
