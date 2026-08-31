import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ZipFile } from "yazl";

const outputDirectory = path.resolve(process.argv[2] ?? ".artifacts/e2e/fixtures");
const fixedTime = new Date("2000-01-01T00:00:00.000Z");
const uuidA = "11111111-2222-4333-8444-555555555555";
const uuidB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const uuidC = "12345678-90ab-4cde-8f01-234567890abc";
const syntheticUsername = "fixture-primary-claim";
const bundledSportCatalogue = JSON.parse(await readFile(
  new URL(
    "../assets/provider-compatibility/polar-flow-sport-catalogue-v1.json",
    import.meta.url,
  ),
  "utf8",
));
const bundledSportIdentifiers = new Set(
  bundledSportCatalogue.entries.map((entry) => entry.sourceIdentifier),
);
const recognizedFixtureSportIdentifier = "1";
const deliberatelyUnknownFixtureSportIdentifiers = {
  primary: "99",
  cumulative: "999",
  unification: "1001",
  providerNormalization: "1002",
  adaptiveSignal: "2001",
  adaptiveStructure: "2002",
  adaptiveZones: "2003",
};
if (!bundledSportIdentifiers.has(recognizedFixtureSportIdentifier)) {
  throw new Error("the sport-catalogue fixture identifier is not supported by the bundled catalogue");
}
for (const identifier of Object.values(deliberatelyUnknownFixtureSportIdentifiers)) {
  if (bundledSportIdentifiers.has(identifier)) {
    throw new Error(
      `the deliberately unknown fixture sport identifier ${identifier} collides with the bundled catalogue`,
    );
  }
}

function recordedOutdoorRoutes() {
  return {
    route: {
      startTime: "2026-01-04T06:15:00",
      wayPoints: [
        { latitude: 40, longitude: -3, altitude: 650, elapsedMillis: 0 },
        { latitude: 40.01, longitude: -3.01, altitude: 652, elapsedMillis: 900_000 },
        { latitude: 40.02, longitude: -3.02, altitude: 655, elapsedMillis: 1_800_000 },
        { latitude: 40.03, longitude: -3.03, altitude: 653, elapsedMillis: 2_700_000 },
        { latitude: 40.04, longitude: -3.04, altitude: 648, elapsedMillis: 3_600_000 },
      ],
    },
    transitionRoute: {
      startTime: "2026-01-04T07:14:00",
      wayPoints: [
        { latitude: 40.04, longitude: -3.04, elapsedMillis: 0 },
        { latitude: 40.041, longitude: -3.041, elapsedMillis: 60_000 },
      ],
    },
  };
}

function recordedTrainingSignals() {
  return {
    samples: [
      {
        type: "HEART_RATE",
        intervalMillis: 1_000,
        values: Array.from(
          { length: 101 },
          (_, ordinal) => ordinal === 50 ? "NaN" : 120 + ordinal / 2,
        ),
      },
      {
        type: "SPEED",
        intervalMillis: 900_000,
        values: [8.5, 9.2, 10.1, 9.8, 8.7],
      },
      {
        type: "SYNTHETIC_UNSUPPORTED_SIGNAL",
        intervalMillis: 1_000,
        values: [1, 2, 3],
      },
    ],
    transitionSamples: [{
      type: "TEMPERATURE",
      intervalMillis: 60_000,
      values: [7.5, 7.25],
    }],
  };
}

function recordedTrainingZones() {
  return [{
    type: "ZONE_TYPE_HEART_RATE",
    zones: [{ lowerLimit: 120, higherLimit: 139, inZone: 900_000 }, {
      lowerLimit: 140,
      higherLimit: 159,
    }],
  }, {
    type: "ZONE_TYPE_SPEED",
    zones: [{
      lowerLimit: 8,
      higherLimit: 10,
      inZone: 600_000,
      distanceMeters: 2_500.5,
    }],
  }, {
    type: "ZONE_TYPE_POWER",
    zones: [{
      lowerLimit: 180,
      higherLimit: 219,
      inZone: 300_000,
      muscleLoad: 42.5,
    }],
  }, {
    type: "ZONE_TYPE_FIT_FAT",
    zones: [{ lowerLimit: 0, higherLimit: 1, inZone: 0 }],
  }];
}

