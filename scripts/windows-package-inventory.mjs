import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import {
  expectedWindowsNsisArtifactName,
  windowsPackageContract,
} from "./windows-package-contract.mjs";
import {
  findWindowsNsisPackage,
  validateWindowsInstallationFacts,
  verifyWindowsPackageInstallation,
} from "./verify-windows-package-installation.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const schema = JSON.parse(
  readFileSync(new URL("../schemas/windows-package-inventory-v1.schema.json", import.meta.url)),
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

function signatureClaim(signature) {
  return {
    status: signature.status,
    certificateSha256: signature.certificateSha256,
    timestamped: signature.timestamped,
  };
}

export function validateWindowsPackageInventory(inventory) {
  const errors = [];
  if (!validateSchema(inventory)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `Windows package inventory schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  let expectedArtifactName;
  try {
    expectedArtifactName = expectedWindowsNsisArtifactName(inventory?.identity?.version);
  } catch {
    errors.push("Windows package inventory identity version is invalid");
  }
  if (expectedArtifactName && inventory?.artifact?.path !== expectedArtifactName) {
    errors.push(`Windows package inventory artifact must be named ${expectedArtifactName}`);
  }
  if (!sha256Pattern.test(inventory?.artifact?.sha256 ?? "")) {
    errors.push("Windows package inventory artifact digest is invalid");
  }
  const entries = Array.isArray(inventory?.entries) ? inventory.entries : [];
  const entryPaths = entries.map((entry) => entry?.path);
  const comparableEntryPaths = entryPaths.every((entryPath) => typeof entryPath === "string")
    ? entryPaths
    : [];
  const expectedEntryPaths = [...new Set(comparableEntryPaths)].sort(byteOrder);
  if (comparableEntryPaths.length !== entries.length
      || JSON.stringify(entryPaths) !== JSON.stringify(expectedEntryPaths)) {
    errors.push("Windows package inventory entries must have unique byte-sorted paths");
  }
  const entriesByPath = new Map(entries.map((entry) => [entry?.path, entry]));
  for (const requiredPath of [windowsPackageContract.executable, windowsPackageContract.uninstaller]) {
    if (!entriesByPath.has(requiredPath)) {
      errors.push(`Windows package inventory must contain ${requiredPath}`);
    }
  }
  if (inventory?.signatures?.profile === "public-authenticode") {
    const certificateFingerprints = [
      inventory.signatures.setup,
      inventory.signatures.executable,
      inventory.signatures.uninstaller,
    ].map((signature) => signature?.certificateSha256);
    if (new Set(certificateFingerprints).size !== 1) {
      errors.push("Windows public package signatures must use one admitted certificate");
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return inventory;
}

export function createWindowsPackageInventory({
  certificateSha256,
  facts,
  packagePath,
  signatureProfile = "unsigned-engineering",
  version,
}) {
  const metadata = statSync(packagePath);
  const packageSha256 = digest(readFileSync(packagePath));
  validateWindowsInstallationFacts(facts, version, {
    certificateSha256,
    packageSha256,
    signatureProfile,
  });
  const inventory = {
    format: "org.fitfreed.windows-package-inventory",
    schemaVersion: 1,
    target: {
      platform: "windows",
      architecture: windowsPackageContract.architecture,
      packageFormat: windowsPackageContract.target,
      installMode: windowsPackageContract.installMode,
    },
    artifact: {
      path: path.basename(packagePath),
      size: metadata.size,
      sha256: packageSha256,
    },
    identity: {
      applicationIdentifier: windowsPackageContract.applicationIdentifier,
      productName: windowsPackageContract.bundleProductName,
      version,
      publisher: windowsPackageContract.publisher,
      homepage: windowsPackageContract.homepage,
      installerLanguages: [...windowsPackageContract.installerLanguages],
    },
    installation: {
      applicationDataDirectory: facts.installation.applicationDataDirectory,
      installDirectory: facts.installation.installDirectory,
      executable: facts.installation.executable,
      uninstaller: facts.installation.uninstaller,
      uninstallRegistry: facts.installation.uninstallRegistry,
      startMenuShortcut: facts.installation.startMenuShortcut,
      desktopShortcut: facts.installation.desktopShortcut,
      webviewInstallMode: windowsPackageContract.webviewInstallMode,
      webview2Available: facts.installation.webview2Available,
    },
    signatures: {
      profile: signatureProfile,
      setup: signatureClaim(facts.package.signature),
      executable: signatureClaim(facts.installation.executableSignature),
      uninstaller: signatureClaim(facts.installation.uninstallerSignature),
    },
    entries: facts.installation.installedEntries.map((entry) => ({ ...entry })),
    removal: { ...facts.removal },
  };
  return validateWindowsPackageInventory(inventory);
}

export function windowsPackageInventoryName(version) {
  return `${expectedWindowsNsisArtifactName(version)}.inventory.json`;
}

export function generateWindowsPackageInventory({
  architecture = process.arch,
  certificateSha256,
  platform = process.platform,
  releaseDirectory = path.join(repositoryRoot, "src-tauri", "target", "release", "bundle", "nsis"),
  signatureProfile = "unsigned-engineering",
  signToolPath,
  verify = verifyWindowsPackageInstallation,
  version = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8")).version,
} = {}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows package inventory generation requires x86-64 Windows");
  }
  let phase = "package-selection";
  let temporaryInventoryPath;
  try {
    const packagePath = findWindowsNsisPackage(releaseDirectory, version);
    phase = "native-installation";
    const facts = verify({
      architecture,
      certificateSha256,
      packagePath,
      platform,
      signatureProfile,
      signToolPath,
      version,
    });
    phase = "inventory-validation";
    const inventory = createWindowsPackageInventory({
      certificateSha256,
      facts,
      packagePath,
      signatureProfile,
      version,
    });
    const bytes = `${JSON.stringify(inventory, null, 2)}\n`;
    const inventoryPath = path.join(releaseDirectory, windowsPackageInventoryName(version));
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
      productName: inventory.identity.productName,
      version: inventory.identity.version,
    };
  } catch {
    throw new Error(`Windows package inventory generation failed during ${phase}`);
  } finally {
    if (temporaryInventoryPath && existsSync(temporaryInventoryPath)) {
      rmSync(temporaryInventoryPath, { force: true });
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { inventoryPath, ...evidence } = generateWindowsPackageInventory();
    process.stdout.write(`${JSON.stringify({
      ...evidence,
      inventory: path.basename(inventoryPath),
    })}\n`);
  } catch (error) {
    process.stderr.write(`Windows package inventory generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
