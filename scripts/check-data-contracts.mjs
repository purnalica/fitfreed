import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function requireMention(content, value, documentPath) {
  if (!content.includes(`\`${value}\``)) {
    throw new Error(`${documentPath} does not document ${value}`);
  }
}

const infrastructurePath = "src-tauri/src/infrastructure.rs";
const infrastructure = read(infrastructurePath);
const schemaVersionMatch = infrastructure.match(/const SCHEMA_VERSION: i64 = (\d+);/);
if (!schemaVersionMatch) throw new Error(`${infrastructurePath} has no SCHEMA_VERSION`);
const schemaVersion = Number(schemaVersionMatch[1]);
const sourceAdapterVersionMatch = infrastructure.match(
  /const SOURCE_ADAPTER_VERSION: &str = "([^"]+)";/,
);
if (!sourceAdapterVersionMatch) {
  throw new Error(`${infrastructurePath} has no SOURCE_ADAPTER_VERSION`);
}
const sourceAdapterVersion = sourceAdapterVersionMatch[1];

const migrationDirectory = path.join(repositoryRoot, "src-tauri", "migrations");
const migrations = readdirSync(migrationDirectory)
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
const migrationVersions = migrations.map((name) => Number(name.slice(0, 4)));
const expectedVersions = Array.from({ length: schemaVersion }, (_, index) => index + 1);
if (JSON.stringify(migrationVersions) !== JSON.stringify(expectedVersions)) {
  throw new Error(
    `Migration versions must be contiguous through ${schemaVersion}; found ${migrationVersions.join(", ")}`,
  );
}

for (const migration of migrations) {
  const version = Number(migration.slice(0, 4));
  const persistencePath = `docs/data-formats/persistence/sqlite-v${version}.md`;
  const persistence = read(persistencePath);
  if (!persistence.includes(migration)) {
    throw new Error(`${persistencePath} does not reference ${migration}`);
  }
  const sql = read(path.join("src-tauri", "migrations", migration));
  for (const tableMatch of sql.matchAll(/CREATE TABLE ([a-z_]+) \(([\s\S]*?)\n\);/g)) {
    const [, table, body] = tableMatch;
    requireMention(persistence, table, persistencePath);
    for (const line of body.split("\n")) {
      const columnMatch = line.match(/^ {4}([a-z_][a-z0-9_]*) (?:BLOB|INTEGER|REAL|TEXT)\b/);
      if (columnMatch) requireMention(persistence, columnMatch[1], persistencePath);
    }
  }
}

const persistencePaths = expectedVersions.map(
  (version) => `docs/data-formats/persistence/sqlite-v${version}.md`,
);
const persistenceCorpus = persistencePaths.map(read).join("\n");
for (const contractValue of [
  "polar-flow",
  "polar-flow-archive@1",
  "polar-flow-archive@2",
  "polar-flow-archive@3",
  "polar-flow-archive@4",
  "polar-flow-archive@5",
  "polar-flow-archive@6",
  "polar-flow-mapping-set@1",
  "polar-flow-daily-activity@1",
  "polar-flow-training-session@1",
  "polar-flow-sleep@1",
  "polar-flow-nightly-recovery@1",
  "polar-nightly-recharge@1",
  "assessing",
  "planned",
  "staging",
  "reconciling",
  "committing",
  "recovering",
  "completed",
  "rejected",
  "cancelled",
  "failed",
  "supported",
  "unsupported",
  "deliberately-ignored",
  "unrecognized",
  "invalid",
  "amend",
  "en-US",
  "es-ES",
]) {
  requireMention(persistenceCorpus, contractValue, "SQLite persistence specifications");
}

const domainPath = "src-tauri/crates/fitfreed-domain/src/lib.rs";
const domain = read(domainPath);
const dailyActivityMatch = domain.match(/pub struct DailyActivity \{([\s\S]*?)\n\}/);
if (!dailyActivityMatch) throw new Error(`${domainPath} has no DailyActivity`);
const canonicalPath = "docs/data-formats/canonical/daily-activity.md";
const canonical = read(canonicalPath);
for (const fieldMatch of dailyActivityMatch[1].matchAll(/pub ([a-z_]+):/g)) {
  const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  requireMention(canonical, camelCase, canonicalPath);
}

const trainingSessionMatch = domain.match(/pub struct TrainingSession \{([\s\S]*?)\n\}/);
if (!trainingSessionMatch) throw new Error(`${domainPath} has no TrainingSession`);
const trainingCanonicalPath = "docs/data-formats/canonical/training-session.md";
const trainingCanonical = read(trainingCanonicalPath);
for (const fieldMatch of trainingSessionMatch[1].matchAll(/pub ([a-z_]+):/g)) {
  const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  requireMention(trainingCanonical, camelCase, trainingCanonicalPath);
}

const sleepCanonicalPath = "docs/data-formats/canonical/sleep-period.md";
const sleepCanonical = read(sleepCanonicalPath);
for (const structure of [
  "SleepPeriod",
  "SleepPhaseSummary",
  "SleepStageTransition",
  "SleepScore",
]) {
  const structureMatch = domain.match(new RegExp(`pub struct ${structure} \\{([\\s\\S]*?)\\n\\}`));
  if (!structureMatch) throw new Error(`${domainPath} has no ${structure}`);
  for (const fieldMatch of structureMatch[1].matchAll(/pub ([a-z_]+):/g)) {
    const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    requireMention(sleepCanonical, camelCase, sleepCanonicalPath);
  }
}
for (const stage of ["wake", "rem", "light", "deep", "unrecognized"]) {
  requireMention(sleepCanonical, stage, sleepCanonicalPath);
}

const recoveryCanonicalPath = "docs/data-formats/canonical/nightly-recovery.md";
const recoveryCanonical = read(recoveryCanonicalPath);
for (const structure of [
  "NightlyRecovery",
  "SourceSpecificRecoveryAssessment",
  "SourceSpecificRecoveryBaseline",
  "SourceSpecificRecoveryGuidance",
]) {
  const structureMatch = domain.match(new RegExp(`pub struct ${structure} \\{([\\s\\S]*?)\\n\\}`));
  if (!structureMatch) throw new Error(`${domainPath} has no ${structure}`);
  for (const fieldMatch of structureMatch[1].matchAll(/pub ([a-z_]+):/g)) {
    const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    requireMention(recoveryCanonical, camelCase, recoveryCanonicalPath);
  }
}

const mappingPath = "docs/data-formats/mappings/polar-flow-daily-activity.md";
const mapping = read(mappingPath);
requireMention(mapping, sourceAdapterVersion, mappingPath);
for (const sourceField of ["date", "summary", "summary.stepCount"]) {
  requireMention(mapping, sourceField, mappingPath);
}
for (const targetField of ["originId", "localDate", "stepCount"]) {
  requireMention(mapping, targetField, mappingPath);
}


const trainingMappingPath = "docs/data-formats/mappings/polar-flow-training-session.md";
const trainingMapping = read(trainingMappingPath);
for (const contractValue of [
  sourceAdapterVersion,
  "polar-flow-mapping-set@1",
  "polar-flow-training-session@1",
]) {
  requireMention(trainingMapping, contractValue, trainingMappingPath);
}
for (const sourceField of [
  "identifier.id",
  "created",
  "modified",
  "startTime",
  "stopTime",
  "timezoneOffsetMinutes",
  "durationMillis",
  "distanceMeters",
  "calories",
  "hrAvg",
  "hrMax",
  "sport.id",
  "exercises",
]) {
  requireMention(trainingMapping, sourceField, trainingMappingPath);
}
for (const targetField of [
  "originId",
  "sessionId",
  "startedAtLocal",
  "stoppedAtLocal",
  "utcOffsetMinutes",
  "durationMilliseconds",
  "distanceMeters",
  "energyKilocalories",
  "averageHeartRateBpm",
  "maximumHeartRateBpm",
  "sportRef",
  "exerciseCount",
]) {
  requireMention(trainingMapping, targetField, trainingMappingPath);
}

const sleepMappingPath = "docs/data-formats/mappings/polar-flow-sleep.md";
const sleepMapping = read(sleepMappingPath);
for (const contractValue of [
  sourceAdapterVersion,
  "polar-flow-mapping-set@1",
  "polar-flow-sleep@1",
]) {
  requireMention(sleepMapping, contractValue, sleepMappingPath);
}
for (const sourceField of [
  "night",
  "sleepResult.hypnogram.sleepStart",
  "sleepResult.hypnogram.sleepEnd",
  "evaluation.sleepSpan",
  "evaluation.asleepDuration",
  "evaluation.interruptions.totalDuration",
  "evaluation.interruptions.longDuration",
  "evaluation.interruptions.shortDuration",
  "evaluation.interruptions.totalCount",
  "evaluation.interruptions.longCount",
  "evaluation.interruptions.shortCount",
  "evaluation.analysis.efficiencyPercent",
  "evaluation.analysis.continuityIndex",
  "evaluation.analysis.continuityClass",
  "sleepResult.hypnogram.sleepGoal",
  "sleepResult.hypnogram.rating",
  "sleepResult.hypnogram.batteryRanOut",
  "evaluation.phaseDurations",
  "sleepResult.hypnogram.sleepStateChanges",
  "sleepResult.sleepCycles.cycles.sleepCycleModels",
  "sleepScoreResult.sleepScore",
  "sleepScoreResult.scoreRate",
]) {
  requireMention(sleepMapping, sourceField, sleepMappingPath);
}
for (const targetField of [
  "originId",
  "sleepDate",
  "startedAt",
  "endedAt",
  "spanMilliseconds",
  "asleepMilliseconds",
  "interruptionMilliseconds",
  "longInterruptionMilliseconds",
  "shortInterruptionMilliseconds",
  "interruptionCount",
  "longInterruptionCount",
  "shortInterruptionCount",
  "efficiencyPercent",
  "continuityIndex",
  "continuityClass",
  "sleepGoalMilliseconds",
  "selfReportedRating",
  "cycleCount",
  "recordingEndedByPowerLoss",
  "phaseSummary",
  "stageTransitions",
  "score",
]) {
  requireMention(sleepMapping, targetField, sleepMappingPath);
}

