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

export const windowsInstallationDiagnosticPhases = Object.freeze([
  "precondition-inputs",
  "precondition-clean-host",
  "package-trust",
  "installation",
  "registry-presence",
  "registry-product-identity",
  "registry-web-links",
  "registry-maintenance-policy",
  "registry-runtime-paths",
  "installed-file-presence",
  "installed-file-metadata",
  "installed-trust-executable",
  "installed-trust-uninstaller",
  "installed-layout",
  "shortcuts-presence",
  "shortcuts-targets",
  "webview-runtime",
  "removal-execution",
  "removal-cleanup",
  "application-data-preservation",
]);
const installationDiagnosticPhaseSet = new Set(windowsInstallationDiagnosticPhases);

export const windowsInstallationEvidenceDiagnosticCodes = Object.freeze([
  "top-level-fields",
  "package-fields",
  "installation-fields",
  "removal-fields",
  "schema-version",
  "signature-profile",
  "setup-digest",
  "certificate-fingerprint",
  "target",
  "package-format",
  "install-mode",
  "product-name",
  "package-version",
  "package-description",
  "setup-signature-fields",
  "setup-signature-status",
  "setup-signature-certificate",
  "setup-signature-timestamp",
  "setup-signature-digest-format",
  "setup-signature-digest-binding",
  "publisher",
  "homepage",
  "installation-application-data-directory",
  "installation-desktop-shortcut",
  "installation-executable",
  "installation-install-directory",
  "installation-start-menu-shortcut",
  "installation-uninstaller",
  "installation-uninstall-registry",
  "webview-runtime",
  "entry-fields",
  "entry-path",
  "entry-size",
  "entry-digest",
  "entry-order",
  "entry-required-executable",
  "entry-required-uninstaller",
  "executable-signature-fields",
  "executable-signature-status",
  "executable-signature-certificate",
  "executable-signature-timestamp",
  "executable-signature-digest-format",
  "executable-signature-digest-binding",
  "uninstaller-signature-fields",
  "uninstaller-signature-status",
  "uninstaller-signature-certificate",
  "uninstaller-signature-timestamp",
  "uninstaller-signature-digest-format",
  "uninstaller-signature-digest-binding",
  "removal-package-files-removed",
  "removal-registration-removed",
  "removal-shortcuts-removed",
  "removal-application-data-preserved",
]);
const evidenceDiagnosticCodeSet = new Set(windowsInstallationEvidenceDiagnosticCodes);

export const windowsInstallationFailurePhases = Object.freeze([
  "adapter-start",
  "native-adapter",
  "evidence-syntax",
  "evidence-validation",
  ...windowsInstallationDiagnosticPhases,
  ...windowsInstallationEvidenceDiagnosticCodes.map((code) => `evidence-${code}`),
]);
const installationFailurePhaseSet = new Set(windowsInstallationFailurePhases);

const expectedInstallation = Object.freeze({
  applicationDataDirectory: windowsPackageContract.applicationDataDirectory,
  desktopShortcut: windowsPackageContract.desktopShortcut,
  executable: windowsPackageContract.executable,
  installDirectory: windowsPackageContract.installDirectory,
  startMenuShortcut: windowsPackageContract.startMenuShortcut,
  uninstaller: windowsPackageContract.uninstaller,
  uninstallRegistry: windowsPackageContract.uninstallRegistry,
});

class WindowsInstallationFactsError extends Error {
  constructor(issues) {
    super(issues.map(({ message }) => message).join("\n"));
    this.name = "WindowsInstallationFactsError";
    this.diagnosticCode = issues[0]?.code;
  }
}

function validationIssue(code, message) {
  if (!evidenceDiagnosticCodeSet.has(code)) {
    throw new Error("unsupported Windows installation evidence diagnostic code");
  }
  return { code, message };
}

