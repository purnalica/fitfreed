import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { packagedE2eScenarioPlan } from "./packaged-e2e-plan.mjs";

const runsDirectory = path.resolve(".artifacts/e2e/runs");
mkdirSync(runsDirectory, { recursive: true });
const runDirectory = mkdtempSync(path.join(runsDirectory, "packaged-"));
const wdio = path.resolve("node_modules/.bin/wdio");
const scenarios = packagedE2eScenarioPlan(runDirectory);
let complete = false;

try {
  for (const scenario of scenarios) {
    const result = spawnSync(
      wdio,
      ["run", scenario.configuration, "--spec", scenario.spec],
      {
        env: {
          ...process.env,
          FITFREED_E2E_DATABASE_PATH: scenario.databasePath,
          ...(scenario.restartIdentityPath === null ? {} : {
            FITFREED_E2E_RESTART_IDENTITY_PATH: scenario.restartIdentityPath,
          }),
        },
        stdio: "inherit",
      },
    );
    if (result.error) throw result.error;
    if (result.signal !== null) {
      throw new Error(`Packaged ${scenario.name} E2E was terminated by ${result.signal}`);
    }
    if (result.status !== 0) {
      throw new Error(`Packaged ${scenario.name} E2E failed with status ${result.status}`);
    }
  }
  complete = true;
} finally {
  if (complete) rmSync(runDirectory, { recursive: true, force: true });
}
