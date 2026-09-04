import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { e2eTargetDirectory, repositoryRoot } from "./e2e-paths.mjs";
import { runPackagedE2e } from "./run-packaged-e2e.mjs";

export const windowsPackagedE2eContract = Object.freeze({
  applicationIdentifier: "org.fitfreed.desktop.e2e",
  architecture: "x64",
  executable: "fitfreed-e2e.exe",
  installDirectory: "%LOCALAPPDATA%\\fitfreed-e2e",
  packageName: "fitfreed-e2e",
  platform: "win32",
  uninstallRegistry:
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\fitfreed-e2e",
});

const versionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const packageDirectory = path.join(e2eTargetDirectory, "release/bundle/nsis");
const runRoot = path.join(repositoryRoot, ".artifacts/windows-packaged-e2e");
const journeyRunDirectory = path.join(runRoot, "installed-journeys");
const packageActionScript = path.join(
  repositoryRoot,
  "scripts/run-packaged-windows-e2e.ps1",
);
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;

export function expectedWindowsE2eNsisArtifactName(version) {
  if (!versionPattern.test(version)) throw new Error("invalid package version");
  return `${windowsPackagedE2eContract.packageName}_${version}_x64-setup.exe`;
}

export function resolveWindowsE2eNsisPackage(directory, entries, version) {
  const packages = entries.filter((entry) => entry.toLowerCase().endsWith(".exe"));
  if (packages.length !== 1) {
    throw new Error("the Windows E2E build must produce exactly one NSIS package");
  }
  const [fileName] = packages;
  if (path.basename(fileName) !== fileName || fileName === "." || fileName === "..") {
    throw new Error("the Windows E2E NSIS artifact must have a safe file name");
  }
  const expectedName = expectedWindowsE2eNsisArtifactName(version);
  if (fileName !== expectedName) {
    throw new Error(`the Windows E2E NSIS artifact must be ${expectedName}`);
  }
  return path.join(directory, fileName);
}

export function windowsPackageActionCommand({
  action,
  architecture = process.arch,
  packagePath,
  platform = process.platform,
  version,
}) {
  if (!new Set(["install", "preflight", "remove"]).has(action)) {
    throw new Error("unsupported Windows E2E package action");
  }
  if (platform !== windowsPackagedE2eContract.platform || architecture !== "x64") {
    throw new Error("the packaged E2E journey requires x86-64 Windows");
  }
  if (!versionPattern.test(version ?? "")) throw new Error("invalid package version");
  if (!path.isAbsolute(packagePath)) {
    throw new Error("the Windows E2E package path must be absolute");
  }
  const expectedName = expectedWindowsE2eNsisArtifactName(version);
  if (path.basename(packagePath) !== expectedName) {
    throw new Error(`the Windows E2E NSIS artifact must be ${expectedName}`);
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
      packageActionScript,
      "-Action",
      action,
      "-PackagePath",
      packagePath,
      "-ExpectedVersion",
      version,
      "-ExpectedProductName",
      windowsPackagedE2eContract.packageName,
      "-ExpectedExecutable",
      windowsPackagedE2eContract.executable,
      "-ExpectedIdentifier",
      windowsPackagedE2eContract.applicationIdentifier,
    ],
  };
}

function runPackageAction(action, packagePath) {
  const command = windowsPackageActionCommand({
    action,
    packagePath,
    version: packageVersion,
  });
  const result = spawnSync(command.file, command.arguments, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal !== null) {
    throw new Error(`Windows E2E package ${action} was terminated by ${result.signal}`);
  }
  if (result.status !== 0) {
    throw new Error(`Windows E2E package ${action} failed with status ${result.status}`);
  }
}

export function runPackagedWindowsE2e({
  architecture = process.arch,
  environment = process.env,
  platform = process.platform,
} = {}) {
  if (platform !== windowsPackagedE2eContract.platform || architecture !== "x64") {
    throw new Error("the installed NSIS E2E journey requires x86-64 Windows");
  }
  if (typeof environment.LOCALAPPDATA !== "string" || environment.LOCALAPPDATA.length === 0) {
    throw new Error("LOCALAPPDATA is unavailable for the Windows E2E installation");
  }

  const packagePath = resolveWindowsE2eNsisPackage(
    packageDirectory,
    readdirSync(packageDirectory),
    packageVersion,
  );
  if (!lstatSync(packagePath).isFile()) {
    throw new Error("the Windows E2E NSIS artifact must be a regular file");
  }
  const installedExecutable = path.join(
    environment.LOCALAPPDATA,
    windowsPackagedE2eContract.packageName,
    windowsPackagedE2eContract.executable,
  );
  let installationAttempted = false;
  let scenarios = [];
  let completed = false;

  rmSync(runRoot, { recursive: true, force: true });
  runPackageAction("preflight", packagePath);
  try {
    installationAttempted = true;
    runPackageAction("install", packagePath);
    if (!existsSync(installedExecutable) || !statSync(installedExecutable).isFile()) {
      throw new Error("the installed Windows E2E executable is unavailable");
    }

    scenarios = runPackagedE2e({
      environment: {
        ...environment,
        FITFREED_E2E_APPLICATION_BINARY: installedExecutable,
      },
      removeCompletedRun: false,
      runDirectory: journeyRunDirectory,
    });

    for (const databasePath of new Set(scenarios.map(({ databasePath }) => databasePath))) {
      if (!statSync(databasePath).isFile() || statSync(databasePath).size === 0) {
        throw new Error("a packaged Windows journey did not preserve its synthetic library");
      }
    }
    completed = true;
  } finally {
    if (installationAttempted) runPackageAction("remove", packagePath);
  }

  if (existsSync(installedExecutable)) {
    throw new Error("NSIS removal left the isolated test application installed");
  }
  for (const databasePath of new Set(scenarios.map(({ databasePath }) => databasePath))) {
    if (!existsSync(databasePath)) {
      throw new Error("NSIS removal deleted a synthetic user library");
    }
  }
  if (completed) rmSync(runRoot, { recursive: true, force: true });

  process.stdout.write(`${JSON.stringify({
    installedExecutable: windowsPackagedE2eContract.executable,
    packageName: windowsPackagedE2eContract.packageName,
    removal: "package-removed-libraries-preserved",
    scenarios: scenarios.length,
    version: packageVersion,
  })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runPackagedWindowsE2e();
  } catch (error) {
    process.stderr.write(`Packaged Windows E2E failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
