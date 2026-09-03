import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { e2eTargetDirectory, repositoryRoot } from "./e2e-paths.mjs";
import { runPackagedE2e } from "./run-packaged-e2e.mjs";

export const linuxPackagedE2eContract = Object.freeze({
  architecture: "amd64",
  executablePath: "/usr/bin/fitfreed-e2e",
  packageName: "fitfreed-e2e",
  platform: "linux",
});

const packageDirectory = path.join(e2eTargetDirectory, "release/bundle/deb");
const runRoot = path.join(repositoryRoot, ".artifacts/linux-packaged-e2e");
const journeyRunDirectory = path.join(runRoot, "installed-journeys");
const debianPackageTool = "/usr/bin/dpkg-deb";
const debianInstaller = "/usr/bin/dpkg";
const debianQuery = "/usr/bin/dpkg-query";
const privilegeTool = "/usr/bin/sudo";

export function resolveLinuxE2eDebianPackage(directory, entries) {
  const packages = entries.filter((entry) => entry.endsWith(".deb"));
  if (packages.length !== 1) {
    throw new Error("the Linux E2E build must produce exactly one Debian package");
  }
  const [fileName] = packages;
  if (path.basename(fileName) !== fileName || fileName === "." || fileName === "..") {
    throw new Error("the Linux E2E Debian artifact must have a safe file name");
  }
  return path.join(directory, fileName);
}

export function validateLinuxE2eDebianMetadata({
  architecture,
  fileListing,
  packageName,
  version,
}) {
  const executableEntry = fileListing
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => line.trim().endsWith("./usr/bin/fitfreed-e2e"));
  if (
    packageName !== linuxPackagedE2eContract.packageName
    || architecture !== linuxPackagedE2eContract.architecture
    || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
    || executableEntry.length !== 1
    || !/^-rwxr-xr-x\s/.test(executableEntry[0].trim())
  ) {
    throw new Error("the Linux E2E Debian package metadata is invalid");
  }
  return {
    architecture,
    executablePath: linuxPackagedE2eContract.executablePath,
    packageName,
    version,
  };
}

function run(command, arguments_, { allowFailure = false, environment = process.env } = {}) {
  try {
    return {
      status: 0,
      stdout: execFileSync(command, arguments_, {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (error) {
    if (allowFailure && Number.isInteger(error.status)) {
      return { status: error.status, stdout: error.stdout?.toString() ?? "" };
    }
    const detail = error.stderr?.toString().trim();
    throw new Error(
      `${path.basename(command)} failed${detail ? `: ${detail}` : ""}`,
      { cause: error },
    );
  }
}

function packageStatus() {
  return run(
    debianQuery,
    ["--show", "--showformat=${Status}", linuxPackagedE2eContract.packageName],
    { allowFailure: true },
  );
}

function packageIsInstalled() {
  const status = packageStatus();
  return status.status === 0 && status.stdout.trim() === "install ok installed";
}

function readPackageMetadata(packagePath) {
  const field = (name) => run(debianPackageTool, ["--field", packagePath, name]).stdout.trim();
  return validateLinuxE2eDebianMetadata({
    architecture: field("Architecture"),
    fileListing: run(debianPackageTool, ["--contents", packagePath]).stdout,
    packageName: field("Package"),
    version: field("Version"),
  });
}

function assertInstalledExecutable() {
  const executable = lstatSync(linuxPackagedE2eContract.executablePath);
  if (!executable.isFile() || (executable.mode & 0o111) === 0) {
    throw new Error("the installed Linux E2E executable is not a runnable regular file");
  }
}

function removeTestPackage() {
  const result = run(
    privilegeTool,
    [debianInstaller, "--purge", linuxPackagedE2eContract.packageName],
    { allowFailure: true },
  );
  if (packageStatus().status === 0 || existsSync(linuxPackagedE2eContract.executablePath)) {
    throw new Error(`the isolated Linux E2E package could not be removed (status ${result.status})`);
  }
}

export function runPackagedLinuxE2e({ platform = process.platform } = {}) {
  if (platform !== linuxPackagedE2eContract.platform) {
    throw new Error("the installed Debian E2E journey requires Linux");
  }
  if (packageStatus().status === 0 || existsSync(linuxPackagedE2eContract.executablePath)) {
    throw new Error("an existing Linux E2E package or executable must not be replaced");
  }

  const packagePath = resolveLinuxE2eDebianPackage(
    packageDirectory,
    readdirSync(packageDirectory),
  );
  if (!lstatSync(packagePath).isFile()) {
    throw new Error("the Linux E2E Debian artifact must be a regular file");
  }
  const metadata = readPackageMetadata(packagePath);
  let installationAttempted = false;
  let scenarios = [];
  let completed = false;

  rmSync(runRoot, { recursive: true, force: true });
  try {
    installationAttempted = true;
    run(privilegeTool, [debianInstaller, "--install", packagePath]);
    if (!packageIsInstalled()) {
      throw new Error("the isolated Linux E2E package is not installed");
    }
    assertInstalledExecutable();

    scenarios = runPackagedE2e({
      environment: {
        ...process.env,
        FITFREED_E2E_APPLICATION_BINARY: linuxPackagedE2eContract.executablePath,
      },
      removeCompletedRun: false,
      runDirectory: journeyRunDirectory,
    });

    for (const databasePath of new Set(scenarios.map(({ databasePath }) => databasePath))) {
      if (!statSync(databasePath).isFile() || statSync(databasePath).size === 0) {
        throw new Error("a packaged Linux journey did not preserve its synthetic library");
      }
    }
    completed = true;
  } finally {
    if (installationAttempted) removeTestPackage();
  }

  if (packageIsInstalled() || existsSync(linuxPackagedE2eContract.executablePath)) {
    throw new Error("Debian removal left the isolated test application installed");
  }
  for (const databasePath of new Set(scenarios.map(({ databasePath }) => databasePath))) {
    if (!existsSync(databasePath)) {
      throw new Error("Debian removal deleted a synthetic user library");
    }
  }
  if (completed) rmSync(runRoot, { recursive: true, force: true });

  process.stdout.write(`${JSON.stringify({
    architecture: metadata.architecture,
    installedExecutable: linuxPackagedE2eContract.executablePath,
    packageName: metadata.packageName,
    removal: "package-removed-libraries-preserved",
    scenarios: scenarios.length,
    version: metadata.version,
  })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runPackagedLinuxE2e();
  } catch (error) {
    process.stderr.write(`Packaged Linux E2E failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
