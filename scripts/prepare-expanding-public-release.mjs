import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { composeLinuxExpansionCandidate } from "./expanding-public-release-composition.mjs";
import { renderLinuxExpansionReleaseNotes } from "./expanding-public-release-evidence.mjs";
import { inspectPublicMacosTrust } from "./macos-public-trust.mjs";
import {
  assertCleanRevision,
  copyUpgradeMatrix,
  createCargoSboms,
  createNpmSbom,
  generatedAt,
  generatorVersions,
  readStorageSchemaVersion,
  scanStagedEvidence,
} from "./prepare-development-release.mjs";
import { verifyLinuxExpansionInput } from "./prepare-linux-expansion-input.mjs";
import {
  assertPublicSigningEnvironment,
  outsideRepositoryFile,
  publicArtifactNames,
  publicChannelTimes,
} from "./prepare-public-release.mjs";
import { loadPublicReleasePolicy } from "./public-release-policy.mjs";
import {
  assertIndependentPublicSigningKeys,
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { decodeTauriSignatureText } from "./release-signature.mjs";
import { inspectUpgradeMatrix } from "./upgrade-matrix.mjs";
import { nodePackageScriptPath } from "./node-package-script.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function run(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...options.environment },
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  })?.trim();
}

export function assertExpansionSigningEnvironment(
  environment,
  repositoryPath = repositoryRoot,
) {
  const macos = assertPublicSigningEnvironment(environment, repositoryPath);
  const releaseKeyPath = outsideRepositoryFile(
    environment.FITFREED_RELEASE_PRIVATE_KEY_PATH,
    repositoryPath,
    "release checksum private key",
  );
  if (
    typeof environment.FITFREED_RELEASE_PRIVATE_KEY_PASSWORD !== "string"
    || environment.FITFREED_RELEASE_PRIVATE_KEY_PASSWORD.length === 0
  ) {
    throw new Error("release checksum private-key password is unavailable");
  }
  if (releaseKeyPath === macos.updaterKeyPath) {
    throw new Error("release checksum and updater private keys must be distinct");
  }
  return { ...macos, releaseKeyPath };
}

export function assertExpandingPublicReleaseOutput(outputDirectory, outputRoot, version) {
  const resolvedOutput = path.resolve(outputDirectory);
  const expectedOutput = path.resolve(outputRoot, version);
  if (resolvedOutput !== expectedOutput) {
    throw new Error("expanding public release output must be the exact version directory");
  }
  return resolvedOutput;
}

function assertReleaseSigningTrust(configuration, releaseKeyId) {
  const validated = validatePublicReleaseSigningConfiguration(configuration);
  if (
    validated.schemaVersion !== 2
    || validated.status !== "active"
    || validated.purpose !== "public-release-checksums"
  ) {
    throw new Error("platform-neutral public release-signing trust is inactive");
  }
  if (!validated.keys.some(({ id }) => id === releaseKeyId)) {
    throw new Error("release checksum signing key is outside the active trust set");
  }
  return validated;
}

export { assertIndependentPublicSigningKeys as assertIndependentExpansionSigningTrust };

