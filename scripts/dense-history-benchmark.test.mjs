import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  denseHistoryBenchmarkBuildPlan,
  denseHistoryBenchmarkExecutable,
  denseHistoryScenario,
  evaluateDenseHistoryBenchmarkRuns,
  validateDenseHistoryBenchmarkFixture,
  validateDenseHistoryBenchmarkRun,
} from "./run-dense-history-benchmark.mjs";
import {
  performanceBenchmarkTargetDirectory,
  repositoryRoot,
} from "./performance-benchmark-profile.mjs";

function validRun(overrides = {}) {
  return {
    runtime: "rust",
    firstImportMilliseconds: 120_000,
    exactRepeatMilliseconds: 2_000,
    equivalentReimportMilliseconds: 45_000,
    equivalentReimportExactRepeat: false,
    equivalentReimportEquivalentObservations: 520,
    equivalentReimportNewObservations: 0,
    concurrentQueryRounds: 20,
    concurrentLibraryHomeP95Milliseconds: 45,
    concurrentSessionPageP95Milliseconds: 50,
    libraryHomeP95Milliseconds: 30,
    sessionPageP95Milliseconds: 35,
    signalOverviewP95Milliseconds: 40,
    signalExactPageP95Milliseconds: 12,
    peakResidentMiB: 256,
    databaseBytes: 384 * 1_024 ** 2,
    recognizedArtifacts: 521,
    newObservations: 520,
    repeatDetected: true,
    persistedSessions: 520,
    persistedSeries: 2_080,
    persistedSamples: 7_490_080,
    libraryHomeRecentSessions: 4,
    sessionPageSessions: 25,
    overviewSeries: 4,
    overviewVisualSamples: 1_200,
    exactPageSamples: 250,
    ...overrides,
  };
}

test("isolates the dense-history benchmark in the shared performance Cargo profile", () => {
  const plan = denseHistoryBenchmarkBuildPlan({ RETAINED: "value" });

  assert.equal(
    performanceBenchmarkTargetDirectory,
    path.join(repositoryRoot, "src-tauri/target/performance-benchmarks"),
  );
  assert.equal(plan.program, "cargo");
  assert.deepEqual(plan.arguments_, [
    "build",
    "--quiet",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--example",
    "dense_history_benchmark",
  ]);
  assert.equal(plan.options.cwd, repositoryRoot);
  assert.equal(
    plan.options.env.CARGO_TARGET_DIR,
    performanceBenchmarkTargetDirectory,
  );
  assert.equal(plan.options.env.RETAINED, "value");
  assert.equal(
    denseHistoryBenchmarkExecutable,
    path.join(performanceBenchmarkTargetDirectory, "release/examples/dense_history_benchmark"),
  );
});

test("defines a long distributed supported-signal history independently of a private export", () => {
  assert.deepEqual(denseHistoryScenario(), {
    firstDate: "2016-01-01",
    sessionIntervalDays: 7,
    sessions: 520,
    seriesPerSession: 4,
    samplesPerSeries: 3_601,
    persistedSeries: 2_080,
    persistedSamples: 7_490_080,
    archiveEntries: 521,
  });
});

test("requires the complete dense-history fixture envelope", () => {
  const fixture = denseHistoryScenario();

  assert.equal(validateDenseHistoryBenchmarkFixture(fixture), true);
  assert.throws(
    () => validateDenseHistoryBenchmarkFixture({ ...fixture, sessions: 519 }),
    /expected 520 generated training sessions/,
  );
  assert.throws(
    () => validateDenseHistoryBenchmarkFixture({ ...fixture, persistedSeries: 2_079 }),
    /expected 2080 supported signal series/,
  );
  assert.throws(
    () => validateDenseHistoryBenchmarkFixture({ ...fixture, persistedSamples: 7_490_079 }),
    /expected 7490080 supported signal samples/,
  );
});

