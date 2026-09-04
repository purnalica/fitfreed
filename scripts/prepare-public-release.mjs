import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { inspectPublicMacosTrust } from "./macos-public-trust.mjs";
import { nodePackageScriptPath } from "./node-package-script.mjs";
import { composePagesArtifact } from "./pages-artifact.mjs";
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
import {
  createPublicReleaseManifest,
  renderPublicReleaseNotes,
} from "./public-release-evidence.mjs";
import { inspectPublicReleasePreflight } from "./public-release-preflight.mjs";
import { loadPublicReleasePolicy } from "./public-release-policy.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { stageStableUpdateChannel } from "./public-update-staging.mjs";
import {
  inspectArtifact,
  promoteStagedDirectory,
  renderChecksumFile,
} from "./release-evidence.mjs";
import { inspectUpgradeMatrix } from "./upgrade-matrix.mjs";
import { verifyPublicReleaseCandidate } from "./verify-public-release.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha1Pattern = /^[0-9a-fA-F]{40}$/;
const teamIdentifierPattern = /^[A-Z0-9]{10}$/;
const appStoreConnectIssuerPattern = /^[0-9a-fA-F-]{36}$/;
const appStoreConnectKeyPattern = /^[A-Z0-9]{10}$/;
const channelValidityMilliseconds = 7 * 24 * 60 * 60 * 1_000;
const maximumIssuanceSkewMilliseconds = 5 * 60 * 1_000;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, ...options.environment },
  })?.trim();
}

export function outsideRepositoryFile(candidatePath, repositoryPath, label) {
  if (typeof candidatePath !== "string" || !path.isAbsolute(candidatePath)) {
    throw new Error(`${label} must be an absolute file outside the repository`);
  }
  const resolved = path.resolve(candidatePath);
  const relative = path.relative(repositoryPath, resolved);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..")) {
    throw new Error(`${label} must be outside the repository`);
  }
  if (!existsSync(resolved) || !lstatSync(resolved).isFile()) {
    throw new Error(`${label} is unavailable`);
  }
  if ((lstatSync(resolved).mode & 0o077) !== 0) {
    throw new Error(`${label} permissions must exclude group and other access`);
  }
  return resolved;
}

export function assertPublicSigningEnvironment(environment, repositoryPath = repositoryRoot) {
  const errors = [];
  const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
  };
  requireValue(
    sha1Pattern.test(environment.APPLE_SIGNING_IDENTITY ?? ""),
    "Apple signing identity must be a certificate SHA-1 fingerprint",
  );
  requireValue(
    teamIdentifierPattern.test(environment.FITFREED_EXPECTED_APPLE_TEAM_ID ?? ""),
    "expected Apple team identifier is invalid",
  );
  requireValue(
    environment.TAURI_SIGNING_PRIVATE_KEY === undefined,
    "inline updater private keys are forbidden for public releases",
  );
  requireValue(
    typeof environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === "string"
      && environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD.length > 0,
    "updater signing password is unavailable",
  );

  let updaterKeyPath;
  let apiKeyPath;
  try {
    updaterKeyPath = outsideRepositoryFile(
      environment.TAURI_SIGNING_PRIVATE_KEY_PATH,
      repositoryPath,
      "updater private key",
    );
  } catch (error) {
    errors.push(error.message);
  }

  const apiFields = ["APPLE_API_ISSUER", "APPLE_API_KEY", "APPLE_API_KEY_PATH"];
  const appleIdFields = ["APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"];
  const apiPresent = apiFields.some((name) => environment[name] !== undefined);
  const appleIdPresent = appleIdFields.some((name) => environment[name] !== undefined);
  if (apiPresent === appleIdPresent) {
    errors.push("exactly one Apple notarization credential mode is required");
  } else if (apiPresent) {
    requireValue(
      appStoreConnectIssuerPattern.test(environment.APPLE_API_ISSUER ?? ""),
      "App Store Connect issuer is invalid",
    );
    requireValue(
      appStoreConnectKeyPattern.test(environment.APPLE_API_KEY ?? ""),
      "App Store Connect key identifier is invalid",
    );
    try {
      apiKeyPath = outsideRepositoryFile(
        environment.APPLE_API_KEY_PATH,
        repositoryPath,
        "App Store Connect private key",
      );
    } catch (error) {
      errors.push(error.message);
    }
  } else {
    for (const name of appleIdFields) {
      requireValue(
        typeof environment[name] === "string" && environment[name].length > 0,
        `${name} is unavailable`,
      );
    }
    requireValue(
      environment.APPLE_TEAM_ID === environment.FITFREED_EXPECTED_APPLE_TEAM_ID,
      "Apple ID notarization team does not match the expected team",
    );
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    signingIdentity: environment.APPLE_SIGNING_IDENTITY.toLowerCase(),
    expectedTeamIdentifier: environment.FITFREED_EXPECTED_APPLE_TEAM_ID,
    updaterKeyPath,
    notarizationMode: apiPresent ? "app-store-connect-api" : "apple-id",
    ...(apiKeyPath ? { apiKeyPath } : {}),
  };
}

