import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectPublicLinuxExpansionWorkflow,
  validatePublicLinuxExpansionWorkflow,
} from "./public-linux-expansion-workflow.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/public-linux-expansion.yml", import.meta.url),
  "utf8",
);

test("accepts the exact native-build and protected-promotion topology", () => {
  const result = inspectPublicLinuxExpansionWorkflow();
  assert.equal(result.trigger, "workflow_dispatch");
  assert.equal(result.protectedEnvironment, "public-macos-release");
  assert.equal(result.approvalBoundaries, 2);
  assert.equal(result.nativeInputTarget, "linux-x86_64-deb");
  assert.deepEqual(result.candidateAdmissionRunners, ["ubuntu-24.04", "ubuntu-26.04"]);
  assert.equal(result.publicationOrder, "complete-platform-candidate-before-release-before-pages");
  assert.equal(result.actionReferenceCount, 22);
});

test("rejects automatic execution, moving actions, cancellation, or Linux secrets", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"), /automatic/],
    [(source) => source.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@main"), /unpinned/],
    [(source) => source.replace("cancel-in-progress: false", "cancel-in-progress: true"), /concurrency/],
    [(source) => source.replace(
      "          FITFREED_VERSION: ${{ inputs.version }}",
      "          FITFREED_VERSION: ${{ secrets.VERSION }}",
    ), /Linux input cannot receive/],
  ]) {
    assert.throws(() => validatePublicLinuxExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects unsealed native input, missing approvals, secret promotion, or unsafe order", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace(
      "${{ needs.build-linux-input.outputs.linux-input-sha256 }}",
      "synthetic-unbound-digest",
    ), /Linux input digest/],
    [(source) => source.replace(
      "    environment: public-macos-release\n    outputs:",
      "    outputs:",
    ), /protected composition/],
    [(source) => source.replace(
      "    environment: public-macos-release\n    permissions:\n      actions: read\n      artifact-metadata: write",
      "    permissions:\n      actions: read\n      artifact-metadata: write",
    ), /second protected approval/],
    [(source) => source.replace(
      "          GH_TOKEN: ${{ github.token }}\n          FITFREED_CANDIDATE: .artifacts/accepted-public-release/${{ inputs.version }}",
      "          GH_TOKEN: ${{ secrets.PUBLISH_TOKEN }}\n          FITFREED_CANDIDATE: .artifacts/accepted-public-release/${{ inputs.version }}",
    ), /promotion cannot receive/],
    [(source) => source.replace(
      "release/SHA256SUMS.minisig",
      "release/SHA256SUMS",
    ), /checksum signature has no source-bound attestation/],
    [(source) => source.replace(
      "Publish the immutable complete-platform GitHub Release",
      "Publish too early",
    ), /order is invalid/],
  ]) {
    assert.throws(() => validatePublicLinuxExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects incomplete, privileged, or bypassed exact Linux candidate admission", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace('          - "26.04"\n', ""), /Ubuntu 24.04 and 26.04/],
    [(source) => source.replace(
      '          - "26.04"\n',
      '          - "26.04"\n          - "28.04"\n',
    ), /Ubuntu 24.04 and 26.04/],
    [(source) => source.replace("      fail-fast: false", "      fail-fast: true"), /both Ubuntu rows/],
    [(source) => source.replace(
      "    needs: build-candidate\n    strategy:",
      "    needs: preflight\n    strategy:",
    ), /admission must follow protected composition/],
    [(source) => source.replace(
      "          FITFREED_CANDIDATE_SHA256: ${{ needs.build-candidate.outputs.candidate-sha256 }}",
      "          FITFREED_CANDIDATE_SHA256: unbound-candidate",
    ), /admission must verify the sealed candidate digest/],
    [(source) => source.replace(
      "          FITFREED_VERSION: ${{ inputs.version }}\n          FITFREED_UBUNTU_VERSION: ${{ matrix.ubuntu-version }}",
      "          FITFREED_VERSION: ${{ secrets.VERSION }}\n          FITFREED_UBUNTU_VERSION: ${{ matrix.ubuntu-version }}",
    ), /admission cannot receive/],
    [(source) => source.replace(
      "    needs: [build-candidate, admit-linux-candidate]",
      "    needs: build-candidate",
    ), /promotion must follow exact Linux candidate admission/],
    [(source) => source.replace(
      "      - name: Remove residual candidate package after admission\n        if: always()",
      "      - name: Remove residual candidate package after admission",
    ), /candidate package cleanup must always execute/],
  ]) {
    assert.throws(() => validatePublicLinuxExpansionWorkflow(mutate(workflow)), expected);
  }
});
