import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const inputs = [
  ["sports.json", "https://flow.polar.com/api/sports/sports"],
  [
    "localization-index.json",
    "https://localizations.flow.polar.com/v2/json-namespaced/index.json",
  ],
  [
    "sport-en.json",
    "https://localizations.flow.polar.com/v2/json-namespaced/en/sport.json",
  ],
  [
    "sport-es.json",
    "https://localizations.flow.polar.com/v2/json-namespaced/es/sport.json",
  ],
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validateInstant(value) {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)
    || Number.isNaN(Date.parse(value))
  ) {
    throw new Error("retrieval instant is invalid");
  }
  return value;
}

function parseJson(bytes, filename) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${filename} is not valid JSON: ${error.message}`);
  }
}

async function fetchInput(fetchImpl, filename, uri) {
  const response = await fetchImpl(uri, {
    credentials: "omit",
    headers: { accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`${filename} acquisition failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(`${filename} acquisition returned a non-JSON content type`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  parseJson(bytes, filename);
  return bytes;
}

export async function acquirePolarSportInputs({
  fetchImpl = globalThis.fetch,
  retrievedAtUtc = new Date().toISOString(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("a fetch implementation is required");
  }
  const retrievedAt = validateInstant(retrievedAtUtc);
  const acquired = await Promise.all(
    inputs.map(async ([filename, uri]) => [filename, uri, await fetchInput(fetchImpl, filename, uri)]),
  );
  const files = Object.fromEntries(acquired.map(([filename, , bytes]) => [filename, bytes]));
  const localizationIndex = parseJson(files["localization-index.json"], "localization-index.json");
  if (typeof localizationIndex.version !== "string" || localizationIndex.version.length === 0) {
    throw new Error("localization-index.json has no revision");
  }
  const observedInputs = {};
  for (const [filename, uri, bytes] of acquired) {
    observedInputs[filename] = {
      uri,
      sha256: sha256(bytes),
      byteCount: bytes.length,
    };
  }
  const observation = {
    retrievedAtUtc: retrievedAt,
    localizationRevision: localizationIndex.version,
    inputs: observedInputs,
  };
  return {
    files,
    observation,
    observationBytes: Buffer.from(`${JSON.stringify(observation, null, 2)}\n`),
  };
}

async function run() {
  const [outputDirectory] = process.argv.slice(2);
  if (!outputDirectory) {
    throw new Error("usage: acquire-polar-sport-catalogue <ignored-local-output-directory>");
  }
  const outputPath = path.resolve(outputDirectory);
  const acquired = await acquirePolarSportInputs();
  mkdirSync(outputPath, { recursive: true });
  for (const [filename, bytes] of Object.entries(acquired.files)) {
    writeFileSync(path.join(outputPath, filename), bytes);
  }
  writeFileSync(path.join(outputPath, "observation.json"), acquired.observationBytes);
  process.stdout.write(`${JSON.stringify(acquired.observation)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await run();
