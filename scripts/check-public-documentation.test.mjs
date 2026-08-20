import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadPublicDocumentationBundle,
  validatePublicDocumentationBundle,
} from "./check-public-documentation.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function bundle() {
  return structuredClone(loadPublicDocumentationBundle(repositoryRoot));
}

test("accepts the complete version-matched public documentation set", () => {
  assert.deepEqual(validatePublicDocumentationBundle(bundle()), {
    version: "0.1.0",
    documents: 7,
    locales: ["en-US", "es-ES"],
    catalogGuidanceKeys: 17,
  });
});

test("rejects version drift and an incomplete public operations procedure", () => {
  const candidate = bundle();
  candidate.version = "0.2.0";
  candidate.documents["docs/development/public-release-operations.md"] = candidate.documents[
    "docs/development/public-release-operations.md"
  ].replace("## Exact-candidate evaluation", "## Candidate review");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /missing public documentation: docs\/user\/public-macos-0\.2\.0\.md/);
      assert.match(error.message, /policy version does not match package version/);
      assert.match(error.message, /operations section order/);
      return true;
    },
  );
});

test("rejects missing locale guidance and distribution state in reviewed notes", () => {
  const candidate = bundle();
  delete candidate.catalogs["es-ES"].updates.recovery;
  delete candidate.policy.update.releaseNotes["es-ES"];
  candidate.reviewedReleaseNotes = candidate.reviewedReleaseNotes.replace(
    "FitFreed 0.1.0 supports Apple Silicon",
    "This public release supports Apple Silicon",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /policy locales must be exactly: en-US, es-ES/);
      assert.match(error.message, /es-ES catalog is missing public guidance: updates\.recovery\.updated/);
      assert.match(error.message, /generated public-release state/);
      return true;
    },
  );
});

test("rejects guidance that no longer declares the inactive release boundary", () => {
  const candidate = bundle();
  const guidePath = "docs/user/public-macos-0.1.0.md";
  candidate.documents[guidePath] = candidate.documents[guidePath].replace(
    "No public binary is available while",
    "A public binary is available while",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    /userGuide does not document inactive public-release status/,
  );
});

test("rejects public guidance or evaluation that drops implemented MVP journeys", () => {
  const candidate = bundle();
  const guidePath = "docs/user/public-macos-0.1.0.md";
  const evaluationPath = "docs/testing/macos-candidate-manual-evaluation.md";
  candidate.documents[guidePath] = candidate.documents[guidePath]
    .replace("**Show me how**", "**Continue**")
    .replace("user-authored segmentation", "personal views")
    .replace("privacy-reviewed self-contained HTML export", "local output");
  candidate.documents[evaluationPath] = candidate.documents[evaluationPath]
    .replace("Start a report from a session", "Start a note from a session")
    .replace("Create and reopen a report", "Create and reopen a note")
    .replace("From a training session, create a report", "From a training session, create a note");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /userGuide does not document bundled source acquisition/);
      assert.match(error.message, /userGuide does not document implemented training exploration/);
      assert.match(error.message, /userGuide does not document implemented report export/);
      assert.match(error.message, /manualEvaluation does not document keyboard report evaluation/);
      assert.match(error.message, /manualEvaluation does not document VoiceOver report evaluation/);
      assert.match(error.message, /manualEvaluation does not document realistic report evaluation/);
      return true;
    },
  );
});
