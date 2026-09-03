import {
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionPackage } from "./build-production.mjs";
import { windowsPackageBuildArguments } from "./build-windows-package.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";
import { sha256File } from "./release-evidence.mjs";
import { windowsAuthenticodeAuthority } from "./windows-authenticode-sign.mjs";
import { inspectWindowsAuthenticode } from "./windows-authenticode-trust.mjs";
import {
  expectedWindowsNsisArtifactName,
  validateWindowsPackageConfiguration,
  validateWindowsPublicSigningOverlay,
} from "./windows-package-contract.mjs";

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
const updaterAuthorityNames = [
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PATH",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
];

export function assertWindowsExpansionAuthoritySeparation(environment) {
  if (updaterAuthorityNames.some((name) => Object.hasOwn(environment, name))) {
    throw new Error("the Windows expansion builder must not receive updater signing authority");
  }
}

export function windowsExpansionInputBuildArguments(
  arguments_ = [],
  platform = process.platform,
  architecture = process.arch,
) {
  return [
    "--config",
    "src-tauri/tauri.windows.public-signing.conf.json",
    ...windowsPackageBuildArguments(arguments_, platform, architecture),
  ];
}

export function verifyWindowsExpansionBuildOutput({
  architecture = process.arch,
  certificateSha256,
  inspect = inspectWindowsAuthenticode,
  platform = process.platform,
  releaseDirectory = defaultReleaseDirectory,
  signToolPath,
  version = packageVersion,
}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows expansion input verification requires x86-64 Windows");
  }
  const setup = expectedWindowsNsisArtifactName(version);
  const entries = readdirSync(releaseDirectory);
  if (entries.length !== 1 || entries[0] !== setup) {
    throw new Error("Windows expansion build must contain only the exact setup");
  }
  const setupPath = path.join(releaseDirectory, setup);
  const metadata = lstatSync(setupPath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 1) {
    throw new Error("Windows expansion setup must be a non-empty regular singly linked file");
  }
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
    throw new Error("Windows expansion trust digest does not bind the final setup bytes");
  }
  return { setup, setupSha256 };
}

export function buildWindowsExpansionInput({
  architecture = process.arch,
  arguments_ = process.argv.slice(2),
  build = buildProductionPackage,
  configuration,
  environment = process.env,
  isFile,
  platform = process.platform,
  releaseDirectory = defaultReleaseDirectory,
  verifyOutput = verifyWindowsExpansionBuildOutput,
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
  assertWindowsExpansionAuthoritySeparation(environment);
  const updateConfiguration = configuration
    ?? loadPublicUpdateConfiguration(repositoryRoot);
  const publicUpdateEnvironment = publicUpdateBuildEnvironment(updateConfiguration, true);
  const authority = windowsAuthenticodeAuthority({
    environment,
    ...(isFile ? { isFile } : {}),
    platform,
  });
  if (authority.profile !== "public" || !authority.requireTimestamp) {
    throw new Error("the Windows expansion input requires public timestamped Authenticode authority");
  }
  const buildArguments = windowsExpansionInputBuildArguments(
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
    return verifyOutput({
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
    process.stdout.write(`${JSON.stringify(buildWindowsExpansionInput())}\n`);
  } catch (error) {
    process.stderr.write(`Windows expansion input build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
