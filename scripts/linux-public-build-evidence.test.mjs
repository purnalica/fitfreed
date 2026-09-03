import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createLinuxPublicBuildEvidence,
  validateLinuxPublicBuildEvidence,
} from "./linux-public-build-evidence.mjs";

function input() {
  return {
    version: "0.2.0",
    revision: "a".repeat(40),
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
    packageArtifact: {
      path: "FitFreed_0.2.0_amd64.deb",
      kind: "linux-x86_64-deb",
      size: 120,
      sha256: "b".repeat(64),
    },
    inventoryArtifact: {
      path: "FitFreed_0.2.0_amd64.deb.inventory.json",
      kind: "linux-package-inventory",
      size: 240,
      sha256: "c".repeat(64),
    },
  };
}

test("creates privacy-safe exact Linux builder evidence", () => {
  const evidence = createLinuxPublicBuildEvidence(input());

  assert.equal(validateLinuxPublicBuildEvidence(evidence), evidence);
  assert.equal(evidence.schemaVersion, 1);
  assert.deepEqual(evidence.verification, [
    { id: "linux-package-contract", result: "passed" },
    { id: "linux-package-inventory", result: "passed" },
    { id: "ubuntu-24.04-clean-installation", result: "passed" },
    { id: "ubuntu-24.04-clean-removal", result: "passed" },
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /runner|hostname|workflow|\/Users\/|\/home\//i);
});

test("rejects stale package identity and incomplete builder verification", () => {
  const evidence = createLinuxPublicBuildEvidence(input());
  evidence.artifacts.package.path = "FitFreed_0.1.0_amd64.deb";
  evidence.verification.pop();

  assert.throws(
    () => validateLinuxPublicBuildEvidence(evidence),
    (error) => {
      assert.match(error.message, /package must be named FitFreed_0\.2\.0_amd64\.deb/);
      assert.match(error.message, /verification set|schema violation/);
      return true;
    },
  );
});

test("rejects an inventory that is not bound to the exact package version", () => {
  const evidence = createLinuxPublicBuildEvidence(input());
  evidence.artifacts.inventory.path = "FitFreed_0.2.0_amd64.deb.other.json";

  assert.throws(
    () => validateLinuxPublicBuildEvidence(evidence),
    /inventory must be named FitFreed_0\.2\.0_amd64\.deb\.inventory\.json/,
  );
});

test("documents and indexes the Linux public build evidence contract", () => {
  const document = readFileSync(
    new URL("../docs/data-formats/release/linux-public-build-evidence-v1.md", import.meta.url),
    "utf8",
  );
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  for (const value of [
    "linux-package-contract",
    "linux-package-inventory",
    "ubuntu-24.04-clean-installation",
    "ubuntu-24.04-clean-removal",
    "FitFreed_<version>_amd64.deb.build.json",
  ]) {
    assert.match(document, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(index, /release\/linux-public-build-evidence-v1\.md/);
});