function trainingSession({
  id,
  created,
  modified,
  startTime,
  stopTime,
  durationMillis,
  distanceMeters,
  calories,
  hrAvg,
  hrMax,
  sportId,
  exercises,
}) {
  return JSON.stringify({
    identifier: { id },
    created,
    modified,
    startTime,
    stopTime,
    timezoneOffsetMinutes: 60,
    durationMillis,
    ...(distanceMeters === undefined ? {} : { distanceMeters }),
    ...(calories === undefined ? {} : { calories }),
    ...(hrAvg === undefined ? {} : { hrAvg }),
    ...(hrMax === undefined ? {} : { hrMax }),
    ...(sportId === undefined ? {} : { sport: { id: sportId } }),
    ...(exercises === undefined ? {} : { exercises }),
  });
}

function sleepResult(night) {
  return JSON.stringify([
    {
      night,
      evaluation: {
        sleepType: "SLEEP_PLUS_STAGES",
        sleepSpan: "PT8H",
        asleepDuration: "PT7H30M",
        age: 40,
        analysis: {
          efficiencyPercent: 93.75,
          continuityIndex: 4.2,
          continuityClass: 4,
          feedback: 11111,
        },
        interruptions: {
          totalDuration: "PT30M",
          longDuration: "PT20M",
          shortDuration: "PT10M",
          totalCount: 3,
          longCount: 1,
          shortCount: 2,
        },
        phaseDurations: {
          wake: "PT30M",
          rem: "PT1H30M",
          light: "PT4H",
          deep: "PT1H30M",
          unknown: "PT30M",
          remPercentage: 20,
          deepPercentage: 20,
        },
      },
      sleepResult: {
        hypnogram: {
          sleepStart: "2026-01-05T22:30:00+01:00",
          sleepEnd: "2026-01-06T06:30:00+01:00",
          sleepStartOffset: 0,
          sleepEndOffset: 0,
          rating: "SLEPT_QUITE_WELL",
          sleepGoal: "PT8H",
          birthday: "1985-01-01",
          deviceId: "synthetic-device",
          batteryRanOut: false,
          alarmSnoozeTimes: [],
          sleepStateChanges: [
            { offsetFromStart: "PT0S", state: "WAKE" },
            { offsetFromStart: "PT30M", state: "NONREM2" },
            { offsetFromStart: "PT2H", state: "NONREM3" },
            { offsetFromStart: "PT3H30M", state: "REM" },
            { offsetFromStart: "PT7H30M", state: "WS_UNKNOWN" },
            { offsetFromStart: "PT8H30M", state: "WAKE" },
          ],
        },
        sleepCycles: {
          cycles: {
            sleepCycleModels: [
              { secondsFromSleepStart: 0, sleepDepthStart: 2 },
              { secondsFromSleepStart: 14_400, sleepDepthStart: 3 },
            ],
          },
        },
      },
    },
  ]);
}

function sleepScore(night) {
  return JSON.stringify([
    {
      night,
      sleepScoreBaselines: {
        sleepTimeAverageMinutes: 450,
        longInterruptionsAverageTimeMinutes: 20,
      },
      sleepScoreResult: {
        sleepScore: 82,
        sleepTimeOwnTargetScore: 80,
        sleepTimeRecommendationScore: 78,
        continuityScore: 84,
        efficiencyScore: 86,
        remScore: 76,
        n3Score: 81,
        longInterruptionsScore: 79,
        groupDurationScore: 79,
        groupSolidityScore: 83,
        groupRefreshScore: 78.5,
        scoreRate: 4,
      },
    },
  ]);
}