const recoveryMappingPath = "docs/data-formats/mappings/polar-flow-nightly-recovery.md";
const recoveryMapping = read(recoveryMappingPath);
for (const contractValue of [
  "polar-flow-archive@6",
  "polar-flow-mapping-set@1",
  "polar-flow-nightly-recovery@1",
  "polar-nightly-recharge@1",
]) {
  requireMention(recoveryMapping, contractValue, recoveryMappingPath);
}
for (const sourceField of [
  "night",
  "meanNightlyRecoveryRri",
  "meanNightlyRecoveryRmssd",
  "meanNightlyRecoveryRespirationInterval",
  "ansStatus",
  "ansRate",
  "recoveryIndicator",
  "recoveryIndicatorSubLevel",
  "meanBaselineRri",
  "sdBaselineRri",
  "meanBaselineRmssd",
  "sdBaselineRmssd",
  "meanBaselineRespirationInterval",
  "sdBaselineRespirationInterval",
  "exerciseTip",
  "sleepTip",
  "vitalityTip",
]) {
  requireMention(recoveryMapping, sourceField, recoveryMappingPath);
}
for (const targetField of [
  "originId",
  "recoveryDate",
  "beatToBeatIntervalMilliseconds",
  "heartRateVariabilityRmssdMilliseconds",
  "breathingIntervalMilliseconds",
  "sourceAssessment",
  "sourceBaseline",
  "sourceGuidance",
]) {
  requireMention(recoveryMapping, targetField, recoveryMappingPath);
}

const activityOverviewPath = "docs/data-formats/insights/daily-activity-overview-v1.md";
const activityOverview = read(activityOverviewPath);
for (const field of [
  "availableRange",
  "selectedRange",
  "series",
  "seriesRef",
  "summary",
  "days",
  "localDate",
  "stepCount",
  "availability",
  "calendarDays",
  "observedDays",
  "availableStepDays",
  "unavailableStepDays",
  "missingDays",
  "totalStepCount",
  "averageStepCount",
  "available",
  "unavailable",
  "missing",
]) {
  requireMention(activityOverview, field, activityOverviewPath);
}
const activityOverviewSchemaPath = "schemas/activity-overview-v1.schema.json";
const activityOverviewSchema = JSON.parse(read(activityOverviewSchemaPath));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateActivityOverview = ajv.compile(activityOverviewSchema);
const syntheticActivityOverview = {
  availableRange: { from: "2026-01-01", through: "2026-01-03" },
  selectedRange: { from: "2026-01-01", through: "2026-01-03" },
  series: [
    {
      seriesRef: "synthetic-origin",
      summary: {
        calendarDays: 3,
        observedDays: 2,
        availableStepDays: 1,
        unavailableStepDays: 1,
        missingDays: 1,
        totalStepCount: "9007199254740993",
        averageStepCount: "9007199254740993",
      },
      days: [
        { localDate: "2026-01-01", stepCount: "9007199254740993", availability: "available" },
        { localDate: "2026-01-02", stepCount: null, availability: "missing" },
        { localDate: "2026-01-03", stepCount: null, availability: "unavailable" },
      ],
    },
  ],
};
if (!validateActivityOverview(syntheticActivityOverview)) {
  throw new Error(
    `${activityOverviewSchemaPath} rejected its synthetic contract: ${ajv.errorsText(validateActivityOverview.errors)}`,
  );
}
const invalidActivityOverview = structuredClone(syntheticActivityOverview);
invalidActivityOverview.series[0].days[1].stepCount = "0";
if (validateActivityOverview(invalidActivityOverview)) {
  throw new Error(`${activityOverviewSchemaPath} accepted a step count for a missing day`);
}

const activityOverviewV2Path = "docs/data-formats/insights/daily-activity-overview-v2.md";
const activityOverviewV2 = read(activityOverviewV2Path);
for (const field of [
  "requestedRange",
  "availableRange",
  "selectedRange",
  "series",
  "seriesRef",
  "summary",
  "days",
  "localDate",
  "stepCount",
  "availability",
  "calendarDays",
  "observedDays",
  "availableStepDays",
  "unavailableStepDays",
  "missingDays",
  "totalStepCount",
  "averageStepCount",
  "available",
  "unavailable",
  "missing",
  "invalid-activity-range",
]) {
  requireMention(activityOverviewV2, field, activityOverviewV2Path);
}
const activityOverviewV2SchemaPath = "schemas/activity-overview-v2.schema.json";
const activityOverviewV2Schema = JSON.parse(read(activityOverviewV2SchemaPath));
const validateActivityOverviewV2 = ajv.compile(activityOverviewV2Schema);
const activityOverviewQueryV2SchemaPath = "schemas/activity-overview-query-v2.schema.json";
const activityOverviewQueryV2Schema = JSON.parse(read(activityOverviewQueryV2SchemaPath));
const validateActivityOverviewQueryV2 = ajv.compile(activityOverviewQueryV2Schema);
for (const query of [
  { requestedRange: null },
  { requestedRange: { from: "2025-12-30", through: "2026-01-02" } },
]) {
  if (!validateActivityOverviewQueryV2(query)) {
    throw new Error(
      `${activityOverviewQueryV2SchemaPath} rejected a valid query: ${ajv.errorsText(validateActivityOverviewQueryV2.errors)}`,
    );
  }
}
for (const query of [
  {},
  { requestedRange: { from: "2026-02-30", through: "2026-03-01" } },
  { requestedRange: null, provider: "synthetic" },
]) {
  if (validateActivityOverviewQueryV2(query)) {
    throw new Error(`${activityOverviewQueryV2SchemaPath} accepted an invalid query`);
  }
}
const firstLongDate = Date.UTC(2024, 0, 1);
const longDays = Array.from({ length: 366 }, (_, index) => ({
  localDate: new Date(firstLongDate + index * 86_400_000).toISOString().slice(0, 10),
  stepCount: null,
  availability: "missing",
}));
const longActivityOverview = {
  availableRange: { from: longDays[0].localDate, through: longDays.at(-1).localDate },
  selectedRange: { from: longDays[0].localDate, through: longDays.at(-1).localDate },
  series: [{
    seriesRef: "synthetic-origin",
    summary: {
      calendarDays: 366,
      observedDays: 0,
      availableStepDays: 0,
      unavailableStepDays: 0,
      missingDays: 366,
      totalStepCount: null,
      averageStepCount: null,
    },
    days: longDays,
  }],
};
if (!validateActivityOverviewV2(longActivityOverview)) {
  throw new Error(
    `${activityOverviewV2SchemaPath} rejected its maximum range: ${ajv.errorsText(validateActivityOverviewV2.errors)}`,
  );
}
if (validateActivityOverview(longActivityOverview)) {
  throw new Error(`${activityOverviewSchemaPath} accepted the version 2 maximum range`);
}
const oversizedActivityOverview = structuredClone(longActivityOverview);
oversizedActivityOverview.series[0].days.push({
  localDate: "2025-01-01",
  stepCount: null,
  availability: "missing",
});
oversizedActivityOverview.series[0].summary.calendarDays = 367;
oversizedActivityOverview.series[0].summary.missingDays = 367;
if (validateActivityOverviewV2(oversizedActivityOverview)) {
  throw new Error(`${activityOverviewV2SchemaPath} accepted 367 daily entries`);
}

