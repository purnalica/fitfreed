import { execFileSync, spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { linuxPackageContract } from "./linux-package-contract.mjs";
import { loadPublicReleaseSigningConfiguration } from "./public-release-signing-configuration.mjs";
import { verifySupportedPublicReleaseCandidate } from "./public-release-candidate-verification.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { measureFreshProcess } from "./run-cold-launch-benchmark.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const supportedUbuntuVersions = new Set(["24.04", "26.04"]);
const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseLinuxOsRelease(source) {
  const values = {};
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("Linux candidate admission host has invalid OS evidence");
    const key = line.slice(0, separator);
    let value = line.slice(separator + 1);
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
    }
    values[key] = value;
  }
  return values;
}

export function validateLinuxCandidateAdmissionHost({
  architecture,
  expectedUbuntuVersion,
  osRelease,
  platform,
}) {
  const release = parseLinuxOsRelease(osRelease);
  if (
    platform !== "linux"
    || architecture !== "x64"
    || !supportedUbuntuVersions.has(expectedUbuntuVersion)
    || release.ID !== "ubuntu"
    || release.VERSION_ID !== expectedUbuntuVersion
  ) {
    throw new Error("Linux candidate admission host does not match its declared x86-64 Ubuntu boundary");
  }
  return {
    architecture: linuxPackageContract.architecture,
    distribution: "ubuntu",
    version: expectedUbuntuVersion,
  };
}

export function validateInstalledLinuxCandidate(facts, expectedVersion) {
  if (
    !semanticVersion.test(expectedVersion ?? "")
    || facts?.status !== "install ok installed"
    || facts?.packageName !== linuxPackageContract.packageName
    || facts?.version !== expectedVersion
    || facts?.architecture !== linuxPackageContract.architecture
    || facts?.maintainer !== linuxPackageContract.publisher
    || facts?.executable !== "regular-executable"
    || facts?.desktopEntry !== "regular"
    || facts?.license !== "regular"
    || !Array.isArray(facts?.icons)
    || facts.icons.length !== linuxPackageContract.requiredIconPaths.length
    || facts.icons.some((kind) => kind !== "regular")
    || !Array.isArray(facts?.dynamicLibrariesMissing)
    || facts.dynamicLibrariesMissing.length !== 0
  ) {
    throw new Error("installed Linux candidate does not match its exact Debian identity");
  }
  return {
    architecture: facts.architecture,
    packageName: facts.packageName,
    version: facts.version,
  };
}

export function validateRetainedLinuxCandidateLibrary(facts, expectedSchemaVersion) {
  if (
    !Number.isSafeInteger(expectedSchemaVersion)
    || expectedSchemaVersion < 1
    || facts?.exists !== true
    || facts?.type !== "regular"
    || facts?.links !== 1
    || facts?.mode !== 0o600
    || facts?.parentMode !== 0o700
    || facts?.integrity !== "ok"
    || facts?.schemaVersion !== expectedSchemaVersion
  ) {
    throw new Error("candidate library is not one private integral regular file");
  }
  return {
    integrity: "ok",
    retained: true,
    schemaVersion: expectedSchemaVersion,
  };
}

export function validateRemovedLinuxCandidate(facts) {
  if (
    facts?.packageInstalled !== false
    || facts?.executableExists !== false
    || facts?.desktopEntryExists !== false
    || facts?.licenseExists !== false
    || !Array.isArray(facts?.iconsExist)
    || facts.iconsExist.length !== linuxPackageContract.requiredIconPaths.length
    || facts.iconsExist.some(Boolean)
  ) {
    throw new Error("Linux candidate removal left installed package material");
  }
  return { removed: true };
}

