import assert from "node:assert/strict";
import test from "node:test";

import { validatePerformancePolicy } from "./check-performance-policy.mjs";

function validDocuments() {
  return new Map([
    [
      "docs/quality-targets.md",
      "Hosted macOS and local Apple Silicon use unchanged budgets. See ADR 0015.\n",
    ],
    [
      "docs/requirements.md",
      "Performance evidence is qualified by its reproducible execution environment. See ADR 0015.\n",
    ],
  ]);
}

test("accepts environment-qualified performance evidence", () => {
  assert.deepEqual(validatePerformancePolicy(validDocuments()), {
    checkedDocuments: 2,
    model: "environment-qualified",
  });
});

test("rejects an unavailable fixed-memory acceptance gate", () => {
  const documents = validDocuments();
  documents.set(
    "docs/quality-targets.md",
    "An Apple Silicon Mac with 8 GB of memory is the mandatory reference profile. See ADR 0015.\n",
  );

  assert.throws(
    () => validatePerformancePolicy(documents),
    /docs\/quality-targets\.md retains an unavailable fixed-memory performance gate/,
  );
});

test("requires the maintained environments and decision link", () => {
  const documents = validDocuments();
  documents.set("docs/quality-targets.md", "Local measurements are sufficient.\n");
  documents.set("docs/requirements.md", "Performance must be fast.\n");

  assert.throws(
    () => validatePerformancePolicy(documents),
    (error) => {
      assert.match(error.message, /docs\/quality-targets\.md must name hosted macOS/);
      assert.match(error.message, /docs\/quality-targets\.md must name local Apple Silicon/);
      assert.match(error.message, /docs\/quality-targets\.md must link ADR 0015/);
      assert.match(error.message, /docs\/requirements\.md must link ADR 0015/);
      return true;
    },
  );
});