const activityComparisonPath = "docs/data-formats/insights/daily-activity-comparison-v1.md";
const activityComparison = read(activityComparisonPath);
for (const field of [
  "baselineRange",
  "comparisonRange",
  "availableRange",
  "series",
  "seriesRef",
  "baseline",
  "comparison",
  "calendarDays",
  "observedDays",
  "availableStepDays",
  "unavailableStepDays",
  "missingDays",
  "totalStepCount",
  "averageStepCount",
  "totalStepChange",
  "averageStepChange",
]) {
  requireMention(activityComparison, field, activityComparisonPath);
}
const activityComparisonQuerySchemaPath = "schemas/activity-comparison-query-v1.schema.json";
const activityComparisonQuerySchema = JSON.parse(read(activityComparisonQuerySchemaPath));
const validateActivityComparisonQuery = ajv.compile(activityComparisonQuerySchema);
const syntheticActivityComparisonQuery = {
  baselineRange: { from: "2026-01-01", through: "2026-01-02" },
  comparisonRange: { from: "2026-01-04", through: "2026-01-05" },
};
if (!validateActivityComparisonQuery(syntheticActivityComparisonQuery)) {
  throw new Error(
    `${activityComparisonQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateActivityComparisonQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { baselineRange: syntheticActivityComparisonQuery.baselineRange },
  { ...syntheticActivityComparisonQuery, provider: "synthetic" },
  {
    ...syntheticActivityComparisonQuery,
    comparisonRange: { from: "2026-02-30", through: "2026-03-01" },
  },
]) {
  if (validateActivityComparisonQuery(invalidQuery)) {
    throw new Error(`${activityComparisonQuerySchemaPath} accepted an invalid query`);
  }
}
const activityComparisonSchemaPath = "schemas/activity-comparison-v1.schema.json";
const activityComparisonSchema = JSON.parse(read(activityComparisonSchemaPath));
const validateActivityComparison = ajv.compile(activityComparisonSchema);
const syntheticSummary = {
  calendarDays: 2,
  observedDays: 2,
  availableStepDays: 2,
  unavailableStepDays: 0,
  missingDays: 0,
  totalStepCount: "3000",
  averageStepCount: "1500",
};
const syntheticActivityComparison = {
  availableRange: { from: "2026-01-01", through: "2026-01-05" },
  ...syntheticActivityComparisonQuery,
  series: [{
    seriesRef: "synthetic-origin",
    baseline: syntheticSummary,
    comparison: {
      ...syntheticSummary,
      observedDays: 1,
      availableStepDays: 1,
      missingDays: 1,
      totalStepCount: "5000",
      averageStepCount: "5000",
    },
    totalStepChange: "2000",
    averageStepChange: "3500",
  }],
};
if (!validateActivityComparison(syntheticActivityComparison)) {
  throw new Error(
    `${activityComparisonSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateActivityComparison.errors)}`,
  );
}
for (const invalidChange of ["-0", "+1", "01"]) {
  const invalidComparison = structuredClone(syntheticActivityComparison);
  invalidComparison.series[0].totalStepChange = invalidChange;
  if (validateActivityComparison(invalidComparison)) {
    throw new Error(`${activityComparisonSchemaPath} accepted invalid change ${invalidChange}`);
  }
}

const trainingOverviewPath = "docs/data-formats/insights/training-overview-v1.md";
const trainingOverview = read(trainingOverviewPath);
for (const field of [
  "requestedRange",
  "availableRange",
  "selectedRange",
  "series",
  "seriesRef",
  "summary",
  "sessions",
  "sessionRef",
  "startedAtLocal",
  "stoppedAtLocal",
  "utcOffsetMinutes",
  "durationMilliseconds",
  "distanceMeters",
  "energyKilocalories",
  "averageHeartRateBpm",
  "maximumHeartRateBpm",
  "sportRef",
  "exerciseCount",
  "calendarDays",
  "trainingDays",
  "sessionCount",
  "totalDurationMilliseconds",
  "distanceSessionCount",
  "totalDistanceMeters",
  "energySessionCount",
  "totalEnergyKilocalories",
  "heartRateSessionCount",
  "invalid-training-range",
]) {
  requireMention(trainingOverview, field, trainingOverviewPath);
}
const trainingOverviewQuerySchemaPath = "schemas/training-overview-query-v1.schema.json";
const trainingOverviewQuerySchema = JSON.parse(read(trainingOverviewQuerySchemaPath));
const validateTrainingOverviewQuery = ajv.compile(trainingOverviewQuerySchema);
for (const query of [
  { requestedRange: null },
  { requestedRange: { from: "2026-01-01", through: "2026-01-31" } },
]) {
  if (!validateTrainingOverviewQuery(query)) {
    throw new Error(
      `${trainingOverviewQuerySchemaPath} rejected a valid query: ${ajv.errorsText(validateTrainingOverviewQuery.errors)}`,
    );
  }
}
for (const query of [
  {},
  { requestedRange: { from: "2026-02-30", through: "2026-03-01" } },
  { requestedRange: null, provider: "synthetic" },
]) {
  if (validateTrainingOverviewQuery(query)) {
    throw new Error(`${trainingOverviewQuerySchemaPath} accepted an invalid query`);
  }
}
const trainingSummary = {
  calendarDays: 31,
  trainingDays: 2,
  sessionCount: 2,
  totalDurationMilliseconds: "5400000",
  distanceSessionCount: 1,
  totalDistanceMeters: 5000.25,
  energySessionCount: 2,
  totalEnergyKilocalories: "750",
  heartRateSessionCount: 1,
};
const syntheticTrainingOverview = {
  availableRange: { from: "2026-01-01", through: "2026-01-31" },
  selectedRange: { from: "2026-01-01", through: "2026-01-31" },
  series: [{
    seriesRef: "synthetic-origin",
    summary: trainingSummary,
    sessions: [{
      sessionRef: "synthetic-session",
      startedAtLocal: "2026-01-20T09:00:00.123",
      stoppedAtLocal: "2026-01-20T10:00:00.123",
      utcOffsetMinutes: 60,
      durationMilliseconds: "3600000",
      distanceMeters: 5000.25,
      energyKilocalories: "500",
      averageHeartRateBpm: "140",
      maximumHeartRateBpm: "170",
      sportRef: "synthetic-sport",
      exerciseCount: 1,
    }],
  }],
};
const trainingOverviewSchemaPath = "schemas/training-overview-v1.schema.json";
const trainingOverviewSchema = JSON.parse(read(trainingOverviewSchemaPath));
const validateTrainingOverview = ajv.compile(trainingOverviewSchema);
if (!validateTrainingOverview(syntheticTrainingOverview)) {
  throw new Error(
    `${trainingOverviewSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingOverview.errors)}`,
  );
}
const invalidTrainingOverview = structuredClone(syntheticTrainingOverview);
invalidTrainingOverview.series[0].sessions[0].durationMilliseconds = "01";
if (validateTrainingOverview(invalidTrainingOverview)) {
  throw new Error(`${trainingOverviewSchemaPath} accepted a non-canonical duration`);
}

const trainingComparisonPath = "docs/data-formats/insights/training-comparison-v1.md";
const trainingComparison = read(trainingComparisonPath);
for (const field of [
  "baselineRange",
  "comparisonRange",
  "availableRange",
  "seriesRef",
  "baseline",
  "comparison",
  "sessionCountChange",
  "trainingDayChange",
  "durationMillisecondsChange",
  "distanceMetersChange",
  "energyKilocaloriesChange",
]) {
  requireMention(trainingComparison, field, trainingComparisonPath);
}
const trainingComparisonQuerySchemaPath = "schemas/training-comparison-query-v1.schema.json";
const trainingComparisonQuerySchema = JSON.parse(read(trainingComparisonQuerySchemaPath));
const validateTrainingComparisonQuery = ajv.compile(trainingComparisonQuerySchema);
const syntheticTrainingComparisonQuery = {
  baselineRange: { from: "2026-01-01", through: "2026-01-02" },
  comparisonRange: { from: "2026-01-04", through: "2026-01-05" },
};
if (!validateTrainingComparisonQuery(syntheticTrainingComparisonQuery)) {
  throw new Error(
    `${trainingComparisonQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingComparisonQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { baselineRange: syntheticTrainingComparisonQuery.baselineRange },
  { ...syntheticTrainingComparisonQuery, provider: "synthetic" },
  {
    ...syntheticTrainingComparisonQuery,
    comparisonRange: { from: "2026-02-30", through: "2026-03-01" },
  },
]) {
  if (validateTrainingComparisonQuery(invalidQuery)) {
    throw new Error(`${trainingComparisonQuerySchemaPath} accepted an invalid query`);
  }
}
const trainingComparisonSchemaPath = "schemas/training-comparison-v1.schema.json";
const trainingComparisonSchema = JSON.parse(read(trainingComparisonSchemaPath));
const validateTrainingComparison = ajv.compile(trainingComparisonSchema);
const syntheticTrainingComparison = {
  availableRange: { from: "2026-01-01", through: "2026-01-05" },
  ...syntheticTrainingComparisonQuery,
  series: [{
    seriesRef: "synthetic-origin",
    baseline: trainingSummary,
    comparison: { ...trainingSummary, sessionCount: 3, trainingDays: 3 },
    sessionCountChange: "1",
    trainingDayChange: "1",
    durationMillisecondsChange: "0",
    distanceMetersChange: -500.25,
    energyKilocaloriesChange: null,
  }],
};
if (!validateTrainingComparison(syntheticTrainingComparison)) {
  throw new Error(
    `${trainingComparisonSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingComparison.errors)}`,
  );
}
for (const invalidChange of ["-0", "+1", "01"]) {
  const invalidComparison = structuredClone(syntheticTrainingComparison);
  invalidComparison.series[0].sessionCountChange = invalidChange;
  if (validateTrainingComparison(invalidComparison)) {
    throw new Error(`${trainingComparisonSchemaPath} accepted invalid change ${invalidChange}`);
  }
}

