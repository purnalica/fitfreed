import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateWindowsCiWorkflow } from "./windows-ci-workflow.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

test("accepts the pinned impact-aware Windows native-host lane", () => {
  assert.deepEqual(validateWindowsCiWorkflow(workflow), {
    evidenceLane: "windows-2025-x86_64-host",
    executable: "fitfreed.exe",
    runner: "windows-2025",
  });
});

test("rejects an unpinned, Unix-dependent, incomplete, or reusable-without-proof lane", () => {
  const invalidWorkflows = [
    [(source) => source.replace("runs-on: windows-2025", "runs-on: windows-latest"), /windows-2025/],
    [(source) => source.replace(
      "      - name: Verify the Windows development environment\n        if: steps.decision.outputs.full-verification == 'true'\n        run: npm run doctor",
      "      - name: Verify the Windows development environment\n        if: steps.decision.outputs.full-verification == 'true'\n        run: bash scripts/check-development-environment.sh",
    ), /Unix-only/],
    [(source) => source.replace("npm run build:windows-host", "cargo build"), /complete Windows desktop host/],
    [(source) => source.replaceAll(
      "fitfreed-windows-host-v1-${{ needs.quality.outputs.executable-fingerprint }}",
      "fitfreed-windows-host-v1-unbound",
    ), /executable fingerprint/],
    [(source) => source.replaceAll(
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      "actions/setup-node@main",
    ), /not pinned/],
    [(source) => source.replace(
      "node scripts/windows-verification-evidence.mjs verify",
      "node -e true",
    ), /reopen cached evidence/],
    [(source) => source.replaceAll(
      "      - name: Install locked JavaScript dependencies",
      "      - name: Record premature evidence\n        run: node scripts/windows-verification-evidence.mjs record premature aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n\n      - name: Install locked JavaScript dependencies",
    ), /recorded after every required verification/],
    [(source) => source.replace(
      "needs.windows-host.result == 'success'",
      "needs.windows-host.result == 'skipped'",
    ), /complete verification evidence/],
    [(source) => source.replace(
      "    runs-on: windows-2025\n    timeout-minutes: 60\n    permissions:\n      contents: read",
      "    runs-on: windows-2025\n    timeout-minutes: 60\n    permissions:\n      contents: write",
    ), /read-only/],
  ];
  for (const [index, [mutate, expected]] of invalidWorkflows.entries()) {
    assert.throws(
      () => validateWindowsCiWorkflow(mutate(workflow)),
      expected,
      `invalid workflow case ${index + 1}`,
    );
  }
});
