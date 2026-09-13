import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectLinuxCandidateLaunchDiagnosticsWorkflow,
  validateLinuxCandidateLaunchDiagnosticsWorkflow,
} from "./linux-candidate-launch-diagnostics-workflow.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/linux-candidate-launch-diagnostics.yml", import.meta.url),
  "utf8",
);

test("accepts one exact secret-free Linux candidate launch diagnostic", () => {
  assert.deepEqual(inspectLinuxCandidateLaunchDiagnosticsWorkflow(), {
    actionReferenceCount: 3,
    candidateBoundary: "downloaded-sealed-linux-candidate",
    launchCount: 1,
    publicationAuthority: false,
    runner: "ubuntu-24.04",
    trigger: "workflow_dispatch",
  });
});

test("rejects automatic execution, mutable actions, protected authority, or publication rights", () => {
  for (const [mutate, expected] of [
    [(source) => source.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"), /automatic/],
    [(source) => source.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@main"), /unpinned/],
    [(source) => source.replace("  contents: read\n\nconcurrency:", "  contents: write\n\nconcurrency:"), /default/],
    [(source) => `${source}\n    environment: public-macos-release\n`, /protected authority/],
    [(source) => source.replace("      contents: read", "      contents: write"), /job permissions/],
  ]) {
    assert.throws(() => validateLinuxCandidateLaunchDiagnosticsWorkflow(mutate(workflow)), expected);
  }
});

test("requires exact transport, signed-candidate, single-launch, and cleanup boundaries", () => {
  for (const [mutate, expected] of [
    [
      (source) => source.replace(
        'WEBKIT_DISABLE_COMPOSITING_MODE: "1"',
        'WEBKIT_DISABLE_COMPOSITING_MODE: "0"',
      ),
      /software-compositing/,
    ],
    [(source) => source.replace("artifact-ids: ${{ inputs.artifact_id }}", "name: candidate"), /artifact ID/],
    [(source) => source.replace("digest-mismatch: error", "digest-mismatch: warn"), /digest mismatch/],
    [(source) => source.replace("unpack:public-release", "verify:public-release"), /transport digest/],
    [(source) => source.replace("xvfb-run -a npm run diagnose:linux-candidate-launch --", "npm run benchmark:cold-launch"), /one exact installed launch/],
    [(source) => source.replace("        if: always()", "        if: success()"), /cleanup/],
  ]) {
    assert.throws(() => validateLinuxCandidateLaunchDiagnosticsWorkflow(mutate(workflow)), expected);
  }
});
