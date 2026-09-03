import { execFileSync } from "node:child_process";
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
import { assertWindowsExpansionAuthoritySeparation } from "./build-windows-expansion-input.mjs";
import {
  assertCleanRevision,
  generatedAt,
  readStorageSchemaVersion,
} from "./prepare-development-release.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";
import { inspectArtifact } from "./release-evidence.mjs";
import { windowsAuthenticodeAuthority } from "./windows-authenticode-sign.mjs";
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

export function verifyWindowsExpansionInput({
  authenticodeCertificateSha256,
  directory,
  revision,
  storageSchemaVersion,
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
  if (
    inventory.signatures.profile !== "public-authenticode"
    || signatures.some(({ certificateSha256 }) =>
      certificateSha256 !== authenticodeCertificateSha256)
  ) {
    throw new Error("Windows expansion inventory Authenticode trust does not match");
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
  if (evidence.trust.authenticodeCertificateSha256 !== authenticodeCertificateSha256) {
    throw new Error("Windows expansion build evidence Authenticode trust does not match");
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
    authenticodeCertificateSha256,
    buildEvidenceName: names.buildEvidenceName,
    inventoryName: names.inventoryName,
    packageName: names.packageName,
    revision,
    storageSchemaVersion,
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
      updateConfiguration,
      version,
    });
  } catch (error) {
    rmSync(staging, { force: true, recursive: true });
    if (promoted) rmSync(destination, { force: true, recursive: true });
    throw error;
  }
}

function run(command, arguments_) {
  execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
}

export function prepareWindowsExpansionInput({
  architecture = process.arch,
  environment = process.env,
  outputDirectory,
  platform = process.platform,
  version,
}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows expansion input preparation requires x86-64 Windows");
  }
  assertWindowsExpansionAuthoritySeparation(environment);
  inspectReleaseContracts(repositoryRoot, version);
  const source = assertCleanRevision();
  const updateConfiguration = loadPublicUpdateConfiguration(repositoryRoot);
  trustedUpdateKeyIds(updateConfiguration);
  const authority = windowsAuthenticodeAuthority({ environment, platform });
  if (authority.profile !== "public" || !authority.requireTimestamp) {
    throw new Error("Windows expansion input preparation requires public Authenticode authority");
  }
  run("npm", ["run", "audit:dependencies"]);
  run("npm", ["run", "package:windows-expansion-input"]);
  const releaseDirectory = path.join(
    repositoryRoot,
    "src-tauri/target/release/bundle/nsis",
  );
  const generatedInventory = generateWindowsPackageInventory({
    architecture,
    certificateSha256: authority.certificateSha256,
    platform,
    releaseDirectory,
    signatureProfile: "public-authenticode",
    signToolPath: authority.signToolPath,
    version,
  });
  return stageWindowsExpansionInput({
    authenticodeCertificateSha256: authority.certificateSha256,
    generatedAt: generatedAt(source.sourceDateEpoch),
    inventoryPath: generatedInventory.inventoryPath,
    outputDirectory,
    packagePath: path.join(releaseDirectory, expectedWindowsNsisArtifactName(version)),
    revision: source.revision,
    storageSchemaVersion: readStorageSchemaVersion(),
    updateConfiguration,
    version,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const [version, outputDirectory] = process.argv.slice(2);
    if (!version || !outputDirectory) {
      throw new Error(
        "usage: node scripts/prepare-windows-expansion-input.mjs <version> <output-directory>",
      );
    }
    const result = prepareWindowsExpansionInput({ outputDirectory, version });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        [
          `windows_input_revision=${result.revision}`,
          `windows_input_storage_schema=${result.storageSchemaVersion}`,
          `windows_input_authenticode_certificate_sha256=${result.authenticodeCertificateSha256}`,
        ].join("\n") + "\n",
      );
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Windows expansion input preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
