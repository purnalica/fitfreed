import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  productionBuildEnvironment,
  productionBuildIdentity,
} from "./build-production.mjs";
import {
  activateMacosApplication,
  coldLaunchEnvironment,
  deriveColdLaunchRun,
  evaluateColdLaunchRuns,
  measureFreshProcess,
  resetInstalledWindowsApplicationData,
  resolveColdLaunchApplication,
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

test("resolves an exact installed Debian application without weakening source identity", () => {
  const calls = [];
  const inspected = [];
  const profile = resolveColdLaunchApplication({
    architecture: "x64",
    execute(program, arguments_) {
      calls.push([program, arguments_]);
      if (arguments_.some((argument) => argument.includes("${Status}"))) {
        return "install ok installed";
      }
      if (arguments_.some((argument) => argument.includes("${Version}"))) return "0.1.0";
      throw new Error("unexpected package query");
    },
    inspectBinary(binary) {
      inspected.push(binary);
    },
    platform: "linux",
  });

  assert.deepEqual(profile, {
    applicationBinary: "/usr/bin/fitfreed",
    applicationVersion: "0.1.0",
    boundary: "installed-debian-package",
  });
  assert.deepEqual(inspected, ["/usr/bin/fitfreed"]);
  assert.deepEqual(calls, [
    ["/usr/bin/dpkg-query", ["-W", "-f=${Status}", "fitfreed"]],
    ["/usr/bin/dpkg-query", ["-W", "-f=${Version}", "fitfreed"]],
  ]);
});

test("resolves the exact current-user Windows installation", () => {
  const calls = [];
  const inspected = [];
  const localApplicationData = "C:\\Users\\runner\\AppData\\Local";
  const profile = resolveColdLaunchApplication({
    architecture: "x64",
    environment: { LOCALAPPDATA: localApplicationData },
    execute(program, arguments_) {
      calls.push([program, arguments_]);
      return JSON.stringify({
        displayName: "FitFreed",
        displayVersion: "0.1.0",
        installLocation: `${localApplicationData}\\FitFreed`,
        mainBinaryName: "fitfreed.exe",
      });
    },
    inspectBinary(binary) {
      inspected.push(binary);
    },
    platform: "win32",
  });

  assert.deepEqual(profile, {
    applicationBinary: `${localApplicationData}\\FitFreed\\fitfreed.exe`,
    applicationVersion: "0.1.0",
    boundary: "installed-current-user-nsis-package",
  });
  assert.deepEqual(inspected, [`${localApplicationData}\\FitFreed\\fitfreed.exe`]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "powershell.exe");
  assert.match(calls[0][1].join(" "), /CurrentVersion\\Uninstall\\FitFreed/);
});

test("isolates Unix application data and preserves the native Windows known-folder boundary", () => {
  assert.deepEqual(
    coldLaunchEnvironment("/tmp/fresh-home", {
      DISPLAY: ":99",
      HOME: "/unrelated",
      XDG_CACHE_HOME: "/unrelated/cache",
      XDG_CONFIG_HOME: "/unrelated/config",
      XDG_DATA_HOME: "/unrelated/data",
      XDG_STATE_HOME: "/unrelated/state",
    }, "linux"),
    {
      DISPLAY: ":99",
      HOME: "/tmp/fresh-home",
      XDG_CACHE_HOME: "/tmp/fresh-home/.cache",
      XDG_CONFIG_HOME: "/tmp/fresh-home/.config",
      XDG_DATA_HOME: "/tmp/fresh-home/.local/share",
      XDG_STATE_HOME: "/tmp/fresh-home/.local/state",
    },
  );
  assert.deepEqual(
    coldLaunchEnvironment("/tmp/fresh-home", { HOME: "/unrelated" }, "darwin"),
    { HOME: "/tmp/fresh-home" },
  );
  assert.deepEqual(
    coldLaunchEnvironment("C:\\fresh-home", {
      APPDATA: "C:\\unrelated\\roaming",
      FITFREED_WINDOWS_CERTIFICATE_SHA1: "protected",
      HOME: "C:\\unrelated",
      LOCALAPPDATA: "C:\\unrelated\\local",
      PATH: "C:\\Windows\\System32",
      USERPROFILE: "C:\\unrelated",
    }, "win32"),
    {
      APPDATA: "C:\\unrelated\\roaming",
      LOCALAPPDATA: "C:\\unrelated\\local",
      PATH: "C:\\Windows\\System32",
      USERPROFILE: "C:\\unrelated",
    },
  );
});

test("activates the exact macOS process without accessibility or bundle-name lookup", async () => {
  const calls = [];
  const pauses = [];
  const outcomes = ["false\n", "true\n"];

  await activateMacosApplication(4_321, {
    async execute(file, arguments_, options) {
      calls.push({ file, arguments_, options });
      return { stdout: outcomes.shift() };
    },
    async pause(milliseconds) {
      pauses.push(milliseconds);
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].file, "/usr/bin/osascript");
  assert.deepEqual(calls[0].arguments_.slice(0, 3), ["-l", "JavaScript", "-e"]);
  assert.match(calls[0].arguments_[3], /runningApplicationWithProcessIdentifier\(4321\)/);
  assert.match(calls[0].arguments_[3], /NSApplicationActivateIgnoringOtherApps/);
  assert.deepEqual(calls[0].options, {
    encoding: "utf8",
    killSignal: "SIGKILL",
    maxBuffer: 4_096,
    timeout: 250,
  });
  assert.deepEqual(pauses, [25]);
});

test("bounds macOS activation and rejects an unavailable process", async () => {
  let attempts = 0;
  let pauses = 0;
  await assert.rejects(
    activateMacosApplication(4_321, {
      async execute() {
        attempts += 1;
        return { stdout: "false\n" };
      },
      async pause() {
        pauses += 1;
      },
    }),
    /could not be activated/,
  );
  assert.equal(attempts, 20);
  assert.equal(pauses, 19);
  await assert.rejects(
    activateMacosApplication(0),
    /requires a process identifier/,
  );
});

test("activates the spawned macOS process before accepting its painted shell", async () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "fitfreed-cold-launch-test-"));
  const activated = [];
  const child = new EventEmitter();
  child.pid = 7_654;
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };
  try {
    const measurement = await measureFreshProcess(
      "/synthetic/FitFreed.app/Contents/MacOS/fitfreed",
      path.join(temporaryDirectory, "home"),
      { applicationVersion: "0.1.0", sourceRevision: revision },
      {
        async activateApplication(processIdentifier) {
          activated.push(processIdentifier);
        },
        inheritedEnvironment: {},
        platform: "darwin",
        spawnApplication() {
          queueMicrotask(() => {
            child.emit("spawn");
            child.stdout.write(`${JSON.stringify({
              format: "org.fitfreed.startup-signal",
              schemaVersion: 2,
              event: "interactive-shell",
              applicationVersion: "0.1.0",
              sourceRevision: revision,
              sourceTreeClean: true,
              hostStartupMilliseconds: { setupComplete: 0, signal: 0 },
              rendererStartupMilliseconds: { localeReady: 0, signal: 0 },
            })}\n`);
          });
          return child;
        },
      },
    );

    assert.deepEqual(activated, [7_654]);
    assert.ok(measurement.totalMilliseconds >= 0);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("resets only the installed Windows application-data identity before measurement", () => {
  const calls = [];
  resetInstalledWindowsApplicationData({
    architecture: "x64",
    environment: {
      APPDATA: "C:\\Users\\runner\\AppData\\Roaming",
      FITFREED_WINDOWS_CERTIFICATE_SHA1: "protected",
      LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
      PATH: "C:\\Windows\\System32",
      USERPROFILE: "C:\\Users\\runner",
    },
    execute(file, arguments_, options) {
      calls.push({ file, arguments_, options });
    },
    platform: "win32",
    root: "C:\\fitfreed",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "powershell.exe");
  assert.deepEqual(
    calls[0].arguments_.slice(-2),
    ["-Action", "reset-data"],
  );
  assert.equal(calls[0].options.cwd, "C:\\fitfreed");
  assert.equal(calls[0].options.env.FITFREED_WINDOWS_CERTIFICATE_SHA1, undefined);
  assert.equal(calls[0].options.env.APPDATA, "C:\\Users\\runner\\AppData\\Roaming");
});

test("does not create a process when fresh application-data preparation fails", async () => {
  await assert.rejects(
    measureFreshProcess(
      "C:\\missing\\fitfreed.exe",
      "C:\\unused-fake-home",
      { applicationVersion: "0.1.0", sourceRevision: revision },
      {
        inheritedEnvironment: {},
        platform: "win32",
        prepareApplicationData() {
          throw new Error("synthetic reset failure");
        },
      },
    ),
    /synthetic reset failure/,
  );
});

test("rejects absent, partial, or unsupported cold-launch installations", () => {
  const options = {
    architecture: "x64",
    inspectBinary() {},
    platform: "linux",
  };
  assert.throws(
    () => resolveColdLaunchApplication({
      ...options,
      execute() {
        return "deinstall ok config-files";
      },
    }),
    /not installed/,
  );
  assert.throws(
    () => resolveColdLaunchApplication({ ...options, architecture: "arm64" }),
    /Linux performance admission requires x64/,
  );
  assert.throws(
    () => resolveColdLaunchApplication({
      ...options,
      environment: {},
      platform: "win32",
    }),
    /LOCALAPPDATA/,
  );
  assert.throws(
    () => resolveColdLaunchApplication({ ...options, platform: "freebsd" }),
    /does not support freebsd/,
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
  const linuxWorkflow = readFileSync(
    new URL("../.github/workflows/linux-performance.yml", import.meta.url),
    "utf8",
  );
  const windowsWorkflow = readFileSync(
    new URL("../.github/workflows/windows-performance.yml", import.meta.url),
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
  assert.match(
    linuxWorkflow,
    /name: Verify installed Linux cold-launch budget\n\s+run: xvfb-run -a npm run benchmark:cold-launch/,
  );
  assert.ok(
    linuxWorkflow.indexOf("name: Verify installed Linux cold-launch budget")
      < linuxWorkflow.indexOf("name: Verify full-scale import budgets"),
    "Linux cold launch must fail before the long data campaigns",
  );
  assert.match(
    windowsWorkflow,
    /name: Verify installed Windows cold-launch budget\n\s+run: npm run verify:windows-cold-launch/,
  );
  assert.ok(
    windowsWorkflow.indexOf("name: Verify installed Windows cold-launch budget")
      < windowsWorkflow.indexOf("name: Verify full-scale import budgets"),
    "Windows cold launch must fail before the long data campaigns",
  );
});
