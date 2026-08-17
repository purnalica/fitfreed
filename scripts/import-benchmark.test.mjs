import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateImportBenchmarkRuns,
  validateImportBenchmarkFixture,
  validateImportBenchmarkRun,
} from "./run-import-benchmark.mjs";

const phaseNames = [
  "fingerprintMilliseconds",
  "databaseSetupMilliseconds",
  "repeatLookupMilliseconds",
  "archiveValidationMilliseconds",
  "readDecodeMapMilliseconds",
  "reconciliationMilliseconds",
  "transactionControlMilliseconds",
  "totalMilliseconds",
];

function validRun(overrides = {}) {
  const phases = Object.fromEntries(phaseNames.map((name) => [name, 1]));
  return {
    runtime: "rust",
    firstImportMilliseconds: 1_200,
    exactRepeatMilliseconds: 45,
    queryMedianMilliseconds: 0.5,
    queryP95Milliseconds: 0.8,
    activityQueryResultCount: 366,
    trainingQueryResultCount: 366,
    recognizedArtifacts: 10_000,
    newObservations: 9_999,
    repeatDetected: true,
    firstImportPhases: phases,
    exactRepeatPhases: phases,
    peakResidentMiB: 24,
    ...overrides,
  };
}

test("requires the complete five-GiB, ten-thousand-entry fixture envelope", () => {
  const fixture = {
    entryCount: 10_000,
    dailyActivityObservations: 5_999,
    trainingSessions: 4_000,
    timeSeriesSamples: 2_000_000,
    expandedBytes: 5 * 1_024 ** 3,
  };
  assert.equal(validateImportBenchmarkFixture(fixture), true);
  assert.throws(
    () => validateImportBenchmarkFixture({ ...fixture, entryCount: 9_999 }),
    /expected 10000 generated entries/,
  );
  assert.throws(
    () =>
      validateImportBenchmarkFixture({
        ...fixture,
        expandedBytes: 5 * 1_024 ** 3 - 1,
      }),
    /at least 5368709120 expanded bytes/,
  );
  assert.throws(
    () => validateImportBenchmarkFixture({ ...fixture, dailyActivityObservations: 5_998 }),
    /expected 5999 daily activity observations/,
  );
  assert.throws(
    () => validateImportBenchmarkFixture({ ...fixture, trainingSessions: 3_999 }),
    /expected 4000 training sessions/,
  );
  assert.throws(
    () => validateImportBenchmarkFixture({ ...fixture, timeSeriesSamples: 1_999_999 }),
    /expected 2000000 excluded time-series samples/,
  );
});

test("validates each fresh-process result against the exact synthetic scenario", () => {
  assert.equal(validateImportBenchmarkRun(validRun()), true);
  assert.throws(
    () => validateImportBenchmarkRun(validRun({ recognizedArtifacts: 9_999 })),
    /expected 10000 recognized artifacts/,
  );
  assert.throws(
    () => validateImportBenchmarkRun(validRun({ repeatDetected: false })),
    /exact repeat was not detected/,
  );
  assert.throws(
    () => validateImportBenchmarkRun(validRun({ newObservations: 9_998 })),
    /expected 9999 new observations/,
  );
  assert.throws(
    () => validateImportBenchmarkRun(validRun({ activityQueryResultCount: 365 })),
    /expected 366 activity query results/,
  );
  assert.throws(
    () => validateImportBenchmarkRun(validRun({ trainingQueryResultCount: 365 })),
    /expected 366 training query results/,
  );
  assert.throws(
    () => validateImportBenchmarkRun(validRun({ peakResidentMiB: 0 })),
    /peak resident memory is unavailable/,
  );
});

test("aggregates seven measured processes and passes every import budget", () => {
  const runs = Array.from({ length: 7 }, (_, index) => validRun({
    firstImportMilliseconds: 1_000 + index * 100,
    exactRepeatMilliseconds: 40 + index,
    queryP95Milliseconds: 0.7 + index / 100,
    peakResidentMiB: 20 + index,
  }));

  const evidence = evaluateImportBenchmarkRuns(runs);

  assert.equal(evidence.measuredProcesses, 7);
  assert.deepEqual(evidence.measurements.firstImport, {
    medianMilliseconds: 1_300,
    p95Milliseconds: 1_600,
    maximumMilliseconds: 1_600,
    p95BudgetMilliseconds: 600_000,
    passed: true,
  });
  assert.equal(evidence.measurements.exactRepeat.passed, true);
  assert.equal(evidence.measurements.query.passed, true);
  assert.equal(evidence.measurements.peakResidentMemory.passed, true);
  assert.equal(evidence.passed, true);
  assert.equal(evidence.phaseP95Milliseconds.firstImport.totalMilliseconds, 1);
});

test("fails closed when time, query, or strict memory budgets are exceeded", () => {
  for (const override of [
    { firstImportMilliseconds: 600_001 },
    { exactRepeatMilliseconds: 30_001 },
    { queryP95Milliseconds: 501 },
    { peakResidentMiB: 1_536 },
  ]) {
    const evidence = evaluateImportBenchmarkRuns(
      Array.from({ length: 7 }, () => validRun(override)),
    );
    assert.equal(evidence.passed, false, JSON.stringify(override));
  }
});

test("rejects an incomplete campaign instead of weakening percentile evidence", () => {
  assert.throws(
    () => evaluateImportBenchmarkRuns(Array.from({ length: 6 }, () => validRun())),
    /requires exactly 7 measured processes/,
  );
});

test("wires the same full-scale import gate into local and hosted verification", () => {
  const packageMetadata = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );

  assert.equal(
    packageMetadata.scripts["benchmark:import"],
    "node scripts/run-import-benchmark.mjs",
  );
  assert.match(
    packageMetadata.scripts["verify:full"],
    /benchmark:import.*benchmark:insights/,
  );
  assert.match(
    workflow,
    /name: Verify full-scale import budgets\n\s+run: npm run benchmark:import/,
  );
});
