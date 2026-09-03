import assert from "node:assert/strict";
import test from "node:test";

import { validateReleaseMetadata } from "./check-release-contracts.mjs";

function validMetadata() {
  return {
    npm: {
      name: "fitfreed",
      version: "0.1.0",
      private: true,
      license: "GPL-3.0-or-later",
      repository: { url: "https://github.com/purnalica/fitfreed" },
    },
    tauri: {
      productName: "FitFreed",
      version: "0.1.0",
      identifier: "org.fitfreed.desktop",
      bundle: {
        active: true,
        targets: "all",
        macOS: { minimumSystemVersion: "15.0" },
      },
    },
    publicTauri: {
      bundle: { createUpdaterArtifacts: true },
    },
    linuxTauri: {
      productName: "fitfreed",
      bundle: {
        targets: ["deb"],
        publisher: "FitFreed contributors",
        homepage: "https://fitfreed.org/",
        copyright: "Copyright FitFreed contributors",
        license: "GPL-3.0-or-later",
        licenseFile: "../LICENSE",
        category: "HealthcareAndFitness",
        shortDescription: "Explore your fitness history on your own computer.",
        longDescription:
          "FitFreed imports portable fitness data into a local library for private exploration, reports, and export.",
        linux: {
          deb: {
            desktopTemplate: "linux/fitfreed.desktop.hbs",
            files: { "/usr/share/doc/fitfreed/copyright": "../LICENSE" },
            section: "utils",
            priority: "optional",
          },
        },
      },
    },
    windowsTauri: {
      productName: "FitFreed",
      bundle: {
        targets: ["nsis"],
        publisher: "FitFreed contributors",
        homepage: "https://fitfreed.org/",
        copyright: "Copyright FitFreed contributors",
        license: "GPL-3.0-or-later",
        licenseFile: "../LICENSE",
        category: "HealthcareAndFitness",
        shortDescription: "Explore your fitness history on your own computer.",
        longDescription:
          "FitFreed imports portable fitness data into a local library for private exploration, reports, and export.",
        windows: {
          allowDowngrades: true,
          webviewInstallMode: { type: "offlineInstaller", silent: true },
          nsis: {
            installerIcon: "icons/icon.ico",
            uninstallerIcon: "icons/icon.ico",
            installMode: "currentUser",
            languages: ["English", "Spanish"],
            displayLanguageSelector: false,
          },
        },
      },
    },
    windowsPublicSigningTauri: {
      bundle: {
        windows: {
          signCommand: {
            cmd: "node",
            args: ["../scripts/windows-authenticode-sign.mjs", "%1"],
          },
        },
      },
    },
    recoveryBundleIdentifier: "org.fitfreed.desktop",
    windowsRecoveryIdentity: {
      applicationIdentifier: "org.fitfreed.desktop",
      executable: "fitfreed.exe",
      homepage: "https://fitfreed.org/",
      productName: "FitFreed",
      publisher: "FitFreed contributors",
      uninstaller: "uninstall.exe",
      uninstallRegistry:
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed",
    },
    cargoPackages: ["fitfreed", "fitfreed-application", "fitfreed-domain"].map((name) => ({
      path: `${name}/Cargo.toml`,
      name,
      version: "0.1.0",
      license: "GPL-3.0-or-later",
      repository: "https://github.com/purnalica/fitfreed",
    })),
  };
}

test("accepts one consistent private development release identity", () => {
  assert.deepEqual(validateReleaseMetadata(validMetadata(), "0.1.0"), {
    version: "0.1.0",
    productName: "FitFreed",
    identifier: "org.fitfreed.desktop",
    cargoPackages: ["fitfreed", "fitfreed-application", "fitfreed-domain"],
    linuxPackage: {
      architecture: "amd64",
      packageName: "fitfreed",
      productName: "fitfreed",
      target: "deb",
    },
    windowsPackage: {
      architecture: "x86_64",
      installMode: "currentUser",
      packageName: "FitFreed_0.1.0_x64-setup.exe",
      target: "nsis",
      webviewInstallMode: "offlineInstaller",
    },
    windowsPublicSigning: {
      arguments: ["../scripts/windows-authenticode-sign.mjs", "%1"],
      command: "node",
    },
  });
});

test("reports every inconsistent release identity in one actionable failure", () => {
  const metadata = validMetadata();
  metadata.tauri.version = "0.2.0";
  metadata.tauri.security = { capability: "wdio-webdriver" };
  metadata.recoveryBundleIdentifier = "org.fitfreed.other";
  metadata.windowsRecoveryIdentity.executable = "another.exe";
  metadata.cargoPackages[1].license = "UNKNOWN";
  metadata.linuxTauri.bundle.targets.push("appimage");
  metadata.windowsTauri.bundle.windows.nsis.installMode = "perMachine";
  metadata.windowsPublicSigningTauri.bundle.windows.timestampUrl = "https://unreviewed.invalid";

  assert.throws(
    () => validateReleaseMetadata(metadata, "0.3.0"),
    (error) => {
      assert.match(error.message, /Tauri version does not match package\.json/);
      assert.match(error.message, /production Tauri configuration contains E2E instrumentation/);
      assert.match(error.message, /update recovery bundle identifier does not match Tauri/);
      assert.match(error.message, /Windows recovery identity does not match the package contract/);
      assert.match(error.message, /fitfreed-application\/Cargo\.toml license mismatch/);
      assert.match(error.message, /Linux Tauri targets must contain only deb/);
      assert.match(error.message, /Windows NSIS install mode must be currentUser/);
      assert.match(error.message, /public signing overlay has unexpected Windows fields/);
      assert.match(error.message, /expected version 0\.3\.0, found 0\.1\.0/);
      return true;
    },
  );
});

test("rejects versions that are not semantic versions", () => {
  const metadata = validMetadata();
  metadata.npm.version = "01.0.0";
  metadata.tauri.version = "01.0.0";
  for (const cargoPackage of metadata.cargoPackages) cargoPackage.version = "01.0.0";

  assert.throws(
    () => validateReleaseMetadata(metadata),
    /invalid release version: 01\.0\.0/,
  );
});

test("rejects a macOS deployment target outside the supported boundary", () => {
  const metadata = validMetadata();
  metadata.tauri.bundle.macOS.minimumSystemVersion = "14.0";

  assert.throws(
    () => validateReleaseMetadata(metadata),
    /minimum supported macOS version must be 15\.0/,
  );
});

test("keeps the public Tauri overlay limited to updater artifact creation", () => {
  const missingArtifacts = validMetadata();
  missingArtifacts.publicTauri.bundle.createUpdaterArtifacts = false;
  assert.throws(
    () => validateReleaseMetadata(missingArtifacts),
    /must create updater artifacts/,
  );

  const embeddedTrust = validMetadata();
  embeddedTrust.publicTauri.plugins = {
    updater: { pubkey: "fixed-key", endpoints: ["https://updates.invalid/stable.json"] },
  };
  assert.throws(
    () => validateReleaseMetadata(embeddedTrust),
    /public Tauri overlay contains unexpected configuration/,
  );
});
