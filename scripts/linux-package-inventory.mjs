import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import {
  expectedLinuxDebianArtifactName,
  linuxPackageContract,
} from "./linux-package-contract.mjs";
import {
  dependencyNames,
  findLinuxDebianPackage,
  parseDebianControl,
} from "./verify-linux-debian-package.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const schema = JSON.parse(
  readFileSync(new URL("../schemas/linux-package-inventory-v1.schema.json", import.meta.url)),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);
const sha256Pattern = /^[0-9a-f]{64}$/;

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function mode(metadata) {
  return (metadata.mode & 0o7777).toString(8).padStart(4, "0");
}

function portablePath(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join("/");
}

function inventoryEntries(root) {
  const entries = [];
  const visit = (directory) => {
    const children = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => byteOrder(left.name, right.name));
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      const metadata = lstatSync(absolutePath);
      const entryPath = portablePath(root, absolutePath);
      if (metadata.isDirectory()) {
        entries.push({ mode: mode(metadata), path: entryPath, type: "directory" });
        visit(absolutePath);
      } else if (metadata.isFile()) {
        entries.push({
          mode: mode(metadata),
          path: entryPath,
          sha256: digest(readFileSync(absolutePath)),
          size: metadata.size,
          type: "file",
        });
      } else if (metadata.isSymbolicLink()) {
        entries.push({
          mode: "0777",
          path: entryPath,
          target: readlinkSync(absolutePath),
          type: "symbolic-link",
        });
      } else {
        throw new Error(`unsupported package inventory entry type at ${entryPath}`);
      }
    }
  };
  visit(root);
  return entries.sort((left, right) => byteOrder(left.path, right.path));
}

function safeSymbolicLink(entryPath, target) {
  if (path.posix.isAbsolute(target) || target.includes("\\") || target.includes("\0")) {
    return false;
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(entryPath), target));
  return resolved !== ".." && !resolved.startsWith("../");
}

