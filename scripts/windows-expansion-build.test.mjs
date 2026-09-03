import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertWindowsExpansionAuthoritySeparation,
  buildWindowsExpansionInput,
  verifyWindowsExpansionBuildOutput,
  windowsExpansionInputBuildArguments,
} from "./build-windows-expansion-input.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
const prepareSource = readFileSync(
  path.join(repositoryRoot, "scripts/prepare-windows-expansion-input.mjs"),
  "utf8",
);

const certificateSha1 = "1".repeat(40);
const certificateSha256 = "2".repeat(64);
const signToolPath = "C:\\Windows Kits\\10\\bin\\signtool.exe";

function activeConfiguration() {
  return {
    format: "org.fitfreed.public-update-configuration",
    schemaVersion: 2,
    status: "active",
    contract: "stable-v3",
    metadataEndpoint: "https://fitfreed.org/updates/stable.json",
    keys: [{ id: "stable-v3-primary", publicKey: "A".repeat(44) }],
  };
}

function publicEnvironment(overrides = {}) {
  return {
    FITFREED_WINDOWS_AUTHENTICODE_PROFILE: "public",
    FITFREED_WINDOWS_CERTIFICATE_SHA1: certificateSha1,
    FITFREED_WINDOWS_CERTIFICATE_SHA256: certificateSha256,
    FITFREED_WINDOWS_SIGNTOOL_PATH: signToolPath,
    FITFREED_WINDOWS_TIMESTAMP_URL: "https://timestamp.example.invalid/rfc3161",
    ...overrides,
  };
}

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-expansion-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const setupName = "FitFreed_0.1.0_x64-setup.exe";
  const setupPath = path.join(root, setupName);
  writeFileSync(setupPath, "signed setup bytes");
  return { root, setupName, setupPath };
}

test("uses public Authenticode without asking Tauri to create updater artifacts", () => {
  assert.equal(
    packageJson.scripts["package:windows-expansion-input"],
    "npm run icons && node scripts/build-windows-expansion-input.mjs",
  );
  assert.equal(
    packageJson.scripts["prepare:windows-expansion-input"],
    "node scripts/prepare-windows-expansion-input.mjs",
  );
  assert.deepEqual(windowsExpansionInputBuildArguments([], "win32", "x64"), [
    "--config",
    "src-tauri/tauri.windows.public-signing.conf.json",
    "--bundles",
    "nsis",
  ]);
  assert.throws(
    () => windowsExpansionInputBuildArguments([], "linux", "x64"),
    /requires Windows/,
  );
  assert.throws(
    () => windowsExpansionInputBuildArguments([], "win32", "arm64"),
    /x86-64 Windows/,
  );
  assert.match(
    prepareSource,
    /run\("npm", \["run", "package:windows-expansion-input"\]\)/u,
  );
  assert.doesNotMatch(
    prepareSource,
    /run\("npm", \["run", "package:windows"\]\)/u,
  );
});

test("builds with public channel trust and only the Authenticode authority", (context) => {
  const releaseDirectory = path.join(
    mkdtempSync(path.join(tmpdir(), "fitfreed-windows-expansion-build-test-")),
    "nsis",
  );
  context.after(() => rmSync(path.dirname(releaseDirectory), { force: true, recursive: true }));
  mkdirSync(releaseDirectory);
  writeFileSync(path.join(releaseDirectory, "stale.exe"), "stale");
  const calls = [];

  const result = buildWindowsExpansionInput({
    architecture: "x64",
    arguments_: ["--verbose"],
    build: (options) => calls.push(options),
    configuration: activeConfiguration(),
    environment: publicEnvironment(),
    isFile: () => true,
    platform: "win32",
    releaseDirectory,
    verifyOutput: (options) => {
      assert.equal(existsSync(path.join(releaseDirectory, "stale.exe")), false);
      assert.equal(options.certificateSha256, certificateSha256);
      assert.equal(options.signToolPath, signToolPath);
      return { setupSha256: "a".repeat(64) };
    },
  });

  assert.deepEqual(result, { setupSha256: "a".repeat(64) });
  assert.deepEqual(calls, [{
    arguments_: [
      "--config",
      "src-tauri/tauri.windows.public-signing.conf.json",
      "--bundles",
      "nsis",
      "--verbose",
    ],
    publicUpdateEnvironment: {
      FITFREED_PUBLIC_UPDATE_CONTRACT: "stable-v3",
      FITFREED_PUBLIC_UPDATE_ENDPOINT: "https://fitfreed.org/updates/stable.json",
      FITFREED_PUBLIC_UPDATE_TRUST: JSON.stringify({
        "stable-v3-primary": "A".repeat(44),
      }),
    },
  }]);
});