const sleepOverviewPath = "docs/data-formats/insights/sleep-overview-v1.md";
const sleepOverview = read(sleepOverviewPath);
for (const field of [
  "requestedRange",
  "availableRange",
  "selectedRange",
  "series",
  "seriesRef",
  "summary",
  "days",
  "sleepDate",
  "availability",
  "period",
  "startedAt",
  "endedAt",
  "spanMilliseconds",
  "asleepMilliseconds",
  "interruptionMilliseconds",
  "longInterruptionMilliseconds",
  "shortInterruptionMilliseconds",
  "interruptionCount",
  "longInterruptionCount",
  "shortInterruptionCount",
  "efficiencyPercent",
  "continuityIndex",
  "continuityClass",
  "sleepGoalMilliseconds",
  "selfReportedRating",
  "cycleCount",
  "recordingEndedByPowerLoss",
  "phaseSummary",
  "stageTimelineAvailable",
  "scoreOverall",
  "scoreRelativeRating",
  "calendarDays",
  "observedNights",
  "missingNights",
  "totalAsleepMilliseconds",
  "averageAsleepMilliseconds",
  "totalInterruptionMilliseconds",
  "averageInterruptionMilliseconds",
  "averageEfficiencyPercent",
  "phaseNightCount",
  "phaseTotals",
  "stageTimelineNightCount",
  "scoreNightCount",
  "averageOverallScore",
  "goalNightCount",
  "goalMetNightCount",
  "powerStatusNightCount",
  "powerLossNightCount",
  "stageTransitions",
  "score",
  "invalid-sleep-range",
  "invalid-sleep-reference",
  "available",
  "missing",
]) {
  requireMention(sleepOverview, field, sleepOverviewPath);
}

const sleepOverviewQuerySchemaPath = "schemas/sleep-overview-query-v1.schema.json";
const sleepOverviewQuerySchema = JSON.parse(read(sleepOverviewQuerySchemaPath));
const validateSleepOverviewQuery = ajv.compile(sleepOverviewQuerySchema);
const syntheticSleepOverviewQuery = {
  requestedRange: { from: "2026-01-01", through: "2026-01-03" },
};
for (const query of [{ requestedRange: null }, syntheticSleepOverviewQuery]) {
  if (!validateSleepOverviewQuery(query)) {
    throw new Error(
      sleepOverviewQuerySchemaPath
        + " rejected a valid query: "
        + ajv.errorsText(validateSleepOverviewQuery.errors),
    );
  }
}
for (const query of [
  {},
  { requestedRange: { from: "2026-02-30", through: "2026-03-01" } },
  { requestedRange: null, provider: "synthetic" },
]) {
  if (validateSleepOverviewQuery(query)) {
    throw new Error(sleepOverviewQuerySchemaPath + " accepted an invalid query");
  }
}

const syntheticPhaseSummary = {
  wakeMilliseconds: "1800000",
  remMilliseconds: "5400000",
  lightMilliseconds: "12600000",
  deepMilliseconds: "5400000",
  unrecognizedMilliseconds: "0",
};
const syntheticSleepSummary = {
  calendarDays: 3,
  observedNights: 2,
  missingNights: 1,
  totalAsleepMilliseconds: "46800000",
  averageAsleepMilliseconds: "23400000",
  totalInterruptionMilliseconds: "3600000",
  averageInterruptionMilliseconds: "1800000",
  averageEfficiencyPercent: 92.86,
  phaseNightCount: 1,
  phaseTotals: syntheticPhaseSummary,
  stageTimelineNightCount: 1,
  scoreNightCount: 1,
  averageOverallScore: 82,
  goalNightCount: 1,
  goalMetNightCount: 0,
  powerStatusNightCount: 1,
  powerLossNightCount: 0,
};
const syntheticSleepPeriodInsight = {
  startedAt: "2026-01-01T22:30:00+01:00",
  endedAt: "2026-01-02T05:30:00+01:00",
  spanMilliseconds: "25200000",
  asleepMilliseconds: "23400000",
  interruptionMilliseconds: "1800000",
  longInterruptionMilliseconds: "1200000",
  shortInterruptionMilliseconds: "600000",
  interruptionCount: "3",
  longInterruptionCount: "1",
  shortInterruptionCount: "2",
  efficiencyPercent: 92.86,
  continuityIndex: 4.2,
  continuityClass: 4,
  sleepGoalMilliseconds: "28800000",
  selfReportedRating: 4,
  cycleCount: "4",
  recordingEndedByPowerLoss: false,
  phaseSummary: syntheticPhaseSummary,
  stageTimelineAvailable: true,
  scoreOverall: 82,
  scoreRelativeRating: 4,
};
const syntheticSleepOverview = {
  availableRange: { from: "2026-01-01", through: "2026-01-03" },
  selectedRange: { from: "2026-01-01", through: "2026-01-03" },
  series: [{
    seriesRef: "synthetic-origin",
    summary: syntheticSleepSummary,
    days: [
      {
        sleepDate: "2026-01-01",
        availability: "available",
        period: syntheticSleepPeriodInsight,
      },
      { sleepDate: "2026-01-02", availability: "missing", period: null },
      {
        sleepDate: "2026-01-03",
        availability: "available",
        period: {
          ...syntheticSleepPeriodInsight,
          phaseSummary: null,
          stageTimelineAvailable: false,
          scoreOverall: null,
          scoreRelativeRating: null,
          sleepGoalMilliseconds: null,
          selfReportedRating: null,
          cycleCount: null,
          recordingEndedByPowerLoss: null,
        },
      },
    ],
  }],
};
const sleepOverviewSchemaPath = "schemas/sleep-overview-v1.schema.json";
const sleepOverviewSchema = JSON.parse(read(sleepOverviewSchemaPath));
const validateSleepOverview = ajv.compile(sleepOverviewSchema);
if (!validateSleepOverview(syntheticSleepOverview)) {
  throw new Error(
    sleepOverviewSchemaPath
      + " rejected its synthetic response: "
      + ajv.errorsText(validateSleepOverview.errors),
  );
}
for (const invalidOverview of [
  (() => {
    const value = structuredClone(syntheticSleepOverview);
    value.series[0].days[1].period = syntheticSleepPeriodInsight;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSleepOverview);
    value.series[0].days[0].period.spanMilliseconds = "01";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSleepOverview);
    value.series[0].days[0].period.startedAt = "2026-01-01T21:30:00Z";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSleepOverview);
    value.series[0].days[0].period.cycleCount = 4;
    return value;
  })(),
]) {
  if (validateSleepOverview(invalidOverview)) {
    throw new Error(sleepOverviewSchemaPath + " accepted an invalid response");
  }
}

const sleepDetailQuerySchemaPath = "schemas/sleep-detail-query-v1.schema.json";
const sleepDetailQuerySchema = JSON.parse(read(sleepDetailQuerySchemaPath));
const validateSleepDetailQuery = ajv.compile(sleepDetailQuerySchema);
const syntheticSleepDetailQuery = {
  seriesRef: "synthetic-origin",
  sleepDate: "2026-01-01",
};
if (!validateSleepDetailQuery(syntheticSleepDetailQuery)) {
  throw new Error(
    sleepDetailQuerySchemaPath
      + " rejected its synthetic query: "
      + ajv.errorsText(validateSleepDetailQuery.errors),
  );
}
for (const query of [
  { ...syntheticSleepDetailQuery, seriesRef: "" },
  { ...syntheticSleepDetailQuery, sleepDate: "2026-02-30" },
  { ...syntheticSleepDetailQuery, provider: "synthetic" },
]) {
  if (validateSleepDetailQuery(query)) {
    throw new Error(sleepDetailQuerySchemaPath + " accepted an invalid query");
  }
}

const syntheticSleepDetail = {
  sleepDate: "2026-01-01",
  ...Object.fromEntries(
    Object.entries(syntheticSleepPeriodInsight).filter(
      ([key]) => !["stageTimelineAvailable", "scoreOverall", "scoreRelativeRating"].includes(key),
    ),
  ),
  stageTransitions: [
    { offsetMilliseconds: "0", stage: "light" },
    { offsetMilliseconds: "5400000", stage: "deep" },
  ],
  score: {
    overall: 82,
    ownTargetDuration: 75,
    recommendedDuration: 80,
    continuity: 84,
    efficiency: 90,
    rem: 81,
    deep: 78,
    longInterruptions: 88,
    duration: 79,
    solidity: 87,
    regeneration: 83,
    relativeRating: 4,
  },
};
const sleepDetailSchemaPath = "schemas/sleep-detail-v1.schema.json";
const sleepDetailSchema = JSON.parse(read(sleepDetailSchemaPath));
const validateSleepDetail = ajv.compile(sleepDetailSchema);
for (const detail of [null, syntheticSleepDetail]) {
  if (!validateSleepDetail(detail)) {
    throw new Error(
      sleepDetailSchemaPath
        + " rejected valid detail: "
        + ajv.errorsText(validateSleepDetail.errors),
    );
  }
}
const invalidSleepDetail = structuredClone(syntheticSleepDetail);
invalidSleepDetail.stageTransitions[0].stage = "n2";
if (validateSleepDetail(invalidSleepDetail)) {
  throw new Error(sleepDetailSchemaPath + " accepted an invalid stage");
}

