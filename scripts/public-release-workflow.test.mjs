import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectPublicReleaseWorkflow,
  validatePublicReleaseWorkflow,
} from "./public-release-workflow.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/public-release.yml", import.meta.url),
  "utf8",
);

test("accepts the exact manual protected release topology", () => {
  const result = inspectPublicReleaseWorkflow();
  assert.equal(result.trigger, "workflow_dispatch");
  assert.equal(result.protectedEnvironment, "public-macos-release");
  assert.equal(result.approvalBoundaries, 2);
  assert.equal(result.publicationOrder, "accepted-candidate-before-release-before-pages");
  assert.equal(result.actionReferenceCount, 14);
});

test("rejects automatic triggers, moving pins, cancellation, or preflight secrets", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"), /automatic/],
    [(source) => source.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@main"), /unpinned/],
    [(source) => source.replace("cancel-in-progress: false", "cancel-in-progress: true"), /concurrency/],
    [(source) => source.replace("  contents: read\n\nconcurrency:", "  contents: write\n\nconcurrency:"), /default permissions/],
    [(source) => source.replace(
      "          GH_TOKEN: ${{ github.token }}",
      "          GH_TOKEN: ${{ secrets.UNTRUSTED }}",
    ), /preflight cannot receive/],
  ]) {
    assert.throws(() => validatePublicReleaseWorkflow(mutate(workflow)), expected);
  }
});

test("rejects a bypassed approval, candidate transport, publication order, cleanup, or remote gate", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("environment: public-macos-release", "environment: unprotected"), /protected environment/],
    [(source) => source.replace(
      "  publish-candidate:\n",
      "  publish-candidate:\n",
    ).replace(
      "    environment: public-macos-release\n    permissions:\n      actions: read\n      artifact-metadata: write",
      "    permissions:\n      actions: read\n      artifact-metadata: write",
    ), /second protected approval/],
    [(source) => source.replace(
      "${{ needs.build-candidate.outputs.candidate-sha256 }}",
      `${"a".repeat(64)}`,
    ), /sealed digest/],
    [(source) => source.replace(
      "Publish the immutable GitHub Release",
      "Publish the immutable GitHub Release before attestations",
    ).replace(
      "Attest every checksum-bound public asset",
      "Publish the immutable GitHub Release",
    ), /order is invalid/],
    [(source) => source.replace("        if: always()", "        if: success()"), /cleanup must always/],
    [(source) => source.replace("needs: deploy-pages", "needs: build-and-publish"), /remote verification must follow/],
  ]) {
    assert.throws(() => validatePublicReleaseWorkflow(mutate(workflow)), expected);
  }
});
