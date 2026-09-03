import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statfsSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  performanceBenchmarkBuildPlan,
  performanceBenchmarkExecutable,
  repositoryRoot,
  validatePerformanceBenchmarkHost,
} from "./performance-benchmark-profile.mjs";

const measuredProcesses = 3;
const firstImportBudgetMilliseconds = 10 * 60 * 1_000;
const exactRepeatBudgetMilliseconds = 30 * 1_000;
const equivalentReimportBudgetMilliseconds = 5 * 60 * 1_000;
const queryBudgetMilliseconds = 500;
const peakMemoryExclusiveBudgetMiB = 1_536;
const databaseSizeBudgetBytes = 512 * 1_024 ** 2;

const scenario = Object.freeze({
  firstDate: "2016-01-01",
  sessionIntervalDays: 7,
  sessions: 520,
  seriesPerSession: 4,
  samplesPerSeries: 3_601,
  persistedSeries: 2_080,
  persistedSamples: 7_490_080,
  archiveEntries: 521,
});

export function denseHistoryScenario() {
  return { ...scenario };
}

function percentile(values, requested) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((sorted.length - 1) * requested)];
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

function timedMeasurement(values, budget) {
  const p95 = percentile(values, 0.95);
  return {
    medianMilliseconds: rounded(percentile(values, 0.5)),
    p95Milliseconds: rounded(p95),
    maximumMilliseconds: rounded(Math.max(...values)),
    p95BudgetMilliseconds: budget,
    passed: p95 <= budget,
  };
}

function memoryMeasurement(values) {
  const p95 = percentile(values, 0.95);
  return {
    medianMiB: rounded(percentile(values, 0.5)),
    p95MiB: rounded(p95),
    maximumMiB: rounded(Math.max(...values)),
    p95ExclusiveBudgetMiB: peakMemoryExclusiveBudgetMiB,
    passed: p95 < peakMemoryExclusiveBudgetMiB,
  };
}

function storageMeasurement(values) {
  const p95 = percentile(values, 0.95);
  return {
    medianBytes: percentile(values, 0.5),
    p95Bytes: p95,
    maximumBytes: Math.max(...values),
    p95BudgetBytes: databaseSizeBudgetBytes,
    passed: p95 <= databaseSizeBudgetBytes,
  };
}

