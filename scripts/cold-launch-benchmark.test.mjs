import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  productionBuildEnvironment,
  productionBuildIdentity,
} from "./build-production.mjs";
import {
  deriveColdLaunchRun,
  evaluateColdLaunchRuns,
  validateInteractiveShellSignal,
} from "./run-cold-launch-benchmark.mjs";

const revision = "a".repeat(40);
const syntheticBuildHome = `/${["Users", "synthetic-builder"].join("/")}`;

test("binds a production build to its exact revision and clean-tree state", () => {
  assert.deepEqual(productionBuildIdentity(revision, ""), {
    FITFREED_SOURCE_REVISION: revision,
    FITFREED_SOURCE_TREE_CLEAN: "true",
  });
  assert.deepEqual(productionBuildIdentity(revision, " M src/App.tsx\n"), {
    FITFREED_SOURCE_REVISION: revision,
    FITFREED_SOURCE_TREE_CLEAN: "false",
  });
  assert.throws(() => productionBuildIdentity("not-a-revision", ""), /invalid Git revision/);
});

test("keeps ordinary builds unconfigured and admits public inputs only explicitly", () => {
  const inherited = {
    HOME: syntheticBuildHome,
    PATH: "/synthetic/bin",
    RUSTFLAGS: "-C target-cpu=apple-m1",
    FITFREED_E2E_DATABASE_PATH: "/private/e2e.sqlite",
    FITFREED_PUBLIC_UPDATE_CONTRACT: "inherited-contract",
    FITFREED_PUBLIC_UPDATE_ENDPOINT: "https://inherited.invalid/stable.json",
    FITFREED_PUBLIC_UPDATE_TRUST: '{"inherited":"trust"}',
    TAURI_WEBDRIVER_PORT: "4444",
    VITE_FITFREED_E2E: "true",
  };
  const identity = productionBuildIdentity(revision, "");
  const buildPaths = {
    sourceRoot: `${syntheticBuildHome}/workspace with spaces/fitfreed`,
  };
  const encodedRustFlags = [
    "-C",
    "target-cpu=apple-m1",
    `--remap-path-prefix=${syntheticBuildHome}=/fitfreed/build-home`,
    `--remap-path-prefix=${syntheticBuildHome}/workspace with spaces/fitfreed=/fitfreed/source`,
  ].join("\u001f");

  assert.deepEqual(productionBuildEnvironment(inherited, identity, {}, buildPaths), {
    HOME: syntheticBuildHome,
    PATH: "/synthetic/bin",
    CARGO_ENCODED_RUSTFLAGS: encodedRustFlags,
    ...identity,
  });
  assert.deepEqual(
    productionBuildEnvironment(inherited, identity, {
      FITFREED_PUBLIC_UPDATE_CONTRACT: "stable-v2",
      FITFREED_PUBLIC_UPDATE_ENDPOINT: "https://updates.invalid/stable.json",
      FITFREED_PUBLIC_UPDATE_TRUST: '{"stable.synthetic":"trust"}',
    }, buildPaths),
    {
      HOME: syntheticBuildHome,
      PATH: "/synthetic/bin",
      CARGO_ENCODED_RUSTFLAGS: encodedRustFlags,
      ...identity,
      FITFREED_PUBLIC_UPDATE_CONTRACT: "stable-v2",
      FITFREED_PUBLIC_UPDATE_ENDPOINT: "https://updates.invalid/stable.json",
      FITFREED_PUBLIC_UPDATE_TRUST: '{"stable.synthetic":"trust"}',
    },
  );
});