test("validates changed-package reconciliation, concurrent navigation, and retained query evidence", () => {
  assert.equal(validateDenseHistoryBenchmarkRun(validRun()), true);

  for (const [override, message] of [
    [{ repeatDetected: false }, /exact repeat was not detected/],
    [{ equivalentReimportExactRepeat: true }, /equivalent changed package used the exact-repeat path/],
    [{ equivalentReimportEquivalentObservations: 519 }, /expected 520 equivalent observations/],
    [{ equivalentReimportNewObservations: 1 }, /expected no new observation/],
    [{ concurrentQueryRounds: 0 }, /expected concurrent navigation measurements/],
    [{ persistedSessions: 519 }, /expected 520 persisted sessions/],
    [{ persistedSeries: 2_079 }, /expected 2080 persisted signal series/],
    [{ persistedSamples: 7_490_079 }, /expected 7490080 persisted signal samples/],
    [{ libraryHomeRecentSessions: 3 }, /expected four bounded recent Home sessions/],
    [{ sessionPageSessions: 24 }, /expected 25 sessions in the discovery page/],
    [{ overviewSeries: 3 }, /expected four overview series/],
    [{ overviewVisualSamples: 1_201 }, /overview exceeded 1200 bounded visual samples/],
    [{ exactPageSamples: 249 }, /expected 250 exact page samples/],
  ]) {
    assert.throws(() => validateDenseHistoryBenchmarkRun(validRun(override)), message);
  }
});

test("uses the slowest of three fresh processes and enforces every accepted budget", () => {
  const runs = Array.from({ length: 3 }, (_, index) => validRun({
    firstImportMilliseconds: 100_000 + index * 10_000,
    exactRepeatMilliseconds: 1_000 + index * 100,
    equivalentReimportMilliseconds: 40_000 + index * 1_000,
    concurrentLibraryHomeP95Milliseconds: 40 + index,
    concurrentSessionPageP95Milliseconds: 45 + index,
    libraryHomeP95Milliseconds: 15 + index,
    sessionPageP95Milliseconds: 20 + index,
    signalOverviewP95Milliseconds: 30 + index,
    signalExactPageP95Milliseconds: 10 + index,
    peakResidentMiB: 200 + index,
    databaseBytes: (300 + index) * 1_024 ** 2,
  }));

  const evidence = evaluateDenseHistoryBenchmarkRuns(runs);

  assert.equal(evidence.measuredProcesses, 3);
  assert.equal(evidence.measurements.firstImport.p95Milliseconds, 120_000);
  assert.equal(evidence.measurements.firstImport.passed, true);
  assert.equal(evidence.measurements.exactRepeat.passed, true);
  assert.equal(evidence.measurements.equivalentReimport.passed, true);
  assert.equal(evidence.measurements.concurrentLibraryHome.passed, true);
  assert.equal(evidence.measurements.concurrentSessionPage.passed, true);
  assert.equal(evidence.measurements.libraryHome.passed, true);
  assert.equal(evidence.measurements.sessionPage.passed, true);
  assert.equal(evidence.measurements.signalOverview.passed, true);
  assert.equal(evidence.measurements.signalExactPage.passed, true);
  assert.equal(evidence.measurements.peakResidentMemory.passed, true);
  assert.equal(evidence.measurements.databaseSize.passed, true);
  assert.equal(evidence.passed, true);
});

test("fails closed for an incomplete campaign or any exceeded dense-history budget", () => {
  assert.throws(
    () => evaluateDenseHistoryBenchmarkRuns([validRun(), validRun()]),
    /requires exactly 3 measured processes/,
  );

  for (const override of [
    { firstImportMilliseconds: 600_001 },
    { exactRepeatMilliseconds: 30_001 },
    { equivalentReimportMilliseconds: 300_001 },
    { concurrentLibraryHomeP95Milliseconds: 501 },
    { concurrentSessionPageP95Milliseconds: 501 },
    { libraryHomeP95Milliseconds: 501 },
    { sessionPageP95Milliseconds: 501 },
    { signalOverviewP95Milliseconds: 501 },
    { signalExactPageP95Milliseconds: 501 },
    { peakResidentMiB: 1_536 },
    { databaseBytes: 512 * 1_024 ** 2 + 1 },
  ]) {
    const evidence = evaluateDenseHistoryBenchmarkRuns(
      Array.from({ length: 3 }, () => validRun(override)),
    );
    assert.equal(evidence.passed, false, JSON.stringify(override));
  }
});

test("wires the dense-history gate into local and hosted complete verification", () => {
  const packageMetadata = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );

  assert.equal(
    packageMetadata.scripts["benchmark:dense-history"],
    "node scripts/run-dense-history-benchmark.mjs",
  );
  assert.match(
    packageMetadata.scripts["verify:precommit"],
    /benchmark:import.*benchmark:dense-history.*benchmark:insights/,
  );
  assert.match(packageMetadata.scripts["verify:full"], /^npm run verify:precommit/);
  assert.match(
    workflow,
    /name: Verify dense training-history budgets\n\s+run: npm run benchmark:dense-history/,
  );
});
