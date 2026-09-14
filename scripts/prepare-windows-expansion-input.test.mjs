import assert from "node:assert/strict";
import {
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  prepareWindowsExpansionInput,
  stageWindowsExpansionInput,
  validateWindowsSignPathSetup,
  verifyWindowsExpansionInput,
} from "./prepare-windows-expansion-input.mjs";
import { createWindowsExpansionInputFixture } from "./test-support/windows-expansion-input.mjs";

function stage(input, overrides = {}) {
  return stageWindowsExpansionInput({
    ...input,
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
    ...overrides,
  });
}

function verify(input, overrides = {}) {
  return verifyWindowsExpansionInput({
    authenticodeCertificateSha256: input.authenticodeCertificateSha256,
    directory: input.outputDirectory,
    revision: input.revision,
    storageSchemaVersion: 37,
    updateConfiguration: input.updateConfiguration,
    version: input.version,
    ...overrides,
  });
}

function signedSetupTrust(input, overrides = {}) {
  return {
    architecture: "x86_64",
    certificateSha256: input.authenticodeCertificateSha256,
    fileDescription: "FitFreed",
    fileSha256: input.packageSha256,
    fileVersion: input.version,
    productName: "FitFreed",
    productVersion: input.version,
    schemaVersion: 1,
    status: "Valid",
    timestamped: true,
    ...overrides,
  };
}

function prepareFixture(context) {
  const input = createWindowsExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  const signedSetupDirectory = path.join(input.root, "signed-setup");
  mkdirSync(signedSetupDirectory);
  const signedSetupPath = path.join(signedSetupDirectory, input.packageName);
  copyFileSync(input.packagePath, signedSetupPath);
  const packageSha256 = input.packageSha256;
  return { ...input, packageSha256, signedSetupDirectory, signedSetupPath };
}

test("admits only the exact timestamped setup returned by SignPath", (context) => {
  const input = prepareFixture(context);
  const calls = [];

  assert.deepEqual(validateWindowsSignPathSetup({
    certificateSha256: input.authenticodeCertificateSha256,
    directory: input.signedSetupDirectory,
    inspect: (options) => {
      calls.push(options);
      return signedSetupTrust(input);
    },
    platform: "win32",
    signToolPath: "C:\\Windows Kits\\signtool.exe",
    version: input.version,
  }), {
    packageName: input.packageName,
    packagePath: input.signedSetupPath,
    packageSha256: input.packageSha256,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signatureOnly, false);
  assert.equal(calls[0].requireTimestamp, true);

  writeFileSync(path.join(input.signedSetupDirectory, "unexpected.txt"), "unexpected");
  assert.throws(
    () => validateWindowsSignPathSetup({
      certificateSha256: input.authenticodeCertificateSha256,
      directory: input.signedSetupDirectory,
      inspect: () => signedSetupTrust(input),
      platform: "win32",
      signToolPath: "C:\\Windows Kits\\signtool.exe",
      version: input.version,
    }),
    /must contain exactly/,
  );
  assert.throws(
    () => validateWindowsSignPathSetup({
      certificateSha256: "INVALID",
      directory: input.signedSetupDirectory,
      inspect: () => assert.fail("inspection must not start"),
      platform: "win32",
      signToolPath: "C:\\Windows Kits\\signtool.exe",
      version: input.version,
    }),
    /lowercase SHA-256 certificate fingerprint/,
  );
});

test("turns independently verified SignPath output into the exact native handoff", (context) => {
  const input = prepareFixture(context);
  const calls = [];
  const result = prepareWindowsExpansionInput({
    architecture: "x64",
    assertSource: () => ({ revision: input.revision, sourceDateEpoch: "1788422400" }),
    certificateSha256: input.authenticodeCertificateSha256,
    environment: {},
    generateInventory: (options) => {
      calls.push(options);
      const inventoryPath = path.join(
        options.releaseDirectory,
        `${input.packageName}.inventory.json`,
      );
      copyFileSync(input.inventoryPath, inventoryPath);
      return { inventoryPath };
    },
    inspect: () => signedSetupTrust(input),
    outputDirectory: input.outputDirectory,
    platform: "win32",
    readStorageSchema: () => 37,
    signedSetupDirectory: input.signedSetupDirectory,
    signToolPath: "C:\\Windows Kits\\signtool.exe",
    updateConfiguration: input.updateConfiguration,
    validateRelease: () => {},
    version: input.version,
  });

  assert.deepEqual(verify(input), result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signatureProfile, "public-authenticode");
  assert.equal(calls[0].certificateSha256, input.authenticodeCertificateSha256);
  assert.equal(readdirSync(input.root).some((entry) => entry.includes(".inspection-")), false);
});

test("rejects invalid SignPath trust and overlapping output", (context) => {
  const input = prepareFixture(context);
  const options = {
    architecture: "x64",
    assertSource: () => ({ revision: input.revision, sourceDateEpoch: "1788422400" }),
    certificateSha256: input.authenticodeCertificateSha256,
    environment: {},
    generateInventory: () => { throw new Error("must not inspect an untrusted setup"); },
    outputDirectory: input.outputDirectory,
    platform: "win32",
    readStorageSchema: () => 37,
    signedSetupDirectory: input.signedSetupDirectory,
    signToolPath: "C:\\Windows Kits\\signtool.exe",
    updateConfiguration: input.updateConfiguration,
    validateRelease: () => {},
    version: input.version,
  };

  assert.throws(
    () => prepareWindowsExpansionInput({
      ...options,
      inspect: () => signedSetupTrust(input, { timestamped: false }),
    }),
    /trust does not bind/,
  );
  assert.throws(
    () => prepareWindowsExpansionInput({
      ...options,
      inspect: () => signedSetupTrust(input),
      outputDirectory: path.join(input.signedSetupDirectory, "nested"),
    }),
    /must not overlap/,
  );
  assert.throws(
    () => prepareWindowsExpansionInput({
      ...options,
      inspect: () => signedSetupTrust(input),
      signedSetupDirectory: undefined,
    }),
    /setup output directory is required/,
  );
});

test("stages one exact authority-free Windows input for protected composition", (context) => {
  const input = createWindowsExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));

  const result = stage(input);

  assert.deepEqual(readdirSync(input.outputDirectory).sort(), [
    input.packageName,
    `${input.packageName}.build.json`,
    `${input.packageName}.inventory.json`,
  ]);
  assert.deepEqual(verify(input), result);
  const evidence = JSON.parse(
    readFileSync(path.join(input.outputDirectory, `${input.packageName}.build.json`), "utf8"),
  );
  assert.deepEqual(evidence.update.trustedKeyIds, ["stable-2026-1", "stable-2026-2"]);
  assert.doesNotMatch(
    JSON.stringify(evidence),
    /privateKey|signToolPath|certificateSubject|runner|hostname|workflow|[A-Z]:\\/i,
  );
});

