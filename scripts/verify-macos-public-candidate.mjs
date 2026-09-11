import { execFileSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectPublicMacosTrust } from "./macos-public-trust.mjs";
import { loadPublicReleaseSigningConfiguration } from "./public-release-signing-configuration.mjs";
import { verifySupportedPublicReleaseCandidate } from "./public-release-candidate-verification.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { inspectArtifact, sha256File } from "./release-evidence.mjs";
import { measureFreshProcess } from "./run-cold-launch-benchmark.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const digestPattern = /^[0-9a-f]{64}$/;
const revisionPattern = /^[0-9a-f]{40,64}$/;
const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function execute(program, arguments_, options = {}) {
  return execFileSync(program, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    stdio: options.capture === false ? "ignore" : ["ignore", "pipe", "pipe"],
  })?.trim() ?? "";
}

function majorMacosVersion(version) {
  const match = /^(\d+)(?:\.\d+){1,2}$/.exec(version ?? "");
  return match ? Number.parseInt(match[1], 10) : null;
}

export function validateMacosCandidateHost({
  architecture,
  operatingSystemVersion,
  platform,
}) {
  const majorVersion = majorMacosVersion(operatingSystemVersion);
  if (platform !== "darwin" || architecture !== "arm64" || majorVersion === null || majorVersion < 15) {
    throw new Error("macOS candidate admission host is outside the supported Apple Silicon boundary");
  }
  return {
    architecture: "aarch64",
    minimumSystemVersion: "15.0",
    operatingSystem: "macos",
  };
}

function exactArtifact(manifest, kind) {
  const artifacts = manifest?.artifacts?.filter((artifact) => artifact.kind === kind) ?? [];
  return artifacts.length === 1 ? artifacts[0] : null;
}

export function validateExactMacosPublicCandidate(
  candidate,
  candidateDirectory,
  expectedVersion,
  expectedRevision,
) {
  const root = path.resolve(candidateDirectory);
  const { manifest, verified } = candidate ?? {};
  const application = exactArtifact(manifest, "macos-application-bundle");
  const diskImage = exactArtifact(manifest, "macos-disk-image");
  const expectedDiskImage = diskImage
    ? path.join(root, "release", diskImage.path)
    : null;
  if (
    !semanticVersion.test(expectedVersion ?? "")
    || !revisionPattern.test(expectedRevision ?? "")
    || manifest?.schemaVersion !== 3
    || manifest?.release?.version !== expectedVersion
    || manifest?.release?.revision !== expectedRevision
    || manifest?.release?.signed !== true
    || manifest?.release?.notarized !== true
    || manifest?.target?.os !== "macos"
    || manifest?.target?.architecture !== "aarch64"
    || manifest?.target?.minimumSystemVersion !== "15.0"
    || manifest?.application?.bundleIdentifier !== "org.fitfreed.desktop"
    || manifest?.application?.executable !== "fitfreed"
    || !Number.isSafeInteger(manifest?.application?.storageSchemaVersion)
    || manifest.application.storageSchemaVersion < 1
    || !application
    || !digestPattern.test(application.sha256 ?? "")
    || !diskImage
    || !digestPattern.test(diskImage.sha256 ?? "")
    || verified?.version !== expectedVersion
    || verified?.revision !== expectedRevision
    || !path.isAbsolute(verified?.diskImage ?? "")
    || verified.diskImage !== expectedDiskImage
    || !digestPattern.test(manifest?.trust?.codeSigning?.certificateSha256 ?? "")
    || !/^[A-Z0-9]{10}$/.test(manifest?.trust?.codeSigning?.teamIdentifier ?? "")
  ) {
    throw new Error("macOS admission requires the exact initial public macOS candidate");
  }
  return {
    applicationBundle: path.join(root, "release", application.path),
    applicationSha256: application.sha256,
    certificateSha256: manifest.trust.codeSigning.certificateSha256,
    diskImage: verified.diskImage,
    revision: verified.revision,
    storageSchemaVersion: manifest.application.storageSchemaVersion,
    teamIdentifier: manifest.trust.codeSigning.teamIdentifier,
    version: verified.version,
  };
}

