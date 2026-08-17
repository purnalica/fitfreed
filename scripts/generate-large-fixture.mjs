import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import process from "node:process";
import { ZipFile } from "yazl";

const outputPath = path.resolve(process.argv[2] ?? ".artifacts/e2e/large.zip");
const entryCount = Number(process.argv[3] ?? 10_000);
const observationEntryCount = entryCount - 1;
const trainingSessions = Math.round(observationEntryCount * 0.4);
const dailyActivityObservations = observationEntryCount - trainingSessions;
const samplesPerTrainingSession = 500;
const timeSeriesSamples = trainingSessions * samplesPerTrainingSession;
const padding = Buffer.alloc(Number(process.argv[4] ?? 536_900), 0x78);
const accountData = Buffer.from(
  '{"exportVersion":"synthetic","username":"fixture-scale-claim"}',
);
const fixedTime = new Date("2000-01-01T00:00:00.000Z");
const startDate = Date.UTC(1990, 0, 1);
const zip = new ZipFile();
let expandedBytes = accountData.length;
const excludedSamples = Buffer.from(
  JSON.stringify(
    Array.from({ length: samplesPerTrainingSession }, (_, index) => ({
      offsetMilliseconds: index * 1_000,
      value: (index * 37) % 251,
    })),
  ),
);

await mkdir(path.dirname(outputPath), { recursive: true });
zip.addBuffer(
  accountData,
  "account-data-42-11111111-2222-4333-8444-555555555555.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);

for (let index = 0; index < dailyActivityObservations; index += 1) {
  const date = new Date(startDate + index * 86_400_000).toISOString().slice(0, 10);
  const token = index.toString(16).padStart(12, "0");
  const artifactId = `00000000-0000-4000-8000-${token}`;
  const prefix = Buffer.from(
    `{"date":"${date}","summary":{"stepCount":${(index * 7919) % 40_000}},"syntheticPadding":"`,
  );
  const suffix = Buffer.from('"}');
  const size = prefix.length + padding.length + suffix.length;
  expandedBytes += size;
  zip.addReadStream(
    Readable.from([prefix, padding, suffix]),
    `activity-${date}-${artifactId}.json`,
    {
      size,
      mtime: fixedTime,
      mode: 0o100644,
      compress: true,
      compressionLevel: 1,
    },
  );
}

for (let index = 0; index < trainingSessions; index += 1) {
  const date = new Date(startDate + index * 86_400_000).toISOString().slice(0, 10);
  const token = (dailyActivityObservations + index).toString(16).padStart(12, "0");
  const artifactId = `00000000-0000-4000-8000-${token}`;
  const prefix = Buffer.from(
    `{"identifier":{"id":"synthetic-scale-session-${index}"},"created":"${date}T23:00:00.000","modified":"${date}T23:00:00.000","startTime":"${date}T06:00:00","stopTime":"${date}T07:00:00","timezoneOffsetMinutes":0,"durationMillis":3600000,"distanceMeters":10000,"calories":500,"hrAvg":130,"hrMax":165,"sport":{"id":"synthetic-scale-sport"},"exercises":[],"samples":`,
  );
  const paddingPrefix = Buffer.from(',"syntheticPadding":"');
  const suffix = Buffer.from('"}');
  const size =
    prefix.length +
    excludedSamples.length +
    paddingPrefix.length +
    padding.length +
    suffix.length;
  expandedBytes += size;
  zip.addReadStream(
    Readable.from([prefix, excludedSamples, paddingPrefix, padding, suffix]),
    `training-session_${date}T06-00-00_42-${artifactId}.json`,
    {
      size,
      mtime: fixedTime,
      mode: 0o100644,
      compress: true,
      compressionLevel: 1,
    },
  );
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
  entryCount,
  dailyActivityObservations,
  trainingSessions,
  timeSeriesSamples,
  expandedBytes,
})}\n`);