function nightlyRecovery(night) {
  return JSON.stringify([
    {
      night,
      meanNightlyRecoveryRri: 900,
      meanNightlyRecoveryRmssd: 42,
      meanNightlyRecoveryRespirationInterval: 4_100,
      ansRate: 4,
      ansStatus: 1.5,
      recoveryIndicator: 5,
      recoveryIndicatorSubLevel: 2,
      meanBaselineRespirationInterval: 4_200,
      meanBaselineRmssd: 40,
      meanBaselineRri: 910,
      sdBaselineRespirationInterval: 120,
      sdBaselineRmssd: 8,
      sdBaselineRri: 30,
      exerciseTip: "Choose a steady synthetic session.",
      sleepTip: "Keep a consistent synthetic schedule.",
      vitalityTip: "Plan a synthetic restorative break.",
    },
  ]);
}

async function createArchive(name, entries) {
  const outputPath = path.join(outputDirectory, name);
  const zip = new ZipFile();
  for (const [entryName, content] of entries) {
    zip.addBuffer(Buffer.from(content), entryName, {
      mtime: fixedTime,
      mode: 0o100644,
      compress: true,
    });
  }
  zip.end();
  await new Promise((resolve, reject) => {
    zip.outputStream
      .pipe(createWriteStream(outputPath))
      .on("close", resolve)
      .on("error", reject);
  });
  return outputPath;
}

async function declareFirstMemberExpandedSize(archivePath, expandedSize) {
  const archive = await readFile(archivePath);
  const localHeader = archive.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const centralHeader = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  if (localHeader < 0 || centralHeader < 0) {
    throw new Error(`ZIP headers were not found in ${path.basename(archivePath)}`);
  }
  archive.writeUInt32LE(expandedSize, localHeader + 22);
  archive.writeUInt32LE(expandedSize, centralHeader + 24);
  await writeFile(archivePath, archive);
}

await mkdir(outputDirectory, { recursive: true });
await createArchive("unrelated.zip", [
  ["documents/readme.txt", "ordinary synthetic notes"],
  ["backup.zip", "not an embedded fitness-history export"],
]);
const unrelatedResourceLimitArchive = await createArchive("unrelated-resource-limit.zip", [
  ["notes.bin", "small synthetic content with deliberately oversized ZIP metadata"],
]);
await declareFirstMemberExpandedSize(unrelatedResourceLimitArchive, 64 * 1_024 * 1_024 + 1);
await createArchive("invalid.zip", [
  [
    `account-data-42-${uuidC}.json`,
    JSON.stringify({ exportVersion: "synthetic", username: syntheticUsername }),
  ],
  [
    `activity-2026-01-01-${uuidC}.json`,
    '{"date":"2026-01-01","summary":{"stepCount":-1}}',
  ],
]);
await createArchive("valid.zip", [
  [
    `activity-2026-01-01-${uuidA}.json`,
    '{"date":"2026-01-01","summary":{"stepCount":3100}}',
  ],
  [
    `activity-2026-01-02-${uuidA}.json`,
    '{"date":"2026-01-02","summary":{"stepCount":4200}}',
  ],
  [`activity-2026-01-03-${uuidA}.json`, '{"date":"2026-01-03"}'],
  [
    `account-data-42-${uuidA}.json`,
    JSON.stringify({ exportVersion: "synthetic", username: syntheticUsername }),
  ],
  [
    `training-session_2026-01-04T06-15-00_42-${uuidA}.json`,
    trainingSession({
      id: "fixture-training-session-a",
      created: "2026-01-04T08:00:00.000",
      modified: "2026-01-04T08:05:00.000",
      startTime: "2026-01-04T06:15:00",
      stopTime: "2026-01-04T07:15:00",
      durationMillis: 3_600_000,
      distanceMeters: 10_000,
      calories: 600,
      hrAvg: 142,
      hrMax: 171,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.primary,
      exercises: [{
        identifier: { id: "fixture-training-exercise-a" },
        created: "2026-01-04T08:00:00.000",
        modified: "2026-01-04T08:05:00.000",
        startTime: "2026-01-04T06:15:00",
        stopTime: "2026-01-04T07:15:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 3_600_000,
        distanceMeters: 10_000,
        calories: 600,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.primary },
        laps: {
          laps: [{
            splitTimeMillis: 1_800_000,
            durationMillis: 1_800_000,
            distanceMeters: 5_000,
          }],
          autoLaps: [],
        },
        pauseTimes: [{
          startTime: "2026-01-04T06:45:00",
          endTime: "2026-01-04T06:46:00",
        }],
        routes: recordedOutdoorRoutes(),
        samples: recordedTrainingSignals(),
        zones: recordedTrainingZones(),
      }],
    }),
  ],
  [
    `training-session_2026-01-05T18-00-00_42-${uuidA}.json`,
    trainingSession({
      id: "fixture-training-session-b",
      created: "2026-01-05T19:00:00.000",
      modified: "2026-01-05T19:00:00.000",
      startTime: "2026-01-05T18:00:00",
      stopTime: "2026-01-05T18:30:00",
      durationMillis: 1_800_000,
      exercises: [],
    }),
  ],
  [`sleep_result_42-${uuidA}.json`, sleepResult("2026-01-06")],
  [`sleep_score_42-${uuidA}.json`, sleepScore("2026-01-06")],
  [`nightly_recovery_42-${uuidA}.json`, nightlyRecovery("2026-01-06")],
  [
    `nightly_recovery_blob_42-${uuidA}.json`,
    JSON.stringify({
      hrvData: { samples: [37, 41] },
      breathingRateData: { samples: [14, 15] },
    }),
  ],
  [`profile-picture-42-LARGE-${uuidA}.data`, "synthetic image"],
  [`future-family-42-${uuidA}.json`, "{}"],
]);

