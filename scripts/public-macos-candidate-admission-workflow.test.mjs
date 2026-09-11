import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectPublicMacosCandidateAdmissionWorkflow,
  validatePublicMacosCandidateAdmissionWorkflow,
} from "./public-macos-candidate-admission-workflow.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/public-macos-candidate-admission.yml", import.meta.url),
  "utf8",
);

test("accepts the exact secret-free macOS candidate admission topology", () => {
  assert.deepEqual(inspectPublicMacosCandidateAdmissionWorkflow(), {
    actionReferenceCount: 3,
    candidateBoundary: "downloaded-sealed-public-macos-candidate",
    publicationAuthority: false,
    trigger: "workflow_dispatch",
  });
});

test("rejects automatic execution, mutable actions, secrets, or publication authority", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"), /automatic/],
    [(source) => source.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@main"), /unpinned/],
    [(source) => source.replace("  contents: read\n\nconcurrency:", "  contents: write\n\nconcurrency:"), /default permissions/],
    [(source) => source.replace("          GH_TOKEN: ${{ github.token }}", "          GH_TOKEN: ${{ secrets.TOKEN }}"), /protected authority/],
    [(source) => source.replace("      contents: read", "      contents: write"), /job permissions/],
    [(source) => `${source}\n    environment: public-macos-release\n` , /protected authority/],
  ]) {
    assert.throws(() => validatePublicMacosCandidateAdmissionWorkflow(mutate(workflow)), expected);
  }
});

test("requires exact provenance, artifact, digest, reopening, and native admission order", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("artifact-ids: ${{ inputs.artifact_id }}", "name: candidate"), /artifact ID/],
    [(source) => source.replace("digest-mismatch: error", "digest-mismatch: warn"), /digest mismatch/],
    [(source) => source.replace("Verify the originating protected candidate", "Inspect something else"), /order/],
    [(source) => source
      .replace("Reopen the digest-bound candidate", "TEMPORARY_ADMISSION_MARKER")
      .replace("Admit the installed candidate", "Reopen the digest-bound candidate")
      .replace("TEMPORARY_ADMISSION_MARKER", "Admit the installed candidate"), /order/],
    [(source) => source.replace("verify:macos-public-candidate --", "verify:development-release --"), /native admission/],
  ]) {
    assert.throws(() => validatePublicMacosCandidateAdmissionWorkflow(mutate(workflow)), expected);
  }
});
