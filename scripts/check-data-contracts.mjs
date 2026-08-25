import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  publicUpdateUrl,
  validatePublicOriginConfiguration,
} from "./public-origin.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function requireMention(content, value, documentPath) {
  if (!content.includes(`\`${value}\``)) {
    throw new Error(`${documentPath} does not document ${value}`);
  }
}

const publicOriginConfigurationPath = "release/public-origin.json";
const publicOriginConfiguration = JSON.parse(read(publicOriginConfigurationPath));
validatePublicOriginConfiguration(publicOriginConfiguration);
const publicOriginDocumentPath = "docs/data-formats/release/public-origin-v1.md";
const publicOriginDocument = read(publicOriginDocumentPath);
for (const field of [
  "org.fitfreed.public-origin",
  "format",
  "schemaVersion",
  "canonicalOrigin",
  publicOriginConfiguration.canonicalOrigin,
]) {
  requireMention(publicOriginDocument, field, publicOriginDocumentPath);
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
  "polar-flow-archive@7",
  "polar-flow-archive@8",
  "polar-flow-archive@9",
  "polar-flow-archive@10",
  "polar-flow-archive@11",
  "polar-flow-mapping-set@1",
  "polar-flow-mapping-set@2",
  "polar-flow-mapping-set@3",
  "polar-flow-mapping-set@4",
  "polar-flow-mapping-set@5",
  "polar-flow-mapping-set@6",
  "polar-flow-daily-activity@1",
  "polar-flow-training-session@1",
  "polar-flow-training-session@2",
  "polar-flow-training-session@3",
  "polar-flow-training-session@4",
  "polar-flow-training-session@5",
  "polar-flow-training-session@6",
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
  "enrich",
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

const trainingStructureDomainPath =
  "src-tauri/crates/fitfreed-domain/src/training_session.rs";
const trainingStructureDomain = read(trainingStructureDomainPath);
const trainingStructureCanonicalPath =
  "docs/data-formats/canonical/training-session-structure.md";
const trainingStructureCanonical = read(trainingStructureCanonicalPath);
for (const structure of [
  "TrainingLap",
  "TrainingPause",
  "TrainingExercise",
  "TrainingSessionStructure",
  "TrainingSessionRecord",
]) {
  const structureMatch = trainingStructureDomain.match(
    new RegExp(`pub struct ${structure} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!structureMatch) {
    throw new Error(`${trainingStructureDomainPath} has no ${structure}`);
  }
  for (const fieldMatch of structureMatch[1].matchAll(/pub ([a-z_]+):/g)) {
    const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    requireMention(trainingStructureCanonical, camelCase, trainingStructureCanonicalPath);
  }
}
for (const contractValue of ["manual", "automatic", "enrich"]) {
  requireMention(trainingStructureCanonical, contractValue, trainingStructureCanonicalPath);
}

const trainingRouteCanonicalPath =
  "docs/data-formats/canonical/training-session-route.md";
const trainingRouteCanonical = read(trainingRouteCanonicalPath);
for (const structure of [
  "TrainingRoutePoint",
  "TrainingRoute",
  "TrainingRoutes",
  "TrainingExerciseRouteAssessment",
  "TrainingSessionRouteAssessment",
]) {
  const structureMatch = trainingStructureDomain.match(
    new RegExp(`pub struct ${structure} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!structureMatch) {
    throw new Error(`${trainingStructureDomainPath} has no ${structure}`);
  }
  for (const fieldMatch of structureMatch[1].matchAll(/pub ([a-z_]+):/g)) {
    const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    requireMention(trainingRouteCanonical, camelCase, trainingRouteCanonicalPath);
  }
}
for (const contractValue of ["primary", "transition", "enrich"]) {
  requireMention(trainingRouteCanonical, contractValue, trainingRouteCanonicalPath);
}

const trainingSignalCanonicalPath =
  "docs/data-formats/canonical/training-session-signal.md";
const trainingSignalCanonical = read(trainingSignalCanonicalPath);
for (const structure of [
  "TrainingSignalSample",
  "TrainingSignalSeries",
  "TrainingSignals",
  "TrainingExerciseSignalAssessment",
  "TrainingSessionSignalAssessment",
]) {
  const structureMatch = trainingStructureDomain.match(
    new RegExp(`pub struct ${structure} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!structureMatch) {
    throw new Error(`${trainingStructureDomainPath} has no ${structure}`);
  }
  for (const fieldMatch of structureMatch[1].matchAll(/pub ([a-z_]+):/g)) {
    const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    requireMention(trainingSignalCanonical, camelCase, trainingSignalCanonicalPath);
  }
}
for (const contractValue of [
  "heart-rate",
  "speed",
  "distance",
  "altitude",
  "cadence",
  "temperature",
  "left-crank-power",
  "beats-per-minute",
  "kilometers-per-hour",
  "meters",
  "rotations-per-minute",
  "degrees-celsius",
  "watts",
  "primary",
  "transition",
  "enrich",
]) {
  requireMention(trainingSignalCanonical, contractValue, trainingSignalCanonicalPath);
}

const trainingZoneCanonicalPath =
  "docs/data-formats/canonical/training-session-zone.md";
const trainingZoneCanonical = read(trainingZoneCanonicalPath);
for (const structure of [
  "TrainingZone",
  "TrainingZoneGroup",
  "TrainingZones",
  "TrainingExerciseZoneAssessment",
  "TrainingSessionZoneAssessment",
]) {
  const structureMatch = trainingStructureDomain.match(
    new RegExp(`pub struct ${structure} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!structureMatch) {
    throw new Error(`${trainingStructureDomainPath} has no ${structure}`);
  }
  for (const fieldMatch of structureMatch[1].matchAll(/pub ([a-z_]+):/g)) {
    const camelCase = fieldMatch[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    requireMention(trainingZoneCanonical, camelCase, trainingZoneCanonicalPath);
  }
}
for (const contractValue of [
  "heart-rate",
  "speed",
  "power",
  "beats-per-minute",
  "kilometers-per-hour",
  "watts",
  "source-recorded",
  "enrich",
]) {
  requireMention(trainingZoneCanonical, contractValue, trainingZoneCanonicalPath);
}

const segmentCriterionDomainPath =
  "src-tauri/crates/fitfreed-domain/src/segment_criterion.rs";
const segmentCriterionDomain = read(segmentCriterionDomainPath);
const segmentCriterionCanonicalPath =
  "docs/data-formats/canonical/segment-criterion.md";
const segmentCriterionCanonical = read(segmentCriterionCanonicalPath);
for (const contractValue of [
  "SegmentCriterion",
  "criterionRef",
  "title",
  "definition",
  "authorship",
  "evaluationVersion",
  "revision",
  "equal-elapsed-time",
  "equal-distance",
  "heart-rate-zone",
  "manual-boundaries",
  "applicable",
  "missing-prerequisite",
  "ambiguous-prerequisite",
  "incomplete-evidence",
  "outside-session",
  "too-many-segments",
  "fitfreed-derived",
]) {
  requireMention(segmentCriterionCanonical, contractValue, segmentCriterionCanonicalPath);
}
for (const implementationValue of [
  "SEGMENT_EVALUATION_VERSION",
  "MAX_MANUAL_BOUNDARIES",
  "MINIMUM_HEART_RATE_BPM",
  "MAXIMUM_HEART_RATE_BPM",
]) {
  if (!segmentCriterionDomain.includes(implementationValue)) {
    throw new Error(`${segmentCriterionDomainPath} has no ${implementationValue}`);
  }
}

const sportClassificationDomainPath =
  "src-tauri/crates/fitfreed-domain/src/sport_classification.rs";
const sportClassificationDomain = read(sportClassificationDomainPath);
const sportClassificationCanonicalPath =
  "docs/data-formats/canonical/sport-classification.md";
const sportClassificationCanonical = read(sportClassificationCanonicalPath);
for (const field of [
  "originId",
  "sourceSportRef",
  "sportRef",
  "state",
  "canonicalFamily",
  "displayLabel",
  "authorship",
  "revision",
  "unknown",
  "classified",
  "unavailable",
  "user",
]) {
  requireMention(sportClassificationCanonical, field, sportClassificationCanonicalPath);
}
const sportFamilyMethod = sportClassificationDomain.match(
  /pub const fn as_code\(self\)[\s\S]*?\n    }\n/,
);
if (!sportFamilyMethod) {
  throw new Error(`${sportClassificationDomainPath} has no SportFamily::as_code`);
}
const sportFamilyCodes = [...sportFamilyMethod[0].matchAll(/=> "([a-z-]+)"/g)]
  .map((match) => match[1]);
if (sportFamilyCodes.length === 0 || new Set(sportFamilyCodes).size !== sportFamilyCodes.length) {
  throw new Error(`${sportClassificationDomainPath} has invalid family codes`);
}
for (const family of sportFamilyCodes) {
  requireMention(sportClassificationCanonical, family, sportClassificationCanonicalPath);
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
  "polar-flow-mapping-set@4",
  "polar-flow-mapping-set@5",
  "polar-flow-mapping-set@6",
  "polar-flow-training-session@4",
  "polar-flow-training-session@5",
  "polar-flow-training-session@6",
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
  "exercises[].identifier.id",
  "exercises[].created",
  "exercises[].modified",
  "exercises[].startTime",
  "exercises[].stopTime",
  "exercises[].timezoneOffsetMinutes",
  "exercises[].durationMillis",
  "exercises[].distanceMeters",
  "exercises[].calories",
  "exercises[].sport.id",
  "exercises[].laps.laps",
  "exercises[].laps.autoLaps",
  "exercises[].pauseTimes",
  "exercises[].routes",
  "exercises[].routes.route",
  "exercises[].routes.transitionRoute",
  ".wayPoints",
  ".wayPoints[].latitude",
  ".wayPoints[].longitude",
  ".wayPoints[].altitude",
  ".wayPoints[].elapsedMillis",
  "exercises[].samples",
  "exercises[].samples.samples",
  "exercises[].samples.transitionSamples",
  ".type",
  ".intervalMillis",
  ".values[]",
  "NaN",
  "HEART_RATE",
  "SPEED",
  "DISTANCE",
  "ALTITUDE",
  "CADENCE",
  "TEMPERATURE",
  "LEFT_CRANK_CURRENT_POWER",
  "exercises[].zones",
  "ZONE_TYPE_HEART_RATE",
  "ZONE_TYPE_SPEED",
  "ZONE_TYPE_POWER",
  "ZONE_TYPE_FIT_FAT",
  "lowerLimit",
  "higherLimit",
  "inZone",
  "muscleLoad",
  "splitTimeMillis",
  "endTime",
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
  "TrainingSessionStructure",
  "exerciseId",
  "ordinal",
  "manualLaps",
  "automaticLaps",
  "pauses",
  "splitTimeMilliseconds",
  "TrainingSessionRouteAssessment",
  "TrainingSessionSignalAssessment",
  "TrainingSessionZoneAssessment",
  "signals",
  "intervalMilliseconds",
  "value",
  "unsupportedPrimarySeriesCount",
  "unsupportedTransitionSeriesCount",
  "unsupportedGroupCount",
  "lowerLimit",
  "higherLimit",
  "timeInZoneMilliseconds",
  "muscleLoad",
  "latitudeDegrees",
  "longitudeDegrees",
  "altitudeMeters",
  "elapsedMilliseconds",
  "primary",
  "transition",
  "enrich",
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

const segmentationSchemaPath = "schemas/training-session-segmentation-v1.schema.json";
const validateSegmentation = ajv.compile(JSON.parse(read(segmentationSchemaPath)));
const syntheticCriterion = {
  criterionRef: `criterion-${"c".repeat(64)}`,
  title: "Synthetic five-minute blocks",
  definition: { kind: "equal-elapsed-time", spanMilliseconds: "300000" },
  authorship: "user",
  evaluationVersion: 1,
  revision: 1,
};
const syntheticSegmentation = {
  snapshotRef: `training-snapshot-${"a".repeat(64)}`,
  sessionRef: `session-${"b".repeat(64)}`,
  availableCriteria: [syntheticCriterion],
  exercises: [{
    exerciseRef: `exercise-${"d".repeat(64)}`,
    ordinal: 0,
    durationMilliseconds: "600000",
    appliedCriteria: [{
      criterion: syntheticCriterion,
      ordinal: 0,
      applicability: "applicable",
      requiredMeasurement: null,
      hasEvidenceGaps: false,
      segments: [{
        ordinal: 0,
        startedAtElapsedMilliseconds: "0",
        endedAtElapsedMilliseconds: "300000",
        attribution: "fitfreed-derived",
      }],
    }],
  }],
};
if (!validateSegmentation(syntheticSegmentation)) {
  throw new Error(
    `${segmentationSchemaPath} rejected its synthetic contract: ${ajv.errorsText(validateSegmentation.errors)}`,
  );
}
for (const invalidSegmentation of [
  { ...syntheticSegmentation, provider: "must-not-cross-the-boundary" },
  { ...syntheticSegmentation, snapshotRef: "training-snapshot-private" },
  {
    ...syntheticSegmentation,
    availableCriteria: [{ ...syntheticCriterion, authorship: "source" }],
  },
  {
    ...syntheticSegmentation,
    exercises: [{
      ...syntheticSegmentation.exercises[0],
      appliedCriteria: [{
        ...syntheticSegmentation.exercises[0].appliedCriteria[0],
        segments: Array.from({ length: 251 }, (_, ordinal) => ({
          ordinal,
          startedAtElapsedMilliseconds: String(ordinal),
          endedAtElapsedMilliseconds: String(ordinal + 1),
          attribution: "fitfreed-derived",
        })),
      }],
    }],
  },
]) {
  if (validateSegmentation(invalidSegmentation)) {
    throw new Error(`${segmentationSchemaPath} accepted an invalid result`);
  }
}

const segmentationCommandContracts = [
  [
    "schemas/training-session-segmentation-query-v1.schema.json",
    { sessionRef: syntheticSegmentation.sessionRef, snapshotRef: syntheticSegmentation.snapshotRef },
    { sessionRef: syntheticSegmentation.sessionRef, snapshotRef: syntheticSegmentation.snapshotRef, source: "private" },
  ],
  [
    "schemas/training-segment-criterion-create-v1.schema.json",
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      exerciseRef: syntheticSegmentation.exercises[0].exerciseRef,
      title: syntheticCriterion.title,
      definition: syntheticCriterion.definition,
    },
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      exerciseRef: syntheticSegmentation.exercises[0].exerciseRef,
      title: syntheticCriterion.title,
      definition: { kind: "equal-elapsed-time", spanMilliseconds: "0" },
    },
  ],
  [
    "schemas/training-segment-criterion-update-v1.schema.json",
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      criterionRef: syntheticCriterion.criterionRef,
      expectedRevision: 1,
      title: syntheticCriterion.title,
      definition: syntheticCriterion.definition,
    },
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      criterionRef: syntheticCriterion.criterionRef,
      expectedRevision: 0,
      title: syntheticCriterion.title,
      definition: syntheticCriterion.definition,
    },
  ],
  [
    "schemas/training-segment-criterion-mutation-v1.schema.json",
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      exerciseRef: syntheticSegmentation.exercises[0].exerciseRef,
      criterionRef: syntheticCriterion.criterionRef,
    },
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      exerciseRef: syntheticSegmentation.exercises[0].exerciseRef,
      criterionRef: "criterion-private",
    },
  ],
  [
    "schemas/training-segment-criterion-move-v1.schema.json",
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      exerciseRef: syntheticSegmentation.exercises[0].exerciseRef,
      criterionRef: syntheticCriterion.criterionRef,
      direction: "earlier",
    },
    {
      sessionRef: syntheticSegmentation.sessionRef,
      snapshotRef: syntheticSegmentation.snapshotRef,
      exerciseRef: syntheticSegmentation.exercises[0].exerciseRef,
      criterionRef: syntheticCriterion.criterionRef,
      direction: "first",
    },
  ],
];
for (const [schemaPath, validValue, invalidValue] of segmentationCommandContracts) {
  const validate = ajv.compile(JSON.parse(read(schemaPath)));
  if (!validate(validValue)) {
    throw new Error(`${schemaPath} rejected its synthetic contract: ${ajv.errorsText(validate.errors)}`);
  }
  if (validate(invalidValue)) {
    throw new Error(`${schemaPath} accepted an invalid contract`);
  }
}

const trainingSessionRangeCanonicalPath =
  "docs/data-formats/canonical/training-session-range-v3.md";
const trainingSessionRangeCanonical = read(trainingSessionRangeCanonicalPath);
for (const value of [
  "rangeRef",
  "sessionRef",
  "exerciseRef",
  "coordinate",
  "exercise-elapsed",
  "route-elapsed",
  "routeRef",
  "signal-elapsed",
  "signalRef",
  "legacy-session-elapsed",
  "title",
  "startedAtElapsedMilliseconds",
  "endedAtElapsedMilliseconds",
  "evidenceRevision",
  "authorship",
  "state",
  "revision",
  "user",
  "current",
  "review-required",
]) {
  requireMention(trainingSessionRangeCanonical, value, trainingSessionRangeCanonicalPath);
}

const trainingSessionRangeReadModelPath =
  "docs/data-formats/insights/training-session-range-v3.md";
const trainingSessionRangeReadModel = read(trainingSessionRangeReadModelPath);
for (const value of [
  "query_training_session_ranges",
  "create_training_session_range",
  "rename_training_session_range",
  "adjust_training_session_range",
  "remove_training_session_range",
  "snapshotRef",
  "sessionRef",
  "sessionDurationMilliseconds",
  "evidenceRevision",
  "exercises",
  "exerciseRef",
  "coordinates",
  "coordinate",
  "scope",
  "routeRef",
  "signalRef",
  "maximumElapsedMilliseconds",
  "ranges",
  "rangeRef",
  "title",
  "startedAtElapsedMilliseconds",
  "endedAtElapsedMilliseconds",
  "authorship",
  "state",
  "revision",
]) {
  requireMention(trainingSessionRangeReadModel, value, trainingSessionRangeReadModelPath);
}

const syntheticTrainingSessionRange = {
  rangeRef: `range-${"c".repeat(64)}`,
  exerciseRef: `exercise-${"e".repeat(64)}`,
  coordinate: {
    scope: "route-elapsed",
    routeRef: `route-${"f".repeat(64)}`,
  },
  title: "Bridge to bend",
  startedAtElapsedMilliseconds: "1000",
  endedAtElapsedMilliseconds: "2000",
  evidenceRevision: `range-evidence-${"d".repeat(64)}`,
  authorship: "user",
  state: "current",
  revision: 3,
};
const syntheticTrainingSessionRanges = {
  snapshotRef: `training-snapshot-${"a".repeat(64)}`,
  sessionRef: `session-${"b".repeat(64)}`,
  sessionDurationMilliseconds: "600000",
  evidenceRevision: syntheticTrainingSessionRange.evidenceRevision,
  exercises: [
    {
      exerciseRef: syntheticTrainingSessionRange.exerciseRef,
      ordinal: 0,
      coordinates: [
        {
          coordinate: { scope: "exercise-elapsed" },
          maximumElapsedMilliseconds: "300000",
        },
        {
          coordinate: syntheticTrainingSessionRange.coordinate,
          maximumElapsedMilliseconds: "2000",
        },
        {
          coordinate: {
            scope: "signal-elapsed",
            signalRef: `signal-${"1".repeat(64)}`,
          },
          maximumElapsedMilliseconds: "3000",
        },
      ],
    },
  ],
  ranges: [syntheticTrainingSessionRange],
};
const trainingSessionRangesSchemaPath = "schemas/training-session-ranges-v3.schema.json";
const validateTrainingSessionRanges = ajv.compile(
  JSON.parse(read(trainingSessionRangesSchemaPath)),
);

const maximumSignedI64 = 9_223_372_036_854_775_807n;

function exactElapsed(value, positive = false) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = BigInt(value);
  if (parsed > maximumSignedI64 || (positive && parsed === 0n)) return null;
  return parsed;
}

function rangeCoordinateKey(coordinate, allowLegacy) {
  if (!coordinate || typeof coordinate !== "object") return null;
  switch (coordinate.scope) {
    case "exercise-elapsed":
      return Object.keys(coordinate).length === 1 ? "exercise-elapsed" : null;
    case "route-elapsed":
      return typeof coordinate.routeRef === "string"
        ? `route-elapsed:${coordinate.routeRef}`
        : null;
    case "signal-elapsed":
      return typeof coordinate.signalRef === "string"
        ? `signal-elapsed:${coordinate.signalRef}`
        : null;
    case "legacy-session-elapsed":
      return allowLegacy && Object.keys(coordinate).length === 1
        ? "legacy-session-elapsed"
        : null;
    default:
      return null;
  }
}

function trainingSessionRangesAreSemanticallyValid(result) {
  if (exactElapsed(result.sessionDurationMilliseconds) === null) return false;
  const exerciseContexts = new Map();
  const ordinals = new Set();
  for (const exercise of result.exercises) {
    if (exerciseContexts.has(exercise.exerciseRef) || ordinals.has(exercise.ordinal)) return false;
    ordinals.add(exercise.ordinal);
    const coordinates = new Map();
    for (const context of exercise.coordinates) {
      const key = rangeCoordinateKey(context.coordinate, false);
      const maximum = exactElapsed(context.maximumElapsedMilliseconds);
      if (key === null || maximum === null || coordinates.has(key)) return false;
      coordinates.set(key, maximum);
    }
    if (!coordinates.has("exercise-elapsed")) return false;
    exerciseContexts.set(exercise.exerciseRef, coordinates);
  }
  const rangeRefs = new Set();
  for (const range of result.ranges) {
    const start = exactElapsed(range.startedAtElapsedMilliseconds);
    const end = exactElapsed(range.endedAtElapsedMilliseconds, true);
    const coordinateKey = rangeCoordinateKey(range.coordinate, true);
    if (start === null || end === null || start >= end || coordinateKey === null
      || rangeRefs.has(range.rangeRef) || range.evidenceRevision !== result.evidenceRevision) {
      return false;
    }
    rangeRefs.add(range.rangeRef);
    if (coordinateKey === "legacy-session-elapsed") {
      if (range.exerciseRef !== null || range.state !== "review-required") return false;
      continue;
    }
    if (range.exerciseRef === null) return false;
    if (range.state === "current") {
      const maximum = exerciseContexts.get(range.exerciseRef)?.get(coordinateKey);
      if (maximum === undefined || end > maximum) return false;
    }
  }
  return true;
}

function validTrainingSessionRanges(value) {
  return validateTrainingSessionRanges(value) && trainingSessionRangesAreSemanticallyValid(value);
}

if (!validTrainingSessionRanges(syntheticTrainingSessionRanges)) {
  throw new Error(
    `${trainingSessionRangesSchemaPath} rejected its synthetic contract: ${ajv.errorsText(validateTrainingSessionRanges.errors)}`,
  );
}
for (const invalidRanges of [
  { ...syntheticTrainingSessionRanges, provider: "must-not-cross-the-boundary" },
  {
    ...syntheticTrainingSessionRanges,
    ranges: [{ ...syntheticTrainingSessionRange, authorship: "source" }],
  },
  {
    ...syntheticTrainingSessionRanges,
    ranges: Array.from({ length: 1_001 }, () => syntheticTrainingSessionRange),
  },
  {
    ...syntheticTrainingSessionRanges,
    evidenceRevision: "range-evidence-private",
  },
  {
    ...syntheticTrainingSessionRanges,
    ranges: [{ ...syntheticTrainingSessionRange, exerciseRef: null }],
  },
  {
    ...syntheticTrainingSessionRanges,
    exercises: [{ ...syntheticTrainingSessionRanges.exercises[0], exerciseRef: "exercise-private" }],
  },
  {
    ...syntheticTrainingSessionRanges,
    ranges: [{
      ...syntheticTrainingSessionRange,
      coordinate: {
        scope: "route-elapsed",
        signalRef: `signal-${"1".repeat(64)}`,
      },
    }],
  },
  {
    ...syntheticTrainingSessionRanges,
    exercises: [{
      ...syntheticTrainingSessionRanges.exercises[0],
      coordinates: syntheticTrainingSessionRanges.exercises[0].coordinates.filter(
        (context) => context.coordinate.scope !== "route-elapsed",
      ),
    }],
  },
  {
    ...syntheticTrainingSessionRanges,
    exercises: [{
      ...syntheticTrainingSessionRanges.exercises[0],
      coordinates: syntheticTrainingSessionRanges.exercises[0].coordinates.map((context) => (
        context.coordinate.scope === "route-elapsed"
          ? { ...context, maximumElapsedMilliseconds: "9223372036854775808" }
          : context
      )),
    }],
  },
  {
    ...syntheticTrainingSessionRanges,
    ranges: [{
      ...syntheticTrainingSessionRange,
      coordinate: { scope: "legacy-session-elapsed" },
      exerciseRef: null,
      state: "current",
    }],
  },
]) {
  if (validTrainingSessionRanges(invalidRanges)) {
    throw new Error(`${trainingSessionRangesSchemaPath} accepted an invalid result`);
  }
}
const legacyTrainingSessionRanges = {
  ...syntheticTrainingSessionRanges,
  ranges: [
    {
      ...syntheticTrainingSessionRange,
      exerciseRef: null,
      coordinate: { scope: "legacy-session-elapsed" },
      state: "review-required",
    },
  ],
};
if (!validTrainingSessionRanges(legacyTrainingSessionRanges)) {
  throw new Error(
    `${trainingSessionRangesSchemaPath} rejected preserved legacy evidence: ${ajv.errorsText(validateTrainingSessionRanges.errors)}`,
  );
}