export function validateLinuxPackageInventory(inventory) {
  const errors = [];
  if (!validateSchema(inventory)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `Linux package inventory schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  if (inventory?.target?.architecture !== linuxPackageContract.architecture) {
    errors.push(`Linux package inventory target architecture must be ${linuxPackageContract.architecture}`);
  }
  if (inventory?.control?.packageName !== linuxPackageContract.packageName) {
    errors.push(`Linux package inventory package name must be ${linuxPackageContract.packageName}`);
  }
  const expectedArtifactName = expectedLinuxDebianArtifactName(inventory?.control?.version);
  if (inventory?.artifact?.path !== expectedArtifactName) {
    errors.push(`Linux package inventory artifact must be named ${expectedArtifactName}`);
  }
  const parsedDependencies = dependencyNames(inventory?.control?.dependencyExpression);
  if (
    JSON.stringify(inventory?.control?.dependencyNames)
    !== JSON.stringify(parsedDependencies)
  ) {
    errors.push("Linux package inventory dependency names must be sorted exact expression members");
  }
  const entryPaths = (inventory?.entries ?? []).map(({ path: entryPath }) => entryPath);
  const expectedEntryPaths = [...new Set(entryPaths)].sort(byteOrder);
  if (JSON.stringify(entryPaths) !== JSON.stringify(expectedEntryPaths)) {
    errors.push("Linux package inventory entries must have unique byte-sorted paths");
  }
  for (const entry of inventory?.entries ?? []) {
    if (entry.type === "symbolic-link" && !safeSymbolicLink(entry.path, entry.target)) {
      errors.push(`Linux package inventory symbolic link escapes its root: ${entry.path}`);
    }
  }
  const entriesByPath = new Map((inventory?.entries ?? []).map((entry) => [entry.path, entry]));
  const executable = entriesByPath.get(linuxPackageContract.executablePath);
  if (executable?.type !== "file" || (Number.parseInt(executable.mode, 8) & 0o111) === 0) {
    errors.push("Linux package inventory must contain the executable production binary");
  }
  for (const requiredPath of [
    linuxPackageContract.desktopEntryPath,
    linuxPackageContract.licensePath,
    ...linuxPackageContract.requiredIconPaths,
  ]) {
    if (entriesByPath.get(requiredPath)?.type !== "file") {
      errors.push(`Linux package inventory must contain ${requiredPath}`);
    }
  }
  if (!sha256Pattern.test(inventory?.artifact?.sha256 ?? "")) {
    errors.push("Linux package inventory artifact digest is invalid");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return inventory;
}

export function createLinuxPackageInventory({ packagePath, extractedRoot, control }) {
  const packageMetadata = statSync(packagePath);
  const inventory = {
    format: "org.fitfreed.linux-package-inventory",
    schemaVersion: 1,
    target: {
      architecture: linuxPackageContract.architecture,
      distributionFamily: "debian",
      packageFormat: linuxPackageContract.target,
    },
    artifact: {
      path: path.basename(packagePath),
      sha256: digest(readFileSync(packagePath)),
      size: packageMetadata.size,
    },
    control: {
      packageName: control.Package,
      version: control.Version,
      architecture: control.Architecture,
      maintainer: control.Maintainer,
      section: control.Section,
      priority: control.Priority,
      homepage: control.Homepage,
      description: control.Description,
      dependencyExpression: control.Depends,
      dependencyNames: dependencyNames(control.Depends),
    },
    entries: inventoryEntries(extractedRoot),
  };
  return validateLinuxPackageInventory(inventory);
}

export function linuxPackageInventoryName(version) {
  return `${expectedLinuxDebianArtifactName(version)}.inventory.json`;
}

export function generateLinuxPackageInventory({
  platform = process.platform,
  releaseDirectory = path.join(repositoryRoot, "src-tauri/target/release/bundle/deb"),
  run = execFileSync,
  version = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8")).version,
} = {}) {
  if (platform !== "linux") throw new Error("Linux package inventory generation requires Linux");
  let phase = "package-selection";
  let extractionDirectory;
  let temporaryInventoryPath;
  try {
    const packagePath = findLinuxDebianPackage(releaseDirectory, version);
    phase = "control-inspection";
    const control = parseDebianControl(
      run("dpkg-deb", ["--field", packagePath], { encoding: "utf8" }),
    );
    phase = "extraction";
    extractionDirectory = mkdtempSync(path.join(tmpdir(), "fitfreed-deb-inventory-"));
    run("dpkg-deb", ["--extract", packagePath, extractionDirectory], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    phase = "validation";
    const inventory = createLinuxPackageInventory({
      control,
      extractedRoot: extractionDirectory,
      packagePath,
    });
    const bytes = `${JSON.stringify(inventory, null, 2)}\n`;
    const inventoryPath = path.join(releaseDirectory, linuxPackageInventoryName(version));
    temporaryInventoryPath = `${inventoryPath}.tmp-${process.pid}`;
    phase = "evidence-write";
    writeFileSync(temporaryInventoryPath, bytes, { flag: "wx", mode: 0o600 });
    renameSync(temporaryInventoryPath, inventoryPath);
    temporaryInventoryPath = undefined;
    return {
      artifactSha256: inventory.artifact.sha256,
      entryCount: inventory.entries.length,
      inventoryPath,
      inventorySha256: digest(bytes),
      packageName: inventory.control.packageName,
      version: inventory.control.version,
    };
  } catch {
    throw new Error(`Debian package inventory generation failed during ${phase}`);
  } finally {
    if (temporaryInventoryPath) rmSync(temporaryInventoryPath, { force: true });
    if (extractionDirectory) rmSync(extractionDirectory, { force: true, recursive: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { inventoryPath, ...evidence } = generateLinuxPackageInventory();
    process.stdout.write(`${JSON.stringify({
      ...evidence,
      inventory: path.basename(inventoryPath),
    })}\n`);
  } catch (error) {
    process.stderr.write(`Linux package inventory generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