await createArchive("sport-catalogue-recognition.zip", [
  [
    `account-data-97-${uuidC}.json`,
    JSON.stringify({
      exportVersion: "synthetic-sport-catalogue-recognition",
      username: syntheticUsername,
    }),
  ],
  [
    `training-session_2026-02-01T08-00-00_97-${uuidC}.json`,
    trainingSession({
      id: "fixture-training-session-catalogue-recognition",
      created: "2026-02-01T09:00:00.000",
      modified: "2026-02-01T09:00:00.000",
      startTime: "2026-02-01T08:00:00",
      stopTime: "2026-02-01T08:45:00",
      durationMillis: 2_700_000,
      distanceMeters: 7_500,
      calories: 420,
      hrAvg: 138,
      hrMax: 166,
      sportId: recognizedFixtureSportIdentifier,
      exercises: [{
        identifier: { id: "fixture-training-exercise-catalogue-recognition" },
        created: "2026-02-01T09:00:00.000",
        modified: "2026-02-01T09:00:00.000",
        startTime: "2026-02-01T08:00:00",
        stopTime: "2026-02-01T08:45:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 2_700_000,
        distanceMeters: 7_500,
        calories: 420,
        sport: { id: recognizedFixtureSportIdentifier },
        laps: { laps: [], autoLaps: [] },
        pauseTimes: [],
      }],
    }),
  ],
]);

