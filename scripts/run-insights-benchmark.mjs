import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  performanceBenchmarkEnvironment,
  repositoryRoot,
} from "./performance-benchmark-profile.mjs";

export function insightsBenchmarkPlan(inheritedEnvironment = process.env) {
  return {
    program: "cargo",
    arguments_: [
      "run",
      "--quiet",
      "--release",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--example",
      "insights_benchmark",
    ],
    options: {
      cwd: repositoryRoot,
      env: performanceBenchmarkEnvironment(inheritedEnvironment),
      stdio: "inherit",
    },
  };
}

export function runInsightsBenchmark({
  execute = execFileSync,
  inheritedEnvironment = process.env,
} = {}) {
  const plan = insightsBenchmarkPlan(inheritedEnvironment);
  execute(plan.program, plan.arguments_, plan.options);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    runInsightsBenchmark();
  } catch (error) {
    process.stderr.write(`Insights benchmark failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
