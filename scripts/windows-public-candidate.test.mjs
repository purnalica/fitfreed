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
  buildWindowsPublicCandidate,
  verifyWindowsPublicCandidateOutputs,
  windowsPublicCandidateBuildArguments,
} from "./build-windows-public-candidate.mjs";

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

function publicEnvironment() {
  return {
    FITFREED_WINDOWS_AUTHENTICODE_PROFILE: "public",
    FITFREED_WINDOWS_CERTIFICATE_SHA1: certificateSha1,
    FITFREED_WINDOWS_CERTIFICATE_SHA256: certificateSha256,
    FITFREED_WINDOWS_SIGNTOOL_PATH: signToolPath,
    FITFREED_WINDOWS_TIMESTAMP_URL: "https://timestamp.example.invalid/rfc3161",
    TAURI_SIGNING_PRIVATE_KEY: "protected updater authority",
  };
}

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-public-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const setupName = "FitFreed_0.1.0_x64-setup.exe";
  const setupPath = path.join(root, setupName);
  const signaturePath = `${setupPath}.sig`;
  writeFileSync(setupPath, "signed setup bytes");
  writeFileSync(signaturePath, "updater signature");
  return { root, setupName, setupPath, signaturePath };
}

test("uses the updater and Authenticode overlays for only the x86-64 NSIS target", () => {
  assert.deepEqual(windowsPublicCandidateBuildArguments([], "win32", "x64"), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--config",
    "src-tauri/tauri.windows.public-signing.conf.json",
    "--bundles",
    "nsis",
  ]);
  assert.throws(
    () => windowsPublicCandidateBuildArguments([], "linux", "x64"),
    /requires Windows/,
  );
  assert.throws(
    () => windowsPublicCandidateBuildArguments([], "win32", "arm64"),
    /x86-64 Windows/,
  );
});

test("builds with both protected authorities and verifies the final setup", (context) => {
  const releaseDirectory = path.join(
    mkdtempSync(path.join(tmpdir(), "fitfreed-windows-public-build-test-")),
    "nsis",
  );
  context.after(() => rmSync(path.dirname(releaseDirectory), { force: true, recursive: true }));
  mkdirSync(releaseDirectory);
  writeFileSync(path.join(releaseDirectory, "stale.exe"), "stale");
  const calls = [];

  const result = buildWindowsPublicCandidate({
    architecture: "x64",
    arguments_: ["--verbose"],
    build: (options) => calls.push(options),
    configuration: activeConfiguration(),
    environment: publicEnvironment(),
    isFile: () => true,
    platform: "win32",
    releaseDirectory,
    verifyOutputs: (options) => {
      assert.equal(existsSync(path.join(releaseDirectory, "stale.exe")), false);
      assert.equal(options.certificateSha256, certificateSha256);
      assert.equal(options.signToolPath, signToolPath);
      return { setupSha256: "a".repeat(64), updaterSignature: "setup.exe.sig" };
    },
  });

  assert.deepEqual(result, {
    setupSha256: "a".repeat(64),
    updaterSignature: "setup.exe.sig",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].arguments_, [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--config",
    "src-tauri/tauri.windows.public-signing.conf.json",
    "--bundles",
    "nsis",
    "--verbose",
  ]);
  assert.equal(calls[0].publicUpdateEnvironment.FITFREED_PUBLIC_UPDATE_CONTRACT, "stable-v3");
});

test("rejects missing updater or public Authenticode authority before building", () => {
  const environmentWithoutUpdater = publicEnvironment();
  delete environmentWithoutUpdater.TAURI_SIGNING_PRIVATE_KEY;
  assert.throws(
    () => buildWindowsPublicCandidate({
      architecture: "x64",
      build: () => assert.fail("build must not run"),
      configuration: activeConfiguration(),
      environment: environmentWithoutUpdater,
      isFile: () => true,
      platform: "win32",
    }),
    /updater signing authority/,
  );

  assert.throws(
    () => buildWindowsPublicCandidate({
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

test("removes unverified public output after a build or trust failure", (context) => {
  const releaseDirectory = path.join(
    mkdtempSync(path.join(tmpdir(), "fitfreed-windows-public-failure-test-")),
    "nsis",
  );
  context.after(() => rmSync(path.dirname(releaseDirectory), { force: true, recursive: true }));

  assert.throws(
    () => buildWindowsPublicCandidate({
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
      verifyOutputs: () => { throw new Error("candidate trust failed"); },
    }),
    /candidate trust failed/,
  );
  assert.equal(existsSync(releaseDirectory), false);
});

test("admits only the closed final setup and updater-signature pair", (context) => {
  const { root, setupName, setupPath, signaturePath } = fixture(context);
  const setupSha256 = createHash("sha256")
    .update(readFileSync(setupPath))
    .digest("hex");
  const inspections = [];
  const result = verifyWindowsPublicCandidateOutputs({
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

  assert.deepEqual(result, {
    setup: setupName,
    setupSha256,
    updaterSignature: `${setupName}.sig`,
  });
  assert.equal(inspections.length, 1);
  assert.equal(inspections[0].binaryPath, setupPath);
  assert.equal(inspections[0].requireTimestamp, true);
  assert.equal(inspections[0].signatureOnly, false);

  writeFileSync(path.join(root, "unexpected.txt"), "unexpected");
  assert.throws(
    () => verifyWindowsPublicCandidateOutputs({
      architecture: "x64",
      certificateSha256,
      inspect: () => ({ fileSha256: setupSha256 }),
      platform: "win32",
      releaseDirectory: root,
      signToolPath,
      version: "0.1.0",
    }),
    /closed artifact set/,
  );
  rmSync(path.join(root, "unexpected.txt"));
  const externalLink = `${root}-linked.sig`;
  linkSync(signaturePath, externalLink);
  try {
    assert.throws(
      () => verifyWindowsPublicCandidateOutputs({
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

test("rejects a trust result that does not bind the final setup bytes", (context) => {
  const { root } = fixture(context);
  assert.throws(
    () => verifyWindowsPublicCandidateOutputs({
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
