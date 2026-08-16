import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { ZipFile } from "yazl";

const outputPath = path.resolve(
  process.argv[2] ?? ".artifacts/e2e/activity-performance.zip",
);
const fixedTime = new Date("2000-01-01T00:00:00.000Z");
const firstDate = Date.UTC(2024, 0, 1);
const throughDate = Date.UTC(2025, 11, 31);
const calendarDays = Math.floor((throughDate - firstDate) / 86_400_000) + 1;
const syntheticUsername = "fixture-primary-claim";
const zip = new ZipFile();
let storedObservations = 0;
let unavailableObservations = 0;

await mkdir(path.dirname(outputPath), { recursive: true });
zip.addBuffer(
  Buffer.from(JSON.stringify({ exportVersion: "synthetic-performance", username: syntheticUsername })),
  "account-data-91-99999999-8888-4777-8666-555555555555.json",
  { mtime: fixedTime, mode: 0o100644, compress: true },
);

for (let index = 0; index < calendarDays; index += 1) {
  if (index !== 0 && index !== calendarDays - 1 && index % 23 === 0) continue;
  const date = new Date(firstDate + index * 86_400_000).toISOString().slice(0, 10);
  const token = index.toString(16).padStart(12, "0");
  const artifactId = `77777777-6666-4555-8444-${token}`;
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
})}\n`);