export function validateMacosCandidateApplication(facts, expected) {
  if (
    facts?.applicationSha256 !== expected?.applicationSha256
    || facts?.bundleExecutable !== "fitfreed"
    || facts?.bundleIdentifier !== "org.fitfreed.desktop"
    || facts?.bundleVersion !== expected?.version
    || facts?.executable !== "regular-executable"
  ) {
    throw new Error("installed macOS candidate does not preserve the sealed application identity");
  }
  return {
    bundleIdentifier: facts.bundleIdentifier,
    version: facts.bundleVersion,
  };
}

export function validateMacosCandidateLibrary(facts, expectedSchemaVersion) {
  if (
    !Number.isSafeInteger(expectedSchemaVersion)
    || expectedSchemaVersion < 1
    || facts?.exists !== true
    || facts?.integrity !== "ok"
    || facts?.links !== 1
    || facts?.mode !== 0o600
    || facts?.parentMode !== 0o700
    || facts?.schemaVersion !== expectedSchemaVersion
    || !digestPattern.test(facts?.sha256 ?? "")
    || facts?.type !== "regular"
  ) {
    throw new Error("macOS candidate library is not one private integral regular file");
  }
  return {
    integrity: facts.integrity,
    schemaVersion: facts.schemaVersion,
    sha256: facts.sha256,
  };
}

export function validateRemovedMacosCandidate(
  facts,
  expectedSchemaVersion,
  expectedLibrarySha256,
) {
  const library = validateMacosCandidateLibrary(facts?.library, expectedSchemaVersion);
  if (facts?.applicationExists !== false || library.sha256 !== expectedLibrarySha256) {
    throw new Error("macOS candidate removal did not preserve the accepted application-data boundary");
  }
  return { libraryRetained: true, removed: true };
}

function executableKind(filePath) {
  const metadata = lstatSync(filePath);
  if (metadata.isSymbolicLink() || !metadata.isFile()) return "other";
  try {
    accessSync(filePath, constants.X_OK);
    return "regular-executable";
  } catch {
    return "regular-non-executable";
  }
}

function applicationFacts(applicationPath) {
  const informationPlist = path.join(applicationPath, "Contents", "Info.plist");
  const binary = path.join(applicationPath, "Contents", "MacOS", "fitfreed");
  return {
    applicationSha256: inspectArtifact(
      path.dirname(applicationPath),
      path.basename(applicationPath),
      "macos-application-bundle",
    ).sha256,
    bundleExecutable: execute("/usr/bin/plutil", [
      "-extract",
      "CFBundleExecutable",
      "raw",
      "-o",
      "-",
      informationPlist,
    ]),
    bundleIdentifier: execute("/usr/bin/plutil", [
      "-extract",
      "CFBundleIdentifier",
      "raw",
      "-o",
      "-",
      informationPlist,
    ]),
    bundleVersion: execute("/usr/bin/plutil", [
      "-extract",
      "CFBundleShortVersionString",
      "raw",
      "-o",
      "-",
      informationPlist,
    ]),
    executable: executableKind(binary),
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
    sha256: sha256File(libraryPath),
    type: metadata.isSymbolicLink() ? "symbolic-link" : metadata.isFile() ? "regular" : "other",
  };
}

function exactCandidate(candidateDirectory, version, revision) {
  const candidate = verifySupportedPublicReleaseCandidate({
    candidateDirectory,
    publicReleaseSigningConfiguration:
      loadPublicReleaseSigningConfiguration(repositoryRoot),
    publicUpdateConfiguration: loadPublicUpdateConfiguration(repositoryRoot),
  });
  return validateExactMacosPublicCandidate(candidate, candidateDirectory, version, revision);
}

function attachDiskImage(diskImage, mountPoint) {
  execute("/usr/bin/hdiutil", [
    "attach",
    diskImage,
    "-readonly",
    "-nobrowse",
    "-mountpoint",
    mountPoint,
    "-quiet",
  ], { capture: false });
}

function detachDiskImage(mountPoint) {
  execute("/usr/bin/hdiutil", ["detach", mountPoint, "-quiet"], { capture: false });
}

