import assert from "node:assert/strict";
import test from "node:test";

import { validateUpgradeMatrix } from "./upgrade-matrix.mjs";

function validMatrix() {
  return {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 1,
    release: {
      version: "0.2.0",
      librarySchemaVersion: 3,
    },
    supportedApplicationBaselines: [
      {
        version: "0.1.0",
        targets: ["darwin-aarch64", "darwin-x86_64"],
        librarySchemaVersions: [1, 2],
      },
    ],
    supportedLibrarySchemaVersions: [1, 2, 3],
  };
}

const expectedRepository = {
  releaseVersion: "0.2.0",
  currentLibrarySchemaVersion: 3,
  migrationVersions: [1, 2, 3],
};

test("accepts distinct application and library support dimensions", () => {
  assert.deepEqual(validateUpgradeMatrix(validMatrix(), expectedRepository), {
    releaseVersion: "0.2.0",
    currentLibrarySchemaVersion: 3,
    applicationBaselineCount: 1,
    librarySchemaVersions: [1, 2, 3],
  });
});

test("accepts an empty application list for a first release", () => {
  const matrix = validMatrix();
  matrix.release.version = "0.1.0";
  matrix.supportedApplicationBaselines = [];

  assert.equal(
    validateUpgradeMatrix(matrix, { ...expectedRepository, releaseVersion: "0.1.0" })
      .applicationBaselineCount,
    0,
  );
});

test("rejects repository identity and migration drift together", () => {
  const matrix = validMatrix();
  matrix.release.version = "0.3.0";
  matrix.release.librarySchemaVersion = 4;
  matrix.supportedLibrarySchemaVersions = [1, 2, 4];

  assert.throws(
    () => validateUpgradeMatrix(matrix, expectedRepository),
    (error) => {
      assert.match(error.message, /target version 0\.3\.0 does not match repository version 0\.2\.0/);
      assert.match(error.message, /target library schema 4 does not match compiled schema 3/);
      assert.match(error.message, /supported library schema 4 has no immutable migration/);
      assert.match(error.message, /target library schema 4 has no immutable migration/);
      return true;
    },
  );
});

test("rejects unordered baselines, targets, and schema lists", () => {
  const matrix = validMatrix();
  matrix.supportedApplicationBaselines = [
    {
      version: "0.1.1",
      targets: ["darwin-x86_64", "darwin-aarch64"],
      librarySchemaVersions: [2, 1],
    },
    {
      version: "0.1.0",
      targets: ["darwin-aarch64"],
      librarySchemaVersions: [1],
    },
  ];
  matrix.supportedLibrarySchemaVersions = [2, 1, 3];

  assert.throws(
    () => validateUpgradeMatrix(matrix, expectedRepository),
    (error) => {
      assert.match(error.message, /application baselines must be ordered by version/);
      assert.match(error.message, /0\.1\.1 targets must be ordered/);
      assert.match(error.message, /0\.1\.1 library schemas must be ordered/);
      assert.match(error.message, /supported library schemas must be ordered/);
      return true;
    },
  );
});

test("rejects a non-prior application or unsupported source schema", () => {
  const matrix = validMatrix();
  matrix.supportedApplicationBaselines[0].version = "0.2.0";
  matrix.supportedApplicationBaselines[0].librarySchemaVersions = [1, 4];

  assert.throws(
    () => validateUpgradeMatrix(matrix, expectedRepository),
    (error) => {
      assert.match(error.message, /application baseline 0\.2\.0 is not older than target 0\.2\.0/);
      assert.match(error.message, /application baseline 0\.2\.0 uses unsupported library schema 4/);
      return true;
    },
  );
});

test("rejects duplicate semantic versions that differ only by build metadata", () => {
  const matrix = validMatrix();
  matrix.supportedApplicationBaselines = [
    {
      version: "0.1.0+first",
      targets: ["darwin-aarch64"],
      librarySchemaVersions: [1],
    },
    {
      version: "0.1.0+second",
      targets: ["darwin-aarch64"],
      librarySchemaVersions: [1],
    },
  ];

  assert.throws(
    () => validateUpgradeMatrix(matrix, expectedRepository),
    /application baseline versions must be unique by SemVer precedence/,
  );
});
