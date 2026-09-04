import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findWindowsNsisPackage } from "./verify-windows-package-installation.mjs";
import { windowsInstalledPackageActionCommand } from "./windows-installed-package.mjs";
import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const coldLaunchScript = path.join(repositoryRoot, "scripts/run-cold-launch-benchmark.mjs");

function requireSuccessfulProcess(result, description) {
  if (result.error) throw new Error(`${description} could not start`);
  if (result.signal !== null) throw new Error(`${description} was terminated`);
  if (result.status !== 0) throw new Error(`${description} failed`);
}

export function verifyWindowsColdLaunch({
  architecture = process.arch,
  environment = process.env,
  packagePath,
  platform = process.platform,
  run = spawnSync,
  version,
}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows cold-launch admission requires x86-64 Windows");
  }
  if (!packagePath || !statSync(packagePath).isFile()) {
    throw new Error("the exact Windows NSIS package is unavailable");
  }
  const nativeEnvironment = windowsNativeToolEnvironment(environment);
  const runAction = (action) => {
    const command = windowsInstalledPackageActionCommand({
      action,
      architecture,
      packagePath,
      platform,
      version,
    });
    const result = run(command.file, command.arguments, {
      cwd: repositoryRoot,
      env: nativeEnvironment,
      stdio: "inherit",
    });
    requireSuccessfulProcess(result, `Windows package ${action}`);
  };

  runAction("preflight");
  let installationOwned = false;
  try {
    installationOwned = true;
    runAction("install");
    const benchmark = run(process.execPath, [coldLaunchScript], {
      cwd: repositoryRoot,
      env: nativeEnvironment,
      stdio: "inherit",
    });
    requireSuccessfulProcess(benchmark, "Windows cold-launch benchmark");
  } finally {
    if (installationOwned) runAction("remove");
  }
  return { package: path.basename(packagePath), result: "passed" };
}

function resolveDefaultInputs() {
  const version = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  ).version;
  const packagePath = findWindowsNsisPackage(
    path.join(repositoryRoot, "src-tauri/target/release/bundle/nsis"),
    version,
  );
  return { packagePath, version };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(verifyWindowsColdLaunch(resolveDefaultInputs()))}\n`);
  } catch (error) {
    process.stderr.write(`Windows cold-launch admission failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