const trainingSessionRangeCommandContracts = [
  [
    "schemas/training-session-ranges-query-v1.schema.json",
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: null,
    },
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      provider: "private",
    },
  ],
  [
    "schemas/training-session-range-create-v3.schema.json",
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      exerciseRef: syntheticTrainingSessionRange.exerciseRef,
      coordinate: syntheticTrainingSessionRange.coordinate,
      title: syntheticTrainingSessionRange.title,
      startedAtElapsedMilliseconds: syntheticTrainingSessionRange.startedAtElapsedMilliseconds,
      endedAtElapsedMilliseconds: syntheticTrainingSessionRange.endedAtElapsedMilliseconds,
    },
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      exerciseRef: syntheticTrainingSessionRange.exerciseRef,
      coordinate: {
        scope: "route-elapsed",
        signalRef: `signal-${"1".repeat(64)}`,
      },
      title: syntheticTrainingSessionRange.title,
      startedAtElapsedMilliseconds: syntheticTrainingSessionRange.startedAtElapsedMilliseconds,
      endedAtElapsedMilliseconds: syntheticTrainingSessionRange.endedAtElapsedMilliseconds,
    },
  ],
  [
    "schemas/training-session-range-rename-v1.schema.json",
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      rangeRef: syntheticTrainingSessionRange.rangeRef,
      expectedRevision: syntheticTrainingSessionRange.revision,
      title: "Bridge effort",
    },
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      rangeRef: syntheticTrainingSessionRange.rangeRef,
      expectedRevision: 0,
      title: "Bridge effort",
    },
  ],
  [
    "schemas/training-session-range-adjust-v3.schema.json",
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      rangeRef: syntheticTrainingSessionRange.rangeRef,
      expectedRevision: syntheticTrainingSessionRange.revision,
      exerciseRef: syntheticTrainingSessionRange.exerciseRef,
      coordinate: syntheticTrainingSessionRange.coordinate,
      startedAtElapsedMilliseconds: "1500",
      endedAtElapsedMilliseconds: "2500",
    },
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      rangeRef: syntheticTrainingSessionRange.rangeRef,
      expectedRevision: syntheticTrainingSessionRange.revision,
      exerciseRef: syntheticTrainingSessionRange.exerciseRef,
      coordinate: { scope: "legacy-session-elapsed" },
      startedAtElapsedMilliseconds: "1500",
      endedAtElapsedMilliseconds: "0",
    },
  ],
  [
    "schemas/training-session-range-remove-v1.schema.json",
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      rangeRef: syntheticTrainingSessionRange.rangeRef,
      expectedRevision: syntheticTrainingSessionRange.revision,
    },
    {
      sessionRef: syntheticTrainingSessionRanges.sessionRef,
      snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
      rangeRef: "range-private",
      expectedRevision: syntheticTrainingSessionRange.revision,
    },
  ],
];
for (const [schemaPath, validValue, invalidValue] of trainingSessionRangeCommandContracts) {
  const validate = ajv.compile(JSON.parse(read(schemaPath)));
  if (!validate(validValue)) {
    throw new Error(
      `${schemaPath} rejected its synthetic contract: ${ajv.errorsText(validate.errors)}`,
    );
  }
  if (validate(invalidValue)) {
    throw new Error(`${schemaPath} accepted an invalid contract`);
  }
}

const trainingSessionRangeSummaryPath =
  "docs/data-formats/insights/training-session-range-summary-v1.md";
const trainingSessionRangeSummary = read(trainingSessionRangeSummaryPath);
for (const value of [
  "query_training_session_range_summary",
  "training-session-range-summary-query-v1.schema.json",
  "training-session-range-summary-v1.schema.json",
  "snapshotRef",
  "sessionRef",
  "rangeRef",
  "expectedRangeRevision",
  "evidenceRevision",
  "sourceProvider",
  "coordinateEvidence",
  "elapsedDurationMilliseconds",
  "movingDurationMilliseconds",
  "pausedDurationMilliseconds",
  "distance",
  "direction",
  "measurements",
  "boundaries",
  "coverage",
  "sourceRanges",
  "independentEvidence",
  "limitations",
  "exercise-elapsed",
  "route-elapsed",
  "signal-elapsed",
  "unavailable",
  "invalid-training-session-range-summary",
  "training-session-range-not-found",
  "training-session-range-summary-changed",
  "training-session-range-summary-failed",
]) {
  requireMention(trainingSessionRangeSummary, value, trainingSessionRangeSummaryPath);
}

const trainingSessionRangeSummaryQuerySchemaPath =
  "schemas/training-session-range-summary-query-v1.schema.json";
const validateTrainingSessionRangeSummaryQuery = ajv.compile(
  JSON.parse(read(trainingSessionRangeSummaryQuerySchemaPath)),
);
const syntheticTrainingSessionRangeSummaryQuery = {
  sessionRef: syntheticTrainingSessionRanges.sessionRef,
  snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
  rangeRef: syntheticTrainingSessionRange.rangeRef,
  expectedRangeRevision: syntheticTrainingSessionRange.revision,
};
if (!validateTrainingSessionRangeSummaryQuery(syntheticTrainingSessionRangeSummaryQuery)) {
  throw new Error(
    `${trainingSessionRangeSummaryQuerySchemaPath} rejected its synthetic contract: ${ajv.errorsText(validateTrainingSessionRangeSummaryQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionRangeSummaryQuery, expectedRangeRevision: 0 },
  { ...syntheticTrainingSessionRangeSummaryQuery, snapshotRef: null },
  { ...syntheticTrainingSessionRangeSummaryQuery, sourceSessionId: "private" },
]) {
  if (validateTrainingSessionRangeSummaryQuery(invalidQuery)) {
    throw new Error(`${trainingSessionRangeSummaryQuerySchemaPath} accepted an invalid query`);
  }
}

for (const dependencyPath of [
  "schemas/training-session-ranges-v3.schema.json",
  "schemas/training-session-search-v1.schema.json",
]) {
  const dependency = JSON.parse(read(dependencyPath));
  if (!ajv.getSchema(dependency.$id)) ajv.addSchema(dependency);
}
const trainingSessionRangeSummarySchemaPath =
  "schemas/training-session-range-summary-v1.schema.json";
const validateTrainingSessionRangeSummary = ajv.compile(
  JSON.parse(read(trainingSessionRangeSummarySchemaPath)),
);
const routeRangeLocation = (ordinal, elapsedMilliseconds) => ({
  kind: "route-point",
  evidenceRef: syntheticTrainingSessionRange.coordinate.routeRef,
  ordinal,
  elapsedMilliseconds,
});
const syntheticTrainingSessionRangeSummary = {
  snapshotRef: syntheticTrainingSessionRanges.snapshotRef,
  sessionRef: syntheticTrainingSessionRanges.sessionRef,
  evidenceRevision: syntheticTrainingSessionRange.evidenceRevision,
  sourceProvider: "polar-flow",
  range: syntheticTrainingSessionRange,
  exercise: {
    exerciseRef: syntheticTrainingSessionRange.exerciseRef,
    ordinal: 0,
    durationMilliseconds: "600000",
    distanceMeters: 10000,
    sport: {
      sportRef: null,
      state: "unavailable",
      classification: null,
    },
  },
  coordinateEvidence: {
    scope: "route-elapsed",
    routeRef: syntheticTrainingSessionRange.coordinate.routeRef,
    kind: "primary",
  },
  elapsedDurationMilliseconds: "1000",
  movingDurationMilliseconds: null,
  pausedDurationMilliseconds: null,
  distance: { meters: 123.5, coverage: "complete" },
  direction: { initialBearingDegrees: 90, cardinal: "east" },
  measurements: [{
    kind: "altitude",
    unit: "meters",
    minimum: 10,
    maximum: 12,
    average: 11,
    availableEvidenceCount: 2,
    missingEvidenceCount: 0,
    startBoundaryValue: null,
    endBoundaryValue: null,
  }],
  boundaries: {
    start: {
      elapsedMilliseconds: syntheticTrainingSessionRange.startedAtElapsedMilliseconds,
      state: "exact",
      exactMatchCount: 1,
      exactMatches: [routeRangeLocation(
        1,
        syntheticTrainingSessionRange.startedAtElapsedMilliseconds,
      )],
      preceding: routeRangeLocation(0, "0"),
      following: routeRangeLocation(
        2,
        syntheticTrainingSessionRange.endedAtElapsedMilliseconds,
      ),
    },
    end: {
      elapsedMilliseconds: syntheticTrainingSessionRange.endedAtElapsedMilliseconds,
      state: "exact",
      exactMatchCount: 1,
      exactMatches: [routeRangeLocation(
        2,
        syntheticTrainingSessionRange.endedAtElapsedMilliseconds,
      )],
      preceding: routeRangeLocation(
        1,
        syntheticTrainingSessionRange.startedAtElapsedMilliseconds,
      ),
      following: null,
    },
  },
  coverage: {
    state: "complete",
    recordedEvidenceCount: 3,
    selectedEvidenceCount: 2,
    availableEvidenceCount: 2,
    missingEvidenceCount: 0,
    missingElapsedEvidenceCount: 0,
    missingIntervals: [],
    omittedMissingIntervalCount: 0,
  },
  sourceRanges: [],
  independentEvidence: {
    sourceRangeCount: 0,
    routeCoordinateCount: 1,
    signalCoordinateCount: 1,
  },
  limitations: [
    "moving-time-unavailable",
    "paused-time-unavailable",
    "unaligned-signal-evidence",
  ],
};

function rangeLocationMatchesCoordinate(location, summary) {
  switch (summary.coordinateEvidence.scope) {
    case "exercise-elapsed":
      if (location.kind === "exercise") {
        return summary.exercise !== null
          && location.evidenceRef === summary.exercise.exerciseRef;
      }
      return location.kind === "manual-lap" || location.kind === "automatic-lap";
    case "route-elapsed":
      return location.kind === "route-point"
        && location.evidenceRef === summary.coordinateEvidence.routeRef;
    case "signal-elapsed":
      return location.kind === "signal-sample"
        && location.evidenceRef === summary.coordinateEvidence.signalRef;
    case "unavailable":
      return false;
    default:
      return false;
  }
}

function validRangeBoundary(boundary, summary) {
  const target = exactElapsed(boundary.elapsedMilliseconds);
  if (target === null || boundary.exactMatchCount < boundary.exactMatches.length) return false;
  const hasPreceding = boundary.preceding !== null;
  const hasFollowing = boundary.following !== null;
  const stateMatches = boundary.state === "exact"
    ? boundary.exactMatchCount > 0
    : boundary.state === "between-evidence"
      ? boundary.exactMatchCount === 0 && hasPreceding && hasFollowing
      : boundary.state === "outside-recorded-evidence"
        ? boundary.exactMatchCount === 0 && hasPreceding !== hasFollowing
        : boundary.exactMatchCount === 0 && !hasPreceding && !hasFollowing;
  if (!stateMatches) return false;
  for (const match of boundary.exactMatches) {
    if (exactElapsed(match.elapsedMilliseconds) !== target
      || !rangeLocationMatchesCoordinate(match, summary)) return false;
  }
  if (boundary.preceding !== null) {
    const preceding = exactElapsed(boundary.preceding.elapsedMilliseconds);
    if (preceding === null || preceding >= target
      || !rangeLocationMatchesCoordinate(boundary.preceding, summary)) return false;
  }
  if (boundary.following !== null) {
    const following = exactElapsed(boundary.following.elapsedMilliseconds);
    if (following === null || following <= target
      || !rangeLocationMatchesCoordinate(boundary.following, summary)) return false;
  }
  return true;
}

function rangeSummaryIsUnavailable(summary) {
  return summary.coordinateEvidence.scope === "unavailable"
    && summary.coverage.state === "unavailable"
    && summary.distance === null
    && summary.direction === null
    && summary.measurements.length === 0
    && summary.sourceRanges.length === 0
    && summary.boundaries.start.state === "no-evidence"
    && summary.boundaries.end.state === "no-evidence"
    && summary.limitations.includes("coordinate-unavailable");
}

function trainingSessionRangeSummaryIsSemanticallyValid(summary, query) {
  const start = exactElapsed(summary.range.startedAtElapsedMilliseconds);
  const end = exactElapsed(summary.range.endedAtElapsedMilliseconds, true);
  const duration = exactElapsed(summary.elapsedDurationMilliseconds);
  if (start === null || end === null || duration === null || end - start !== duration) return false;
  if ((summary.movingDurationMilliseconds !== null
      && exactElapsed(summary.movingDurationMilliseconds) === null)
    || (summary.pausedDurationMilliseconds !== null
      && exactElapsed(summary.pausedDurationMilliseconds) === null)
    || (summary.exercise !== null
      && exactElapsed(summary.exercise.durationMilliseconds) === null)) return false;
  if (summary.snapshotRef !== query.snapshotRef
    || summary.sessionRef !== query.sessionRef
    || summary.range.rangeRef !== query.rangeRef
    || summary.range.revision !== query.expectedRangeRevision
    || summary.boundaries.start.elapsedMilliseconds !== summary.range.startedAtElapsedMilliseconds
    || summary.boundaries.end.elapsedMilliseconds !== summary.range.endedAtElapsedMilliseconds
    || !validRangeBoundary(summary.boundaries.start, summary)
    || !validRangeBoundary(summary.boundaries.end, summary)) {
    return false;
  }
  if (summary.coverage.availableEvidenceCount + summary.coverage.missingEvidenceCount
    !== summary.coverage.selectedEvidenceCount
    || summary.coverage.selectedEvidenceCount > summary.coverage.recordedEvidenceCount
    || summary.coverage.missingElapsedEvidenceCount > summary.coverage.selectedEvidenceCount) {
    return false;
  }
  if (summary.coverage.state === "complete"
    && (summary.boundaries.start.state !== "exact"
      || summary.boundaries.end.state !== "exact"
      || summary.coverage.missingEvidenceCount > 0
      || summary.coverage.missingElapsedEvidenceCount > 0)) return false;
  if (summary.coverage.state === "empty"
    && summary.coverage.selectedEvidenceCount !== 0) return false;
  if (summary.coverage.missingIntervals.length
      + summary.coverage.omittedMissingIntervalCount
    > summary.coverage.missingEvidenceCount) return false;
  if ((summary.coverage.missingIntervals.length > 0
      || summary.coverage.omittedMissingIntervalCount > 0)
    && summary.coordinateEvidence.scope !== "signal-elapsed") return false;
  for (const interval of summary.coverage.missingIntervals) {
    const missingStart = exactElapsed(interval.startedAtElapsedMilliseconds);
    const missingEnd = exactElapsed(interval.endedAtElapsedMilliseconds, true);
    if (missingStart === null || missingEnd === null || missingStart >= missingEnd
      || missingStart < start || missingEnd > end) return false;
  }
  for (const measurement of summary.measurements) {
    if (measurement.minimum > measurement.average
      || measurement.average > measurement.maximum
      || measurement.availableEvidenceCount + measurement.missingEvidenceCount
        !== summary.coverage.selectedEvidenceCount) {
      return false;
    }
  }
  if (summary.sourceRanges.length > summary.independentEvidence.sourceRangeCount) return false;
  const coordinateKey = rangeCoordinateKey(summary.range.coordinate, true);
  const evidenceKey = rangeCoordinateKey(summary.coordinateEvidence, false);
  if (summary.range.exerciseRef === null) {
    return summary.range.state === "review-required"
      && summary.exercise === null
      && coordinateKey === "legacy-session-elapsed"
      && rangeSummaryIsUnavailable(summary);
  }
  if (summary.exercise === null) {
    return summary.range.state === "review-required" && rangeSummaryIsUnavailable(summary);
  }
  if (summary.exercise.exerciseRef !== summary.range.exerciseRef) return false;
  if (summary.coordinateEvidence.scope === "unavailable") {
    return summary.range.state === "review-required" && rangeSummaryIsUnavailable(summary);
  }
  if (summary.coordinateEvidence.scope === "exercise-elapsed"
    && exactElapsed(summary.coordinateEvidence.maximumElapsedMilliseconds) === null) return false;
  if (summary.coordinateEvidence.scope === "signal-elapsed"
    && exactElapsed(summary.coordinateEvidence.intervalMilliseconds, true) === null) return false;
  if (summary.coordinateEvidence.scope !== "exercise-elapsed"
    && summary.sourceRanges.length > 0) return false;
  for (const sourceRange of summary.sourceRanges) {
    const sourceStart = exactElapsed(sourceRange.startedAtElapsedMilliseconds);
    const sourceEnd = exactElapsed(sourceRange.endedAtElapsedMilliseconds, true);
    if (sourceStart === null || sourceEnd === null || sourceStart >= sourceEnd
      || sourceStart >= end || sourceEnd <= start) return false;
    const relation = sourceStart === start && sourceEnd === end
      ? "exact"
      : sourceStart <= start && sourceEnd >= end
        ? "source-contains-range"
        : start <= sourceStart && end >= sourceEnd
          ? "range-contains-source"
          : "overlap";
    if (sourceRange.relation !== relation) return false;
  }
  if (summary.coordinateEvidence.scope === "route-elapsed") {
    if (summary.measurements.some((measurement) => (
      measurement.kind !== "altitude" || measurement.unit !== "meters"
    ))) return false;
  } else if (summary.coordinateEvidence.scope === "signal-elapsed") {
    if (summary.direction !== null || summary.measurements.some((measurement) => (
      measurement.kind !== summary.coordinateEvidence.kind
      || measurement.unit !== summary.coordinateEvidence.unit
    ))) return false;
  } else if (summary.direction !== null || summary.measurements.length > 0) return false;
  return coordinateKey === evidenceKey
    && summary.coverage.state !== "unavailable"
    && (summary.range.state !== "current"
      || summary.evidenceRevision === summary.range.evidenceRevision);
}

function validTrainingSessionRangeSummary(value) {
  return validateTrainingSessionRangeSummary(value)
    && trainingSessionRangeSummaryIsSemanticallyValid(
      value,
      syntheticTrainingSessionRangeSummaryQuery,
    );
}

if (!validTrainingSessionRangeSummary(syntheticTrainingSessionRangeSummary)) {
  throw new Error(
    `${trainingSessionRangeSummarySchemaPath} rejected its synthetic contract: ${ajv.errorsText(validateTrainingSessionRangeSummary.errors)}`,
  );
}
const unavailableRangeSummary = {
  ...syntheticTrainingSessionRangeSummary,
  range: {
    ...syntheticTrainingSessionRangeSummary.range,
    evidenceRevision: `range-evidence-${"8".repeat(64)}`,
    state: "review-required",
  },
  coordinateEvidence: { scope: "unavailable" },
  distance: null,
  direction: null,
  measurements: [],
  boundaries: {
    start: {
      elapsedMilliseconds: syntheticTrainingSessionRange.startedAtElapsedMilliseconds,
      state: "no-evidence",
      exactMatchCount: 0,
      exactMatches: [],
      preceding: null,
      following: null,
    },
    end: {
      elapsedMilliseconds: syntheticTrainingSessionRange.endedAtElapsedMilliseconds,
      state: "no-evidence",
      exactMatchCount: 0,
      exactMatches: [],
      preceding: null,
      following: null,
    },
  },
  coverage: {
    state: "unavailable",
    recordedEvidenceCount: 0,
    selectedEvidenceCount: 0,
    availableEvidenceCount: 0,
    missingEvidenceCount: 0,
    missingElapsedEvidenceCount: 0,
    missingIntervals: [],
    omittedMissingIntervalCount: 0,
  },
  sourceRanges: [],
  limitations: [
    "coordinate-unavailable",
    "moving-time-unavailable",
    "paused-time-unavailable",
  ],
};
if (!validTrainingSessionRangeSummary(unavailableRangeSummary)) {
  throw new Error(
    `${trainingSessionRangeSummarySchemaPath} rejected preserved review evidence: ${ajv.errorsText(validateTrainingSessionRangeSummary.errors)}`,
  );
}
const missingExerciseRangeSummary = {
  ...unavailableRangeSummary,
  exercise: null,
};
if (!validTrainingSessionRangeSummary(missingExerciseRangeSummary)) {
  throw new Error(
    `${trainingSessionRangeSummarySchemaPath} rejected a preserved missing exercise: ${ajv.errorsText(validateTrainingSessionRangeSummary.errors)}`,
  );
}
for (const invalidSummary of [
  { ...syntheticTrainingSessionRangeSummary, sourceSessionId: "private" },
  { ...syntheticTrainingSessionRangeSummary, elapsedDurationMilliseconds: "999" },
  {
    ...syntheticTrainingSessionRangeSummary,
    coordinateEvidence: {
      scope: "signal-elapsed",
      signalRef: `signal-${"9".repeat(64)}`,
      ordinal: 0,
      role: "primary",
      kind: "heart-rate",
      unit: "beats-per-minute",
      intervalMilliseconds: "1000",
    },
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    coordinateEvidence: { scope: "unavailable" },
  },
  {
    ...unavailableRangeSummary,
    distance: { meters: 1, coverage: "partial" },
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    coverage: {
      ...syntheticTrainingSessionRangeSummary.coverage,
      selectedEvidenceCount: 3,
    },
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    boundaries: {
      ...syntheticTrainingSessionRangeSummary.boundaries,
      start: {
        ...syntheticTrainingSessionRangeSummary.boundaries.start,
        exactMatches: [routeRangeLocation(1, "999")],
      },
    },
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    boundaries: {
      ...syntheticTrainingSessionRangeSummary.boundaries,
      start: {
        ...syntheticTrainingSessionRangeSummary.boundaries.start,
        state: "between-evidence",
        exactMatchCount: 0,
        exactMatches: [],
        preceding: null,
      },
    },
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    boundaries: {
      ...syntheticTrainingSessionRangeSummary.boundaries,
      start: {
        ...syntheticTrainingSessionRangeSummary.boundaries.start,
        exactMatches: [{
          kind: "signal-sample",
          evidenceRef: `signal-${"9".repeat(64)}`,
          ordinal: 1,
          elapsedMilliseconds: syntheticTrainingSessionRange.startedAtElapsedMilliseconds,
        }],
      },
    },
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    coverage: {
      ...syntheticTrainingSessionRangeSummary.coverage,
      state: "partial",
      missingIntervals: [{
        startedAtElapsedMilliseconds: "9223372036854775808",
        endedAtElapsedMilliseconds: "9223372036854775809",
      }],
    },
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    measurements: [{
      ...syntheticTrainingSessionRangeSummary.measurements[0],
      average: 13,
    }],
  },
  {
    ...syntheticTrainingSessionRangeSummary,
    measurements: [{
      ...syntheticTrainingSessionRangeSummary.measurements[0],
      missingEvidenceCount: 1,
    }],
  },
]) {
  if (validTrainingSessionRangeSummary(invalidSummary)) {
    throw new Error(`${trainingSessionRangeSummarySchemaPath} accepted an invalid result`);
  }
}

const sourceAcquisitionGuidePath = "docs/data-formats/guidance/source-acquisition-guide-v1.md";
const sourceAcquisitionGuide = read(sourceAcquisitionGuidePath);
for (const field of [
  "schemaVersion",
  "sourceId",
  "guideVersion",
  "verifiedOn",
  "expectedArchive",
  "instructionKeys",
  "constraintKeys",
  "troubleshootingKeys",
  "officialLinks",
  "purpose",
  "locale",
  "url",
  "account",
  "instructions",
  "zip",
]) {
  requireMention(sourceAcquisitionGuide, field, sourceAcquisitionGuidePath);
}
const sourceAcquisitionGuideSchemaPath = "schemas/source-acquisition-guide-v1.schema.json";
const sourceAcquisitionGuideSchema = JSON.parse(read(sourceAcquisitionGuideSchemaPath));
const validateSourceAcquisitionGuide = ajv.compile(sourceAcquisitionGuideSchema);
const syntheticSourceAcquisitionGuide = {
  schemaVersion: 1,
  sourceId: "synthetic-source",
  guideVersion: "synthetic-source-acquisition@1",
  verifiedOn: "2026-01-15",
  expectedArchive: "zip",
  instructionKeys: ["open-account", "request-export", "download-archive"],
  constraintKeys: ["delivery-time-varies"],
  troubleshootingKeys: ["email-not-received"],
  officialLinks: [
    { purpose: "account", locale: null, url: "https://account.example.test/" },
    {
      purpose: "instructions",
      locale: "en-US",
      url: "https://support.example.test/en/export",
    },
  ],
};
if (!validateSourceAcquisitionGuide(syntheticSourceAcquisitionGuide)) {
  throw new Error(
    `${sourceAcquisitionGuideSchemaPath} rejected its synthetic contract: ${ajv.errorsText(validateSourceAcquisitionGuide.errors)}`,
  );
}
for (const invalidGuide of [
  { ...syntheticSourceAcquisitionGuide, schemaVersion: 2 },
  {
    ...syntheticSourceAcquisitionGuide,
    instructionKeys: ["open-account", "open-account"],
  },
  { ...syntheticSourceAcquisitionGuide, verifiedOn: "2026-02-30" },
  {
    ...syntheticSourceAcquisitionGuide,
    officialLinks: [{ purpose: "account", locale: null, url: "http://account.example.test/" }],
  },
  {
    ...syntheticSourceAcquisitionGuide,
    officialLinks: [{ purpose: "account", locale: null, url: "https://account.example.test/" }],
  },
  {
    ...syntheticSourceAcquisitionGuide,
    officialLinks: [
      syntheticSourceAcquisitionGuide.officialLinks[1],
      syntheticSourceAcquisitionGuide.officialLinks[1],
    ],
  },
  {
    ...syntheticSourceAcquisitionGuide,
    officialLinks: [{
      purpose: "instructions",
      locale: "en-US",
      url: `https://support.example.test/${"a".repeat(2049)}`,
    }],
  },
]) {
  if (validateSourceAcquisitionGuide(invalidGuide)) {
    throw new Error(`${sourceAcquisitionGuideSchemaPath} accepted an invalid guide`);
  }
}
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

const trainingSportsPath = "docs/data-formats/insights/training-sports-v1.md";
const trainingSports = read(trainingSportsPath);
for (const field of [
  "query_training_sports",
  "save_training_sport_classification",
  "originCount",
  "sessionCount",
  "sports",
  "sportRef",
  "sourceIndex",
  "state",
  "classification",
  "canonicalFamily",
  "displayLabel",
  "authorship",
  "revision",
  "firstLocalDate",
  "lastLocalDate",
  "coverage",
  "totalDurationMilliseconds",
  "distanceSessionCount",
  "heartRateSessionCount",
  "unknown",
  "classified",
  "unavailable",
  "expectedRevision",
  "changed",
  "unchanged",
  "invalid-sport-classification",
  "sport-classification-conflict",
  "sport-classification-failed",
]) {
  requireMention(trainingSports, field, trainingSportsPath);
}
for (const family of sportFamilyCodes) requireMention(trainingSports, family, trainingSportsPath);