export function publicArtifactNames(version) {
  return {
    diskImage: `FitFreed_${version}_aarch64.dmg`,
    updaterArchive: `FitFreed_${version}_aarch64.app.tar.gz`,
    updaterSignature: `FitFreed_${version}_aarch64.app.tar.gz.sig`,
  };
}

export function publicChannelTimes(issuedAt, currentTime = Date.now()) {
  const issued = Date.parse(issuedAt);
  if (!Number.isFinite(issued)) throw new Error("public channel issuance time is invalid");
  if (!Number.isFinite(currentTime) || Math.abs(issued - currentTime) > maximumIssuanceSkewMilliseconds) {
    throw new Error("public channel issuance time is outside the allowed execution window");
  }
  const canonicalIssuedAt = new Date(issued).toISOString();
  return {
    issuedAt: canonicalIssuedAt,
    publishedAt: canonicalIssuedAt,
    expiresAt: new Date(issued + channelValidityMilliseconds).toISOString(),
  };
}

function buildPublicCandidate() {
  const bundleRoot = path.join(repositoryRoot, "src-tauri", "target", "release", "bundle");
  rmSync(bundleRoot, { recursive: true, force: true });
  run("npm", ["run", "package:public-candidate"]);
  run("npm", ["run", "check:production-bundle"]);
}

function builtArtifactPaths(version) {
  const names = publicArtifactNames(version);
  const bundleRoot = path.join(repositoryRoot, "src-tauri", "target", "release", "bundle");
  const paths = {
    application: path.join(bundleRoot, "macos", "FitFreed.app"),
    diskImage: path.join(bundleRoot, "dmg", names.diskImage),
    updaterArchive: path.join(bundleRoot, "macos", "FitFreed.app.tar.gz"),
    updaterSignature: path.join(bundleRoot, "macos", "FitFreed.app.tar.gz.sig"),
  };
  for (const [kind, candidatePath] of Object.entries(paths)) {
    if (!existsSync(candidatePath)) throw new Error(`public build did not produce ${kind}`);
  }
  return { names, paths };
}

function copyPublicArtifacts(releaseDirectory, built) {
  run("ditto", [built.paths.application, path.join(releaseDirectory, "FitFreed.app")]);
  copyFileSync(built.paths.diskImage, path.join(releaseDirectory, built.names.diskImage));
  copyFileSync(
    built.paths.updaterArchive,
    path.join(releaseDirectory, built.names.updaterArchive),
  );
  copyFileSync(
    built.paths.updaterSignature,
    path.join(releaseDirectory, built.names.updaterSignature),
  );
}

