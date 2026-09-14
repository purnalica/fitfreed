import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProductionPackage,
  bundleProductionPackage,
} from "./build-production.mjs";
import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { npmCliInvocation } from "./node-package-script.mjs";
import { assertCleanRevision } from "./prepare-development-release.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";
import { sha256File } from "./release-evidence.mjs";
import { inspectWindowsAuthenticode } from "./windows-authenticode-trust.mjs";
import {
  expectedWindowsNsisArtifactName,
  validateWindowsPackageConfiguration,
  validateWindowsPublicSigningOverlay,
  windowsPackageContract,
} from "./windows-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;
const defaultReleaseExecutable = path.join(
  repositoryRoot,
  "src-tauri",
  "target",
  "release",
  windowsPackageContract.executable,
);
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
const localAuthenticodeAuthorityNames = [
  "FITFREED_WINDOWS_AUTHENTICODE_PROFILE",
  "FITFREED_WINDOWS_CERTIFICATE_BASE64",
  "FITFREED_WINDOWS_CERTIFICATE_PASSWORD",
  "FITFREED_WINDOWS_CERTIFICATE_SHA1",
  "FITFREED_WINDOWS_TIMESTAMP_URL",
];
const certificateSha256Pattern = /^[0-9a-f]{64}$/;

function requireWindows(platform, architecture) {
  if (platform !== "win32") throw new Error("SignPath Windows packaging requires Windows");
  if (architecture !== "x64") {
    throw new Error("SignPath Windows packaging requires x86-64 Windows");
  }
}

function requireRegularSinglyLinkedFile(filePath, message) {
  if (!existsSync(filePath)) throw new Error(message);
  const metadata = lstatSync(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 1) {
    throw new Error(message);
  }
}

function requireCertificateSha256(certificateSha256) {
  if (!certificateSha256Pattern.test(certificateSha256 ?? "")) {
    throw new Error("SignPath requires one lowercase SHA-256 certificate fingerprint");
  }
}

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function validateConfiguration() {
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
}

function assertVersion(version) {
  inspectReleaseContracts(repositoryRoot, version);
  if (version !== packageVersion) throw new Error("SignPath packaging version differs from source");
}

function exactDirectoryFiles(directory, expectedNames, message) {
  if (!existsSync(directory) || !lstatSync(directory).isDirectory()) throw new Error(message);
  const entries = readdirSync(directory, { withFileTypes: true });
  const actualNames = entries.map(({ name }) => name).sort(byteOrder);
  const sortedExpected = [...expectedNames].sort(byteOrder);
  if (
    entries.some((entry) => !entry.isFile())
    || JSON.stringify(actualNames) !== JSON.stringify(sortedExpected)
  ) {
    throw new Error(message);
  }
  for (const name of sortedExpected) {
    requireRegularSinglyLinkedFile(path.join(directory, name), message);
  }
  return sortedExpected;
}

function publicUpdateEnvironment(configuration) {
  return publicUpdateBuildEnvironment(configuration, true);
}

function atomicDirectory(destination, operation) {
  const output = path.resolve(destination);
  if (existsSync(output)) throw new Error("SignPath packaging output already exists");
  mkdirSync(path.dirname(output), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(output), `.${path.basename(output)}.tmp-`));
  try {
    const result = operation(staging);
    renameSync(staging, output);
    return result;
  } catch (error) {
    rmSync(staging, { force: true, recursive: true });
    throw error;
  }
}

