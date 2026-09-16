import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { buildProductionPackage } from "./build-production.mjs";
import {
  assertWindowsExpansionAuthoritySeparation,
  findWindowsSignTool,
} from "./build-windows-expansion-input.mjs";
import {
  assertCleanRevision,
  generatedAt,
  readStorageSchemaVersion,
} from "./prepare-development-release.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";
import { inspectArtifact, sha256File } from "./release-evidence.mjs";
import { inspectWindowsAuthenticode } from "./windows-authenticode-trust.mjs";
import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";
import {
  generateWindowsPackageInventory,
  validateWindowsPackageInventory,
  windowsPackageInventoryName,
} from "./windows-package-inventory.mjs";
import {
  createWindowsPublicBuildEvidence,
  validateWindowsPublicBuildEvidence,
} from "./windows-public-build-evidence.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const certificateSha256Pattern = /^[0-9a-f]{64}$/;
const defaultWindowsReleaseDirectory = path.join(
  repositoryRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis",
);

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function expectedNames(version) {
  const packageName = expectedWindowsNsisArtifactName(version);
  return {
    buildEvidenceName: `${packageName}.build.json`,
    inventoryName: windowsPackageInventoryName(version),
    packageName,
  };
}

function trustedUpdateKeyIds(configuration) {
  publicUpdateBuildEnvironment(configuration, true);
  if (
    configuration.contract !== "stable-v3"
  ) {
    throw new Error("Windows expansion input requires active stable-v3 update trust");
  }
  return configuration.keys.map(({ id }) => id).sort(byteOrder);
}

function requireRegularSinglyLinkedFile(filePath, message) {
  const metadata = lstatSync(filePath);
  if (
    !metadata.isFile()
    || metadata.isSymbolicLink()
    || metadata.nlink !== 1
    || metadata.size < 1
  ) {
    throw new Error(message);
  }
}

function requireCertificateSha256(certificateSha256) {
  if (!certificateSha256Pattern.test(certificateSha256 ?? "")) {
    throw new Error("SignPath requires one lowercase SHA-256 certificate fingerprint");
  }
}

