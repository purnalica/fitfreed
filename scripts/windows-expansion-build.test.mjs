import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertWindowsExpansionAuthoritySeparation,
  prepareWindowsSignPathInner,
  prepareWindowsSignPathSetup,
  validateWindowsSignPathInner,
  windowsSignPathBundleArguments,
} from "./build-windows-expansion-input.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
const certificateSha256 = "2".repeat(64);
const signToolPath = "C:\\Windows Kits\\10\\bin\\signtool.exe";

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-signpath-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const releaseExecutable = path.join(root, "release", "fitfreed.exe");
  const releaseDirectory = path.join(root, "release", "bundle", "nsis");
  const unsignedInner = path.join(root, "unsigned-inner");
  const signedInner = path.join(root, "signed-inner");
  const unsignedSetup = path.join(root, "unsigned-setup");
  return {
    releaseDirectory,
    releaseExecutable,
    root,
    signedInner,
    unsignedInner,
    unsignedSetup,
  };
}

function activeConfiguration() {
  return {
    contract: "stable-v3",
    format: "org.fitfreed.public-update-configuration",
    keys: [{ id: "stable-2026-1", publicKey: "A".repeat(44) }],
    metadataEndpoint: "https://fitfreed.org/updates/stable.json",
    schemaVersion: 2,
    status: "active",
  };
}

test("exposes separate commands for both SignPath packaging stages", () => {
  assert.equal(
    packageJson.scripts["prepare:windows-signpath-inner"],
    "npm run icons && node scripts/build-windows-expansion-input.mjs inner",
  );
  assert.equal(
    packageJson.scripts["prepare:windows-signpath-setup"],
    "node scripts/build-windows-expansion-input.mjs setup",
  );
  assert.deepEqual(windowsSignPathBundleArguments("win32", "x64"), [
    "--config",
    "src-tauri/tauri.windows.public-signing.conf.json",
    "--bundles",
    "nsis",
    "--ci",
  ]);
  assert.throws(() => windowsSignPathBundleArguments("linux", "x64"), /requires Windows/);
  assert.throws(() => windowsSignPathBundleArguments("win32", "arm64"), /x86-64/);
});

test("builds one closed unsigned inner artifact and removes the disposable setup", (context) => {
  const input = fixture(context);
  const calls = [];
  const result = prepareWindowsSignPathInner({
    architecture: "x64",
    assertSource: () => ({ revision: "a".repeat(40) }),
    audit: () => calls.push("audit"),
    build: (options) => {
      calls.push({ build: options });
      mkdirSync(path.dirname(input.releaseExecutable), { recursive: true });
      writeFileSync(input.releaseExecutable, "unsigned application");
    },
    bundle: (options) => {
      calls.push({ bundle: options });
      writeFileSync(
        path.join(options.additionalEnvironment.FITFREED_SIGNPATH_INNER_DIRECTORY, "uninstall.exe"),
        "unsigned uninstaller",
      );
      mkdirSync(input.releaseDirectory, { recursive: true });
      writeFileSync(path.join(input.releaseDirectory, "discarded.exe"), "discarded setup");
    },
    configuration: activeConfiguration(),
    outputDirectory: input.unsignedInner,
    platform: "win32",
    releaseDirectory: input.releaseDirectory,
    releaseExecutable: input.releaseExecutable,
    validateRelease: () => calls.push("release"),
    version: "0.1.12",
  });

  assert.deepEqual(readdirSync(input.unsignedInner).sort(), ["fitfreed.exe", "uninstall.exe"]);
  assert.equal(existsSync(input.releaseDirectory), false);
  assert.equal(result.profile, "signpath-unsigned-inner");
  assert.equal(calls[0], "release");
  assert.equal(calls[1], "audit");
  assert.deepEqual(calls[2].build.arguments_, ["--no-bundle", "--no-sign", "--ci"]);
  assert.equal(
    calls[3].bundle.additionalEnvironment.FITFREED_SIGNPATH_BRIDGE_MODE,
    "capture-uninstaller",
  );
});