function signWithTauri(bytes, filename, keyPath, password) {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-public-signing-"));
  const payloadPath = path.join(directory, filename);
  const signaturePath = `${payloadPath}.sig`;
  try {
    writeFileSync(payloadPath, bytes, { mode: 0o600 });
    run(process.execPath, [
      nodePackageScriptPath("@tauri-apps/cli", "tauri"),
      "signer",
      "sign",
      payloadPath,
    ], {
      capture: true,
      environment: {
        TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password,
      },
    });
    if (!existsSync(signaturePath)) throw new Error("detached signature is unavailable");
    return readFileSync(signaturePath, "utf8").trim();
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function buildMacosCandidate(version) {
  const bundleRoot = path.join(repositoryRoot, "src-tauri/target/release/bundle");
  rmSync(bundleRoot, { force: true, recursive: true });
  run("npm", ["run", "package:public-candidate"]);
  run("npm", ["run", "check:production-bundle"]);
  const names = publicArtifactNames(version);
  const macos = {
    applicationPath: path.join(bundleRoot, "macos/FitFreed.app"),
    diskImagePath: path.join(bundleRoot, "dmg", names.diskImage),
    updaterArchivePath: path.join(bundleRoot, "macos/FitFreed.app.tar.gz"),
    updaterSignaturePath: path.join(bundleRoot, "macos/FitFreed.app.tar.gz.sig"),
  };
  for (const [label, artifactPath] of Object.entries(macos)) {
    if (!existsSync(artifactPath)) throw new Error(`macOS public build has no ${label}`);
  }
  return macos;
}

export function prepareExpandingPublicRelease({
  environment = process.env,
  issuedAt,
  linuxInputDirectory,
  outputDirectory,
  releaseKeyId,
  updateKeyId,
  version,
}) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("expanding public release preparation requires Apple Silicon macOS");
  }
  const releaseContracts = inspectReleaseContracts(repositoryRoot, version);
  const allowedOutputRoot = path.join(repositoryRoot, ".artifacts", "public-releases");
  const resolvedOutputDirectory = assertExpandingPublicReleaseOutput(
    outputDirectory,
    allowedOutputRoot,
    version,
  );
  if (existsSync(resolvedOutputDirectory)) {
    throw new Error("expanding public candidate already exists");
  }
  const upgradeMatrix = inspectUpgradeMatrix(repositoryRoot);
  const policyDocument = loadPublicReleasePolicy(repositoryRoot, version, upgradeMatrix);
  const updateConfiguration = loadPublicUpdateConfiguration(repositoryRoot);
  if (
    updateConfiguration.schemaVersion !== 2
    || updateConfiguration.status !== "active"
    || updateConfiguration.contract !== "stable-v3"
  ) {
    throw new Error("recoverable stable-v3 public update trust is inactive");
  }
  const releaseSigningConfiguration = assertReleaseSigningTrust(
    loadPublicReleaseSigningConfiguration(repositoryRoot),
    releaseKeyId,
  );
  assertIndependentPublicSigningKeys({
    releaseKeyId,
    releaseSigningConfiguration,
    updateConfiguration,
    updateKeyId,
  });
  const signing = assertExpansionSigningEnvironment(environment);
  const times = publicChannelTimes(issuedAt);
  const source = assertCleanRevision();
  const storageSchemaVersion = readStorageSchemaVersion();
  verifyLinuxExpansionInput({
    directory: linuxInputDirectory,
    revision: source.revision,
    storageSchemaVersion,
    version,
  });
  const evidenceDirectory = path.join(
    repositoryRoot,
    ".artifacts",
    `.expanding-release-evidence-${process.pid}`,
  );
  rmSync(evidenceDirectory, { force: true, recursive: true });
  mkdirSync(evidenceDirectory, { recursive: true });
  try {
    run("npm", ["run", "audit:dependencies"]);
    const macos = buildMacosCandidate(version);
    const trust = inspectPublicMacosTrust({
      applicationPath: macos.applicationPath,
      diskImagePath: macos.diskImagePath,
      expectedTeamIdentifier: signing.expectedTeamIdentifier,
      expectedVersion: version,
    });
    const npmSbom = createNpmSbom(evidenceDirectory, repositoryRoot);
    const cargoSboms = createCargoSboms(
      evidenceDirectory,
      repositoryRoot,
      source.sourceDateEpoch,
    );
    const matrixName = copyUpgradeMatrix(evidenceDirectory);
    writeFileSync(
      path.join(evidenceDirectory, "RELEASE_NOTES.md"),
      renderLinuxExpansionReleaseNotes({
        revision: source.revision,
        storageSchemaVersion,
        version,
      }, readFileSync(path.join(repositoryRoot, releaseContracts.releaseNotesSource), "utf8")),
    );
    const updaterKeyPath = signing.updaterKeyPath;
    const updaterPassword = environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
    const releasePassword = environment.FITFREED_RELEASE_PRIVATE_KEY_PASSWORD;
    const result = composeLinuxExpansionCandidate({
      candidateDirectory: resolvedOutputDirectory,
      copyMacosApplication: (source, destination) => {
        run("ditto", [source, destination]);
      },
      generatedAt: generatedAt(source.sourceDateEpoch),
      generators: {
        ...generatorVersions(),
        linuxBuildEvidence: "1",
        linuxPackageInventory: "1",
      },
      linuxInputDirectory,
      macos,
      macosTrust: {
        certificateSha256: trust.certificateSha256,
        teamIdentifier: trust.teamIdentifier,
      },
      policy: policyDocument.update,
      releaseKeyId,
      releaseNotesPath: path.join(evidenceDirectory, "RELEASE_NOTES.md"),
      releaseSigningConfiguration,
      revision: source.revision,
      sbomPaths: [npmSbom, ...cargoSboms].map((name) => path.join(evidenceDirectory, name)),
      signLinuxPackage: (bytes, filename) => signWithTauri(
        bytes,
        filename,
        updaterKeyPath,
        updaterPassword,
      ),
      signReleaseChecksums: (bytes) => decodeTauriSignatureText(signWithTauri(
        bytes,
        "SHA256SUMS",
        signing.releaseKeyPath,
        releasePassword,
      )),
      signUpdatePayload: (bytes) => signWithTauri(
        bytes,
        "stable-payload.json",
        updaterKeyPath,
        updaterPassword,
      ),
      storageSchemaVersion,
      times,
      updateConfiguration,
      updateKeyId,
      updateSequence: policyDocument.update.sequence,
      upgradeMatrixPath: path.join(evidenceDirectory, matrixName),
      version,
    });
    scanStagedEvidence(resolvedOutputDirectory);
    return result;
  } catch (error) {
    rmSync(resolvedOutputDirectory, { force: true, recursive: true });
    throw error;
  } finally {
    rmSync(evidenceDirectory, { force: true, recursive: true });
  }
}

function main() {
  const [version, updateKeyId, releaseKeyId, issuedAt, linuxInputDirectory] =
    process.argv.slice(2);
  if (!version || !updateKeyId || !releaseKeyId || !issuedAt || !linuxInputDirectory) {
    throw new Error(
      "usage: node scripts/prepare-expanding-public-release.mjs <version> <update-key-id> <release-key-id> <issued-at> <linux-input-directory>",
    );
  }
  const outputDirectory = path.join(repositoryRoot, ".artifacts/public-releases", version);
  process.stdout.write(`${JSON.stringify(prepareExpandingPublicRelease({
    environment: process.env,
    issuedAt,
    linuxInputDirectory,
    outputDirectory,
    releaseKeyId,
    updateKeyId,
    version,
  }))}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Expanding public release preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
