import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/linux-performance.yml", import.meta.url),
  "utf8",
);

test("keeps Linux performance admission explicit and publication-authority-free", () => {
  assert.match(workflow, /^name: Linux performance admission$/m);
  assert.match(workflow, /^on:\n  workflow_dispatch:$/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow, /secrets\.|upload-artifact|contents: write/);
});

test("runs every production data benchmark on Ubuntu 24.04", () => {
  assert.match(workflow, /^    runs-on: ubuntu-24\.04$/m);
  assert.match(workflow, /^    timeout-minutes: 95$/m);
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

test("builds, verifies, installs, measures, and always removes the production package", () => {
  assert.match(workflow, /run: npm run package:linux/);
  assert.match(workflow, /run: npm run verify:linux-package/);
  assert.match(workflow, /if dpkg-query -W fitfreed[\s\S]*exit 1[\s\S]*fi/);
  assert.match(workflow, /test ! -e \/usr\/bin\/fitfreed/);
  assert.match(workflow, /sudo apt-get install --yes "\.\/\$debian_package"/);
  assert.match(
    workflow,
    /name: Verify installed Linux cold-launch budget\n\s+run: xvfb-run -a npm run benchmark:cold-launch/,
  );
  assert.match(workflow, /name: Remove the benchmark package\n\s+if: always\(\)/);
  assert.ok(
    workflow.indexOf("name: Verify installed Linux cold-launch budget")
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