test("preserves encoded compiler arguments while appending deterministic path remaps", () => {
  const identity = productionBuildIdentity(revision, "");
  const environment = productionBuildEnvironment({
    HOME: syntheticBuildHome,
    CARGO_HOME: "/opt/synthetic cargo",
    RUSTUP_HOME: `${syntheticBuildHome}/.rustup`,
    TMPDIR: "/private/var/folders/synthetic/T/",
    CARGO_ENCODED_RUSTFLAGS: ["-C", "target-feature=+aes"].join("\u001f"),
    RUSTFLAGS: "-D warnings",
  }, identity, {}, {
    sourceRoot: `${syntheticBuildHome}/project`,
  });

  assert.equal(environment.RUSTFLAGS, undefined);
  assert.deepEqual(environment.CARGO_ENCODED_RUSTFLAGS.split("\u001f"), [
    "-C",
    "target-feature=+aes",
    "--remap-path-prefix=/opt/synthetic cargo=/fitfreed/cargo",
    `--remap-path-prefix=${syntheticBuildHome}=/fitfreed/build-home`,
    `--remap-path-prefix=${syntheticBuildHome}/.rustup=/fitfreed/rustup`,
    "--remap-path-prefix=/private/var/folders/synthetic/T=/fitfreed/build-temp",
    `--remap-path-prefix=${syntheticBuildHome}/project=/fitfreed/source`,
  ]);
});

