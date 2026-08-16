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
      const columnMatch = line.match(/^ {4}([a-z_][a-z0-9_]*) (?:BLOB|INTEGER|TEXT)\b/);
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
  "polar-flow-mapping-set@1",
  "polar-flow-daily-activity@1",
  "polar-flow-training-session@1",
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

const indexPath = "docs/data-formats/README.md";
const index = read(indexPath);
for (const contractPath of [
  canonicalPath,
  mappingPath,
  activityOverviewPath,
  activityOverviewV2Path,
  activityComparisonPath,
  ...persistencePaths,
]) {
  const relativeContract = path.relative(path.dirname(indexPath), contractPath);
  if (!index.includes(relativeContract)) {
    throw new Error(`${indexPath} does not index ${relativeContract}`);
  }
}

process.stdout.write(
  `${JSON.stringify({ schemaVersion, sourceAdapterVersion, migrations, persistencePaths, activityOverviewSchemas: [activityOverviewSchemaPath, activityOverviewQueryV2SchemaPath, activityOverviewV2SchemaPath], activityComparisonSchemas: [activityComparisonQuerySchemaPath, activityComparisonSchemaPath], canonicalFields: 3, mappingFields: 6 })}\n`,
);