const sleepComparisonPath = "docs/data-formats/insights/sleep-comparison-v1.md";
const sleepComparison = read(sleepComparisonPath);
for (const field of [
  "baselineRange",
  "comparisonRange",
  "availableRange",
  "seriesRef",
  "baseline",
  "comparison",
  "observedNightChange",
  "missingNightChange",
  "averageAsleepMillisecondsChange",
  "averageInterruptionMillisecondsChange",
  "averageEfficiencyPercentagePointChange",
  "averageOverallScoreChange",
  "goalMetPercentagePointChange",
]) {
  requireMention(sleepComparison, field, sleepComparisonPath);
}
const sleepComparisonQuerySchemaPath = "schemas/sleep-comparison-query-v1.schema.json";
const sleepComparisonQuerySchema = JSON.parse(read(sleepComparisonQuerySchemaPath));
const validateSleepComparisonQuery = ajv.compile(sleepComparisonQuerySchema);
const syntheticSleepComparisonQuery = {
  baselineRange: { from: "2026-01-01", through: "2026-01-03" },
  comparisonRange: { from: "2026-01-04", through: "2026-01-06" },
};
if (!validateSleepComparisonQuery(syntheticSleepComparisonQuery)) {
  throw new Error(
    sleepComparisonQuerySchemaPath
      + " rejected its synthetic query: "
      + ajv.errorsText(validateSleepComparisonQuery.errors),
  );
}
for (const query of [
  { baselineRange: syntheticSleepComparisonQuery.baselineRange },
  { ...syntheticSleepComparisonQuery, provider: "synthetic" },
  {
    ...syntheticSleepComparisonQuery,
    comparisonRange: { from: "2026-02-30", through: "2026-03-01" },
  },
]) {
  if (validateSleepComparisonQuery(query)) {
    throw new Error(sleepComparisonQuerySchemaPath + " accepted an invalid query");
  }
}

const sleepComparisonSchemaPath = "schemas/sleep-comparison-v1.schema.json";
const sleepComparisonSchema = JSON.parse(read(sleepComparisonSchemaPath));
const validateSleepComparison = ajv.compile(sleepComparisonSchema);
const syntheticSleepComparison = {
  availableRange: { from: "2026-01-01", through: "2026-01-06" },
  ...syntheticSleepComparisonQuery,
  series: [{
    seriesRef: "synthetic-origin",
    baseline: syntheticSleepSummary,
    comparison: {
      ...syntheticSleepSummary,
      observedNights: 3,
      missingNights: 0,
      averageAsleepMilliseconds: "24000000",
      averageInterruptionMilliseconds: "1200000",
      averageEfficiencyPercent: 95,
      averageOverallScore: null,
      scoreNightCount: 0,
      goalNightCount: 0,
      goalMetNightCount: 0,
    },
    observedNightChange: "1",
    missingNightChange: "-1",
    averageAsleepMillisecondsChange: "600000",
    averageInterruptionMillisecondsChange: "-600000",
    averageEfficiencyPercentagePointChange: 2.14,
    averageOverallScoreChange: null,
    goalMetPercentagePointChange: null,
  }],
};
if (!validateSleepComparison(syntheticSleepComparison)) {
  throw new Error(
    sleepComparisonSchemaPath
      + " rejected its synthetic response: "
      + ajv.errorsText(validateSleepComparison.errors),
  );
}
for (const invalidChange of ["-0", "+1", "01"]) {
  const invalidComparison = structuredClone(syntheticSleepComparison);
  invalidComparison.series[0].observedNightChange = invalidChange;
  if (validateSleepComparison(invalidComparison)) {
    throw new Error(sleepComparisonSchemaPath + " accepted invalid change " + invalidChange);
  }
}

const recoveryOverviewPath =
  "docs/data-formats/insights/nightly-recovery-overview-v1.md";
const recoveryOverview = read(recoveryOverviewPath);
for (const field of [
  "requestedRange",
  "availableRange",
  "selectedRange",
  "series",
  "seriesRef",
  "summary",
  "days",
  "recoveryDate",
  "availability",
  "recovery",
  "beatToBeatIntervalMilliseconds",
  "heartRateVariabilityRmssdMilliseconds",
  "breathingIntervalMilliseconds",
  "sourceAssessment",
  "sourceBaselineAvailable",
  "sourceGuidanceAvailable",
  "scheme",
  "autonomicCharge",
  "autonomicStatus",
  "overallStatus",
  "overallSublevel",
  "calendarDays",
  "observedNights",
  "missingNights",
  "averageBeatToBeatIntervalMilliseconds",
  "rmssdNightCount",
  "averageHeartRateVariabilityRmssdMilliseconds",
  "averageBreathingIntervalMilliseconds",
  "assessmentNightCount",
  "baselineNightCount",
  "guidanceNightCount",
  "sourceBaseline",
  "sourceGuidance",
  "meanBeatToBeatIntervalMilliseconds",
  "standardDeviationBeatToBeatIntervalMilliseconds",
  "meanHeartRateVariabilityRmssdMilliseconds",
  "standardDeviationHeartRateVariabilityRmssdMilliseconds",
  "meanBreathingIntervalMilliseconds",
  "standardDeviationBreathingIntervalMilliseconds",
  "exercise",
  "sleep",
  "vitality",
  "available",
  "missing",
  "invalid-recovery-range",
  "invalid-recovery-reference",
]) {
  requireMention(recoveryOverview, field, recoveryOverviewPath);
}

const recoveryOverviewQuerySchemaPath =
  "schemas/recovery-overview-query-v1.schema.json";
const recoveryOverviewQuerySchema = JSON.parse(read(recoveryOverviewQuerySchemaPath));
const validateRecoveryOverviewQuery = ajv.compile(recoveryOverviewQuerySchema);
for (const query of [
  { requestedRange: null },
  { requestedRange: { from: "2026-01-01", through: "2026-01-31" } },
]) {
  if (!validateRecoveryOverviewQuery(query)) {
    throw new Error(
      recoveryOverviewQuerySchemaPath
        + " rejected a valid query: "
        + ajv.errorsText(validateRecoveryOverviewQuery.errors),
    );
  }
}
for (const query of [
  {},
  { requestedRange: { from: "2026-02-30", through: "2026-03-01" } },
  { requestedRange: null, provider: "synthetic" },
]) {
  if (validateRecoveryOverviewQuery(query)) {
    throw new Error(recoveryOverviewQuerySchemaPath + " accepted an invalid query");
  }
}

const syntheticRecoveryAssessment = {
  scheme: "synthetic-assessment@1",
  autonomicCharge: 1.5,
  autonomicStatus: 4,
  overallStatus: 5,
  overallSublevel: "2",
};
const syntheticRecoverySummary = {
  calendarDays: 2,
  observedNights: 1,
  missingNights: 1,
  averageBeatToBeatIntervalMilliseconds: "9007199254740993",
  rmssdNightCount: 1,
  averageHeartRateVariabilityRmssdMilliseconds: "42",
  averageBreathingIntervalMilliseconds: "4100",
  assessmentNightCount: 1,
  baselineNightCount: 1,
  guidanceNightCount: 1,
};
const syntheticRecoveryInsight = {
  beatToBeatIntervalMilliseconds: "9007199254740993",
  heartRateVariabilityRmssdMilliseconds: "42",
  breathingIntervalMilliseconds: "4100",
  sourceAssessment: syntheticRecoveryAssessment,
  sourceBaselineAvailable: true,
  sourceGuidanceAvailable: true,
};
const syntheticRecoveryOverview = {
  availableRange: { from: "2026-01-01", through: "2026-01-02" },
  selectedRange: { from: "2026-01-01", through: "2026-01-02" },
  series: [{
    seriesRef: "synthetic-origin",
    summary: syntheticRecoverySummary,
    days: [
      {
        recoveryDate: "2026-01-01",
        availability: "available",
        recovery: syntheticRecoveryInsight,
      },
      { recoveryDate: "2026-01-02", availability: "missing", recovery: null },
    ],
  }],
};
const recoveryOverviewSchemaPath = "schemas/recovery-overview-v1.schema.json";
const recoveryOverviewSchema = JSON.parse(read(recoveryOverviewSchemaPath));
const validateRecoveryOverview = ajv.compile(recoveryOverviewSchema);
if (!validateRecoveryOverview(syntheticRecoveryOverview)) {
  throw new Error(
    recoveryOverviewSchemaPath
      + " rejected its synthetic response: "
      + ajv.errorsText(validateRecoveryOverview.errors),
  );
}
for (const invalidOverview of [
  (() => {
    const value = structuredClone(syntheticRecoveryOverview);
    value.series[0].days[1].recovery = syntheticRecoveryInsight;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticRecoveryOverview);
    value.series[0].days[0].recovery.beatToBeatIntervalMilliseconds = "0";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticRecoveryOverview);
    value.series[0].days[0].recovery.sourceAssessment.overallSublevel = 2;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticRecoveryOverview);
    value.series[0].days[0].recovery.sourceAssessment.scheme = " ";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticRecoveryOverview);
    value.series[0].seriesRef = " ";
    return value;
  })(),
]) {
  if (validateRecoveryOverview(invalidOverview)) {
    throw new Error(recoveryOverviewSchemaPath + " accepted an invalid response");
  }
}

const recoveryDetailQuerySchemaPath = "schemas/recovery-detail-query-v1.schema.json";
const recoveryDetailQuerySchema = JSON.parse(read(recoveryDetailQuerySchemaPath));
const validateRecoveryDetailQuery = ajv.compile(recoveryDetailQuerySchema);
const syntheticRecoveryDetailQuery = {
  seriesRef: "synthetic-origin",
  recoveryDate: "2026-01-01",
};
if (!validateRecoveryDetailQuery(syntheticRecoveryDetailQuery)) {
  throw new Error(
    recoveryDetailQuerySchemaPath
      + " rejected its synthetic query: "
      + ajv.errorsText(validateRecoveryDetailQuery.errors),
  );
}
for (const query of [
  { ...syntheticRecoveryDetailQuery, seriesRef: "" },
  { ...syntheticRecoveryDetailQuery, seriesRef: " " },
  { ...syntheticRecoveryDetailQuery, recoveryDate: "2026-02-30" },
  { ...syntheticRecoveryDetailQuery, provider: "synthetic" },
]) {
  if (validateRecoveryDetailQuery(query)) {
    throw new Error(recoveryDetailQuerySchemaPath + " accepted an invalid query");
  }
}

