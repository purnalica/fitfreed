import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { composeCompletePlatformCandidate } from "./complete-platform-release-composition.mjs";
import { renderCompletePlatformReleaseNotes } from "./complete-platform-release-evidence.mjs";
import { discoverCompletePlatformRecoveryPackages } from "./complete-platform-recovery-discovery.mjs";
import { finalizePublicMacosDiskImage } from "./finalize-public-macos-disk-image.mjs";
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
import { assertExpansionSigningEnvironment } from "./prepare-expanding-public-release.mjs";
import { publicChannelTimes } from "./prepare-public-release.mjs";
import { verifyWindowsExpansionInput } from "./prepare-windows-expansion-input.mjs";
import { loadPublicReleasePolicy } from "./public-release-policy.mjs";
import {
  assertIndependentPublicSigningKeys,
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { decodeTauriSignatureText } from "./release-signature.mjs";
import { signBytesWithTauri } from "./tauri-detached-signature.mjs";
import { loadUpgradeMatrix } from "./upgrade-matrix.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const windowsCertificateSha256Pattern = /^[0-9a-f]{64}$/;

function run(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...options.environment },
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  })?.trim();
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

function buildMacosCandidate(version, updateKeyId) {
  const bundleRoot = path.join(repositoryRoot, "src-tauri/target/release/bundle");
  rmSync(bundleRoot, { force: true, recursive: true });
  run("npm", ["run", "package:public-candidate"], {
    environment: { FITFREED_UPDATE_KEY_ID: updateKeyId },
  });
  run("npm", ["run", "check:production-bundle"]);
  const macos = {
    applicationPath: path.join(bundleRoot, "macos/FitFreed.app"),
    diskImagePath: path.join(bundleRoot, "dmg", `FitFreed_${version}_aarch64.dmg`),
    updaterArchivePath: path.join(bundleRoot, "macos/FitFreed.app.tar.gz"),
    updaterSignaturePath: path.join(bundleRoot, "macos/FitFreed.app.tar.gz.sig"),
  };
  for (const [label, artifactPath] of Object.entries(macos)) {
    if (!existsSync(artifactPath)) throw new Error(`macOS public build has no ${label}`);
  }
  return macos;
}

function copyMacosApplication(source, destination) {
  run("ditto", [source, destination]);
}

const defaultOperations = Object.freeze({
  assertCleanRevision,
  assertSigningEnvironment: assertExpansionSigningEnvironment,
  buildMacosCandidate,
  composeCompletePlatformCandidate,
  copyMacosApplication,
  copyUpgradeMatrix,
  createCargoSboms,
  createNpmSbom,
  discoverRecoveryPackages: discoverCompletePlatformRecoveryPackages,
  finalizeMacosDiskImage: finalizePublicMacosDiskImage,
  generatedAt,
  generatorVersions,
  inspectMacosTrust: inspectPublicMacosTrust,
  inspectReleaseContracts,
  loadUpgradeMatrix,
  loadReleasePolicy: loadPublicReleasePolicy,
  loadReleaseSigningConfiguration: loadPublicReleaseSigningConfiguration,
  loadUpdateConfiguration: loadPublicUpdateConfiguration,
  publicChannelTimes,
  readStorageSchemaVersion,
  renderReleaseNotes: renderCompletePlatformReleaseNotes,
  runDependencyAudit() {
    run("npm", ["run", "audit:dependencies"]);
  },
  scanStagedEvidence,
  verifyLinuxInput: verifyLinuxExpansionInput,
  verifyWindowsInput: verifyWindowsExpansionInput,
});

export function assertCompletePlatformPublicReleaseOutput(
  outputDirectory,
  outputRoot,
  version,
) {
  const resolvedOutput = path.resolve(outputDirectory);
  if (resolvedOutput !== path.resolve(outputRoot, version)) {
    throw new Error("complete-platform public release output must be the exact version directory");
  }
  return resolvedOutput;
}

export function assertCompletePlatformCertificateSha256(candidate) {
  if (!windowsCertificateSha256Pattern.test(candidate ?? "")) {
    throw new Error("Windows certificate SHA-256 fingerprint must be 64 lowercase hex characters");
  }
  return candidate;
}

