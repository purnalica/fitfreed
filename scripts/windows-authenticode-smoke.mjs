import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const smokeScript = path.join(repositoryRoot, "scripts", "windows-authenticode-smoke.ps1");
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;

function regularFile(candidate) {
  if (!existsSync(candidate)) return false;
  const metadata = lstatSync(candidate);
  return metadata.isFile() && !metadata.isSymbolicLink();
}

function unexpectedFields(object, allowed) {
  return Object.keys(object ?? {}).filter((field) => !allowed.includes(field)).sort();
}

export function windowsAuthenticodeSmokeCommand({ sourceBinaryPath, version }) {
  if (typeof sourceBinaryPath !== "string" || !path.win32.isAbsolute(sourceBinaryPath)) {
    throw new Error("synthetic Authenticode smoke requires an absolute Windows executable path");
  }
  if (!versionPattern.test(version ?? "")) {
    throw new Error("synthetic Authenticode smoke requires a package version");
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
      smokeScript,
      "-SourceBinaryPath",
      sourceBinaryPath,
      "-ExpectedVersion",
      version,
    ],
  };
}

export function validateSyntheticWindowsAuthenticodeEvidence(facts) {
  const errors = [];
  const allowed = [
    "architecture",
    "authorityRemoved",
    "profile",
    "schemaVersion",
    "signedCopyVerified",
    "sourceUnchanged",
  ];
  const unexpected = unexpectedFields(facts, allowed);
  if (unexpected.length > 0) {
    errors.push(`synthetic Authenticode evidence has unexpected fields: ${unexpected.join(", ")}`);
  }
  if (facts?.schemaVersion !== 1 || facts?.profile !== "synthetic-test") {
    errors.push("synthetic Authenticode evidence must use the synthetic-test profile");
  }
  if (facts?.architecture !== "x86_64") {
    errors.push("synthetic Authenticode evidence must describe x86-64");
  }
  if (facts?.signedCopyVerified !== true) {
    errors.push("synthetic Authenticode evidence must verify the signed copy");
  }
  if (facts?.sourceUnchanged !== true) {
    errors.push("synthetic Authenticode evidence must preserve the source binary");
  }
  if (facts?.authorityRemoved !== true) {
    errors.push("synthetic Authenticode evidence must prove authority cleanup");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return facts;
}

export function syntheticWindowsAuthenticodeSmoke({
  architecture = process.arch,
  environment = process.env,
  isFile = regularFile,
  platform = process.platform,
  run = spawnSync,
  sourceBinaryPath = path.join(repositoryRoot, "src-tauri", "target", "release", "fitfreed.exe"),
  version = packageVersion,
} = {}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("synthetic Authenticode smoke requires x86-64 Windows");
  }
  if (!isFile(sourceBinaryPath)) {
    throw new Error("synthetic Authenticode smoke requires the unsigned release executable");
  }
  const command = windowsAuthenticodeSmokeCommand({ sourceBinaryPath, version });
  const result = run(command.file, command.arguments, {
    encoding: "utf8",
    env: windowsNativeToolEnvironment(environment),
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error("synthetic Authenticode smoke could not start");
  if (result.status !== 0) {
    const phase = result.stderr?.match(/FITFREED_AUTHENTICODE_SMOKE_PHASE=([a-z-]+)/)?.[1]
      ?? "native-adapter";
    throw new Error(`synthetic Authenticode smoke failed during ${phase}`);
  }
  try {
    return validateSyntheticWindowsAuthenticodeEvidence(JSON.parse(result.stdout.trim()));
  } catch (error) {
    if (error.message.startsWith("synthetic Authenticode evidence")) throw error;
    throw new Error("synthetic Authenticode smoke returned invalid evidence");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(syntheticWindowsAuthenticodeSmoke())}\n`);
  } catch (error) {
    process.stderr.write(`Synthetic Windows Authenticode smoke failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
