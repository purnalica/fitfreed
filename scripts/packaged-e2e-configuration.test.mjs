import assert from "node:assert/strict";
import test from "node:test";

import { config as defaultConfig } from "../wdio.conf.js";
import { config as performanceConfig } from "../wdio.performance.conf.js";

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