function failureError(phase) {
  const safePhase = installationFailurePhaseSet.has(phase) ? phase : "native-adapter";
  return new Error(`Windows package installation failed during ${safePhase}`);
}

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
  const issues = [];
  const fields = unexpectedFields(
    signature,
    ["certificateSha256", "fileSha256", "status", "timestamped"],
  );
  if (fields.length > 0) {
    issues.push(validationIssue(
      `${label}-signature-fields`,
      `Windows installation ${label} signature has unexpected fields: ${fields.join(", ")}`,
    ));
  }
  const isPublic = signatureProfile === "public-authenticode";
  const expectedStatus = isPublic ? "Valid" : "NotSigned";
  if (signature?.status !== expectedStatus) {
    issues.push(validationIssue(
      `${label}-signature-status`,
      `Windows installation ${label} signature must be ${isPublic ? "public and valid" : "unsigned"}`,
    ));
  }
  if (signature?.certificateSha256 !== (isPublic ? certificateSha256 : null)) {
    issues.push(validationIssue(
      `${label}-signature-certificate`,
      `Windows installation ${label} signature uses an unexpected certificate`,
    ));
  }
  if (signature?.timestamped !== isPublic) {
    issues.push(validationIssue(
      `${label}-signature-timestamp`,
      `Windows installation ${label} signature has an unexpected timestamp state`,
    ));
  }
  if (!sha256Pattern.test(signature?.fileSha256 ?? "")) {
    issues.push(validationIssue(
      `${label}-signature-digest-format`,
      `Windows installation ${label} signature requires a lowercase SHA-256 digest`,
    ));
  } else if (signature.fileSha256 !== expectedDigest) {
    issues.push(validationIssue(
      `${label}-signature-digest-binding`,
      `Windows installation ${label} digest does not bind the inspected file`,
    ));
  }
  return issues;
}

