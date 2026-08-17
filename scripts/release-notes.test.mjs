import assert from "node:assert/strict";
import test from "node:test";

import {
  releaseNotesSourcePath,
  validateReviewedReleaseNotes,
} from "./release-notes.mjs";
import { renderDraftReleaseNotes } from "./release-evidence.mjs";

const reviewedNotes = `## Highlights

Explore four provider-neutral fitness histories in one local desktop library.

## Compatibility

Imports the documented Polar Flow export families on Apple Silicon macOS.

## Privacy and data

Imported fitness history stays in the local FitFreed library by default.

## Known limitations

This version has no supported user backup workflow.

## Installation and recovery

Use only the candidate-matched installation and recovery guidance.

## Support

Report privacy-safe diagnostics through the documented support boundary.
`;

function manifest() {
  return {
    release: {
      version: "0.1.0",
      revision: "a".repeat(40),
    },
    target: { architecture: "aarch64" },
    application: { storageSchemaVersion: 9 },
  };
}

test("accepts a complete reviewed release-note body for one version", () => {
  assert.equal(releaseNotesSourcePath("0.1.0"), "release/notes/0.1.0.md");
  assert.equal(validateReviewedReleaseNotes(reviewedNotes), reviewedNotes);
  assert.throws(
    () => releaseNotesSourcePath("../../private"),
    /invalid release notes version/,
  );
});

test("reports incomplete or structurally ambiguous reviewed notes together", () => {
  const invalidNotes = `# FitFreed 0.1.0

## Highlights

Example.

## Compatibility

Example.

## Privacy and data

Example.

## Installation and recovery

Example.

## Support

`;

  assert.throws(
    () => validateReviewedReleaseNotes(invalidNotes),
    (error) => {
      assert.match(error.message, /must begin with the Highlights section/);
      assert.match(error.message, /must not contain a level-one heading/);
      assert.match(error.message, /missing required section: Known limitations/);
      assert.match(error.message, /section has no content: Support/);
      return true;
    },
  );
});

test("keeps delivery trust and channel state in generated release evidence", () => {
  for (const [claim, expected] of [
    ["This package is unsigned.", /code-signing state/],
    ["This package is Apple notarized.", /notarization state/],
    ["This is the public release.", /public-release state/],
    ["This private development package is ready.", /private-distribution state/],
    ["Production update discovery is active.", /production-channel state/],
  ]) {
    assert.throws(
      () => validateReviewedReleaseNotes(reviewedNotes.replace(
        "This version has no supported user backup workflow.",
        claim,
      )),
      expected,
    );
  }
});

test("rejects reordered, unexpected, duplicated, and unterminated sections", () => {
  const invalidNotes = `${reviewedNotes.replace(
    "## Compatibility\n\nImports the documented Polar Flow export families on Apple Silicon macOS.\n\n",
    "",
  )}\n## Compatibility\n\nLate.\n\n## Highlights\n\nDuplicate.`;

  assert.throws(
    () => validateReviewedReleaseNotes(invalidNotes),
    (error) => {
      assert.match(error.message, /sections must appear exactly once in the required order/);
      assert.match(error.message, /must end with a newline/);
      return true;
    },
  );
});

test("assembles generated identity evidence with the exact reviewed body", () => {
  const rendered = renderDraftReleaseNotes(manifest(), reviewedNotes);

  assert.match(rendered, /^# FitFreed 0\.1\.0 private development package/);
  assert.match(rendered, /Source revision: `a{40}`/);
  assert.match(rendered, /Storage schema: 9/);
  assert.ok(rendered.endsWith(reviewedNotes));
  assert.equal(rendered.match(/^## Known limitations$/gm)?.length, 1);
  assert.throws(
    () => renderDraftReleaseNotes(manifest()),
    /reviewed release notes must be a string/,
  );
});
