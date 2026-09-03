import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  syntheticWindowsAuthenticodeSmoke,
  validateSyntheticWindowsAuthenticodeEvidence,
  windowsAuthenticodeSmokeCommand,
} from "./windows-authenticode-smoke.mjs";

const sourceBinaryPath = "C:\\candidate\\fitfreed.exe";

function evidence(overrides = {}) {
  return {
    schemaVersion: 1,
    profile: "synthetic-test",
    architecture: "x86_64",
    signedCopyVerified: true,
    sourceUnchanged: true,
    authorityRemoved: true,
    ...overrides,
  };
}

test("builds one non-interactive synthetic Authenticode smoke command", () => {
  const command = windowsAuthenticodeSmokeCommand({
    sourceBinaryPath,
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
  assert.match(command.arguments[6], /windows-authenticode-smoke\.ps1$/);
  assert.deepEqual(command.arguments.slice(7), [
    "-SourceBinaryPath",
    sourceBinaryPath,
    "-ExpectedVersion",
    "0.1.0",
  ]);
});

test("accepts only closed, completely cleaned synthetic evidence", () => {
  const accepted = evidence();
  assert.equal(validateSyntheticWindowsAuthenticodeEvidence(accepted), accepted);
  for (const [overrides, expected] of [
    [{ profile: "public" }, /synthetic-test/],
    [{ architecture: "arm64" }, /x86-64/],
    [{ signedCopyVerified: false }, /signed copy/],
    [{ sourceUnchanged: false }, /source binary/],
    [{ authorityRemoved: false }, /authority cleanup/],
    [{ certificateSubject: "private" }, /unexpected fields/],
  ]) {
    assert.throws(
      () => validateSyntheticWindowsAuthenticodeEvidence(evidence(overrides)),
      expected,
    );
  }
});

test("runs the native smoke and returns validated privacy-safe evidence", () => {
  const calls = [];
  const result = syntheticWindowsAuthenticodeSmoke({
    architecture: "x64",
    isFile: () => true,
    platform: "win32",
    run: (file, arguments_, options) => {
      calls.push({ file, arguments_, options });
      return { status: 0, stdout: `${JSON.stringify(evidence())}\n`, stderr: "" };
    },
    sourceBinaryPath,
    version: "0.1.0",
  });

  assert.deepEqual(result, evidence());
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options.stdio, ["ignore", "pipe", "pipe"]);
  assert.equal(
    Object.keys(calls[0].options.env).some((key) => key.startsWith("FITFREED_WINDOWS_")),
    false,
  );
});

test("rejects unsupported hosts and missing source binaries before native execution", () => {
  assert.throws(() => syntheticWindowsAuthenticodeSmoke({
    architecture: "arm64",
    isFile: () => true,
    platform: "win32",
    sourceBinaryPath,
    version: "0.1.0",
  }), /x86-64 Windows/);
  assert.throws(() => syntheticWindowsAuthenticodeSmoke({
    architecture: "x64",
    isFile: () => false,
    platform: "win32",
    sourceBinaryPath,
    version: "0.1.0",
  }), /unsigned release executable/);
});

test("bounds native failures and malformed evidence without exposing native output", () => {
  for (const [nativeResult, expected] of [
    [
      {
        status: 1,
        stdout: "certificate subject",
        stderr: "private detail\nFITFREED_AUTHENTICODE_SMOKE_PHASE=authority-cleanup\n",
      },
      /failed during authority-cleanup$/,
    ],
    [{ status: 0, stdout: "not-json", stderr: "" }, /returned invalid evidence$/],
  ]) {
    assert.throws(() => syntheticWindowsAuthenticodeSmoke({
      architecture: "x64",
      isFile: () => true,
      platform: "win32",
      run: () => nativeResult,
      sourceBinaryPath,
      version: "0.1.0",
    }), (error) => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /certificate|private/);
      return true;
    });
  }
});

test("keeps synthetic certificate authority creation and cleanup in one native boundary", () => {
  const source = readFileSync(
    new URL("./windows-authenticode-smoke.ps1", import.meta.url),
    "utf8",
  );
  for (const required of [
    "New-SelfSignedCertificate",
    'Cert:\\CurrentUser\\My',
    'Cert:\\CurrentUser\\Root',
    'Cert:\\CurrentUser\\TrustedPublisher',
    'FITFREED_WINDOWS_AUTHENTICODE_PROFILE = "synthetic-test"',
    "windows-authenticode-sign.mjs",
    "windows-authenticode-trust.ps1",
    "Remove-Item -LiteralPath $certificatePath -Force -DeleteKey",
    "FITFREED_AUTHENTICODE_SMOKE_PHASE=$phase",
  ]) {
    assert.ok(source.includes(required), `missing synthetic authority control: ${required}`);
  }
  assert.doesNotMatch(source, /Write-Host|Write-Output|Write-Warning/);
});