export function prepareCompletePlatformRelease(input, operations = defaultOperations) {
  const {
    environment = process.env,
    issuedAt,
    linuxInputDirectory,
    outputDirectory,
    predecessorEvidenceDirectory,
    releaseKeyId,
    repositoryPath = repositoryRoot,
    runtime = process,
    updateKeyId,
    version,
    windowsCertificateSha256: certificateInput,
    windowsInputDirectory,
    windowsTrustProfile = "public-authenticode",
  } = input;
  if (runtime.platform !== "darwin" || runtime.arch !== "arm64") {
    throw new Error("complete-platform release preparation requires Apple Silicon macOS");
  }
  const releaseContracts = operations.inspectReleaseContracts(repositoryPath, version);
  const outputRoot = path.join(repositoryPath, ".artifacts", "public-releases");
  const resolvedOutputDirectory = assertCompletePlatformPublicReleaseOutput(
    outputDirectory,
    outputRoot,
    version,
  );
  if (existsSync(resolvedOutputDirectory)) {
    throw new Error("complete-platform public candidate already exists");
  }
  const windowsCertificateSha256 = windowsTrustProfile === "public-authenticode"
    ? assertCompletePlatformCertificateSha256(certificateInput)
    : undefined;
  if (!["public-authenticode", "public-unsigned-preview"].includes(windowsTrustProfile)) {
    throw new Error("unsupported Windows public trust profile");
  }
  const upgradeMatrix = operations.loadUpgradeMatrix(repositoryPath);
  const policyDocument = operations.loadReleasePolicy(
    repositoryPath,
    version,
    upgradeMatrix.summary,
  );
  const updateConfiguration = operations.loadUpdateConfiguration(repositoryPath);
  if (
    updateConfiguration.schemaVersion !== 2
    || updateConfiguration.status !== "active"
    || updateConfiguration.contract !== "stable-v3"
  ) {
    throw new Error("recoverable stable-v3 public update trust is inactive");
  }
  const releaseSigningConfiguration = assertReleaseSigningTrust(
    operations.loadReleaseSigningConfiguration(repositoryPath),
    releaseKeyId,
  );
  assertIndependentPublicSigningKeys({
    releaseKeyId,
    releaseSigningConfiguration,
    updateConfiguration,
    updateKeyId,
  });
  const signing = operations.assertSigningEnvironment(environment, repositoryPath);
  const times = operations.publicChannelTimes(issuedAt);
  const source = operations.assertCleanRevision();
  const storageSchemaVersion = operations.readStorageSchemaVersion();
  operations.verifyLinuxInput({
    directory: linuxInputDirectory,
    revision: source.revision,
    storageSchemaVersion,
    version,
  });
  operations.verifyWindowsInput({
    authenticodeCertificateSha256: windowsCertificateSha256,
    directory: windowsInputDirectory,
    revision: source.revision,
    storageSchemaVersion,
    trustProfile: windowsTrustProfile,
    updateConfiguration,
    version,
  });
  const { recoveryPackages } = operations.discoverRecoveryPackages({
    evidenceDirectory: predecessorEvidenceDirectory,
    publicReleaseSigningConfiguration: releaseSigningConfiguration,
    publicUpdateConfiguration: updateConfiguration,
    upgradeMatrix: upgradeMatrix.document,
  });
  const evidenceDirectory = path.join(
    repositoryPath,
    ".artifacts",
    `.complete-release-evidence-${process.pid}`,
  );
  rmSync(evidenceDirectory, { force: true, recursive: true });
  mkdirSync(evidenceDirectory, { recursive: true });
  let candidateCreated = false;
  try {
    operations.runDependencyAudit();
    const macos = operations.buildMacosCandidate(version, updateKeyId);
    operations.finalizeMacosDiskImage({
      diskImagePath: macos.diskImagePath,
      environment,
      signing,
    });
    const macosTrust = operations.inspectMacosTrust({
      applicationPath: macos.applicationPath,
      diskImagePath: macos.diskImagePath,
      expectedTeamIdentifier: signing.expectedTeamIdentifier,
      expectedVersion: version,
    });
    const npmSbom = operations.createNpmSbom(evidenceDirectory, repositoryPath);
    const cargoSboms = operations.createCargoSboms(
      evidenceDirectory,
      repositoryPath,
      source.sourceDateEpoch,
    );
    const matrixName = operations.copyUpgradeMatrix(evidenceDirectory);
    const releaseNotesPath = path.join(evidenceDirectory, "RELEASE_NOTES.md");
    writeFileSync(
      releaseNotesPath,
      operations.renderReleaseNotes({
        revision: source.revision,
        storageSchemaVersion,
        version,
        windowsTrustProfile,
      }, readFileSync(
        path.join(repositoryPath, releaseContracts.releaseNotesSource),
        "utf8",
      )),
    );
    const updaterPassword = environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
    const releasePassword = environment.FITFREED_RELEASE_PRIVATE_KEY_PASSWORD;
    const result = operations.composeCompletePlatformCandidate({
      candidateDirectory: resolvedOutputDirectory,
      copyMacosApplication: operations.copyMacosApplication,
      generatedAt: operations.generatedAt(source.sourceDateEpoch),
      generators: {
        ...operations.generatorVersions(),
        linuxBuildEvidence: "1",
        linuxPackageInventory: "1",
        windowsBuildEvidence: windowsTrustProfile === "public-unsigned-preview" ? "2" : "1",
        windowsPackageInventory: windowsTrustProfile === "public-unsigned-preview" ? "2" : "1",
      },
      linuxInputDirectory,
      macos,
      macosTrust: {
        certificateSha256: macosTrust.certificateSha256,
        teamIdentifier: macosTrust.teamIdentifier,
      },
      policy: policyDocument.update,
      recoveryPackages,
      releaseKeyId,
      releaseNotesPath,
      releaseSigningConfiguration,
      revision: source.revision,
      sbomPaths: [npmSbom, ...cargoSboms].map((name) =>
        path.join(evidenceDirectory, name)),
      signLinuxPackage: (bytes, filename) => signBytesWithTauri({
        bytes,
        filename,
        keyPath: signing.updaterKeyPath,
        password: updaterPassword,
      }),
      signReleaseChecksums: (bytes) => decodeTauriSignatureText(signBytesWithTauri({
        bytes,
        filename: "SHA256SUMS",
        keyPath: signing.releaseKeyPath,
        password: releasePassword,
      })),
      signUpdatePayload: (bytes) => signBytesWithTauri({
        bytes,
        filename: "stable-payload.json",
        keyPath: signing.updaterKeyPath,
        password: updaterPassword,
      }),
      signWindowsPackage: (bytes, filename) => signBytesWithTauri({
        bytes,
        filename,
        keyPath: signing.updaterKeyPath,
        password: updaterPassword,
      }),
      storageSchemaVersion,
      times,
      updateConfiguration,
      updateKeyId,
      updateSequence: policyDocument.update.sequence,
      upgradeMatrixPath: path.join(evidenceDirectory, matrixName),
      version,
      windowsInputDirectory,
      windowsTrust: {
        ...(windowsCertificateSha256 ? { certificateSha256: windowsCertificateSha256 } : {}),
        profile: windowsTrustProfile,
      },
    });
    candidateCreated = true;
    operations.scanStagedEvidence(resolvedOutputDirectory);
    return result;
  } catch (error) {
    if (candidateCreated) {
      rmSync(resolvedOutputDirectory, { force: true, recursive: true });
    }
    throw error;
  } finally {
    rmSync(evidenceDirectory, { force: true, recursive: true });
  }
}

