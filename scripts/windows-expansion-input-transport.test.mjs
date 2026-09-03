import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  detectWindowsExpansionTarDialect,
  packWindowsExpansionInput,
  unpackWindowsExpansionInput,
  validateWindowsExpansionArchiveEntries,
  windowsExpansionArchiveCreateArguments,
} from "./windows-expansion-input-transport.mjs";
import { stageWindowsExpansionInput } from "./prepare-windows-expansion-input.mjs";
import { createWindowsExpansionInputFixture } from "./test-support/windows-expansion-input.mjs";

function stagedFixture(context) {
  const input = createWindowsExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  stageWindowsExpansionInput({
    ...input,
    generatedAt: "2026-09-04T08:00:00.000Z",
    storageSchemaVersion: 37,
  });
  return input;
}

function identity(input) {
  return {
    authenticodeCertificateSha256: input.authenticodeCertificateSha256,
    revision: input.revision,
    storageSchemaVersion: 37,
    updateConfiguration: input.updateConfiguration,
    version: input.version,
  };
}

test("seals and reopens the exact Windows native input", (context) => {
  const input = stagedFixture(context);
  const archivePath = path.join(input.root, "windows-input.tar.gz");
  const reopenedDirectory = path.join(input.root, "reopened");

  const packed = packWindowsExpansionInput({
    archivePath,
    inputDirectory: input.outputDirectory,
    ...identity(input),
  });
  const reopened = unpackWindowsExpansionInput({
    archivePath,
    expectedSha256: packed.archiveSha256,
    outputDirectory: reopenedDirectory,
    ...identity(input),
  });

  assert.deepEqual(reopened, packed);
  assert.ok(existsSync(path.join(reopenedDirectory, input.packageName)));
});

test("rejects mutated transport bytes without creating an input", (context) => {
  const input = stagedFixture(context);
  const archivePath = path.join(input.root, "windows-input.tar.gz");
  const reopenedDirectory = path.join(input.root, "reopened");
  const packed = packWindowsExpansionInput({
    archivePath,
    inputDirectory: input.outputDirectory,
    ...identity(input),
  });
  writeFileSync(archivePath, "mutated transport bytes");

  assert.throws(() => unpackWindowsExpansionInput({
    archivePath,
    expectedSha256: packed.archiveSha256,
    outputDirectory: reopenedDirectory,
    ...identity(input),
  }), /digest mismatch/);
  assert.equal(existsSync(reopenedDirectory), false);
});

test("admits only the three closed Windows input entries with native line endings", () => {
  const version = "0.2.0";
  const packageName = `FitFreed_${version}_x64-setup.exe`;
  assert.deepEqual(validateWindowsExpansionArchiveEntries(
    [
      packageName,
      `${packageName}.build.json`,
      `${packageName}.inventory.json`,
    ].join("\r\n") + "\r\n",
    version,
  ), { entryCount: 3 });
  for (const entries of [
    `${packageName}\n../private-key`,
    `${packageName}\n/absolute`,
    `${packageName}\nunexpected.txt`,
    `${packageName}\nfolder\\escaped`,
    `${packageName}\n${packageName}`,
  ]) {
    assert.throws(
      () => validateWindowsExpansionArchiveEntries(entries, version),
      /unsafe|closed entry set/,
    );
  }
});

test("creates a portable archive without retaining native account ownership", () => {
  assert.deepEqual(windowsExpansionArchiveCreateArguments({
    archive: "C:\\staging\\input.tar.gz",
    dialect: "gnu",
    input: "C:\\staging\\input",
    version: "0.2.0",
  }), [
    "--format=ustar",
    "--owner=0",
    "--group=0",
    "--numeric-owner",
    "-czf",
    "C:\\staging\\input.tar.gz",
    "-C",
    "C:\\staging\\input",
    "FitFreed_0.2.0_x64-setup.exe",
    "FitFreed_0.2.0_x64-setup.exe.build.json",
    "FitFreed_0.2.0_x64-setup.exe.inventory.json",
  ]);
  assert.deepEqual(windowsExpansionArchiveCreateArguments({
    archive: "C:\\staging\\input.tar.gz",
    dialect: "bsdtar",
    input: "C:\\staging\\input",
    version: "0.2.0",
  }), [
    "--format=ustar",
    "--uid",
    "0",
    "--gid",
    "0",
    "--uname",
    "",
    "--gname",
    "",
    "-czf",
    "C:\\staging\\input.tar.gz",
    "-C",
    "C:\\staging\\input",
    "FitFreed_0.2.0_x64-setup.exe",
    "FitFreed_0.2.0_x64-setup.exe.build.json",
    "FitFreed_0.2.0_x64-setup.exe.inventory.json",
  ]);
  assert.equal(detectWindowsExpansionTarDialect("bsdtar 3.7.7 - libarchive 3.7.7"), "bsdtar");
  assert.equal(detectWindowsExpansionTarDialect("tar (GNU tar) 1.35"), "gnu");
  assert.throws(
    () => detectWindowsExpansionTarDialect("unknown tar 1.0"),
    /requires GNU tar or bsdtar/,
  );
});

test("removes reopened bytes when the expected certificate differs", (context) => {
  const input = stagedFixture(context);
  const archivePath = path.join(input.root, "windows-input.tar.gz");
  const reopenedDirectory = path.join(input.root, "reopened");
  const packed = packWindowsExpansionInput({
    archivePath,
    inputDirectory: input.outputDirectory,
    ...identity(input),
  });

  assert.throws(() => unpackWindowsExpansionInput({
    archivePath,
    authenticodeCertificateSha256: "d".repeat(64),
    expectedSha256: packed.archiveSha256,
    outputDirectory: reopenedDirectory,
    revision: input.revision,
    storageSchemaVersion: 37,
    updateConfiguration: input.updateConfiguration,
    version: input.version,
  }), /Authenticode trust does not match/);
  assert.equal(existsSync(reopenedDirectory), false);
});

test("preserves existing archive and destination paths", (context) => {
  const input = stagedFixture(context);
  const archivePath = path.join(input.root, "windows-input.tar.gz");
  writeFileSync(archivePath, "retained archive");
  assert.throws(() => packWindowsExpansionInput({
    archivePath,
    inputDirectory: input.outputDirectory,
    ...identity(input),
  }), /already exists/);
  assert.equal(readFileSync(archivePath, "utf8"), "retained archive");

  rmSync(archivePath);
  const packed = packWindowsExpansionInput({
    archivePath,
    inputDirectory: input.outputDirectory,
    ...identity(input),
  });
  const reopenedDirectory = path.join(input.root, "reopened");
  mkdirSync(reopenedDirectory);
  writeFileSync(path.join(reopenedDirectory, "retained.txt"), "retained input");
  assert.throws(() => unpackWindowsExpansionInput({
    archivePath,
    expectedSha256: packed.archiveSha256,
    outputDirectory: reopenedDirectory,
    ...identity(input),
  }), /destination already exists/);
  assert.equal(
    readFileSync(path.join(reopenedDirectory, "retained.txt"), "utf8"),
    "retained input",
  );
});
