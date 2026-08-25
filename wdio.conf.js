import { mkdirSync } from "node:fs";
import path from "node:path";

import { e2eApplicationBinary } from "./scripts/e2e-paths.mjs";

const application = e2eApplicationBinary;
const evidenceDirectory = path.resolve(".artifacts/e2e/evidence");
mkdirSync(evidenceDirectory, { recursive: true });
process.env.FITFREED_E2E_DATABASE_PATH ??= path.resolve(
  `.artifacts/e2e/library-${process.pid}.sqlite`,
);
process.env.FITFREED_E2E_FIXTURE_DIRECTORY ??= path.resolve(".artifacts/e2e/fixtures");
process.env.FITFREED_E2E_LARGE_ARCHIVE ??= path.resolve(".artifacts/e2e/large.zip");
process.env.FITFREED_E2E_INSIGHTS_PERFORMANCE_ARCHIVE ??= path.resolve(
  ".artifacts/e2e/insights-performance.zip",
);

export const config = {
  runner: "local",
  specs: ["./test/e2e/**/*.spec.js"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": { application },
    },
  ],
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: application,
        driverProvider: "embedded",
        captureBackendLogs: true,
        captureFrontendLogs: true,
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  outputDir: path.join(evidenceDirectory, "logs"),
  logLevel: "warn",
  waitforTimeout: 10_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 1,
  mochaOpts: {
    ui: "bdd",
    timeout: 420_000,
  },
  afterTest: async function (test, _context, result) {
    if (result.passed) return;
    const safeName = test.title.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "");
    try {
      await browser.saveScreenshot(path.join(evidenceDirectory, `${safeName || "failure"}.png`));
    } catch (error) {
      process.stderr.write(`Could not capture E2E failure screenshot: ${String(error)}\n`);
    }
  },
};