const trainingSportsSchemaPath = "schemas/training-sports-v1.schema.json";
const trainingSportsSchema = JSON.parse(read(trainingSportsSchemaPath));
const schemaFamilyCodes = trainingSportsSchema.$defs.family.enum;
if (JSON.stringify(schemaFamilyCodes) !== JSON.stringify(sportFamilyCodes)) {
  throw new Error(`${trainingSportsSchemaPath} family codes differ from the domain`);
}
const validateTrainingSports = ajv.compile(trainingSportsSchema);
const syntheticUnknownSport = {
  sportRef: "sport-unknown",
  sourceIndex: 2,
  state: "unknown",
  classification: {
    canonicalFamily: null,
    displayLabel: null,
    authorship: null,
    revision: 0,
  },
  firstLocalDate: "2025-01-02",
  lastLocalDate: "2026-08-17",
  coverage: {
    sessionCount: 3,
    totalDurationMilliseconds: "7200000",
    distanceSessionCount: 2,
    heartRateSessionCount: 1,
  },
};
const syntheticClassifiedSport = {
  ...structuredClone(syntheticUnknownSport),
  sportRef: "sport-cycling",
  sourceIndex: 1,
  state: "classified",
  classification: {
    canonicalFamily: "cycling",
    displayLabel: "Gravel cycling",
    authorship: "user",
    revision: 4,
  },
};
const syntheticUnavailableSport = {
  ...structuredClone(syntheticUnknownSport),
  sportRef: null,
  sourceIndex: 1,
  state: "unavailable",
  classification: null,
  coverage: {
    sessionCount: 1,
    totalDurationMilliseconds: "1800000",
    distanceSessionCount: 0,
    heartRateSessionCount: 0,
  },
};
const syntheticTrainingSports = {
  originCount: 2,
  sessionCount: 7,
  sports: [
    syntheticClassifiedSport,
    syntheticUnknownSport,
    syntheticUnavailableSport,
  ],
};
if (!validateTrainingSports(syntheticTrainingSports)) {
  throw new Error(
    `${trainingSportsSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingSports.errors)}`,
  );
}
for (const invalidOverview of [
  {
    ...structuredClone(syntheticTrainingSports),
    provider: "must-not-cross-the-boundary",
  },
  (() => {
    const value = structuredClone(syntheticTrainingSports);
    value.sports[0].classification.canonicalFamily = "provider-cycling";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSports);
    value.sports[0].classification.canonicalFamily = null;
    value.sports[0].classification.displayLabel = null;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSports);
    value.sports[2].sportRef = "invented-sport";
    return value;
  })(),
]) {
  if (validateTrainingSports(invalidOverview)) {
    throw new Error(`${trainingSportsSchemaPath} accepted an invalid response`);
  }
}

const sportClassificationSaveSchemaPath =
  "schemas/sport-classification-save-v1.schema.json";
const sportClassificationSaveSchema = JSON.parse(read(sportClassificationSaveSchemaPath));
const validateSportClassificationSave = ajv.compile(sportClassificationSaveSchema);
const syntheticSportClassificationSave = {
  request: {
    sportRef: "sport-cycling",
    expectedRevision: 4,
    canonicalFamily: "cycling",
    displayLabel: "Gravel cycling",
  },
};
for (const request of [
  syntheticSportClassificationSave,
  {
    request: {
      ...syntheticSportClassificationSave.request,
      canonicalFamily: null,
      displayLabel: null,
    },
  },
]) {
  if (!validateSportClassificationSave(request)) {
    throw new Error(
      `${sportClassificationSaveSchemaPath} rejected a valid request: ${ajv.errorsText(validateSportClassificationSave.errors)}`,
    );
  }
}
for (const invalidRequest of [
  {},
  {
    request: {
      ...syntheticSportClassificationSave.request,
      canonicalFamily: "provider-cycling",
    },
  },
  {
    request: {
      ...syntheticSportClassificationSave.request,
      displayLabel: " leading space",
    },
  },
  {
    ...syntheticSportClassificationSave,
    sourceSportRef: "must-not-cross-the-boundary",
  },
]) {
  if (validateSportClassificationSave(invalidRequest)) {
    throw new Error(`${sportClassificationSaveSchemaPath} accepted an invalid request`);
  }
}

const savedSportClassificationSchemaPath =
  "schemas/saved-sport-classification-v1.schema.json";
const savedSportClassificationSchema = JSON.parse(read(savedSportClassificationSchemaPath));
const validateSavedSportClassification = ajv.compile(savedSportClassificationSchema);
const syntheticSavedSportClassification = {
  outcome: "changed",
  overview: syntheticTrainingSports,
};
if (!validateSavedSportClassification(syntheticSavedSportClassification)) {
  throw new Error(
    `${savedSportClassificationSchemaPath} rejected a valid result: ${ajv.errorsText(validateSavedSportClassification.errors)}`,
  );
}
if (validateSavedSportClassification({
  ...syntheticSavedSportClassification,
  outcome: "saved",
})) {
  throw new Error(`${savedSportClassificationSchemaPath} accepted an invalid result`);
}

const trainingSessionSearchPath =
  "docs/data-formats/insights/training-session-search-v1.md";
const trainingSessionSearch = read(trainingSessionSearchPath);
for (const field of [
  "query_training_sessions",
  "from",
  "through",
  "sportRefs",
  "requiredMeasurements",
  "text",
  "sort",
  "offset",
  "limit",
  "snapshotRef",
  "started-desc",
  "started-asc",
  "duration-desc",
  "distance-desc",
  "availableRange",
  "totalCount",
  "nextOffset",
  "summaries",
  "sessions",
  "sessionRef",
  "sourceIndex",
  "startedAtLocal",
  "stoppedAtLocal",
  "utcOffsetMinutes",
  "durationMilliseconds",
  "distanceMeters",
  "energyKilocalories",
  "averageHeartRateBpm",
  "maximumHeartRateBpm",
  "exerciseCount",
  "sportRef",
  "state",
  "classification",
  "trainingDays",
  "sessionCount",
  "totalDurationMilliseconds",
  "distanceSessionCount",
  "totalDistanceMeters",
  "energySessionCount",
  "totalEnergyKilocalories",
  "heartRateSessionCount",
  "invalid-training-session-search",
  "training-session-search-changed",
  "training-session-search-failed",
  "query_training_session_calendar",
  "query_training_session_selection",
  "month",
  "days",
  "localDate",
  "sessionRefs",
]) {
  requireMention(trainingSessionSearch, field, trainingSessionSearchPath);
}

const trainingSessionSearchQuerySchemaPath =
  "schemas/training-session-search-query-v1.schema.json";
const trainingSessionSearchQuerySchema = JSON.parse(read(trainingSessionSearchQuerySchemaPath));
const validateTrainingSessionSearchQuery = ajv.compile(trainingSessionSearchQuerySchema);
const sportRefDigest = `sport-${"c".repeat(64)}`;
const snapshotRefDigest = `training-snapshot-${"a".repeat(64)}`;
const sessionRefDigest = `session-${"b".repeat(64)}`;
const syntheticTrainingSessionSearchQuery = {
  from: "2025-01-01",
  through: null,
  sportRefs: [sportRefDigest],
  requiredMeasurements: ["distance", "heart-rate"],
  text: "Trail",
  sort: "distance-desc",
  offset: 0,
  limit: 25,
  snapshotRef: null,
};
for (const query of [
  syntheticTrainingSessionSearchQuery,
  {
    ...syntheticTrainingSessionSearchQuery,
    from: null,
    sportRefs: [],
    requiredMeasurements: [],
    text: null,
    sort: "started-desc",
    snapshotRef: snapshotRefDigest,
  },
]) {
  if (!validateTrainingSessionSearchQuery(query)) {
    throw new Error(
      `${trainingSessionSearchQuerySchemaPath} rejected a valid query: ${ajv.errorsText(validateTrainingSessionSearchQuery.errors)}`,
    );
  }
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionSearchQuery, sportRefs: ["source-sport"] },
  { ...syntheticTrainingSessionSearchQuery, requiredMeasurements: ["distance", "distance"] },
  { ...syntheticTrainingSessionSearchQuery, text: " padded " },
  { ...syntheticTrainingSessionSearchQuery, sort: "provider-order" },
  { ...syntheticTrainingSessionSearchQuery, snapshotRef: "revision-1" },
  { ...syntheticTrainingSessionSearchQuery, provider: "must-not-cross-the-boundary" },
]) {
  if (validateTrainingSessionSearchQuery(invalidQuery)) {
    throw new Error(`${trainingSessionSearchQuerySchemaPath} accepted an invalid query`);
  }
}

const trainingSessionSearchSchemaPath = "schemas/training-session-search-v1.schema.json";
const trainingSessionSearchSchema = JSON.parse(read(trainingSessionSearchSchemaPath));
if (JSON.stringify(trainingSessionSearchSchema.$defs.family.enum) !== JSON.stringify(sportFamilyCodes)) {
  throw new Error(`${trainingSessionSearchSchemaPath} family codes differ from the domain`);
}
const validateTrainingSessionSearch =
  ajv.getSchema(trainingSessionSearchSchema.$id) ?? ajv.compile(trainingSessionSearchSchema);
const syntheticTrainingSessionSearch = {
  availableRange: { from: "2024-01-01", through: "2026-08-18" },
  snapshotRef: snapshotRefDigest,
  totalCount: 1,
  offset: 0,
  limit: 25,
  nextOffset: null,
  summaries: [{
    sourceIndex: 1,
    trainingDays: 1,
    sessionCount: 1,
    totalDurationMilliseconds: "3600000",
    distanceSessionCount: 1,
    totalDistanceMeters: 10000.5,
    energySessionCount: 1,
    totalEnergyKilocalories: "650",
    heartRateSessionCount: 1,
  }],
  sessions: [{
    sessionRef: sessionRefDigest,
    sourceIndex: 1,
    startedAtLocal: "2026-08-18T07:30:00",
    stoppedAtLocal: "2026-08-18T08:30:00",
    utcOffsetMinutes: 120,
    durationMilliseconds: "3600000",
    distanceMeters: 10000.5,
    energyKilocalories: "650",
    averageHeartRateBpm: "145",
    maximumHeartRateBpm: "175",
    exerciseCount: 1,
    sport: {
      sportRef: sportRefDigest,
      state: "classified",
      classification: {
        canonicalFamily: "running",
        displayLabel: "Trail running",
        authorship: "user",
        revision: 1,
      },
    },
  }],
};
if (!validateTrainingSessionSearch(syntheticTrainingSessionSearch)) {
  throw new Error(
    `${trainingSessionSearchSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingSessionSearch.errors)}`,
  );
}
for (const invalidResponse of [
  { ...structuredClone(syntheticTrainingSessionSearch), sourceSessionId: "hidden" },
  (() => {
    const value = structuredClone(syntheticTrainingSessionSearch);
    value.sessions[0].sessionRef = "discovery-session";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionSearch);
    value.sessions[0].sport.state = "unavailable";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionSearch);
    value.sessions[0].durationMilliseconds = "01";
    return value;
  })(),
]) {
  if (validateTrainingSessionSearch(invalidResponse)) {
    throw new Error(`${trainingSessionSearchSchemaPath} accepted an invalid response`);
  }
}

const trainingSessionCalendarQuerySchemaPath =
  "schemas/training-session-calendar-query-v1.schema.json";
const validateTrainingSessionCalendarQuery = ajv.compile(
  JSON.parse(read(trainingSessionCalendarQuerySchemaPath)),
);
const syntheticTrainingSessionCalendarQuery = {
  month: "2026-08",
  from: "2026-01-01",
  through: null,
  sportRefs: [sportRefDigest],
  requiredMeasurements: ["distance", "heart-rate"],
  text: "Trail",
  snapshotRef: snapshotRefDigest,
};
if (!validateTrainingSessionCalendarQuery(syntheticTrainingSessionCalendarQuery)) {
  throw new Error(
    `${trainingSessionCalendarQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingSessionCalendarQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionCalendarQuery, month: "2026-13" },
  { ...syntheticTrainingSessionCalendarQuery, sportRefs: ["source-sport"] },
  { ...syntheticTrainingSessionCalendarQuery, provider: "must-not-cross-the-boundary" },
]) {
  if (validateTrainingSessionCalendarQuery(invalidQuery)) {
    throw new Error(`${trainingSessionCalendarQuerySchemaPath} accepted an invalid query`);
  }
}

const trainingSessionCalendarSchemaPath = "schemas/training-session-calendar-v1.schema.json";
const validateTrainingSessionCalendar = ajv.compile(
  JSON.parse(read(trainingSessionCalendarSchemaPath)),
);
const syntheticTrainingSessionCalendar = {
  availableRange: syntheticTrainingSessionSearch.availableRange,
  snapshotRef: snapshotRefDigest,
  month: "2026-08",
  days: [{
    localDate: "2026-08-18",
    sourceIndex: 1,
    sessionCount: 1,
    totalDurationMilliseconds: "3600000",
    distanceSessionCount: 1,
    totalDistanceMeters: 10000.5,
    heartRateSessionCount: 1,
  }],
};
if (!validateTrainingSessionCalendar(syntheticTrainingSessionCalendar)) {
  throw new Error(
    `${trainingSessionCalendarSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingSessionCalendar.errors)}`,
  );
}
for (const invalidResponse of [
  { ...syntheticTrainingSessionCalendar, month: "August" },
  { ...syntheticTrainingSessionCalendar, originId: "must-not-cross-the-boundary" },
  {
    ...syntheticTrainingSessionCalendar,
    days: [{ ...syntheticTrainingSessionCalendar.days[0], sessionCount: 0 }],
  },
]) {
  if (validateTrainingSessionCalendar(invalidResponse)) {
    throw new Error(`${trainingSessionCalendarSchemaPath} accepted an invalid response`);
  }
}

const trainingSessionSelectionQuerySchemaPath =
  "schemas/training-session-selection-query-v1.schema.json";
const validateTrainingSessionSelectionQuery = ajv.compile(
  JSON.parse(read(trainingSessionSelectionQuerySchemaPath)),
);
const secondSessionRefDigest = `session-${"d".repeat(64)}`;
const syntheticTrainingSessionSelectionQuery = {
  sessionRefs: [secondSessionRefDigest, sessionRefDigest],
  snapshotRef: snapshotRefDigest,
};
if (!validateTrainingSessionSelectionQuery(syntheticTrainingSessionSelectionQuery)) {
  throw new Error(
    `${trainingSessionSelectionQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingSessionSelectionQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionSelectionQuery, sessionRefs: [] },
  { ...syntheticTrainingSessionSelectionQuery, sessionRefs: [sessionRefDigest, sessionRefDigest] },
  { ...syntheticTrainingSessionSelectionQuery, sourceSessionId: "hidden" },
]) {
  if (validateTrainingSessionSelectionQuery(invalidQuery)) {
    throw new Error(`${trainingSessionSelectionQuerySchemaPath} accepted an invalid query`);
  }
}

const trainingSessionSelectionSchemaPath = "schemas/training-session-selection-v1.schema.json";
const validateTrainingSessionSelection = ajv.compile(
  JSON.parse(read(trainingSessionSelectionSchemaPath)),
);
const secondSyntheticSession = structuredClone(syntheticTrainingSessionSearch.sessions[0]);
secondSyntheticSession.sessionRef = secondSessionRefDigest;
const syntheticTrainingSessionSelection = {
  snapshotRef: snapshotRefDigest,
  sessions: [secondSyntheticSession, syntheticTrainingSessionSearch.sessions[0]],
};
if (!validateTrainingSessionSelection(syntheticTrainingSessionSelection)) {
  throw new Error(
    `${trainingSessionSelectionSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingSessionSelection.errors)}`,
  );
}
for (const invalidResponse of [
  { ...syntheticTrainingSessionSelection, sessions: [] },
  { ...syntheticTrainingSessionSelection, originId: "must-not-cross-the-boundary" },
]) {
  if (validateTrainingSessionSelection(invalidResponse)) {
    throw new Error(`${trainingSessionSelectionSchemaPath} accepted an invalid response`);
  }
}

const trainingSessionStructurePath =
  "docs/data-formats/insights/training-session-structure-v1.md";
const trainingSessionStructure = read(trainingSessionStructurePath);
for (const field of [
  "query_training_session_structure",
  "sessionRef",
  "snapshotRef",
  "structure",
  "exercises",
  "exerciseRef",
  "ordinal",
  "startedAtLocal",
  "stoppedAtLocal",
  "utcOffsetMinutes",
  "durationMilliseconds",
  "distanceMeters",
  "energyKilocalories",
  "sport",
  "manualLaps",
  "automaticLaps",
  "pauses",
  "lapRef",
  "splitTimeMilliseconds",
  "pauseRef",
  "endedAtLocal",
  "invalid-training-session-detail",
  "training-session-detail-changed",
  "training-session-detail-failed",
]) {
  requireMention(trainingSessionStructure, field, trainingSessionStructurePath);
}

const trainingSessionStructureQuerySchemaPath =
  "schemas/training-session-structure-query-v1.schema.json";
const validateTrainingSessionStructureQuery = ajv.compile(
  JSON.parse(read(trainingSessionStructureQuerySchemaPath)),
);
const syntheticTrainingSessionStructureQuery = {
  sessionRef: sessionRefDigest,
  snapshotRef: snapshotRefDigest,
};
if (!validateTrainingSessionStructureQuery(syntheticTrainingSessionStructureQuery)) {
  throw new Error(
    `${trainingSessionStructureQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingSessionStructureQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionStructureQuery, sessionRef: "provider-session-id" },
  { ...syntheticTrainingSessionStructureQuery, snapshotRef: "revision-1" },
  { ...syntheticTrainingSessionStructureQuery, sourceSessionId: "hidden" },
]) {
  if (validateTrainingSessionStructureQuery(invalidQuery)) {
    throw new Error(`${trainingSessionStructureQuerySchemaPath} accepted an invalid query`);
  }
}

const trainingSessionStructureSchemaPath =
  "schemas/training-session-structure-v1.schema.json";
const trainingSessionStructureSchema = JSON.parse(read(trainingSessionStructureSchemaPath));
const validateTrainingSessionStructure = ajv.compile(trainingSessionStructureSchema);
const syntheticTrainingSessionStructure = {
  snapshotRef: snapshotRefDigest,
  sessionRef: sessionRefDigest,
  structure: {
    exercises: [{
      exerciseRef: `exercise-${"e".repeat(64)}`,
      ordinal: 0,
      startedAtLocal: "2026-08-18T07:30:00",
      stoppedAtLocal: "2026-08-18T08:30:00",
      utcOffsetMinutes: 120,
      durationMilliseconds: "3600000",
      distanceMeters: 10000.5,
      energyKilocalories: "650",
      sport: syntheticTrainingSessionSearch.sessions[0].sport,
      manualLaps: [{
        lapRef: `lap-${"f".repeat(64)}`,
        ordinal: 0,
        splitTimeMilliseconds: "1800000",
        durationMilliseconds: "1800000",
        distanceMeters: 5000.25,
      }],
      automaticLaps: [],
      pauses: [{
        pauseRef: `pause-${"1".repeat(64)}`,
        ordinal: 0,
        startedAtLocal: "2026-08-18T08:00:00",
        endedAtLocal: "2026-08-18T08:01:00",
      }],
    }],
  },
};
for (const response of [
  syntheticTrainingSessionStructure,
  { ...syntheticTrainingSessionStructure, structure: null },
  {
    ...syntheticTrainingSessionStructure,
    structure: { exercises: null },
  },
  {
    ...syntheticTrainingSessionStructure,
    structure: { exercises: [] },
  },
]) {
  if (!validateTrainingSessionStructure(response)) {
    throw new Error(
      `${trainingSessionStructureSchemaPath} rejected a valid response: ${ajv.errorsText(validateTrainingSessionStructure.errors)}`,
    );
  }
}
for (const invalidResponse of [
  { ...syntheticTrainingSessionStructure, sourceSessionId: "hidden" },
  (() => {
    const value = structuredClone(syntheticTrainingSessionStructure);
    value.structure.exercises[0].exerciseRef = "source-exercise-id";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionStructure);
    value.structure.exercises[0].manualLaps[0].durationMilliseconds = "01";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionStructure);
    delete value.structure.exercises[0].pauses;
    return value;
  })(),
]) {
  if (validateTrainingSessionStructure(invalidResponse)) {
    throw new Error(`${trainingSessionStructureSchemaPath} accepted an invalid response`);
  }
}

const trainingSessionRoutePath =
  "docs/data-formats/insights/training-session-route-v1.md";
const trainingSessionRoute = read(trainingSessionRoutePath);
for (const field of [
  "query_training_session_routes",
  "query_training_route_points",
  "sessionRef",
  "snapshotRef",
  "maxVisualPoints",
  "routes",
  "exercises",
  "exerciseRef",
  "routeRef",
  "kind",
  "startedAtLocal",
  "pointCount",
  "altitudePointCount",
  "elapsedPointCount",
  "visualPoints",
  "ordinal",
  "latitudeDegrees",
  "longitudeDegrees",
  "altitudeMeters",
  "elapsedMilliseconds",
  "source-ordinal-v1",
  "offset",
  "limit",
  "points",
  "nextOffset",
  "invalid-training-session-detail",
  "training-session-detail-changed",
  "training-session-detail-failed",
]) {
  requireMention(trainingSessionRoute, field, trainingSessionRoutePath);
}

const trainingSessionRouteQuerySchemaPath =
  "schemas/training-session-route-query-v1.schema.json";
const validateTrainingSessionRouteQuery = ajv.compile(
  JSON.parse(read(trainingSessionRouteQuerySchemaPath)),
);
const syntheticTrainingSessionRouteQuery = {
  sessionRef: sessionRefDigest,
  snapshotRef: snapshotRefDigest,
  maxVisualPoints: 200,
};
if (!validateTrainingSessionRouteQuery(syntheticTrainingSessionRouteQuery)) {
  throw new Error(
    `${trainingSessionRouteQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingSessionRouteQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionRouteQuery, maxVisualPoints: 1 },
  { ...syntheticTrainingSessionRouteQuery, maxVisualPoints: 501 },
  { ...syntheticTrainingSessionRouteQuery, sourceSessionId: "hidden" },
]) {
  if (validateTrainingSessionRouteQuery(invalidQuery)) {
    throw new Error(`${trainingSessionRouteQuerySchemaPath} accepted an invalid query`);
  }
}

const routeRefDigest = `route-${"2".repeat(64)}`;
const trainingSessionRouteSchemaPath =
  "schemas/training-session-route-v1.schema.json";
const trainingSessionRouteSchema = JSON.parse(read(trainingSessionRouteSchemaPath));
const validateTrainingSessionRoute = ajv.compile(trainingSessionRouteSchema);
const syntheticRoutePoint = {
  ordinal: 0,
  latitudeDegrees: 40.0,
  longitudeDegrees: -3.0,
  altitudeMeters: 650.0,
  elapsedMilliseconds: "0",
};
const syntheticTrainingSessionRoute = {
  snapshotRef: snapshotRefDigest,
  sessionRef: sessionRefDigest,
  routes: {
    exercises: [{
      exerciseRef: `exercise-${"e".repeat(64)}`,
      ordinal: 0,
      routes: {
        primary: {
          routeRef: routeRefDigest,
          kind: "primary",
          startedAtLocal: "2026-08-18T07:30:00",
          pointCount: 1,
          altitudePointCount: 1,
          elapsedPointCount: 1,
          projection: "source-ordinal-v1",
          visualPoints: [syntheticRoutePoint],
        },
        transition: null,
      },
    }],
  },
};
for (const response of [
  syntheticTrainingSessionRoute,
  { ...syntheticTrainingSessionRoute, routes: null },
  { ...syntheticTrainingSessionRoute, routes: { exercises: null } },
  { ...syntheticTrainingSessionRoute, routes: { exercises: [] } },
]) {
  if (!validateTrainingSessionRoute(response)) {
    throw new Error(
      `${trainingSessionRouteSchemaPath} rejected a valid response: ${ajv.errorsText(validateTrainingSessionRoute.errors)}`,
    );
  }
}
for (const invalidResponse of [
  { ...syntheticTrainingSessionRoute, sourceExerciseId: "hidden" },
  (() => {
    const value = structuredClone(syntheticTrainingSessionRoute);
    value.routes.exercises[0].routes.primary.projection = "smoothed";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionRoute);
    value.routes.exercises[0].routes.primary.visualPoints[0].latitudeDegrees = 91;
    return value;
  })(),
]) {
  if (validateTrainingSessionRoute(invalidResponse)) {
    throw new Error(`${trainingSessionRouteSchemaPath} accepted an invalid response`);
  }
}

const trainingRoutePointsQuerySchemaPath =
  "schemas/training-route-points-query-v1.schema.json";
