import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createWindowsPackageInventory,
  generateWindowsPackageInventory,
  validateWindowsPackageInventory,
} from "./windows-package-inventory.mjs";

function installationFacts() {
  return {
    schemaVersion: 1,
    platform: "windows",
    architecture: "x86_64",
    packageFormat: "nsis",
    installMode: "currentUser",
    package: {
      productName: "FitFreed",
      version: "0.1.0",
      fileDescription: "FitFreed",
      fileVersion: "0.1.0",
      productVersion: "0.1.0",
      signatureStatus: "NotSigned",
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
      executableSignatureStatus: "NotSigned",
      uninstallerSignatureStatus: "NotSigned",
      installedEntries: [
        { path: "fitfreed.exe", size: 8192, sha256: "a".repeat(64) },
        { path: "uninstall.exe", size: 4096, sha256: "b".repeat(64) },
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
}

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-inventory-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const packagePath = path.join(root, "FitFreed_0.1.0_x64-setup.exe");
  writeFileSync(packagePath, "synthetic NSIS package bytes");
  return { packagePath, root };
}

test("creates one exact unsigned Windows package inventory", (context) => {
  const { packagePath } = fixture(context);
  const inventory = createWindowsPackageInventory({
    facts: installationFacts(),
    packagePath,
    version: "0.1.0",
  });

  assert.equal(validateWindowsPackageInventory(inventory), inventory);
  assert.equal(inventory.format, "org.fitfreed.windows-package-inventory");
  assert.deepEqual(inventory.target, {
    platform: "windows",
    architecture: "x86_64",
    packageFormat: "nsis",
    installMode: "currentUser",
  });
  assert.equal(inventory.artifact.path, "FitFreed_0.1.0_x64-setup.exe");
  assert.match(inventory.artifact.sha256, /^[0-9a-f]{64}$/);
  assert.equal(inventory.signatures.profile, "unsigned-engineering");
  assert.deepEqual(inventory.signatures.setup, {
    status: "NotSigned",
    certificateSha256: null,
    timestamped: false,
  });
  assert.deepEqual(inventory.entries, installationFacts().installation.installedEntries);
});

test("accepts only complete public Authenticode signature claims", (context) => {
  const { packagePath } = fixture(context);
  const inventory = createWindowsPackageInventory({
    facts: installationFacts(),
    packagePath,
    version: "0.1.0",
  });
  inventory.signatures = {
    profile: "public-authenticode",
    setup: {
      status: "Valid",
      certificateSha256: "c".repeat(64),
      timestamped: true,
    },
    executable: {
      status: "Valid",
      certificateSha256: "c".repeat(64),
      timestamped: true,
    },
    uninstaller: {
      status: "Valid",
      certificateSha256: "c".repeat(64),
      timestamped: true,
    },
  };

  assert.equal(validateWindowsPackageInventory(inventory), inventory);
  inventory.signatures.setup.timestamped = false;
  assert.throws(
    () => validateWindowsPackageInventory(inventory),
    /schema violation.*timestamped/s,
  );
  inventory.signatures.setup.timestamped = true;
  inventory.signatures.uninstaller.certificateSha256 = "d".repeat(64);
  assert.throws(
    () => validateWindowsPackageInventory(inventory),
    /one admitted certificate/,
  );
});

test("rejects identity drift, unsafe or unordered files, and undeclared fields", (context) => {
  const { packagePath } = fixture(context);
  const inventory = createWindowsPackageInventory({
    facts: installationFacts(),
    packagePath,
    version: "0.1.0",
  });
  inventory.identity.publisher = "unknown";
  inventory.entries.reverse();
  inventory.entries[1].path = "../fitfreed.exe";
  inventory.hostPath = "C:\\private\\machine";

  assert.throws(
    () => validateWindowsPackageInventory(inventory),
    (error) => {
      for (const fragment of [
        "schema violation",
        "byte-sorted paths",
        "fitfreed.exe",
      ]) {
        assert.match(error.message, new RegExp(fragment));
      }
      return true;
    },
  );
});

test("installs the exact setup once and writes deterministic adjacent evidence", (context) => {
  const { root } = fixture(context);
  const calls = [];
  const verify = (options) => {
    calls.push(options);
    return installationFacts();
  };

  const first = generateWindowsPackageInventory({
    architecture: "x64",
    platform: "win32",
    releaseDirectory: root,
    verify,
    version: "0.1.0",
  });
  const firstBytes = readFileSync(first.inventoryPath, "utf8");
  const second = generateWindowsPackageInventory({
    architecture: "x64",
    platform: "win32",
    releaseDirectory: root,
    verify,
    version: "0.1.0",
  });

  assert.equal(
    path.basename(first.inventoryPath),
    "FitFreed_0.1.0_x64-setup.exe.inventory.json",
  );
  assert.equal(readFileSync(second.inventoryPath, "utf8"), firstBytes);
  assert.equal(first.entryCount, 2);
  assert.match(first.artifactSha256, /^[0-9a-f]{64}$/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].packagePath, path.join(root, "FitFreed_0.1.0_x64-setup.exe"));
});

test("preserves prior inventory evidence when native installation fails", (context) => {
  const { root } = fixture(context);
  const inventoryPath = path.join(
    root,
    "FitFreed_0.1.0_x64-setup.exe.inventory.json",
  );
  writeFileSync(inventoryPath, "prior evidence\n");

  assert.throws(
    () => generateWindowsPackageInventory({
      architecture: "x64",
      platform: "win32",
      releaseDirectory: root,
      verify: () => { throw new Error("private native detail"); },
      version: "0.1.0",
    }),
    /Windows package inventory generation failed during native-installation/,
  );
  assert.equal(readFileSync(inventoryPath, "utf8"), "prior evidence\n");
  assert.equal(
    existsSync(`${inventoryPath}.tmp-${process.pid}`),
    false,
  );
});

test("keeps the schema and normative package-inventory documentation discoverable", () => {
  const document = readFileSync(
    new URL("../docs/data-formats/release/windows-package-inventory-v1.md", import.meta.url),
    "utf8",
  );
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  for (const value of [
    "org.fitfreed.windows-package-inventory",
    "schemaVersion",
    "public-authenticode",
    "certificateSha256",
    "installedEntries",
    "FitFreed_0.1.0_x64-setup.exe.inventory.json",
  ]) {
    assert.match(document, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(index, /release\/windows-package-inventory-v1\.md/);
});