function runNpm(arguments_, environment = process.env) {
  const invocation = npmCliInvocation(
    arguments_,
    process.platform,
    environment.npm_execpath,
    process.execPath,
  );
  execFileSync(invocation.program, invocation.arguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
}

export function assertWindowsExpansionAuthoritySeparation(environment) {
  if (updaterAuthorityNames.some((name) => Object.hasOwn(environment, name))) {
    throw new Error("the Windows expansion builder must not receive updater signing authority");
  }
  if (localAuthenticodeAuthorityNames.some((name) => Object.hasOwn(environment, name))) {
    throw new Error("the SignPath build must not receive local Authenticode authority");
  }
  if (Object.hasOwn(environment, "FITFREED_SIGNPATH_API_TOKEN")) {
    throw new Error("packaging commands must not receive SignPath request authority");
  }
}

export function windowsSignPathBundleArguments(
  platform = process.platform,
  architecture = process.arch,
) {
  requireWindows(platform, architecture);
  return [
    "--config",
    "src-tauri/tauri.windows.public-signing.conf.json",
    "--bundles",
    windowsPackageContract.target,
    "--ci",
  ];
}

export function findWindowsSignTool({
  architecture = process.arch,
  environment = process.env,
  platform = process.platform,
} = {}) {
  requireWindows(platform, architecture);
  const candidates = [];
  if (typeof environment.WindowsSdkVerBinPath === "string") {
    candidates.push(path.join(environment.WindowsSdkVerBinPath, "x64", "signtool.exe"));
  }
  const programFiles = environment["ProgramFiles(x86)"];
  if (typeof programFiles === "string") {
    const kitsRoot = path.join(programFiles, "Windows Kits", "10", "bin");
    if (existsSync(kitsRoot) && lstatSync(kitsRoot).isDirectory()) {
      const versions = readdirSync(kitsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map(({ name }) => name)
        .sort((left, right) => right.localeCompare(left, "en"));
      for (const version of versions) {
        candidates.push(path.join(kitsRoot, version, "x64", "signtool.exe"));
      }
    }
  }
  for (const candidate of candidates) {
    try {
      requireRegularSinglyLinkedFile(candidate, "Windows SDK SignTool is unavailable");
      return path.resolve(candidate);
    } catch {
      // Continue through the bounded SDK candidates.
    }
  }
  throw new Error("Windows SDK SignTool is unavailable");
}

export function validateWindowsSignPathUnsignedInner(directory) {
  exactDirectoryFiles(
    path.resolve(directory),
    [windowsPackageContract.executable, windowsPackageContract.uninstaller],
    "SignPath inner artifact must contain exactly the application and uninstaller",
  );
  return {
    applicationSha256: sha256File(path.join(directory, windowsPackageContract.executable)),
    profile: "signpath-unsigned-inner",
    uninstallerSha256: sha256File(path.join(directory, windowsPackageContract.uninstaller)),
  };
}

export function validateWindowsSignPathInner({
  certificateSha256,
  directory,
  inspect = inspectWindowsAuthenticode,
  platform = process.platform,
  signToolPath,
  version,
}) {
  requireWindows(platform, "x64");
  requireCertificateSha256(certificateSha256);
  const unsignedShape = validateWindowsSignPathUnsignedInner(directory);
  const applicationPath = path.join(directory, windowsPackageContract.executable);
  const uninstallerPath = path.join(directory, windowsPackageContract.uninstaller);
  const application = inspect({
    binaryPath: applicationPath,
    certificateSha256,
    platform,
    requireTimestamp: true,
    signatureOnly: false,
    signToolPath,
    version,
  });
  const uninstaller = inspect({
    binaryPath: uninstallerPath,
    certificateSha256,
    platform,
    requireTimestamp: true,
    signatureOnly: true,
    signToolPath,
    version,
  });
  if (
    application.fileSha256 !== unsignedShape.applicationSha256
    || uninstaller.fileSha256 !== unsignedShape.uninstallerSha256
    || application.certificateSha256 !== certificateSha256
    || uninstaller.certificateSha256 !== certificateSha256
    || application.timestamped !== true
    || uninstaller.timestamped !== true
  ) {
    throw new Error("SignPath inner trust does not bind the returned bytes");
  }
  return {
    applicationSha256: application.fileSha256,
    certificateSha256,
    profile: "signpath-signed-inner",
    uninstallerSha256: uninstaller.fileSha256,
  };
}

export function prepareWindowsSignPathInner({
  architecture = process.arch,
  assertSource = assertCleanRevision,
  audit = () => runNpm(["run", "audit:dependencies"]),
  build = buildProductionPackage,
  bundle = bundleProductionPackage,
  configuration,
  environment = process.env,
  outputDirectory,
  platform = process.platform,
  releaseDirectory = defaultReleaseDirectory,
  releaseExecutable = defaultReleaseExecutable,
  validateRelease = assertVersion,
  version,
}) {
  requireWindows(platform, architecture);
  assertWindowsExpansionAuthoritySeparation(environment);
  validateRelease(version);
  validateConfiguration();
  assertSource();
  const updateConfiguration = configuration ?? loadPublicUpdateConfiguration(repositoryRoot);
  const updateEnvironment = publicUpdateEnvironment(updateConfiguration);
  audit();
  rmSync(releaseDirectory, { force: true, recursive: true });
  try {
    build({
      arguments_: ["--no-bundle", "--no-sign", "--ci"],
      publicUpdateEnvironment: updateEnvironment,
    });
    requireRegularSinglyLinkedFile(
      releaseExecutable,
      "unsigned FitFreed application is unavailable",
    );
    return atomicDirectory(outputDirectory, (staging) => {
      copyFileSync(
        releaseExecutable,
        path.join(staging, windowsPackageContract.executable),
      );
      bundle({
        additionalEnvironment: {
          FITFREED_SIGNPATH_BRIDGE_MODE: "capture-uninstaller",
          FITFREED_SIGNPATH_INNER_DIRECTORY: staging,
          FITFREED_SIGNPATH_VERSION: version,
        },
        arguments_: windowsSignPathBundleArguments(platform, architecture),
        publicUpdateEnvironment: updateEnvironment,
      });
      const result = validateWindowsSignPathUnsignedInner(staging);
      rmSync(releaseDirectory, { force: true, recursive: true });
      return result;
    });
  } catch (error) {
    rmSync(releaseDirectory, { force: true, recursive: true });
    throw error;
  }
}

export function prepareWindowsSignPathSetup({
  architecture = process.arch,
  assertSource = assertCleanRevision,
  bundle = bundleProductionPackage,
  certificateSha256,
  environment = process.env,
  inspect = inspectWindowsAuthenticode,
  outputDirectory,
  platform = process.platform,
  releaseDirectory = defaultReleaseDirectory,
  releaseExecutable = defaultReleaseExecutable,
  signedInnerDirectory,
  signToolPath,
  unsignedInnerDirectory,
  validateRelease = assertVersion,
  version,
}) {
  requireWindows(platform, architecture);
  assertWindowsExpansionAuthoritySeparation(environment);
  validateRelease(version);
  validateConfiguration();
  assertSource();
  const updateConfiguration = loadPublicUpdateConfiguration(repositoryRoot);
  const updateEnvironment = publicUpdateEnvironment(updateConfiguration);
  const resolvedSignToolPath = signToolPath ?? findWindowsSignTool({
    architecture,
    environment,
    platform,
  });
  const unsigned = validateWindowsSignPathUnsignedInner(unsignedInnerDirectory);
  requireRegularSinglyLinkedFile(
    releaseExecutable,
    "unsigned FitFreed application is unavailable",
  );
  if (sha256File(releaseExecutable) !== unsigned.applicationSha256) {
    throw new Error("unsigned application no longer matches the SignPath request");
  }
  const signed = validateWindowsSignPathInner({
    certificateSha256,
    directory: signedInnerDirectory,
    inspect,
    platform,
    signToolPath: resolvedSignToolPath,
    version,
  });
  copyFileSync(
    path.join(signedInnerDirectory, windowsPackageContract.executable),
    releaseExecutable,
  );
  if (sha256File(releaseExecutable) !== signed.applicationSha256) {
    throw new Error("signed application was not installed into the packaging input");
  }
  rmSync(releaseDirectory, { force: true, recursive: true });
  try {
    return atomicDirectory(outputDirectory, (staging) => {
      bundle({
        additionalEnvironment: {
          FITFREED_SIGNPATH_BRIDGE_MODE: "inject-signed-inner",
          FITFREED_SIGNPATH_INNER_DIRECTORY: path.resolve(signedInnerDirectory),
          FITFREED_SIGNPATH_VERSION: version,
        },
        arguments_: windowsSignPathBundleArguments(platform, architecture),
        publicUpdateEnvironment: updateEnvironment,
      });
      const setupName = expectedWindowsNsisArtifactName(version);
      exactDirectoryFiles(
        releaseDirectory,
        [setupName],
        "SignPath setup stage must produce exactly one unsigned setup",
      );
      copyFileSync(path.join(releaseDirectory, setupName), path.join(staging, setupName));
      exactDirectoryFiles(
        staging,
        [setupName],
        "SignPath setup artifact must contain exactly one setup",
      );
      return {
        profile: "signpath-unsigned-setup",
        setup: setupName,
        setupSha256: sha256File(path.join(staging, setupName)),
      };
    });
  } catch (error) {
    rmSync(releaseDirectory, { force: true, recursive: true });
    throw error;
  }
}

function main() {
  const [operation, version, ...arguments_] = process.argv.slice(2);
  if (operation === "inner" && arguments_.length === 1) {
    return prepareWindowsSignPathInner({ outputDirectory: arguments_[0], version });
  }
  if (operation === "setup" && arguments_.length === 3) {
    const [unsignedInnerDirectory, signedInnerDirectory, outputDirectory] = arguments_;
    const certificateSha256 = process.env.FITFREED_WINDOWS_CERTIFICATE_SHA256;
    return prepareWindowsSignPathSetup({
      certificateSha256,
      outputDirectory,
      signedInnerDirectory,
      unsignedInnerDirectory,
      version,
    });
  }
  throw new Error(
    "usage: node scripts/build-windows-expansion-input.mjs <inner version output-directory|setup version unsigned-inner signed-inner output-directory>",
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(main())}\n`);
  } catch (error) {
    process.stderr.write(`Windows SignPath packaging failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