await createArchive("overlap.zip", [
  [
    `account-data-77-${uuidB}.json`,
    JSON.stringify({ exportVersion: "synthetic-later", username: syntheticUsername }),
  ],
  [
    `activity-2026-01-02-${uuidB}.json`,
    '{"date":"2026-01-02","summary":{"stepCount":4200}}',
  ],
  [
    `activity-2026-01-05-${uuidB}.json`,
    '{"date":"2026-01-05","summary":{"stepCount":5300}}',
  ],
  [
    `training-session_2026-01-04T06-15-00_77-${uuidB}.json`,
    trainingSession({
      id: "fixture-training-session-a",
      created: "2026-01-04T08:00:00.000",
      modified: "2026-01-04T09:00:00.000",
      startTime: "2026-01-04T06:15:00",
      stopTime: "2026-01-04T07:15:00",
      durationMillis: 3_600_000,
      distanceMeters: 10_500,
      calories: 600,
      hrAvg: 142,
      hrMax: 171,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.primary,
      exercises: [{
        identifier: { id: "fixture-training-exercise-a" },
        created: "2026-01-04T08:00:00.000",
        modified: "2026-01-04T09:00:00.000",
        startTime: "2026-01-04T06:15:00",
        stopTime: "2026-01-04T07:15:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 3_600_000,
        distanceMeters: 10_500,
        calories: 600,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.primary },
        laps: {
          laps: [{
            splitTimeMillis: 1_800_000,
            durationMillis: 1_800_000,
            distanceMeters: 5_250,
          }],
          autoLaps: [],
        },
        pauseTimes: [{
          startTime: "2026-01-04T06:45:00",
          endTime: "2026-01-04T06:46:00",
        }],
        routes: recordedOutdoorRoutes(),
        samples: recordedTrainingSignals(),
        zones: recordedTrainingZones(),
      }],
    }),
  ],
  [
    `training-session_2026-01-06T07-30-00_77-${uuidB}.json`,
    trainingSession({
      id: "fixture-training-session-c",
      created: "2026-01-06T09:00:00.000",
      modified: "2026-01-06T09:00:00.000",
      startTime: "2026-01-06T07:30:00",
      stopTime: "2026-01-06T08:15:00",
      durationMillis: 2_700_000,
      distanceMeters: 5_000,
      calories: 300,
      hrAvg: 130,
      hrMax: 155,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.primary,
      exercises: [{
        identifier: { id: "fixture-training-exercise-c-1" },
        created: "2026-01-06T09:00:00.000",
        modified: "2026-01-06T09:00:00.000",
        startTime: "2026-01-06T07:30:00",
        stopTime: "2026-01-06T08:00:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 1_800_000,
        distanceMeters: 3_500,
        calories: 220,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.primary },
        laps: { laps: [], autoLaps: [] },
        pauseTimes: [],
      }, {
        identifier: { id: "fixture-training-exercise-c-2" },
        created: "2026-01-06T09:00:00.000",
        modified: "2026-01-06T09:00:00.000",
        startTime: "2026-01-06T08:00:00",
        stopTime: "2026-01-06T08:15:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 900_000,
        distanceMeters: 1_500,
        calories: 80,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.cumulative },
      }],
    }),
  ],
]);

await createArchive("report-refresh.zip", [
  [
    `account-data-88-${uuidC}.json`,
    JSON.stringify({ exportVersion: "synthetic-refresh", username: syntheticUsername }),
  ],
  [
    `training-session_2026-01-05T18-00-00_88-${uuidC}.json`,
    trainingSession({
      id: "fixture-training-session-b",
      created: "2026-01-05T19:00:00.000",
      modified: "2026-01-05T20:00:00.000",
      startTime: "2026-01-05T18:00:00",
      stopTime: "2026-01-05T18:30:00",
      durationMillis: 1_800_000,
      distanceMeters: 4_000,
      calories: 250,
      hrAvg: 136,
      hrMax: 158,
      exercises: [],
    }),
  ],
]);

await createArchive("sport-unification.zip", [
  [
    `account-data-93-${uuidC}.json`,
    JSON.stringify({ exportVersion: "synthetic-sport-unification", username: syntheticUsername }),
  ],
  [
    `training-session_2026-01-07T08-30-00_93-${uuidC}.json`,
    trainingSession({
      id: "fixture-training-session-unification",
      created: "2026-01-07T09:30:00.000",
      modified: "2026-01-07T09:30:00.000",
      startTime: "2026-01-07T08:30:00",
      stopTime: "2026-01-07T09:10:00",
      durationMillis: 2_400_000,
      distanceMeters: 6_000,
      calories: 360,
      hrAvg: 134,
      hrMax: 162,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.unification,
      exercises: [{
        identifier: { id: "fixture-training-exercise-unification" },
        created: "2026-01-07T09:30:00.000",
        modified: "2026-01-07T09:30:00.000",
        startTime: "2026-01-07T08:30:00",
        stopTime: "2026-01-07T09:10:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 2_400_000,
        distanceMeters: 6_000,
        calories: 360,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.unification },
        laps: { laps: [], autoLaps: [] },
        pauseTimes: [],
      }],
    }),
  ],
  [
    `training-target-2026-01-07-93-${uuidC}.json`,
    JSON.stringify({
      exportVersion: "1.0",
      name: "Synthetic steady session",
      description: "Independent exact sport evidence",
      startTime: "2026-01-07T08:30:00.000",
      done: true,
      nonUserEditable: false,
      exercises: [{ type: "FREE", sport: "RUNNING", phases: [] }],
    }),
  ],
]);