const validateTrainingRoutePointsQuery = ajv.compile(
  JSON.parse(read(trainingRoutePointsQuerySchemaPath)),
);
const syntheticTrainingRoutePointsQuery = {
  sessionRef: sessionRefDigest,
  routeRef: routeRefDigest,
  snapshotRef: snapshotRefDigest,
  offset: 0,
  limit: 250,
};
if (!validateTrainingRoutePointsQuery(syntheticTrainingRoutePointsQuery)) {
  throw new Error(
    `${trainingRoutePointsQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingRoutePointsQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingRoutePointsQuery, limit: 0 },
  { ...syntheticTrainingRoutePointsQuery, limit: 251 },
  { ...syntheticTrainingRoutePointsQuery, sourceRouteId: "hidden" },
]) {
  if (validateTrainingRoutePointsQuery(invalidQuery)) {
    throw new Error(`${trainingRoutePointsQuerySchemaPath} accepted an invalid query`);
  }
}

const trainingRoutePointsSchemaPath = "schemas/training-route-points-v1.schema.json";
const validateTrainingRoutePoints = ajv.compile(
  JSON.parse(read(trainingRoutePointsSchemaPath)),
);
const syntheticTrainingRoutePoints = {
  snapshotRef: snapshotRefDigest,
  sessionRef: sessionRefDigest,
  routeRef: routeRefDigest,
  pointCount: 1,
  offset: 0,
  points: [syntheticRoutePoint],
  nextOffset: null,
};
if (!validateTrainingRoutePoints(syntheticTrainingRoutePoints)) {
  throw new Error(
    `${trainingRoutePointsSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingRoutePoints.errors)}`,
  );
}
for (const invalidResponse of [
  { ...syntheticTrainingRoutePoints, elapsedMilliseconds: 0 },
  { ...syntheticTrainingRoutePoints, providerRouteId: "hidden" },
  { ...syntheticTrainingRoutePoints, points: [{ ...syntheticRoutePoint, ordinal: -1 }] },
]) {
  if (validateTrainingRoutePoints(invalidResponse)) {
    throw new Error(`${trainingRoutePointsSchemaPath} accepted an invalid response`);
  }
}

const trainingSessionSignalPath =
  "docs/data-formats/insights/training-session-signal-v1.md";
const trainingSessionSignal = read(trainingSessionSignalPath);
for (const field of [
  "query_training_session_signals",
  "query_training_signal_samples",
  "sessionRef",
  "snapshotRef",
  "signalRef",
  "exerciseRef",
  "maxVisualSamples",
  "signals",
  "exercises",
  "primary",
  "transition",
  "unsupportedPrimarySeriesCount",
  "unsupportedTransitionSeriesCount",
  "role",
  "kind",
  "unit",
  "intervalMilliseconds",
  "sampleCount",
  "availableSampleCount",
  "source-ordinal-v1",
  "visualSamples",
  "ordinal",
  "elapsedMilliseconds",
  "value",
  "gapBefore",
  "offset",
  "limit",
  "samples",
  "nextOffset",
  "invalid-training-session-detail",
  "training-session-detail-changed",
  "training-session-detail-failed",
]) {
  requireMention(trainingSessionSignal, field, trainingSessionSignalPath);
}

const trainingSessionSignalsQuerySchemaPath =
  "schemas/training-session-signals-query-v1.schema.json";
const validateTrainingSessionSignalsQuery = ajv.compile(
  JSON.parse(read(trainingSessionSignalsQuerySchemaPath)),
);
const syntheticTrainingSessionSignalsQuery = {
  sessionRef: sessionRefDigest,
  snapshotRef: snapshotRefDigest,
  maxVisualSamples: 200,
};
if (!validateTrainingSessionSignalsQuery(syntheticTrainingSessionSignalsQuery)) {
  throw new Error(
    `${trainingSessionSignalsQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingSessionSignalsQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionSignalsQuery, maxVisualSamples: 1 },
  { ...syntheticTrainingSessionSignalsQuery, maxVisualSamples: 501 },
  { ...syntheticTrainingSessionSignalsQuery, providerSessionId: "hidden" },
]) {
  if (validateTrainingSessionSignalsQuery(invalidQuery)) {
    throw new Error(`${trainingSessionSignalsQuerySchemaPath} accepted an invalid query`);
  }
}

const signalRefDigest = `signal-${"3".repeat(64)}`;
const exerciseRefDigest = `exercise-${"e".repeat(64)}`;
const trainingSessionSignalsSchemaPath =
  "schemas/training-session-signals-v1.schema.json";
const validateTrainingSessionSignals = ajv.compile(
  JSON.parse(read(trainingSessionSignalsSchemaPath)),
);
const syntheticSignalSample = {
  ordinal: 0,
  elapsedMilliseconds: "0",
  value: 120.5,
};
const syntheticTrainingSessionSignals = {
  snapshotRef: snapshotRefDigest,
  sessionRef: sessionRefDigest,
  signals: {
    exercises: [{
      exerciseRef: exerciseRefDigest,
      ordinal: 0,
      signals: {
        primary: [{
          signalRef: signalRefDigest,
          ordinal: 0,
          role: "primary",
          kind: "heart-rate",
          unit: "beats-per-minute",
          intervalMilliseconds: "1000",
          sampleCount: 2,
          availableSampleCount: 1,
          projection: "source-ordinal-v1",
          visualSamples: [
            { ...syntheticSignalSample, gapBefore: false },
            { ordinal: 1, elapsedMilliseconds: "1000", value: null, gapBefore: true },
          ],
        }],
        transition: null,
        unsupportedPrimarySeriesCount: 1,
        unsupportedTransitionSeriesCount: 0,
      },
    }],
  },
};
for (const response of [
  syntheticTrainingSessionSignals,
  { ...syntheticTrainingSessionSignals, signals: null },
  { ...syntheticTrainingSessionSignals, signals: { exercises: null } },
  { ...syntheticTrainingSessionSignals, signals: { exercises: [] } },
]) {
  if (!validateTrainingSessionSignals(response)) {
    throw new Error(
      `${trainingSessionSignalsSchemaPath} rejected a valid response: ${ajv.errorsText(validateTrainingSessionSignals.errors)}`,
    );
  }
}
for (const invalidResponse of [
  { ...syntheticTrainingSessionSignals, sourceSessionId: "hidden" },
  (() => {
    const value = structuredClone(syntheticTrainingSessionSignals);
    value.signals.exercises[0].signals.primary[0].unit = "watts";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionSignals);
    value.signals.exercises[0].signals.primary[0].projection = "smoothed";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionSignals);
    delete value.signals.exercises[0].signals.primary[0].visualSamples[1].gapBefore;
    return value;
  })(),
]) {
  if (validateTrainingSessionSignals(invalidResponse)) {
    throw new Error(`${trainingSessionSignalsSchemaPath} accepted an invalid response`);
  }
}

const trainingSignalSamplesQuerySchemaPath =
  "schemas/training-signal-samples-query-v1.schema.json";
const validateTrainingSignalSamplesQuery = ajv.compile(
  JSON.parse(read(trainingSignalSamplesQuerySchemaPath)),
);
const syntheticTrainingSignalSamplesQuery = {
  sessionRef: sessionRefDigest,
  signalRef: signalRefDigest,
  snapshotRef: snapshotRefDigest,
  offset: 0,
  limit: 250,
};
if (!validateTrainingSignalSamplesQuery(syntheticTrainingSignalSamplesQuery)) {
  throw new Error(
    `${trainingSignalSamplesQuerySchemaPath} rejected its synthetic query: ${ajv.errorsText(validateTrainingSignalSamplesQuery.errors)}`,
  );
}
for (const invalidQuery of [
  { ...syntheticTrainingSignalSamplesQuery, limit: 0 },
  { ...syntheticTrainingSignalSamplesQuery, limit: 251 },
  { ...syntheticTrainingSignalSamplesQuery, sourceSignalType: "HEART_RATE" },
]) {
  if (validateTrainingSignalSamplesQuery(invalidQuery)) {
    throw new Error(`${trainingSignalSamplesQuerySchemaPath} accepted an invalid query`);
  }
}

const trainingSignalSamplesSchemaPath =
  "schemas/training-signal-samples-v1.schema.json";
const validateTrainingSignalSamples = ajv.compile(
  JSON.parse(read(trainingSignalSamplesSchemaPath)),
);
const syntheticTrainingSignalSamples = {
  snapshotRef: snapshotRefDigest,
  sessionRef: sessionRefDigest,
  signalRef: signalRefDigest,
  exerciseRef: exerciseRefDigest,
  ordinal: 0,
  role: "primary",
  kind: "heart-rate",
  unit: "beats-per-minute",
  intervalMilliseconds: "1000",
  sampleCount: 2,
  offset: 0,
  samples: [syntheticSignalSample],
  nextOffset: 1,
};
if (!validateTrainingSignalSamples(syntheticTrainingSignalSamples)) {
  throw new Error(
    `${trainingSignalSamplesSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingSignalSamples.errors)}`,
  );
}
for (const invalidResponse of [
  { ...syntheticTrainingSignalSamples, providerSignalType: "HEART_RATE" },
  { ...syntheticTrainingSignalSamples, unit: "watts" },
  {
    ...syntheticTrainingSignalSamples,
    samples: [{ ...syntheticSignalSample, elapsedMilliseconds: "00" }],
  },
]) {
  if (validateTrainingSignalSamples(invalidResponse)) {
    throw new Error(`${trainingSignalSamplesSchemaPath} accepted an invalid response`);
  }
}

const trainingSessionZonePath =
  "docs/data-formats/insights/training-session-zone-v1.md";
const trainingSessionZone = read(trainingSessionZonePath);
for (const field of [
  "query_training_session_zones",
  "training-session-zones-query-v1.schema.json",
  "training-session-zones-v1.schema.json",
  "sessionRef",
  "snapshotRef",
  "zoneGroupRef",
  "zoneRef",
  "exerciseRef",
  "unsupportedGroupCount",
  "kind",
  "unit",
  "lowerLimit",
  "higherLimit",
  "timeInZoneMilliseconds",
  "distanceMeters",
  "muscleLoad",
  "heart-rate",
  "speed",
  "power",
  "beats-per-minute",
  "kilometers-per-hour",
  "watts",
  "invalid-training-session-detail",
  "training-session-detail-changed",
  "training-session-detail-failed",
]) {
  requireMention(trainingSessionZone, field, trainingSessionZonePath);
}

const trainingSessionZonesQuerySchemaPath =
  "schemas/training-session-zones-query-v1.schema.json";
const validateTrainingSessionZonesQuery = ajv.compile(
  JSON.parse(read(trainingSessionZonesQuerySchemaPath)),
);
const syntheticTrainingSessionZonesQuery = {
  sessionRef: sessionRefDigest,
  snapshotRef: snapshotRefDigest,
};
for (const query of [
  syntheticTrainingSessionZonesQuery,
  { ...syntheticTrainingSessionZonesQuery, snapshotRef: null },
]) {
  if (!validateTrainingSessionZonesQuery(query)) {
    throw new Error(
      `${trainingSessionZonesQuerySchemaPath} rejected a valid query: ${ajv.errorsText(validateTrainingSessionZonesQuery.errors)}`,
    );
  }
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionZonesQuery, sessionRef: "session-short" },
  { ...syntheticTrainingSessionZonesQuery, sourceSessionId: "hidden" },
]) {
  if (validateTrainingSessionZonesQuery(invalidQuery)) {
    throw new Error(`${trainingSessionZonesQuerySchemaPath} accepted an invalid query`);
  }
}

const zoneGroupRefDigest = `zone-group-${"4".repeat(64)}`;
const zoneRefDigest = `zone-${"5".repeat(64)}`;
const trainingSessionZonesSchemaPath =
  "schemas/training-session-zones-v1.schema.json";
const validateTrainingSessionZones = ajv.compile(
  JSON.parse(read(trainingSessionZonesSchemaPath)),
);
const syntheticTrainingSessionZones = {
  snapshotRef: snapshotRefDigest,
  sessionRef: sessionRefDigest,
  zones: {
    exercises: [{
      exerciseRef: exerciseRefDigest,
      ordinal: 0,
      zones: {
        groups: [{
          zoneGroupRef: zoneGroupRefDigest,
          ordinal: 0,
          kind: "heart-rate",
          unit: "beats-per-minute",
          zones: [{
            zoneRef: zoneRefDigest,
            ordinal: 0,
            lowerLimit: 120,
            higherLimit: 139,
            timeInZoneMilliseconds: "900000",
            distanceMeters: null,
            muscleLoad: null,
          }],
        }],
        unsupportedGroupCount: 1,
      },
    }],
  },
};
for (const response of [
  syntheticTrainingSessionZones,
  { ...syntheticTrainingSessionZones, zones: null },
  { ...syntheticTrainingSessionZones, zones: { exercises: null } },
  { ...syntheticTrainingSessionZones, zones: { exercises: [] } },
]) {
  if (!validateTrainingSessionZones(response)) {
    throw new Error(
      `${trainingSessionZonesSchemaPath} rejected a valid response: ${ajv.errorsText(validateTrainingSessionZones.errors)}`,
    );
  }
}
for (const invalidResponse of [
  { ...syntheticTrainingSessionZones, providerZoneType: "HEART_RATE" },
  (() => {
    const value = structuredClone(syntheticTrainingSessionZones);
    value.zones.exercises[0].zones.groups[0].unit = "watts";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionZones);
    value.zones.exercises[0].zones.groups[0].zones[0].distanceMeters = 100;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticTrainingSessionZones);
    value.zones.exercises[0].zones.groups[0].zones[0].timeInZoneMilliseconds = "00";
    return value;
  })(),
]) {
  if (validateTrainingSessionZones(invalidResponse)) {
    throw new Error(`${trainingSessionZonesSchemaPath} accepted an invalid response`);
  }
}

const trainingSessionProvenancePath =
  "docs/data-formats/insights/training-session-provenance-v1.md";
const trainingSessionProvenance = read(trainingSessionProvenancePath);
for (const field of [
  "query_training_session_provenance",
  "training-session-provenance-query-v1.schema.json",
  "training-session-provenance-v1.schema.json",
  "sessionRef",
  "snapshotRef",
  "offset",
  "limit",
  "nextOffset",
  "current",
  "totalEventCount",
  "provider",
  "sourceModifiedAtUtc",
  "observedAtUtc",
  "sourceAdapterVersion",
  "mappingVersion",
  "contributingEventCount",
  "nonContributingEventCount",
  "decision",
  "contributesToVisibleState",
  "polar-flow",
  "create",
  "equivalent",
  "enrich",
  "amend",
  "preserve",
  "conflict",
  "invalid-training-session-detail",
  "training-session-detail-changed",
  "training-session-detail-failed",
]) {
  requireMention(trainingSessionProvenance, field, trainingSessionProvenancePath);
}

const trainingSessionProvenanceQuerySchemaPath =
  "schemas/training-session-provenance-query-v1.schema.json";
const validateTrainingSessionProvenanceQuery = ajv.compile(
  JSON.parse(read(trainingSessionProvenanceQuerySchemaPath)),
);
const syntheticTrainingSessionProvenanceQuery = {
  sessionRef: sessionRefDigest,
  snapshotRef: snapshotRefDigest,
  offset: 0,
  limit: 10,
};
for (const query of [
  syntheticTrainingSessionProvenanceQuery,
  { ...syntheticTrainingSessionProvenanceQuery, snapshotRef: null },
]) {
  if (!validateTrainingSessionProvenanceQuery(query)) {
    throw new Error(
      `${trainingSessionProvenanceQuerySchemaPath} rejected a valid query: ${ajv.errorsText(validateTrainingSessionProvenanceQuery.errors)}`,
    );
  }
}
for (const invalidQuery of [
  { ...syntheticTrainingSessionProvenanceQuery, limit: 26 },
  { ...syntheticTrainingSessionProvenanceQuery, artifactLocator: "private.json" },
]) {
  if (validateTrainingSessionProvenanceQuery(invalidQuery)) {
    throw new Error(`${trainingSessionProvenanceQuerySchemaPath} accepted an invalid query`);
  }
}

const trainingSessionProvenanceSchemaPath =
  "schemas/training-session-provenance-v1.schema.json";
const validateTrainingSessionProvenance = ajv.compile(
  JSON.parse(read(trainingSessionProvenanceSchemaPath)),
);
const syntheticTrainingSessionProvenance = {
  snapshotRef: snapshotRefDigest,
  sessionRef: sessionRefDigest,
  totalEventCount: 2,
  offset: 0,
  limit: 1,
  nextOffset: 1,
  current: {
    provider: "polar-flow",
    sourceModifiedAtUtc: "2026-08-18T18:00:00Z",
    sourceAdapterVersion: "polar-flow-archive@11",
    mappingVersion: "polar-flow-training-session@6",
    contributingEventCount: 1,
    nonContributingEventCount: 1,
  },
  events: [{
    ordinal: 0,
    observedAtUtc: "2026-08-19T01:00:00Z",
    sourceModifiedAtUtc: "2026-08-18T18:00:00Z",
    provider: "polar-flow",
    sourceAdapterVersion: "polar-flow-archive@11",
    mappingVersion: "polar-flow-training-session@6",
    decision: "create",
    contributesToVisibleState: true,
  }],
};
if (!validateTrainingSessionProvenance(syntheticTrainingSessionProvenance)) {
  throw new Error(
    `${trainingSessionProvenanceSchemaPath} rejected its synthetic response: ${ajv.errorsText(validateTrainingSessionProvenance.errors)}`,
  );
}
for (const invalidResponse of [
  { ...syntheticTrainingSessionProvenance, artifactSha256: "0".repeat(64) },
  { ...syntheticTrainingSessionProvenance, totalEventCount: 0 },
  {
    ...syntheticTrainingSessionProvenance,
    current: { ...syntheticTrainingSessionProvenance.current, provider: "private-provider" },
  },
  {
    ...syntheticTrainingSessionProvenance,
    current: {
      ...syntheticTrainingSessionProvenance.current,
      sourceModifiedAtUtc: "2026-08-18T20:00:00+02:00",
    },
  },
  {
    ...syntheticTrainingSessionProvenance,
    events: [{
      ...syntheticTrainingSessionProvenance.events[0],
      decision: "conflict",
      contributesToVisibleState: true,
    }],
  },
]) {
  if (validateTrainingSessionProvenance(invalidResponse)) {
    throw new Error(`${trainingSessionProvenanceSchemaPath} accepted an invalid response`);
  }
}

const sessionStoryPath = "docs/data-formats/insights/session-story-v1.md";
const sessionStory = read(sessionStoryPath);
for (const field of [
  "query_session_story",
  "session-story-query-v1.schema.json",
  "session-story-v1.schema.json",
  "schemaVersion",
  "sessionRef",
  "snapshotRef",
  "maxVisualPoints",
  "maxVisualSamples",
  "session",
  "structure",
  "routes",
  "signals",
  "zones",
  "provenance",
  "exercises",
  "exerciseRef",
  "primary",
  "transition",
  "primaryMetric",
  "eligibleOverlays",
  "sourceKind",
  "sourceUnit",
  "valueTransform",
  "alignedSamples",
  "routePointOrdinal",
  "signalSampleOrdinal",
  "elapsedMilliseconds",
  "gapBefore",
  "exactRoute",
  "exactSignals",
  "training-session-detail-changed",
  "invalid-training-session-detail",
  "training-session-detail-failed",
]) {
  requireMention(sessionStory, field, sessionStoryPath);
}

const sessionStoryV2Path = "docs/data-formats/insights/session-story-v2.md";
const sessionStoryV2 = read(sessionStoryV2Path);
for (const field of [
  "query_session_story",
  "session-story-query-v1.schema.json",
  "session-story-v2.schema.json",
  "schemaVersion",
  "composition",
  "structureState",
  "routeState",
  "signalState",
  "zoneState",
  "exerciseCount",
  "evidence",
  "hasStructure",
  "manualLapCount",
  "automaticLapCount",
  "pauseCount",
  "zoneGroupCount",
  "zoneCount",
  "timedZoneCount",
  "unsupportedZoneGroupCount",
  "routePointCount",
  "signalSeriesCount",
  "signalSeriesWithValuesCount",
  "partialSignalSeriesCount",
  "unavailableSignalSeriesCount",
  "emptySignalSeriesCount",
  "unsupportedSignalSeriesCount",
  "signalSampleCount",
  "availableSignalSampleCount",
  "unavailableSignalSampleCount",
  "training-session-detail-changed",
  "invalid-training-session-detail",
  "training-session-detail-failed",
]) {
  requireMention(sessionStoryV2, field, sessionStoryV2Path);
}

const sessionStoryV3Path = "docs/data-formats/insights/session-story-v3.md";
const sessionStoryV3 = read(sessionStoryV3Path);
for (const field of [
  "query_session_story",
  "session-story-query-v1.schema.json",
  "session-story-v3.schema.json",
  "schemaVersion",
  "eligibleOverlays",
  "alignmentState",
  "exact-recorded",
  "unavailable",
  "alignedSamples",
  "elapsedMilliseconds",
  "training-session-detail-changed",
  "invalid-training-session-detail",
  "training-session-detail-failed",
]) {
  requireMention(sessionStoryV3, field, sessionStoryV3Path);
}

const sessionStoryQuerySchemaPath = "schemas/session-story-query-v1.schema.json";
const validateSessionStoryQuery = ajv.compile(JSON.parse(read(sessionStoryQuerySchemaPath)));
const syntheticSessionStoryQuery = {
  sessionRef: sessionRefDigest,
  snapshotRef: snapshotRefDigest,
  maxVisualPoints: 300,
  maxVisualSamples: 400,
};
for (const query of [
  syntheticSessionStoryQuery,
  { ...syntheticSessionStoryQuery, snapshotRef: null },
]) {
  if (!validateSessionStoryQuery(query)) {
    throw new Error(
      `${sessionStoryQuerySchemaPath} rejected a valid query: ${ajv.errorsText(validateSessionStoryQuery.errors)}`,
    );
  }
}
for (const invalidQuery of [
  { ...syntheticSessionStoryQuery, maxVisualPoints: 1 },
  { ...syntheticSessionStoryQuery, maxVisualSamples: 501 },
  { ...syntheticSessionStoryQuery, sourceSessionId: "private" },
]) {
  if (validateSessionStoryQuery(invalidQuery)) {
    throw new Error(`${sessionStoryQuerySchemaPath} accepted an invalid query`);
  }
}

const sessionStorySchemaPath = "schemas/session-story-v1.schema.json";
for (const dependencyPath of [
  trainingSessionSearchSchemaPath,
  trainingSessionStructureSchemaPath,
  trainingSessionRouteSchemaPath,
  trainingSessionSignalsSchemaPath,
  trainingSessionZonesSchemaPath,
  trainingSessionProvenanceSchemaPath,
]) {
  const dependency = JSON.parse(read(dependencyPath));
  if (!ajv.getSchema(dependency.$id)) ajv.addSchema(dependency);
}
const validateSessionStory = ajv.compile(JSON.parse(read(sessionStorySchemaPath)));
const syntheticSessionStory = {
  schemaVersion: 1,
  snapshotRef: snapshotRefDigest,
  session: syntheticTrainingSessionSearch.sessions[0],
  structure: syntheticTrainingSessionStructure.structure,
  routes: syntheticTrainingSessionRoute.routes,
  signals: syntheticTrainingSessionSignals.signals,
  zones: syntheticTrainingSessionZones.zones,
  provenance: {
    totalEventCount: syntheticTrainingSessionProvenance.totalEventCount,
    current: syntheticTrainingSessionProvenance.current,
  },
  exercises: [{
    exerciseRef: exerciseRefDigest,
    ordinal: 0,
    sport: syntheticTrainingSessionSearch.sessions[0].sport,
    structure: syntheticTrainingSessionStructure.structure.exercises[0],
    zones: syntheticTrainingSessionZones.zones.exercises[0].zones,
    primary: {
      route: syntheticTrainingSessionRoute.routes.exercises[0].routes.primary,
      signals: syntheticTrainingSessionSignals.signals.exercises[0].signals.primary,
      primaryMetric: "heart-rate",
      eligibleOverlays: [{
        signalRef: signalRefDigest,
        metric: "heart-rate",
        sourceKind: "heart-rate",
        sourceUnit: "beats-per-minute",
        valueTransform: "identity",
        alignedSamples: [{
          routePointOrdinal: 0,
          signalSampleOrdinal: 0,
          elapsedMilliseconds: "0",
          value: 120.5,
          gapBefore: false,
        }],
      }],
      exactRoute: { routeRef: routeRefDigest, pointCount: 1 },
      exactSignals: [{
        signalRef: signalRefDigest,
        kind: "heart-rate",
        unit: "beats-per-minute",
        sampleCount: 2,
      }],
    },
    transition: {
      route: null,
      signals: [],
      primaryMetric: null,
      eligibleOverlays: [],
      exactRoute: null,
      exactSignals: [],
    },
  }],
};
if (!validateSessionStory(syntheticSessionStory)) {
  throw new Error(
    `${sessionStorySchemaPath} rejected its synthetic response: ${ajv.errorsText(validateSessionStory.errors)}`,
  );
}
for (const invalidResponse of [
  { ...syntheticSessionStory, schemaVersion: 2 },
  { ...syntheticSessionStory, sourceSessionId: "private" },
  (() => {
    const value = structuredClone(syntheticSessionStory);
    value.exercises[0].primary.eligibleOverlays[0].valueTransform = "interpolate";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSessionStory);
    value.exercises[0].primary.eligibleOverlays[0].alignedSamples[0]
      .elapsedMilliseconds = 0;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSessionStory);
    value.exercises[0].primary.eligibleOverlays[0].color = "red";
    return value;
  })(),
]) {
  if (validateSessionStory(invalidResponse)) {
    throw new Error(`${sessionStorySchemaPath} accepted an invalid response`);
  }
}

const sessionStoryV2SchemaPath = "schemas/session-story-v2.schema.json";
const validateSessionStoryV2 = ajv.compile(JSON.parse(read(sessionStoryV2SchemaPath)));
const syntheticRoleEvidence = {
  routePointCount: 1,
  signalSeriesCount: 1,
  signalSeriesWithValuesCount: 1,
  partialSignalSeriesCount: 1,
  unavailableSignalSeriesCount: 0,
  emptySignalSeriesCount: 0,
  unsupportedSignalSeriesCount: 1,
  signalSampleCount: 2,
  availableSignalSampleCount: 1,
  unavailableSignalSampleCount: 1,
};
const syntheticEmptyRoleEvidence = {
  routePointCount: 0,
  signalSeriesCount: 0,
  signalSeriesWithValuesCount: 0,
  partialSignalSeriesCount: 0,
  unavailableSignalSeriesCount: 0,
  emptySignalSeriesCount: 0,
  unsupportedSignalSeriesCount: 0,
  signalSampleCount: 0,
  availableSignalSampleCount: 0,
  unavailableSignalSampleCount: 0,
};
const syntheticSessionStoryV2 = structuredClone(syntheticSessionStory);
syntheticSessionStoryV2.schemaVersion = 2;
syntheticSessionStoryV2.composition = {
  structureState: "source-present",
  routeState: "source-present",
  signalState: "source-present",
  zoneState: "source-present",
  exerciseCount: 1,
};
syntheticSessionStoryV2.exercises[0].evidence = {
  hasStructure: true,
  manualLapCount: 0,
  automaticLapCount: 0,
  pauseCount: 0,
  zoneGroupCount: 1,
  zoneCount: 1,
  timedZoneCount: 1,
  unsupportedZoneGroupCount: 1,
};
syntheticSessionStoryV2.exercises[0].primary.evidence = syntheticRoleEvidence;
syntheticSessionStoryV2.exercises[0].transition.evidence = syntheticEmptyRoleEvidence;
if (!validateSessionStoryV2(syntheticSessionStoryV2)) {
  throw new Error(
    `${sessionStoryV2SchemaPath} rejected its synthetic response: ${ajv.errorsText(validateSessionStoryV2.errors)}`,
  );
}
for (const invalidResponse of [
  { ...syntheticSessionStoryV2, schemaVersion: 1 },
  { ...syntheticSessionStoryV2, sourceSessionId: "private" },
  { ...syntheticSessionStoryV2, composition: {
    ...syntheticSessionStoryV2.composition,
    routeState: "maybe-recorded",
  } },
  (() => {
    const value = structuredClone(syntheticSessionStoryV2);
    value.exercises[0].primary.evidence.unavailableSignalSampleCount = -1;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSessionStoryV2);
    value.exercises[0].evidence.inferredPhaseCount = 1;
    return value;
  })(),
]) {
  if (validateSessionStoryV2(invalidResponse)) {
    throw new Error(`${sessionStoryV2SchemaPath} accepted an invalid response`);
  }
}

