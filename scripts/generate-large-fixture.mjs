import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import process from "node:process";
import { ZipFile } from "yazl";

const outputPath = path.resolve(process.argv[2] ?? ".artifacts/e2e/large.zip");
const entryCount = Number(process.argv[3] ?? 10_000);
const padding = Buffer.alloc(Number(process.argv[4] ?? 536_900), 0x78);
const fixedTime = new Date("2000-01-01T00:00:00.000Z");
const startDate = Date.UTC(1990, 0, 1);
const zip = new ZipFile();
let expandedBytes = 0;

await mkdir(path.dirname(outputPath), { recursive: true });

for (let index = 0; index < entryCount; index += 1) {
  const date = new Date(startDate + index * 86_400_000).toISOString().slice(0, 10);
  const token = String(index).padStart(5, "0");
  const prefix = Buffer.from(
    `{"date":"${date}","summary":{"stepCount":${(index * 7919) % 40_000}},"syntheticPadding":"`,
  );
  const suffix = Buffer.from('"}');
  const size = prefix.length + padding.length + suffix.length;
  expandedBytes += size;
  zip.addReadStream(
    Readable.from([prefix, padding, suffix]),
    `activity-${date}-${token}.json`,
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

process.stdout.write(`${JSON.stringify({ outputPath, entryCount, expandedBytes })}\n`);