function signChannelPayload(payloadBytes, temporaryDirectory) {
  const payloadPath = path.join(temporaryDirectory, `.stable-payload-${randomUUID()}`);
  const signaturePath = `${payloadPath}.sig`;
  try {
    writeFileSync(payloadPath, payloadBytes, { mode: 0o600 });
    run(process.execPath, [
      nodePackageScriptPath("@tauri-apps/cli", "tauri"),
      "signer",
      "sign",
      payloadPath,
    ], { capture: true });
    if (!existsSync(signaturePath)) throw new Error("stable metadata signature is unavailable");
    return readFileSync(signaturePath, "utf8").trim();
  } finally {
    rmSync(payloadPath, { force: true });
    rmSync(signaturePath, { force: true });
  }
}

function textualEvidenceHasLocalReference(releaseDirectory, textFiles) {
  const text = textFiles
    .map((filename) => readFileSync(path.join(releaseDirectory, filename), "utf8"))
    .join("\n");
  return text.includes(repositoryRoot) || text.includes("file://");
}

function preparePublicRelease() {
  const [version, updateKeyId, issuedAtInput] = process.argv.slice(2);
  if (!version || !updateKeyId || !issuedAtInput) {
    throw new Error(
      "usage: npm run prepare:public-release -- <version> <update-key-id> <issued-at>",
    );
  }
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("public release preparation requires Apple Silicon macOS");
  }

  const preflight = inspectPublicReleasePreflight({ version, updateKeyId });
  const releaseContracts = inspectReleaseContracts(repositoryRoot, version);
  const upgradeMatrix = inspectUpgradeMatrix(repositoryRoot);
  const policy = loadPublicReleasePolicy(repositoryRoot, version, upgradeMatrix);
  const configuration = loadPublicUpdateConfiguration(repositoryRoot);
  const signing = assertPublicSigningEnvironment(process.env);
  const times = publicChannelTimes(issuedAtInput);
  const source = assertCleanRevision();
  if (source.revision !== preflight.revision) {
    throw new Error("public release source changed after preflight");
  }
  const reviewedReleaseNotes = readFileSync(
    path.join(repositoryRoot, releaseContracts.releaseNotesSource),
    "utf8",
  );

  const outputRoot = path.join(repositoryRoot, ".artifacts", "public-releases");
  const stagingDirectory = path.join(outputRoot, `.${version}-${process.pid}.tmp`);
  const finalDirectory = path.join(outputRoot, version);
  const releaseDirectory = path.join(stagingDirectory, "release");
  const pagesDirectory = path.join(stagingDirectory, "pages");
  const updateStagingDirectory = path.join(stagingDirectory, "update-staging");
  rmSync(stagingDirectory, { recursive: true, force: true });
  mkdirSync(releaseDirectory, { recursive: true });

  try {
    run("npm", ["run", "audit:dependencies"]);
    buildPublicCandidate();
    const built = builtArtifactPaths(version);
    const trust = inspectPublicMacosTrust({
      applicationPath: built.paths.application,
      diskImagePath: built.paths.diskImage,
      expectedVersion: version,
      expectedTeamIdentifier: signing.expectedTeamIdentifier,
    });
    copyPublicArtifacts(releaseDirectory, built);
    const npmSbom = createNpmSbom(releaseDirectory, repositoryRoot);
    const cargoSboms = createCargoSboms(releaseDirectory, repositoryRoot, source.sourceDateEpoch);
    const matrixName = copyUpgradeMatrix(releaseDirectory);
    const storageSchemaVersion = readStorageSchemaVersion();
    writeFileSync(
      path.join(releaseDirectory, "RELEASE_NOTES.md"),
      renderPublicReleaseNotes({
        version,
        revision: source.revision,
        storageSchemaVersion,
      }, reviewedReleaseNotes),
    );

    stageStableUpdateChannel({
      outputDirectory: updateStagingDirectory,
      configuration,
      packages: [{
        packagePath: built.paths.updaterArchive,
        packageSignaturePath: built.paths.updaterSignature,
        target: "darwin-aarch64",
      }],
      signingKeyId: updateKeyId,
      version,
      sequence: policy.update.sequence,
      ...times,
      minimumSupportedVersion: policy.update.minimumSupportedVersion,
      minimumReadableSchemaVersion: upgradeMatrix.librarySchemaVersions[0],
      maximumReadableSchemaVersion: upgradeMatrix.librarySchemaVersions.at(-1),
      targetSchemaVersion: upgradeMatrix.currentLibrarySchemaVersion,
      releaseNotes: policy.update.releaseNotes,
      withdrawnVersions: policy.update.withdrawnVersions,
      signPayload: (payloadBytes) => signChannelPayload(payloadBytes, stagingDirectory),
    });
    copyFileSync(
      path.join(updateStagingDirectory, "updates", "stable.json"),
      path.join(releaseDirectory, "stable.json"),
    );

    const inventoryNames = [npmSbom, ...cargoSboms];
    const artifacts = [
      inspectArtifact(releaseDirectory, "FitFreed.app", "macos-application-bundle"),
      inspectArtifact(releaseDirectory, built.names.diskImage, "macos-disk-image"),
      inspectArtifact(releaseDirectory, built.names.updaterArchive, "macos-updater-archive"),
      inspectArtifact(releaseDirectory, built.names.updaterSignature, "updater-signature"),
      inspectArtifact(releaseDirectory, "stable.json", "stable-update-envelope"),
      ...inventoryNames.map((filename) =>
        inspectArtifact(releaseDirectory, filename, "cyclonedx-sbom"),
      ),
      inspectArtifact(releaseDirectory, matrixName, "upgrade-matrix"),
      inspectArtifact(releaseDirectory, "RELEASE_NOTES.md", "release-notes"),
    ];
    const manifest = createPublicReleaseManifest({
      version,
      revision: source.revision,
      generatedAt: generatedAt(source.sourceDateEpoch),
      storageSchemaVersion,
      certificateSha256: trust.certificateSha256,
      teamIdentifier: trust.teamIdentifier,
      updateKeyId,
      updateSequence: policy.update.sequence,
      generators: generatorVersions(),
      artifacts,
    });
    writeFileSync(
      path.join(releaseDirectory, "release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    const checksumSubjects = [
      ...artifacts
        .filter(({ kind }) => kind !== "macos-application-bundle")
        .map(({ path: artifactPath }) => artifactPath),
      "release-manifest.json",
    ];
    writeFileSync(
      path.join(releaseDirectory, "SHA256SUMS"),
      renderChecksumFile(releaseDirectory, checksumSubjects),
    );
    composePagesArtifact({
      repositoryRoot,
      outputDirectory: pagesDirectory,
      releaseManifest: manifest,
      updateDirectory: path.join(updateStagingDirectory, "updates"),
    });
    rmSync(updateStagingDirectory, { force: true, recursive: true });
    if (textualEvidenceHasLocalReference(releaseDirectory, [
      built.names.updaterSignature,
      "stable.json",
      ...inventoryNames,
      matrixName,
      "RELEASE_NOTES.md",
      "release-manifest.json",
      "SHA256SUMS",
    ])) {
      throw new Error("public release evidence contains a machine-local reference");
    }
    verifyPublicReleaseCandidate(stagingDirectory, configuration);
    scanStagedEvidence(stagingDirectory);
    promoteStagedDirectory(stagingDirectory, finalDirectory, process.pid);
    process.stdout.write(
      `${JSON.stringify({
        version,
        revision: source.revision,
        updateSequence: policy.update.sequence,
        outputDirectory: path.relative(repositoryRoot, finalDirectory),
      })}\n`,
    );
  } catch (error) {
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    preparePublicRelease();
  } catch (error) {
    process.stderr.write(`Public release preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