const sessionStoryV3SchemaPath = "schemas/session-story-v3.schema.json";
const validateSessionStoryV3 = ajv.compile(JSON.parse(read(sessionStoryV3SchemaPath)));
const syntheticSessionStoryV3 = structuredClone(syntheticSessionStoryV2);
syntheticSessionStoryV3.schemaVersion = 3;
syntheticSessionStoryV3.exercises[0].primary.eligibleOverlays[0].alignmentState =
  "exact-recorded";
const syntheticSessionStoryV3WithoutAlignment = structuredClone(syntheticSessionStoryV3);
syntheticSessionStoryV3WithoutAlignment.exercises[0].primary.eligibleOverlays[0]
  .alignmentState = "unavailable";
syntheticSessionStoryV3WithoutAlignment.exercises[0].primary.eligibleOverlays[0]
  .alignedSamples = [];
for (const validResponse of [
  syntheticSessionStoryV3,
  syntheticSessionStoryV3WithoutAlignment,
]) {
  if (!validateSessionStoryV3(validResponse)) {
    throw new Error(
      `${sessionStoryV3SchemaPath} rejected a valid synthetic response: ${ajv.errorsText(validateSessionStoryV3.errors)}`,
    );
  }
}
for (const invalidResponse of [
  { ...syntheticSessionStoryV3, schemaVersion: 2 },
  (() => {
    const value = structuredClone(syntheticSessionStoryV3);
    value.exercises[0].primary.eligibleOverlays[0].alignmentState = "inferred";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSessionStoryV3);
    value.exercises[0].primary.eligibleOverlays[0].alignmentState = "unavailable";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticSessionStoryV3);
    delete value.exercises[0].primary.eligibleOverlays[0].alignmentState;
    return value;
  })(),
]) {
  if (validateSessionStoryV3(invalidResponse)) {
    throw new Error(`${sessionStoryV3SchemaPath} accepted an invalid response`);
  }
}

const trainingDiscoveryWorkspacePath =
  "docs/data-formats/insights/training-discovery-workspace-v1.md";
const trainingDiscoveryWorkspace = read(trainingDiscoveryWorkspacePath);
for (const field of [
  "load_training_discovery_workspace",
  "save_training_discovery_workspace",
  "clear_training_discovery_workspace",
  "version",
  "snapshotRef",
  "from",
  "through",
  "sportRefs",
  "requiredMeasurements",
  "text",
  "sort",
  "offset",
  "limit",
  "view",
  "chronology",
  "calendar",
  "calendarMonth",
  "calendarDay",
  "selectedSessionRefs",
  "openSessionRef",
  "invalid-training-discovery-workspace",
  "training-discovery-workspace-query-failed",
  "training-discovery-workspace-update-failed",
]) {
  requireMention(trainingDiscoveryWorkspace, field, trainingDiscoveryWorkspacePath);
}
const trainingDiscoveryWorkspaceSchemaPath =
  "schemas/training-discovery-workspace-v1.schema.json";
const validateTrainingDiscoveryWorkspace = ajv.compile(
  JSON.parse(read(trainingDiscoveryWorkspaceSchemaPath)),
);
const syntheticTrainingDiscoveryWorkspace = {
  version: 1,
  snapshotRef: snapshotRefDigest,
  from: "2026-01-01",
  through: "2026-08-18",
  sportRefs: [sportRefDigest],
  requiredMeasurements: ["distance", "heart-rate"],
  text: "Trail",
  sort: "distance-desc",
  offset: 25,
  limit: 25,
  view: "calendar",
  calendarMonth: "2026-08",
  calendarDay: "2026-08-18",
  selectedSessionRefs: [secondSessionRefDigest, sessionRefDigest],
  openSessionRef: sessionRefDigest,
};
if (!validateTrainingDiscoveryWorkspace(syntheticTrainingDiscoveryWorkspace)) {
  throw new Error(
    `${trainingDiscoveryWorkspaceSchemaPath} rejected its synthetic workspace: ${ajv.errorsText(validateTrainingDiscoveryWorkspace.errors)}`,
  );
}
for (const invalidWorkspace of [
  { ...syntheticTrainingDiscoveryWorkspace, version: 2 },
  {
    ...syntheticTrainingDiscoveryWorkspace,
    view: "chronology",
  },
  {
    ...syntheticTrainingDiscoveryWorkspace,
    selectedSessionRefs: [sessionRefDigest, sessionRefDigest],
  },
  { ...syntheticTrainingDiscoveryWorkspace, offset: 20 },
  { ...syntheticTrainingDiscoveryWorkspace, limit: 10 },
  { ...syntheticTrainingDiscoveryWorkspace, originId: "must-not-cross-the-boundary" },
]) {
  if (validateTrainingDiscoveryWorkspace(invalidWorkspace)) {
    throw new Error(`${trainingDiscoveryWorkspaceSchemaPath} accepted an invalid workspace`);
  }
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

const libraryHomePath = "docs/data-formats/insights/library-home-v1.md";
const libraryHome = read(libraryHomePath);
for (const field of [
  "afterImportOperationRef",
  "availableRange",
  "domains",
  "domain",
  "selectedRange",
  "originCount",
  "observedRecordCount",
  "measurements",
  "measurement",
  "availableRecords",
  "observedRecords",
  "questions",
  "kind",
  "destination",
  "postImport",
  "exactRepeat",
  "canonicalHistoryChanged",
  "newObservations",
  "enrichedObservations",
  "amendedObservations",
  "sourceReviewRecommended",
  "resumableExploration",
  "version",
  "training",
  "activity",
  "sleep",
  "recovery",
  "longitudinal",
  "invalid-library-home-request",
  "invalid-exploration-workspace",
  "library-query-failed",
]) {
  requireMention(libraryHome, field, libraryHomePath);
}

const libraryHomeQuerySchemaPath = "schemas/library-home-query-v1.schema.json";
const libraryHomeQuerySchema = JSON.parse(read(libraryHomeQuerySchemaPath));
const validateLibraryHomeQuery = ajv.compile(libraryHomeQuerySchema);
for (const query of [
  { afterImportOperationRef: null },
  { afterImportOperationRef: "synthetic-import-operation" },
]) {
  if (!validateLibraryHomeQuery(query)) {
    throw new Error(
      libraryHomeQuerySchemaPath
        + " rejected a valid query: "
        + ajv.errorsText(validateLibraryHomeQuery.errors),
    );
  }
}

const explorationWorkspaceSaveSchemaPath = "schemas/exploration-workspace-save-v1.schema.json";
const explorationWorkspaceSaveSchema = JSON.parse(read(explorationWorkspaceSaveSchemaPath));
const validateExplorationWorkspaceSave = ajv.compile(explorationWorkspaceSaveSchema);
for (const destination of ["activity", "training", "sleep", "recovery", "longitudinal"]) {
  if (!validateExplorationWorkspaceSave({ destination })) {
    throw new Error(
      explorationWorkspaceSaveSchemaPath
        + " rejected a valid destination: "
        + ajv.errorsText(validateExplorationWorkspaceSave.errors),
    );
  }
}
for (const invalidWorkspace of [
  {},
  { destination: "provider-route" },
  { destination: "training", seriesRef: "must-not-be-persisted" },
]) {
  if (validateExplorationWorkspaceSave(invalidWorkspace)) {
    throw new Error(explorationWorkspaceSaveSchemaPath + " accepted an invalid workspace");
  }
}
for (const invalidQuery of [
  {},
  { afterImportOperationRef: " " },
  { afterImportOperationRef: null, provider: "must-not-cross-the-boundary" },
]) {
  if (validateLibraryHomeQuery(invalidQuery)) {
    throw new Error(libraryHomeQuerySchemaPath + " accepted an invalid query");
  }
}

const libraryHomeSchemaPath = "schemas/library-home-v1.schema.json";
const libraryHomeSchema = JSON.parse(read(libraryHomeSchemaPath));
const validateLibraryHomeSchema = ajv.compile(libraryHomeSchema);
const measurement = (name, availableRecords, observedRecords) => ({
  measurement: name,
  availableRecords,
  observedRecords,
});
const syntheticLibraryHome = {
  availableRange: { from: "2026-01-01", through: "2026-01-06" },
  domains: [
    {
      domain: "training",
      availableRange: { from: "2026-01-04", through: "2026-01-05" },
      selectedRange: { from: "2026-01-04", through: "2026-01-05" },
      originCount: 1,
      observedRecordCount: 2,
      measurements: [
        measurement("training-duration", 2, 2),
        measurement("training-distance", 1, 2),
        measurement("training-energy", 1, 2),
        measurement("training-heart-rate", 1, 2),
      ],
    },
    {
      domain: "activity",
      availableRange: { from: "2026-01-01", through: "2026-01-03" },
      selectedRange: { from: "2026-01-01", through: "2026-01-03" },
      originCount: 2,
      observedRecordCount: 2,
      measurements: [measurement("activity-steps", 1, 2)],
    },
    {
      domain: "sleep",
      availableRange: { from: "2026-01-06", through: "2026-01-06" },
      selectedRange: { from: "2026-01-06", through: "2026-01-06" },
      originCount: 1,
      observedRecordCount: 1,
      measurements: [
        measurement("sleep-duration", 1, 1),
        measurement("sleep-interruptions", 1, 1),
        measurement("sleep-efficiency", 1, 1),
        measurement("sleep-phases", 1, 1),
        measurement("sleep-stages", 1, 1),
        measurement("sleep-score", 1, 1),
        measurement("sleep-goal", 1, 1),
        measurement("sleep-power-status", 1, 1),
      ],
    },
    {
      domain: "recovery",
      availableRange: { from: "2026-01-06", through: "2026-01-06" },
      selectedRange: { from: "2026-01-06", through: "2026-01-06" },
      originCount: 1,
      observedRecordCount: 1,
      measurements: [
        measurement("recovery-beat-to-beat-interval", 1, 1),
        measurement("recovery-heart-rate-variability", 1, 1),
        measurement("recovery-breathing-interval", 1, 1),
        measurement("recovery-assessment", 1, 1),
        measurement("recovery-baseline", 1, 1),
        measurement("recovery-guidance", 1, 1),
      ],
    },
  ],
  questions: [
    { kind: "explore-training-sessions", destination: "training" },
    { kind: "align-history", destination: "longitudinal" },
    { kind: "review-activity-steps", destination: "activity" },
    { kind: "review-sleep-patterns", destination: "sleep" },
    { kind: "review-recovery-patterns", destination: "recovery" },
  ],
  postImport: {
    exactRepeat: false,
    canonicalHistoryChanged: true,
    newObservations: 4,
    enrichedObservations: 1,
    amendedObservations: 1,
    sourceReviewRecommended: true,
  },
  resumableExploration: { version: 1, destination: "training" },
};
const unavailableDomain = (domain) => ({
  domain,
  availableRange: null,
  selectedRange: null,
  originCount: 0,
  observedRecordCount: 0,
  measurements: [],
});
const emptyLibraryHome = {
  availableRange: null,
  domains: ["training", "activity", "sleep", "recovery"].map(unavailableDomain),
  questions: [],
  postImport: null,
  resumableExploration: null,
};

function libraryHomeIsSemanticallyValid(value) {
  if (!validateLibraryHomeSchema(value)) return false;

  const availableDomains = value.domains.filter((domain) => domain.availableRange !== null);
  if (availableDomains.length === 0) {
    return value.availableRange === null
      && value.questions.length === 0
      && value.resumableExploration === null;
  }
  if (value.availableRange === null) return false;

  const globalFrom = availableDomains
    .map((domain) => domain.availableRange.from)
    .reduce((earliest, current) => earliest < current ? earliest : current);
  const globalThrough = availableDomains
    .map((domain) => domain.availableRange.through)
    .reduce((latest, current) => latest > current ? latest : current);
  if (value.availableRange.from !== globalFrom || value.availableRange.through !== globalThrough) {
    return false;
  }

  for (const domain of availableDomains) {
    if (
      domain.availableRange.from > domain.availableRange.through
      || domain.selectedRange.from > domain.selectedRange.through
      || domain.selectedRange.from < domain.availableRange.from
      || domain.selectedRange.through > domain.availableRange.through
      || domain.measurements.some((entry) => (
        entry.observedRecords !== domain.observedRecordCount
        || entry.availableRecords > entry.observedRecords
      ))
    ) {
      return false;
    }
  }

  const measurementAvailable = (name) => value.domains.some((domain) => (
    domain.measurements.some((entry) => (
      entry.measurement === name && entry.availableRecords > 0
    ))
  ));
  const training = measurementAvailable("training-duration");
  const activity = measurementAvailable("activity-steps");
  const sleep = measurementAvailable("sleep-duration");
  const recovery = measurementAvailable("recovery-beat-to-beat-interval");
  const expectedQuestions = [];
  if (training) {
    expectedQuestions.push({ kind: "explore-training-sessions", destination: "training" });
  }
  if ([training, activity, sleep, recovery].filter(Boolean).length >= 2) {
    expectedQuestions.push({ kind: "align-history", destination: "longitudinal" });
  }
  if (activity) expectedQuestions.push({ kind: "review-activity-steps", destination: "activity" });
  if (sleep) expectedQuestions.push({ kind: "review-sleep-patterns", destination: "sleep" });
  if (recovery) {
    expectedQuestions.push({ kind: "review-recovery-patterns", destination: "recovery" });
  }
  if (JSON.stringify(value.questions) !== JSON.stringify(expectedQuestions)) return false;
  return value.resumableExploration === null
    || expectedQuestions.some((question) => (
      question.destination === value.resumableExploration.destination
    ));
}

for (const home of [emptyLibraryHome, syntheticLibraryHome]) {
  if (!libraryHomeIsSemanticallyValid(home)) {
    throw new Error(
      libraryHomeSchemaPath
        + " rejected a valid response: "
        + ajv.errorsText(validateLibraryHomeSchema.errors),
    );
  }
}
for (const invalidHome of [
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    [value.domains[0], value.domains[1]] = [value.domains[1], value.domains[0]];
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.domains[0].measurements[1].measurement = "training-energy";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.domains[1].measurements[0].availableRecords = 3;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.domains[2].measurements[0].observedRecords = 2;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.questions[0].destination = "activity";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.questions.pop();
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.postImport.newObservations = -1;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.provider = "must-not-cross-the-boundary";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.availableRange = null;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHome);
    value.resumableExploration.destination = "activity";
    value.questions = value.questions.filter((question) => question.destination !== "activity");
    return value;
  })(),
]) {
  if (libraryHomeIsSemanticallyValid(invalidHome)) {
    throw new Error(libraryHomeSchemaPath + " accepted an invalid response");
  }
}

const libraryHomeV2Path = "docs/data-formats/insights/library-home-v2.md";
const libraryHomeV2 = read(libraryHomeV2Path);
for (const field of [
  "libraryRevisionRef",
  "trainingSnapshotRef",
  "sessionCount",
  "sportProfileCount",
  "omittedSportProfileCount",
  "sports",
  "profileCount",
  "recentSessions",
  "sessionRef",
  "startedAtLocal",
  "durationMilliseconds",
  "distanceMeters",
  "canonicalFamily",
  "displayLabel",
  "highlight",
  "recent-training-comparison",
  "historical-training",
  "library-history",
  "referenceDate",
  "baseline",
  "comparison",
  "sessionCountChange",
  "durationChangeMilliseconds",
  "latestSessionDate",
  "latestEvidenceDate",
  "no-current-training",
  "history-after-reference-date",
  "unchangedObservations",
]) {
  requireMention(libraryHomeV2, field, libraryHomeV2Path);
}

const libraryHomeV2SchemaPath = "schemas/library-home-v2.schema.json";
const libraryHomeV2Schema = JSON.parse(read(libraryHomeV2SchemaPath));
const validateLibraryHomeV2Schema = ajv.compile(libraryHomeV2Schema);
const libraryRevisionRef = "library-home-revision-" + "a".repeat(64);
const trainingSnapshotRef = "training-snapshot-" + "b".repeat(64);
const sessionRef = "session-" + "c".repeat(64);
const syntheticLibraryHomeV2 = {
  ...structuredClone(syntheticLibraryHome),
  version: 2,
  libraryRevisionRef,
  training: {
    trainingSnapshotRef,
    sessionCount: 2,
    sportProfileCount: 2,
    omittedSportProfileCount: 0,
    sports: [
      {
        state: "classified",
        canonicalFamily: "running",
        displayLabel: "Trail running",
        profileCount: 1,
        sessionCount: 1,
      },
      {
        state: "unknown",
        canonicalFamily: null,
        displayLabel: null,
        profileCount: 1,
        sessionCount: 1,
      },
    ],
    recentSessions: [{
      sessionRef,
      startedAtLocal: "2026-01-05T08:00:00",
      durationMilliseconds: "3600000",
      distanceMeters: 10000.5,
      sportState: "classified",
      canonicalFamily: "running",
      displayLabel: "Trail running",
    }],
  },
  highlight: {
    kind: "recent-training-comparison",
    referenceDate: "2026-01-06",
    baseline: {
      range: { from: "2025-12-24", through: "2025-12-30" },
      sessionCount: 1,
      totalDurationMilliseconds: "3000000",
    },
    comparison: {
      range: { from: "2025-12-31", through: "2026-01-06" },
      sessionCount: 2,
      totalDurationMilliseconds: "7200000",
    },
    sessionCountChange: "1",
    durationChangeMilliseconds: "4200000",
  },
  postImport: {
    ...syntheticLibraryHome.postImport,
    unchangedObservations: 2,
  },
};
const emptyLibraryHomeV2 = {
  ...structuredClone(emptyLibraryHome),
  version: 2,
  libraryRevisionRef,
  training: null,
  highlight: null,
};

function sevenDateRangeEndingOn(through) {
  const end = new Date(through + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { from: start.toISOString().slice(0, 10), through };
}

function nextDate(value) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function libraryHomeV2IsSemanticallyValid(value) {
  if (!validateLibraryHomeV2Schema(value)) return false;
  const legacy = structuredClone(value);
  delete legacy.version;
  delete legacy.libraryRevisionRef;
  delete legacy.training;
  delete legacy.highlight;
  if (legacy.postImport !== null) delete legacy.postImport.unchangedObservations;
  if (!libraryHomeIsSemanticallyValid(legacy)) return false;
  const trainingAvailable = value.domains[0].availableRange !== null;
  if (!trainingAvailable) {
    return value.training === null
      && (value.availableRange === null
        ? value.highlight === null
        : value.highlight?.kind === "library-history"
          && value.highlight.latestEvidenceDate === value.availableRange.through);
  }
  if (value.training === null || value.highlight === null) return false;
  const representedProfiles = value.training.sports
    .reduce((total, sport) => total + sport.profileCount, 0);
  if (
    representedProfiles + value.training.omittedSportProfileCount
      !== value.training.sportProfileCount
    || value.training.recentSessions.some((session, index, sessions) => (
      index > 0 && sessions[index - 1].startedAtLocal < session.startedAtLocal
    ))
  ) {
    return false;
  }
  if (value.highlight.kind === "recent-training-comparison") {
    const expectedComparison = sevenDateRangeEndingOn(value.highlight.referenceDate);
    const baselineEndsBeforeComparison = nextDate(value.highlight.baseline.range.through)
      === value.highlight.comparison.range.from;
    return JSON.stringify(value.highlight.comparison.range) === JSON.stringify(expectedComparison)
      && JSON.stringify(value.highlight.baseline.range)
        === JSON.stringify(sevenDateRangeEndingOn(value.highlight.baseline.range.through))
      && baselineEndsBeforeComparison
      && value.highlight.comparison.sessionCount > 0
      && BigInt(value.highlight.sessionCountChange)
        === BigInt(value.highlight.comparison.sessionCount)
          - BigInt(value.highlight.baseline.sessionCount)
      && BigInt(value.highlight.durationChangeMilliseconds)
        === BigInt(value.highlight.comparison.totalDurationMilliseconds)
          - BigInt(value.highlight.baseline.totalDurationMilliseconds);
  }
  if (value.highlight.kind === "historical-training") {
    return JSON.stringify(value.highlight.currentRange)
      === JSON.stringify(sevenDateRangeEndingOn(value.highlight.referenceDate));
  }
  return false;
}

for (const home of [emptyLibraryHomeV2, syntheticLibraryHomeV2]) {
  if (!libraryHomeV2IsSemanticallyValid(home)) {
    throw new Error(
      libraryHomeV2SchemaPath
        + " rejected a valid response: "
        + ajv.errorsText(validateLibraryHomeV2Schema.errors),
    );
  }
}
for (const invalidHome of [
  (() => {
    const value = structuredClone(syntheticLibraryHomeV2);
    value.version = 1;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV2);
    value.libraryRevisionRef = "operation-must-not-cross-the-boundary";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV2);
    value.training.sports[1].displayLabel = "Provider sport";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV2);
    value.training.recentSessions[0].durationMilliseconds = 3600000;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV2);
    value.training.omittedSportProfileCount = 1;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV2);
    value.highlight.comparison.range.from = "2026-01-01";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV2);
    value.highlight.durationChangeMilliseconds = "4199999";
    return value;
  })(),
  (() => {
    const value = structuredClone(emptyLibraryHomeV2);
    value.highlight = { kind: "library-history", latestEvidenceDate: "2026-01-01" };
    return value;
  })(),
]) {
  if (libraryHomeV2IsSemanticallyValid(invalidHome)) {
    throw new Error(libraryHomeV2SchemaPath + " accepted an invalid response");
  }
}

const libraryHomeV3Path = "docs/data-formats/insights/library-home-v3.md";
const libraryHomeV3 = read(libraryHomeV3Path);
for (const field of [
  "version",
  "training.sports",
  "sportRef",
  "profileCount",
  "sessionCount",
  "canonicalFamily",
  "displayLabel",
  "state",
]) {
  requireMention(libraryHomeV3, field, libraryHomeV3Path);
}

const libraryHomeV3SchemaPath = "schemas/library-home-v3.schema.json";
const libraryHomeV3Schema = JSON.parse(read(libraryHomeV3SchemaPath));
const validateLibraryHomeV3Schema = ajv.compile(libraryHomeV3Schema);
const syntheticLibraryHomeV3 = structuredClone(syntheticLibraryHomeV2);
syntheticLibraryHomeV3.version = 3;
syntheticLibraryHomeV3.training.sports[0].sportRef = "sport-" + "d".repeat(64);
syntheticLibraryHomeV3.training.sports[1].sportRef = "sport-" + "e".repeat(64);
syntheticLibraryHomeV3.training.recentSessions[0].sportRef = "sport-" + "d".repeat(64);
const emptyLibraryHomeV3 = structuredClone(emptyLibraryHomeV2);
emptyLibraryHomeV3.version = 3;

function libraryHomeV3IsSemanticallyValid(value) {
  if (!validateLibraryHomeV3Schema(value)) return false;
  const legacy = structuredClone(value);
  legacy.version = 2;
  for (const sport of legacy.training?.sports ?? []) delete sport.sportRef;
  for (const session of legacy.training?.recentSessions ?? []) delete session.sportRef;
  if (!libraryHomeV2IsSemanticallyValid(legacy)) return false;
  const sportRefs = (value.training?.sports ?? [])
    .map((sport) => sport.sportRef)
    .filter((sportRef) => sportRef !== null);
  return new Set(sportRefs).size === sportRefs.length;
}

for (const home of [emptyLibraryHomeV3, syntheticLibraryHomeV3]) {
  if (!libraryHomeV3IsSemanticallyValid(home)) {
    throw new Error(
      libraryHomeV3SchemaPath
        + " rejected a valid response: "
        + ajv.errorsText(validateLibraryHomeV3Schema.errors),
    );
  }
}
for (const invalidHome of [
  (() => {
    const value = structuredClone(syntheticLibraryHomeV3);
    value.version = 2;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV3);
    value.training.sports[1].sportRef = null;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV3);
    value.training.recentSessions[0].sportRef = null;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV3);
    value.training.sports[1].sportRef = value.training.sports[0].sportRef;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV3);
    value.training.sports[0].profileCount = 2;
    value.training.sportProfileCount = 3;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV3);
    value.training.sports[0].sourceSport = "must-not-cross-the-boundary";
    return value;
  })(),
]) {
  if (libraryHomeV3IsSemanticallyValid(invalidHome)) {
    throw new Error(libraryHomeV3SchemaPath + " accepted an invalid response");
  }
}

const libraryHomeV4Path = "docs/data-formats/insights/library-home-v4.md";
const libraryHomeV4 = read(libraryHomeV4Path);
for (const field of [
  "recordedRange",
  "usableRange",
  "primaryRange",
  "primaryRange.scope",
  "training",
  "activity",
  "sleep",
  "recovery",
  "combined",
  "stepCount",
]) {
  requireMention(libraryHomeV4, field, libraryHomeV4Path);
}

const libraryHomeV4SchemaPath = "schemas/library-home-v4.schema.json";
const libraryHomeV4Schema = JSON.parse(read(libraryHomeV4SchemaPath));
const validateLibraryHomeV4Schema = ajv.compile(libraryHomeV4Schema);

function libraryHomeV4FromV3(value) {
  const next = structuredClone(value);
  next.version = 4;
  next.recordedRange = next.availableRange;
  next.usableRange = next.availableRange;
  delete next.availableRange;
  for (const domain of next.domains) {
    domain.recordedRange = domain.availableRange;
    domain.usableRange = domain.availableRange;
    delete domain.availableRange;
  }
  const trainingRange = next.domains[0].usableRange;
  const usableDomains = next.domains.filter((domain) => domain.usableRange !== null);
  next.primaryRange = next.usableRange === null
    ? null
    : trainingRange !== null
      ? { scope: "training", range: trainingRange }
      : usableDomains.length === 1
        ? { scope: usableDomains[0].domain, range: usableDomains[0].usableRange }
        : { scope: "combined", range: next.usableRange };
  return next;
}

