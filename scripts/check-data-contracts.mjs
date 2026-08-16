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
  "polar-flow-daily-activity@1",
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

const mappingPath = "docs/data-formats/mappings/polar-flow-daily-activity.md";
const mapping = read(mappingPath);
requireMention(mapping, sourceAdapterVersion, mappingPath);
for (const sourceField of ["date", "summary", "summary.stepCount"]) {
  requireMention(mapping, sourceField, mappingPath);
}
for (const targetField of ["originId", "localDate", "stepCount"]) {
  requireMention(mapping, targetField, mappingPath);
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

const indexPath = "docs/data-formats/README.md";
const index = read(indexPath);
for (const contractPath of [
  canonicalPath,
  mappingPath,
  activityOverviewPath,
  ...persistencePaths,
]) {
  const relativeContract = path.relative(path.dirname(indexPath), contractPath);
  if (!index.includes(relativeContract)) {
    throw new Error(`${indexPath} does not index ${relativeContract}`);
  }
}

process.stdout.write(
  `${JSON.stringify({ schemaVersion, sourceAdapterVersion, migrations, persistencePaths, activityOverviewSchema: activityOverviewSchemaPath, canonicalFields: 3, mappingFields: 6 })}\n`,
);
