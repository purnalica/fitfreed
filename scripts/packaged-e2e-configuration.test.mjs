import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { e2eBuildArguments, e2eBuildEnvironment } from "./build-e2e.mjs";
import { packagedE2eScenarioPlan } from "./packaged-e2e-plan.mjs";
import {
  e2eApplicationBinaryForPlatform,
  e2eTargetDirectory,
  updateE2eTargetDirectory,
} from "./e2e-paths.mjs";
import { config as defaultConfig } from "../wdio.conf.js";
import { config as performanceConfig } from "../wdio.performance.conf.js";
import {
  waitForElementCount,
  waitForNotice,
} from "../test/e2e/support/application-actions.js";
import { parseExactApplicationProcessIds } from "../test/e2e/support/application-process.js";

test("keeps the instrumented executable outside the production target", () => {
  const application = defaultConfig.capabilities[0]["tauri:options"].application;
  const serviceApplication = defaultConfig.services[0][1].appBinaryPath;

  assert.equal(application, path.resolve("src-tauri/target/e2e/release/fitfreed"));
  assert.equal(serviceApplication, application);
  assert.notEqual(application, path.resolve("src-tauri/target/release/fitfreed"));
});

test("resolves the instrumented executable for each desktop platform", () => {
  assert.equal(
    e2eApplicationBinaryForPlatform("darwin"),
    path.resolve("src-tauri/target/e2e/release/fitfreed"),
  );
  assert.equal(
    e2eApplicationBinaryForPlatform("linux"),
    path.resolve("src-tauri/target/e2e/release/fitfreed"),
  );
  assert.equal(
    e2eApplicationBinaryForPlatform("win32"),
    path.resolve("src-tauri/target/e2e/release/fitfreed.exe"),
  );
  assert.throws(
    () => e2eApplicationBinaryForPlatform("freebsd"),
    /unsupported E2E desktop platform/,
  );
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

test("builds only the instrumented application consumed by each packaged journey", () => {
  assert.deepEqual(e2eBuildArguments([], "darwin"), [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "app",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
  ]);
  assert.deepEqual(e2eBuildArguments(["--verbose"], "linux"), [
    "build",
    "--features",
    "e2e",
    "--no-bundle",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    "--verbose",
  ]);
  assert.deepEqual(e2eBuildArguments([], "win32"), [
    "build",
    "--features",
    "e2e",
    "--no-bundle",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
  ]);
  assert.deepEqual(e2eBuildArguments(["--verbose"], "darwin"), [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "app",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    "--verbose",
  ]);
  assert.throws(
    () => e2eBuildArguments([], "freebsd"),
    /unsupported E2E desktop platform/,
  );
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
  assert.equal(defaultConfig.mochaOpts.timeout, 600_000);
  assert.deepEqual(defaultConfig.specs, ["./test/e2e/**/*.spec.js"]);
});

test("reports bounded functional-journey phases without changing operation budgets", () => {
  const functionalJourney = readFileSync(
    path.resolve("test/e2e/import-journey.spec.js"),
    "utf8",
  );

  assert.match(functionalJourney, /recordJourneyPhase\("shell-and-first-run"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("english-training-discovery"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("english-session-workbench"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("english-session-evidence"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("english-report-composition"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("english-report-library-and-export"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("english-domain-cross-navigation"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("localized-maximum-zoom"\)/);
  assert.match(functionalJourney, /recordJourneyPhase\("complete"\)/);
  assert.equal(defaultConfig.waitforTimeout, 10_000);
  assert.equal(defaultConfig.connectionRetryTimeout, 90_000);
  assert.equal(defaultConfig.connectionRetryCount, 1);
});

test("reads transient status notices through one renderer snapshot", async () => {
  const expectedFragment = "The repeated import is ready";
  let executeCount = 0;
  const session = {
    async execute(query, fragment) {
      executeCount += 1;
      assert.equal(fragment, expectedFragment);
      const originalDocument = globalThis.document;
      globalThis.document = {
        querySelectorAll: () => [
          { textContent: "Unrelated status" },
          { textContent: expectedFragment },
        ],
      };
      try {
        return query(fragment);
      } finally {
        globalThis.document = originalDocument;
      }
    },
    async waitUntil(predicate, options) {
      assert.equal(await predicate(), true);
      assert.deepEqual(options, {
        timeout: 2_500,
        timeoutMsg: `status did not contain ${expectedFragment}`,
      });
    },
  };

  await waitForNotice(expectedFragment, 2_500, session);

  assert.equal(executeCount, 1);
});

test("waits for an asynchronously loaded collection before reading its elements", async () => {
  const observations = [[], [{ id: "first" }], [{ id: "first" }, { id: "second" }]];
  const session = {
    async $$(selector) {
      assert.equal(selector, ".planned-training-list > li");
      return observations.shift() ?? [];
    },
    async waitUntil(predicate, options) {
      assert.equal(await predicate(), false);
      assert.equal(await predicate(), false);
      assert.equal(await predicate(), true);
      assert.deepEqual(options, {
        timeout: 2_500,
        timeoutMsg: "the planned targets did not finish loading",
      });
    },
  };

  const elements = await waitForElementCount(
    ".planned-training-list > li",
    2,
    {
      session,
      timeout: 2_500,
      timeoutMsg: "the planned targets did not finish loading",
    },
  );

  assert.deepEqual(elements, [{ id: "first" }, { id: "second" }]);
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
    "sport-catalogue",
    "sport-catalogue-restart",
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
  assert.equal(plan[4].databasePath, plan[5].databasePath);
  assert.equal(plan[4].restartIdentityPath, plan[5].restartIdentityPath);
  assert.equal(plan[4].spec, "test/e2e/sport-catalogue-recognition.spec.js");
  assert.equal(
    plan[5].spec,
    "test/e2e/sport-catalogue-recognition-restart.e2e.js",
  );
  assert.notEqual(plan[6].databasePath, plan[0].databasePath);
  assert.notEqual(plan[6].databasePath, plan[2].databasePath);
  assert.notEqual(plan[6].databasePath, plan[4].databasePath);
  assert.equal(plan[6].restartIdentityPath, null);
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

test("observes exact signal rendering without background-throttled polling timers", () => {
  const performanceJourney = readFileSync(
    path.resolve("test/e2e/support/insights-performance.js"),
    "utf8",
  );
  const exactPageStart = performanceJourney.indexOf(
    "async function measureTrainingSignalExactPage",
  );
  const exactPageEnd = performanceJourney.indexOf(
    "async function measureTrainingRouteWorkbenchOpen",
    exactPageStart,
  );
  assert.ok(exactPageStart >= 0 && exactPageEnd > exactPageStart);
  const exactPage = performanceJourney.slice(exactPageStart, exactPageEnd);

  assert.match(exactPage, /new MutationObserver/);
  assert.match(exactPage, /new MessageChannel/);
  assert.doesNotMatch(exactPage, /setTimeout\(observeResult/);
  assert.match(exactPage, /getBoundingClientRect\(\)/);
});

test("observes independent signal reveal without background-throttled polling timers", () => {
  const performanceJourney = readFileSync(
    path.resolve("test/e2e/support/insights-performance.js"),
    "utf8",
  );
  const revealStart = performanceJourney.indexOf(
    "async function measureTrainingRouteIndependentSignalReveal",
  );
  const revealEnd = performanceJourney.indexOf(
    "async function expectDenseRouteExactEndpoint",
    revealStart,
  );
  assert.ok(revealStart >= 0 && revealEnd > revealStart);
  const reveal = performanceJourney.slice(revealStart, revealEnd);

  assert.match(reveal, /new MutationObserver/);
  assert.match(reveal, /new MessageChannel/);
  assert.doesNotMatch(reveal, /setTimeout\(observeResult/);
  assert.match(reveal, /getBoundingClientRect\(\)/);
});

test("drives sustained range input without animation-frame visibility", () => {
  const performanceJourney = readFileSync(
    path.resolve("test/e2e/support/insights-performance.js"),
    "utf8",
  );
  const chartDragStart = performanceJourney.indexOf(
    "async function dragChartZoomBoundary",
  );
  const chartDragEnd = performanceJourney.indexOf(
    "async function verifyTrainingChartPointerZoomRemainsResponsive",
    chartDragStart,
  );
  const routeDragStart = performanceJourney.indexOf(
    "async function verifyDenseTrainingRouteRangeDragRemainsResponsive",
  );
  const routeDragEnd = performanceJourney.indexOf(
    "async function applySleepRange",
    routeDragStart,
  );
  assert.ok(chartDragStart >= 0 && chartDragEnd > chartDragStart);
  assert.ok(routeDragStart >= 0 && routeDragEnd > routeDragStart);

  const chartInteraction = performanceJourney.slice(chartDragStart, chartDragEnd);
  const routeInteraction = performanceJourney.slice(routeDragStart, routeDragEnd);
  assert.match(chartInteraction, /new MessageChannel/);
  assert.match(chartInteraction, /viewportRoot\.dispatchEvent\(inputEvent/);
  assert.match(chartInteraction, /rendererContent\?\.parentElement/);
  assert.match(chartInteraction, /Object\.defineProperties\(inputEvent/);
  assert.match(chartInteraction, /offsetX/);
  assert.match(chartInteraction, /offsetY/);
  assert.match(chartInteraction, /dispatch\("mousemove", coordinates\.fromX, 0\)/);
  assert.match(chartInteraction, /inspectChartZoomGeometry/);
  assert.match(chartInteraction, /Math\.abs\(/);
  assert.doesNotMatch(chartInteraction, /chartRendererFingerprint/);
  assert.doesNotMatch(chartInteraction, /browser\.action\("pointer"/);
  assert.doesNotMatch(chartInteraction, /eventTarget\.dispatchEvent/);
  assert.doesNotMatch(chartInteraction, /requestAnimationFrame/);
  assert.match(routeInteraction, /new MessageChannel/);
  assert.doesNotMatch(routeInteraction, /requestAnimationFrame/);
});

test("locates analytical zoom handles from the active appearance palette", () => {
  const performanceJourney = readFileSync(
    path.resolve("test/e2e/support/insights-performance.js"),
    "utf8",
  );
  const geometryStart = performanceJourney.indexOf(
    "async function inspectChartZoomGeometry",
  );
  const geometryEnd = performanceJourney.indexOf(
    "async function dragChartZoomBoundary",
    geometryStart,
  );
  assert.ok(geometryStart >= 0 && geometryEnd > geometryStart);
  const geometryInspection = performanceJourney.slice(geometryStart, geometryEnd);

  assert.match(geometryInspection, /getPropertyValue\("--accent-deep"\)/);
  assert.match(geometryInspection, /resolvedAccentChannels/);
  assert.match(geometryInspection, /matchesAccent/);
  assert.doesNotMatch(geometryInspection, /green < 150/);
  assert.doesNotMatch(geometryInspection, /#1f583f/);
});

test("keeps dense session-detail closure scoped to its visible action", () => {
  const performanceJourney = readFileSync(
    path.resolve("test/e2e/support/insights-performance.js"),
    "utf8",
  );
  const closeStart = performanceJourney.indexOf("async function closeTrainingDetail");
  const closeEnd = performanceJourney.indexOf(
    "async function inspectChartZoomGeometry",
    closeStart,
  );
  assert.ok(closeStart >= 0 && closeEnd > closeStart);

  const closeInteraction = performanceJourney.slice(closeStart, closeEnd);
  assert.match(closeInteraction, /\.training-detail-actions button\.secondary/);
  assert.match(closeInteraction, /english\.training\.sessionLibrary\.closeDetail/);
  assert.match(closeInteraction, /getText\(\)/);
  assert.match(closeInteraction, /\.training-detail/);
  assert.doesNotMatch(
    performanceJourney,
    /aria\/\$\{english\.training\.sessionLibrary\.closeDetail\}/,
  );
});
