import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectWindowsAuthenticode,
  validateWindowsAuthenticodeFacts,
  windowsAuthenticodeTrustCommand,
} from "./windows-authenticode-trust.mjs";

const certificateSha256 = "c".repeat(64);

function completeFacts(overrides = {}) {
  return {
    schemaVersion: 1,
    status: "Valid",
    certificateSha256,
    timestamped: true,
    fileSha256: "f".repeat(64),
    architecture: "x86_64",
    productName: "FitFreed",
    fileDescription: "FitFreed",
    fileVersion: "0.1.0",
    productVersion: "0.1.0",
    ...overrides,
  };
}

test("builds one non-interactive native Authenticode trust command", () => {
  const command = windowsAuthenticodeTrustCommand({
    binaryPath: "C:\\candidate\\FitFreed_0.1.0_x64-setup.exe",
    certificateSha256,
    requireTimestamp: true,
    signatureOnly: false,
    signToolPath: "C:\\Windows Kits\\10\\bin\\signtool.exe",
    version: "0.1.0",
  });

  assert.equal(command.file, "powershell.exe");
  assert.deepEqual(command.arguments.slice(0, 5), [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
  ]);
  assert.match(command.arguments[6], /windows-authenticode-trust\.ps1$/);
  assert.deepEqual(command.arguments.slice(7), [
    "-BinaryPath",
    "C:\\candidate\\FitFreed_0.1.0_x64-setup.exe",
    "-SignToolPath",
    "C:\\Windows Kits\\10\\bin\\signtool.exe",
    "-ExpectedCertificateSha256",
    certificateSha256,
    "-ExpectedVersion",
    "0.1.0",
    "-RequireTimestamp",
  ]);
});

test("accepts complete full and signature-only Authenticode evidence", () => {
  const full = completeFacts();
  assert.equal(validateWindowsAuthenticodeFacts(full, {
    certificateSha256,
    requireTimestamp: true,
    version: "0.1.0",
  }), full);

  const signatureOnly = {
    schemaVersion: 1,
    status: "Valid",
    certificateSha256,
    timestamped: false,
    fileSha256: "a".repeat(64),
  };
  assert.equal(validateWindowsAuthenticodeFacts(signatureOnly, {
    certificateSha256,
    requireTimestamp: false,
    signatureOnly: true,
  }), signatureOnly);
});

test("rejects absent public timestamps, identity drift, architecture drift, and open evidence", () => {
  for (const [overrides, expected] of [
    [{ timestamped: false }, /timestamp state/],
    [{ certificateSha256: "d".repeat(64) }, /certificate fingerprint/],
    [{ fileSha256: "invalid" }, /file digest/],
    [{ architecture: "arm64" }, /x86-64/],
    [{ productName: "Another product" }, /product identity/],
    [{ fileVersion: "0.2.0" }, /version metadata/],
    [{ machinePath: "C:\\private" }, /unexpected fields/],
  ]) {
    assert.throws(
      () => validateWindowsAuthenticodeFacts(completeFacts(overrides), {
        certificateSha256,
        requireTimestamp: true,
        version: "0.1.0",
      }),
      expected,
    );
  }
});

test("runs native inspection and returns only validated closed evidence", () => {
  const calls = [];
  const facts = completeFacts();
  const result = inspectWindowsAuthenticode({
    binaryPath: "C:\\candidate\\fitfreed.exe",
    certificateSha256,
    isFile: () => true,
    platform: "win32",
    run: (file, arguments_, options) => {
      calls.push({ file, arguments_, options });
      return { status: 0, stdout: `${JSON.stringify(facts)}\n`, stderr: "" };
    },
    signToolPath: "C:\\kits\\signtool.exe",
    version: "0.1.0",
  });

  assert.deepEqual(result, facts);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.encoding, "utf8");
  assert.deepEqual(calls[0].options.stdio, ["ignore", "pipe", "pipe"]);
});

test("bounds native and malformed-evidence failures without exposing command output", () => {
  for (const [nativeResult, expected] of [
    [
      {
        status: 1,
        stdout: "private native output",
        stderr: "secret detail\nFITFREED_AUTHENTICODE_PHASE=signature-inspection\n",
      },
      /failed during signature-inspection$/,
    ],
    [{ status: 0, stdout: "not-json", stderr: "" }, /returned invalid evidence$/],
  ]) {
    assert.throws(
      () => inspectWindowsAuthenticode({
        binaryPath: "C:\\candidate\\fitfreed.exe",
        certificateSha256,
        isFile: () => true,
        platform: "win32",
        run: () => nativeResult,
        signToolPath: "C:\\kits\\signtool.exe",
        version: "0.1.0",
      }),
      (error) => {
        assert.match(error.message, expected);
        assert.doesNotMatch(error.message, /private|secret/);
        return true;
      },
    );
  }
});

test("rejects unsupported hosts, unsafe inputs, and invalid trust parameters before execution", () => {
  assert.throws(
    () => inspectWindowsAuthenticode({
      binaryPath: "C:\\candidate\\fitfreed.exe",
      certificateSha256,
      platform: "linux",
      signToolPath: "C:\\kits\\signtool.exe",
      version: "0.1.0",
    }),
    /requires Windows/,
  );
  for (const options of [
    { binaryPath: "relative.exe" },
    { signToolPath: "C:\\kits\\another.exe" },
    { certificateSha256: certificateSha256.toUpperCase() },
    { version: "v0.1" },
  ]) {
    assert.throws(() => windowsAuthenticodeTrustCommand({
      binaryPath: "C:\\candidate\\fitfreed.exe",
      certificateSha256,
      requireTimestamp: true,
      signatureOnly: false,
      signToolPath: "C:\\kits\\signtool.exe",
      version: "0.1.0",
      ...options,
    }));
  }
});

test("keeps the native inspector fail-closed and free of authority output", () => {
  const source = readFileSync(
    new URL("./windows-authenticode-trust.ps1", import.meta.url),
    "utf8",
  );
  for (const required of [
    'Set-StrictMode -Version Latest',
    '@("verify", "/pa", "/all")',
    'if ($RequireTimestamp) { $verifyArguments += "/tw" }',
    'Assert-Equal $LASTEXITCODE 0',
    'Get-AuthenticodeSignature -FilePath $BinaryPath',
    'Assert-Equal $signature.Status.ToString() "Valid"',
    'Assert-Equal $reader.ReadUInt16() 0x8664',
    'FITFREED_AUTHENTICODE_PHASE=$phase',
  ]) {
    assert.ok(source.includes(required), `missing native trust control: ${required}`);
  }
  assert.doesNotMatch(source, /Write-Host|Write-Output|Write-Warning/);
});
