import assert from "node:assert/strict";
import test from "node:test";

import {
  signWindowsAuthenticode,
  windowsAuthenticodeAuthority,
  windowsAuthenticodeSigningPlan,
} from "./windows-authenticode-sign.mjs";

const certificateSha1 = "1".repeat(40);
const certificateSha256 = "2".repeat(64);
const binaryPath = "C:\\candidate\\fitfreed.exe";
const signToolPath = "C:\\Windows Kits\\10\\bin\\signtool.exe";

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

test("creates the exact public SHA-256 RFC 3161 signing plan", () => {
  assert.deepEqual(windowsAuthenticodeSigningPlan({
    binaryPath,
    environment: publicEnvironment(),
    isFile: () => true,
    platform: "win32",
    version: "0.1.0",
  }), {
    arguments: [
      "sign",
      "/sha1",
      certificateSha1.toUpperCase(),
      "/fd",
      "SHA256",
      "/tr",
      "https://timestamp.example.invalid/rfc3161",
      "/td",
      "SHA256",
      binaryPath,
    ],
    binaryPath,
    certificateSha256,
    profile: "public",
    requireTimestamp: true,
    signToolPath,
    version: "0.1.0",
  });
});

test("admits the protected public authority before the bundler creates a binary", () => {
  assert.deepEqual(windowsAuthenticodeAuthority({
    environment: publicEnvironment(),
    isFile: () => true,
    platform: "win32",
  }), {
    certificateSha1,
    certificateSha256,
    profile: "public",
    requireTimestamp: true,
    signToolPath,
    timestampUrl: "https://timestamp.example.invalid/rfc3161",
  });
});

test("creates an explicit untimestamped synthetic-test plan", () => {
  const environment = publicEnvironment({
    FITFREED_WINDOWS_AUTHENTICODE_PROFILE: "synthetic-test",
  });
  delete environment.FITFREED_WINDOWS_TIMESTAMP_URL;
  const plan = windowsAuthenticodeSigningPlan({
    binaryPath,
    environment,
    isFile: () => true,
    platform: "win32",
    version: "0.1.0",
  });

  assert.equal(plan.profile, "synthetic-test");
  assert.equal(plan.requireTimestamp, false);
  assert.deepEqual(plan.arguments, [
    "sign",
    "/sha1",
    certificateSha1.toUpperCase(),
    "/fd",
    "SHA256",
    binaryPath,
  ]);
});

test("rejects incomplete, ambiguous, unsafe, or cross-profile authority", () => {
  const credentialedTimestamp = new URL("https://example.invalid");
  credentialedTimestamp.username = "user";
  credentialedTimestamp.password = "secret";
  const invalid = [
    [publicEnvironment({ FITFREED_WINDOWS_AUTHENTICODE_PROFILE: "other" }), /profile/],
    [publicEnvironment({ FITFREED_WINDOWS_CERTIFICATE_SHA1: "short" }), /SHA-1/],
    [publicEnvironment({ FITFREED_WINDOWS_CERTIFICATE_SHA256: "A".repeat(64) }), /SHA-256/],
    [publicEnvironment({ FITFREED_WINDOWS_SIGNTOOL_PATH: "relative\\signtool.exe" }), /absolute Windows/],
    [publicEnvironment({ FITFREED_WINDOWS_SIGNTOOL_PATH: "C:\\kits\\other.exe" }), /signtool\.exe/],
    [publicEnvironment({ FITFREED_WINDOWS_TIMESTAMP_URL: "http://timestamp.invalid" }), /HTTPS/],
    [publicEnvironment({ FITFREED_WINDOWS_TIMESTAMP_URL: credentialedTimestamp.href }), /public HTTPS/],
    [publicEnvironment({ FITFREED_WINDOWS_TIMESTAMP_URL: "https://example.invalid/path?token=x" }), /public HTTPS/],
    [
      publicEnvironment({ FITFREED_WINDOWS_AUTHENTICODE_PROFILE: "synthetic-test" }),
      /must not use a timestamp authority/,
    ],
  ];
  for (const [environment, expected] of invalid) {
    assert.throws(() => windowsAuthenticodeSigningPlan({
      binaryPath,
      environment,
      isFile: () => true,
      platform: "win32",
      version: "0.1.0",
    }), expected);
  }
  assert.throws(() => windowsAuthenticodeSigningPlan({
    binaryPath: "C:\\candidate\\fitfreed.dll",
    environment: publicEnvironment(),
    isFile: () => true,
    platform: "win32",
    version: "0.1.0",
  }), /executable/);
  assert.throws(() => windowsAuthenticodeSigningPlan({
    binaryPath,
    environment: publicEnvironment(),
    isFile: () => true,
    platform: "linux",
    version: "0.1.0",
  }), /requires Windows/);
  assert.throws(() => windowsAuthenticodeSigningPlan({
    binaryPath,
    environment: publicEnvironment(),
    isFile: () => false,
    platform: "win32",
    version: "0.1.0",
  }), /regular input files/);
});