test("rejects inactive channel trust and any updater signing authority", () => {
  assert.throws(
    () => assertWindowsExpansionAuthoritySeparation({
      TAURI_SIGNING_PRIVATE_KEY_PATH: "forbidden",
    }),
    /must not receive updater signing authority/,
  );
  assert.throws(
    () => buildWindowsExpansionInput({
      architecture: "x64",
      build: () => assert.fail("build must not run"),
      configuration: activeConfiguration(),
      environment: publicEnvironment({ TAURI_SIGNING_PRIVATE_KEY: "forbidden" }),
      isFile: () => true,
      platform: "win32",
    }),
    /must not receive updater signing authority/,
  );
  assert.throws(
    () => buildWindowsExpansionInput({
      architecture: "x64",
      build: () => assert.fail("build must not run"),
      configuration: { ...activeConfiguration(), status: "inactive", keys: [] },
      environment: publicEnvironment(),
      isFile: () => true,
      platform: "win32",
    }),
    /public update channel is inactive/,
  );
});

test("removes unverified output after a build or trust failure", (context) => {
  const releaseDirectory = path.join(
    mkdtempSync(path.join(tmpdir(), "fitfreed-windows-expansion-failure-test-")),
    "nsis",
  );
  context.after(() => rmSync(path.dirname(releaseDirectory), { force: true, recursive: true }));

  assert.throws(
    () => buildWindowsExpansionInput({
      architecture: "x64",
      build: () => {
        mkdirSync(releaseDirectory, { recursive: true });
        writeFileSync(path.join(releaseDirectory, "partial.exe"), "partial");
      },
      configuration: activeConfiguration(),
      environment: publicEnvironment(),
      isFile: () => true,
      platform: "win32",
      releaseDirectory,
      verifyOutput: () => { throw new Error("candidate trust failed"); },
    }),
    /candidate trust failed/,
  );
  assert.equal(existsSync(releaseDirectory), false);
});

test("admits only one exact final setup", (context) => {
  const { root, setupName, setupPath } = fixture(context);
  const setupSha256 = createHash("sha256").update(readFileSync(setupPath)).digest("hex");
  const inspections = [];
  const result = verifyWindowsExpansionBuildOutput({
    architecture: "x64",
    certificateSha256,
    inspect: (options) => {
      inspections.push(options);
      return { fileSha256: setupSha256 };
    },
    platform: "win32",
    releaseDirectory: root,
    signToolPath,
    version: "0.1.0",
  });

  assert.deepEqual(result, { setup: setupName, setupSha256 });
  assert.equal(inspections[0].binaryPath, setupPath);
  assert.equal(inspections[0].requireTimestamp, true);
  assert.equal(inspections[0].signatureOnly, false);

  const externalLink = `${root}-linked.exe`;
  linkSync(setupPath, externalLink);
  try {
    assert.throws(
      () => verifyWindowsExpansionBuildOutput({
        architecture: "x64",
        certificateSha256,
        inspect: () => ({ fileSha256: setupSha256 }),
        platform: "win32",
        releaseDirectory: root,
        signToolPath,
        version: "0.1.0",
      }),
      /singly linked/,
    );
  } finally {
    rmSync(externalLink, { force: true });
  }
});

test("rejects extra output and trust that does not bind the setup bytes", (context) => {
  const { root } = fixture(context);
  writeFileSync(path.join(root, "unexpected.sig"), "unexpected");
  assert.throws(
    () => verifyWindowsExpansionBuildOutput({
      architecture: "x64",
      certificateSha256,
      inspect: () => ({ fileSha256: "f".repeat(64) }),
      platform: "win32",
      releaseDirectory: root,
      signToolPath,
      version: "0.1.0",
    }),
    /only the exact setup/,
  );
  rmSync(path.join(root, "unexpected.sig"));
  assert.throws(
    () => verifyWindowsExpansionBuildOutput({
      architecture: "x64",
      certificateSha256,
      inspect: () => ({ fileSha256: "f".repeat(64) }),
      platform: "win32",
      releaseDirectory: root,
      signToolPath,
      version: "0.1.0",
    }),
    /digest/,
  );
});