const syntheticRecoveryDetail = {
  recoveryDate: "2026-01-01",
  beatToBeatIntervalMilliseconds: "9007199254740993",
  heartRateVariabilityRmssdMilliseconds: "42",
  breathingIntervalMilliseconds: "4100",
  sourceAssessment: syntheticRecoveryAssessment,
  sourceBaseline: {
    scheme: "synthetic-baseline@1",
    meanBeatToBeatIntervalMilliseconds: "910",
    standardDeviationBeatToBeatIntervalMilliseconds: "30",
    meanHeartRateVariabilityRmssdMilliseconds: "40",
    standardDeviationHeartRateVariabilityRmssdMilliseconds: "8",
    meanBreathingIntervalMilliseconds: "4200",
    standardDeviationBreathingIntervalMilliseconds: "120",
  },
  sourceGuidance: {
    scheme: "synthetic-guidance@1",
    exercise: "Choose a steady synthetic session.",
    sleep: "Keep a consistent synthetic schedule.",
    vitality: "Plan a synthetic restorative break.",
  },
};
const recoveryDetailSchemaPath = "schemas/recovery-detail-v1.schema.json";
const recoveryDetailSchema = JSON.parse(read(recoveryDetailSchemaPath));
const validateRecoveryDetail = ajv.compile(recoveryDetailSchema);
for (const detail of [null, syntheticRecoveryDetail]) {
  if (!validateRecoveryDetail(detail)) {
    throw new Error(
      recoveryDetailSchemaPath
        + " rejected valid detail: "
        + ajv.errorsText(validateRecoveryDetail.errors),
    );
  }
}
for (const invalidDetail of [
  (() => {
    const value = structuredClone(syntheticRecoveryDetail);
    value.sourceGuidance.sleep = " ";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticRecoveryDetail);
    value.sourceBaseline.standardDeviationHeartRateVariabilityRmssdMilliseconds = null;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticRecoveryDetail);
    value.sourceGuidance.scheme = " ";
    return value;
  })(),
]) {
  if (validateRecoveryDetail(invalidDetail)) {
    throw new Error(recoveryDetailSchemaPath + " accepted an invalid detail");
  }
}

const recoveryComparisonPath =
  "docs/data-formats/insights/nightly-recovery-comparison-v1.md";
const recoveryComparison = read(recoveryComparisonPath);
for (const field of [
  "baselineRange",
  "comparisonRange",
  "availableRange",
  "seriesRef",
  "baseline",
  "comparison",
  "observedNightChange",
  "missingNightChange",
  "averageBeatToBeatIntervalMillisecondsChange",
  "averageHeartRateVariabilityRmssdMillisecondsChange",
  "averageBreathingIntervalMillisecondsChange",
  "assessmentNightChange",
  "baselineNightChange",
  "guidanceNightChange",
]) {
  requireMention(recoveryComparison, field, recoveryComparisonPath);
}
const recoveryComparisonQuerySchemaPath =
  "schemas/recovery-comparison-query-v1.schema.json";
const recoveryComparisonQuerySchema = JSON.parse(read(recoveryComparisonQuerySchemaPath));
const validateRecoveryComparisonQuery = ajv.compile(recoveryComparisonQuerySchema);
const syntheticRecoveryComparisonQuery = {
  baselineRange: { from: "2026-01-01", through: "2026-01-02" },
  comparisonRange: { from: "2026-01-03", through: "2026-01-05" },
};
if (!validateRecoveryComparisonQuery(syntheticRecoveryComparisonQuery)) {
  throw new Error(
    recoveryComparisonQuerySchemaPath
      + " rejected its synthetic query: "
      + ajv.errorsText(validateRecoveryComparisonQuery.errors),
  );
}
for (const query of [
  { baselineRange: syntheticRecoveryComparisonQuery.baselineRange },
  { ...syntheticRecoveryComparisonQuery, provider: "synthetic" },
  {
    ...syntheticRecoveryComparisonQuery,
    comparisonRange: { from: "2026-02-30", through: "2026-03-01" },
  },
]) {
  if (validateRecoveryComparisonQuery(query)) {
    throw new Error(recoveryComparisonQuerySchemaPath + " accepted an invalid query");
  }
}

const recoveryComparisonSchemaPath = "schemas/recovery-comparison-v1.schema.json";
const recoveryComparisonSchema = JSON.parse(read(recoveryComparisonSchemaPath));
const validateRecoveryComparison = ajv.compile(recoveryComparisonSchema);
const syntheticRecoveryComparison = {
  availableRange: { from: "2026-01-01", through: "2026-01-05" },
  ...syntheticRecoveryComparisonQuery,
  series: [{
    seriesRef: "synthetic-origin",
    baseline: syntheticRecoverySummary,
    comparison: {
      ...syntheticRecoverySummary,
      calendarDays: 3,
      observedNights: 2,
      averageHeartRateVariabilityRmssdMilliseconds: null,
      rmssdNightCount: 0,
    },
    observedNightChange: "1",
    missingNightChange: "0",
    averageBeatToBeatIntervalMillisecondsChange: "100",
    averageHeartRateVariabilityRmssdMillisecondsChange: null,
    averageBreathingIntervalMillisecondsChange: "-100",
    assessmentNightChange: "0",
    baselineNightChange: "-1",
    guidanceNightChange: "1",
  }],
};
if (!validateRecoveryComparison(syntheticRecoveryComparison)) {
  throw new Error(
    recoveryComparisonSchemaPath
      + " rejected its synthetic response: "
      + ajv.errorsText(validateRecoveryComparison.errors),
  );
}
for (const invalidChange of ["-0", "+1", "01"]) {
  const invalidComparison = structuredClone(syntheticRecoveryComparison);
  invalidComparison.series[0].observedNightChange = invalidChange;
  if (validateRecoveryComparison(invalidComparison)) {
    throw new Error(recoveryComparisonSchemaPath + " accepted invalid change " + invalidChange);
  }
}
const blankRecoveryComparisonSeries = structuredClone(syntheticRecoveryComparison);
blankRecoveryComparisonSeries.series[0].seriesRef = " ";
if (validateRecoveryComparison(blankRecoveryComparisonSeries)) {
  throw new Error(recoveryComparisonSchemaPath + " accepted a blank series reference");
}

const longitudinalPath = "docs/data-formats/insights/longitudinal-overview-v1.md";
const longitudinal = read(longitudinalPath);
for (const field of [
  "requestedRange",
  "availableRange",
  "selectedRange",
  "baselineRange",
  "comparisonRange",
  "seriesRef",
  "localDate",
  "activity",
  "training",
  "sleep",
  "recovery",
  "sessionCount",
  "totalDurationMilliseconds",
  "asleepMilliseconds",
  "beatToBeatIntervalMilliseconds",
  "heartRateVariabilityRmssdMilliseconds",
  "breathingIntervalMilliseconds",
  "totalStepChange",
  "sessionCountChange",
  "averageAsleepMillisecondsChange",
  "averageBeatToBeatIntervalMillisecondsChange",
]) {
  requireMention(longitudinal, field, longitudinalPath);
}

const longitudinalOverviewQuerySchemaPath =
  "schemas/longitudinal-overview-query-v1.schema.json";
const longitudinalOverviewQuerySchema = JSON.parse(read(longitudinalOverviewQuerySchemaPath));
const validateLongitudinalOverviewQuery = ajv.compile(longitudinalOverviewQuerySchema);
for (const query of [
  { requestedRange: null },
  { requestedRange: { from: "2026-01-01", through: "2026-01-02" } },
]) {
  if (!validateLongitudinalOverviewQuery(query)) {
    throw new Error(
      longitudinalOverviewQuerySchemaPath
        + " rejected a valid query: "
        + ajv.errorsText(validateLongitudinalOverviewQuery.errors),
    );
  }
}
for (const query of [
  {},
  { requestedRange: { from: "2026-02-30", through: "2026-03-01" } },
  { requestedRange: null, provider: "synthetic" },
]) {
  if (validateLongitudinalOverviewQuery(query)) {
    throw new Error(longitudinalOverviewQuerySchemaPath + " accepted an invalid query");
  }
}

