import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateVendorEvidence } from "./check-vendored-updater.mjs";

const trustedHash = "1".repeat(64);

test("keeps every checksum-governed updater file byte-stable across Git checkouts", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const provenance = JSON.parse(readFileSync(
    path.join(repositoryRoot, "src-tauri/vendor/tauri-plugin-updater/provenance.json"),
    "utf8",
  ));
  const governedPaths = [
    "src-tauri/vendor/tauri-plugin-updater/provenance.json",
    ...provenance.sourceFiles.map(
      ({ path: sourcePath }) => `src-tauri/vendor/tauri-plugin-updater/${sourcePath}`,
    ),
  ];
  const attributes = execFileSync("git", ["check-attr", "--stdin", "eol"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input: `${governedPaths.join("\n")}\n`,
  }).trim().split("\n");

  assert.equal(attributes.length, governedPaths.length);
  for (const [index, sourcePath] of governedPaths.entries()) {
    assert.equal(attributes[index], `${sourcePath}: eol: lf`);
  }
});

function validEvidence() {
  return {
    provenance: {
      schemaVersion: 1,
      package: "tauri-plugin-updater",
      version: "2.10.1",
      archiveSha256: "806d9dac662c2e4594ff03c647a552f2c9bd544e7d0f683ec58f872f952ce4af",
      sourceFiles: [{ path: "src/updater.rs", sha256: trustedHash }],
    },
    actualFiles: ["provenance.json", "src/updater.rs"],
    actualHashes: { "src/updater.rs": trustedHash },
    vendorManifest: '[package]\nname = "tauri-plugin-updater"\nversion = "2.10.1"\n',
    rootManifest:
      '[workspace]\nexclude = ["vendor/tauri-plugin-updater"]\n[dependencies]\ntauri-plugin-updater = { version = "=2.10.1", path = "vendor/tauri-plugin-updater" }\n',
    updaterSource:
      "pub fn prepare_update() {}\npub fn build_for_authenticated_release() {}\npub async fn download_with_expected_size() {}\n",
    errorSource: "enum Error { DownloadSizeMismatch }",
    frontendManifest: '{ "dependencies": {} }',
    capabilityDocument: '{ "permissions": ["core:default"] }',
    tauriConfig: { plugins: { updater: { pubkey: "", endpoints: [] } } },
  };
}

test("accepts the exact reviewed updater source and dependency boundary", () => {
  assert.deepEqual(validateVendorEvidence(validEvidence()), {
    package: "tauri-plugin-updater",
    version: "2.10.1",
    archiveSha256: "806d9dac662c2e4594ff03c647a552f2c9bd544e7d0f683ec58f872f952ce4af",
    verifiedFiles: 1,
  });
});

test("reports source drift, unexpected files, dependency bypass, and frontend exposure together", () => {
  const evidence = validEvidence();
  evidence.provenance.sourceFiles.push(
    { path: "src/updater.rs", sha256: trustedHash },
    { path: "../outside.rs", sha256: "not-a-sha256" },
  );
  evidence.actualFiles.push("src/unreviewed.rs");
  evidence.actualHashes["src/updater.rs"] = "changed";
  evidence.rootManifest = '[dependencies]\ntauri-plugin-updater = "2"\n';
  evidence.frontendManifest = '{ "dependencies": { "@tauri-apps/plugin-updater": "2" } }';
  evidence.capabilityDocument = '{ "permissions": ["updater:default"] }';
  evidence.tauriConfig = {
    plugins: {
      updater: {
        pubkey: "embedded-production-key",
        endpoints: ["https://updates.invalid/private-alpha.json"],
      },
    },
  };

  assert.throws(
    () => validateVendorEvidence(evidence),
    (error) => {
      assert.match(error.message, /duplicate paths/);
      assert.match(error.message, /invalid source path: \.\.\/outside\.rs/);
      assert.match(error.message, /invalid SHA-256: \.\.\/outside\.rs/);
      assert.match(error.message, /file allowlist mismatch/);
      assert.match(error.message, /checksum mismatch: src\/updater\.rs/);
      assert.match(error.message, /exact reviewed vendored updater path and version/);
      assert.match(error.message, /outside the FitFreed workspace package set/);
      assert.match(error.message, /must not be exposed through a frontend package/);
      assert.match(error.message, /must not be exposed through a frontend capability/);
      assert.match(error.message, /ordinary build must keep updater trust unconfigured/);
      return true;
    },
  );
});
