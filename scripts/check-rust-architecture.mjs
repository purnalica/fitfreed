import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repositoryRoot, "src-tauri", "Cargo.toml");
const metadataResult = spawnSync(
  "cargo",
  ["metadata", "--manifest-path", manifestPath, "--format-version", "1", "--no-deps"],
  { encoding: "utf8" },
);

if (metadataResult.status !== 0) {
  process.stderr.write(metadataResult.stderr);
  process.exit(metadataResult.status ?? 1);
}

const metadata = JSON.parse(metadataResult.stdout);
const packages = new Map(metadata.packages.map((candidate) => [candidate.name, candidate]));

function dependencyNames(packageName) {
  const package_ = packages.get(packageName);
  if (!package_) throw new Error(`Cargo package is missing: ${packageName}`);
  return package_.dependencies.map((dependency) => dependency.name).sort();
}

function requireDependencies(packageName, expected) {
  const actual = dependencyNames(packageName);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${packageName} dependencies must be ${expected.join(", ") || "empty"}; found ${actual.join(", ") || "empty"}`,
    );
  }
}

function rejectBoundaryTerms(relativePath, forbiddenTerms) {
  const source = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  for (const term of forbiddenTerms) {
    if (source.toLowerCase().includes(term.toLowerCase())) {
      throw new Error(`${relativePath} crosses its dependency boundary with: ${term}`);
    }
  }
}

requireDependencies("fitfreed-domain", []);
requireDependencies("fitfreed-application", ["fitfreed-domain", "thiserror"]);

const forbiddenAdapterTerms = [
  "tauri",
  "rusqlite",
  "serde",
  "serde_json",
  "zip::",
  "chrono",
  "polar",
  "garmin",
];
rejectBoundaryTerms(
  "src-tauri/crates/fitfreed-domain/src/lib.rs",
  forbiddenAdapterTerms,
);
rejectBoundaryTerms(
  "src-tauri/crates/fitfreed-application/src/lib.rs",
  forbiddenAdapterTerms,
);

process.stdout.write(
  `${JSON.stringify({ domainDependencies: [], applicationDependencies: ["fitfreed-domain", "thiserror"] })}\n`,
);