export function validateWindowsInstallationFacts(facts, expectedVersion, {
  certificateSha256,
  packageSha256,
  signatureProfile,
}) {
  const issues = [];
  for (const [object, allowed, label] of [
    [facts, ["architecture", "installation", "installMode", "package", "packageFormat", "platform", "removal", "schemaVersion", "signatureProfile"], "top-level"],
    [facts?.package, ["fileDescription", "fileVersion", "productName", "productVersion", "signature", "version"], "package"],
    [facts?.installation, ["applicationDataDirectory", "desktopShortcut", "executable", "executableSignature", "homepage", "installDirectory", "installedEntries", "publisher", "startMenuShortcut", "uninstaller", "uninstallerSignature", "uninstallRegistry", "webview2Available"], "installation"],
    [facts?.removal, ["applicationDataPreserved", "packageFilesRemoved", "registrationRemoved", "shortcutsRemoved"], "removal"],
  ]) {
    const fields = unexpectedFields(object, allowed);
    if (fields.length > 0) {
      issues.push(validationIssue(
        `${label}-fields`,
        `Windows installation ${label} has unexpected fields: ${fields.join(", ")}`,
      ));
    }
  }
  if (facts?.schemaVersion !== 2) {
    issues.push(validationIssue("schema-version", "Windows installation schema version must be 2"));
  }
  if (!signatureProfiles.has(signatureProfile) || facts?.signatureProfile !== signatureProfile) {
    issues.push(validationIssue(
      "signature-profile",
      "Windows installation signature profile does not match the requested profile",
    ));
  }
  if (!sha256Pattern.test(packageSha256 ?? "")) {
    issues.push(validationIssue("setup-digest", "Windows installation requires the exact setup digest"));
  }
  if (
    signatureProfile === "public-authenticode"
    && !sha256Pattern.test(certificateSha256 ?? "")
  ) {
    issues.push(validationIssue(
      "certificate-fingerprint",
      "Windows installation public profile requires an admitted certificate fingerprint",
    ));
  }
  if (facts?.platform !== "windows" || facts?.architecture !== windowsPackageContract.architecture) {
    issues.push(validationIssue("target", "Windows installation target must be windows x86_64"));
  }
  if (facts?.packageFormat !== windowsPackageContract.target) {
    issues.push(validationIssue("package-format", "Windows package format must be nsis"));
  }
  if (facts?.installMode !== windowsPackageContract.installMode) {
    issues.push(validationIssue("install-mode", "Windows install mode must be currentUser"));
  }
  const packageFacts = facts?.package ?? {};
  if (packageFacts.productName !== windowsPackageContract.bundleProductName) {
    issues.push(validationIssue("product-name", "Windows package product name must be FitFreed"));
  }
  if (packageFacts.version !== expectedVersion
      || packageFacts.fileVersion !== expectedVersion
      || packageFacts.productVersion !== expectedVersion) {
    issues.push(validationIssue(
      "package-version",
      `Windows package version metadata must be ${expectedVersion}`,
    ));
  }
  if (packageFacts.fileDescription !== windowsPackageContract.bundleProductName) {
    issues.push(validationIssue(
      "package-description",
      "Windows package file description must be FitFreed",
    ));
  }
  issues.push(...validateSignatureFacts(packageFacts.signature, {
    certificateSha256,
    expectedDigest: packageSha256,
    label: "setup",
    signatureProfile,
  }));
  const installation = facts?.installation ?? {};
  if (installation.publisher !== windowsPackageContract.publisher) {
    issues.push(validationIssue(
      "publisher",
      `Windows package publisher must be ${windowsPackageContract.publisher}`,
    ));
  }
  if (installation.homepage !== windowsPackageContract.homepage) {
    issues.push(validationIssue(
      "homepage",
      `Windows package homepage must be ${windowsPackageContract.homepage}`,
    ));
  }
  for (const [field, expected] of Object.entries(expectedInstallation)) {
    if (installation[field] !== expected) {
      const fieldCode = field.replaceAll(/([A-Z])/g, "-$1").toLowerCase();
      issues.push(validationIssue(
        `installation-${fieldCode}`,
        `Windows ${field.replaceAll(/([A-Z])/g, " $1").toLowerCase()} must be ${expected}`,
      ));
    }
  }
  if (installation.webview2Available !== true) {
    issues.push(validationIssue("webview-runtime", "WebView2 must be available after package installation"));
  }
  const installedEntries = Array.isArray(installation.installedEntries)
    ? installation.installedEntries
    : [];
  const entryPaths = [];
  for (const entry of installedEntries) {
    const fields = unexpectedFields(entry, ["path", "sha256", "size"]);
    if (fields.length > 0) {
      issues.push(validationIssue(
        "entry-fields",
        `Windows installation entry has unexpected fields: ${fields.join(", ")}`,
      ));
    }
    if (!safeInstalledPath(entry?.path)) {
      issues.push(validationIssue(
        "entry-path",
        "Windows installation entry path must be safe and relative",
      ));
    } else {
      entryPaths.push(entry.path);
    }
    if (!Number.isSafeInteger(entry?.size) || entry.size < 0) {
      issues.push(validationIssue(
        "entry-size",
        "Windows installation entry size must be a non-negative safe integer",
      ));
    }
    if (!sha256Pattern.test(entry?.sha256 ?? "")) {
      issues.push(validationIssue(
        "entry-digest",
        "Windows installation entry digest must be lowercase SHA-256",
      ));
    }
  }
  const expectedEntryPaths = [...new Set(entryPaths)].sort(byteOrder);
  if (installedEntries.length === 0
      || JSON.stringify(entryPaths) !== JSON.stringify(expectedEntryPaths)) {
    issues.push(validationIssue(
      "entry-order",
      "Windows installation entries must have unique byte-sorted paths",
    ));
  }
  const entriesByPath = new Map(installedEntries.map((entry) => [entry?.path, entry]));
  for (const [requiredPath, requiredLabel] of [
    [windowsPackageContract.executable, "executable"],
    [windowsPackageContract.uninstaller, "uninstaller"],
  ]) {
    if (!entriesByPath.has(requiredPath)) {
      issues.push(validationIssue(
        `entry-required-${requiredLabel}`,
        `Windows installation entries must contain ${requiredPath}`,
      ));
    }
  }
  issues.push(...validateSignatureFacts(installation.executableSignature, {
    certificateSha256,
    expectedDigest: entriesByPath.get(windowsPackageContract.executable)?.sha256,
    label: "executable",
    signatureProfile,
  }));
  issues.push(...validateSignatureFacts(installation.uninstallerSignature, {
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
    if (removal[field] !== true) {
      const fieldCode = field.replaceAll(/([A-Z])/g, "-$1").toLowerCase();
      issues.push(validationIssue(
        `removal-${fieldCode}`,
        `Windows removal must preserve or remove ${label} as declared`,
      ));
    }
  }
  if (issues.length > 0) throw new WindowsInstallationFactsError(issues);
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
  if (result.error) throw failureError("adapter-start");
  if (result.status !== 0) {
    const phase = (result.stderr ?? "").split(/\r?\n/)
      .map((line) => line.match(/^FITFREED_PHASE=([a-z-]+)$/)?.[1])
      .filter((candidate) => installationDiagnosticPhaseSet.has(candidate))
      .at(-1) ?? "native-adapter";
    throw failureError(phase);
  }
  let facts;
  try {
    facts = JSON.parse(result.stdout.trim());
  } catch {
    throw failureError("evidence-syntax");
  }
  try {
    const packageSha256 = createHash("sha256").update(readFileSync(packagePath)).digest("hex");
    return validateWindowsInstallationFacts(facts, version, {
      certificateSha256,
      packageSha256,
      signatureProfile,
    });
  } catch (error) {
    if (error instanceof WindowsInstallationFactsError) {
      throw failureError(`evidence-${error.diagnosticCode}`);
    }
    throw failureError("evidence-validation");
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
