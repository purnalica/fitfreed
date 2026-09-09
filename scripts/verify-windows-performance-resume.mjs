import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shaPattern = /^[0-9a-f]{40}$/;
const runIdPattern = /^[1-9][0-9]*$/;
const workflowName = "Windows performance admission";
const workflowPath = ".github/workflows/windows-performance.yml";
const jobName = "Production data performance on Windows Server 2025";
const successfulPredecessors = [
  "Check out source",
  "Use the supported Node.js version",
  "Verify the Windows development environment",
  "Install locked JavaScript dependencies",
  "Build the source-bound Windows package",
  "Verify installed Windows cold-launch budget",
];
const filesystemStep = "Verify Windows filesystem failure recovery";
const previousFilesystemCommand =
  "node scripts/verify-windows-filesystem-reliability.mjs";
const currentFilesystemCommand =
  "npm run icons && node scripts/verify-windows-filesystem-reliability.mjs";
const skippedSuccessors = [
  "Verify full-scale import budgets",
  "Verify dense training-history budgets",
  "Verify Insights read-model performance budgets",
];
const allowedAutomationPaths = new Set([
  ".github/workflows/windows-performance.yml",
  "package-lock.json",
  "package.json",
  "scripts/cold-launch-benchmark.test.mjs",
  "scripts/verify-windows-filesystem-reliability.ps1",
  "scripts/verify-windows-performance-resume.mjs",
  "scripts/windows-filesystem-reliability.test.mjs",
  "scripts/windows-performance-resume.test.mjs",
  "scripts/windows-performance-workflow.test.mjs",
]);
const vitestLockEntry = /(?:^|\/)node_modules\/@vitest\/(?:expect|mocker|pretty-format|runner|snapshot|spy|utils)$/;

function fail(message) {
  throw new Error(`Windows performance resume rejected: ${message}`);
}

function clone(value) {
  return structuredClone(value);
}

function validatePackageManifest(previousPackage, currentPackage) {
  if (
    previousPackage?.devDependencies?.vitest !== "^4.1.10"
    || currentPackage?.devDependencies?.vitest !== "4.1.11"
    || previousPackage?.overrides?.["js-yaml"] !== undefined
    || currentPackage?.overrides?.["js-yaml"] !== "4.3.2"
    || previousPackage?.overrides?.["@testing-library/jest-dom"] !== undefined
    || previousPackage?.scripts?.["verify:windows-filesystem-reliability"]
      !== previousFilesystemCommand
    || currentPackage?.scripts?.["verify:windows-filesystem-reliability"]
      !== currentFilesystemCommand
    || !isDeepStrictEqual(currentPackage?.overrides?.["@testing-library/jest-dom"], {
      vitest: "4.1.11",
    })
  ) {
    fail("package manifest changes more than the admitted development tools and filesystem command");
  }

  const normalized = clone(currentPackage);
  normalized.devDependencies.vitest = previousPackage.devDependencies.vitest;
  normalized.scripts["verify:windows-filesystem-reliability"] = previousFilesystemCommand;
  delete normalized.overrides["js-yaml"];
  delete normalized.overrides["@testing-library/jest-dom"];
  if (!isDeepStrictEqual(previousPackage, normalized)) {
    fail("package manifest changes more than the admitted development tools and filesystem command");
  }
}

function admittedLockEntry(entryPath, previousEntry, currentEntry) {
  if (!previousEntry || !currentEntry || previousEntry.dev !== true || currentEntry.dev !== true) {
    return false;
  }
  if (entryPath === "node_modules/js-yaml") {
    return previousEntry.version === "4.3.1" && currentEntry.version === "4.3.2";
  }
  if (entryPath === "node_modules/vitest" || vitestLockEntry.test(entryPath)) {
    return previousEntry.version === "4.1.10" && currentEntry.version === "4.1.11";
  }
  return false;
}

function validatePackageLock(previousLock, currentLock) {
  const previousEnvelope = clone(previousLock);
  const currentEnvelope = clone(currentLock);
  delete previousEnvelope.packages;
  delete currentEnvelope.packages;
  if (!isDeepStrictEqual(previousEnvelope, currentEnvelope)) {
    fail("package lock changes more than the admitted development tools");
  }

  const previousPackages = previousLock?.packages;
  const currentPackages = currentLock?.packages;
  if (!previousPackages || !currentPackages) {
    fail("package lock changes more than the admitted development tools");
  }
  const previousRoot = clone(previousPackages[""]);
  const currentRoot = clone(currentPackages[""]);
  if (
    previousRoot?.devDependencies?.vitest !== "^4.1.10"
    || currentRoot?.devDependencies?.vitest !== "4.1.11"
  ) {
    fail("package lock changes more than the admitted development tools");
  }
  currentRoot.devDependencies.vitest = previousRoot.devDependencies.vitest;
  if (!isDeepStrictEqual(previousRoot, currentRoot)) {
    fail("package lock changes more than the admitted development tools");
  }

  const entryPaths = new Set([
    ...Object.keys(previousPackages),
    ...Object.keys(currentPackages),
  ]);
  entryPaths.delete("");
  for (const entryPath of entryPaths) {
    const previousEntry = previousPackages[entryPath];
    const currentEntry = currentPackages[entryPath];
    if (
      !isDeepStrictEqual(previousEntry, currentEntry)
      && !admittedLockEntry(entryPath, previousEntry, currentEntry)
    ) {
      fail("package lock changes more than the admitted development tools");
    }
  }
}

