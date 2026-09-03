import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const sha256Pattern = /^[0-9a-f]{64}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const trustScript = path.join(repositoryRoot, "scripts", "windows-authenticode-trust.ps1");

function unexpectedFields(object, allowed) {
  return Object.keys(object ?? {}).filter((field) => !allowed.includes(field)).sort();
}

function regularFile(candidate) {
  if (!existsSync(candidate)) return false;
  const metadata = lstatSync(candidate);
  return metadata.isFile() && !metadata.isSymbolicLink();
}

export function windowsAuthenticodeTrustCommand({
  binaryPath,
  certificateSha256,
  requireTimestamp,
  signatureOnly,
  signToolPath,
  version,
}) {
  if (
    typeof binaryPath !== "string"
    || typeof signToolPath !== "string"
    || !path.win32.isAbsolute(binaryPath)
    || !path.win32.isAbsolute(signToolPath)
  ) {
    throw new Error("Authenticode trust paths must be absolute Windows paths");
  }
  if (path.win32.basename(signToolPath).toLowerCase() !== "signtool.exe") {
    throw new Error("Authenticode trust requires signtool.exe");
  }
  if (!sha256Pattern.test(certificateSha256 ?? "")) {
    throw new Error("Authenticode trust requires a lowercase SHA-256 certificate fingerprint");
  }
  if (!signatureOnly && !versionPattern.test(version ?? "")) {
    throw new Error("Authenticode trust requires a package version");
  }
  const arguments_ = [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    trustScript,
    "-BinaryPath",
    binaryPath,
    "-SignToolPath",
    signToolPath,
    "-ExpectedCertificateSha256",
    certificateSha256,
  ];
  if (!signatureOnly) arguments_.push("-ExpectedVersion", version);
  if (requireTimestamp) arguments_.push("-RequireTimestamp");
  if (signatureOnly) arguments_.push("-SignatureOnly");
  return { file: "powershell.exe", arguments: arguments_ };
}

export function validateWindowsAuthenticodeFacts(facts, {
  certificateSha256,
  requireTimestamp,
  signatureOnly = false,
  version,
}) {
  const allowed = [
    "certificateSha256",
    "fileSha256",
    "schemaVersion",
    "status",
    "timestamped",
  ];
  if (!signatureOnly) {
    allowed.push(
      "architecture",
      "fileDescription",
      "fileVersion",
      "productName",
      "productVersion",
    );
  }
  const unexpected = unexpectedFields(facts, allowed);
  const errors = [];
  if (unexpected.length > 0) {
    errors.push(`Authenticode evidence has unexpected fields: ${unexpected.join(", ")}`);
  }
  if (facts?.schemaVersion !== 1 || facts?.status !== "Valid") {
    errors.push("Authenticode evidence must report one valid version 1 signature");
  }
  if (facts?.certificateSha256 !== certificateSha256) {
    errors.push("Authenticode evidence uses an unexpected certificate fingerprint");
  }
  if (!sha256Pattern.test(facts?.fileSha256 ?? "")) {
    errors.push("Authenticode evidence requires a lowercase SHA-256 file digest");
  }
  if (typeof facts?.timestamped !== "boolean" || (requireTimestamp && !facts.timestamped)) {
    errors.push("Authenticode evidence requires the declared timestamp state");
  }
  if (!signatureOnly) {
    if (facts?.architecture !== "x86_64") {
      errors.push("Authenticode binary must be x86-64");
    }
    if (facts?.productName !== "FitFreed" || facts?.fileDescription !== "FitFreed") {
      errors.push("Authenticode binary must retain the FitFreed product identity");
    }
    if (facts?.fileVersion !== version || facts?.productVersion !== version) {
      errors.push(`Authenticode binary version metadata must be ${version}`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return facts;
}

export function inspectWindowsAuthenticode({
  binaryPath,
  certificateSha256,
  isFile = regularFile,
  platform = process.platform,
  requireTimestamp = true,
  run = spawnSync,
  signatureOnly = false,
  signToolPath,
  version,
}) {
  if (platform !== "win32") throw new Error("Authenticode trust inspection requires Windows");
  const command = windowsAuthenticodeTrustCommand({
    binaryPath,
    certificateSha256,
    requireTimestamp,
    signatureOnly,
    signToolPath,
    version,
  });
  if (!isFile(binaryPath) || !isFile(signToolPath)) {
    throw new Error("Authenticode trust inspection requires regular input files");
  }
  const result = run(command.file, command.arguments, {
    encoding: "utf8",
    env: windowsNativeToolEnvironment(process.env),
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error("Authenticode trust adapter could not start");
  if (result.status !== 0) {
    const phase = result.stderr?.match(/FITFREED_AUTHENTICODE_PHASE=([a-z-]+)/)?.[1]
      ?? "native-adapter";
    throw new Error(`Authenticode trust inspection failed during ${phase}`);
  }
  try {
    return validateWindowsAuthenticodeFacts(JSON.parse(result.stdout.trim()), {
      certificateSha256,
      requireTimestamp,
      signatureOnly,
      version,
    });
  } catch (error) {
    if (error.message.startsWith("Authenticode")) throw error;
    throw new Error("Authenticode trust adapter returned invalid evidence");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const [binaryPath, version, certificateSha256, profile, signToolPath] = process.argv.slice(2);
    if (!binaryPath || !version || !certificateSha256 || !profile || !signToolPath) {
      throw new Error(
        "usage: node scripts/windows-authenticode-trust.mjs <binary> <version> <certificate-sha256> <public|synthetic-test> <signtool>",
      );
    }
    if (!["public", "synthetic-test"].includes(profile)) {
      throw new Error("unsupported Authenticode trust profile");
    }
    process.stdout.write(`${JSON.stringify(inspectWindowsAuthenticode({
      binaryPath,
      certificateSha256,
      requireTimestamp: profile === "public",
      signToolPath,
      version,
    }))}\n`);
  } catch (error) {
    process.stderr.write(`Windows Authenticode trust inspection failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
