import assert from "node:assert/strict";
import test from "node:test";

import { validateRetainedWindowsPerformanceEvidence } from "./verify-windows-performance-resume.mjs";

const acceptedSha = "a".repeat(40);
const currentSha = "b".repeat(40);
const runId = "34315586139";
const previousFilesystemCommand =
  "node scripts/verify-windows-filesystem-reliability.mjs";
const currentFilesystemCommand =
  "npm run icons && node scripts/verify-windows-filesystem-reliability.mjs";
const acceptedWindowsFilesystemBlobOid = "8d5a234ea6b84e100da230f733cfaa475f9ac067";
const currentWindowsFilesystemBlobOid = "a28aa7f95640e96ca952343cd860b1423f811cbe";

function packageManifest(vitest = "^4.1.10", filesystemCommand = previousFilesystemCommand) {
  return {
    name: "fitfreed",
    scripts: {
      build: "vite build",
      "verify:windows-filesystem-reliability": filesystemCommand,
    },
    overrides: { "@puppeteer/browsers": "3.2.0" },
    dependencies: { react: "19.2.4" },
    devDependencies: { vitest },
  };
}

function packageLock(vitest = "4.1.10", yaml = "4.3.1") {
  return {
    name: "fitfreed",
    lockfileVersion: 3,
    packages: {
      "": {
        dependencies: { react: "19.2.4" },
        devDependencies: { vitest: vitest === "4.1.10" ? "^4.1.10" : vitest },
      },
      "node_modules/@vitest/expect": {
        version: vitest,
        resolved: `https://registry.npmjs.org/@vitest/expect/-/expect-${vitest}.tgz`,
        integrity: `expect-${vitest}`,
        dev: true,
        dependencies: { "@vitest/spy": vitest },
      },
      "node_modules/js-yaml": {
        version: yaml,
        resolved: `https://registry.npmjs.org/js-yaml/-/js-yaml-${yaml}.tgz`,
        integrity: `yaml-${yaml}`,
        dev: true,
      },
      "node_modules/react": { version: "19.2.4" },
      "node_modules/vitest": {
        version: vitest,
        resolved: `https://registry.npmjs.org/vitest/-/vitest-${vitest}.tgz`,
        integrity: `vitest-${vitest}`,
        dev: true,
        dependencies: { "@vitest/expect": vitest },
      },
    },
  };
}

function evidence(overrides = {}) {
  const previousPackage = packageManifest();
  const currentPackage = packageManifest("4.1.11", currentFilesystemCommand);
  currentPackage.overrides["@testing-library/jest-dom"] = { vitest: "4.1.11" };
  currentPackage.overrides["js-yaml"] = "4.3.2";
  return {
    repository: "purnalica/fitfreed",
    currentSha,
    runId,
    run: {
      id: Number(runId),
      name: "Windows performance admission",
      path: ".github/workflows/windows-performance.yml",
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "failure",
      head_sha: acceptedSha,
      head_branch: "main",
      head_repository: { full_name: "purnalica/fitfreed" },
    },
    jobs: [
      {
        name: "Production data performance on Windows Server 2025",
        head_sha: acceptedSha,
        status: "completed",
        conclusion: "failure",
        steps: [
          { name: "Check out source", conclusion: "success" },
          { name: "Use the supported Node.js version", conclusion: "success" },
          { name: "Verify the Windows development environment", conclusion: "success" },
          { name: "Install locked JavaScript dependencies", conclusion: "success" },
          { name: "Build the source-bound Windows package", conclusion: "success" },
          { name: "Verify installed Windows cold-launch budget", conclusion: "success" },
          { name: "Verify Windows filesystem failure recovery", conclusion: "failure" },
          { name: "Verify full-scale import budgets", conclusion: "skipped" },
          { name: "Verify dense training-history budgets", conclusion: "skipped" },
          { name: "Verify Insights read-model performance budgets", conclusion: "skipped" },
        ],
      },
    ],
    isAncestor: true,
    changedPaths: [
      ".github/workflows/windows-performance.yml",
      "docs/plans/milestone-5.md",
      "package-lock.json",
      "package.json",
      "scripts/cold-launch-benchmark.test.mjs",
      "scripts/verify-windows-filesystem-reliability.ps1",
      "scripts/verify-windows-performance-resume.mjs",
      "scripts/windows-filesystem-reliability.test.mjs",
      "scripts/windows-performance-resume.test.mjs",
      "scripts/windows-performance-workflow.test.mjs",
      "src-tauri/src/infrastructure.rs",
    ],
    previousWindowsFilesystemBlobOid: acceptedWindowsFilesystemBlobOid,
    currentWindowsFilesystemBlobOid,
    previousPackage,
    currentPackage,
    previousLock: packageLock(),
    currentLock: packageLock("4.1.11", "4.3.2"),
    ...overrides,
  };
}

test("retains only the completed package and cold-launch evidence that preceded the failure", () => {
  assert.deepEqual(validateRetainedWindowsPerformanceEvidence(evidence()), {
    acceptedSha,
    currentSha,
    runId: Number(runId),
  });
});

test("rejects a run without successful cold-launch evidence", () => {
  const input = evidence();
  input.jobs[0].steps.find(
    (step) => step.name === "Verify installed Windows cold-launch budget",
  ).conclusion = "failure";
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(input),
    /cold-launch step did not succeed/,
  );
});

test("rejects evidence whose next failure or skipped downstream boundary differs", () => {
  const wrongFailure = evidence();
  wrongFailure.jobs[0].steps.find(
    (step) => step.name === "Verify Windows filesystem failure recovery",
  ).conclusion = "success";
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(wrongFailure),
    /filesystem step was not the failed boundary/,
  );

  const executedDownstream = evidence();
  executedDownstream.jobs[0].steps.find(
    (step) => step.name === "Verify full-scale import budgets",
  ).conclusion = "success";
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(executedDownstream),
    /downstream step was not skipped/,
  );
});

test("rejects non-descendant or product changes", () => {
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(evidence({ isAncestor: false })),
    /not an ancestor/,
  );
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(
      evidence({ changedPaths: ["src/application/App.tsx"] }),
    ),
    /changes the measured product/,
  );
});

test("admits only the exact test-only Windows disk-pressure source correction", () => {
  assert.doesNotThrow(() => validateRetainedWindowsPerformanceEvidence(evidence()));

  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(evidence({
      currentWindowsFilesystemBlobOid: "c".repeat(40),
    })),
    /disk-pressure test source differs from the admitted correction/,
  );
});

test("rejects package changes outside the exact development-tool correction", () => {
  const input = evidence();
  input.currentPackage.dependencies.react = "20.0.0";
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(input),
    /package manifest changes more than the admitted development tools/,
  );

  const lockInput = evidence();
  lockInput.currentLock.packages["node_modules/react"].version = "20.0.0";
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(lockInput),
    /package lock changes more than the admitted development tools/,
  );

  const scriptInput = evidence();
  scriptInput.currentPackage.scripts.build = "vite build --debug";
  assert.throws(
    () => validateRetainedWindowsPerformanceEvidence(scriptInput),
    /package manifest changes more than the admitted development tools and filesystem command/,
  );
});
