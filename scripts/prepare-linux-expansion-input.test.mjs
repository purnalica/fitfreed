import assert from "node:assert/strict";
import {
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  stageLinuxExpansionInput,
  verifyLinuxExpansionInput,
} from "./prepare-linux-expansion-input.mjs";
import { createLinuxExpansionInputFixture } from "./test-support/linux-expansion-input.mjs";

test("stages one exact secret-free Linux input for protected composition", (context) => {
  const input = createLinuxExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  const result = stageLinuxExpansionInput({
    ...input,
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
  });

  assert.deepEqual(readdirSync(input.outputDirectory).sort(), [
    input.packageName,
    `${input.packageName}.build.json`,
    `${input.packageName}.inventory.json`,
  ]);
  assert.deepEqual(verifyLinuxExpansionInput({
    directory: input.outputDirectory,
    revision: input.revision,
    storageSchemaVersion: 37,
    version: input.version,
  }), result);
  assert.equal(result.revision, input.revision);
  assert.equal(result.storageSchemaVersion, 37);
  assert.equal(result.version, input.version);
});

test("rejects stale source identity and any unexpected input file", (context) => {
  const input = createLinuxExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  stageLinuxExpansionInput({
    ...input,
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
  });

  assert.throws(
    () => verifyLinuxExpansionInput({
      directory: input.outputDirectory,
      revision: "b".repeat(40),
      storageSchemaVersion: 37,
      version: input.version,
    }),
    /revision does not match/,
  );
  writeFileSync(path.join(input.outputDirectory, "runner.txt"), "machine detail");
  assert.throws(
    () => verifyLinuxExpansionInput({
      directory: input.outputDirectory,
      revision: input.revision,
      storageSchemaVersion: 37,
      version: input.version,
    }),
    /unexpected entry/,
  );
});

test("does not replace an existing Linux input", (context) => {
  const input = createLinuxExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  mkdirSync(input.outputDirectory);
  writeFileSync(path.join(input.outputDirectory, "retained.txt"), "retained");

  assert.throws(
    () => stageLinuxExpansionInput({
      ...input,
      generatedAt: "2026-09-03T08:00:00.000Z",
      storageSchemaVersion: 37,
    }),
    /already exists/,
  );
  assert.equal(
    readFileSync(path.join(input.outputDirectory, "retained.txt"), "utf8"),
    "retained",
  );
});

test("rejects multiply linked files at the native-input boundary", (context) => {
  const input = createLinuxExpansionInputFixture();
  context.after(() => rmSync(input.root, { force: true, recursive: true }));
  stageLinuxExpansionInput({
    ...input,
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
  });
  linkSync(
    path.join(input.outputDirectory, input.packageName),
    path.join(input.root, "linked-package.deb"),
  );

  assert.throws(
    () => verifyLinuxExpansionInput({
      directory: input.outputDirectory,
      revision: input.revision,
      storageSchemaVersion: 37,
      version: input.version,
    }),
    /regular and singly linked/,
  );
});
