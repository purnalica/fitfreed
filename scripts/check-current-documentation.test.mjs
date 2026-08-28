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
      currentLibrarySchemaVersion: 35,
      supportedLibrarySchemaVersions: Array.from({ length: 35 }, (_, index) => index + 1),
      checkedDocuments: 11,
    },
  );
});

test("rejects pre-migration status across current experience documents", () => {
  const candidate = structuredClone(loadCurrentDocumentation(repositoryRoot));
  candidate.sources["docs/design/experience-specification.md"] = replaceRequired(
    candidate.sources["docs/design/experience-specification.md"],
    "The production application implements\nX5-R1 through X5-R10 and the earlier corrective X7-R1 through X7-R7 vertical slices",
    "It does not describe the current production presentation.",
  );
  candidate.sources["docs/plans/ui-redesign.md"] = replaceRequired(
    candidate.sources["docs/plans/ui-redesign.md"],
    "X5-R1 through X5-R10 and X7-R1 through X7-R7 retain\ntheir engineering evidence",
    "X4 derives the incremental production migration before X5 changes production",
  );
  candidate.sources["docs/roadmap.md"] = replaceRequired(
    candidate.sources["docs/roadmap.md"],
    "X5-R1 through X5-R10 retain their engineering evidence, and X7-R1 through X7-R7 retain the machine evidence",
    "X5 is migrating the public entrance and ordinary application",
  );
  candidate.sources["docs/testing/public-release-readiness.md"] = replaceRequired(
    candidate.sources["docs/testing/public-release-readiness.md"],
    "X5-R1 through X5-R10 and X7-R1 through X7-R7 retain their prior evidence",
    "PX-01 and PX-02 still require correction",
  );

  assert.throws(
    () => validateCurrentDocumentation(candidate),
    (error) => {
      assert.match(error.message, /experience specification still disclaims production/);
      assert.match(error.message, /redesign plan still presents X5 implementation as future/);
      assert.match(error.message, /roadmap still presents the implemented X5 increments as future/);
      assert.match(error.message, /readiness ledger still reports the pre-migration audit state/);
      return true;
    },
  );
});

test("rejects stale storage, report, and release-readiness claims together", () => {
  const candidate = structuredClone(loadCurrentDocumentation(repositoryRoot));
  candidate.sources["docs/architecture/storage.md"] = replaceRequired(
    candidate.sources["docs/architecture/storage.md"],
    "SQLite version 35",
    "SQLite version 33",
  );
  candidate.sources["docs/user/public-macos-0.1.0.md"] = replaceRequired(
    candidate.sources["docs/user/public-macos-0.1.0.md"],
    "question-, exploration-, session-, and blank-start reports",
    "session-start reports",
  );
  candidate.sources["docs/testing/public-release-readiness.md"] = replaceRequired(
    candidate.sources["docs/testing/public-release-readiness.md"],
    "X5-R1 through X5-R10 and X7-R1 through X7-R7 retain their prior evidence",
    "The accepted E1–E6 experience scope is not implemented",
  );

  assert.throws(
    () => validateCurrentDocumentation(candidate),
    (error) => {
      assert.match(error.message, /storage architecture does not identify SQLite schema 35/);
      assert.match(error.message, /public guide does not describe every implemented report start/);
      assert.match(error.message, /release readiness still presents the implemented experience as absent/);
      return true;
    },
  );
});
