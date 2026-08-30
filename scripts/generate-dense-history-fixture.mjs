import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { ZipFile } from "yazl";

import { denseHistoryScenario } from "./run-dense-history-benchmark.mjs";

const outputPath = path.resolve(
  process.argv[2] ?? ".artifacts/e2e/dense-history.zip",
);
const equivalentContainerVariant = process.argv[3] === "--equivalent-container-variant";
const scenario = denseHistoryScenario();
const fixedTime = new Date("2000-01-01T00:00:00.000Z");
const firstDate = Date.parse(`${scenario.firstDate}T00:00:00.000Z`);
const zip = new ZipFile();

function valuesFor(kind, sessionIndex) {
  return Array.from({ length: scenario.samplesPerSeries }, (_, ordinal) => {
    if ((ordinal + sessionIndex * 17) % 997 === 0) return "NaN";
    switch (kind) {
      case "HEART_RATE":
        return 90 + (ordinal * 13 + sessionIndex * 7) % 96;
      case "SPEED":
        return 7 + ((ordinal * 29 + sessionIndex * 11) % 181) / 10;
      case "ALTITUDE":
        return 250 + ((ordinal * 31 + sessionIndex * 19) % 1_200) / 10;
      case "CADENCE":
        return 55 + (ordinal * 23 + sessionIndex * 5) % 80;
      default:
        throw new Error(`unsupported synthetic signal kind: ${kind}`);
    }
  });
}

await mkdir(path.dirname(outputPath), { recursive: true });
zip.addBuffer(
  Buffer.from(JSON.stringify({
    exportVersion: "synthetic-dense-history",
    username: "fixture-dense-history-claim",
  })),
  "account-data-73-11111111-2222-4333-8444-555555555555.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);

for (let index = 0; index < scenario.sessions; index += 1) {
  const started = new Date(
    firstDate + index * scenario.sessionIntervalDays * 86_400_000 + 6 * 3_600_000,
  );
  const stopped = new Date(started.getTime() + 3_600_000);
  const date = started.toISOString().slice(0, 10);
  const localStart = started.toISOString().slice(0, 19);
  const localStop = stopped.toISOString().slice(0, 19);
  const sessionId = `synthetic-dense-session-${index}`;
  const exerciseId = `${sessionId}-exercise-0`;
  const session = {
    identifier: { id: sessionId },
    created: `${date}T23:00:00.000`,
    modified: `${date}T23:00:00.000`,
    startTime: localStart,
    stopTime: localStop,
    timezoneOffsetMinutes: 0,
    durationMillis: 3_600_000,
    distanceMeters: 10_000 + index % 2_000,
    calories: 400 + index % 300,
    hrAvg: 135 + index % 10,
    hrMax: 175 + index % 10,
    sport: { id: `synthetic-dense-sport-${index % 4}` },
    exercises: [{
      identifier: { id: exerciseId },
      created: `${date}T23:00:00.000`,
      modified: `${date}T23:00:00.000`,
      startTime: localStart,
      stopTime: localStop,
      timezoneOffsetMinutes: 0,
      durationMillis: 3_600_000,
      distanceMeters: 10_000 + index % 2_000,
      calories: 400 + index % 300,
      sport: { id: `synthetic-dense-sport-${index % 4}` },
      samples: {
        samples: [
          { type: "HEART_RATE", intervalMillis: 1_000, values: valuesFor("HEART_RATE", index) },
          { type: "SPEED", intervalMillis: 1_000, values: valuesFor("SPEED", index) },
          { type: "ALTITUDE", intervalMillis: 1_000, values: valuesFor("ALTITUDE", index) },
          { type: "CADENCE", intervalMillis: 1_000, values: valuesFor("CADENCE", index) },
        ],
        transitionSamples: [],
      },
    }],
  };
  const token = index.toString(16).padStart(12, "0");
  const artifactId = `88888888-7777-4666-8555-${token}`;
  zip.addBuffer(
    Buffer.from(JSON.stringify(session)),
    `training-session_${date}T06-00-00_73-${artifactId}.json`,
    { mtime: fixedTime, mode: 0o100644, compress: true },
  );
}

zip.end(equivalentContainerVariant
  ? { comment: "fitfreed-equivalent-container-variant-v1" }
  : undefined);
await new Promise((resolve, reject) => {
  zip.outputStream
    .pipe(createWriteStream(outputPath))
    .on("close", resolve)
    .on("error", reject);
});

process.stdout.write(`${JSON.stringify({ outputPath, ...scenario })}\n`);