async function admitMacosPublicCandidate(candidateDirectory, version, revision) {
  const host = validateMacosCandidateHost({
    architecture: process.arch,
    operatingSystemVersion: execute("/usr/bin/sw_vers", ["-productVersion"]),
    platform: process.platform,
  });
  const candidate = exactCandidate(candidateDirectory, version, revision);
  const root = mkdtempSync(path.join(os.tmpdir(), "fitfreed-public-candidate-admission-"));
  const mountPoint = path.join(root, "mount");
  const installDirectory = path.join(root, "install");
  const installingApplication = path.join(installDirectory, ".FitFreed.app.installing");
  const installedApplication = path.join(installDirectory, "FitFreed.app");
  const home = path.join(root, "home");
  const library = path.join(
    home,
    "Library",
    "Application Support",
    "org.fitfreed.desktop",
    "fitfreed.sqlite",
  );
  let mounted = false;

  try {
    mkdirSync(mountPoint, { recursive: true });
    mkdirSync(installDirectory, { recursive: true });
    mkdirSync(home, { recursive: true, mode: 0o700 });
    attachDiskImage(candidate.diskImage, mountPoint);
    mounted = true;
    const mountedApplication = path.join(mountPoint, "FitFreed.app");
    validateMacosCandidateApplication(applicationFacts(mountedApplication), candidate);
    execute("/usr/bin/ditto", [mountedApplication, installingApplication], { capture: false });
    renameSync(installingApplication, installedApplication);
    detachDiskImage(mountPoint);
    mounted = false;

    const installed = validateMacosCandidateApplication(
      applicationFacts(installedApplication),
      candidate,
    );
    const trust = inspectPublicMacosTrust({
      applicationPath: installedApplication,
      diskImagePath: candidate.diskImage,
      expectedTeamIdentifier: candidate.teamIdentifier,
      expectedVersion: candidate.version,
    });
    if (trust.certificateSha256 !== candidate.certificateSha256) {
      throw new Error("installed macOS candidate uses an unexpected signing certificate");
    }

    const binary = path.join(installedApplication, "Contents", "MacOS", "fitfreed");
    await measureFreshProcess(binary, home, {
      applicationVersion: candidate.version,
      sourceRevision: candidate.revision,
    });
    validateMacosCandidateLibrary(
      libraryFacts(library),
      candidate.storageSchemaVersion,
    );
    await measureFreshProcess(binary, home, {
      applicationVersion: candidate.version,
      sourceRevision: candidate.revision,
    });
    const restartedLibrary = validateMacosCandidateLibrary(
      libraryFacts(library),
      candidate.storageSchemaVersion,
    );

    rmSync(installedApplication, { recursive: true });
    const removed = validateRemovedMacosCandidate({
      applicationExists: existsSync(installedApplication),
      library: libraryFacts(library),
    }, candidate.storageSchemaVersion, restartedLibrary.sha256);

    return {
      application: installed,
      candidate: {
        revision: candidate.revision,
        version: candidate.version,
      },
      host,
      lifecycle: {
        cleanInstall: true,
        firstLaunch: true,
        libraryIntegrity: restartedLibrary.integrity,
        libraryRetainedAfterRemoval: removed.libraryRetained,
        restart: true,
      },
      trust: {
        gatekeeperAccepted: trust.notarization.gatekeeperAccepted,
        notarized: trust.notarization.applicationStapled
          && trust.notarization.diskImageStapled,
        signed: true,
      },
    };
  } finally {
    if (mounted) {
      detachDiskImage(mountPoint);
      mounted = false;
    }
    rmSync(root, { force: true, recursive: true });
  }
}

async function main() {
  const [candidateDirectory, version, revision] = process.argv.slice(2);
  if (!candidateDirectory || !version || !revision) {
    throw new Error(
      "usage: node scripts/verify-macos-public-candidate.mjs <candidate-directory> <version> <revision>",
    );
  }
  const evidence = await admitMacosPublicCandidate(
    path.resolve(candidateDirectory),
    version,
    revision,
  );
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`macOS public candidate admission failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
