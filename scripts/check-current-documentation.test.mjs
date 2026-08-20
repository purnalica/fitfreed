import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadCurrentDocumentation,
  validateCurrentDocumentation,
} from "./check-current-documentation.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("accepts current documentation derived from the release compatibility source", () => {
  assert.deepEqual(
    validateCurrentDocumentation(loadCurrentDocumentation(repositoryRoot)),
    {
      releaseVersion: "0.1.0",
      currentLibrarySchemaVersion: 23,
      supportedLibrarySchemaVersions: Array.from({ length: 23 }, (_, index) => index + 1),
      checkedDocuments: 8,
    },
  );
});

test("rejects stale storage, report, and release-readiness claims together", () => {
  const candidate = structuredClone(loadCurrentDocumentation(repositoryRoot));
  candidate.sources["docs/architecture/storage.md"] = candidate.sources[
    "docs/architecture/storage.md"
  ].replace("SQLite version 23", "SQLite version 22");
  candidate.sources["docs/user/public-macos-0.1.0.md"] = candidate.sources[
    "docs/user/public-macos-0.1.0.md"
  ].replace(
    "question-, exploration-, session-, and blank-start reports",
    "session-start reports",
  );
  candidate.sources["docs/testing/public-release-readiness.md"] = candidate.sources[
    "docs/testing/public-release-readiness.md"
  ].replace(
    "The E1 through E5 experience is implemented",
    "The accepted E1–E6 experience scope is not implemented",
  );

  assert.throws(
    () => validateCurrentDocumentation(candidate),
    (error) => {
      assert.match(error.message, /storage architecture does not identify SQLite schema 23/);
      assert.match(error.message, /public guide does not describe every implemented report start/);
      assert.match(error.message, /release readiness still presents the implemented experience as absent/);
      return true;
    },
  );
});
