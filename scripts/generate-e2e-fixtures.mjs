import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ZipFile } from "yazl";

const outputDirectory = path.resolve(process.argv[2] ?? ".artifacts/e2e/fixtures");
const fixedTime = new Date("2000-01-01T00:00:00.000Z");
const uuidA = "11111111-2222-4333-8444-555555555555";
const uuidB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const uuidC = "12345678-90ab-4cde-8f01-234567890abc";
const syntheticUsername = "fixture-primary-claim";
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
  exerciseCount,
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
    exercises: Array.from({ length: exerciseCount }, () => ({ syntheticExcludedDetail: true })),
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
}

await mkdir(outputDirectory, { recursive: true });
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
      sportId: "99",
      exerciseCount: 1,
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
      exerciseCount: 0,
    }),
  ],
  [`sleep_result_42-${uuidA}.json`, sleepResult("2026-01-06")],
  [`sleep_score_42-${uuidA}.json`, sleepScore("2026-01-06")],
  [`profile-picture-42-LARGE-${uuidA}.data`, "synthetic image"],
  [`future-family-42-${uuidA}.json`, "{}"],
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
      sportId: "99",
      exerciseCount: 1,
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
      sportId: "99",
      exerciseCount: 2,
    }),
  ],
]);

process.stdout.write(`${JSON.stringify({ outputDirectory, fixtureCount: 3 })}\n`);