function requireStep(steps, name, conclusion, errorMessage) {
  const step = steps.find((candidate) => candidate.name === name);
  if (step?.conclusion !== conclusion) fail(errorMessage);
}

export function validateRetainedWindowsPerformanceEvidence({
  repository,
  currentSha,
  runId,
  run,
  jobs,
  isAncestor,
  changedPaths,
  previousPackage,
  currentPackage,
  previousLock,
  currentLock,
}) {
  if (!runIdPattern.test(runId ?? "") || Number(runId) !== run?.id) {
    fail("run identifier is invalid");
  }
  if (!shaPattern.test(currentSha ?? "") || !shaPattern.test(run?.head_sha ?? "")) {
    fail("source revision is invalid");
  }
  if (
    run.name !== workflowName
    || run.path !== workflowPath
    || run.event !== "workflow_dispatch"
    || run.status !== "completed"
    || run.conclusion !== "failure"
    || run.head_branch !== "main"
    || run.head_repository?.full_name !== repository
  ) {
    fail("run identity or terminal state differs");
  }
  if (!isAncestor) fail("accepted source is not an ancestor of the current source");

  const matchingJobs = jobs.filter((job) => job.name === jobName);
  if (
    matchingJobs.length !== 1
    || matchingJobs[0].head_sha !== run.head_sha
    || matchingJobs[0].status !== "completed"
    || matchingJobs[0].conclusion !== "failure"
  ) {
    fail("performance job identity or terminal state differs");
  }
  const steps = matchingJobs[0].steps ?? [];
  for (const predecessor of successfulPredecessors) {
    requireStep(
      steps,
      predecessor,
      "success",
      predecessor === "Verify installed Windows cold-launch budget"
        ? "cold-launch step did not succeed"
        : "a cold-launch prerequisite did not succeed",
    );
  }
  requireStep(
    steps,
    filesystemStep,
    "failure",
    "filesystem step was not the failed boundary",
  );
  for (const successor of skippedSuccessors) {
    requireStep(steps, successor, "skipped", "a downstream step was not skipped");
  }

  for (const changedPath of changedPaths) {
    if (!changedPath.startsWith("docs/") && !allowedAutomationPaths.has(changedPath)) {
      fail(`${changedPath} changes the measured product`);
    }
  }
  if (changedPaths.includes("package.json") || changedPaths.includes("package-lock.json")) {
    if (!changedPaths.includes("package.json") || !changedPaths.includes("package-lock.json")) {
      fail("package manifest and lock must change together");
    }
    validatePackageManifest(previousPackage, currentPackage);
    validatePackageLock(previousLock, currentLock);
  }

  return { acceptedSha: run.head_sha, currentSha, runId: run.id };
}

function git(arguments_) {
  return spawnSync("git", arguments_, {
    cwd: path.resolve(import.meta.dirname, ".."),
    encoding: "utf8",
  });
}

function requireGit(arguments_, message) {
  const result = git(arguments_);
  if (result.status !== 0 || result.error) fail(message);
  return result.stdout;
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) fail(`GitHub evidence request failed with status ${response.status}`);
  return response.json();
}

async function main() {
  const runId = process.env.FITFREED_ACCEPTED_RUN_ID;
  const repository = process.env.GITHUB_REPOSITORY;
  const currentSha = process.env.GITHUB_SHA;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !currentSha || !token || !runIdPattern.test(runId ?? "")) {
    fail("workflow identity, token, source, and accepted run are required");
  }
  const apiBase = `https://api.github.com/repos/${repository}`;
  const run = await githubJson(`${apiBase}/actions/runs/${runId}`, token);
  const jobResponse = await githubJson(
    `${apiBase}/actions/runs/${runId}/jobs?filter=latest&per_page=100`,
    token,
  );
  const ancestor = git(["merge-base", "--is-ancestor", run.head_sha, currentSha]);
  if (ancestor.error || ![0, 1].includes(ancestor.status)) {
    fail("source ancestry could not be inspected");
  }
  const changedPaths = requireGit(
    ["diff", "--name-only", "-z", `${run.head_sha}..${currentSha}`],
    "changed paths could not be inspected",
  ).split("\0").filter(Boolean);
  const previousPackage = JSON.parse(requireGit(
    ["show", `${run.head_sha}:package.json`],
    "accepted package manifest could not be inspected",
  ));
  const previousLock = JSON.parse(requireGit(
    ["show", `${run.head_sha}:package-lock.json`],
    "accepted package lock could not be inspected",
  ));
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const result = validateRetainedWindowsPerformanceEvidence({
    repository,
    currentSha,
    runId,
    run,
    jobs: jobResponse.jobs ?? [],
    isAncestor: ancestor.status === 0,
    changedPaths,
    previousPackage,
    currentPackage: JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8")),
    previousLock,
    currentLock: JSON.parse(readFileSync(path.join(repositoryRoot, "package-lock.json"), "utf8")),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
