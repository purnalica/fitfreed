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
const syntheticTrainingSessionId = "fixture-training-session";

function trainingSession(modified, distanceMeters) {
  return JSON.stringify({
    identifier: { id: syntheticTrainingSessionId },
    created: "2026-01-04T08:00:00.000",
    modified,
    startTime: "2026-01-04T06:15:00",
    stopTime: "2026-01-04T07:15:00",
    timezoneOffsetMinutes: 60,
    durationMillis: 3_600_000,
    distanceMeters,
    calories: 600,
    hrAvg: 142,
    hrMax: 171,
    sport: { id: "99" },
    exercises: [{ syntheticExcludedDetail: true }],
  });
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
    trainingSession("2026-01-04T08:05:00.000", 10_000),
  ],
  [`sleep_result_42-${uuidA}.json`, "[]"],
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
    trainingSession("2026-01-04T09:00:00.000", 10_500),
  ],
]);

process.stdout.write(`${JSON.stringify({ outputDirectory, fixtureCount: 3 })}\n`);