await createArchive("sport-provider-normalization.zip", [
  [
    `account-data-95-${uuidC}.json`,
    JSON.stringify({ exportVersion: "synthetic-sport-normalization", username: syntheticUsername }),
  ],
  [
    `training-session_2026-01-08T08-30-00_95-${uuidC}.json`,
    trainingSession({
      id: "fixture-training-session-provider-normalization",
      created: "2026-01-08T09:30:00.000",
      modified: "2026-01-08T09:30:00.000",
      startTime: "2026-01-08T08:30:00",
      stopTime: "2026-01-08T09:05:00",
      durationMillis: 2_100_000,
      distanceMeters: 5_200,
      calories: 310,
      hrAvg: 132,
      hrMax: 158,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.providerNormalization,
      exercises: [],
    }),
  ],
  [
    `training-target-2026-01-08-95-${uuidC}.json`,
    JSON.stringify({
      exportVersion: "1.0",
      name: "Synthetic equivalent sport identifier",
      description: "Independent equal exact sport evidence",
      startTime: "2026-01-08T08:30:00.000",
      done: true,
      nonUserEditable: false,
      exercises: [{ type: "FREE", sport: "RUNNING", phases: [] }],
    }),
  ],
]);

await createArchive("sport-correlation-expanded.zip", [
  [
    `account-data-96-${uuidC}.json`,
    JSON.stringify({ exportVersion: "synthetic-sport-correlation", username: syntheticUsername }),
  ],
  [
    `training-session_2026-01-09T08-30-00_96-${uuidC}.json`,
    trainingSession({
      id: "fixture-training-session-correlation-expanded",
      created: "2026-01-09T09:30:00.000",
      modified: "2026-01-09T09:30:00.000",
      startTime: "2026-01-09T08:30:00",
      stopTime: "2026-01-09T09:15:00",
      durationMillis: 2_700_000,
      distanceMeters: 7_100,
      calories: 390,
      hrAvg: 136,
      hrMax: 164,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.unification,
      exercises: [],
    }),
  ],
  [
    `training-target-2026-01-09-96-${uuidC}.json`,
    JSON.stringify({
      exportVersion: "1.0",
      name: "Synthetic later correlated session",
      description: "Independent compatible correlation evidence",
      startTime: "2026-01-09T08:30:00.000",
      done: true,
      nonUserEditable: false,
      exercises: [{ type: "FREE", sport: "ROAD_RUNNING", phases: [] }],
    }),
  ],
]);

await createArchive("planned-training.zip", [
  [
    `account-data-94-${uuidC}.json`,
    JSON.stringify({ exportVersion: "synthetic-planned", username: syntheticUsername }),
  ],
  [
    `training-target-2026-01-04-94-${uuidC}.json`,
    JSON.stringify({
      exportVersion: "1.0",
      name: "Progressive intervals",
      description: "A synthetic interval plan",
      startTime: "2026-01-04T06:15:00.000",
      done: true,
      nonUserEditable: false,
      exercises: [{
        type: "PHASED",
        phases: [{
          index: 1,
          name: "  ",
          changeType: "AUTOMATIC",
          goal: { type: "DURATION", duration: "PT10M" },
          intensity: { type: "HEART_RATE_ZONES", lowerZone: 1, upperZone: 2 },
        }, {
          index: 2,
          name: "Work",
          changeType: "MANUAL",
          goal: { type: "DISTANCE", distance: 1_000 },
          intensity: { type: "SPEED_ZONES", lowerZone: 3, upperZone: 4 },
        }, {
          index: 3,
          name: "Recovery",
          changeType: "AUTOMATIC",
          goal: { type: "DURATION", duration: "PT1M" },
          intensity: { type: "NONE" },
          jumpIndex: 2,
          repeatCount: 3,
        }],
      }],
    }),
  ],
  [
    `favourite-targets-94-${uuidC}.json`,
    JSON.stringify([{
      exportVersion: "1.0",
      name: "Reusable tempo template",
      description: "A synthetic reusable plan",
      exercises: [{ type: "FREE" }],
    }]),
  ],
]);

