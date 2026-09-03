import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectWindowsAuthenticode } from "./windows-authenticode-trust.mjs";
import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const certificateSha1Pattern = /^[0-9A-Fa-f]{40}$/;
const certificateSha256Pattern = /^[0-9a-f]{64}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;

function regularFile(candidate) {
  if (!existsSync(candidate)) return false;
  const metadata = lstatSync(candidate);
  return metadata.isFile() && !metadata.isSymbolicLink();
}

function publicTimestampUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username.length > 0
      || url.password.length > 0
      || url.search.length > 0
      || url.hash.length > 0
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function windowsAuthenticodeSigningPlan({
  binaryPath,
  environment,
  isFile = regularFile,
  platform = process.platform,
  version,
}) {
  if (platform !== "win32") throw new Error("Windows Authenticode signing requires Windows");
  if (!versionPattern.test(version ?? "")) {
    throw new Error("Windows Authenticode signing requires a package version");
  }
  if (
    typeof binaryPath !== "string"
    || !path.win32.isAbsolute(binaryPath)
    || path.win32.extname(binaryPath).toLowerCase() !== ".exe"
  ) {
    throw new Error("Windows Authenticode signing requires an absolute Windows executable path");
  }
  const profile = environment?.FITFREED_WINDOWS_AUTHENTICODE_PROFILE;
  if (!["public", "synthetic-test"].includes(profile)) {
    throw new Error("Windows Authenticode signing requires an explicit supported profile");
  }
  const signToolPath = environment.FITFREED_WINDOWS_SIGNTOOL_PATH;
  if (typeof signToolPath !== "string" || !path.win32.isAbsolute(signToolPath)) {
    throw new Error("Windows Authenticode signing requires an absolute Windows SignTool path");
  }
  if (path.win32.basename(signToolPath).toLowerCase() !== "signtool.exe") {
    throw new Error("Windows Authenticode signing requires signtool.exe");
  }
  const certificateSha1 = environment.FITFREED_WINDOWS_CERTIFICATE_SHA1;
  if (!certificateSha1Pattern.test(certificateSha1 ?? "")) {
    throw new Error("Windows Authenticode signing requires one SHA-1 certificate selector");
  }
  const certificateSha256 = environment.FITFREED_WINDOWS_CERTIFICATE_SHA256;
  if (!certificateSha256Pattern.test(certificateSha256 ?? "")) {
    throw new Error("Windows Authenticode signing requires one lowercase SHA-256 certificate fingerprint");
  }
  const timestampValue = environment.FITFREED_WINDOWS_TIMESTAMP_URL;
  let timestampUrl;
  if (profile === "public") {
    timestampUrl = publicTimestampUrl(timestampValue);
    if (timestampUrl === null) {
      throw new Error("public Authenticode signing requires one public HTTPS timestamp URL");
    }
  } else if (timestampValue !== undefined) {
    throw new Error("synthetic-test Authenticode signing must not use a timestamp authority");
  }
  if (!isFile(binaryPath) || !isFile(signToolPath)) {
    throw new Error("Windows Authenticode signing requires regular input files");
  }

  const arguments_ = [
    "sign",
    "/sha1",
    certificateSha1.toUpperCase(),
    "/fd",
    "SHA256",
  ];
  if (profile === "public") {
    arguments_.push("/tr", timestampUrl, "/td", "SHA256");
  }
  arguments_.push(binaryPath);
  return {
    arguments: arguments_,
    binaryPath,
    certificateSha256,
    profile,
    requireTimestamp: profile === "public",
    signToolPath,
    version,
  };
}

export function signWindowsAuthenticode({
  binaryPath,
  environment = process.env,
  inspect = inspectWindowsAuthenticode,
  isFile = regularFile,
  platform = process.platform,
  run = spawnSync,
  version = packageVersion,
} = {}) {
  const plan = windowsAuthenticodeSigningPlan({
    binaryPath,
    environment,
    isFile,
    platform,
    version,
  });
  const result = run(plan.signToolPath, plan.arguments, {
    encoding: "utf8",
    env: windowsNativeToolEnvironment(environment),
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error("Windows Authenticode signing failed during signing");
  }
  let facts;
  try {
    facts = inspect({
      binaryPath: plan.binaryPath,
      certificateSha256: plan.certificateSha256,
      isFile,
      platform,
      requireTimestamp: plan.requireTimestamp,
      signatureOnly: true,
      signToolPath: plan.signToolPath,
      version: plan.version,
    });
  } catch {
    throw new Error("Windows Authenticode signing failed during trust-verification");
  }
  if (!plan.requireTimestamp && facts.timestamped) {
    throw new Error("Windows Authenticode signing failed during trust-verification");
  }
  return {
    certificateSha256: facts.certificateSha256,
    fileSha256: facts.fileSha256,
    profile: plan.profile,
    timestamped: facts.timestamped,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const [binaryPath] = process.argv.slice(2);
    if (!binaryPath || process.argv.length !== 3) {
      throw new Error("expected exactly one binary path from the Windows bundler");
    }
    signWindowsAuthenticode({ binaryPath });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