test("signs once and independently verifies the resulting certificate and timestamp", () => {
  const calls = [];
  const inspections = [];
  const facts = {
    schemaVersion: 1,
    status: "Valid",
    certificateSha256,
    timestamped: true,
    fileSha256: "f".repeat(64),
  };
  const result = signWindowsAuthenticode({
    binaryPath,
    environment: publicEnvironment(),
    inspect: (options) => {
      inspections.push(options);
      return facts;
    },
    isFile: () => true,
    platform: "win32",
    run: (file, arguments_, options) => {
      calls.push({ file, arguments_, options });
      return { status: 0, stdout: "private SignTool detail", stderr: "" };
    },
    version: "0.1.0",
  });

  assert.deepEqual(result, {
    certificateSha256,
    fileSha256: "f".repeat(64),
    profile: "public",
    timestamped: true,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, signToolPath);
  assert.deepEqual(calls[0].arguments_, windowsAuthenticodeSigningPlan({
    binaryPath,
    environment: publicEnvironment(),
    isFile: () => true,
    platform: "win32",
    version: "0.1.0",
  }).arguments);
  assert.deepEqual(calls[0].options.stdio, ["ignore", "pipe", "pipe"]);
  assert.deepEqual(inspections, [{
    binaryPath,
    certificateSha256,
    isFile: inspections[0].isFile,
    platform: "win32",
    requireTimestamp: true,
    signatureOnly: true,
    signToolPath,
    version: "0.1.0",
  }]);
});

test("bounds signing and post-signature verification failures", () => {
  assert.throws(() => signWindowsAuthenticode({
    binaryPath,
    environment: publicEnvironment(),
    inspect: () => assert.fail("inspection must not run"),
    isFile: () => true,
    platform: "win32",
    run: () => ({ status: 1, stdout: "certificate subject", stderr: "private failure" }),
    version: "0.1.0",
  }), (error) => {
    assert.equal(error.message, "Windows Authenticode signing failed during signing");
    assert.doesNotMatch(error.message, /certificate|private/);
    return true;
  });

  assert.throws(() => signWindowsAuthenticode({
    binaryPath,
    environment: publicEnvironment(),
    inspect: () => { throw new Error("private certificate detail"); },
    isFile: () => true,
    platform: "win32",
    run: () => ({ status: 0, stdout: "", stderr: "" }),
    version: "0.1.0",
  }), (error) => {
    assert.equal(error.message, "Windows Authenticode signing failed during trust-verification");
    assert.doesNotMatch(error.message, /certificate|private/);
    return true;
  });

  const syntheticEnvironment = publicEnvironment({
    FITFREED_WINDOWS_AUTHENTICODE_PROFILE: "synthetic-test",
  });
  delete syntheticEnvironment.FITFREED_WINDOWS_TIMESTAMP_URL;
  assert.throws(() => signWindowsAuthenticode({
    binaryPath,
    environment: syntheticEnvironment,
    inspect: () => ({
      certificateSha256,
      fileSha256: "f".repeat(64),
      timestamped: true,
    }),
    isFile: () => true,
    platform: "win32",
    run: () => ({ status: 0, stdout: "", stderr: "" }),
    version: "0.1.0",
  }), /failed during trust-verification/);
});