function main() {
  const [
    version,
    updateKeyId,
    releaseKeyId,
    issuedAt,
    linuxInputDirectory,
    windowsInputDirectory,
    windowsTrustInput,
    predecessorEvidenceDirectory,
  ] = process.argv.slice(2);
  if (
    !version
    || !updateKeyId
    || !releaseKeyId
    || !issuedAt
    || !linuxInputDirectory
    || !windowsInputDirectory
    || !windowsTrustInput
  ) {
    throw new Error(
      "usage: node scripts/prepare-complete-platform-release.mjs <version> <update-key-id> <release-key-id> <issued-at> <linux-input-directory> <windows-input-directory> <windows-certificate-sha256|public-unsigned-preview> [predecessor-evidence-directory]",
    );
  }
  const outputDirectory = path.join(repositoryRoot, ".artifacts/public-releases", version);
  process.stdout.write(`${JSON.stringify(prepareCompletePlatformRelease({
    environment: process.env,
    issuedAt,
    linuxInputDirectory,
    outputDirectory,
    predecessorEvidenceDirectory,
    releaseKeyId,
    updateKeyId,
    version,
    windowsCertificateSha256: windowsTrustInput === "public-unsigned-preview"
      ? undefined
      : windowsTrustInput,
    windowsInputDirectory,
    windowsTrustProfile: windowsTrustInput === "public-unsigned-preview"
      ? windowsTrustInput
      : "public-authenticode",
  }))}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Complete-platform release preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
