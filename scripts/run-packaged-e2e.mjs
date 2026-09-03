import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { packagedE2eScenarioPlan } from "./packaged-e2e-plan.mjs";
import { repositoryRoot } from "./e2e-paths.mjs";

const runsDirectory = path.resolve(".artifacts/e2e/runs");
const wdio = path.resolve("node_modules/.bin/wdio");

function controlledRunDirectory(runDirectory) {
  const artifactRoot = path.join(repositoryRoot, ".artifacts");
  const relative = path.relative(artifactRoot, runDirectory);
  if (!path.isAbsolute(runDirectory) || relative === "" || relative.startsWith("..")) {
    throw new Error("the controlled E2E run directory must be below .artifacts");
  }
  return runDirectory;
}

export function runPackagedE2e({
  environment = process.env,
  execute = spawnSync,
  removeCompletedRun = true,
  runDirectory: requestedRunDirectory = null,
} = {}) {
  mkdirSync(runsDirectory, { recursive: true });
  const runDirectory = requestedRunDirectory === null
    ? mkdtempSync(path.join(runsDirectory, "packaged-"))
    : controlledRunDirectory(requestedRunDirectory);
  if (requestedRunDirectory !== null) {
    if (existsSync(runDirectory)) {
      throw new Error("the controlled E2E run directory already exists");
    }
    mkdirSync(runDirectory, { recursive: true });
  }
  const scenarios = packagedE2eScenarioPlan(runDirectory);
  let complete = false;

  try {
    for (const scenario of scenarios) {
      const result = execute(
        wdio,
        ["run", scenario.configuration, "--spec", scenario.spec],
        {
          env: {
            ...environment,
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
    return scenarios;
  } finally {
    if (complete && removeCompletedRun) {
      rmSync(runDirectory, { recursive: true, force: true });
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runPackagedE2e();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
