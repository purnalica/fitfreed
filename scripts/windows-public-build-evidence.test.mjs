import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createWindowsPublicBuildEvidence,
  validateWindowsPublicBuildEvidence,
} from "./windows-public-build-evidence.mjs";

function artifact(path, kind, digest) {
  return { path, kind, size: 120, sha256: digest.repeat(64) };
}

function input() {
  const packageName = "FitFreed_0.3.0_x64-setup.exe";
  return {
    authenticodeCertificateSha256: "a".repeat(64),
    generatedAt: "2026-09-03T20:00:00.000Z",
    inventoryArtifact: artifact(
      `${packageName}.inventory.json`,
      "windows-package-inventory",
      "b",
    ),
    packageArtifact: artifact(packageName, "windows-x86_64-nsis", "c"),
    revision: "d".repeat(40),
    storageSchemaVersion: 37,
    updateTrustedKeyIds: ["stable-2026-1", "stable-2026-2"],
    version: "0.3.0",
  };
}

test("creates privacy-safe exact Windows builder evidence", () => {
  const evidence = createWindowsPublicBuildEvidence(input());

  assert.equal(validateWindowsPublicBuildEvidence(evidence), evidence);
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.update.contract, "stable-v3");
  assert.deepEqual(evidence.update.trustedKeyIds, ["stable-2026-1", "stable-2026-2"]);
  assert.equal(evidence.trust.authenticodeCertificateSha256, "a".repeat(64));
  assert.deepEqual(evidence.verification.map(({ id }) => id), [
    "windows-package-contract",
    "windows-public-setup-trust",
    "windows-current-user-installation",
    "windows-installed-authenticode",
    "windows-package-inventory",
    "windows-clean-removal",
  ]);
  assert.doesNotMatch(
    JSON.stringify(evidence),
    /runner|hostname|workflow|certificateSubject|storePath|signToolPath|privateKey|[A-Z]:\\/i,
  );
});

test("rejects stale artifact identity and incomplete builder verification", () => {
  const evidence = createWindowsPublicBuildEvidence(input());
  evidence.artifacts.package.path = "FitFreed_0.2.0_x64-setup.exe";
  evidence.verification.pop();

  assert.throws(
    () => validateWindowsPublicBuildEvidence(evidence),
    (error) => {
      assert.match(error.message, /package must be named FitFreed_0\.3\.0_x64-setup\.exe/);
      assert.match(error.message, /verification set|schema violation/);
      return true;
    },
  );
});

test("rejects an inventory outside the exact package and unordered update trust", () => {
  const evidence = createWindowsPublicBuildEvidence(input());
  evidence.artifacts.inventory.path = "other.inventory.json";
  evidence.update.trustedKeyIds.reverse();

  assert.throws(
    () => validateWindowsPublicBuildEvidence(evidence),
    (error) => {
      assert.match(error.message, /inventory must be named/);
      assert.match(error.message, /key identifiers must be unique and sorted/);
      return true;
    },
  );
});

test("documents and indexes the Windows public build evidence contract", () => {
  const document = readFileSync(
    new URL("../docs/data-formats/release/windows-public-build-evidence-v1.md", import.meta.url),
    "utf8",
  );
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  for (const value of [
    "org.fitfreed.windows-public-build-evidence",
    "windows-public-setup-trust",
    "windows-installed-authenticode",
    "FitFreed_<version>_x64-setup.exe.build.json",
  ]) {
    assert.match(document, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(index, /release\/windows-public-build-evidence-v1\.md/);
});
