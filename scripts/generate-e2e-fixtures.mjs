import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ZipFile } from "yazl";

const outputDirectory = path.resolve(process.argv[2] ?? ".artifacts/e2e/fixtures");
const fixedTime = new Date("2000-01-01T00:00:00.000Z");

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
    "activity-2026-01-01-invalid.json",
    '{"date":"2026-01-01","summary":{"stepCount":-1}}',
  ],
]);
await createArchive("valid.zip", [
  [
    "activity-2026-01-01-a.json",
    '{"date":"2026-01-01","summary":{"stepCount":3100}}',
  ],
  [
    "activity-2026-01-02-a.json",
    '{"date":"2026-01-02","summary":{"stepCount":4200}}',
  ],
  ["activity-2026-01-03-a.json", '{"date":"2026-01-03"}'],
]);
await createArchive("overlap.zip", [
  [
    "activity-2026-01-02-b.json",
    '{"date":"2026-01-02","summary":{"stepCount":4200}}',
  ],
  [
    "activity-2026-01-04-b.json",
    '{"date":"2026-01-04","summary":{"stepCount":5300}}',
  ],
]);

process.stdout.write(`${JSON.stringify({ outputDirectory, fixtureCount: 3 })}\n`);
