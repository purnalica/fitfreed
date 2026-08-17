import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { productionBuildIdentity } from "./build-production.mjs";
import {
  deriveColdLaunchRun,
  evaluateColdLaunchRuns,
  validateInteractiveShellSignal,
} from "./run-cold-launch-benchmark.mjs";

const revision = "a".repeat(40);

test("binds a production build to its exact revision and clean-tree state", () => {
  assert.deepEqual(productionBuildIdentity(revision, ""), {
    FITFREED_SOURCE_REVISION: revision,
    FITFREED_SOURCE_TREE_CLEAN: "true",
  });
  assert.deepEqual(productionBuildIdentity(revision, " M src/App.tsx\n"), {
    FITFREED_SOURCE_REVISION: revision,
    FITFREED_SOURCE_TREE_CLEAN: "false",
  });
  assert.throws(() => productionBuildIdentity("not-a-revision", ""), /invalid Git revision/);
});

test("accepts only the exact privacy-safe interactive-shell signal", () => {
  const signal = {
    format: "org.fitfreed.startup-signal",
    schemaVersion: 2,
    event: "interactive-shell",
    applicationVersion: "0.1.0",
    sourceRevision: revision,
    sourceTreeClean: true,
    hostStartupMilliseconds: {
      setupComplete: 200,
      signal: 600,
    },
    rendererStartupMilliseconds: {
      localeReady: 200,
      signal: 300,
    },
  };

  assert.equal(
    validateInteractiveShellSignal(signal, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    true,
  );
  assert.throws(
    () => validateInteractiveShellSignal({ ...signal, event: "host-started" }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /interactive-shell event/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({ ...signal, sourceTreeClean: false }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /clean source tree/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({ ...signal, sourceRevision: "b".repeat(40) }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /source revision/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({
      ...signal,
      hostStartupMilliseconds: { setupComplete: 601, signal: 600 },
    }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /host startup timings/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({
      ...signal,
      rendererStartupMilliseconds: { localeReady: 301, signal: 300 },
    }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /renderer startup timings/,
  );
  assert.deepEqual(deriveColdLaunchRun(700, signal), {
    totalMilliseconds: 700,
    processCreationAndEvidenceTransportMilliseconds: 100,
    hostStartupToSetupCompleteMilliseconds: 200,
    setupCompleteToRendererStartupAndCommandTransportMilliseconds: 100,
    rendererStartupToLocaleReadyMilliseconds: 200,
    localeReadyToInteractiveSignalMilliseconds: 100,
  });
});

test("enforces the cold-launch p95 budget across twenty fresh processes", () => {
  const evidence = evaluateColdLaunchRuns(
    Array.from({ length: 20 }, (_, index) => ({
      totalMilliseconds: 700 + index * 25,
      processCreationAndEvidenceTransportMilliseconds: 100,
      hostStartupToSetupCompleteMilliseconds: 200,
      setupCompleteToRendererStartupAndCommandTransportMilliseconds: 100 + index * 25,
      rendererStartupToLocaleReadyMilliseconds: 200,
      localeReadyToInteractiveSignalMilliseconds: 100,
    })),
  );

  assert.deepEqual(evidence, {
    measuredFreshProcesses: 20,
    medianMilliseconds: 950,
    p95Milliseconds: 1_175,
    maximumMilliseconds: 1_175,
    p95BudgetMilliseconds: 2_500,
    phases: {
      processCreationAndEvidenceTransport: {
        medianMilliseconds: 100,
        p95Milliseconds: 100,
        maximumMilliseconds: 100,
      },
      hostStartupToSetupComplete: {
        medianMilliseconds: 200,
        p95Milliseconds: 200,
        maximumMilliseconds: 200,
      },
      setupCompleteToRendererStartupAndCommandTransport: {
        medianMilliseconds: 350,
        p95Milliseconds: 575,
        maximumMilliseconds: 575,
      },
      rendererStartupToLocaleReady: {
        medianMilliseconds: 200,
        p95Milliseconds: 200,
        maximumMilliseconds: 200,
      },
      localeReadyToInteractiveSignal: {
        medianMilliseconds: 100,
        p95Milliseconds: 100,
        maximumMilliseconds: 100,
      },
    },
    passed: true,
  });
  assert.equal(
    evaluateColdLaunchRuns(Array.from({ length: 20 }, () => ({
      totalMilliseconds: 2_501,
      processCreationAndEvidenceTransportMilliseconds: 100,
      hostStartupToSetupCompleteMilliseconds: 200,
      setupCompleteToRendererStartupAndCommandTransportMilliseconds: 1_901,
      rendererStartupToLocaleReadyMilliseconds: 200,
      localeReadyToInteractiveSignalMilliseconds: 100,
    }))).passed,
    false,
  );
  assert.throws(
    () => evaluateColdLaunchRuns(Array.from({ length: 19 }, () => ({
      totalMilliseconds: 500,
    }))),
    /exactly 20 measured processes/,
  );
  assert.throws(
    () => evaluateColdLaunchRuns([
      ...Array.from({ length: 19 }, () => ({ totalMilliseconds: 500 })),
      { totalMilliseconds: -1 },
    ]),
    /non-negative finite duration/,
  );
});

test("wires production identity and cold launch into local and hosted gates", () => {
  const packageMetadata = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );

  assert.equal(
    packageMetadata.scripts.package,
    "npm run icons && node scripts/build-production.mjs",
  );
  assert.equal(
    packageMetadata.scripts["package:app"],
    "npm run icons && node scripts/build-production.mjs --bundles app",
  );
  assert.equal(
    packageMetadata.scripts["benchmark:cold-launch"],
    "node scripts/run-cold-launch-benchmark.mjs",
  );
  assert.match(
    packageMetadata.scripts["verify:full"],
    /package.*benchmark:cold-launch.*check:production-bundle/,
  );
  assert.match(
    workflow,
    /name: Verify cold-launch budget\n\s+run: npm run benchmark:cold-launch/,
  );
  assert.ok(
    workflow.indexOf("name: Verify cold-launch budget")
      < workflow.indexOf("name: Verify full-scale import budgets"),
    "cold launch must fail before the long performance campaigns",
  );
});
