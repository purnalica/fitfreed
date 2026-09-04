import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { downloadCompletePlatformPredecessors } from "./download-complete-platform-predecessors.mjs";

function matrix() {
  return {
    format: "org.fitfreed.upgrade-matrix",
    release: { librarySchemaVersion: 37, version: "0.3.0" },
    schemaVersion: 2,
    supportedApplicationBaselines: [{
      librarySchemaVersions: [37],
      targets: ["darwin-aarch64", "linux-x86_64-deb"],
      version: "0.2.0",
    }],
    supportedLibrarySchemaVersions: [37],
  };
}

test("downloads each required immutable predecessor into its closed evidence boundary", (context) => {
  const parent = mkdtempSync(path.join(tmpdir(), "fitfreed-predecessor-download-"));
  context.after(() => rmSync(parent, { force: true, recursive: true }));
  const outputDirectory = path.join(parent, "evidence");
  const calls = [];
  const result = downloadCompletePlatformPredecessors({
    downloadRelease(version, releaseDirectory) {
      calls.push({ version, releaseDirectory: path.relative(parent, releaseDirectory) });
      writeFileSync(path.join(releaseDirectory, "release-manifest.json"), "synthetic");
    },
    matrix: matrix(),
    outputDirectory,
    verifyEvidence({ evidenceDirectory }) {
      assert.match(evidenceDirectory, /\.evidence\.tmp-/);
      return { recoveryPackages: [{ version: "0.2.0" }] };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].version, "0.2.0");
  assert.match(
    calls[0].releaseDirectory,
    new RegExp(`^\\.evidence\\.tmp-[^${path.sep}]+${path.sep}0\\.2\\.0${path.sep}release$`),
  );
  assert.equal(
    readFileSync(path.join(outputDirectory, "0.2.0/release/release-manifest.json"), "utf8"),
    "synthetic",
  );
  assert.deepEqual(result, {
    predecessorVersions: ["0.2.0"],
    recoveryPackageCount: 1,
  });
});

test("refuses an existing destination or a matrix without a package predecessor", (context) => {
  const parent = mkdtempSync(path.join(tmpdir(), "fitfreed-predecessor-safety-"));
  context.after(() => rmSync(parent, { force: true, recursive: true }));
  const existing = path.join(parent, "existing");
  writeFileSync(existing, "do not replace");
  assert.throws(() => downloadCompletePlatformPredecessors({
    downloadRelease() {},
    matrix: matrix(),
    outputDirectory: existing,
    verifyEvidence() {},
  }), /already exists/);

  const withoutPredecessor = matrix();
  withoutPredecessor.supportedApplicationBaselines = [];
  assert.throws(() => downloadCompletePlatformPredecessors({
    downloadRelease() {},
    matrix: withoutPredecessor,
    outputDirectory: path.join(parent, "absent"),
    verifyEvidence() {},
  }), /package predecessor/);
});

test("removes partial downloads when retrieval or verification fails", (context) => {
  const parent = mkdtempSync(path.join(tmpdir(), "fitfreed-predecessor-failure-"));
  context.after(() => rmSync(parent, { force: true, recursive: true }));
  const failures = [
    [() => { throw new Error("network detail"); }, () => ({})],
    [(_version, releaseDirectory) => {
      writeFileSync(path.join(releaseDirectory, "release-manifest.json"), "changed");
    }, () => { throw new Error("digest mismatch"); }],
  ];
  failures.forEach(([downloadRelease, verifyEvidence], index) => {
    const outputDirectory = path.join(parent, `evidence-${index}`);
    assert.throws(() => downloadCompletePlatformPredecessors({
      downloadRelease,
      matrix: matrix(),
      outputDirectory,
      verifyEvidence,
    }));
    assert.equal(existsSync(outputDirectory), false);
  });
});