const longitudinalActivitySummary = {
  ...syntheticSummary,
  observedDays: 1,
  availableStepDays: 1,
  missingDays: 1,
};
const longitudinalTrainingSummary = {
  ...trainingSummary,
  calendarDays: 2,
  trainingDays: 1,
  sessionCount: 1,
  totalDurationMilliseconds: "3600000",
};
const longitudinalSleepSummary = {
  ...syntheticSleepSummary,
  calendarDays: 2,
  observedNights: 1,
  missingNights: 1,
};
const syntheticLongitudinalOverview = {
  availableRange: { from: "2026-01-01", through: "2026-01-02" },
  selectedRange: { from: "2026-01-01", through: "2026-01-02" },
  series: [{
    seriesRef: "synthetic-origin",
    activity: longitudinalActivitySummary,
    training: longitudinalTrainingSummary,
    sleep: longitudinalSleepSummary,
    recovery: syntheticRecoverySummary,
    days: [
      {
        localDate: "2026-01-01",
        activity: { availability: "available", stepCount: "9007199254740993" },
        training: { sessionCount: 1, totalDurationMilliseconds: "3600000" },
        sleep: { availability: "available", asleepMilliseconds: "23400000" },
        recovery: {
          availability: "available",
          beatToBeatIntervalMilliseconds: "9007199254740993",
          heartRateVariabilityRmssdMilliseconds: "42",
          breathingIntervalMilliseconds: "4100",
        },
      },
      {
        localDate: "2026-01-02",
        activity: { availability: "missing", stepCount: null },
        training: { sessionCount: 0, totalDurationMilliseconds: "0" },
        sleep: { availability: "missing", asleepMilliseconds: null },
        recovery: {
          availability: "missing",
          beatToBeatIntervalMilliseconds: null,
          heartRateVariabilityRmssdMilliseconds: null,
          breathingIntervalMilliseconds: null,
        },
      },
    ],
  }],
};
const longitudinalOverviewSchemaPath = "schemas/longitudinal-overview-v1.schema.json";
const longitudinalOverviewSchema = JSON.parse(read(longitudinalOverviewSchemaPath));
const validateLongitudinalOverview = ajv.compile(longitudinalOverviewSchema);
for (const overview of [
  { availableRange: null, selectedRange: null, series: [] },
  syntheticLongitudinalOverview,
]) {
  if (!validateLongitudinalOverview(overview)) {
    throw new Error(
      longitudinalOverviewSchemaPath
        + " rejected a valid response: "
        + ajv.errorsText(validateLongitudinalOverview.errors),
    );
  }
}
for (const invalidOverview of [
  (() => {
    const value = structuredClone(syntheticLongitudinalOverview);
    value.series[0].seriesRef = " ";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLongitudinalOverview);
    value.series[0].days[1].activity.stepCount = "0";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLongitudinalOverview);
    value.series[0].days[1].recovery.beatToBeatIntervalMilliseconds = "1";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLongitudinalOverview);
    value.series[0].days[0].training.totalDurationMilliseconds = 3600000;
    return value;
  })(),
]) {
  if (validateLongitudinalOverview(invalidOverview)) {
    throw new Error(longitudinalOverviewSchemaPath + " accepted an invalid response");
  }
}

const longitudinalComparisonQuerySchemaPath =
  "schemas/longitudinal-comparison-query-v1.schema.json";
const longitudinalComparisonQuerySchema = JSON.parse(read(longitudinalComparisonQuerySchemaPath));
const validateLongitudinalComparisonQuery = ajv.compile(longitudinalComparisonQuerySchema);
const syntheticLongitudinalComparisonQuery = {
  baselineRange: { from: "2026-01-01", through: "2026-01-01" },
  comparisonRange: { from: "2026-01-02", through: "2026-01-02" },
};
if (!validateLongitudinalComparisonQuery(syntheticLongitudinalComparisonQuery)) {
  throw new Error(
    longitudinalComparisonQuerySchemaPath
      + " rejected its synthetic query: "
      + ajv.errorsText(validateLongitudinalComparisonQuery.errors),
  );
}
for (const query of [
  { baselineRange: syntheticLongitudinalComparisonQuery.baselineRange },
  { ...syntheticLongitudinalComparisonQuery, provider: "synthetic" },
  {
    ...syntheticLongitudinalComparisonQuery,
    comparisonRange: { from: "2026-02-30", through: "2026-03-01" },
  },
]) {
  if (validateLongitudinalComparisonQuery(query)) {
    throw new Error(longitudinalComparisonQuerySchemaPath + " accepted an invalid query");
  }
}

const syntheticLongitudinalComparison = {
  availableRange: syntheticLongitudinalOverview.availableRange,
  ...syntheticLongitudinalComparisonQuery,
  series: [{
    seriesRef: "synthetic-origin",
    activity: {
      baseline: longitudinalActivitySummary,
      comparison: longitudinalActivitySummary,
      totalStepChange: "1000",
      averageStepChange: "1000",
    },
    training: {
      baseline: longitudinalTrainingSummary,
      comparison: longitudinalTrainingSummary,
      sessionCountChange: "1",
      trainingDayChange: "1",
      durationMillisecondsChange: "3600000",
      distanceMetersChange: null,
      energyKilocaloriesChange: null,
    },
    sleep: {
      baseline: longitudinalSleepSummary,
      comparison: longitudinalSleepSummary,
      observedNightChange: "0",
      missingNightChange: "0",
      averageAsleepMillisecondsChange: "1000",
      averageInterruptionMillisecondsChange: null,
      averageEfficiencyPercentagePointChange: 1.5,
      averageOverallScoreChange: null,
      goalMetPercentagePointChange: null,
    },
    recovery: {
      baseline: syntheticRecoverySummary,
      comparison: syntheticRecoverySummary,
      observedNightChange: "0",
      missingNightChange: "0",
      averageBeatToBeatIntervalMillisecondsChange: "10",
      averageHeartRateVariabilityRmssdMillisecondsChange: null,
      averageBreathingIntervalMillisecondsChange: "-10",
      assessmentNightChange: "0",
      baselineNightChange: "0",
      guidanceNightChange: "0",
    },
  }],
};
const longitudinalComparisonSchemaPath = "schemas/longitudinal-comparison-v1.schema.json";
const longitudinalComparisonSchema = JSON.parse(read(longitudinalComparisonSchemaPath));
const validateLongitudinalComparison = ajv.compile(longitudinalComparisonSchema);
for (const comparison of [
  { availableRange: null, baselineRange: null, comparisonRange: null, series: [] },
  syntheticLongitudinalComparison,
]) {
  if (!validateLongitudinalComparison(comparison)) {
    throw new Error(
      longitudinalComparisonSchemaPath
        + " rejected a valid response: "
        + ajv.errorsText(validateLongitudinalComparison.errors),
    );
  }
}
for (const invalidComparison of [
  (() => {
    const value = structuredClone(syntheticLongitudinalComparison);
    value.series[0].training.durationMillisecondsChange = 1;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLongitudinalComparison);
    value.series[0].sleep.observedNightChange = "+1";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLongitudinalComparison);
    value.series[0].seriesRef = " ";
    return value;
  })(),
]) {
  if (validateLongitudinalComparison(invalidComparison)) {
    throw new Error(longitudinalComparisonSchemaPath + " accepted an invalid response");
  }
}

const updateChannelPath = "docs/data-formats/release/update-channel-v1.md";
const updateChannel = read(updateChannelPath);
for (const field of [
  "org.fitfreed.update-envelope",
  "org.fitfreed.update-channel",
  "private-alpha",
  "minisign-ed25519",
  "fitfreed.keyId",
  "fitfreed.payloadBase64",
  "fitfreed.signatureBase64",
  "sequence",
  "issuedAt",
  "expiresAt",
  "release.version",
  "release.publishedAt",
  "release.minimumSupportedVersion",
  "release.librarySchema.minimumReadableVersion",
  "release.librarySchema.maximumReadableVersion",
  "release.librarySchema.targetVersion",
  "release.releaseNotes.*",
  "en-US",
  "es-ES",
  "release.platforms.*.url",
  "release.platforms.*.size",
  "release.platforms.*.sha256",
  "release.platforms.*.tauriSignature",
  "withdrawnVersions",
  "withdrawnVersions.*.reason",
  "withdrawnVersions.*.guidance.*",
  "withdrawnVersions.*.replacementVersion",
]) {
  requireMention(updateChannel, field, updateChannelPath);
}

const updateChannelPayloadSchemaPath = "schemas/update-channel-payload-v1.schema.json";
const updateChannelPayloadSchema = JSON.parse(read(updateChannelPayloadSchemaPath));
const validateUpdateChannelPayload = ajv.compile(updateChannelPayloadSchema);
const syntheticUpdateChannelPayload = {
  format: "org.fitfreed.update-channel",
  schemaVersion: 1,
  channel: "private-alpha",
  sequence: 17,
  issuedAt: "2026-08-17T00:00:00Z",
  expiresAt: "2026-08-24T00:00:00Z",
  release: {
    version: "0.2.0-alpha.1",
    publishedAt: "2026-08-17T00:00:00Z",
    minimumSupportedVersion: "0.1.0",
    librarySchema: {
      minimumReadableVersion: 1,
      maximumReadableVersion: 8,
      targetVersion: 9,
    },
    releaseNotes: {
      "en-US": "Synthetic update contract.",
      "es-ES": "Contrato de actualización sintético.",
    },
    platforms: {
      "darwin-aarch64": {
        url: "https://updates.invalid/fitfreed-0.2.0-alpha.1-aarch64.app.tar.gz",
        size: 1048576,
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        tauriSignature: "U3ludGhldGljIFRhdXJpIHNpZ25hdHVyZQ==",
      },
    },
  },
  withdrawnVersions: [
    {
      version: "0.1.1",
      reason: "data-integrity",
      guidance: {
        "en-US": "Install the verified replacement.",
        "es-ES": "Instala la sustitución verificada.",
      },
      replacementVersion: "0.2.0-alpha.1",
    },
  ],
};
if (!validateUpdateChannelPayload(syntheticUpdateChannelPayload)) {
  throw new Error(
    updateChannelPayloadSchemaPath
      + " rejected its synthetic payload: "
      + ajv.errorsText(validateUpdateChannelPayload.errors),
  );
}
for (const invalidPayload of [
  { ...syntheticUpdateChannelPayload, sequence: 0 },
  { ...syntheticUpdateChannelPayload, channel: "stable" },
  (() => {
    const value = structuredClone(syntheticUpdateChannelPayload);
    delete value.release.releaseNotes["es-ES"];
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticUpdateChannelPayload);
    value.release.platforms["darwin-aarch64"].url =
      "http://updates.invalid/fitfreed.app.tar.gz";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticUpdateChannelPayload);
    value.release.platforms["darwin-aarch64"].sha256 = "not-a-digest";
    return value;
  })(),
  { ...syntheticUpdateChannelPayload, unexpectedPolicy: true },
]) {
  if (validateUpdateChannelPayload(invalidPayload)) {
    throw new Error(updateChannelPayloadSchemaPath + " accepted an invalid payload");
  }
}

