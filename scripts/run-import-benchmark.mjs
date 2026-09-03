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

const measuredProcesses = 7;
const expectedArtifacts = 10_000;
const expectedDailyActivityObservations = 5_999;
const expectedTrainingSessions = 4_000;
const expectedTimeSeriesSamples = 2_000_000;
const expectedObservations = 9_999;
const expectedQueryResults = 366;
const minimumExpandedBytes = 5 * 1_024 ** 3;
const firstImportBudgetMilliseconds = 10 * 60 * 1_000;
const exactRepeatBudgetMilliseconds = 30 * 1_000;
const queryBudgetMilliseconds = 500;
const peakMemoryExclusiveBudgetMiB = 1_536;
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

function requireFiniteNonNegative(value, name, errors) {
  if (!Number.isFinite(value) || value < 0) errors.push(`${name} is not a non-negative number`);
}

export function validateImportBenchmarkFixture(fixture) {
  const errors = [];
  if (fixture.entryCount !== expectedArtifacts) {
    errors.push(`expected ${expectedArtifacts} generated entries`);
  }
  if (fixture.dailyActivityObservations !== expectedDailyActivityObservations) {
    errors.push(`expected ${expectedDailyActivityObservations} daily activity observations`);
  }
  if (fixture.trainingSessions !== expectedTrainingSessions) {
    errors.push(`expected ${expectedTrainingSessions} training sessions`);
  }
  if (fixture.timeSeriesSamples !== expectedTimeSeriesSamples) {
    errors.push(`expected ${expectedTimeSeriesSamples} excluded time-series samples`);
  }
  if (!Number.isFinite(fixture.expandedBytes) || fixture.expandedBytes < minimumExpandedBytes) {
    errors.push(`expected at least ${minimumExpandedBytes} expanded bytes`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return true;
}

export function validateImportBenchmarkRun(run) {
  const errors = [];
  if (run.runtime !== "rust") errors.push("benchmark runtime is not rust");
  if (run.recognizedArtifacts !== expectedArtifacts) {
    errors.push(`expected ${expectedArtifacts} recognized artifacts`);
  }
  if (run.newObservations !== expectedObservations) {
    errors.push(`expected ${expectedObservations} new observations`);
  }
  if (run.activityQueryResultCount !== expectedQueryResults) {
    errors.push(`expected ${expectedQueryResults} activity query results`);
  }
  if (run.trainingQueryResultCount !== expectedQueryResults) {
    errors.push(`expected ${expectedQueryResults} training query results`);
  }
  if (run.repeatDetected !== true) errors.push("exact repeat was not detected");
  for (const name of [
    "firstImportMilliseconds",
    "exactRepeatMilliseconds",
    "queryMedianMilliseconds",
    "queryP95Milliseconds",
  ]) {
    requireFiniteNonNegative(run[name], name, errors);
  }
  if (!Number.isFinite(run.peakResidentMiB) || run.peakResidentMiB <= 0) {
    errors.push("peak resident memory is unavailable");
  }
  for (const phaseGroup of ["firstImportPhases", "exactRepeatPhases"]) {
    for (const phaseName of phaseNames) {
      requireFiniteNonNegative(run[phaseGroup]?.[phaseName], `${phaseGroup}.${phaseName}`, errors);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return true;
}

function phaseEvidence(runs, group) {
  return Object.fromEntries(
    phaseNames.map((name) => [
      name,
      rounded(percentile(runs.map((run) => run[group][name]), 0.95)),
    ]),
  );
}

export function evaluateImportBenchmarkRuns(runs) {
  if (runs.length !== measuredProcesses) {
    throw new Error(`import benchmark requires exactly ${measuredProcesses} measured processes`);
  }
  for (const run of runs) validateImportBenchmarkRun(run);

  const measurements = {
    firstImport: timedMeasurement(
      runs.map(({ firstImportMilliseconds }) => firstImportMilliseconds),
      firstImportBudgetMilliseconds,
    ),
    exactRepeat: timedMeasurement(
      runs.map(({ exactRepeatMilliseconds }) => exactRepeatMilliseconds),
      exactRepeatBudgetMilliseconds,
    ),
    query: timedMeasurement(
      runs.map(({ queryP95Milliseconds }) => queryP95Milliseconds),
      queryBudgetMilliseconds,
    ),
    peakResidentMemory: memoryMeasurement(
      runs.map(({ peakResidentMiB }) => peakResidentMiB),
    ),
  };
  return {
    measuredProcesses,
    measurements,
    phaseP95Milliseconds: {
      firstImport: phaseEvidence(runs, "firstImportPhases"),
      exactRepeat: phaseEvidence(runs, "exactRepeatPhases"),
    },
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

export const importBenchmarkExecutable = performanceBenchmarkExecutable("import_benchmark");

export function importBenchmarkBuildPlan(inheritedEnvironment = process.env) {
  return performanceBenchmarkBuildPlan("import_benchmark", inheritedEnvironment);
}

function executeImportBenchmark() {
  validatePerformanceBenchmarkHost();
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "fitfreed-import-benchmark-"));
  try {
    const archivePath = path.join(temporaryDirectory, "large.zip");
    const generator = parseJson(
      run(
        process.execPath,
        ["scripts/generate-large-fixture.mjs", archivePath, String(expectedArtifacts)],
        repositoryRoot,
      ),
      "large-fixture generator",
    );
    validateImportBenchmarkFixture(generator);
    const buildPlan = importBenchmarkBuildPlan();
    execFileSync(buildPlan.program, buildPlan.arguments_, buildPlan.options);
    const runs = Array.from({ length: measuredProcesses }, (_, index) =>
      parseJson(
        run(
          importBenchmarkExecutable,
          [archivePath, path.join(temporaryDirectory, `library-${index}.sqlite`)],
          repositoryRoot,
        ),
        "import benchmark process",
      ),
    );
    const evaluation = evaluateImportBenchmarkRuns(runs);
    const packageMetadata = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    );
    const evidence = {
      schemaVersion: 1,
      runtime: "release-production-importer",
      applicationVersion: packageMetadata.version,
      sourceRevision: run("git", ["rev-parse", "HEAD"], repositoryRoot),
      sourceTreeClean: run("git", ["status", "--porcelain=v1"], repositoryRoot) === "",
      host: hostEvidence(repositoryRoot),
      scenario: {
        generator: "independently-authored-deterministic",
        archiveEntries: generator.entryCount,
        dailyActivityObservations: generator.dailyActivityObservations,
        trainingSessions: generator.trainingSessions,
        excludedTimeSeriesSamples: generator.timeSeriesSamples,
        expandedBytes: generator.expandedBytes,
        archiveBytes: statSync(archivePath).size,
      },
      method: {
        measuredFreshProcesses: measuredProcesses,
        freshLibraryPerProcess: true,
        queryIterationsPerProcess: 50,
        queriesPerIteration: 2,
        queryDomains: ["daily-activity", "training-session-summary"],
        percentile: "sorted zero-based index ceil((n - 1) * 0.95)",
        scope: "release-mode production archive, mapping, reconciliation, SQLite, exact-repeat, and query adapters",
      },
      ...evaluation,
    };
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
    if (!evidence.passed) throw new Error("large import performance budget failed");
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    executeImportBenchmark();
  } catch (error) {
    process.stderr.write(`Import benchmark failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
