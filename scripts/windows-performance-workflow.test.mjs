import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/windows-performance.yml", import.meta.url),
  "utf8",
);

test("keeps Windows performance admission explicit and publication-authority-free", () => {
  assert.match(workflow, /^name: Windows performance admission$/m);
  assert.match(workflow, /^on:\n  workflow_dispatch:\n    inputs:/m);
  assert.match(
    workflow,
    /scope:\n\s+description: Windows performance boundary to execute\n\s+required: true\n\s+default: complete\n\s+type: choice\n\s+options:\n\s+- complete\n\s+- recovery-and-data/,
  );
  assert.match(
    workflow,
    /accepted_run_id:\n\s+description: Required successful cold-launch run when resuming recovery and data\n\s+required: false\n\s+type: string/,
  );
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /^permissions:\n  actions: read\n  contents: read$/m);
  assert.doesNotMatch(workflow, /secrets\.|upload-artifact|contents: write/);
});

test("runs every production data benchmark on the pinned Windows host", () => {
  assert.match(workflow, /^    runs-on: windows-2025$/m);
  assert.match(workflow, /^    timeout-minutes: 120$/m);
  assert.match(
    workflow,
    /name: Verify full-scale import budgets\n\s+run: npm run benchmark:import/,
  );
  assert.match(
    workflow,
    /name: Verify dense training-history budgets\n\s+run: npm run benchmark:dense-history/,
  );
  assert.match(
    workflow,
    /name: Verify Insights read-model performance budgets\n\s+run: npm run benchmark:insights/,
  );
});

test("runs package and cold-launch work only for a complete campaign", () => {
  assert.match(
    workflow,
    /name: Build the source-bound Windows package\n\s+if: inputs\.scope == 'complete'\n\s+run: npm run package:windows/,
  );
  assert.match(
    workflow,
    /name: Verify installed Windows cold-launch budget\n\s+if: inputs\.scope == 'complete'\n\s+run: npm run verify:windows-cold-launch/,
  );
  assert.ok(
    workflow.indexOf("name: Build the source-bound Windows package")
      < workflow.indexOf("name: Verify installed Windows cold-launch budget"),
  );
  assert.ok(
    workflow.indexOf("name: Verify installed Windows cold-launch budget")
      < workflow.indexOf("name: Verify full-scale import budgets"),
  );
});

test("admits a recovery-and-data resume only after verifying retained evidence", () => {
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(
    workflow,
    /name: Verify retained Windows cold-launch evidence\n\s+if: inputs\.scope == 'recovery-and-data'/,
  );
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /GITHUB_REPOSITORY: \$\{\{ github\.repository \}\}/);
  assert.match(workflow, /GITHUB_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /FITFREED_ACCEPTED_RUN_ID: \$\{\{ inputs\.accepted_run_id \}\}/);
  assert.match(
    workflow,
    /run: node scripts\/verify-windows-performance-resume\.mjs/,
  );
  assert.doesNotMatch(workflow, /run:.*inputs\.accepted_run_id/);
  assert.ok(
    workflow.indexOf("name: Verify retained Windows cold-launch evidence")
      < workflow.indexOf("name: Verify the Windows development environment"),
  );
});

test("runs the isolated NTFS disk-exhaustion recovery gate before data benchmarks", () => {
  assert.match(
    workflow,
    /name: Verify Windows filesystem failure recovery\n\s+run: npm run verify:windows-filesystem-reliability/,
  );
  assert.ok(
    workflow.indexOf("name: Verify installed Windows cold-launch budget")
      < workflow.indexOf("name: Verify Windows filesystem failure recovery"),
  );
  assert.ok(
    workflow.indexOf("name: Verify Windows filesystem failure recovery")
      < workflow.indexOf("name: Verify full-scale import budgets"),
  );
});

test("uses immutable actions and the repository toolchain contract", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.match(workflow, /run: npm run doctor/);
  assert.match(workflow, /run: npm ci/);
});
