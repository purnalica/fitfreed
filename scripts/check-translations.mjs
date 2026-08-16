import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localeDirectory = path.join(repositoryRoot, "src", "locales");
const localeFiles = ["en-US.json", "es-ES.json"];

function flatten(value, prefix = "") {
  const entries = [];
  for (const [key, child] of Object.entries(value)) {
    const path_ = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      entries.push([path_, child]);
    } else if (child && typeof child === "object" && !Array.isArray(child)) {
      entries.push(...flatten(child, path_));
    } else {
      throw new Error(`${path_} must contain a string or nested message object`);
    }
  }
  return entries;
}

const catalogs = localeFiles.map((file) => {
  const content = JSON.parse(readFileSync(path.join(localeDirectory, file), "utf8"));
  return { file, entries: new Map(flatten(content)) };
});
const canonicalKeys = [...catalogs[0].entries.keys()].sort();
const coverageReasonCodes = [
  "mapped",
  "mapped-summary",
  "mapped-sleep-periods",
  "mapped-sleep-scores",
  "source-subject-claim",
  "known-family-not-yet-supported",
  "mvp-excludes-sensitive-profile",
  "mvp-excludes-profile-picture",
  "mvp-excludes-full-resolution-physiology",
  "unrecognized-artifact-family",
  "invalid-supported-artifact",
  "filename-content-date-mismatch",
  "filename-content-start-mismatch",
  "duplicate-daily-activity-date",
  "duplicate-training-session-id",
  "duplicate-sleep-result-date",
  "duplicate-sleep-score-date",
  "orphan-sleep-score-date",
  "invalid-source-subject-evidence",
];

for (const catalog of catalogs) {
  const keys = [...catalog.entries.keys()].sort();
  if (JSON.stringify(keys) !== JSON.stringify(canonicalKeys)) {
    const missing = canonicalKeys.filter((key) => !catalog.entries.has(key));
    const extra = keys.filter((key) => !catalogs[0].entries.has(key));
    throw new Error(
      `${catalog.file} key mismatch; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
    );
  }
  for (const [key, message] of catalog.entries) {
    if (message.trim().length === 0) {
      throw new Error(`${catalog.file}:${key} must not be empty`);
    }
  }
  for (const reasonCode of coverageReasonCodes) {
    for (const field of ["reason", "action"]) {
      const key = `outcome.coverageExplanations.${reasonCode}.${field}`;
      if (!catalog.entries.has(key)) {
        throw new Error(`${catalog.file} does not explain coverage reason ${reasonCode}`);
      }
    }
  }
}

process.stdout.write(
  `${JSON.stringify({ locales: localeFiles.map((file) => file.replace(".json", "")), messages: canonicalKeys.length })}\n`,
);