function requireFiniteNonNegative(value, name, errors) {
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${name} is not a non-negative number`);
  }
}

export function validateDenseHistoryBenchmarkFixture(fixture) {
  const errors = [];
  if (fixture.firstDate !== scenario.firstDate) {
    errors.push(`expected first date ${scenario.firstDate}`);
  }
  if (fixture.sessionIntervalDays !== scenario.sessionIntervalDays) {
    errors.push(`expected ${scenario.sessionIntervalDays}-day session intervals`);
  }
  if (fixture.sessions !== scenario.sessions) {
    errors.push(`expected ${scenario.sessions} generated training sessions`);
  }
  if (fixture.seriesPerSession !== scenario.seriesPerSession) {
    errors.push(`expected ${scenario.seriesPerSession} supported series per session`);
  }
  if (fixture.samplesPerSeries !== scenario.samplesPerSeries) {
    errors.push(`expected ${scenario.samplesPerSeries} samples per series`);
  }
  if (fixture.persistedSeries !== scenario.persistedSeries) {
    errors.push(`expected ${scenario.persistedSeries} supported signal series`);
  }
  if (fixture.persistedSamples !== scenario.persistedSamples) {
    errors.push(`expected ${scenario.persistedSamples} supported signal samples`);
  }
  if (fixture.archiveEntries !== scenario.archiveEntries) {
    errors.push(`expected ${scenario.archiveEntries} archive entries`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return true;
}

export function validateDenseHistoryBenchmarkRun(run) {
  const errors = [];
  if (run.runtime !== "rust") errors.push("benchmark runtime is not rust");
  if (run.recognizedArtifacts !== scenario.archiveEntries) {
    errors.push(`expected ${scenario.archiveEntries} recognized artifacts`);
  }
  if (run.newObservations !== scenario.sessions) {
    errors.push(`expected ${scenario.sessions} new observations`);
  }
  if (run.repeatDetected !== true) errors.push("exact repeat was not detected");
  if (run.equivalentReimportExactRepeat !== false) {
    errors.push("equivalent changed package used the exact-repeat path");
  }
  if (run.equivalentReimportEquivalentObservations !== scenario.sessions) {
    errors.push(`expected ${scenario.sessions} equivalent observations`);
  }
  if (run.equivalentReimportNewObservations !== 0) {
    errors.push("expected no new observation from the equivalent changed package");
  }
  if (!Number.isInteger(run.concurrentQueryRounds) || run.concurrentQueryRounds < 1) {
    errors.push("expected concurrent navigation measurements");
  }
  if (run.persistedSessions !== scenario.sessions) {
    errors.push(`expected ${scenario.sessions} persisted sessions`);
  }
  if (run.persistedSeries !== scenario.persistedSeries) {
    errors.push(`expected ${scenario.persistedSeries} persisted signal series`);
  }
  if (run.persistedSamples !== scenario.persistedSamples) {
    errors.push(`expected ${scenario.persistedSamples} persisted signal samples`);
  }
  if (run.libraryHomeRecentSessions !== 4) {
    errors.push("expected four bounded recent Home sessions");
  }
  if (run.sessionPageSessions !== 25) {
    errors.push("expected 25 sessions in the discovery page");
  }
  if (run.overviewSeries !== scenario.seriesPerSession) {
    errors.push("expected four overview series");
  }
  const maximumVisualSamples = scenario.seriesPerSession * 300;
  if (run.overviewVisualSamples > maximumVisualSamples) {
    errors.push(`overview exceeded ${maximumVisualSamples} bounded visual samples`);
  }
  if (run.exactPageSamples !== 250) errors.push("expected 250 exact page samples");
  for (const name of [
    "firstImportMilliseconds",
    "exactRepeatMilliseconds",
    "equivalentReimportMilliseconds",
    "concurrentLibraryHomeP95Milliseconds",
    "concurrentSessionPageP95Milliseconds",
    "libraryHomeP95Milliseconds",
    "sessionPageP95Milliseconds",
    "signalOverviewP95Milliseconds",
    "signalExactPageP95Milliseconds",
    "peakResidentMiB",
    "databaseBytes",
  ]) {
    requireFiniteNonNegative(run[name], name, errors);
  }
  if (run.peakResidentMiB === 0) errors.push("peak resident memory is unavailable");
  if (run.databaseBytes === 0) errors.push("database size is unavailable");
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return true;
}

export function evaluateDenseHistoryBenchmarkRuns(runs) {
  if (runs.length !== measuredProcesses) {
    throw new Error(
      `dense-history benchmark requires exactly ${measuredProcesses} measured processes`,
    );
  }
  for (const run of runs) validateDenseHistoryBenchmarkRun(run);

  const measurements = {
    firstImport: timedMeasurement(
      runs.map(({ firstImportMilliseconds }) => firstImportMilliseconds),
      firstImportBudgetMilliseconds,
    ),
    exactRepeat: timedMeasurement(
      runs.map(({ exactRepeatMilliseconds }) => exactRepeatMilliseconds),
      exactRepeatBudgetMilliseconds,
    ),
    equivalentReimport: timedMeasurement(
      runs.map(({ equivalentReimportMilliseconds }) => equivalentReimportMilliseconds),
      equivalentReimportBudgetMilliseconds,
    ),
    concurrentLibraryHome: timedMeasurement(
      runs.map(({ concurrentLibraryHomeP95Milliseconds }) => concurrentLibraryHomeP95Milliseconds),
      queryBudgetMilliseconds,
    ),
    concurrentSessionPage: timedMeasurement(
      runs.map(({ concurrentSessionPageP95Milliseconds }) => concurrentSessionPageP95Milliseconds),
      queryBudgetMilliseconds,
    ),
    libraryHome: timedMeasurement(
      runs.map(({ libraryHomeP95Milliseconds }) => libraryHomeP95Milliseconds),
      queryBudgetMilliseconds,
    ),
    sessionPage: timedMeasurement(
      runs.map(({ sessionPageP95Milliseconds }) => sessionPageP95Milliseconds),
      queryBudgetMilliseconds,
    ),
    signalOverview: timedMeasurement(
      runs.map(({ signalOverviewP95Milliseconds }) => signalOverviewP95Milliseconds),
      queryBudgetMilliseconds,
    ),
    signalExactPage: timedMeasurement(
      runs.map(({ signalExactPageP95Milliseconds }) => signalExactPageP95Milliseconds),
      queryBudgetMilliseconds,
    ),
    peakResidentMemory: memoryMeasurement(
      runs.map(({ peakResidentMiB }) => peakResidentMiB),
    ),
    databaseSize: storageMeasurement(runs.map(({ databaseBytes }) => databaseBytes)),
  };
  return {
    measuredProcesses,
    measurements,
    passed: Object.values(measurements).every(({ passed }) => passed),
  };
}

function run(program, arguments_, repositoryRoot) {
  return execFileSync(program, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commandValue(program, arguments_, repositoryRoot) {
  try {
    return run(program, arguments_, repositoryRoot);
  } catch {
    return null;
  }
}

function hostEvidence(repositoryRoot) {
  const storage = statfsSync(repositoryRoot);
  return {
    operatingSystem: os.platform(),
    operatingSystemVersion:
      commandValue("sw_vers", ["-productVersion"], repositoryRoot) ?? os.release(),
    architecture: os.arch(),
    deviceModel: commandValue("sysctl", ["-n", "hw.model"], repositoryRoot),
    processor: os.cpus()[0]?.model ?? null,
    totalMemoryBytes: os.totalmem(),
    freeStorageBytes: Number(storage.bavail) * Number(storage.bsize),
  };
}

function parseJson(output, description) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${description} did not emit one JSON object`);
  }
}