const updateChannelEnvelopeSchemaPath = "schemas/update-channel-envelope-v1.schema.json";
const updateChannelEnvelopeSchema = JSON.parse(read(updateChannelEnvelopeSchemaPath));
const validateUpdateChannelEnvelope = ajv.compile(updateChannelEnvelopeSchema);
const syntheticUpdateChannelEnvelope = {
  version: syntheticUpdateChannelPayload.release.version,
  platforms: {
    "darwin-aarch64": {
      url: syntheticUpdateChannelPayload.release.platforms["darwin-aarch64"].url,
      signature:
        syntheticUpdateChannelPayload.release.platforms["darwin-aarch64"].tauriSignature,
    },
  },
  fitfreed: {
    format: "org.fitfreed.update-envelope",
    schemaVersion: 1,
    algorithm: "minisign-ed25519",
    keyId: "synthetic-contract-1",
    payloadBase64: Buffer.from(JSON.stringify(syntheticUpdateChannelPayload)).toString("base64"),
    signatureBase64: "U3ludGhldGljIG1ldGFkYXRhIHNpZ25hdHVyZQ==",
  },
};
if (!validateUpdateChannelEnvelope(syntheticUpdateChannelEnvelope)) {
  throw new Error(
    updateChannelEnvelopeSchemaPath
      + " rejected its synthetic envelope: "
      + ajv.errorsText(validateUpdateChannelEnvelope.errors),
  );
}
for (const invalidEnvelope of [
  (() => {
    const value = structuredClone(syntheticUpdateChannelEnvelope);
    delete value.fitfreed.signatureBase64;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticUpdateChannelEnvelope);
    value.platforms["darwin-aarch64"].url = "http://updates.invalid/fitfreed.app.tar.gz";
    return value;
  })(),
  { ...syntheticUpdateChannelEnvelope, notes: "Unsigned notes are forbidden." },
  (() => {
    const value = structuredClone(syntheticUpdateChannelEnvelope);
    value.fitfreed.algorithm = "none";
    return value;
  })(),
]) {
  if (validateUpdateChannelEnvelope(invalidEnvelope)) {
    throw new Error(updateChannelEnvelopeSchemaPath + " accepted an invalid envelope");
  }
}

const updateRecoveryPath = "docs/data-formats/release/update-recovery-v1.md";
const updateRecovery = read(updateRecoveryPath);
for (const field of [
  "org.fitfreed.update-recovery",
  "schemaVersion",
  "recoveryId",
  "phase",
  "preparedAt",
  "replacementProcess.processId",
  "replacementProcess.startedAtUnixSeconds",
  "replacementProcess.startedAtMicroseconds",
  "replacementProcess.launchNonce",
  "replacementProcess.confirmationDeadline",
  "source.version",
  "source.librarySchemaVersion",
  "source.applicationPath",
  "source.libraryPath",
  "target.version",
  "target.librarySchemaVersion",
  "target.trustedSequence",
  "target.trustedPayloadSha256",
  "target.packageSha256",
  "applicationBackup.relativePath",
  "applicationBackup.treeSha256",
  "libraryBackup.relativePath",
  "libraryBackup.sizeBytes",
  "libraryBackup.sha256",
  "prepared",
  "replacement-started",
  "replacement-installed",
  "launching",
  "confirmed",
  "recovering",
  "recovered",
  "recovery-failed",
]) {
  requireMention(updateRecovery, field, updateRecoveryPath);
}

const updateRecoverySchemaPath = "schemas/update-recovery-v1.schema.json";
const updateRecoverySchema = JSON.parse(read(updateRecoverySchemaPath));
const validateUpdateRecovery = ajv.compile(updateRecoverySchema);
const syntheticUpdateRecovery = {
  format: "org.fitfreed.update-recovery",
  schemaVersion: 1,
  recoveryId: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  phase: "prepared",
  preparedAt: "2026-08-17T08:00:00Z",
  replacementProcess: null,
  source: {
    version: "0.1.0",
    librarySchemaVersion: 9,
    applicationPath: "/Applications/FitFreed.app",
    libraryPath: "/synthetic/fitfreed/fitfreed.sqlite",
  },
  target: {
    version: "0.2.0-alpha.1",
    librarySchemaVersion: 10,
    trustedSequence: 17,
    trustedPayloadSha256:
      "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
    packageSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  },
  applicationBackup: {
    relativePath: "previous/FitFreed.app",
    treeSha256: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
  },
  libraryBackup: {
    relativePath: "previous/fitfreed.sqlite",
    sizeBytes: 1048576,
    sha256: "3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012",
  },
};
if (!validateUpdateRecovery(syntheticUpdateRecovery)) {
  throw new Error(
    updateRecoverySchemaPath
      + " rejected its synthetic manifest: "
      + ajv.errorsText(validateUpdateRecovery.errors),
  );
}
for (const invalidRecovery of [
  { ...syntheticUpdateRecovery, phase: "installed" },
  { ...syntheticUpdateRecovery, replacementProcess: { processId: 42 } },
  { ...syntheticUpdateRecovery, recoveryId: "not-a-digest" },
  (() => {
    const value = structuredClone(syntheticUpdateRecovery);
    value.source.applicationPath = "relative/FitFreed.app";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticUpdateRecovery);
    value.applicationBackup.relativePath = "../../FitFreed.app";
    return value;
  })(),
  { ...syntheticUpdateRecovery, arbitraryPath: "/tmp/other" },
]) {
  if (validateUpdateRecovery(invalidRecovery)) {
    throw new Error(updateRecoverySchemaPath + " accepted an invalid manifest");
  }
}

const indexPath = "docs/data-formats/README.md";
const index = read(indexPath);
for (const contractPath of [
  canonicalPath,
  sleepCanonicalPath,
  mappingPath,
  sleepMappingPath,
  activityOverviewPath,
  activityOverviewV2Path,
  activityComparisonPath,
  trainingOverviewPath,
  trainingComparisonPath,
  sleepOverviewPath,
  sleepComparisonPath,
  recoveryOverviewPath,
  recoveryComparisonPath,
  longitudinalPath,
  updateChannelPath,
  updateRecoveryPath,
  ...persistencePaths,
]) {
  const relativeContract = path.relative(path.dirname(indexPath), contractPath);
  if (!index.includes(relativeContract)) {
    throw new Error(`${indexPath} does not index ${relativeContract}`);
  }
}

process.stdout.write(
  JSON.stringify({
    schemaVersion,
    sourceAdapterVersion,
    migrations,
    persistencePaths,
    activityOverviewSchemas: [
      activityOverviewSchemaPath,
      activityOverviewQueryV2SchemaPath,
      activityOverviewV2SchemaPath,
    ],
    activityComparisonSchemas: [
      activityComparisonQuerySchemaPath,
      activityComparisonSchemaPath,
    ],
    trainingOverviewSchemas: [
      trainingOverviewQuerySchemaPath,
      trainingOverviewSchemaPath,
    ],
    trainingComparisonSchemas: [
      trainingComparisonQuerySchemaPath,
      trainingComparisonSchemaPath,
    ],
    sleepOverviewSchemas: [
      sleepOverviewQuerySchemaPath,
      sleepOverviewSchemaPath,
      sleepDetailQuerySchemaPath,
      sleepDetailSchemaPath,
    ],
    sleepComparisonSchemas: [
      sleepComparisonQuerySchemaPath,
      sleepComparisonSchemaPath,
    ],
    recoveryOverviewSchemas: [
      recoveryOverviewQuerySchemaPath,
      recoveryOverviewSchemaPath,
      recoveryDetailQuerySchemaPath,
      recoveryDetailSchemaPath,
    ],
    recoveryComparisonSchemas: [
      recoveryComparisonQuerySchemaPath,
      recoveryComparisonSchemaPath,
    ],
    longitudinalOverviewSchemas: [
      longitudinalOverviewQuerySchemaPath,
      longitudinalOverviewSchemaPath,
    ],
    longitudinalComparisonSchemas: [
      longitudinalComparisonQuerySchemaPath,
      longitudinalComparisonSchemaPath,
    ],
    updateChannelSchemas: [
      updateChannelEnvelopeSchemaPath,
      updateChannelPayloadSchemaPath,
    ],
    updateRecoverySchema: updateRecoverySchemaPath,
    canonicalFields: 56,
    mappingFields: 75,
  }) + "\n",
);
