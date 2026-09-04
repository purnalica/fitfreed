import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/windows-performance.yml", import.meta.url),
  "utf8",
);

test("keeps Windows performance admission explicit and publication-authority-free", () => {
  assert.match(workflow, /^name: Windows performance admission$/m);
  assert.match(workflow, /^on:\n  workflow_dispatch:$/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
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

test("builds, installs, measures, and always removes the production package", () => {
  assert.match(workflow, /run: npm run package:windows/);
  assert.match(
    workflow,
    /name: Verify installed Windows cold-launch budget\n\s+run: npm run verify:windows-cold-launch/,
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

test("uses immutable actions and the repository toolchain contract", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.match(workflow, /run: npm run doctor/);
  assert.match(workflow, /run: npm ci/);
});
