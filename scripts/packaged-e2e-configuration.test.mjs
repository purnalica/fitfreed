import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { e2eBuildEnvironment } from "./build-e2e.mjs";
import {
  e2eTargetDirectory,
  updateE2eTargetDirectory,
} from "./e2e-paths.mjs";
import { config as defaultConfig } from "../wdio.conf.js";
import { config as performanceConfig } from "../wdio.performance.conf.js";

test("keeps the instrumented executable outside the production target", () => {
  const application = defaultConfig.capabilities[0]["tauri:options"].application;
  const serviceApplication = defaultConfig.services[0][1].appBinaryPath;

  assert.equal(application, path.resolve("src-tauri/target/e2e/release/fitfreed"));
  assert.equal(serviceApplication, application);
  assert.notEqual(application, path.resolve("src-tauri/target/release/fitfreed"));
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

test("keeps ordinary packaged journeys on the strict campaign timeout", () => {
  assert.equal(defaultConfig.mochaOpts.timeout, 120_000);
  assert.deepEqual(defaultConfig.specs, ["./test/e2e/**/*.spec.js"]);
});

test("isolates the longer performance campaign without relaxing interaction budgets", () => {
  assert.equal(performanceConfig.mochaOpts.timeout, 420_000);
  assert.deepEqual(performanceConfig.specs, ["./test/e2e/insights-performance.spec.js"]);
  assert.equal(performanceConfig.waitforTimeout, defaultConfig.waitforTimeout);
  assert.equal(
    performanceConfig.connectionRetryTimeout,
    defaultConfig.connectionRetryTimeout,
  );
});
