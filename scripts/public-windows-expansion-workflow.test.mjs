import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectPublicWindowsExpansionWorkflow,
  validatePublicWindowsExpansionWorkflow,
} from "./public-windows-expansion-workflow.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/public-windows-expansion.yml", import.meta.url),
  "utf8",
);

test("accepts the exact three-platform Windows expansion topology", () => {
  const result = inspectPublicWindowsExpansionWorkflow();
  assert.equal(result.trigger, "workflow_dispatch");
  assert.deepEqual(result.protectedEnvironments, [
    "public-windows-release",
    "public-macos-release",
    "public-windows-product-acceptance",
    "public-macos-release",
  ]);
  assert.deepEqual(result.windowsRunners, [
    "windows-2025",
    "fitfreed-windows-11-admission",
  ]);
  assert.equal(result.nativeInputTarget, "windows-x86_64-nsis");
  assert.equal(result.publicationOrder, "technical-and-human-acceptance-before-release-before-pages");
  assert.equal(result.actionReferenceCount, 36);
  assert.doesNotMatch(workflow, /^      windows_certificate_sha256:/m);
  assert.match(
    workflow,
    /FITFREED_WINDOWS_CERTIFICATE_SHA256: \$\{\{ vars\.FITFREED_WINDOWS_CERTIFICATE_SHA256 \}\}/,
  );
});

test("rejects automatic execution, moving actions, cancellation, or unreviewed runners", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"), /automatic/],
    [(source) => source.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@main"), /unpinned/],
    [(source) => source.replace("cancel-in-progress: false", "cancel-in-progress: true"), /concurrency/],
    [(source) => source.replace("runs-on: windows-2025", "runs-on: [self-hosted, Windows, X64]"), /Windows input build/],
    [(source) => source.replace("fitfreed-windows-11-admission", "windows-2025"), /Windows admission runner/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects unsealed, mutable, or authority-coupled native inputs", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace(
      "${{ needs.build-windows-input.outputs.windows-input-sha256 }}",
      "unbound-windows-input",
    ), /Windows input digest/],
    [(source) => source.replace(
      "    environment: public-windows-release\n    outputs:",
      "    outputs:",
    ), /Windows release environment/],
    [(source) => source.replace(
      "signpath/github-action-submit-signing-request@c92b958760219087e01f8d67a1669ed57afe2627",
      "signpath/github-action-submit-signing-request@v2",
    ), /unpinned/],
    [(source) => source.replace(
      "artifact-configuration-slug: windows-inner-binaries",
      "artifact-configuration-slug: ${{ inputs.artifact_configuration }}",
    ), /fixed workflow configuration/],
    [(source) => source.replace(
      "github-artifact-id: ${{ steps.upload-unsigned-inner.outputs.artifact-id }}",
      "github-artifact-id: unbound",
    ), /preceding GitHub artifact/],
    [(source) => source.replace(
      'version: "${{ inputs.version }}"',
      'version: "0.0.0"',
    ), /source version/],
    [(source) => source.replace(
      "output-artifact-directory: .artifacts/windows-signpath/signed-inner",
      "output-artifact-directory: .artifacts/windows-signpath/unreviewed-inner",
    ), /signed-inner boundary/],
    [(source) => source.replace(
      '"$env:FITFREED_SIGNPATH_SIGNED_SETUP"',
      '".artifacts/windows-signpath/other-setup"',
    ), /exact SignPath setup output/],
    [(source) => source.replace(
      "          FITFREED_VERSION: ${{ inputs.version }}\n          FITFREED_LINUX_INPUT: .artifacts/windows-expansion/linux-input",
      "          FITFREED_VERSION: ${{ secrets.VERSION }}\n          FITFREED_LINUX_INPUT: .artifacts/windows-expansion/linux-input",
    ), /Linux input cannot receive/],
    [(source) => source.replace(
      "          FITFREED_VERSION: ${{ inputs.version }}\n          FITFREED_SIGNPATH_UNSIGNED_INNER: .artifacts/windows-signpath/unsigned-inner",
      "          FITFREED_VERSION: ${{ inputs.version }}\n          FITFREED_WINDOWS_CERTIFICATE_BASE64: ${{ secrets.LEGACY_PFX }}\n          FITFREED_SIGNPATH_UNSIGNED_INNER: .artifacts/windows-signpath/unsigned-inner",
    ), /superseded local signing authority/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects bypassed or privileged exact candidate admission", () => {
  for (const [mutate, expected] of [
    [(source) => source.replaceAll(
      "          FITFREED_CANDIDATE_SHA256: ${{ needs.build-candidate.outputs.candidate-sha256 }}",
      "          FITFREED_CANDIDATE_SHA256: unbound-candidate",
    ), /admission must verify/],
    [(source) => source.replace(
      "          FITFREED_VERSION: ${{ inputs.version }}\n          FITFREED_ISSUED_AT: ${{ needs.build-candidate.outputs.issued-at }}",
      "          FITFREED_VERSION: ${{ secrets.VERSION }}\n          FITFREED_ISSUED_AT: ${{ needs.build-candidate.outputs.issued-at }}",
    ), /admission cannot receive/],
    [(source) => source.replace(
      "      - name: Verify exact Windows candidate installation and cold launch",
      "      - name: Skip exact Windows candidate installation and cold launch",
    ), /order is invalid/],
    [(source) => source.replace("-Action remove", "-Action preflight"), /candidate cleanup/],
    [(source) => source.replace("npm run verify:windows-update-e2e", "npm run test:windows-scripts"), /update recovery/],
    [(source) => source.replace("npm run verify:windows-filesystem-reliability", "npm run test:windows-scripts"), /filesystem recovery/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects publication without both technical and product-owner acceptance", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace(
      "    environment: public-windows-product-acceptance",
      "    environment: public-macos-release",
    ), /product-owner environment/],
    [(source) => source.replace(
      "    needs: [build-candidate, admit-linux-candidate, admit-windows-candidate]",
      "    needs: build-candidate",
    ), /product-owner gate must follow/],
    [(source) => source.replace(
      "    needs: [build-candidate, accept-product-experience]",
      "    needs: build-candidate",
    ), /promotion must follow/],
    [(source) => source.replace(
      "          GH_TOKEN: ${{ github.token }}\n          FITFREED_CANDIDATE: .artifacts/accepted-public-release/${{ inputs.version }}",
      "          GH_TOKEN: ${{ secrets.PUBLISH_TOKEN }}\n          FITFREED_CANDIDATE: .artifacts/accepted-public-release/${{ inputs.version }}",
    ), /promotion cannot receive/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});
