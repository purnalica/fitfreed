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
const zip = new ZipFile();
let storedObservations = 0;
let unavailableObservations = 0;
let trainingSessions = 0;

await mkdir(path.dirname(outputPath), { recursive: true });
zip.addBuffer(
  Buffer.from(JSON.stringify({ exportVersion: "synthetic-performance", username: syntheticUsername })),
  "account-data-91-99999999-8888-4777-8666-555555555555.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);

for (let index = 0; index < calendarDays; index += 1) {
  const date = new Date(firstDate + index * 86_400_000).toISOString().slice(0, 10);
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

  const durationMillis = 1_800_000 + (index % 5) * 900_000;
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
      () => ({ syntheticExcludedDetail: true }),
    ),
  };
  zip.addBuffer(
    Buffer.from(JSON.stringify(session)),
    `training-session_${date}T06-00-00_91-${artifactId}.json`,
    { mtime: fixedTime, mode: 0o100644, compress: true },
  );
  trainingSessions += 1;
}

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
})}\n`);
