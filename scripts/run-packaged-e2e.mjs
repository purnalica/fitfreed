import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const runsDirectory = path.resolve(".artifacts/e2e/runs");
mkdirSync(runsDirectory, { recursive: true });
const runDirectory = mkdtempSync(path.join(runsDirectory, "packaged-"));
const wdio = path.resolve("node_modules/.bin/wdio");
const scenarios = [
  ["journey", "test/e2e/import-journey.spec.js"],
  ["performance", "test/e2e/insights-performance.spec.js"],
];
let complete = false;

try {
  for (const [name, spec] of scenarios) {
    const result = spawnSync(wdio, ["run", "wdio.conf.js", "--spec", spec], {
      env: {
        ...process.env,
        FITFREED_E2E_DATABASE_PATH: path.join(runDirectory, `${name}.sqlite`),
      },
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.signal !== null) {
      throw new Error(`Packaged ${name} E2E was terminated by ${result.signal}`);
    }
    if (result.status !== 0) {
      throw new Error(`Packaged ${name} E2E failed with status ${result.status}`);
    }
  }
  complete = true;
} finally {
  if (complete) rmSync(runDirectory, { recursive: true, force: true });
}
