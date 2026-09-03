import {
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertUpdaterSigningAuthority } from "./build-public-candidate.mjs";
import { buildProductionPackage } from "./build-production.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";
import { sha256File } from "./release-evidence.mjs";
import {
  windowsAuthenticodeAuthority,
} from "./windows-authenticode-sign.mjs";
import { inspectWindowsAuthenticode } from "./windows-authenticode-trust.mjs";
import {
  expectedWindowsNsisArtifactName,
  validateWindowsPackageConfiguration,
  validateWindowsPublicSigningOverlay,
} from "./windows-package-contract.mjs";
import { windowsPackageBuildArguments } from "./build-windows-package.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;
const defaultReleaseDirectory = path.join(
  repositoryRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis",
);

export function windowsPublicCandidateBuildArguments(
  arguments_ = [],
  platform = process.platform,
  architecture = process.arch,
) {
  return [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--config",
    "src-tauri/tauri.windows.public-signing.conf.json",
    ...windowsPackageBuildArguments(arguments_, platform, architecture),
  ];
}

export function verifyWindowsPublicCandidateOutputs({
  architecture = process.arch,
  certificateSha256,
  inspect = inspectWindowsAuthenticode,
  platform = process.platform,
  releaseDirectory = defaultReleaseDirectory,
  signToolPath,
  version = packageVersion,
}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows public candidate verification requires x86-64 Windows");
  }
  const setup = expectedWindowsNsisArtifactName(version);
  const updaterSignature = `${setup}.sig`;
  const entries = readdirSync(releaseDirectory).sort((left, right) =>
    left.localeCompare(right, "en"));
  const expectedEntries = [setup, updaterSignature].sort((left, right) =>
    left.localeCompare(right, "en"));
  if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) {
    throw new Error("Windows public candidate must contain the closed artifact set");
  }
  for (const entry of entries) {
    const metadata = lstatSync(path.join(releaseDirectory, entry));
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
      throw new Error("Windows public candidate artifacts must be regular and singly linked");
    }
    if (metadata.size < 1) {
      throw new Error("Windows public candidate artifacts must not be empty");
    }
  }
  const setupPath = path.join(releaseDirectory, setup);
  const setupSha256 = sha256File(setupPath);
  const trust = inspect({
    binaryPath: setupPath,
    certificateSha256,
    platform,
    requireTimestamp: true,
    signatureOnly: false,
    signToolPath,
    version,
  });
  if (trust.fileSha256 !== setupSha256) {
    throw new Error("Windows public candidate trust digest does not bind the final setup bytes");
  }
  return { setup, setupSha256, updaterSignature };
}

export function buildWindowsPublicCandidate({
  architecture = process.arch,
  arguments_ = process.argv.slice(2),
  build = buildProductionPackage,
  configuration,
  environment = process.env,
  isFile,
  platform = process.platform,
  releaseDirectory = defaultReleaseDirectory,
  verifyOutputs = verifyWindowsPublicCandidateOutputs,
} = {}) {
  validateWindowsPackageConfiguration(
    JSON.parse(readFileSync(path.join(repositoryRoot, "src-tauri/tauri.windows.conf.json"), "utf8")),
    packageVersion,
  );
  validateWindowsPublicSigningOverlay(
    JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "src-tauri/tauri.windows.public-signing.conf.json"),
        "utf8",
      ),
    ),
  );
  const updateConfiguration = configuration
    ?? loadPublicUpdateConfiguration(repositoryRoot);
  const publicUpdateEnvironment = publicUpdateBuildEnvironment(updateConfiguration, true);
  assertUpdaterSigningAuthority(environment);
  const authority = windowsAuthenticodeAuthority({
    environment,
    ...(isFile ? { isFile } : {}),
    platform,
  });
  if (authority.profile !== "public" || !authority.requireTimestamp) {
    throw new Error("the Windows public candidate requires public timestamped Authenticode authority");
  }
  const buildArguments = windowsPublicCandidateBuildArguments(
    arguments_,
    platform,
    architecture,
  );

  rmSync(releaseDirectory, { force: true, recursive: true });
  try {
    build({
      arguments_: buildArguments,
      publicUpdateEnvironment,
    });
    return verifyOutputs({
      architecture,
      certificateSha256: authority.certificateSha256,
      platform,
      releaseDirectory,
      signToolPath: authority.signToolPath,
      version: packageVersion,
    });
  } catch (error) {
    rmSync(releaseDirectory, { force: true, recursive: true });
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(buildWindowsPublicCandidate())}\n`);
  } catch (error) {
    process.stderr.write(`Windows public candidate build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
