import { readdirSync, readFileSync } from "node:fs";
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

function rustSources(relativeDirectory) {
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return rustSources(relativePath);
    return entry.isFile() && entry.name.endsWith(".rs") ? [relativePath] : [];
  });
}

function frontendSources(relativeDirectory) {
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return frontendSources(relativePath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [relativePath] : [];
  });
}

function rejectBoundaryTerms(relativeDirectory, forbiddenTerms) {
  for (const relativePath of rustSources(relativeDirectory)) {
    const source = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    for (const term of forbiddenTerms) {
      if (source.toLowerCase().includes(term.toLowerCase())) {
        throw new Error(`${relativePath} crosses its dependency boundary with: ${term}`);
      }
    }
  }
}

requireDependencies("fitfreed-domain", []);
requireDependencies("fitfreed-application", [
  "chrono",
  "fitfreed-domain",
  "semver",
  "thiserror",
  "url",
]);

const forbiddenAdapterTerms = [
  "tauri",
  "rusqlite",
  "serde",
  "serde_json",
  "zip::",
  "chrono",
  "polar",
  "garmin",
  "echarts",
  "plotters",
];
rejectBoundaryTerms(
  "src-tauri/crates/fitfreed-domain/src",
  forbiddenAdapterTerms,
);
rejectBoundaryTerms(
  "src-tauri/crates/fitfreed-application/src",
  forbiddenAdapterTerms.filter((term) => term !== "chrono"),
);

const hostSource = readFileSync(path.join(repositoryRoot, "src-tauri/src/lib.rs"), "utf8");
const presentationSource = readFileSync(
  path.join(repositoryRoot, "src/presentation/UpdatePanel.tsx"),
  "utf8",
);
const hostUpdateEvent = hostSource.match(
  /const UPDATE_CHECK_COMPLETED_EVENT: &str = "([^"]+)";/,
)?.[1];
const presentationUpdateEvent = presentationSource.match(
  /const UPDATE_CHECK_COMPLETED_EVENT = "([^"]+)";/,
)?.[1];
if (!hostUpdateEvent || hostUpdateEvent !== presentationUpdateEvent) {
  throw new Error(
    "the desktop host and update presentation must use the same periodic update event",
  );
}

if (/\bfn query_training_overview\b|\bquery_training_overview,/.test(hostSource)) {
  throw new Error(
    "the obsolete training-overview desktop command must not remain after session discovery replaced its presentation path",
  );
}

const obsoleteTrainingOverviewConsumers = frontendSources("src").filter((relativePath) => (
  readFileSync(path.join(repositoryRoot, relativePath), "utf8").includes(
    '"query_training_overview"',
  )
));
if (obsoleteTrainingOverviewConsumers.length > 0) {
  throw new Error(
    `the obsolete training-overview desktop command still has frontend references: ${obsoleteTrainingOverviewConsumers.join(", ")}`,
  );
}

const echartsAdapterPath = path.join(
  "src",
  "presentation",
  "echarts-analytical-chart-adapter.ts",
);
const echartsConsumers = frontendSources("src").filter((relativePath) => {
  const source = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  return /(?:from\s+|import\s+)["']echarts(?:\/|["'])/.test(source);
});
if (echartsConsumers.length !== 1 || echartsConsumers[0] !== echartsAdapterPath) {
  throw new Error(
    `ECharts imports must remain confined to ${echartsAdapterPath}; found ${echartsConsumers.join(", ") || "none"}`,
  );
}

const plottersConsumers = metadata.packages
  .filter((candidate) => candidate.dependencies.some((dependency) => dependency.name === "plotters"))
  .map((candidate) => candidate.name);
if (plottersConsumers.some((packageName) => packageName !== "fitfreed")) {
  throw new Error(
    `Plotters may only enter through the desktop infrastructure package; found ${plottersConsumers.join(", ")}`,
  );
}
const plottersDependency = packages
  .get("fitfreed")
  ?.dependencies.find((dependency) => dependency.name === "plotters");
if (
  !plottersDependency
  || plottersDependency.req !== "=0.3.7"
  || plottersDependency.uses_default_features
  || JSON.stringify(plottersDependency.features) !== JSON.stringify(["svg_backend"])
) {
  throw new Error(
    "the desktop static-chart adapter must use exact Plotters 0.3.7 with only svg_backend enabled",
  );
}
const plottersAdapterPath = path.join(
  "src-tauri",
  "src",
  "infrastructure",
  "report_chart.rs",
);
const plottersSourceConsumers = rustSources("src-tauri/src").filter((relativePath) => (
  readFileSync(path.join(repositoryRoot, relativePath), "utf8").includes("plotters::")
));
if (
  plottersSourceConsumers.length !== 1
  || plottersSourceConsumers[0] !== plottersAdapterPath
) {
  throw new Error(
    `Plotters imports must remain confined to ${plottersAdapterPath}; found ${plottersSourceConsumers.join(", ") || "none"}`,
  );
}

process.stdout.write(
  `${JSON.stringify({ domainDependencies: [], applicationDependencies: ["chrono", "fitfreed-domain", "semver", "thiserror", "url"], updateEvent: hostUpdateEvent, analyticalChartAdapter: echartsAdapterPath, staticChartAdapter: plottersAdapterPath, staticChartPackages: plottersConsumers })}\n`,
);