test("accepts only the exact privacy-safe interactive-shell signal", () => {
  const signal = {
    format: "org.fitfreed.startup-signal",
    schemaVersion: 2,
    event: "interactive-shell",
    applicationVersion: "0.1.0",
    sourceRevision: revision,
    sourceTreeClean: true,
    hostStartupMilliseconds: {
      setupComplete: 200,
      signal: 600,
    },
    rendererStartupMilliseconds: {
      localeReady: 200,
      signal: 300,
    },
  };

  assert.equal(
    validateInteractiveShellSignal(signal, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    true,
  );
  assert.throws(
    () => validateInteractiveShellSignal({ ...signal, event: "host-started" }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /interactive-shell event/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({ ...signal, sourceTreeClean: false }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /clean source tree/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({ ...signal, sourceRevision: "b".repeat(40) }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /source revision/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({
      ...signal,
      hostStartupMilliseconds: { setupComplete: 601, signal: 600 },
    }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /host startup timings/,
  );
  assert.throws(
    () => validateInteractiveShellSignal({
      ...signal,
      rendererStartupMilliseconds: { localeReady: 301, signal: 300 },
    }, {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    }),
    /renderer startup timings/,
  );
  assert.deepEqual(deriveColdLaunchRun(700, signal), {
    totalMilliseconds: 700,
    processCreationAndEvidenceTransportMilliseconds: 100,
    hostStartupToSetupCompleteMilliseconds: 200,
    setupCompleteToRendererStartupAndCommandTransportMilliseconds: 100,
    rendererStartupToLocaleReadyMilliseconds: 200,
    localeReadyToInteractiveSignalMilliseconds: 100,
  });
});

test("enforces the cold-launch p95 budget across one hundred fresh processes", () => {
  const evidence = evaluateColdLaunchRuns(
    Array.from({ length: 100 }, (_, index) => ({
      totalMilliseconds: 700 + index * 10,
      processCreationAndEvidenceTransportMilliseconds: 100,
      hostStartupToSetupCompleteMilliseconds: 200,
      setupCompleteToRendererStartupAndCommandTransportMilliseconds: 100 + index * 10,
      rendererStartupToLocaleReadyMilliseconds: 200,
      localeReadyToInteractiveSignalMilliseconds: 100,
    })),
  );

  assert.deepEqual(evidence, {
    measuredFreshProcesses: 100,
    medianMilliseconds: 1_200,
    p95Milliseconds: 1_650,
    maximumMilliseconds: 1_690,
    p95BudgetMilliseconds: 2_500,
    phases: {
      processCreationAndEvidenceTransport: {
        medianMilliseconds: 100,
        p95Milliseconds: 100,
        maximumMilliseconds: 100,
      },
      hostStartupToSetupComplete: {
        medianMilliseconds: 200,
        p95Milliseconds: 200,
        maximumMilliseconds: 200,
      },
      setupCompleteToRendererStartupAndCommandTransport: {
        medianMilliseconds: 600,
        p95Milliseconds: 1_050,
        maximumMilliseconds: 1_090,
      },
      rendererStartupToLocaleReady: {
        medianMilliseconds: 200,
        p95Milliseconds: 200,
        maximumMilliseconds: 200,
      },
      localeReadyToInteractiveSignal: {
        medianMilliseconds: 100,
        p95Milliseconds: 100,
        maximumMilliseconds: 100,
      },
    },
    passed: true,
  });
  assert.equal(
    evaluateColdLaunchRuns(Array.from({ length: 100 }, () => ({
      totalMilliseconds: 2_501,
      processCreationAndEvidenceTransportMilliseconds: 100,
      hostStartupToSetupCompleteMilliseconds: 200,
      setupCompleteToRendererStartupAndCommandTransportMilliseconds: 1_901,
      rendererStartupToLocaleReadyMilliseconds: 200,
      localeReadyToInteractiveSignalMilliseconds: 100,
    }))).passed,
    false,
  );
  assert.throws(
    () => evaluateColdLaunchRuns(Array.from({ length: 99 }, () => ({
      totalMilliseconds: 500,
    }))),
    /exactly 100 measured processes/,
  );
  assert.throws(
    () => evaluateColdLaunchRuns([
      ...Array.from({ length: 99 }, () => ({ totalMilliseconds: 500 })),
      { totalMilliseconds: -1 },
    ]),
    /non-negative finite duration/,
  );
});

test("keeps maximum outliers separate from the cold-launch p95 decision", () => {
  const run = (totalMilliseconds) => ({
    totalMilliseconds,
    processCreationAndEvidenceTransportMilliseconds: 100,
    hostStartupToSetupCompleteMilliseconds: 200,
    setupCompleteToRendererStartupAndCommandTransportMilliseconds:
      totalMilliseconds - 600,
    rendererStartupToLocaleReadyMilliseconds: 200,
    localeReadyToInteractiveSignalMilliseconds: 100,
  });
  const fourOutliers = evaluateColdLaunchRuns([
    ...Array.from({ length: 96 }, () => run(1_000)),
    ...Array.from({ length: 4 }, () => run(3_000)),
  ]);
  const fiveOutliers = evaluateColdLaunchRuns([
    ...Array.from({ length: 95 }, () => run(1_000)),
    ...Array.from({ length: 5 }, () => run(3_000)),
  ]);

  assert.equal(fourOutliers.p95Milliseconds, 1_000);
  assert.equal(fourOutliers.maximumMilliseconds, 3_000);
  assert.equal(fourOutliers.passed, true);
  assert.equal(fiveOutliers.p95Milliseconds, 3_000);
  assert.equal(fiveOutliers.maximumMilliseconds, 3_000);
  assert.equal(fiveOutliers.passed, false);
});

test("wires production identity and cold launch into local and hosted gates", () => {
  const packageMetadata = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );

  assert.equal(
    packageMetadata.scripts.package,
    "npm run icons && node scripts/build-production.mjs",
  );
  assert.equal(
    packageMetadata.scripts["package:app"],
    "npm run icons && node scripts/build-production.mjs --bundles app",
  );
  assert.equal(
    packageMetadata.scripts["benchmark:cold-launch"],
    "node scripts/run-cold-launch-benchmark.mjs",
  );
  assert.match(
    packageMetadata.scripts["verify:precommit"],
    /doctor.*package$/,
  );
  assert.doesNotMatch(
    packageMetadata.scripts["verify:precommit"],
    /benchmark:cold-launch|check:production-bundle|verify:update-recovery-preparation/,
  );
  assert.equal(
    packageMetadata.scripts["verify:full"],
    "npm run verify:precommit && npm run benchmark:cold-launch && npm run check:production-bundle && npm run verify:update-recovery-preparation",
  );
  assert.match(
    workflow,
    /name: Verify cold-launch budget\n\s+run: npm run benchmark:cold-launch/,
  );
  assert.ok(
    workflow.indexOf("name: Verify cold-launch budget")
      < workflow.indexOf("name: Verify full-scale import budgets"),
    "cold launch must fail before the long performance campaigns",
  );
});