export const denseHistoryBenchmarkExecutable = performanceBenchmarkExecutable(
  "dense_history_benchmark",
);

export function denseHistoryBenchmarkBuildPlan(inheritedEnvironment = process.env) {
  return performanceBenchmarkBuildPlan("dense_history_benchmark", inheritedEnvironment);
}

function executeDenseHistoryBenchmark() {
  validatePerformanceBenchmarkHost();
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "fitfreed-dense-history-"));
  try {
    const archivePath = path.join(temporaryDirectory, "dense-history.zip");
    const equivalentArchivePath = path.join(
      temporaryDirectory,
      "dense-history-equivalent-container.zip",
    );
    const fixture = parseJson(
      run(
        process.execPath,
        ["scripts/generate-dense-history-fixture.mjs", archivePath],
        repositoryRoot,
      ),
      "dense-history fixture generator",
    );
    validateDenseHistoryBenchmarkFixture(fixture);
    const equivalentFixture = parseJson(
      run(
        process.execPath,
        [
          "scripts/generate-dense-history-fixture.mjs",
          equivalentArchivePath,
          "--equivalent-container-variant",
        ],
        repositoryRoot,
      ),
      "dense-history equivalent fixture generator",
    );
    validateDenseHistoryBenchmarkFixture(equivalentFixture);
    const buildPlan = denseHistoryBenchmarkBuildPlan();
    execFileSync(buildPlan.program, buildPlan.arguments_, buildPlan.options);
    const runs = [];
    for (let index = 0; index < measuredProcesses; index += 1) {
      const databasePath = path.join(temporaryDirectory, `library-${index}.sqlite`);
      runs.push(parseJson(
        run(
          denseHistoryBenchmarkExecutable,
          [archivePath, equivalentArchivePath, databasePath],
          repositoryRoot,
        ),
        "dense-history benchmark process",
      ));
      for (const suffix of ["", "-wal", "-shm"]) {
        rmSync(`${databasePath}${suffix}`, { force: true });
      }
    }
    const evaluation = evaluateDenseHistoryBenchmarkRuns(runs);
    const packageMetadata = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    );
    const evidence = {
      schemaVersion: 1,
      runtime: "release-production-dense-training-history",
      applicationVersion: packageMetadata.version,
      sourceRevision: run("git", ["rev-parse", "HEAD"], repositoryRoot),
      sourceTreeClean: run("git", ["status", "--porcelain=v1"], repositoryRoot) === "",
      host: hostEvidence(repositoryRoot),
      scenario: {
        generator: "independently-authored-deterministic",
        ...denseHistoryScenario(),
        archiveBytes: statSync(archivePath).size,
      },
      method: {
        measuredFreshProcesses: measuredProcesses,
        freshLibraryPerProcess: true,
        warmUpQueriesPerProcess: 5,
        measuredQueriesPerProcess: 20,
        lateReconciliationQueryRoundsPerProcess: 20,
        percentile: "sorted zero-based index ceil((n - 1) * 0.95)",
        scope: "release-mode production archive, mapping, reconciliation, SQLite storage, exact repeat, equivalent changed-package reconciliation, concurrent Library Home and History navigation, coherent Library Home composition, session discovery, signal overview, and exact pagination",
      },
      ...evaluation,
    };
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
    if (!evidence.passed) throw new Error("dense-history performance budget failed");
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    executeDenseHistoryBenchmark();
  } catch (error) {
    process.stderr.write(`Dense-history benchmark failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
