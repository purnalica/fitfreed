import { createHash } from "node:crypto";
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedWindowsNsisArtifactName,
  windowsPackageContract,
} from "./windows-package-contract.mjs";

const modes = new Set(["capture-uninstaller", "inject-signed-inner"]);
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function requireRegularFile(filePath, message) {
  if (!existsSync(filePath)) throw new Error(message);
  const metadata = lstatSync(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 1) {
    throw new Error(message);
  }
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function requireBridgeInput(environment, targetPath) {
  const mode = environment?.FITFREED_SIGNPATH_BRIDGE_MODE;
  if (!modes.has(mode)) throw new Error("SignPath NSIS bridge mode is invalid");
  const version = environment.FITFREED_SIGNPATH_VERSION;
  if (!versionPattern.test(version ?? "")) {
    throw new Error("SignPath NSIS bridge version is invalid");
  }
  const innerDirectory = environment.FITFREED_SIGNPATH_INNER_DIRECTORY;
  if (typeof innerDirectory !== "string" || !path.isAbsolute(innerDirectory)) {
    throw new Error("SignPath NSIS bridge requires an absolute inner directory");
  }
  if (!existsSync(innerDirectory) || !lstatSync(innerDirectory).isDirectory()) {
    throw new Error("SignPath NSIS bridge inner directory is unavailable");
  }
  if (typeof targetPath !== "string" || !path.isAbsolute(targetPath)) {
    throw new Error("SignPath NSIS bridge requires an absolute target path");
  }
  requireRegularFile(targetPath, "SignPath NSIS bridge target is unavailable");
  return { innerDirectory, mode, version };
}

function targetRole(targetPath, version) {
  const basename = path.basename(targetPath).toLowerCase();
  if (basename === windowsPackageContract.executable) return "application";
  if (basename === expectedWindowsNsisArtifactName(version).toLowerCase()) return "setup";
  if (path.extname(basename) === ".dll") return "packaging-tool";
  if (path.extname(basename) === ".exe") return "uninstaller";
  throw new Error("SignPath NSIS bridge received an unsupported target");
}

export function runWindowsSignPathNsisBridge({
  environment = process.env,
  targetPath,
} = {}) {
  const input = requireBridgeInput(environment, targetPath);
  const role = targetRole(targetPath, input.version);
  if (role === "setup" || role === "packaging-tool") return { operation: "unchanged" };

  const applicationPath = path.join(input.innerDirectory, windowsPackageContract.executable);
  const uninstallerPath = path.join(input.innerDirectory, windowsPackageContract.uninstaller);
  if (input.mode === "capture-uninstaller") {
    if (role === "application") return { operation: "unchanged" };
    if (existsSync(uninstallerPath)) {
      requireRegularFile(uninstallerPath, "captured SignPath uninstaller is invalid");
      if (sha256(uninstallerPath) !== sha256(targetPath)) {
        throw new Error("SignPath NSIS bridge received more than one uninstaller candidate");
      }
      return { operation: "captured-uninstaller" };
    }
    copyFileSync(targetPath, uninstallerPath, constants.COPYFILE_EXCL);
    requireRegularFile(uninstallerPath, "captured SignPath uninstaller is invalid");
    if (sha256(uninstallerPath) !== sha256(targetPath)) {
      throw new Error("captured SignPath uninstaller bytes differ");
    }
    return { operation: "captured-uninstaller" };
  }

  try {
    requireRegularFile(applicationPath, "signed inner input is incomplete");
    requireRegularFile(uninstallerPath, "signed inner input is incomplete");
  } catch {
    throw new Error("signed inner input is incomplete");
  }
  if (role === "application") {
    if (sha256(applicationPath) !== sha256(targetPath)) {
      throw new Error("signed application bytes differ from the packaging input");
    }
    return { operation: "verified-application" };
  }
  copyFileSync(uninstallerPath, targetPath);
  if (sha256(uninstallerPath) !== sha256(targetPath)) {
    throw new Error("injected uninstaller bytes differ from signed input");
  }
  return { operation: "injected-uninstaller" };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const [targetPath] = process.argv.slice(2);
    runWindowsSignPathNsisBridge({ targetPath });
  } catch (error) {
    process.stderr.write(`SignPath NSIS packaging bridge failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