test("rejects stale source, storage, update trust, and unexpected input", (context) => {
  const input = createWindowsExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  stage(input);

  assert.throws(() => verify(input, { revision: "b".repeat(40) }), /revision does not match/);
  assert.throws(() => verify(input, { storageSchemaVersion: 38 }), /storage schema does not match/);
  assert.throws(
    () => verify(input, {
      updateConfiguration: {
        ...input.updateConfiguration,
        keys: [{ id: "replacement", publicKey: "C".repeat(44) }],
      },
    }),
    /update trust does not match/,
  );
  writeFileSync(path.join(input.outputDirectory, "runner.txt"), "machine detail");
  assert.throws(() => verify(input), /unexpected entry/);
});

test("does not replace an existing Windows input", (context) => {
  const input = createWindowsExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  mkdirSync(input.outputDirectory);
  writeFileSync(path.join(input.outputDirectory, "retained.txt"), "retained");

  assert.throws(() => stage(input), /already exists/);
  assert.equal(readFileSync(path.join(input.outputDirectory, "retained.txt"), "utf8"), "retained");
});

test("rejects multiply linked source and staged files", (context) => {
  const input = createWindowsExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  const externalPackageLink = path.join(input.root, "linked-package.exe");
  linkSync(input.packagePath, externalPackageLink);
  assert.throws(() => stage(input), /source files must be regular and singly linked/);
  rmSync(externalPackageLink);

  stage(input);
  linkSync(
    path.join(input.outputDirectory, input.packageName),
    path.join(input.root, "linked-staged-package.exe"),
  );
  assert.throws(() => verify(input), /files must be regular and singly linked/);
});

test("rejects a valid inventory from a different Authenticode authority", (context) => {
  const input = createWindowsExpansionInputFixture({ certificateSha256: "d".repeat(64) });
  context.after(() => rmSync(input.root, { force: true, recursive: true }));

  assert.throws(
    () => stage(input, { authenticodeCertificateSha256: "c".repeat(64) }),
    /inventory Authenticode trust does not match/,
  );
  assert.equal(readdirSync(input.root).includes("input"), false);
});
