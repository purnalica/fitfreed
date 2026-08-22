import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { ZipFile } from "yazl";

const outputPath = path.resolve(
  process.argv[2] ?? ".artifacts/e2e/insights-performance.zip",
);
const fixedTime = new Date("2000-01-01T00:00:00.000Z");
const firstDate = Date.UTC(2024, 0, 1);
const throughDate = Date.UTC(2025, 11, 31);
const calendarDays = Math.floor((throughDate - firstDate) / 86_400_000) + 1;
const syntheticUsername = "fixture-primary-claim";
const performanceRoutePointCount = 20_001;
const performanceRoutePoints = Array.from(
  { length: performanceRoutePointCount },
  (_, ordinal) => {
    const progress = ordinal / (performanceRoutePointCount - 1);
    return {
      latitude: 40.4 + progress * 0.12 + Math.sin(progress * Math.PI * 12) * 0.01,
      longitude: -3.7 + progress * 0.15 + Math.cos(progress * Math.PI * 10) * 0.008,
      altitude: 400 + ordinal % 240,
      elapsedMillis: ordinal * 1_000,
    };
  },
);
const performanceSignalValues = Array.from(
  { length: 20_001 },
  (_, ordinal) => ordinal % 997 === 0 ? "NaN" : 115 + ordinal % 80,
);
const performanceSpeedValues = Array.from(
  { length: 20_001 },
  (_, ordinal) => 8 + ordinal % 120 / 10,
);
const performanceAltitudeValues = Array.from(
  { length: 20_001 },
  (_, ordinal) => 400 + ordinal % 240,
);
const performanceCadenceValues = Array.from(
  { length: 20_001 },
  (_, ordinal) => 60 + ordinal % 70,
);
const zip = new ZipFile();
let storedObservations = 0;
let unavailableObservations = 0;
let trainingSessions = 0;
const sleepResults = [];
const sleepScores = [];
const recoveryNights = [];

