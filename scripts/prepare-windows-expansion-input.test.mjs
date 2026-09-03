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
  stageWindowsExpansionInput,
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