function pathsOverlap(left, right) {
  const relative = path.relative(path.resolve(left), path.resolve(right));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function validateWindowsSignPathSetup({
  certificateSha256,
  directory,
  inspect = inspectWindowsAuthenticode,
  platform = process.platform,
  signToolPath,
  version,
}) {
  if (platform !== "win32") {
    throw new Error("SignPath setup validation requires Windows");
  }
  requireCertificateSha256(certificateSha256);
  const root = path.resolve(directory);
  if (!existsSync(root)) throw new Error("SignPath setup output is unavailable");
  const rootMetadata = lstatSync(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("SignPath setup output must be one real directory");
  }
  const packageName = expectedWindowsNsisArtifactName(version);
  const entries = readdirSync(root, { withFileTypes: true });
  if (
    entries.length !== 1
    || entries[0].name !== packageName
    || !entries[0].isFile()
  ) {
    throw new Error(`SignPath setup output must contain exactly ${packageName}`);
  }
  const packagePath = path.join(root, packageName);
  requireRegularSinglyLinkedFile(
    packagePath,
    "SignPath setup must be a regular and singly linked file",
  );
  const trust = inspect({
    binaryPath: packagePath,
    certificateSha256,
    platform,
    requireTimestamp: true,
    signatureOnly: false,
    signToolPath,
    version,
  });
  const packageSha256 = sha256File(packagePath);
  if (
    trust.fileSha256 !== packageSha256
    || trust.certificateSha256 !== certificateSha256
    || trust.status !== "Valid"
    || trust.timestamped !== true
  ) {
    throw new Error("SignPath setup trust does not bind the returned bytes");
  }
  return { packageName, packagePath, packageSha256 };
}

export function verifyWindowsExpansionInput({
  authenticodeCertificateSha256,
  directory,
  revision,
  storageSchemaVersion,
  trustProfile = "public-authenticode",
  updateConfiguration,
  version,
}) {
  const root = path.resolve(directory);
  const names = expectedNames(version);
  const expectedEntries = [
    names.buildEvidenceName,
    names.inventoryName,
    names.packageName,
  ].sort(byteOrder);
  const actualEntries = readdirSync(root, { withFileTypes: true });
  if (
    actualEntries.some((entry) => !entry.isFile())
    || JSON.stringify(actualEntries.map(({ name }) => name).sort(byteOrder))
      !== JSON.stringify(expectedEntries)
  ) {
    throw new Error("Windows expansion input contains an unexpected entry");
  }
  for (const name of expectedEntries) {
    requireRegularSinglyLinkedFile(
      path.join(root, name),
      "Windows expansion input files must be regular and singly linked",
    );
  }

  const packageArtifact = inspectArtifact(root, names.packageName, "windows-x86_64-nsis");
  const inventoryArtifact = inspectArtifact(
    root,
    names.inventoryName,
    "windows-package-inventory",
  );
  const inventory = validateWindowsPackageInventory(JSON.parse(
    readFileSync(path.join(root, names.inventoryName), "utf8"),
  ));
  if (
    inventory.identity.version !== version
    || inventory.artifact.path !== packageArtifact.path
    || inventory.artifact.size !== packageArtifact.size
    || inventory.artifact.sha256 !== packageArtifact.sha256
  ) {
    throw new Error("Windows expansion inventory does not bind the exact package");
  }
  const signatures = [
    inventory.signatures.setup,
    inventory.signatures.executable,
    inventory.signatures.uninstaller,
  ];
  if (trustProfile === "public-authenticode") {
    if (
      inventory.signatures.profile !== trustProfile
      || signatures.some(({ certificateSha256, status, timestamped }) =>
        certificateSha256 !== authenticodeCertificateSha256
        || status !== "Valid"
        || timestamped !== true)
    ) {
      throw new Error("Windows expansion inventory Authenticode trust does not match");
    }
  } else if (
    trustProfile !== "public-unsigned-preview"
    || inventory.signatures.profile !== trustProfile
    || signatures.some(({ certificateSha256, status, timestamped }) =>
      certificateSha256 !== null || status !== "NotSigned" || timestamped !== false)
  ) {
    throw new Error("Windows expansion inventory unsigned preview trust does not match");
  }

  const evidence = validateWindowsPublicBuildEvidence(JSON.parse(
    readFileSync(path.join(root, names.buildEvidenceName), "utf8"),
  ));
  if (evidence.release.version !== version) {
    throw new Error("Windows expansion input version does not match");
  }
  if (evidence.release.revision !== revision) {
    throw new Error("Windows expansion input revision does not match");
  }
  if (evidence.application.storageSchemaVersion !== storageSchemaVersion) {
    throw new Error("Windows expansion input storage schema does not match");
  }
  if (trustProfile === "public-authenticode") {
    if (evidence.trust.authenticodeCertificateSha256 !== authenticodeCertificateSha256) {
      throw new Error("Windows expansion build evidence Authenticode trust does not match");
    }
  } else if (
    evidence.schemaVersion !== 2
    || evidence.trust?.profile !== "public-unsigned-preview"
    || evidence.trust?.authenticode?.status !== "not-provided"
    || evidence.limitations?.exactWindows11Admission !== false
  ) {
    throw new Error("Windows expansion build evidence unsigned preview trust does not match");
  }
  for (const [key, expected] of [
    ["package", packageArtifact],
    ["inventory", inventoryArtifact],
  ]) {
    if (JSON.stringify(evidence.artifacts[key]) !== JSON.stringify(expected)) {
      throw new Error(`Windows expansion build evidence does not bind the ${key}`);
    }
  }
  const trustedKeyIds = trustedUpdateKeyIds(updateConfiguration);
  if (
    evidence.update.contract !== updateConfiguration.contract
    || evidence.update.metadataEndpoint !== updateConfiguration.metadataEndpoint
    || JSON.stringify(evidence.update.trustedKeyIds) !== JSON.stringify(trustedKeyIds)
  ) {
    throw new Error("Windows expansion input update trust does not match");
  }
  return {
    ...(trustProfile === "public-authenticode" ? { authenticodeCertificateSha256 } : {}),
    buildEvidenceName: names.buildEvidenceName,
    inventoryName: names.inventoryName,
    packageName: names.packageName,
    revision,
    storageSchemaVersion,
    trustProfile,
    version,
  };
}

export function stageWindowsExpansionInput({
  authenticodeCertificateSha256,
  generatedAt: generationTime,
  inventoryPath,
  outputDirectory,
  packagePath,
  revision,
  storageSchemaVersion,
  trustProfile = "public-authenticode",
  updateConfiguration,
  version,
}) {
  const destination = path.resolve(outputDirectory);
  if (existsSync(destination)) throw new Error("Windows expansion input already exists");
  const names = expectedNames(version);
  if (path.basename(packagePath) !== names.packageName) {
    throw new Error(`Windows expansion package must be named ${names.packageName}`);
  }
  if (path.basename(inventoryPath) !== names.inventoryName) {
    throw new Error(`Windows expansion inventory must be named ${names.inventoryName}`);
  }
  for (const sourcePath of [packagePath, inventoryPath]) {
    requireRegularSinglyLinkedFile(
      sourcePath,
      "Windows expansion source files must be regular and singly linked",
    );
  }
  const updateTrustedKeyIds = trustedUpdateKeyIds(updateConfiguration);
  const destinationParent = path.dirname(destination);
  mkdirSync(destinationParent, { recursive: true });
  const staging = mkdtempSync(
    path.join(destinationParent, `.${path.basename(destination)}.tmp-`),
  );
  let promoted = false;
  try {
    copyFileSync(packagePath, path.join(staging, names.packageName));
    copyFileSync(inventoryPath, path.join(staging, names.inventoryName));
    const packageArtifact = inspectArtifact(
      staging,
      names.packageName,
      "windows-x86_64-nsis",
    );
    const inventoryArtifact = inspectArtifact(
      staging,
      names.inventoryName,
      "windows-package-inventory",
    );
    const evidence = createWindowsPublicBuildEvidence({
      authenticodeCertificateSha256,
      generatedAt: generationTime,
      inventoryArtifact,
      packageArtifact,
      revision,
      storageSchemaVersion,
      trustProfile,
      updateTrustedKeyIds,
      version,
    });
    writeFileSync(
      path.join(staging, names.buildEvidenceName),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    verifyWindowsExpansionInput({
      authenticodeCertificateSha256,
      directory: staging,
      revision,
      storageSchemaVersion,
      trustProfile,
      updateConfiguration,
      version,
    });
    renameSync(staging, destination);
    promoted = true;
    return verifyWindowsExpansionInput({
      authenticodeCertificateSha256,
      directory: destination,
      revision,
      storageSchemaVersion,
      trustProfile,
      updateConfiguration,
      version,
    });
  } catch (error) {
    rmSync(staging, { force: true, recursive: true });
    if (promoted) rmSync(destination, { force: true, recursive: true });
    throw error;
  }
}

export function prepareWindowsExpansionInput({
  architecture = process.arch,
  assertSource = assertCleanRevision,
  certificateSha256,
  environment = process.env,
  generateInventory = generateWindowsPackageInventory,
  inspect = inspectWindowsAuthenticode,
  outputDirectory,
  platform = process.platform,
  readStorageSchema = readStorageSchemaVersion,
  signedSetupDirectory,
  signToolPath,
  updateConfiguration,
  validateRelease = (releaseVersion) => inspectReleaseContracts(repositoryRoot, releaseVersion),
  version,
}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows expansion input preparation requires x86-64 Windows");
  }
  assertWindowsExpansionAuthoritySeparation(environment);
  validateRelease(version);
  const source = assertSource();
  const activeUpdateConfiguration = updateConfiguration
    ?? loadPublicUpdateConfiguration(repositoryRoot);
  trustedUpdateKeyIds(activeUpdateConfiguration);
  const resolvedCertificateSha256 = certificateSha256
    ?? environment.FITFREED_WINDOWS_CERTIFICATE_SHA256;
  requireCertificateSha256(resolvedCertificateSha256);
  const resolvedSignToolPath = signToolPath ?? findWindowsSignTool({
    architecture,
    environment,
    platform,
  });
  if (typeof signedSetupDirectory !== "string" || signedSetupDirectory.length === 0) {
    throw new Error("SignPath setup output directory is required");
  }
  if (typeof outputDirectory !== "string" || outputDirectory.length === 0) {
    throw new Error("Windows expansion output directory is required");
  }
  const resolvedSetupDirectory = path.resolve(signedSetupDirectory);
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  if (
    pathsOverlap(resolvedSetupDirectory, resolvedOutputDirectory)
    || pathsOverlap(resolvedOutputDirectory, resolvedSetupDirectory)
  ) {
    throw new Error("SignPath setup and Windows expansion output must not overlap");
  }
  const signedSetup = validateWindowsSignPathSetup({
    certificateSha256: resolvedCertificateSha256,
    directory: resolvedSetupDirectory,
    inspect,
    platform,
    signToolPath: resolvedSignToolPath,
    version,
  });
  mkdirSync(path.dirname(resolvedOutputDirectory), { recursive: true });
  const inspectionDirectory = mkdtempSync(
    path.join(
      path.dirname(resolvedOutputDirectory),
      `.${path.basename(resolvedOutputDirectory)}.inspection-`,
    ),
  );
  try {
    const inspectedPackagePath = path.join(inspectionDirectory, signedSetup.packageName);
    copyFileSync(signedSetup.packagePath, inspectedPackagePath);
    if (sha256File(inspectedPackagePath) !== signedSetup.packageSha256) {
      throw new Error("SignPath setup changed while entering native inspection");
    }
    const generatedInventory = generateInventory({
      architecture,
      certificateSha256: resolvedCertificateSha256,
      platform,
      releaseDirectory: inspectionDirectory,
      signatureProfile: "public-authenticode",
      signToolPath: resolvedSignToolPath,
      version,
    });
    return stageWindowsExpansionInput({
      authenticodeCertificateSha256: resolvedCertificateSha256,
      generatedAt: generatedAt(source.sourceDateEpoch),
      inventoryPath: generatedInventory.inventoryPath,
      outputDirectory: resolvedOutputDirectory,
      packagePath: inspectedPackagePath,
      revision: source.revision,
      storageSchemaVersion: readStorageSchema(),
      trustProfile: "public-authenticode",
      updateConfiguration: activeUpdateConfiguration,
      version,
    });
  } finally {
    rmSync(inspectionDirectory, { force: true, recursive: true });
  }
}

export function prepareWindowsUnsignedPreviewInput({
  architecture = process.arch,
  assertSource = assertCleanRevision,
  build = buildProductionPackage,
  environment = process.env,
  generateInventory = generateWindowsPackageInventory,
  outputDirectory,
  platform = process.platform,
  readStorageSchema = readStorageSchemaVersion,
  releaseDirectory = defaultWindowsReleaseDirectory,
  updateConfiguration,
  validateRelease = (releaseVersion) => inspectReleaseContracts(repositoryRoot, releaseVersion),
  version,
}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows unsigned preview input preparation requires x86-64 Windows");
  }
  assertWindowsExpansionAuthoritySeparation(environment);
  validateRelease(version);
  const source = assertSource();
  const activeUpdateConfiguration = updateConfiguration
    ?? loadPublicUpdateConfiguration(repositoryRoot);
  const updateEnvironment = publicUpdateBuildEnvironment(activeUpdateConfiguration, true);
  trustedUpdateKeyIds(activeUpdateConfiguration);
  if (typeof outputDirectory !== "string" || outputDirectory.length === 0) {
    throw new Error("Windows expansion output directory is required");
  }
  const destination = path.resolve(outputDirectory);
  if (existsSync(destination)) throw new Error("Windows expansion input already exists");
  const packagePath = path.join(
    path.resolve(releaseDirectory),
    expectedWindowsNsisArtifactName(version),
  );
  rmSync(releaseDirectory, { force: true, recursive: true });
  build({
    arguments_: ["--bundles", "nsis", "--ci"],
    publicUpdateEnvironment: updateEnvironment,
  });
  requireRegularSinglyLinkedFile(
    packagePath,
    "unsigned Windows preview setup is unavailable",
  );
  const generatedInventory = generateInventory({
    architecture,
    platform,
    releaseDirectory,
    signatureProfile: "public-unsigned-preview",
    version,
  });
  return stageWindowsExpansionInput({
    generatedAt: generatedAt(source.sourceDateEpoch),
    inventoryPath: generatedInventory.inventoryPath,
    outputDirectory: destination,
    packagePath,
    revision: source.revision,
    storageSchemaVersion: readStorageSchema(),
    trustProfile: "public-unsigned-preview",
    updateConfiguration: activeUpdateConfiguration,
    version,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const arguments_ = process.argv.slice(2);
    const unsignedPreview = arguments_[0] === "--unsigned-preview";
    const [version, outputDirectory, modeOrSignedSetupDirectory] = unsignedPreview
      ? arguments_.slice(1)
      : arguments_;
    if (!version || !outputDirectory || !modeOrSignedSetupDirectory) {
      if (!(unsignedPreview && version && outputDirectory && !modeOrSignedSetupDirectory)) {
        throw new Error(
          "usage: node scripts/prepare-windows-expansion-input.mjs <--unsigned-preview version output-directory|version output-directory signed-setup-directory>",
        );
      }
    }
    const result = unsignedPreview
      ? prepareWindowsUnsignedPreviewInput({ outputDirectory, version })
      : prepareWindowsExpansionInput({
        outputDirectory,
        signedSetupDirectory: modeOrSignedSetupDirectory,
        version,
      });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        [
          `windows_input_revision=${result.revision}`,
          `windows_input_storage_schema=${result.storageSchemaVersion}`,
          `windows_input_trust_profile=${result.trustProfile}`,
          ...(result.authenticodeCertificateSha256
            ? [`windows_input_authenticode_certificate_sha256=${result.authenticodeCertificateSha256}`]
            : []),
        ].join("\n") + "\n",
      );
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Windows expansion input preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
