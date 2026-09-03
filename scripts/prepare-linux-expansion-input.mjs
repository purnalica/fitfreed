import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import {
  generateLinuxPackageInventory,
  linuxPackageInventoryName,
  validateLinuxPackageInventory,
} from "./linux-package-inventory.mjs";
import {
  createLinuxPublicBuildEvidence,
  validateLinuxPublicBuildEvidence,
} from "./linux-public-build-evidence.mjs";
import {
  assertCleanRevision,
  generatedAt,
  readStorageSchemaVersion,
} from "./prepare-development-release.mjs";
import { inspectArtifact } from "./release-evidence.mjs";
import { verifyLinuxCleanInstallation } from "./verify-linux-clean-install.mjs";
import {
  findLinuxDebianPackage,
  inspectLinuxDebianPackage,
} from "./verify-linux-debian-package.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function expectedNames(version) {
  const packageName = expectedLinuxDebianArtifactName(version);
  return {
    buildEvidenceName: `${packageName}.build.json`,
    inventoryName: linuxPackageInventoryName(version),
    packageName,
  };
}

export function verifyLinuxExpansionInput({
  directory,
  revision,
  storageSchemaVersion,
  version,
}) {
  const root = path.resolve(directory);
  const names = expectedNames(version);
  const expectedEntries = [
    names.buildEvidenceName,
    names.inventoryName,
    names.packageName,
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actualEntries = readdirSync(root, { withFileTypes: true });
  if (
    actualEntries.some((entry) => !entry.isFile())
    || JSON.stringify(actualEntries.map(({ name }) => name).sort((left, right) =>
      left.localeCompare(right, "en"))) !== JSON.stringify(expectedEntries)
  ) {
    throw new Error("Linux expansion input contains an unexpected entry");
  }
  if (expectedEntries.some((name) => {
    const status = lstatSync(path.join(root, name));
    return !status.isFile() || status.nlink !== 1;
  })) {
    throw new Error("Linux expansion input files must be regular and singly linked");
  }

  const packageArtifact = inspectArtifact(root, names.packageName, "linux-x86_64-deb");
  const inventoryArtifact = inspectArtifact(
    root,
    names.inventoryName,
    "linux-package-inventory",
  );
  const inventory = validateLinuxPackageInventory(JSON.parse(
    readFileSync(path.join(root, names.inventoryName), "utf8"),
  ));
  if (
    inventory.control.version !== version
    || inventory.artifact.path !== packageArtifact.path
    || inventory.artifact.size !== packageArtifact.size
    || inventory.artifact.sha256 !== packageArtifact.sha256
  ) {
    throw new Error("Linux expansion inventory does not bind the exact package");
  }

  const evidence = validateLinuxPublicBuildEvidence(JSON.parse(
    readFileSync(path.join(root, names.buildEvidenceName), "utf8"),
  ));
  if (evidence.release.version !== version) {
    throw new Error("Linux expansion input version does not match");
  }
  if (evidence.release.revision !== revision) {
    throw new Error("Linux expansion input revision does not match");
  }
  if (evidence.application.storageSchemaVersion !== storageSchemaVersion) {
    throw new Error("Linux expansion input storage schema does not match");
  }
  for (const [key, expected] of [
    ["package", packageArtifact],
    ["inventory", inventoryArtifact],
  ]) {
    if (JSON.stringify(evidence.artifacts[key]) !== JSON.stringify(expected)) {
      throw new Error(`Linux expansion build evidence does not bind the ${key}`);
    }
  }
  return {
    buildEvidenceName: names.buildEvidenceName,
    inventoryName: names.inventoryName,
    packageName: names.packageName,
    revision,
    storageSchemaVersion,
    version,
  };
}

export function stageLinuxExpansionInput({
  generatedAt: generationTime,
  inventoryPath,
  outputDirectory,
  packagePath,
  revision,
  storageSchemaVersion,
  version,
}) {
  const destination = path.resolve(outputDirectory);
  if (existsSync(destination)) throw new Error("Linux expansion input already exists");
  const names = expectedNames(version);
  if (path.basename(packagePath) !== names.packageName) {
    throw new Error(`Linux expansion package must be named ${names.packageName}`);
  }
  if (path.basename(inventoryPath) !== names.inventoryName) {
    throw new Error(`Linux expansion inventory must be named ${names.inventoryName}`);
  }
  const staging = `${destination}.tmp-${process.pid}`;
  rmSync(staging, { force: true, recursive: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  mkdirSync(staging);
  try {
    copyFileSync(packagePath, path.join(staging, names.packageName));
    copyFileSync(inventoryPath, path.join(staging, names.inventoryName));
    const packageArtifact = inspectArtifact(staging, names.packageName, "linux-x86_64-deb");
    const inventoryArtifact = inspectArtifact(
      staging,
      names.inventoryName,
      "linux-package-inventory",
    );
    const evidence = createLinuxPublicBuildEvidence({
      generatedAt: generationTime,
      inventoryArtifact,
      packageArtifact,
      revision,
      storageSchemaVersion,
      version,
    });
    writeFileSync(
      path.join(staging, names.buildEvidenceName),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    verifyLinuxExpansionInput({
      directory: staging,
      revision,
      storageSchemaVersion,
      version,
    });
    renameSync(staging, destination);
    return verifyLinuxExpansionInput({
      directory: destination,
      revision,
      storageSchemaVersion,
      version,
    });
  } catch (error) {
    rmSync(staging, { force: true, recursive: true });
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

export function prepareLinuxExpansionInput({
  architecture = process.arch,
  outputDirectory,
  platform = process.platform,
  version,
}) {
  if (platform !== "linux" || architecture !== "x64") {
    throw new Error("Linux expansion input preparation requires x86-64 Linux");
  }
  inspectReleaseContracts(repositoryRoot, version);
  const source = assertCleanRevision();
  const packageDirectory = path.join(
    repositoryRoot,
    "src-tauri/target/release/bundle/deb",
  );
  rmSync(path.dirname(packageDirectory), { force: true, recursive: true });
  run("npm", ["run", "audit:dependencies"]);
  run("npm", ["run", "package:linux-expansion-input"]);
  inspectLinuxDebianPackage({ releaseDirectory: packageDirectory, version });
  const packagePath = findLinuxDebianPackage(packageDirectory, version);
  const generatedInventory = generateLinuxPackageInventory({
    releaseDirectory: packageDirectory,
    version,
  });
  verifyLinuxCleanInstallation({ packagePath, version });
  return stageLinuxExpansionInput({
    generatedAt: generatedAt(source.sourceDateEpoch),
    inventoryPath: generatedInventory.inventoryPath,
    outputDirectory,
    packagePath,
    revision: source.revision,
    storageSchemaVersion: readStorageSchemaVersion(),
    version,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const [version, outputDirectory] = process.argv.slice(2);
    if (!version || !outputDirectory) {
      throw new Error(
        "usage: node scripts/prepare-linux-expansion-input.mjs <version> <output-directory>",
      );
    }
    const result = prepareLinuxExpansionInput({
      outputDirectory,
      version,
    });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        [
          `linux_input_revision=${result.revision}`,
          `linux_input_storage_schema=${result.storageSchemaVersion}`,
        ].join("\n") + "\n",
      );
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Linux expansion input preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