const syntheticLibraryHomeV4 = libraryHomeV4FromV3(syntheticLibraryHomeV3);
const emptyLibraryHomeV4 = libraryHomeV4FromV3(emptyLibraryHomeV3);
const recordedOnlyLibraryHomeV4 = structuredClone(emptyLibraryHomeV4);
recordedOnlyLibraryHomeV4.recordedRange = { from: "2014-01-01", through: "2014-01-01" };
recordedOnlyLibraryHomeV4.domains[1] = {
  domain: "activity",
  recordedRange: { from: "2014-01-01", through: "2014-01-01" },
  usableRange: null,
  selectedRange: null,
  originCount: 1,
  observedRecordCount: 1,
  measurements: [measurement("activity-steps", 0, 1)],
};

function combinedHomeRange(domains, field) {
  const ranges = domains.map((domain) => domain[field]).filter((range) => range !== null);
  if (ranges.length === 0) return null;
  return {
    from: ranges.map((range) => range.from).reduce((left, right) => left < right ? left : right),
    through: ranges
      .map((range) => range.through)
      .reduce((left, right) => left > right ? left : right),
  };
}

function libraryHomeV4IsSemanticallyValid(value) {
  if (!validateLibraryHomeV4Schema(value)) return false;
  if (
    JSON.stringify(value.recordedRange) !== JSON.stringify(combinedHomeRange(value.domains, "recordedRange"))
    || JSON.stringify(value.usableRange) !== JSON.stringify(combinedHomeRange(value.domains, "usableRange"))
  ) {
    return false;
  }
  for (const domain of value.domains) {
    if (
      domain.recordedRange !== null
      && (domain.recordedRange.from > domain.recordedRange.through
        || domain.measurements.some((measurementEntry) => (
          measurementEntry.observedRecords !== domain.observedRecordCount
          || measurementEntry.availableRecords > measurementEntry.observedRecords
        )))
    ) {
      return false;
    }
    if (domain.usableRange === null) {
      if (
        domain.selectedRange !== null
        || domain.measurements.some((measurementEntry) => measurementEntry.availableRecords > 0)
      ) {
        return false;
      }
    } else if (
      domain.selectedRange === null
      || domain.usableRange.from < domain.recordedRange.from
      || domain.usableRange.through > domain.recordedRange.through
      || JSON.stringify(domain.selectedRange) !== JSON.stringify(domain.usableRange)
    ) {
      return false;
    }
    if (
      domain.domain !== "activity"
      && JSON.stringify(domain.recordedRange) !== JSON.stringify(domain.usableRange)
    ) {
      return false;
    }
  }
  if (value.usableRange === null) {
    return value.primaryRange === null
      && value.questions.length === 0
      && value.training === null
      && value.highlight === null
      && value.resumableExploration === null;
  }
  if (value.primaryRange === null) return false;
  const usableDomains = value.domains.filter((domain) => domain.usableRange !== null);
  const trainingRange = value.domains[0].usableRange;
  const expectedPrimary = trainingRange !== null
    ? { scope: "training", range: trainingRange }
    : usableDomains.length === 1
      ? { scope: usableDomains[0].domain, range: usableDomains[0].usableRange }
      : { scope: "combined", range: value.usableRange };
  if (JSON.stringify(value.primaryRange) !== JSON.stringify(expectedPrimary)) return false;

  const legacy = structuredClone(value);
  legacy.version = 3;
  legacy.availableRange = legacy.usableRange;
  delete legacy.recordedRange;
  delete legacy.usableRange;
  delete legacy.primaryRange;
  legacy.domains = legacy.domains.map((domain) => domain.usableRange === null
    ? unavailableDomain(domain.domain)
    : {
        ...domain,
        availableRange: domain.usableRange,
        selectedRange: domain.usableRange,
        recordedRange: undefined,
        usableRange: undefined,
      });
  for (const domain of legacy.domains) {
    delete domain.recordedRange;
    delete domain.usableRange;
  }
  return libraryHomeV3IsSemanticallyValid(legacy);
}

for (const home of [emptyLibraryHomeV4, recordedOnlyLibraryHomeV4, syntheticLibraryHomeV4]) {
  if (!libraryHomeV4IsSemanticallyValid(home)) {
    throw new Error(
      libraryHomeV4SchemaPath
        + " rejected a valid response: "
        + ajv.errorsText(validateLibraryHomeV4Schema.errors),
    );
  }
}
for (const invalidHome of [
  (() => {
    const value = structuredClone(syntheticLibraryHomeV4);
    value.version = 3;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV4);
    value.recordedRange.from = "2014-01-01";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticLibraryHomeV4);
    value.primaryRange.scope = "combined";
    return value;
  })(),
  (() => {
    const value = structuredClone(recordedOnlyLibraryHomeV4);
    value.primaryRange = { scope: "activity", range: value.recordedRange };
    return value;
  })(),
  (() => {
    const value = structuredClone(recordedOnlyLibraryHomeV4);
    value.domains[1].measurements[0].availableRecords = 1;
    return value;
  })(),
]) {
  if (libraryHomeV4IsSemanticallyValid(invalidHome)) {
    throw new Error(libraryHomeV4SchemaPath + " accepted an invalid response");
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

const stableUpdateChannelPath = "docs/data-formats/release/update-channel-v2.md";
const stableUpdateChannel = read(stableUpdateChannelPath);
for (const field of [
  "org.fitfreed.update-envelope",
  "org.fitfreed.update-channel",
  "stable",
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
  "withdrawnVersions.*.version",
  "withdrawnVersions.*.reason",
  "withdrawnVersions.*.guidance.*",
  "withdrawnVersions.*.replacementVersion",
]) {
  requireMention(stableUpdateChannel, field, stableUpdateChannelPath);
}

const stableUpdateChannelPayloadSchemaPath = "schemas/update-channel-payload-v2.schema.json";
const stableUpdateChannelPayloadSchema = JSON.parse(read(stableUpdateChannelPayloadSchemaPath));
const validateStableUpdateChannelPayload = ajv.compile(stableUpdateChannelPayloadSchema);
const syntheticStableUpdateChannelPayload = structuredClone(syntheticUpdateChannelPayload);
syntheticStableUpdateChannelPayload.schemaVersion = 2;
syntheticStableUpdateChannelPayload.channel = "stable";
syntheticStableUpdateChannelPayload.release.version = "0.2.0";
syntheticStableUpdateChannelPayload.release.minimumSupportedVersion = "0.1.0";
syntheticStableUpdateChannelPayload.release.platforms["darwin-aarch64"].url =
  publicUpdateUrl("0.2.0/FitFreed_aarch64.app.tar.gz");
syntheticStableUpdateChannelPayload.withdrawnVersions[0].replacementVersion = "0.2.0";
if (!validateStableUpdateChannelPayload(syntheticStableUpdateChannelPayload)) {
  throw new Error(
    stableUpdateChannelPayloadSchemaPath
      + " rejected its synthetic payload: "
      + ajv.errorsText(validateStableUpdateChannelPayload.errors),
  );
}
if (
  validateStableUpdateChannelPayload(syntheticUpdateChannelPayload)
  || validateUpdateChannelPayload(syntheticStableUpdateChannelPayload)
) {
  throw new Error("private-alpha and stable payload schemas accepted a cross-channel contract");
}
for (const invalidPayload of [
  { ...syntheticStableUpdateChannelPayload, sequence: 0 },
  { ...syntheticStableUpdateChannelPayload, schemaVersion: 1 },
  (() => {
    const value = structuredClone(syntheticStableUpdateChannelPayload);
    delete value.release.releaseNotes["en-US"];
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticStableUpdateChannelPayload);
    value.release.platforms["darwin-aarch64"].url =
      "http://fitfreed.org/updates/FitFreed.app.tar.gz";
    return value;
  })(),
  { ...syntheticStableUpdateChannelPayload, untrustedMirror: true },
]) {
  if (validateStableUpdateChannelPayload(invalidPayload)) {
    throw new Error(stableUpdateChannelPayloadSchemaPath + " accepted an invalid payload");
  }
}

const stableUpdateChannelEnvelopeSchemaPath = "schemas/update-channel-envelope-v2.schema.json";
const stableUpdateChannelEnvelopeSchema = JSON.parse(read(stableUpdateChannelEnvelopeSchemaPath));
const validateStableUpdateChannelEnvelope = ajv.compile(stableUpdateChannelEnvelopeSchema);
const syntheticStableUpdateChannelEnvelope = {
  version: syntheticStableUpdateChannelPayload.release.version,
  platforms: {
    "darwin-aarch64": {
      url: syntheticStableUpdateChannelPayload.release.platforms["darwin-aarch64"].url,
      signature:
        syntheticStableUpdateChannelPayload.release.platforms["darwin-aarch64"].tauriSignature,
    },
  },
  fitfreed: {
    format: "org.fitfreed.update-envelope",
    schemaVersion: 2,
    algorithm: "minisign-ed25519",
    keyId: "stable.synthetic-1",
    payloadBase64: Buffer.from(JSON.stringify(syntheticStableUpdateChannelPayload)).toString(
      "base64",
    ),
    signatureBase64: "U3ludGhldGljIG1ldGFkYXRhIHNpZ25hdHVyZQ==",
  },
};
if (!validateStableUpdateChannelEnvelope(syntheticStableUpdateChannelEnvelope)) {
  throw new Error(
    stableUpdateChannelEnvelopeSchemaPath
      + " rejected its synthetic envelope: "
      + ajv.errorsText(validateStableUpdateChannelEnvelope.errors),
  );
}
if (
  validateStableUpdateChannelEnvelope(syntheticUpdateChannelEnvelope)
  || validateUpdateChannelEnvelope(syntheticStableUpdateChannelEnvelope)
) {
  throw new Error("private-alpha and stable envelope schemas accepted a cross-channel contract");
}
for (const invalidEnvelope of [
  (() => {
    const value = structuredClone(syntheticStableUpdateChannelEnvelope);
    delete value.fitfreed.keyId;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticStableUpdateChannelEnvelope);
    value.fitfreed.schemaVersion = 1;
    return value;
  })(),
  { ...syntheticStableUpdateChannelEnvelope, notes: "Unsigned notes are forbidden." },
]) {
  if (validateStableUpdateChannelEnvelope(invalidEnvelope)) {
    throw new Error(stableUpdateChannelEnvelopeSchemaPath + " accepted an invalid envelope");
  }
}

const publicUpdateConfigurationPath =
  "docs/data-formats/release/public-update-configuration-v1.md";
const publicUpdateConfiguration = read(publicUpdateConfigurationPath);
for (const field of [
  "org.fitfreed.public-update-configuration",
  "schemaVersion",
  "status",
  "inactive",
  "active",
  "contract",
  "stable-v2",
  "metadataEndpoint",
  "keys.*.id",
  "keys.*.publicKey",
  "FITFREED_PUBLIC_UPDATE_CONTRACT",
  "FITFREED_PUBLIC_UPDATE_ENDPOINT",
  "FITFREED_PUBLIC_UPDATE_TRUST",
]) {
  requireMention(publicUpdateConfiguration, field, publicUpdateConfigurationPath);
}
const publicUpdateConfigurationSchemaPath =
  "schemas/public-update-configuration-v1.schema.json";

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

const updateRecoveryOutcomeSchemaPath = "schemas/update-recovery-outcome-v1.schema.json";
const updateRecoveryOutcomeSchema = JSON.parse(read(updateRecoveryOutcomeSchemaPath));
const validateUpdateRecoveryOutcome = ajv.compile(updateRecoveryOutcomeSchema);
const syntheticUpdateRecoveryOutcome = {
  format: "org.fitfreed.update-recovery-outcome",
  schemaVersion: 1,
  recoveryId: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  outcome: "recovered",
  sourceVersion: "0.1.0",
  targetVersion: "0.2.0-alpha.1",
};
if (!validateUpdateRecoveryOutcome(syntheticUpdateRecoveryOutcome)) {
  throw new Error(
    updateRecoveryOutcomeSchemaPath
      + " rejected its synthetic outcome: "
      + ajv.errorsText(validateUpdateRecoveryOutcome.errors),
  );
}
for (const invalidOutcome of [
  { ...syntheticUpdateRecoveryOutcome, outcome: "failed" },
  { ...syntheticUpdateRecoveryOutcome, recoveryId: "not-a-digest" },
  { ...syntheticUpdateRecoveryOutcome, sourceVersion: "01.0.0" },
  { ...syntheticUpdateRecoveryOutcome, applicationPath: "/Applications/FitFreed.app" },
]) {
  if (validateUpdateRecoveryOutcome(invalidOutcome)) {
    throw new Error(updateRecoveryOutcomeSchemaPath + " accepted an invalid outcome");
  }
}

const reportDefinitionCanonicalPath = "docs/data-formats/canonical/report-definition.md";
const reportDefinitionPortablePath = "docs/data-formats/portable/report-definition-v1.md";
const sessionReportPath = "docs/data-formats/insights/session-report-v1.md";
const reportHtmlPath = "docs/data-formats/portable/report-html-v1.md";
const reportDefinitionCanonicalV2Path = "docs/data-formats/canonical/report-definition-v2.md";
const reportDefinitionPortableV2Path = "docs/data-formats/portable/report-definition-v2.md";
const sessionReportV2Path = "docs/data-formats/insights/session-report-v2.md";
const reportHtmlV2Path = "docs/data-formats/portable/report-html-v2.md";
const reportDefinitionCanonicalV3Path = "docs/data-formats/canonical/report-definition-v3.md";
const reportDefinitionPortableV3Path = "docs/data-formats/portable/report-definition-v3.md";
const sessionReportV3Path = "docs/data-formats/insights/session-report-v3.md";
const reportHtmlV3Path = "docs/data-formats/portable/report-html-v3.md";
const reportDefinitionCanonicalV4Path = "docs/data-formats/canonical/report-definition-v4.md";
const reportDefinitionPortableV4Path = "docs/data-formats/portable/report-definition-v4.md";
const reportV4Path = "docs/data-formats/insights/report-v4.md";
const reportHtmlV4Path = "docs/data-formats/portable/report-html-v4.md";
const reportDefinitionSchemaPath = "schemas/report-definition-v1.schema.json";
const reportDefinitionV2SchemaPath = "schemas/report-definition-v2.schema.json";
const reportDefinitionV3SchemaPath = "schemas/report-definition-v3.schema.json";
const reportDefinitionV4SchemaPath = "schemas/report-definition-v4.schema.json";
const reportStartSchemaPath = "schemas/report-start-v1.schema.json";
const preparedReportStartSchemaPath = "schemas/prepared-report-start-v1.schema.json";
const reportCreateV4SchemaPath = "schemas/report-create-v4.schema.json";
const reportUpdateV4SchemaPath = "schemas/report-update-v4.schema.json";
const reportRefreshSchemaPath = "schemas/report-refresh-v1.schema.json";
const reportRemoveSchemaPath = "schemas/report-remove-v1.schema.json";
const removedReportSchemaPath = "schemas/removed-report-v1.schema.json";
const reportLibraryQuerySchemaPath = "schemas/report-library-query-v1.schema.json";
const reportLibrarySchemaPath = "schemas/report-library-v1.schema.json";
const reportResolutionV4SchemaPath = "schemas/report-resolution-v4.schema.json";
const reportExportV4SchemaPath = "schemas/report-export-v4.schema.json";
const sessionReportCreateSchemaPath = "schemas/session-report-create-v1.schema.json";
const sessionReportCreateV2SchemaPath = "schemas/session-report-create-v2.schema.json";
const sessionReportCreateV3SchemaPath = "schemas/session-report-create-v3.schema.json";
const sessionReportUpdateSchemaPath = "schemas/session-report-update-v1.schema.json";
const sessionReportUpdateV2SchemaPath = "schemas/session-report-update-v2.schema.json";
const sessionReportUpdateV3SchemaPath = "schemas/session-report-update-v3.schema.json";
const reportListSchemaPath = "schemas/report-list-v1.schema.json";
const sessionReportResolutionSchemaPath = "schemas/session-report-resolution-v1.schema.json";
const sessionReportResolutionV2SchemaPath = "schemas/session-report-resolution-v2.schema.json";
const sessionReportResolutionV3SchemaPath = "schemas/session-report-resolution-v3.schema.json";
const sessionReportExportSchemaPath = "schemas/session-report-export-v1.schema.json";
const sessionReportExportV2SchemaPath = "schemas/session-report-export-v2.schema.json";
const reportExportReceiptSchemaPath = "schemas/report-export-receipt-v1.schema.json";

for (const [documentPath, fields] of [
  [reportDefinitionCanonicalPath, [
    "reportRef", "title", "locale", "sourceSnapshotRef", "origin", "provenancePolicy",
    "authorship", "definitionVersion", "revision", "blocks", "session-evidence", "narrative",
  ]],
  [reportDefinitionPortablePath, [
    "application/vnd.fitfreed.report-definition+json;version=1", "origin.sessionRef",
    "sessionRef", "revision",
  ]],
  [sessionReportPath, [
    "resolvedSnapshotRef", "status", "sensitiveContents", "limitations",
    "report-definition-conflict", "report-export-cancelled", "report-export-failed",
  ]],
  [reportHtmlPath, ["metric-v1", "text/html", "data-fitfreed-report-version"]],
  [reportDefinitionCanonicalV2Path, [
    "definitionVersion", "session-evidence", "route", "narrative",
    "endpointRedactionMeters", "routeRef", "blockRef",
  ]],
  [reportDefinitionPortableV2Path, [
    "application/vnd.fitfreed.report-definition+json;version=2", "routeRef",
    "endpointRedactionMeters", "revision",
  ]],
  [sessionReportV2Path, [
    "routes", "sensitiveContents", "precise-location", "routeChoices",
    "report-definition-conflict",
  ]],
  [reportHtmlV2Path, ["text/html", "data-fitfreed-report-version", "polyline"]],
  [reportDefinitionCanonicalV3Path, [
    "training-period-comparison", "training-finding", "training-comparison",
    "training-chart", "training-exact-table", "training-coverage", "questionVersion",
  ]],
  [reportDefinitionPortableV3Path, [
    "application/vnd.fitfreed.report-definition+json;version=3", "baselineRange",
    "comparisonRange", "duration",
  ]],
  [sessionReportV3Path, [
    "trainingComparison", "report-source-changed", "training-comparison-v1", "routeChoices",
  ]],
  [reportHtmlV3Path, [
    "data-fitfreed-report-version", "training-finding", "CSS-only", "<data>",
  ]],
  [reportDefinitionCanonicalV4Path, [
    "definitionVersion", "session", "question", "exploration", "blank",
    "sourceSnapshotRef", "authored-only",
  ]],
  [reportDefinitionPortableV4Path, [
    "application/vnd.fitfreed.report-definition+json;version=4", "report-start-v1.schema.json",
    "report-create-v4.schema.json", "report-resolution-v4.schema.json", "provenance",
  ]],
  [reportV4Path, [
    "prepared-report-start-v1", "expectedRevision", "trainingComparison",
    "library-snapshot", "authored-only", "report-source-changed", "report-refresh-v1",
    "report-library-query-v1", "evidenceState", "result",
  ]],
  [reportHtmlV4Path, [
    "text/html", "data-fitfreed-report-version", "library-snapshot", "authored-only", "<data>",
  ]],
]) {
  const document = read(documentPath);
  for (const field of fields) requireMention(document, field, documentPath);
}

function compileReportSchema(schemaPath) {
  return ajv.compile(JSON.parse(read(schemaPath)));
}

function assertReportContract(validate, schemaPath, value) {
  if (!validate(value)) {
    throw new Error(
      `${schemaPath} rejected its synthetic value: ${ajv.errorsText(validate.errors)}`,
    );
  }
}

for (const dependencyPath of [
  trainingSessionSearchSchemaPath,
  trainingSessionProvenanceSchemaPath,
]) {
  const dependency = JSON.parse(read(dependencyPath));
  if (!ajv.getSchema(dependency.$id)) ajv.addSchema(dependency);
}

const validateReportDefinition = compileReportSchema(reportDefinitionSchemaPath);
const validateReportDefinitionV2 = compileReportSchema(reportDefinitionV2SchemaPath);
const validateReportDefinitionV3 = compileReportSchema(reportDefinitionV3SchemaPath);
const validateReportDefinitionV4 = compileReportSchema(reportDefinitionV4SchemaPath);
const validateReportStart = compileReportSchema(reportStartSchemaPath);
const validatePreparedReportStart = compileReportSchema(preparedReportStartSchemaPath);
const validateSessionReportCreate = compileReportSchema(sessionReportCreateSchemaPath);
const validateSessionReportCreateV2 = compileReportSchema(sessionReportCreateV2SchemaPath);
const validateSessionReportCreateV3 = compileReportSchema(sessionReportCreateV3SchemaPath);
const validateReportCreateV4 = compileReportSchema(reportCreateV4SchemaPath);
const validateSessionReportUpdate = compileReportSchema(sessionReportUpdateSchemaPath);
const validateSessionReportUpdateV2 = compileReportSchema(sessionReportUpdateV2SchemaPath);
const validateSessionReportUpdateV3 = compileReportSchema(sessionReportUpdateV3SchemaPath);
const validateReportUpdateV4 = compileReportSchema(reportUpdateV4SchemaPath);
const validateReportRefresh = compileReportSchema(reportRefreshSchemaPath);
const validateReportRemove = compileReportSchema(reportRemoveSchemaPath);
const validateRemovedReport = compileReportSchema(removedReportSchemaPath);
const validateReportLibraryQuery = compileReportSchema(reportLibraryQuerySchemaPath);
const validateReportLibrary = compileReportSchema(reportLibrarySchemaPath);
const validateReportList = compileReportSchema(reportListSchemaPath);
const validateSessionReportResolution = compileReportSchema(sessionReportResolutionSchemaPath);
const validateSessionReportResolutionV2 = compileReportSchema(sessionReportResolutionV2SchemaPath);
const validateSessionReportResolutionV3 = compileReportSchema(sessionReportResolutionV3SchemaPath);
const validateReportResolutionV4 = compileReportSchema(reportResolutionV4SchemaPath);
const validateSessionReportExport = compileReportSchema(sessionReportExportSchemaPath);
const validateSessionReportExportV2 = compileReportSchema(sessionReportExportV2SchemaPath);
const validateReportExportV4 = compileReportSchema(reportExportV4SchemaPath);
const validateReportExportReceipt = compileReportSchema(reportExportReceiptSchemaPath);
const reportRefDigest = `report-${"3".repeat(64)}`;
const firstReportBlockRefDigest = `report-block-${"4".repeat(64)}`;
const secondReportBlockRefDigest = `report-block-${"5".repeat(64)}`;
const syntheticReportDefinition = {
  reportRef: reportRefDigest,
  title: "Morning progression",
  locale: "en-US",
  sourceSnapshotRef: snapshotRefDigest,
  origin: { kind: "session", sessionRef: sessionRefDigest },
  provenancePolicy: "current-attribution",
  authorship: "user",
  definitionVersion: 1,
  revision: "1",
  blocks: [
    {
      blockRef: firstReportBlockRefDigest,
      kind: "session-evidence",
      sessionRef: sessionRefDigest,
      includePhysiologicalContext: true,
    },
    {
      blockRef: secondReportBlockRefDigest,
      kind: "narrative",
      body: "The final section felt controlled.",
    },
  ],
};
assertReportContract(
  validateReportDefinition,
  reportDefinitionSchemaPath,
  syntheticReportDefinition,
);
for (const invalidDefinition of [
  { ...structuredClone(syntheticReportDefinition), definitionVersion: 2 },
  { ...structuredClone(syntheticReportDefinition), revision: "01" },
  { ...structuredClone(syntheticReportDefinition), providerSessionId: "must-not-cross" },
  (() => {
    const value = structuredClone(syntheticReportDefinition);
    value.blocks.reverse();
    return value;
  })(),
]) {
  if (validateReportDefinition(invalidDefinition)) {
    throw new Error(`${reportDefinitionSchemaPath} accepted an invalid definition`);
  }
}

const syntheticSessionReportCreate = {
  title: syntheticReportDefinition.title,
  locale: syntheticReportDefinition.locale,
  sessionRef: sessionRefDigest,
  sourceSnapshotRef: snapshotRefDigest,
  includePhysiologicalContext: true,
  narrative: syntheticReportDefinition.blocks[1].body,
};
assertReportContract(
  validateSessionReportCreate,
  sessionReportCreateSchemaPath,
  syntheticSessionReportCreate,
);
if (validateSessionReportCreate({ ...syntheticSessionReportCreate, locale: "en-GB" })) {
  throw new Error(`${sessionReportCreateSchemaPath} accepted an unsupported locale`);
}

const syntheticSessionReportUpdate = {
  reportRef: reportRefDigest,
  expectedRevision: "1",
  title: "Morning progression review",
  locale: "es-ES",
  includePhysiologicalContext: false,
  narrative: "El tramo final se mantuvo controlado.",
};
assertReportContract(
  validateSessionReportUpdate,
  sessionReportUpdateSchemaPath,
  syntheticSessionReportUpdate,
);
if (validateSessionReportUpdate({ ...syntheticSessionReportUpdate, expectedRevision: "0" })) {
  throw new Error(`${sessionReportUpdateSchemaPath} accepted a zero revision`);
}

const syntheticReportList = {
  reports: [{
    reportRef: reportRefDigest,
    title: syntheticReportDefinition.title,
    locale: syntheticReportDefinition.locale,
    sourceSnapshotRef: snapshotRefDigest,
    revision: "1",
  }],
};
assertReportContract(validateReportList, reportListSchemaPath, syntheticReportList);
if (validateReportList({ reports: [{ ...syntheticReportList.reports[0], narrative: "private" }] })) {
  throw new Error(`${reportListSchemaPath} accepted narrative content in a bounded list`);
}