await createArchive("adaptive-sessions.zip", [
  [
    `account-data-91-${uuidC}.json`,
    JSON.stringify({ exportVersion: "synthetic-adaptive", username: syntheticUsername }),
  ],
  [
    `training-session_2026-01-10T06-30-00_91-${uuidC}.json`,
    trainingSession({
      id: "fixture-adaptive-signal-session",
      created: "2026-01-10T07:20:00.000",
      modified: "2026-01-10T07:20:00.000",
      startTime: "2026-01-10T06:30:00",
      stopTime: "2026-01-10T07:10:00",
      durationMillis: 2_400_000,
      distanceMeters: 7_200,
      calories: 410,
      hrAvg: 138,
      hrMax: 166,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.adaptiveSignal,
      exercises: [{
        identifier: { id: "fixture-adaptive-signal-exercise" },
        created: "2026-01-10T07:20:00.000",
        modified: "2026-01-10T07:20:00.000",
        startTime: "2026-01-10T06:30:00",
        stopTime: "2026-01-10T07:10:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 2_400_000,
        distanceMeters: 7_200,
        calories: 410,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.adaptiveSignal },
        laps: { laps: [], autoLaps: [] },
        pauseTimes: [],
        samples: recordedTrainingSignals(),
      }],
    }),
  ],
  [
    `training-session_2026-01-11T07-00-00_91-${uuidC}.json`,
    trainingSession({
      id: "fixture-adaptive-structure-session",
      created: "2026-01-11T08:00:00.000",
      modified: "2026-01-11T08:00:00.000",
      startTime: "2026-01-11T07:00:00",
      stopTime: "2026-01-11T07:45:00",
      durationMillis: 2_700_000,
      distanceMeters: 8_000,
      calories: 460,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.adaptiveStructure,
      exercises: [{
        identifier: { id: "fixture-adaptive-structure-exercise" },
        created: "2026-01-11T08:00:00.000",
        modified: "2026-01-11T08:00:00.000",
        startTime: "2026-01-11T07:00:00",
        stopTime: "2026-01-11T07:45:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 2_700_000,
        distanceMeters: 8_000,
        calories: 460,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.adaptiveStructure },
        laps: {
          laps: [{
            splitTimeMillis: 0,
            durationMillis: 900_000,
            distanceMeters: 2_500,
          }, {
            splitTimeMillis: 900_000,
            durationMillis: 1_800_000,
            distanceMeters: 5_500,
          }],
          autoLaps: [],
        },
        pauseTimes: [{
          startTime: "2026-01-11T07:18:00",
          endTime: "2026-01-11T07:19:00",
        }],
      }],
    }),
  ],
  [
    `training-session_2026-01-12T08-00-00_91-${uuidC}.json`,
    trainingSession({
      id: "fixture-adaptive-zone-session",
      created: "2026-01-12T08:40:00.000",
      modified: "2026-01-12T08:40:00.000",
      startTime: "2026-01-12T08:00:00",
      stopTime: "2026-01-12T08:30:00",
      durationMillis: 1_800_000,
      calories: 280,
      sportId: deliberatelyUnknownFixtureSportIdentifiers.adaptiveZones,
      exercises: [{
        identifier: { id: "fixture-adaptive-zone-exercise" },
        created: "2026-01-12T08:40:00.000",
        modified: "2026-01-12T08:40:00.000",
        startTime: "2026-01-12T08:00:00",
        stopTime: "2026-01-12T08:30:00",
        timezoneOffsetMinutes: 60,
        durationMillis: 1_800_000,
        calories: 280,
        sport: { id: deliberatelyUnknownFixtureSportIdentifiers.adaptiveZones },
        laps: { laps: [], autoLaps: [] },
        pauseTimes: [],
        zones: recordedTrainingZones(),
      }],
    }),
  ],
]);

process.stdout.write(`${JSON.stringify({ outputDirectory, fixtureCount: 9 })}\n`);
