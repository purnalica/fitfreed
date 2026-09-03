import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildWindowsPackage,
  windowsPackageBuildArguments,
} from "./build-windows-package.mjs";
import {
  expectedWindowsNsisArtifactName,
  validateWindowsPackageConfiguration,
  windowsPackageContract,
} from "./windows-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const windowsConfig = JSON.parse(
  readFileSync(path.join(repositoryRoot, "src-tauri/tauri.windows.conf.json"), "utf8"),
);

test("keeps the first Windows package identity and dependency boundary closed", () => {
  assert.deepEqual(validateWindowsPackageConfiguration(windowsConfig), {
    architecture: "x86_64",
    installMode: "currentUser",
    packageName: "FitFreed_0.1.0_x64-setup.exe",
    target: "nsis",
    webviewInstallMode: "offlineInstaller",
  });
  assert.equal(expectedWindowsNsisArtifactName("0.1.0"), "FitFreed_0.1.0_x64-setup.exe");
  assert.equal(windowsPackageContract.applicationIdentifier, "org.fitfreed.desktop");
  assert.equal(windowsPackageContract.executable, "fitfreed.exe");
  assert.deepEqual(windowsPackageContract.installerLanguages, ["English", "Spanish"]);

  const invalid = structuredClone(windowsConfig);
  invalid.productName = "fitfreed";
  invalid.bundle.targets.push("msi");
  invalid.bundle.fileAssociations = [{ ext: ["zip"] }];
  invalid.bundle.windows.allowDowngrades = false;
  invalid.bundle.windows.certificateThumbprint = "machine-specific-authority";
  invalid.bundle.windows.webviewInstallMode.type = "downloadBootstrapper";
  invalid.bundle.windows.nsis.installMode = "perMachine";
  invalid.bundle.windows.nsis.languages = ["English"];
  invalid.bundle.windows.nsis.displayLanguageSelector = true;
  invalid.bundle.windows.nsis.startMenuFolder = "Unreviewed";
  invalid.bundle.windows.nsis.installerHooks = "unreviewed.nsh";
  invalid.bundle.plugins = {};
  assert.throws(
    () => validateWindowsPackageConfiguration(invalid),
    (error) => {
      assert.match(error.message, /targets must contain only nsis/);
      assert.match(error.message, /productName must be FitFreed/);
      assert.match(error.message, /generic file association/);
      assert.match(error.message, /allow downgrades for authenticated recovery/);
      assert.match(error.message, /cannot contain signing authority/);
      assert.match(error.message, /offlineInstaller/);
      assert.match(error.message, /install mode must be currentUser/);
      assert.match(error.message, /languages must be English, Spanish/);
      assert.match(error.message, /language selector must remain disabled/);
      assert.match(error.message, /unexpected NSIS fields: installerHooks, startMenuFolder/);
      assert.match(error.message, /unexpected bundle fields: fileAssociations, plugins/);
      return true;
    },
  );
});

test("exposes a Windows-only production package command", () => {
  assert.equal(
    packageJson.scripts["package:windows"],
    "npm run icons && node scripts/build-windows-package.mjs",
  );
  assert.deepEqual(windowsPackageBuildArguments([], "win32", "x64"), ["--bundles", "nsis"]);
  assert.deepEqual(windowsPackageBuildArguments(["--verbose"], "win32", "x64"), [
    "--bundles",
    "nsis",
    "--verbose",
  ]);
  for (const arguments_ of [
    ["--bundles", "msi"],
    ["--config", "unreviewed.json"],
    ["--target", "aarch64-pc-windows-msvc"],
    ["--features", "unreviewed"],
  ]) {
    assert.throws(
      () => windowsPackageBuildArguments(arguments_, "win32", "x64"),
      /only accepts --verbose/,
    );
  }
  assert.throws(
    () => windowsPackageBuildArguments([], "linux", "x64"),
    /requires Windows/,
  );
  assert.throws(
    () => windowsPackageBuildArguments([], "win32", "arm64"),
    /requires x86-64/,
  );
});

test("builds only after configuration validation and rejects a failed package build", () => {
  const calls = [];
  buildWindowsPackage({
    arguments_: ["--verbose"],
    build: (options) => calls.push(options),
    platform: "win32",
    architecture: "x64",
  });
  assert.deepEqual(calls, [{ arguments_: ["--bundles", "nsis", "--verbose"] }]);

  assert.throws(
    () => buildWindowsPackage({
      build: () => {
        throw new Error("synthetic package failure");
      },
      platform: "win32",
      architecture: "x64",
    }),
    /synthetic package failure/,
  );
});
