import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createWindowsPackageInventory } from "../windows-package-inventory.mjs";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function signature(certificateSha256, fileSha256) {
  return {
    certificateSha256,
    fileSha256,
    status: "Valid",
    timestamped: true,
  };
}

export function createWindowsExpansionInputFixture({
  certificateSha256 = "c".repeat(64),
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-expansion-input-"));
  const buildDirectory = path.join(root, "build");
  const outputDirectory = path.join(root, "input");
  mkdirSync(buildDirectory);
  const version = "0.2.0";
  const revision = "a".repeat(40);
  const packageName = `FitFreed_${version}_x64-setup.exe`;
  const packagePath = path.join(buildDirectory, packageName);
  const packageBytes = "exact synthetic Authenticode-signed NSIS package bytes";
  writeFileSync(packagePath, packageBytes);
  const executableSha256 = digest("synthetic installed executable bytes");
  const uninstallerSha256 = digest("synthetic installed uninstaller bytes");
  const facts = {
    schemaVersion: 2,
    signatureProfile: "public-authenticode",
    platform: "windows",
    architecture: "x86_64",
    packageFormat: "nsis",
    installMode: "currentUser",
    package: {
      productName: "FitFreed",
      version,
      fileDescription: "FitFreed",
      fileVersion: version,
      productVersion: version,
      signature: signature(certificateSha256, digest(packageBytes)),
    },
    installation: {
      applicationDataDirectory: "%APPDATA%\\org.fitfreed.desktop",
      publisher: "FitFreed contributors",
      homepage: "https://fitfreed.org/",
      installDirectory: "%LOCALAPPDATA%\\FitFreed",
      executable: "fitfreed.exe",
      uninstaller: "uninstall.exe",
      uninstallRegistry:
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed",
      startMenuShortcut:
        "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\FitFreed.lnk",
      desktopShortcut: "%USERPROFILE%\\Desktop\\FitFreed.lnk",
      executableSignature: signature(certificateSha256, executableSha256),
      uninstallerSignature: signature(certificateSha256, uninstallerSha256),
      installedEntries: [
        { path: "fitfreed.exe", size: 8192, sha256: executableSha256 },
        { path: "uninstall.exe", size: 4096, sha256: uninstallerSha256 },
      ],
      webview2Available: true,
    },
    removal: {
      packageFilesRemoved: true,
      registrationRemoved: true,
      shortcutsRemoved: true,
      applicationDataPreserved: true,
    },
  };
  const inventory = createWindowsPackageInventory({
    certificateSha256,
    facts,
    packagePath,
    signatureProfile: "public-authenticode",
    version,
  });
  const inventoryPath = path.join(buildDirectory, `${packageName}.inventory.json`);
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  return {
    authenticodeCertificateSha256: certificateSha256,
    inventoryPath,
    outputDirectory,
    packageName,
    packagePath,
    revision,
    root,
    updateConfiguration: {
      format: "org.fitfreed.public-update-configuration",
      schemaVersion: 2,
      status: "active",
      contract: "stable-v3",
      metadataEndpoint: "https://fitfreed.org/updates/stable.json",
      keys: [
        { id: "stable-2026-2", publicKey: "B".repeat(44) },
        { id: "stable-2026-1", publicKey: "A".repeat(44) },
      ],
    },
    version,
  };
}
