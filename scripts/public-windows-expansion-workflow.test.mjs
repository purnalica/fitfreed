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
const packageManifest = JSON.parse(readFileSync(
  new URL("../package.json", import.meta.url),
  "utf8",
));

test("accepts the exact three-platform unsigned Windows preview topology", () => {
  const result = inspectPublicWindowsExpansionWorkflow();
  assert.equal(result.trigger, "workflow_dispatch");
  assert.deepEqual(result.protectedEnvironments, [
    "public-macos-release",
    "public-macos-release",
  ]);
  assert.deepEqual(result.windowsRunners, ["windows-2025"]);
  assert.equal(result.nativeInputTarget, "windows-x86_64-nsis");
  assert.equal(result.windowsTrustProfile, "public-unsigned-preview");
  assert.equal(result.publicationOrder, "native-admission-before-release-before-pages");
  assert.equal(result.actionReferenceCount, 29);
  assert.equal(
    packageManifest.scripts["prepare:windows-unsigned-preview-input"],
    "npm run icons && node scripts/prepare-windows-expansion-input.mjs --unsigned-preview",
  );
  assert.match(workflow, /npm run prepare:windows-unsigned-preview-input --/);
  assert.doesNotMatch(workflow, /SignPath|FITFREED_WINDOWS_CERTIFICATE|self-hosted/i);
  assert.doesNotMatch(workflow, /public-windows-release|public-windows-product-acceptance/);
});

test("rejects automatic execution, moving actions, cancellation, or unreviewed runners", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"), /automatic/],
    [(source) => source.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@main"), /unpinned/],
    [(source) => source.replace("cancel-in-progress: false", "cancel-in-progress: true"), /concurrency/],
    [(source) => source.replace("runs-on: windows-2025", "runs-on: [self-hosted, Windows, X64]"), /forbidden/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects signing authority, hidden trust selection, or unsealed native inputs", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace(
      "      windows-input-trust-profile: ${{ steps.prepare.outputs.windows_input_trust_profile }}\n",
      "",
    ), /digest and trust profile/],
    [(source) => source.replace(
      "prepare:windows-unsigned-preview-input",
      "prepare:windows-expansion-input",
    ), /unsigned preview profile/],
    [(source) => source.replaceAll("public-unsigned-preview", "public-authenticode"), /unsigned preview profile/],
    [(source) => source.replace(
      "    outputs:\n      windows-input-sha256:",
      "    environment: public-windows-release\n    outputs:\n      windows-input-sha256:",
    ), /retains retired signing/],
    [(source) => source.replace(
      "          FITFREED_VERSION: ${{ inputs.version }}\n          FITFREED_WINDOWS_INPUT: .artifacts/windows-expansion/windows-input",
      "          FITFREED_VERSION: ${{ secrets.VERSION }}\n          FITFREED_WINDOWS_INPUT: .artifacts/windows-expansion/windows-input",
    ), /cannot receive protected/],
    [(source) => source.replace(
      "${{ needs.build-windows-input.outputs.windows-input-sha256 }}",
      "unbound-windows-input",
    ), /Windows input digest/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects bypassed candidate admission and repeated product campaigns", () => {
  for (const [mutate, expected] of [
    [(source) => source.replaceAll(
      "${{ needs.build-candidate.outputs.candidate-sha256 }}",
      "unbound-candidate",
    ), /admission must verify/],
    [(source) => source.replace("npm run verify:windows-cold-launch", "npm run test:windows-scripts"), /launch the exact/],
    [(source) => source.replace("          -Action remove", "          -Action preflight"), /cleanup/],
    [(source) => source.replace(
      "      - name: Remove residual Windows candidate state after admission",
      "      - name: Verify packaged Windows capability\n        run: npm run verify:windows-e2e\n\n      - name: Remove residual Windows candidate state after admission",
    ), /repeats unrelated/],
    [(source) => source.replace(
      "    needs: [build-candidate, admit-linux-candidate, admit-windows-candidate]",
      "    needs: build-candidate",
    ), /must follow every native admission/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});

test("rejects publication authority outside the protected release jobs", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace(
      "    environment: public-macos-release\n    outputs:",
      "    outputs:",
    ), /protected release authority/],
    [(source) => source.replace(
      "          GH_TOKEN: ${{ github.token }}\n          FITFREED_CANDIDATE: .artifacts/accepted-public-release/${{ inputs.version }}",
      "          GH_TOKEN: ${{ secrets.PUBLISH_TOKEN }}\n          FITFREED_CANDIDATE: .artifacts/accepted-public-release/${{ inputs.version }}",
    ), /promotion cannot receive/],
    [(source) => source.replace(
      "    needs: publish-candidate",
      "    needs: build-candidate",
    ), /Pages must follow publication/],
  ]) {
    assert.throws(() => validatePublicWindowsExpansionWorkflow(mutate(workflow)), expected);
  }
});
