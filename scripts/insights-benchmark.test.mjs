import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  insightsBenchmarkPlan,
  insightsBenchmarkTargetDirectory,
  repositoryRoot,
} from "./run-insights-benchmark.mjs";

test("isolates the application read-model benchmark from other Cargo builds", () => {
  const plan = insightsBenchmarkPlan({ RETAINED: "value" });

  assert.equal(
    insightsBenchmarkTargetDirectory,
    path.join(repositoryRoot, "src-tauri/target/insights-benchmark"),
  );
  assert.equal(plan.program, "cargo");
  assert.deepEqual(plan.arguments_, [
    "run",
    "--quiet",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--example",
    "insights_benchmark",
  ]);
  assert.equal(plan.options.cwd, repositoryRoot);
  assert.equal(
    plan.options.env.CARGO_TARGET_DIR,
    insightsBenchmarkTargetDirectory,
  );
  assert.equal(plan.options.env.RETAINED, "value");
  assert.equal(plan.options.stdio, "inherit");
});

test("wires the isolated benchmark into complete local verification", () => {
  const packageMetadata = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(
    packageMetadata.scripts["benchmark:insights"],
    "node scripts/run-insights-benchmark.mjs",
  );
  assert.match(packageMetadata.scripts["verify:full"], /benchmark:insights/);
});