const syntheticSessionReportResolution = {
  definition: syntheticReportDefinition,
  resolvedSnapshotRef: snapshotRefDigest,
  status: "current",
  session: syntheticTrainingSessionSearch.sessions[0],
  provenance: syntheticTrainingSessionProvenance.current,
  sensitiveContents: [{ kind: "heart-rate", included: true }],
  limitations: [],
};
assertReportContract(
  validateSessionReportResolution,
  sessionReportResolutionSchemaPath,
  syntheticSessionReportResolution,
);
if (validateSessionReportResolution({
  ...structuredClone(syntheticSessionReportResolution),
  sensitiveContents: [{ kind: "location", included: true }],
})) {
  throw new Error(`${sessionReportResolutionSchemaPath} accepted unreviewed location content`);
}

const syntheticSessionReportExport = {
  reportRef: reportRefDigest,
  expectedRevision: "1",
  expectedSourceSnapshotRef: snapshotRefDigest,
  includePhysiologicalContext: false,
  destinationPath: "/private/synthetic/fitfreed-report.html",
};
assertReportContract(
  validateSessionReportExport,
  sessionReportExportSchemaPath,
  syntheticSessionReportExport,
);
if (validateSessionReportExport({ ...syntheticSessionReportExport, destinationPath: "" })) {
  throw new Error(`${sessionReportExportSchemaPath} accepted an empty destination`);
}

const routeReportBlockRefDigest = `report-block-${"6".repeat(64)}`;
const syntheticReportDefinitionV2 = {
  ...structuredClone(syntheticReportDefinition),
  definitionVersion: 2,
  blocks: [
    {
      blockRef: routeReportBlockRefDigest,
      kind: "route",
      sessionRef: sessionRefDigest,
      routeRef: routeRefDigest,
      endpointRedactionMeters: 200,
    },
    structuredClone(syntheticReportDefinition.blocks[1]),
    structuredClone(syntheticReportDefinition.blocks[0]),
  ],
};
assertReportContract(
  validateReportDefinitionV2,
  reportDefinitionV2SchemaPath,
  syntheticReportDefinitionV2,
);
for (const invalidDefinition of [
  { ...structuredClone(syntheticReportDefinitionV2), definitionVersion: 1 },
  (() => {
    const value = structuredClone(syntheticReportDefinitionV2);
    value.blocks.push(structuredClone(value.blocks[2]));
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticReportDefinitionV2);
    value.blocks[0].endpointRedactionMeters = 5001;
    return value;
  })(),
]) {
  if (validateReportDefinitionV2(invalidDefinition)) {
    throw new Error(`${reportDefinitionV2SchemaPath} accepted an invalid definition`);
  }
}

const syntheticSessionReportCreateV2 = {
  title: syntheticReportDefinitionV2.title,
  locale: syntheticReportDefinitionV2.locale,
  sessionRef: sessionRefDigest,
  sourceSnapshotRef: snapshotRefDigest,
  blocks: syntheticReportDefinitionV2.blocks.map(({ blockRef: _blockRef, sessionRef: _sessionRef, ...block }) => block),
};
assertReportContract(
  validateSessionReportCreateV2,
  sessionReportCreateV2SchemaPath,
  syntheticSessionReportCreateV2,
);
if (validateSessionReportCreateV2({
  ...structuredClone(syntheticSessionReportCreateV2),
  blocks: syntheticSessionReportCreateV2.blocks.filter((block) => block.kind !== "narrative"),
})) {
  throw new Error(`${sessionReportCreateV2SchemaPath} accepted a composition without narrative`);
}
if (validateSessionReportCreateV2({
  ...structuredClone(syntheticSessionReportCreateV2),
  blocks: syntheticSessionReportCreateV2.blocks.map((block, index) => index === 0
    ? { ...block, blockRef: routeReportBlockRefDigest }
    : block),
})) {
  throw new Error(`${sessionReportCreateV2SchemaPath} accepted a caller-owned block identity`);
}

const syntheticSessionReportUpdateV2 = {
  reportRef: reportRefDigest,
  expectedRevision: "1",
  title: "Morning route review",
  locale: "es-ES",
  blocks: syntheticReportDefinitionV2.blocks.map(({ sessionRef: _sessionRef, ...block }) => block),
};
assertReportContract(
  validateSessionReportUpdateV2,
  sessionReportUpdateV2SchemaPath,
  syntheticSessionReportUpdateV2,
);
if (validateSessionReportUpdateV2({ ...syntheticSessionReportUpdateV2, expectedRevision: "01" })) {
  throw new Error(`${sessionReportUpdateV2SchemaPath} accepted a non-canonical revision`);
}

const syntheticRouteEvidence = {
  blockRef: routeReportBlockRefDigest,
  routeRef: routeRefDigest,
  kind: "primary",
  startedAtLocal: "2026-08-18T08:30:00.000",
  sourcePointCount: 3,
  visualPoints: [syntheticRoutePoint],
  endpointRedactionMeters: 200,
  included: true,
};
const syntheticSessionReportResolutionV2 = {
  ...structuredClone(syntheticSessionReportResolution),
  definition: syntheticReportDefinitionV2,
  routes: [syntheticRouteEvidence],
  sensitiveContents: [
    {
      kind: "heart-rate",
      blockRef: null,
      included: true,
      endpointRedactionMeters: null,
    },
    {
      kind: "precise-location",
      blockRef: routeReportBlockRefDigest,
      included: true,
      endpointRedactionMeters: 200,
    },
  ],
};
assertReportContract(
  validateSessionReportResolutionV2,
  sessionReportResolutionV2SchemaPath,
  syntheticSessionReportResolutionV2,
);
if (validateSessionReportResolutionV2({
  ...structuredClone(syntheticSessionReportResolutionV2),
  routes: [{ ...syntheticRouteEvidence, endpointRedactionMeters: -1 }],
})) {
  throw new Error(`${sessionReportResolutionV2SchemaPath} accepted negative route redaction`);
}

const syntheticSessionReportExportV2 = {
  ...syntheticSessionReportExport,
  routeChoices: [{
    blockRef: routeReportBlockRefDigest,
    includeGeometry: true,
    endpointRedactionMeters: 500,
  }],
};
assertReportContract(
  validateSessionReportExportV2,
  sessionReportExportV2SchemaPath,
  syntheticSessionReportExportV2,
);
if (validateSessionReportExportV2({
  ...structuredClone(syntheticSessionReportExportV2),
  routeChoices: [{
    blockRef: routeReportBlockRefDigest,
    includeGeometry: true,
    endpointRedactionMeters: 5001,
  }],
})) {
  throw new Error(`${sessionReportExportV2SchemaPath} accepted excessive route redaction`);
}

const analyticalQuestion = {
  question: "training-period-comparison",
  questionVersion: 1,
  ...structuredClone(syntheticTrainingComparisonQuery),
};
const analyticalBlocks = [
  {
    blockRef: `report-block-${"a".repeat(64)}`,
    kind: "training-finding",
    query: structuredClone(analyticalQuestion),
    metric: "session-count",
  },
  {
    blockRef: `report-block-${"b".repeat(64)}`,
    kind: "training-comparison",
    query: structuredClone(analyticalQuestion),
  },
  {
    blockRef: `report-block-${"c".repeat(64)}`,
    kind: "training-chart",
    query: structuredClone(analyticalQuestion),
    metric: "duration",
  },
  {
    blockRef: `report-block-${"d".repeat(64)}`,
    kind: "training-exact-table",
    query: structuredClone(analyticalQuestion),
  },
  {
    blockRef: `report-block-${"e".repeat(64)}`,
    kind: "training-coverage",
    query: structuredClone(analyticalQuestion),
  },
];
const syntheticReportDefinitionV3 = {
  ...structuredClone(syntheticReportDefinitionV2),
  definitionVersion: 3,
  blocks: [
    structuredClone(syntheticReportDefinitionV2.blocks[2]),
    ...analyticalBlocks,
    structuredClone(syntheticReportDefinitionV2.blocks[0]),
    structuredClone(syntheticReportDefinitionV2.blocks[1]),
  ],
};
assertReportContract(
  validateReportDefinitionV3,
  reportDefinitionV3SchemaPath,
  syntheticReportDefinitionV3,
);
for (const invalidDefinition of [
  { ...structuredClone(syntheticReportDefinitionV3), definitionVersion: 2 },
  (() => {
    const value = structuredClone(syntheticReportDefinitionV3);
    value.blocks.push(structuredClone(analyticalBlocks[0]));
    value.blocks.at(-1).blockRef = `report-block-${"f".repeat(64)}`;
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticReportDefinitionV3);
    value.blocks[1].metric = "pace";
    return value;
  })(),
  (() => {
    const value = structuredClone(syntheticReportDefinitionV3);
    value.blocks[1].query.baselineRange.from = "2026-02-30";
    return value;
  })(),
]) {
  if (validateReportDefinitionV3(invalidDefinition)) {
    throw new Error(`${reportDefinitionV3SchemaPath} accepted an invalid definition`);
  }
}

const syntheticSessionReportCreateV3 = {
  title: syntheticReportDefinitionV3.title,
  locale: syntheticReportDefinitionV3.locale,
  sessionRef: sessionRefDigest,
  sourceSnapshotRef: snapshotRefDigest,
  blocks: syntheticReportDefinitionV3.blocks.map(({
    blockRef: _blockRef,
    sessionRef: _sessionRef,
    ...block
  }) => block),
};
assertReportContract(
  validateSessionReportCreateV3,
  sessionReportCreateV3SchemaPath,
  syntheticSessionReportCreateV3,
);
if (validateSessionReportCreateV3({
  ...structuredClone(syntheticSessionReportCreateV3),
  blocks: syntheticSessionReportCreateV3.blocks.map((block, index) => index === 1
    ? { ...block, blockRef: analyticalBlocks[0].blockRef }
    : block),
})) {
  throw new Error(`${sessionReportCreateV3SchemaPath} accepted a caller-owned block identity`);
}

const syntheticSessionReportUpdateV3 = {
  reportRef: reportRefDigest,
  expectedRevision: "1",
  title: syntheticReportDefinitionV3.title,
  locale: "es-ES",
  blocks: syntheticReportDefinitionV3.blocks.map(({
    sessionRef: _sessionRef,
    ...block
  }) => block),
};
assertReportContract(
  validateSessionReportUpdateV3,
  sessionReportUpdateV3SchemaPath,
  syntheticSessionReportUpdateV3,
);
if (validateSessionReportUpdateV3({
  ...structuredClone(syntheticSessionReportUpdateV3),
  expectedRevision: "+1",
})) {
  throw new Error(`${sessionReportUpdateV3SchemaPath} accepted a non-canonical revision`);
}

const syntheticSessionReportResolutionV3 = {
  ...structuredClone(syntheticSessionReportResolutionV2),
  definition: syntheticReportDefinitionV3,
  trainingComparison: structuredClone(syntheticTrainingComparison),
};
assertReportContract(
  validateSessionReportResolutionV3,
  sessionReportResolutionV3SchemaPath,
  syntheticSessionReportResolutionV3,
);
if (validateSessionReportResolutionV3({
  ...structuredClone(syntheticSessionReportResolutionV3),
  trainingComparison: {
    ...structuredClone(syntheticTrainingComparison),
    providerAccount: "must-not-cross-the-boundary",
  },
})) {
  throw new Error(`${sessionReportResolutionV3SchemaPath} accepted provider identity`);
}

const syntheticQuestionOrigin = {
  kind: "question",
  question: "training-period-comparison",
  questionVersion: 1,
};
const syntheticExplorationOrigin = {
  kind: "exploration",
  query: structuredClone(analyticalQuestion),
};
const syntheticQuestionDefinitionV4 = {
  ...structuredClone(syntheticReportDefinitionV3),
  definitionVersion: 4,
  origin: syntheticQuestionOrigin,
  blocks: [
    ...structuredClone(analyticalBlocks),
    structuredClone(syntheticReportDefinition.blocks[1]),
  ],
};
const syntheticExplorationDefinitionV4 = {
  ...structuredClone(syntheticQuestionDefinitionV4),
  origin: syntheticExplorationOrigin,
};
const syntheticBlankDefinitionV4 = {
  ...structuredClone(syntheticQuestionDefinitionV4),
  origin: { kind: "blank" },
  blocks: [structuredClone(syntheticReportDefinition.blocks[1])],
};
const syntheticSessionDefinitionV4 = {
  ...structuredClone(syntheticReportDefinitionV3),
  definitionVersion: 4,
};
const syntheticFactualDefinitionV4 = {
  ...structuredClone(syntheticSessionDefinitionV4),
  blocks: syntheticSessionDefinitionV4.blocks.filter((block) => block.kind !== "narrative"),
};
for (const definition of [
  syntheticSessionDefinitionV4,
  syntheticFactualDefinitionV4,
  syntheticQuestionDefinitionV4,
  syntheticExplorationDefinitionV4,
  syntheticBlankDefinitionV4,
]) {
  assertReportContract(validateReportDefinitionV4, reportDefinitionV4SchemaPath, definition);
}
for (const invalidDefinition of [
  { ...structuredClone(syntheticQuestionDefinitionV4), definitionVersion: 3 },
  {
    ...structuredClone(syntheticQuestionDefinitionV4),
    blocks: [structuredClone(syntheticReportDefinition.blocks[1])],
  },
  {
    ...structuredClone(syntheticBlankDefinitionV4),
    blocks: [
      structuredClone(syntheticReportDefinition.blocks[0]),
      structuredClone(syntheticReportDefinition.blocks[1]),
    ],
  },
]) {
  if (validateReportDefinitionV4(invalidDefinition)) {
    throw new Error(`${reportDefinitionV4SchemaPath} accepted an invalid definition`);
  }
}

for (const start of [
  syntheticQuestionOrigin,
  syntheticExplorationOrigin,
  { kind: "blank" },
]) {
  assertReportContract(validateReportStart, reportStartSchemaPath, start);
}
if (validateReportStart({ kind: "session", sessionRef: sessionRefDigest })) {
  throw new Error(`${reportStartSchemaPath} accepted a session start`);
}
const syntheticPreparedReportStart = {
  sourceSnapshotRef: snapshotRefDigest,
  origin: syntheticQuestionOrigin,
  suggestedQuery: structuredClone(analyticalQuestion),
};
assertReportContract(
  validatePreparedReportStart,
  preparedReportStartSchemaPath,
  syntheticPreparedReportStart,
);
if (validatePreparedReportStart({
  ...structuredClone(syntheticPreparedReportStart),
  origin: { kind: "session", sessionRef: sessionRefDigest },
})) {
  throw new Error(`${preparedReportStartSchemaPath} accepted a session origin`);
}

const syntheticReportCreateV4 = {
  title: syntheticQuestionDefinitionV4.title,
  locale: syntheticQuestionDefinitionV4.locale,
  sourceSnapshotRef: snapshotRefDigest,
  origin: syntheticQuestionOrigin,
  blocks: syntheticQuestionDefinitionV4.blocks.map(({ blockRef: _blockRef, ...block }) => block),
};
assertReportContract(validateReportCreateV4, reportCreateV4SchemaPath, syntheticReportCreateV4);
assertReportContract(
  validateReportCreateV4,
  reportCreateV4SchemaPath,
  {
    ...structuredClone(syntheticReportCreateV4),
    blocks: syntheticReportCreateV4.blocks.filter((block) => block.kind !== "narrative"),
  },
);
if (validateReportCreateV4({
  ...structuredClone(syntheticReportCreateV4),
  blocks: [structuredClone(syntheticReportCreateV4.blocks.at(-1))],
})) {
  throw new Error(`${reportCreateV4SchemaPath} accepted a question without analytical evidence`);
}

const syntheticReportUpdateV4 = {
  reportRef: reportRefDigest,
  expectedRevision: "1",
  title: syntheticQuestionDefinitionV4.title,
  locale: "es-ES",
  blocks: structuredClone(syntheticQuestionDefinitionV4.blocks),
};
assertReportContract(validateReportUpdateV4, reportUpdateV4SchemaPath, syntheticReportUpdateV4);
assertReportContract(
  validateReportUpdateV4,
  reportUpdateV4SchemaPath,
  {
    ...structuredClone(syntheticReportUpdateV4),
    blocks: syntheticReportUpdateV4.blocks.filter((block) => block.kind !== "narrative"),
  },
);
if (validateReportUpdateV4({ ...syntheticReportUpdateV4, expectedRevision: "01" })) {
  throw new Error(`${reportUpdateV4SchemaPath} accepted a non-canonical revision`);
}

const syntheticReportRefresh = {
  reportRef: reportRefDigest,
  expectedRevision: "1",
  expectedSourceSnapshotRef: snapshotRefDigest,
  expectedResolvedSnapshotRef: `training-snapshot-${"f".repeat(64)}`,
};
assertReportContract(validateReportRefresh, reportRefreshSchemaPath, syntheticReportRefresh);
for (const invalidRefresh of [
  { ...syntheticReportRefresh, expectedRevision: "01" },
  { ...syntheticReportRefresh, expectedResolvedSnapshotRef: "training-snapshot-invalid" },
  { ...syntheticReportRefresh, provider: "must-not-cross-the-boundary" },
]) {
  if (validateReportRefresh(invalidRefresh)) {
    throw new Error(`${reportRefreshSchemaPath} accepted an invalid refresh request`);
  }
}

const syntheticReportRemove = {
  reportRef: reportRefDigest,
  expectedRevision: "1",
};
assertReportContract(validateReportRemove, reportRemoveSchemaPath, syntheticReportRemove);
for (const invalidRemoval of [
  { ...syntheticReportRemove, expectedRevision: "01" },
  { ...syntheticReportRemove, provider: "must-not-cross-the-boundary" },
]) {
  if (validateReportRemove(invalidRemoval)) {
    throw new Error(`${reportRemoveSchemaPath} accepted an invalid removal request`);
  }
}

const syntheticRemovedReport = {
  reportRef: reportRefDigest,
  title: syntheticReportDefinition.title,
  revision: "1",
};
assertReportContract(validateRemovedReport, removedReportSchemaPath, syntheticRemovedReport);
if (validateRemovedReport({ ...syntheticRemovedReport, revision: "0" })) {
  throw new Error(`${removedReportSchemaPath} accepted an invalid removal result`);
}

const syntheticReportLibraryQuery = { offset: 0, limit: 12 };
assertReportContract(
  validateReportLibraryQuery,
  reportLibraryQuerySchemaPath,
  syntheticReportLibraryQuery,
);
for (const invalidLibraryQuery of [
  { offset: 0, limit: 25 },
  { ...syntheticReportLibraryQuery, provider: "must-not-cross-the-boundary" },
]) {
  if (validateReportLibraryQuery(invalidLibraryQuery)) {
    throw new Error(`${reportLibraryQuerySchemaPath} accepted an invalid query`);
  }
}

const syntheticReportLibrary = {
  items: [{
    reportRef: reportRefDigest,
    title: syntheticReportDefinition.title,
    locale: syntheticReportDefinition.locale,
    sourceSnapshotRef: snapshotRefDigest,
    revision: "1",
    evidenceState: "current",
    subject: {
      kind: "session",
      sport: structuredClone(syntheticTrainingSessionSearch.sessions[0].sport),
    },
    period: {
      kind: "session",
      startedAtLocal: syntheticTrainingSessionSearch.sessions[0].startedAtLocal,
    },
    result: {
      kind: "session",
      metric: "distance",
      value: { kind: "decimal", value: 10_000 },
    },
    sensitivity: {
      includesPhysiologicalContext: true,
      preciseLocationBlockCount: 1,
      minimumEndpointRedactionMeters: 200,
    },
  }],
  totalCount: 1,
  offset: 0,
  limit: 12,
  nextOffset: null,
};
assertReportContract(validateReportLibrary, reportLibrarySchemaPath, syntheticReportLibrary);
assertReportContract(
  validateReportLibrary,
  reportLibrarySchemaPath,
  {
    ...structuredClone(syntheticReportLibrary),
    items: [{
      ...structuredClone(syntheticReportLibrary.items[0]),
      evidenceState: "authored-only",
      subject: { kind: "authored-note" },
      period: null,
      result: null,
      sensitivity: {
        includesPhysiologicalContext: false,
        preciseLocationBlockCount: 0,
        minimumEndpointRedactionMeters: null,
      },
    }],
  },
);
if (validateReportLibrary({
  ...structuredClone(syntheticReportLibrary),
  items: [{ ...structuredClone(syntheticReportLibrary.items[0]), narrative: "private" }],
})) {
  throw new Error(`${reportLibrarySchemaPath} accepted unbounded authored content`);
}

const syntheticQuestionResolutionV4 = {
  definition: syntheticQuestionDefinitionV4,
  resolvedSnapshotRef: snapshotRefDigest,
  status: "current",
  session: null,
  routes: [],
  trainingComparison: structuredClone(syntheticTrainingComparison),
  provenance: { kind: "library-snapshot" },
  sensitiveContents: [],
  limitations: [],
};
assertReportContract(
  validateReportResolutionV4,
  reportResolutionV4SchemaPath,
  syntheticQuestionResolutionV4,
);
const syntheticBlankResolutionV4 = {
  ...structuredClone(syntheticQuestionResolutionV4),
  definition: syntheticBlankDefinitionV4,
  trainingComparison: null,
  provenance: { kind: "authored-only" },
};
assertReportContract(
  validateReportResolutionV4,
  reportResolutionV4SchemaPath,
  syntheticBlankResolutionV4,
);
for (const invalidResolution of [
  { ...structuredClone(syntheticQuestionResolutionV4), session: syntheticTrainingSessionSearch.sessions[0] },
  { ...structuredClone(syntheticQuestionResolutionV4), provenance: { kind: "authored-only" } },
  { ...structuredClone(syntheticBlankResolutionV4), provenance: { kind: "library-snapshot" } },
]) {
  if (validateReportResolutionV4(invalidResolution)) {
    throw new Error(`${reportResolutionV4SchemaPath} accepted inconsistent evidence provenance`);
  }
}

assertReportContract(
  validateReportExportV4,
  reportExportV4SchemaPath,
  syntheticSessionReportExportV2,
);
if (validateReportExportV4({
  ...structuredClone(syntheticSessionReportExportV2),
  destinationPath: "",
})) {
  throw new Error(`${reportExportV4SchemaPath} accepted an empty destination`);
}

assertReportContract(
  validateReportExportReceipt,
  reportExportReceiptSchemaPath,
  { byteCount: "4096" },
);
if (validateReportExportReceipt({ byteCount: "04" })) {
  throw new Error(`${reportExportReceiptSchemaPath} accepted a non-canonical byte count`);
}

const providerSportCataloguePath =
  "docs/data-formats/providers/provider-sport-catalogue-v1.md";
const trainingSportIdentityPath =
  "docs/data-formats/insights/training-sport-identity-v1.md";
const trainingSportsV2Path = "docs/data-formats/insights/training-sports-v2.md";
const trainingSessionSearchV2Path =
  "docs/data-formats/insights/training-session-search-v2.md";
const trainingSessionStructureV2Path =
  "docs/data-formats/insights/training-session-structure-v2.md";
const trainingSessionRangeSummaryV2Path =
  "docs/data-formats/insights/training-session-range-summary-v2.md";
const sessionStoryV4Path = "docs/data-formats/insights/session-story-v4.md";
const libraryHomeV5Path = "docs/data-formats/insights/library-home-v5.md";
const sessionReportV4Path = "docs/data-formats/insights/session-report-v4.md";
const reportV5Path = "docs/data-formats/insights/report-v5.md";
const reportHtmlV5Path = "docs/data-formats/portable/report-html-v5.md";

for (const [documentPath, fields] of [
  [providerSportCataloguePath, [
    "sourceProvider", "catalogueRevision", "retrievedAtUtc", "provenanceUri",
    "provenanceSha256", "mappingVersion", "sourceIdentifier", "providerNameKey",
    "localizedNames", "parentIdentifier", "canonicalFamilySuggestion", "sports:read",
  ]],
  [trainingSportIdentityPath, [
    "sportRef", "state", "classification", "recognition", "recognitionCandidateCount",
    "recognized", "ambiguous", "unknown", "personally-overridden", "unavailable",
    "catalogueRevision", "retrievedAtUtc", "mappingVersion", "evidenceRef",
  ]],
  [trainingSportsV2Path, [
    "query_training_sports", "save_training_sport_classification", "originCount",
    "sessionCount", "sports", "sourceIndex", "firstLocalDate", "lastLocalDate",
    "coverage", "recognition", "recognitionCandidateCount", "personally-overridden",
  ]],
  [trainingSessionSearchV2Path, [
    "query_training_sessions", "query_training_session_selection", "sport",
    "recognized", "ambiguous", "unknown", "personally-overridden", "unavailable",
    "recognitionCandidateCount",
  ]],
  [trainingSessionStructureV2Path, [
    "query_training_session_structure", "structure", "exercises", "sport",
    "recognitionCandidateCount",
  ]],
  [trainingSessionRangeSummaryV2Path, [
    "query_training_session_range_summary", "range", "exercise", "sport",
    "recognitionCandidateCount",
  ]],
  [sessionStoryV4Path, [
    "schemaVersion", "session", "structure", "exercises", "sport",
    "recognitionCandidateCount",
  ]],
  [libraryHomeV5Path, [
    "version", "training.sports", "recentSessions", "localizedNames",
    "recognitionCandidateCount", "recognized", "ambiguous", "unknown",
    "personally-overridden", "unavailable",
  ]],
  [sessionReportV4Path, [
    "session-report-resolution-v4.schema.json", "training-session-search-v2.schema.json",
    "sport", "recognitionCandidateCount",
  ]],
  [reportV5Path, [
    "report-library-v2.schema.json", "report-resolution-v5.schema.json", "subject.sport",
    "recognitionCandidateCount",
  ]],
  [reportHtmlV5Path, [
    "text/html", "data-fitfreed-output-version=\"5\"", "data-fitfreed-report-version",
  ]],
]) {
  const document = read(documentPath);
  for (const field of fields) requireMention(document, field, documentPath);
}

function addContractSchema(schemaPath) {
  const schema = JSON.parse(read(schemaPath));
  if (!ajv.getSchema(schema.$id)) ajv.addSchema(schema);
  return schema;
}

function compileContractSchema(schemaPath) {
  const schema = JSON.parse(read(schemaPath));
  return ajv.getSchema(schema.$id) ?? ajv.compile(schema);
}

