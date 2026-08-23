import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { e2eBuildEnvironment } from "./build-e2e.mjs";
import { packagedE2eScenarioPlan } from "./packaged-e2e-plan.mjs";
import {
  e2eTargetDirectory,
  updateE2eTargetDirectory,
} from "./e2e-paths.mjs";
import { config as defaultConfig } from "../wdio.conf.js";
import { config as performanceConfig } from "../wdio.performance.conf.js";
import { parseExactApplicationProcessIds } from "../test/e2e/support/application-process.js";

test("keeps the instrumented executable outside the production target", () => {
  const application = defaultConfig.capabilities[0]["tauri:options"].application;
  const serviceApplication = defaultConfig.services[0][1].appBinaryPath;

  assert.equal(application, path.resolve("src-tauri/target/e2e/release/fitfreed"));
  assert.equal(serviceApplication, application);
  assert.notEqual(application, path.resolve("src-tauri/target/release/fitfreed"));
});

test("gives the instrumented macOS application a stable isolated identity", () => {
  const productionConfig = JSON.parse(
    readFileSync(path.resolve("src-tauri/tauri.conf.json"), "utf8"),
  );
  const e2eConfig = JSON.parse(
    readFileSync(path.resolve("src-tauri/tauri.e2e.conf.json"), "utf8"),
  );

  assert.equal(e2eConfig.identifier, "org.fitfreed.desktop.e2e");
  assert.notEqual(e2eConfig.identifier, productionConfig.identifier);
});

test("binds the isolated E2E package to its exact source", () => {
  const revision = "a".repeat(40);
  const environment = e2eBuildEnvironment(
    {
      FITFREED_PUBLIC_UPDATE_CONTRACT: "unexpected",
      FITFREED_PUBLIC_UPDATE_ENDPOINT: "unexpected",
      FITFREED_PUBLIC_UPDATE_TRUST: "unexpected",
      RETAINED: "value",
    },
    revision,
    "",
  );

  assert.equal(environment.CARGO_TARGET_DIR, e2eTargetDirectory);
  assert.equal(environment.VITE_FITFREED_E2E, "true");
  assert.equal(environment.FITFREED_SOURCE_REVISION, revision);
  assert.equal(environment.FITFREED_SOURCE_TREE_CLEAN, "true");
  assert.equal(environment.RETAINED, "value");
  assert.equal(environment.FITFREED_PUBLIC_UPDATE_CONTRACT, undefined);
  assert.equal(environment.FITFREED_PUBLIC_UPDATE_ENDPOINT, undefined);
  assert.equal(environment.FITFREED_PUBLIC_UPDATE_TRUST, undefined);
});

test("keeps packaged update fixtures outside both retained application targets", () => {
  assert.equal(
    updateE2eTargetDirectory,
    path.resolve(".artifacts/update-e2e/target"),
  );
  assert.notEqual(updateE2eTargetDirectory, e2eTargetDirectory);
  assert.notEqual(updateE2eTargetDirectory, path.resolve("src-tauri/target"));
});

test("gives the exhaustive functional journey a bounded campaign watchdog", () => {
  assert.equal(defaultConfig.mochaOpts.timeout, 300_000);
  assert.deepEqual(defaultConfig.specs, ["./test/e2e/**/*.spec.js"]);
});

test("isolates the longer performance campaign without relaxing interaction budgets", () => {
  assert.equal(performanceConfig.mochaOpts.timeout, 600_000);
  assert.deepEqual(performanceConfig.specs, ["./test/e2e/insights-performance.spec.js"]);
  assert.equal(performanceConfig.waitforTimeout, defaultConfig.waitforTimeout);
  assert.equal(
    performanceConfig.connectionRetryTimeout,
    defaultConfig.connectionRetryTimeout,
  );
});

test("restarts the packaged process against the exact functional-journey library", () => {
  const plan = packagedE2eScenarioPlan(path.resolve("controlled-run"));

  assert.deepEqual(plan.map(({ name }) => name), [
    "journey",
    "restart",
    "adaptive-sessions",
    "adaptive-sessions-restart",
    "performance",
  ]);
  assert.equal(plan[0].databasePath, plan[1].databasePath);
  assert.equal(
    plan[0].restartIdentityPath,
    plan[1].restartIdentityPath,
  );
  assert.equal(plan[1].spec, "test/e2e/restart-evidence.e2e.js");
  assert.equal(plan[2].spec, "test/e2e/adaptive-session-composition.spec.js");
  assert.notEqual(plan[2].databasePath, plan[0].databasePath);
  assert.equal(plan[2].databasePath, plan[3].databasePath);
  assert.equal(plan[2].restartIdentityPath, plan[3].restartIdentityPath);
  assert.equal(plan[3].spec, "test/e2e/adaptive-session-restart.e2e.js");
  assert.notEqual(plan[4].databasePath, plan[0].databasePath);
  assert.notEqual(plan[4].databasePath, plan[2].databasePath);
  assert.equal(plan[4].restartIdentityPath, null);
});

test("identifies only the exact packaged application command", () => {
  const application = "/tmp/Fit Freed.app/Contents/MacOS/fitfreed";
  const processTable = [
    `  101 ${application}`,
    `  102 ${application} --private-mode`,
    "  103 /tmp/fitfreed-helper",
    "invalid row",
  ].join("\n");

  assert.deepEqual(
    parseExactApplicationProcessIds(processTable, application),
    [101],
  );
});

test("keeps packaged layout timing independent of animation-frame visibility", () => {
  const performanceJourney = readFileSync(
    path.resolve("test/e2e/support/insights-performance.js"),
    "utf8",
  );
  const comparisonStart = performanceJourney.indexOf(
    "async function compareActivityRanges",
  );
  const comparisonEnd = performanceJourney.indexOf(
    "async function applyTrainingRange",
    comparisonStart,
  );
  assert.ok(comparisonStart >= 0 && comparisonEnd > comparisonStart);
  const comparison = performanceJourney.slice(comparisonStart, comparisonEnd);

  assert.doesNotMatch(comparison, /requestAnimationFrame/);
  assert.match(comparison, /exactValues\.open = true/);
  assert.match(comparison, /setTimeout\(\(\) => \{/);
  assert.match(comparison, /querySelector\("table"\)\.getBoundingClientRect\(\)/);
});