test("verifies returned inner signatures and builds one unsigned setup", (context) => {
  const input = fixture(context);
  mkdirSync(path.dirname(input.releaseExecutable), { recursive: true });
  mkdirSync(input.unsignedInner);
  mkdirSync(input.signedInner);
  writeFileSync(input.releaseExecutable, "unsigned application");
  writeFileSync(path.join(input.unsignedInner, "fitfreed.exe"), "unsigned application");
  writeFileSync(path.join(input.unsignedInner, "uninstall.exe"), "unsigned uninstaller");
  writeFileSync(path.join(input.signedInner, "fitfreed.exe"), "signed application");
  writeFileSync(path.join(input.signedInner, "uninstall.exe"), "signed uninstaller");
  const inspections = [];

  const result = prepareWindowsSignPathSetup({
    architecture: "x64",
    assertSource: () => ({ revision: "a".repeat(40) }),
    bundle: (options) => {
      assert.equal(readFileSync(input.releaseExecutable, "utf8"), "signed application");
      assert.equal(
        options.additionalEnvironment.FITFREED_SIGNPATH_BRIDGE_MODE,
        "inject-signed-inner",
      );
      mkdirSync(input.releaseDirectory, { recursive: true });
      writeFileSync(
        path.join(input.releaseDirectory, "FitFreed_0.1.12_x64-setup.exe"),
        "unsigned setup with signed inner binaries",
      );
    },
    certificateSha256,
    inspect: (options) => {
      inspections.push(options);
      return {
        certificateSha256,
        fileSha256: createHash("sha256")
          .update(readFileSync(options.binaryPath))
          .digest("hex"),
        timestamped: true,
      };
    },
    outputDirectory: input.unsignedSetup,
    platform: "win32",
    releaseDirectory: input.releaseDirectory,
    releaseExecutable: input.releaseExecutable,
    signedInnerDirectory: input.signedInner,
    signToolPath,
    unsignedInnerDirectory: input.unsignedInner,
    validateRelease: () => {},
    version: "0.1.12",
  });

  assert.deepEqual(readdirSync(input.unsignedSetup), ["FitFreed_0.1.12_x64-setup.exe"]);
  assert.equal(result.profile, "signpath-unsigned-setup");
  assert.equal(inspections.length, 2);
  assert.equal(inspections[0].signatureOnly, false);
  assert.equal(inspections[1].signatureOnly, true);
});

test("rejects signing authority, incomplete artifacts, and untrusted SignPath output", (context) => {
  assert.throws(
    () => assertWindowsExpansionAuthoritySeparation({ TAURI_SIGNING_PRIVATE_KEY: "forbidden" }),
    /updater signing authority/,
  );
  assert.throws(
    () => assertWindowsExpansionAuthoritySeparation({ FITFREED_WINDOWS_CERTIFICATE_BASE64: "forbidden" }),
    /local Authenticode authority/,
  );
  assert.throws(
    () => assertWindowsExpansionAuthoritySeparation({ FITFREED_SIGNPATH_API_TOKEN: "forbidden" }),
    /SignPath request authority/,
  );

  const input = fixture(context);
  mkdirSync(input.signedInner);
  writeFileSync(path.join(input.signedInner, "fitfreed.exe"), "signed application");
  assert.throws(
    () => validateWindowsSignPathInner({
      certificateSha256,
      directory: input.signedInner,
      inspect: () => assert.fail("inspection must not start"),
      platform: "win32",
      signToolPath,
      version: "0.1.12",
    }),
    /exactly the application and uninstaller/,
  );
  writeFileSync(path.join(input.signedInner, "uninstall.exe"), "signed uninstaller");
  assert.throws(
    () => validateWindowsSignPathInner({
      certificateSha256: "INVALID",
      directory: input.signedInner,
      inspect: () => assert.fail("inspection must not start"),
      platform: "win32",
      signToolPath,
      version: "0.1.12",
    }),
    /lowercase SHA-256 certificate fingerprint/,
  );
});