function assertContract(validate, schemaPath, value) {
  if (!validate(value)) {
    throw new Error(
      `${schemaPath} rejected its synthetic value: ${ajv.errorsText(validate.errors)}`,
    );
  }
}

const providerSportCatalogueSchemaPath =
  "schemas/provider-sport-catalogue-v1.schema.json";
const trainingSportIdentitySchemaPath =
  "schemas/training-sport-identity-v1.schema.json";
const trainingSportsV2SchemaPath = "schemas/training-sports-v2.schema.json";
const savedSportClassificationV2SchemaPath =
  "schemas/saved-sport-classification-v2.schema.json";
const trainingSessionSearchV2SchemaPath =
  "schemas/training-session-search-v2.schema.json";
const trainingSessionSelectionV2SchemaPath =
  "schemas/training-session-selection-v2.schema.json";
const trainingSessionStructureV2SchemaPath =
  "schemas/training-session-structure-v2.schema.json";
const trainingSessionRangeSummaryV2SchemaPath =
  "schemas/training-session-range-summary-v2.schema.json";
const sessionStoryV4SchemaPath = "schemas/session-story-v4.schema.json";
const libraryHomeV5SchemaPath = "schemas/library-home-v5.schema.json";
const reportLibraryV2SchemaPath = "schemas/report-library-v2.schema.json";
const sessionReportResolutionV4SchemaPath =
  "schemas/session-report-resolution-v4.schema.json";
const reportResolutionV5SchemaPath = "schemas/report-resolution-v5.schema.json";

const validateProviderSportCatalogue = compileContractSchema(
  providerSportCatalogueSchemaPath,
);
const syntheticProviderSportCatalogue = {
  sourceProvider: "synthetic-provider",
  catalogueRevision: "synthetic-catalogue-2026-08-25",
  retrievedAtUtc: "2026-08-25T09:30:00Z",
  provenanceUri: "https://example.invalid/synthetic-sport-catalogue",
  provenanceSha256: "1".repeat(64),
  mappingVersion: "synthetic-provider-sports@1",
  entries: [{
    sourceIdentifier: "synthetic-running",
    providerNameKey: "sport.running",
    localizedNames: { "en-US": "Running", "es-ES": "Carrera" },
    parentIdentifier: null,
    canonicalFamilySuggestion: "running",
  }],
};
assertContract(
  validateProviderSportCatalogue,
  providerSportCatalogueSchemaPath,
  syntheticProviderSportCatalogue,
);
for (const invalidCatalogue of [
  { ...structuredClone(syntheticProviderSportCatalogue), retrievedAtUtc: "2026-08-25" },
  { ...structuredClone(syntheticProviderSportCatalogue), provenanceSha256: "not-a-digest" },
  (() => {
    const value = structuredClone(syntheticProviderSportCatalogue);
    value.entries[0].localizedNames = { "en_US": "Running" };
    return value;
  })(),
  { ...structuredClone(syntheticProviderSportCatalogue), accountId: "private" },
]) {
  if (validateProviderSportCatalogue(invalidCatalogue)) {
    throw new Error(`${providerSportCatalogueSchemaPath} accepted invalid catalogue evidence`);
  }
}

addContractSchema(trainingSportIdentitySchemaPath);
const validateTrainingSportIdentity = compileContractSchema(trainingSportIdentitySchemaPath);
const recognizedSportRef = `sport-${"9".repeat(64)}`;
const syntheticRecognition = {
  canonicalFamily: "running",
  localizedNames: { "en-US": "Running", "es-ES": "Carrera" },
  catalogueRevision: "synthetic-catalogue-2026-08-25",
  retrievedAtUtc: "2026-08-25T09:30:00Z",
  mappingVersion: "synthetic-provider-sports@1",
  evidenceRef: `sport-evidence-${"8".repeat(64)}`,
};
const unresolvedClassification = {
  canonicalFamily: null,
  displayLabel: null,
  authorship: null,
  revision: 0,
};
const syntheticRecognizedSport = {
  sportRef: recognizedSportRef,
  state: "recognized",
  classification: unresolvedClassification,
  recognition: syntheticRecognition,
  recognitionCandidateCount: 1,
};
const syntheticAmbiguousSport = {
  sportRef: `sport-${"7".repeat(64)}`,
  state: "ambiguous",
  classification: structuredClone(unresolvedClassification),
  recognition: null,
  recognitionCandidateCount: 2,
};
const syntheticUnknownSportV2 = {
  sportRef: `sport-${"6".repeat(64)}`,
  state: "unknown",
  classification: structuredClone(unresolvedClassification),
  recognition: null,
  recognitionCandidateCount: 0,
};
const syntheticPersonallyOverriddenSport = {
  sportRef: `sport-${"5".repeat(64)}`,
  state: "personally-overridden",
  classification: {
    canonicalFamily: "water-sport",
    displayLabel: "Evening paddle",
    authorship: "user",
    revision: 3,
  },
  recognition: structuredClone(syntheticRecognition),
  recognitionCandidateCount: 1,
};
const syntheticUnavailableSportV2 = {
  sportRef: null,
  state: "unavailable",
  classification: null,
  recognition: null,
  recognitionCandidateCount: 0,
};
for (const identity of [
  syntheticRecognizedSport,
  syntheticAmbiguousSport,
  syntheticUnknownSportV2,
  syntheticPersonallyOverriddenSport,
  syntheticUnavailableSportV2,
]) {
  assertContract(validateTrainingSportIdentity, trainingSportIdentitySchemaPath, identity);
}
for (const invalidIdentity of [
  { ...structuredClone(syntheticRecognizedSport), recognitionCandidateCount: 2 },
  { ...structuredClone(syntheticAmbiguousSport), recognition: syntheticRecognition },
  { ...structuredClone(syntheticUnknownSportV2), sourceIdentifier: "private" },
  { ...structuredClone(syntheticUnavailableSportV2), sportRef: recognizedSportRef },
]) {
  if (validateTrainingSportIdentity(invalidIdentity)) {
    throw new Error(`${trainingSportIdentitySchemaPath} accepted an invalid identity`);
  }
}

const sportCoverage = (sessionCount) => ({
  sessionCount,
  totalDurationMilliseconds: String(sessionCount * 3_600_000),
  distanceSessionCount: sessionCount,
  heartRateSessionCount: Math.max(0, sessionCount - 1),
});
const sportProfile = (identity, sourceIndex, sessionCount) => ({
  ...structuredClone(identity),
  sourceIndex,
  firstLocalDate: "2025-01-02",
  lastLocalDate: "2026-08-17",
  coverage: sportCoverage(sessionCount),
});
const syntheticTrainingSportsV2 = {
  originCount: 2,
  sessionCount: 9,
  sports: [
    sportProfile(syntheticRecognizedSport, 1, 3),
    sportProfile(syntheticAmbiguousSport, 1, 2),
    sportProfile(syntheticUnknownSportV2, 2, 1),
    sportProfile(syntheticPersonallyOverriddenSport, 2, 2),
    sportProfile(syntheticUnavailableSportV2, 2, 1),
  ],
};
const trainingSportsV2Schema = addContractSchema(trainingSportsV2SchemaPath);
if (JSON.stringify(trainingSportsV2Schema.$defs.sport.properties.state.enum)
  !== JSON.stringify([
    "recognized", "ambiguous", "unknown", "personally-overridden", "unavailable",
  ])) {
  throw new Error(`${trainingSportsV2SchemaPath} does not expose the exact identity states`);
}
const validateTrainingSportsV2 = compileContractSchema(trainingSportsV2SchemaPath);
assertContract(validateTrainingSportsV2, trainingSportsV2SchemaPath, syntheticTrainingSportsV2);
if (validateTrainingSportsV2({
  ...structuredClone(syntheticTrainingSportsV2),
  sports: [{ ...sportProfile(syntheticRecognizedSport, 1, 1), provider: "private" }],
})) {
  throw new Error(`${trainingSportsV2SchemaPath} accepted provider identity`);
}

const validateSavedSportClassificationV2 = compileContractSchema(
  savedSportClassificationV2SchemaPath,
);
assertContract(
  validateSavedSportClassificationV2,
  savedSportClassificationV2SchemaPath,
  { outcome: "changed", overview: syntheticTrainingSportsV2 },
);
if (validateSavedSportClassificationV2({
  outcome: "saved",
  overview: syntheticTrainingSportsV2,
})) {
  throw new Error(`${savedSportClassificationV2SchemaPath} accepted an invalid outcome`);
}

addContractSchema(trainingSessionSearchV2SchemaPath);
const validateTrainingSessionSearchV2 = compileContractSchema(
  trainingSessionSearchV2SchemaPath,
);
const syntheticTrainingSessionSearchV2 = structuredClone(syntheticTrainingSessionSearch);
syntheticTrainingSessionSearchV2.sessions[0].sport = structuredClone(syntheticRecognizedSport);
assertContract(
  validateTrainingSessionSearchV2,
  trainingSessionSearchV2SchemaPath,
  syntheticTrainingSessionSearchV2,
);
if (validateTrainingSessionSearchV2({
  ...structuredClone(syntheticTrainingSessionSearchV2),
  sessions: [{
    ...structuredClone(syntheticTrainingSessionSearchV2.sessions[0]),
    sport: { ...structuredClone(syntheticRecognizedSport), sourceIdentifier: "private" },
  }],
})) {
  throw new Error(`${trainingSessionSearchV2SchemaPath} accepted provider identity`);
}

const validateTrainingSessionSelectionV2 = compileContractSchema(
  trainingSessionSelectionV2SchemaPath,
);
const syntheticTrainingSessionSelectionV2 = {
  snapshotRef: snapshotRefDigest,
  sessions: [structuredClone(syntheticTrainingSessionSearchV2.sessions[0])],
};
assertContract(
  validateTrainingSessionSelectionV2,
  trainingSessionSelectionV2SchemaPath,
  syntheticTrainingSessionSelectionV2,
);
if (validateTrainingSessionSelectionV2({
  ...syntheticTrainingSessionSelectionV2,
  sessions: [],
})) {
  throw new Error(`${trainingSessionSelectionV2SchemaPath} accepted an empty selection`);
}

addContractSchema(trainingSessionStructureV2SchemaPath);
const validateTrainingSessionStructureV2 = compileContractSchema(
  trainingSessionStructureV2SchemaPath,
);
const syntheticTrainingSessionStructureV2 = structuredClone(syntheticTrainingSessionStructure);
syntheticTrainingSessionStructureV2.structure.exercises[0].sport =
  structuredClone(syntheticRecognizedSport);
assertContract(
  validateTrainingSessionStructureV2,
  trainingSessionStructureV2SchemaPath,
  syntheticTrainingSessionStructureV2,
);
if (validateTrainingSessionStructureV2({
  ...structuredClone(syntheticTrainingSessionStructureV2),
  structure: {
    exercises: [{
      ...structuredClone(syntheticTrainingSessionStructureV2.structure.exercises[0]),
      sport: { ...structuredClone(syntheticRecognizedSport), providerNameKey: "private" },
    }],
  },
})) {
  throw new Error(`${trainingSessionStructureV2SchemaPath} accepted provider identity`);
}

addContractSchema(trainingSessionRangeSummaryV2SchemaPath);
const validateTrainingSessionRangeSummaryV2 = compileContractSchema(
  trainingSessionRangeSummaryV2SchemaPath,
);
const syntheticTrainingSessionRangeSummaryV2 =
  structuredClone(syntheticTrainingSessionRangeSummary);
syntheticTrainingSessionRangeSummaryV2.exercise.sport =
  structuredClone(syntheticRecognizedSport);
assertContract(
  validateTrainingSessionRangeSummaryV2,
  trainingSessionRangeSummaryV2SchemaPath,
  syntheticTrainingSessionRangeSummaryV2,
);
if (validateTrainingSessionRangeSummaryV2({
  ...structuredClone(syntheticTrainingSessionRangeSummaryV2),
  exercise: {
    ...structuredClone(syntheticTrainingSessionRangeSummaryV2.exercise),
    sport: { ...structuredClone(syntheticRecognizedSport), provider: "private" },
  },
})) {
  throw new Error(`${trainingSessionRangeSummaryV2SchemaPath} accepted provider identity`);
}

addContractSchema(sessionStoryV4SchemaPath);
const validateSessionStoryV4 = compileContractSchema(sessionStoryV4SchemaPath);
const syntheticSessionStoryV4 = structuredClone(syntheticSessionStoryV3);
syntheticSessionStoryV4.schemaVersion = 4;
syntheticSessionStoryV4.session.sport = structuredClone(syntheticRecognizedSport);
syntheticSessionStoryV4.structure.exercises[0].sport =
  structuredClone(syntheticRecognizedSport);
syntheticSessionStoryV4.exercises[0].sport = structuredClone(syntheticRecognizedSport);
assertContract(validateSessionStoryV4, sessionStoryV4SchemaPath, syntheticSessionStoryV4);
if (validateSessionStoryV4({ ...structuredClone(syntheticSessionStoryV4), schemaVersion: 3 })) {
  throw new Error(`${sessionStoryV4SchemaPath} accepted an earlier response version`);
}

addContractSchema(libraryHomeV5SchemaPath);
const validateLibraryHomeV5 = compileContractSchema(libraryHomeV5SchemaPath);
const syntheticLibraryHomeV5 = structuredClone(syntheticLibraryHomeV4);
syntheticLibraryHomeV5.version = 5;
syntheticLibraryHomeV5.training.sports[0] = {
  ...syntheticLibraryHomeV5.training.sports[0],
  state: "recognized",
  displayLabel: null,
  localizedNames: structuredClone(syntheticRecognition.localizedNames),
  recognitionCandidateCount: 1,
};
syntheticLibraryHomeV5.training.sports[1] = {
  ...syntheticLibraryHomeV5.training.sports[1],
  localizedNames: {},
  recognitionCandidateCount: 0,
};
syntheticLibraryHomeV5.training.recentSessions[0] = {
  ...syntheticLibraryHomeV5.training.recentSessions[0],
  sportState: "recognized",
  displayLabel: null,
  localizedNames: structuredClone(syntheticRecognition.localizedNames),
  recognitionCandidateCount: 1,
};
const emptyLibraryHomeV5 = { ...structuredClone(emptyLibraryHomeV4), version: 5 };
const personallyOverriddenLibraryHomeV5 = structuredClone(syntheticLibraryHomeV5);
personallyOverriddenLibraryHomeV5.training.sports[0] = {
  ...personallyOverriddenLibraryHomeV5.training.sports[0],
  state: "personally-overridden",
  canonicalFamily: "running",
  displayLabel: "My running",
  localizedNames: {},
  recognitionCandidateCount: 0,
};
personallyOverriddenLibraryHomeV5.training.recentSessions[0] = {
  ...personallyOverriddenLibraryHomeV5.training.recentSessions[0],
  sportState: "personally-overridden",
  canonicalFamily: "running",
  displayLabel: "My running",
  localizedNames: structuredClone(syntheticRecognition.localizedNames),
  recognitionCandidateCount: 1,
};
for (const home of [
  emptyLibraryHomeV5,
  syntheticLibraryHomeV5,
  personallyOverriddenLibraryHomeV5,
]) {
  assertContract(validateLibraryHomeV5, libraryHomeV5SchemaPath, home);
}
if (validateLibraryHomeV5({
  ...structuredClone(syntheticLibraryHomeV5),
  training: {
    ...structuredClone(syntheticLibraryHomeV5.training),
    sports: [{
      ...structuredClone(syntheticLibraryHomeV5.training.sports[0]),
      recognitionCandidateCount: 2,
    }],
  },
})) {
  throw new Error(`${libraryHomeV5SchemaPath} accepted inconsistent recognition evidence`);
}
if (validateLibraryHomeV5({
  ...structuredClone(personallyOverriddenLibraryHomeV5),
  training: {
    ...structuredClone(personallyOverriddenLibraryHomeV5.training),
    sports: [{
      ...structuredClone(personallyOverriddenLibraryHomeV5.training.sports[0]),
      localizedNames: structuredClone(syntheticRecognition.localizedNames),
      recognitionCandidateCount: 1,
    }],
  },
})) {
  throw new Error(`${libraryHomeV5SchemaPath} grouped personal identity by hidden recognition`);
}

const reportDependencyPaths = [
  reportDefinitionSchemaPath,
  reportDefinitionV2SchemaPath,
  reportDefinitionV3SchemaPath,
  reportDefinitionV4SchemaPath,
  trainingComparisonSchemaPath,
  trainingSessionProvenanceSchemaPath,
  trainingSessionRouteSchemaPath,
  sessionReportResolutionV3SchemaPath,
];
for (const dependencyPath of reportDependencyPaths) addContractSchema(dependencyPath);

const validateReportLibraryV2 = compileContractSchema(reportLibraryV2SchemaPath);
const syntheticReportLibraryV2 = structuredClone(syntheticReportLibrary);
syntheticReportLibraryV2.items[0].subject.sport = structuredClone(syntheticRecognizedSport);
assertContract(validateReportLibraryV2, reportLibraryV2SchemaPath, syntheticReportLibraryV2);
if (validateReportLibraryV2({
  ...structuredClone(syntheticReportLibraryV2),
  items: [{
    ...structuredClone(syntheticReportLibraryV2.items[0]),
    subject: {
      kind: "session",
      sport: { ...structuredClone(syntheticRecognizedSport), sourceIdentifier: "private" },
    },
  }],
})) {
  throw new Error(`${reportLibraryV2SchemaPath} accepted provider identity`);
}

const validateSessionReportResolutionV4 = compileContractSchema(
  sessionReportResolutionV4SchemaPath,
);
const syntheticSessionReportResolutionV4 =
  structuredClone(syntheticSessionReportResolutionV3);
syntheticSessionReportResolutionV4.session.sport =
  structuredClone(syntheticRecognizedSport);
assertContract(
  validateSessionReportResolutionV4,
  sessionReportResolutionV4SchemaPath,
  syntheticSessionReportResolutionV4,
);
if (validateSessionReportResolutionV4({
  ...structuredClone(syntheticSessionReportResolutionV4),
  session: {
    ...structuredClone(syntheticSessionReportResolutionV4.session),
    sport: { ...structuredClone(syntheticRecognizedSport), provider: "private" },
  },
})) {
  throw new Error(`${sessionReportResolutionV4SchemaPath} accepted provider identity`);
}

const validateReportResolutionV5 = compileContractSchema(reportResolutionV5SchemaPath);
const syntheticReportResolutionV5 = {
  definition: structuredClone(syntheticSessionDefinitionV4),
  resolvedSnapshotRef: snapshotRefDigest,
  status: "current",
  session: structuredClone(syntheticTrainingSessionSearchV2.sessions[0]),
  routes: structuredClone(syntheticSessionReportResolutionV3.routes),
  trainingComparison: null,
  provenance: {
    kind: "session",
    current: structuredClone(syntheticTrainingSessionProvenance.current),
  },
  sensitiveContents: structuredClone(syntheticSessionReportResolutionV3.sensitiveContents),
  limitations: [],
};
assertContract(
  validateReportResolutionV5,
  reportResolutionV5SchemaPath,
  syntheticReportResolutionV5,
);
if (validateReportResolutionV5({
  ...structuredClone(syntheticReportResolutionV5),
  session: {
    ...structuredClone(syntheticReportResolutionV5.session),
    sport: { ...structuredClone(syntheticRecognizedSport), provider: "private" },
  },
})) {
  throw new Error(`${reportResolutionV5SchemaPath} accepted provider identity`);
}

const indexPath = "docs/data-formats/README.md";
const index = read(indexPath);
for (const contractPath of [
  canonicalPath,
  trainingStructureCanonicalPath,
  trainingRouteCanonicalPath,
  trainingSignalCanonicalPath,
  trainingZoneCanonicalPath,
  trainingSessionRangeCanonicalPath,
  sportClassificationCanonicalPath,
  sleepCanonicalPath,
  providerSportCataloguePath,
  mappingPath,
  sleepMappingPath,
  activityOverviewPath,
  activityOverviewV2Path,
  activityComparisonPath,
  trainingOverviewPath,
  trainingSportsPath,
  trainingSportIdentityPath,
  trainingSportsV2Path,
  trainingSessionSearchPath,
  trainingSessionSearchV2Path,
  trainingSessionStructurePath,
  trainingSessionStructureV2Path,
  trainingSessionRoutePath,
  trainingSessionSignalPath,
  trainingSessionZonePath,
  trainingSessionProvenancePath,
  trainingSessionRangeReadModelPath,
  trainingSessionRangeSummaryV2Path,
  trainingDiscoveryWorkspacePath,
  trainingComparisonPath,
  sleepOverviewPath,
  sleepComparisonPath,
  recoveryOverviewPath,
  recoveryComparisonPath,
  longitudinalPath,
  libraryHomePath,
  libraryHomeV5Path,
  updateChannelPath,
  stableUpdateChannelPath,
  publicUpdateConfigurationPath,
  updateRecoveryPath,
  reportDefinitionCanonicalPath,
  reportDefinitionPortablePath,
  sessionReportPath,
  reportHtmlPath,
  reportDefinitionCanonicalV2Path,
  reportDefinitionPortableV2Path,
  sessionReportV2Path,
  reportHtmlV2Path,
  reportDefinitionCanonicalV3Path,
  reportDefinitionPortableV3Path,
  sessionReportV3Path,
  reportHtmlV3Path,
  reportDefinitionCanonicalV4Path,
  reportDefinitionPortableV4Path,
  reportV4Path,
  reportHtmlV4Path,
  sessionStoryV4Path,
  sessionReportV4Path,
  reportV5Path,
  reportHtmlV5Path,
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
    trainingSportsSchemas: [
      trainingSportsSchemaPath,
      providerSportCatalogueSchemaPath,
      trainingSportIdentitySchemaPath,
      trainingSportsV2SchemaPath,
      sportClassificationSaveSchemaPath,
      savedSportClassificationSchemaPath,
      savedSportClassificationV2SchemaPath,
    ],
    trainingSessionSearchSchemas: [
      trainingSessionSearchQuerySchemaPath,
      trainingSessionSearchSchemaPath,
      trainingSessionSearchV2SchemaPath,
      trainingSessionCalendarQuerySchemaPath,
      trainingSessionCalendarSchemaPath,
      trainingSessionSelectionQuerySchemaPath,
      trainingSessionSelectionSchemaPath,
      trainingSessionSelectionV2SchemaPath,
      trainingSessionStructureQuerySchemaPath,
      trainingSessionStructureSchemaPath,
      trainingSessionStructureV2SchemaPath,
      trainingSessionRouteQuerySchemaPath,
      trainingSessionRouteSchemaPath,
      trainingRoutePointsQuerySchemaPath,
      trainingRoutePointsSchemaPath,
      trainingSessionSignalsQuerySchemaPath,
      trainingSessionSignalsSchemaPath,
      trainingSignalSamplesQuerySchemaPath,
      trainingSignalSamplesSchemaPath,
      trainingDiscoveryWorkspaceSchemaPath,
    ],
    trainingSessionZoneSchemas: [
      trainingSessionZonesQuerySchemaPath,
      trainingSessionZonesSchemaPath,
    ],
    trainingSessionProvenanceSchemas: [
      trainingSessionProvenanceQuerySchemaPath,
      trainingSessionProvenanceSchemaPath,
    ],
    sessionStorySchemas: [
      sessionStoryQuerySchemaPath,
      sessionStorySchemaPath,
      sessionStoryV2SchemaPath,
      sessionStoryV3SchemaPath,
      sessionStoryV4SchemaPath,
    ],
    trainingComparisonSchemas: [
      trainingComparisonQuerySchemaPath,
      trainingComparisonSchemaPath,
    ],
    trainingSegmentationSchemas: [
      segmentationSchemaPath,
      ...segmentationCommandContracts.map(([schemaPath]) => schemaPath),
    ],
    trainingSessionRangeSchemas: [
      trainingSessionRangesSchemaPath,
      ...trainingSessionRangeCommandContracts.map(([schemaPath]) => schemaPath),
      trainingSessionRangeSummaryQuerySchemaPath,
      trainingSessionRangeSummarySchemaPath,
      trainingSessionRangeSummaryV2SchemaPath,
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
    libraryHomeSchemas: [
      libraryHomeQuerySchemaPath,
      libraryHomeSchemaPath,
      libraryHomeV2SchemaPath,
      libraryHomeV3SchemaPath,
      libraryHomeV4SchemaPath,
      libraryHomeV5SchemaPath,
      explorationWorkspaceSaveSchemaPath,
    ],
    updateChannelSchemas: [
      updateChannelEnvelopeSchemaPath,
      updateChannelPayloadSchemaPath,
      stableUpdateChannelEnvelopeSchemaPath,
      stableUpdateChannelPayloadSchemaPath,
    ],
    publicUpdateConfigurationSchema: publicUpdateConfigurationSchemaPath,
    updateRecoverySchema: updateRecoverySchemaPath,
    updateRecoveryOutcomeSchema: updateRecoveryOutcomeSchemaPath,
    reportSchemas: [
      reportDefinitionSchemaPath,
      reportDefinitionV2SchemaPath,
      reportDefinitionV3SchemaPath,
      reportDefinitionV4SchemaPath,
      reportStartSchemaPath,
      preparedReportStartSchemaPath,
      reportCreateV4SchemaPath,
      reportUpdateV4SchemaPath,
      reportRefreshSchemaPath,
      reportRemoveSchemaPath,
      removedReportSchemaPath,
      reportLibraryQuerySchemaPath,
      reportLibrarySchemaPath,
      reportLibraryV2SchemaPath,
      sessionReportCreateSchemaPath,
      sessionReportCreateV2SchemaPath,
      sessionReportCreateV3SchemaPath,
      sessionReportUpdateSchemaPath,
      sessionReportUpdateV2SchemaPath,
      sessionReportUpdateV3SchemaPath,
      reportListSchemaPath,
      sessionReportResolutionSchemaPath,
      sessionReportResolutionV2SchemaPath,
      sessionReportResolutionV3SchemaPath,
      sessionReportResolutionV4SchemaPath,
      reportResolutionV4SchemaPath,
      reportResolutionV5SchemaPath,
      sessionReportExportSchemaPath,
      sessionReportExportV2SchemaPath,
      reportExportV4SchemaPath,
      reportExportReceiptSchemaPath,
    ],
    canonicalFields: 64,
    mappingFields: 75,
  }) + "\n",
);
