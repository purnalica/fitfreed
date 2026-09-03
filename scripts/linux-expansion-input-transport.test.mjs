import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  packLinuxExpansionInput,
  unpackLinuxExpansionInput,
  validateLinuxExpansionArchiveEntries,
} from "./linux-expansion-input-transport.mjs";
import { stageLinuxExpansionInput } from "./prepare-linux-expansion-input.mjs";
import { createLinuxExpansionInputFixture } from "./test-support/linux-expansion-input.mjs";

function stagedFixture(context) {
  const input = createLinuxExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  stageLinuxExpansionInput({
    ...input,
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
  });
  return input;
}

test("seals and reopens the exact Linux native input", (context) => {
  const input = stagedFixture(context);
  const archivePath = path.join(input.root, "linux-input.tar.gz");
  const reopenedDirectory = path.join(input.root, "reopened");

  const packed = packLinuxExpansionInput({
    archivePath,
    inputDirectory: input.outputDirectory,
    revision: input.revision,
    storageSchemaVersion: 37,
    version: input.version,
  });
  const reopened = unpackLinuxExpansionInput({
    archivePath,
    expectedSha256: packed.archiveSha256,
    outputDirectory: reopenedDirectory,
    revision: input.revision,
    storageSchemaVersion: 37,
    version: input.version,
  });

  assert.deepEqual(reopened, packed);
  assert.ok(existsSync(path.join(reopenedDirectory, input.packageName)));
});

test("rejects mutated transport bytes without creating an input", (context) => {
  const input = stagedFixture(context);
  const archivePath = path.join(input.root, "linux-input.tar.gz");
  const reopenedDirectory = path.join(input.root, "reopened");
  const packed = packLinuxExpansionInput({
    archivePath,
    inputDirectory: input.outputDirectory,
    revision: input.revision,
    storageSchemaVersion: 37,
    version: input.version,
  });
  writeFileSync(archivePath, "mutated transport bytes");

  assert.throws(() => unpackLinuxExpansionInput({
    archivePath,
    expectedSha256: packed.archiveSha256,
    outputDirectory: reopenedDirectory,
    revision: input.revision,
    storageSchemaVersion: 37,
    version: input.version,
  }), /digest mismatch/);
  assert.equal(existsSync(reopenedDirectory), false);
});

test("admits only the three closed Linux input entries", () => {
  const version = "0.2.0";
  const packageName = `FitFreed_${version}_amd64.deb`;
  assert.deepEqual(validateLinuxExpansionArchiveEntries(
    [
      packageName,
      `${packageName}.build.json`,
      `${packageName}.inventory.json`,
    ].join("\n"),
    version,
  ), { entryCount: 3 });
  for (const entries of [
    `${packageName}\n../private-key`,
    `${packageName}\n/absolute`,
    `${packageName}\nunexpected.txt`,
    `${packageName}\nfolder\\escaped`,
  ]) {
    assert.throws(
      () => validateLinuxExpansionArchiveEntries(entries, version),
      /unsafe|closed entry set/,
    );
  }
});