export function validateExactLinuxCandidate(candidate, expectedVersion, expectedRevision) {
  const { manifest, verified } = candidate ?? {};
  if (
    manifest?.schemaVersion !== 6
    || manifest?.release?.version !== expectedVersion
    || manifest?.release?.revision !== expectedRevision
    || verified?.version !== expectedVersion
    || verified?.revision !== expectedRevision
    || verified?.storageSchemaVersion !== manifest?.application?.storageSchemaVersion
    || !path.isAbsolute(verified?.debianPackage ?? "")
    || JSON.stringify(verified?.targets)
      !== JSON.stringify(["darwin-aarch64", "linux-x86_64-deb"])
  ) {
    throw new Error("Linux candidate admission requires the exact expanding Linux candidate");
  }
  return verified;
}

export function normalizeCandidateCommandOutput(output) {
  if (output === null || output === undefined) return "";
  if (typeof output !== "string") {
    throw new Error("Linux candidate command output has an unsupported representation");
  }
  return output.trim();
}

function execute(program, arguments_, options = {}) {
  const output = execFileSync(program, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  return normalizeCandidateCommandOutput(output);
}

function fileKind(filePath, executable = false) {
  const metadata = lstatSync(filePath);
  if (metadata.isSymbolicLink()) return "symbolic-link";
  if (!metadata.isFile()) return "other";
  if (!executable) return "regular";
  try {
    accessSync(filePath, constants.X_OK);
    return "regular-executable";
  } catch {
    return "regular-non-executable";
  }
}

function installedFacts() {
  const query = (field) => execute(
    "/usr/bin/dpkg-query",
    ["-W", `-f=\${${field}}`, linuxPackageContract.packageName],
  );
  const dynamicLibrariesMissing = execute("/usr/bin/ldd", [
    `/${linuxPackageContract.executablePath}`,
  ]).split("\n").filter((line) => line.includes("not found"));
  return {
    architecture: query("Architecture"),
    desktopEntry: fileKind(`/${linuxPackageContract.desktopEntryPath}`),
    dynamicLibrariesMissing,
    executable: fileKind(`/${linuxPackageContract.executablePath}`, true),
    icons: linuxPackageContract.requiredIconPaths.map((iconPath) => fileKind(`/${iconPath}`)),
    license: fileKind(`/${linuxPackageContract.licensePath}`),
    maintainer: query("Maintainer"),
    packageName: query("Package"),
    status: query("Status"),
    version: query("Version"),
  };
}

function libraryFacts(libraryPath) {
  if (!existsSync(libraryPath)) return { exists: false };
  const metadata = lstatSync(libraryPath);
  const parent = lstatSync(path.dirname(libraryPath));
  return {
    exists: true,
    integrity: execute("/usr/bin/sqlite3", [libraryPath, "PRAGMA quick_check;"]),
    links: metadata.nlink,
    mode: metadata.mode & 0o777,
    parentMode: parent.mode & 0o777,
    schemaVersion: Number.parseInt(
      execute("/usr/bin/sqlite3", [libraryPath, "PRAGMA user_version;"]),
      10,
    ),
    type: metadata.isSymbolicLink() ? "symbolic-link" : metadata.isFile() ? "regular" : "other",
  };
}

function removalFacts() {
  const query = spawnSync(
    "/usr/bin/dpkg-query",
    ["-W", linuxPackageContract.packageName],
    { cwd: repositoryRoot, stdio: "ignore" },
  );
  return {
    desktopEntryExists: existsSync(`/${linuxPackageContract.desktopEntryPath}`),
    executableExists: existsSync(`/${linuxPackageContract.executablePath}`),
    iconsExist: linuxPackageContract.requiredIconPaths.map(
      (iconPath) => existsSync(`/${iconPath}`),
    ),
    licenseExists: existsSync(`/${linuxPackageContract.licensePath}`),
    packageInstalled: query.status === 0,
  };
}

function exactCandidate(candidateDirectory, version) {
  const candidate = verifySupportedPublicReleaseCandidate({
    candidateDirectory,
    publicReleaseSigningConfiguration:
      loadPublicReleaseSigningConfiguration(repositoryRoot),
    publicUpdateConfiguration: loadPublicUpdateConfiguration(repositoryRoot),
  });
  const revision = execute("git", ["rev-parse", "HEAD"]);
  const dirty = execute("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (!semanticVersion.test(version ?? "") || dirty.length !== 0) {
    throw new Error("Linux candidate admission requires the exact clean tagged source and candidate");
  }
  return validateExactLinuxCandidate(candidate, version, revision);
}

function admissionPaths(version, ubuntuVersion) {
  const root = path.join(
    repositoryRoot,
    ".artifacts/linux-candidate-admission",
    `ubuntu-${ubuntuVersion}`,
    version,
  );
  const home = path.join(root, "home");
  return {
    home,
    library: path.join(
      home,
      ".local/share",
      "org.fitfreed.desktop",
      "fitfreed.sqlite",
    ),
    root,
  };
}

async function installCandidate(candidateDirectory, version, ubuntuVersion) {
  const host = validateLinuxCandidateAdmissionHost({
    architecture: process.arch,
    expectedUbuntuVersion: ubuntuVersion,
    osRelease: readFileSync("/etc/os-release", "utf8"),
    platform: process.platform,
  });
  const candidate = exactCandidate(candidateDirectory, version);
  const paths = admissionPaths(version, ubuntuVersion);
  validateRemovedLinuxCandidate(removalFacts());
  rmSync(paths.root, { recursive: true, force: true });
  mkdirSync(paths.home, { recursive: true, mode: 0o700 });
  execute("/usr/bin/sudo", [
    "/usr/bin/apt-get",
    "install",
    "--yes",
    candidate.debianPackage,
  ], { capture: false });
  const installed = validateInstalledLinuxCandidate(installedFacts(), version);
  await measureFreshProcess(
    `/${linuxPackageContract.executablePath}`,
    paths.home,
    { applicationVersion: version, sourceRevision: candidate.revision },
  );
  const library = validateRetainedLinuxCandidateLibrary(
    libraryFacts(paths.library),
    candidate.storageSchemaVersion,
  );
  return {
    host,
    installed,
    library,
    revision: candidate.revision,
    phase: "installed-and-launched",
  };
}

function removeCandidate(candidateDirectory, version, ubuntuVersion) {
  const host = validateLinuxCandidateAdmissionHost({
    architecture: process.arch,
    expectedUbuntuVersion: ubuntuVersion,
    osRelease: readFileSync("/etc/os-release", "utf8"),
    platform: process.platform,
  });
  const candidate = exactCandidate(candidateDirectory, version);
  const paths = admissionPaths(version, ubuntuVersion);
  validateRetainedLinuxCandidateLibrary(
    libraryFacts(paths.library),
    candidate.storageSchemaVersion,
  );
  execute("/usr/bin/sudo", [
    "/usr/bin/apt-get",
    "purge",
    "--yes",
    linuxPackageContract.packageName,
  ], { capture: false });
  const removed = validateRemovedLinuxCandidate(removalFacts());
  const library = validateRetainedLinuxCandidateLibrary(
    libraryFacts(paths.library),
    candidate.storageSchemaVersion,
  );
  return {
    host,
    library,
    removed,
    revision: candidate.revision,
    phase: "removed-library-retained",
  };
}

async function main() {
  const [phase, candidateDirectory, version, ubuntuVersion] = process.argv.slice(2);
  if (!candidateDirectory || !version || !ubuntuVersion || !["install", "remove"].includes(phase)) {
    throw new Error(
      "usage: node scripts/verify-linux-candidate-installation.mjs <install|remove> <candidate-directory> <version> <ubuntu-version>",
    );
  }
  const evidence = phase === "install"
    ? await installCandidate(candidateDirectory, version, ubuntuVersion)
    : removeCandidate(candidateDirectory, version, ubuntuVersion);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`Linux candidate installation verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
