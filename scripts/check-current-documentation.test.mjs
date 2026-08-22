import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadCurrentDocumentation,
  validateCurrentDocumentation,
} from "./check-current-documentation.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function replaceRequired(source, currentText, replacement) {
  assert.match(source, new RegExp(currentText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  return source.replace(currentText, replacement);
}

test("accepts current documentation derived from the release compatibility source", () => {
  assert.deepEqual(
    validateCurrentDocumentation(loadCurrentDocumentation(repositoryRoot)),
    {
      releaseVersion: "0.1.0",
      currentLibrarySchemaVersion: 26,
      supportedLibrarySchemaVersions: Array.from({ length: 26 }, (_, index) => index + 1),
      checkedDocuments: 8,
    },
  );
});

test("rejects stale storage, report, and release-readiness claims together", () => {
  const candidate = structuredClone(loadCurrentDocumentation(repositoryRoot));
  candidate.sources["docs/architecture/storage.md"] = replaceRequired(
    candidate.sources["docs/architecture/storage.md"],
    "SQLite version 26",
    "SQLite version 25",
  );
  candidate.sources["docs/user/public-macos-0.1.0.md"] = replaceRequired(
    candidate.sources["docs/user/public-macos-0.1.0.md"],
    "question-, exploration-, session-, and blank-start reports",
    "session-start reports",
  );
  candidate.sources["docs/testing/public-release-readiness.md"] = replaceRequired(
    candidate.sources["docs/testing/public-release-readiness.md"],
    "E1 through E5 implement the Home, discovery, deep-session, sport-classification, report, refresh, and source-navigation behavior",
    "The accepted E1–E6 experience scope is not implemented",
  );

  assert.throws(
    () => validateCurrentDocumentation(candidate),
    (error) => {
      assert.match(error.message, /storage architecture does not identify SQLite schema 26/);
      assert.match(error.message, /public guide does not describe every implemented report start/);
      assert.match(error.message, /release readiness still presents the implemented experience as absent/);
      return true;
    },
  );
});