await mkdir(path.dirname(outputPath), { recursive: true });
zip.addBuffer(
  Buffer.from(JSON.stringify({ exportVersion: "synthetic-performance", username: syntheticUsername })),
  "account-data-91-99999999-8888-4777-8666-555555555555.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);

for (let index = 0; index < calendarDays; index += 1) {
  const date = new Date(firstDate + index * 86_400_000).toISOString().slice(0, 10);
  const previousDate = new Date(firstDate + (index - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const token = index.toString(16).padStart(12, "0");
  const artifactId = `77777777-6666-4555-8444-${token}`;
  const storesActivity = index === 0 || index === calendarDays - 1 || index % 23 !== 0;
  if (storesActivity) {
    const unavailable = index % 19 === 0;
    const content = unavailable
      ? { date }
      : { date, summary: { stepCount: (index * 7_919) % 40_000 } };
    zip.addBuffer(
      Buffer.from(JSON.stringify(content)),
      `activity-${date}-${artifactId}.json`,
      { mtime: fixedTime, mode: 0o100644, compress: true },
    );
    storedObservations += 1;
    if (unavailable) unavailableObservations += 1;
  }

  const durationMillis = index === calendarDays - 1
    ? (performanceRoutePointCount - 1) * 1_000
    : 1_800_000 + (index % 5) * 900_000;
  const startedAt = new Date(firstDate + index * 86_400_000 + 6 * 3_600_000);
  const stoppedAt = new Date(startedAt.getTime() + durationMillis);
  const optionalIndex = index;
  const session = {
    identifier: { id: `synthetic-performance-session-${index}` },
    created: `${date}T23:00:00.000`,
    modified: `${date}T23:00:00.000`,
    startTime: startedAt.toISOString().slice(0, 19),
    stopTime: stoppedAt.toISOString().slice(0, 19),
    timezoneOffsetMinutes: 60,
    durationMillis,
    ...(optionalIndex % 7 === 0 ? {} : { distanceMeters: durationMillis / 400 }),
    ...(optionalIndex % 11 === 0 ? {} : { calories: 200 + optionalIndex % 700 }),
    ...(optionalIndex % 13 === 0 ? {} : { hrAvg: 130, hrMax: 165 }),
    sport: { id: `synthetic-performance-sport-${optionalIndex % 4}` },
    exercises: Array.from(
      { length: optionalIndex % 3 },
      (_, exerciseIndex) => ({
        identifier: {
          id: `synthetic-performance-session-${index}-exercise-${exerciseIndex}`,
        },
        created: `${date}T23:00:00.000`,
        modified: `${date}T23:00:00.000`,
        startTime: startedAt.toISOString().slice(0, 19),
        stopTime: stoppedAt.toISOString().slice(0, 19),
        timezoneOffsetMinutes: 60,
        durationMillis,
        sport: { id: `synthetic-performance-sport-${optionalIndex % 4}` },
        ...(optionalIndex === calendarDays - 1 && exerciseIndex === 0 ? {
          routes: {
            route: {
              startTime: startedAt.toISOString().slice(0, 19),
              wayPoints: performanceRoutePoints,
            },
          },
        } : {}),
        ...(optionalIndex === calendarDays - 1 && exerciseIndex === 0 ? {
          samples: {
            samples: [{
              type: "HEART_RATE",
              intervalMillis: 1_000,
              values: performanceSignalValues,
            }, {
              type: "SPEED",
              intervalMillis: 1_000,
              values: performanceSpeedValues,
            }, {
              type: "ALTITUDE",
              intervalMillis: 1_000,
              values: performanceAltitudeValues,
            }, {
              type: "CADENCE",
              intervalMillis: 1_000,
              values: performanceCadenceValues,
            }],
            transitionSamples: [],
          },
        } : {}),
      }),
    ),
  };
  zip.addBuffer(
    Buffer.from(JSON.stringify(session)),
    `training-session_${date}T06-00-00_91-${artifactId}.json`,
    { mtime: fixedTime, mode: 0o100644, compress: true },
  );
  trainingSessions += 1;

  sleepResults.push({
    night: date,
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
        sleepStart: `${previousDate}T22:00:00+01:00`,
        sleepEnd: `${date}T06:00:00+01:00`,
        rating: "SLEPT_QUITE_WELL",
        sleepGoal: "PT8H",
        batteryRanOut: false,
        sleepStateChanges: [
          { offsetFromStart: "PT0S", state: "WAKE" },
          { offsetFromStart: "PT30M", state: "NONREM2" },
          { offsetFromStart: "PT2H", state: "NONREM3" },
          { offsetFromStart: "PT3H30M", state: "REM" },
          { offsetFromStart: "PT7H30M", state: "WS_UNKNOWN" },
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
  });
  sleepScores.push({
    night: date,
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
  });
  recoveryNights.push({
    night: date,
    meanNightlyRecoveryRri: 850 + index % 100,
    meanNightlyRecoveryRmssd: 35 + index % 20,
    meanNightlyRecoveryRespirationInterval: 3_900 + index % 400,
    ansRate: 4,
    ansStatus: 1.5,
    recoveryIndicator: 5,
    recoveryIndicatorSubLevel: index % 3,
    meanBaselineRespirationInterval: 4_100,
    meanBaselineRmssd: 40,
    meanBaselineRri: 900,
    sdBaselineRespirationInterval: 120,
    sdBaselineRmssd: 8,
    sdBaselineRri: 30,
    exerciseTip: "Choose a steady synthetic session.",
    sleepTip: "Keep a consistent synthetic schedule.",
    vitalityTip: "Plan a synthetic restorative break.",
  });
}

zip.addBuffer(
  Buffer.from(JSON.stringify(sleepResults)),
  "sleep_result_91-77777777-6666-4555-8444-111111111111.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);
zip.addBuffer(
  Buffer.from(JSON.stringify(sleepScores)),
  "sleep_score_91-77777777-6666-4555-8444-222222222222.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);
zip.addBuffer(
  Buffer.from(JSON.stringify(recoveryNights)),
  "nightly_recovery_91-77777777-6666-4555-8444-333333333333.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);

zip.end();
await new Promise((resolve, reject) => {
  zip.outputStream
    .pipe(createWriteStream(outputPath))
    .on("close", resolve)
    .on("error", reject);
});

process.stdout.write(`${JSON.stringify({
  outputPath,
  calendarDays,
  storedObservations,
  unavailableObservations,
  missingDays: calendarDays - storedObservations,
  trainingSessions,
  performanceRoutePointCount,
  sleepPeriods: sleepResults.length,
  recoveryNights: recoveryNights.length,
})}\n`);
