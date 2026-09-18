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
  coldLaunchFailureMessage,
  coldLaunchTimeoutMessage,
  coldLaunchTransportClosedMessage,
  createWindowsApplicationActivator,
  createWindowsStartupSignalChannel,
  deriveColdLaunchRun,
  evaluateColdLaunchRuns,
  measureColdLaunchCampaign,
  measureFreshProcess,
  resetInstalledWindowsApplicationData,
  resolveColdLaunchApplication,
  terminateDesktopApplication,
  validateInteractiveShellSignal,
  windowsStartupSignalPipeName,
} from "./run-cold-launch-benchmark.mjs";

const revision = "a".repeat(40);
const syntheticBuildHome = `/${["Users", "synthetic-builder"].join("/")}`;

test("describes platform-specific startup timeouts without inventing a Linux channel", () => {
  assert.equal(
    coldLaunchTimeoutMessage("linux"),
    "application did not report an interactive shell within 10 seconds",
  );
  assert.equal(
    coldLaunchTimeoutMessage("win32", false),
    "application did not connect its startup channel within 10 seconds",
  );
  assert.equal(
    coldLaunchTimeoutMessage("win32", true),
    "application connected its startup channel but did not report an interactive shell within 10 seconds",
  );
  assert.equal(
    coldLaunchTimeoutMessage("linux", false, 30_000),
    "application did not report an interactive shell within 30 seconds",
  );
  assert.equal(
    coldLaunchTransportClosedMessage("linux"),
    "application closed its standard output before reporting an interactive shell",
  );
  assert.equal(
    coldLaunchTransportClosedMessage("win32"),
    "application closed its startup channel before reporting an interactive shell",
  );
});

test("bounds fresh-home diagnostics and redacts local execution roots", () => {
  const message = coldLaunchFailureMessage("synthetic launch failure", {
    home: "/private/admission/home",
    platform: "linux",
    repository: "/private/repository",
    standardError: `WebKit failed below /private/admission/home in /private/repository\n${"x".repeat(5_000)}`,
    standardOutput: "partial startup output",
  });

  assert.match(message, /synthetic launch failure/);
  assert.match(message, /bounded fresh-home diagnostics/);
  assert.match(message, /standardErrorBytes/);
  assert.match(message, /standardOutputTail/);
  assert.doesNotMatch(message, /\/private\/admission\/home|\/private\/repository/);
  assert.ok(Buffer.byteLength(message) < 5_000);
});

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

test("separates fresh cold-launch samples from preceding desktop teardown", async () => {
  const measuredHomes = [];
  const pauses = [];

  const runs = await measureColdLaunchCampaign({
    applicationBinary: "/synthetic/FitFreed",
    expected: {
      applicationVersion: "0.1.0",
      sourceRevision: revision,
    },
    measure: async (_applicationBinary, home) => {
      measuredHomes.push(home);
      return { totalMilliseconds: measuredHomes.length };
    },
    pause: async (milliseconds) => pauses.push(milliseconds),
    sampleCount: 3,
    settlingMilliseconds: 500,
    temporaryDirectory: "/synthetic/cold-launch",
  });

  assert.deepEqual(measuredHomes, [
    "/synthetic/cold-launch/home-0",
    "/synthetic/cold-launch/home-1",
    "/synthetic/cold-launch/home-2",
  ]);
  assert.deepEqual(pauses, [500, 500]);
  assert.deepEqual(runs, [
    { totalMilliseconds: 1 },
    { totalMilliseconds: 2 },
    { totalMilliseconds: 3 },
  ]);
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

test("reuses one bounded Windows shell for exact process activation", async () => {
  const calls = [];
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };
  let input = "";
  child.stdin.on("data", (chunk) => {
    input += chunk.toString("utf8");
    const lines = input.split("\n");
    input = lines.pop() ?? "";
    for (const line of lines) {
      if (line) child.stdout.write(`${line}\ttrue\n`);
    }
  });
  child.stdin.once("end", () => {
    child.exitCode = 0;
    queueMicrotask(() => child.emit("exit", 0, null));
  });

  const activatorPromise = createWindowsApplicationActivator({
    spawnHelper(file, arguments_, options) {
      calls.push({ file, arguments_, options });
      queueMicrotask(() => child.stdout.write("ready\n"));
      return child;
    },
  });
  const activator = await activatorPromise;
  await activator.activate(4_321);
  await activator.activate(7_654);
  await activator.close();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "powershell.exe");
  assert.deepEqual(calls[0].arguments_.slice(0, 5), [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
  ]);
  assert.match(calls[0].arguments_.at(-1), /AppActivate\(\$targetProcessId\)/);
  assert.match(calls[0].arguments_.at(-1), /ReadLine/);
  assert.match(calls[0].arguments_.at(-1), /Process\]::GetProcessById\(\$targetProcessId\)/);
  assert.match(calls[0].arguments_.at(-1), /\.Refresh\(\)/);
  assert.match(calls[0].arguments_.at(-1), /\.MainWindowHandle/);
  assert.match(calls[0].arguments_.at(-1), /ShowWindowAsync\(\$handle, 9\)/);
  assert.match(calls[0].arguments_.at(-1), /IsWindowVisible\(\$handle\)/);
  assert.match(calls[0].arguments_.at(-1), /\$attempt -lt 400/);
  assert.doesNotMatch(calls[0].arguments_.at(-1), /FitFreed|Get-Process/);
  assert.deepEqual(calls[0].options, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
});

test("rejects unavailable and mismatched Windows process activations", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };
  child.stdin.on("data", (chunk) => {
    const processIdentifier = chunk.toString("utf8").trim();
    child.stdout.write(`${processIdentifier === "4321" ? "9999" : processIdentifier}\tfalse\n`);
  });
  child.stdin.once("end", () => {
    child.exitCode = 0;
    queueMicrotask(() => child.emit("exit", 0, null));
  });
  const activatorPromise = createWindowsApplicationActivator({
    spawnHelper() {
      queueMicrotask(() => child.stdout.write("ready\n"));
      return child;
    },
  });
  const activator = await activatorPromise;
  await assert.rejects(activator.activate(4_321), /unexpected process identifier/);
  await assert.rejects(activator.activate(0), /requires a process identifier/);
  await activator.close();
});

test("terminates a Windows activation helper that fails its startup handshake", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };

  await assert.rejects(
    createWindowsApplicationActivator({
      spawnHelper() {
        queueMicrotask(() => child.stdout.write("unexpected\n"));
        return child;
      },
    }),
    /invalid startup response/,
  );
  assert.equal(child.signalCode, "SIGKILL");
});

test("bounds pre-measurement Windows activator startup independently", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };

  await assert.rejects(
    createWindowsApplicationActivator({
      spawnHelper() {
        return child;
      },
      startupTimeoutMilliseconds: 1,
    }),
    /startup exceeded its bound/,
  );
  assert.equal(child.signalCode, "SIGKILL");
});

test("terminates the exact Windows application process tree after every sample", async () => {
  const calls = [];
  const signals = [];
  const child = new EventEmitter();
  child.pid = 8_765;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    signals.push(signal);
  };

  await terminateDesktopApplication(child, "win32", {
    async execute(file, arguments_, options) {
      calls.push({ file, arguments_, options });
      child.exitCode = 1;
      queueMicrotask(() => child.emit("exit", 1, null));
    },
  });

  assert.deepEqual(signals, []);
  assert.deepEqual(calls, [{
    file: "taskkill.exe",
    arguments_: ["/PID", "8765", "/T", "/F"],
    options: {
      encoding: "utf8",
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1_024,
      timeout: 3_000,
      windowsHide: true,
    },
  }]);
});

test("fails closed when the exact Windows application tree cannot be terminated", async () => {
  const signals = [];
  const child = new EventEmitter();
  child.pid = 8_766;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    signals.push(signal);
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };

  await assert.rejects(
    terminateDesktopApplication(child, "win32", {
      async execute() {
        throw new Error("synthetic taskkill failure");
      },
    }),
    /process tree could not be terminated/,
  );
  assert.deepEqual(signals, ["SIGKILL"]);
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

test("uses an explicitly selected launch observation bound", async () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "fitfreed-cold-launch-test-"));
  const scheduledDelays = [];
  const child = new EventEmitter();
  child.pid = 7_655;
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
      "/synthetic/fitfreed",
      path.join(temporaryDirectory, "home"),
      { applicationVersion: "0.1.0", sourceRevision: revision },
      {
        cancelTimeout() {},
        inheritedEnvironment: {},
        observationTimeoutMilliseconds: 30_000,
        platform: "linux",
        scheduleTimeout(_callback, delay) {
          scheduledDelays.push(delay);
          return Symbol("synthetic-timeout");
        },
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

    assert.deepEqual(scheduledDelays, [30_000]);
    assert.ok(measurement.totalMilliseconds >= 0);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("creates an unguessable one-shot Windows startup signal channel", async () => {
  const events = [];
  const server = new EventEmitter();
  server.listen = (pipeName, callback) => {
    events.push(["listen", pipeName]);
    server.listening = true;
    queueMicrotask(callback);
  };
  server.close = (callback) => {
    events.push(["close"]);
    server.listening = false;
    queueMicrotask(callback);
  };

  const channel = await createWindowsStartupSignalChannel({
    createServer(connectionHandler) {
      server.connectionHandler = connectionHandler;
      return server;
    },
    randomBytes() {
      return Buffer.from("ab".repeat(32), "hex");
    },
  });

  assert.equal(
    channel.pipeName,
    "\\\\.\\pipe\\fitfreed-startup-abababababababababababababababababababababababababababababababab",
  );
  assert.equal(channel.isConnected(), false);
  assert.deepEqual(events, [["listen", channel.pipeName]]);
  const connection = new PassThrough();
  server.connectionHandler(connection);
  assert.equal(channel.isConnected(), true);
  await channel.close();
  assert.deepEqual(events, [["listen", channel.pipeName], ["close"]]);
});

test("accepts only a lowercase 256-bit Windows startup pipe identity", () => {
  assert.equal(
    windowsStartupSignalPipeName(() => Buffer.from("01".repeat(32), "hex")),
    "\\\\.\\pipe\\fitfreed-startup-0101010101010101010101010101010101010101010101010101010101010101",
  );
  assert.throws(
    () => windowsStartupSignalPipeName(() => Buffer.alloc(31)),
    /256-bit random identity/,
  );
});

test("uses the one-shot Windows channel instead of GUI-subsystem stdout", async () => {
  const signalOutput = new PassThrough();
  const child = new EventEmitter();
  child.pid = 8_765;
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };
  let channelClosed = false;
  let applicationDataPrepared = false;
  const activatorLifecycle = [];
  const terminated = [];

  const measurement = await measureFreshProcess(
    "C:\\FitFreed\\fitfreed.exe",
    "C:\\unused-home",
    { applicationVersion: "0.1.0", sourceRevision: revision },
    {
      architecture: "x64",
      async createApplicationActivator(platform) {
        activatorLifecycle.push(["create", platform]);
        return {
          async activate(processIdentifier) {
            activatorLifecycle.push(["activate", processIdentifier]);
          },
          async close() {
            activatorLifecycle.push(["close"]);
          },
        };
      },
      async createWindowsSignalChannel() {
        return {
          pipeName: "\\\\.\\pipe\\fitfreed-startup-" + "cd".repeat(32),
          output: signalOutput,
          isConnected() {
            return true;
          },
          async close() {
            channelClosed = true;
          },
        };
      },
      inheritedEnvironment: {
        FITFREED_WINDOWS_STARTUP_SIGNAL_PIPE: "\\\\.\\pipe\\fitfreed-startup-inherited",
        LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
        PATH: "C:\\Windows\\System32",
      },
      platform: "win32",
      prepareApplicationData() {
        applicationDataPrepared = true;
      },
      spawnApplication(_binary, _arguments, options) {
        assert.equal(applicationDataPrepared, true);
        assert.deepEqual(activatorLifecycle, [["create", "win32"]]);
        assert.deepEqual(options.stdio, ["ignore", "ignore", "pipe"]);
        assert.equal(
          options.env.FITFREED_WINDOWS_STARTUP_SIGNAL_PIPE,
          "\\\\.\\pipe\\fitfreed-startup-" + "cd".repeat(32),
        );
        queueMicrotask(() => {
          child.emit("spawn");
          signalOutput.write(`${JSON.stringify({
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
      async terminateApplication(process) {
        terminated.push([process.pid, "win32"]);
        process.kill("SIGTERM");
      },
    },
  );

  assert.ok(measurement.totalMilliseconds >= 0);
  assert.deepEqual(activatorLifecycle, [
    ["create", "win32"],
    ["activate", 8_765],
    ["close"],
  ]);
  assert.deepEqual(terminated, [[8_765, "win32"]]);
  assert.equal(channelClosed, true);
});

test("accepts a Windows painted-shell signal only after exact process activation", async () => {
  const signalOutput = new PassThrough();
  const child = new EventEmitter();
  child.pid = 8_766;
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };
  let completeActivation;
  const activation = new Promise((resolve) => {
    completeActivation = resolve;
  });
  let signalWritten;
  const written = new Promise((resolve) => {
    signalWritten = resolve;
  });
  let settled = false;

  const measurementPromise = measureFreshProcess(
    "C:\\FitFreed\\fitfreed.exe",
    "C:\\unused-home",
    { applicationVersion: "0.1.0", sourceRevision: revision },
    {
      architecture: "x64",
      activateApplication() {
        return activation;
      },
      async createWindowsSignalChannel() {
        return {
          pipeName: "\\\\.\\pipe\\fitfreed-startup-" + "34".repeat(32),
          output: signalOutput,
          isConnected() {
            return true;
          },
          async close() {},
        };
      },
      inheritedEnvironment: {
        LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
        PATH: "C:\\Windows\\System32",
      },
      platform: "win32",
      prepareApplicationData() {},
      spawnApplication() {
        queueMicrotask(() => {
          child.emit("spawn");
          signalOutput.write(`${JSON.stringify({
            format: "org.fitfreed.startup-signal",
            schemaVersion: 2,
            event: "interactive-shell",
            applicationVersion: "0.1.0",
            sourceRevision: revision,
            sourceTreeClean: true,
            hostStartupMilliseconds: { setupComplete: 0, signal: 0 },
            rendererStartupMilliseconds: { localeReady: 0, signal: 0 },
          })}\n`);
          signalWritten();
        });
        return child;
      },
      async terminateApplication(process) {
        process.kill("SIGTERM");
      },
    },
  );
  void measurementPromise.then(() => {
    settled = true;
  });

  await written;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  completeActivation();
  assert.ok((await measurementPromise).totalMilliseconds >= 0);
});

test("maintains exact Windows process activation until the painted shell arrives", async () => {
  const signalOutput = new PassThrough();
  const child = new EventEmitter();
  child.pid = 8_767;
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };
  const activations = [];
  const cancelled = [];
  let scheduledReactivation;
  const timer = Symbol("reactivation");

  const measurementPromise = measureFreshProcess(
    "C:\\FitFreed\\fitfreed.exe",
    "C:\\unused-home",
    { applicationVersion: "0.1.0", sourceRevision: revision },
    {
      architecture: "x64",
      async activateApplication(processIdentifier, platform) {
        activations.push([processIdentifier, platform]);
      },
      cancelReactivation(received) {
        cancelled.push(received);
      },
      async createWindowsSignalChannel() {
        return {
          pipeName: "\\\\.\\pipe\\fitfreed-startup-" + "56".repeat(32),
          output: signalOutput,
          isConnected() {
            return true;
          },
          async close() {},
        };
      },
      inheritedEnvironment: {
        LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
        PATH: "C:\\Windows\\System32",
      },
      platform: "win32",
      prepareApplicationData() {},
      scheduleReactivation(callback, delay) {
        assert.equal(delay, 250);
        scheduledReactivation = callback;
        return timer;
      },
      spawnApplication() {
        queueMicrotask(() => child.emit("spawn"));
        return child;
      },
      async terminateApplication(process) {
        process.kill("SIGTERM");
      },
    },
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(activations, [[8_767, "win32"]]);
  assert.equal(typeof scheduledReactivation, "function");
  scheduledReactivation();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(activations, [
    [8_767, "win32"],
    [8_767, "win32"],
  ]);

  signalOutput.write(`${JSON.stringify({
    format: "org.fitfreed.startup-signal",
    schemaVersion: 2,
    event: "interactive-shell",
    applicationVersion: "0.1.0",
    sourceRevision: revision,
    sourceTreeClean: true,
    hostStartupMilliseconds: { setupComplete: 0, signal: 0 },
    rendererStartupMilliseconds: { localeReady: 0, signal: 0 },
  })}\n`);

  assert.ok((await measurementPromise).totalMilliseconds >= 0);
  assert.deepEqual(cancelled, [timer]);
});

test("rejects a Windows startup channel that closes before the painted-shell signal", async () => {
  const signalOutput = new PassThrough();
  const child = new EventEmitter();
  child.pid = 8_766;
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
  };

  await assert.rejects(
    measureFreshProcess(
      "C:\\FitFreed\\fitfreed.exe",
      "C:\\unused-home",
      { applicationVersion: "0.1.0", sourceRevision: revision },
      {
        architecture: "x64",
        async createApplicationActivator() {
          return {
            async activate() {},
            async close() {},
          };
        },
        async createWindowsSignalChannel() {
          return {
            pipeName: "\\\\.\\pipe\\fitfreed-startup-" + "ef".repeat(32),
            output: signalOutput,
            isConnected() {
              return true;
            },
            async close() {},
          };
        },
        inheritedEnvironment: {
          LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
          PATH: "C:\\Windows\\System32",
        },
        platform: "win32",
        prepareApplicationData() {},
        spawnApplication() {
          queueMicrotask(() => {
            child.emit("spawn");
            signalOutput.end();
          });
          return child;
        },
        async terminateApplication(process) {
          process.kill("SIGTERM");
        },
      },
    ),
    /closed its startup channel/,
  );
});

test("closes the Windows startup channel when process creation fails synchronously", async () => {
  let channelClosed = false;

  await assert.rejects(
    measureFreshProcess(
      "C:\\FitFreed\\fitfreed.exe",
      "C:\\unused-home",
      { applicationVersion: "0.1.0", sourceRevision: revision },
      {
        architecture: "x64",
        async createApplicationActivator() {
          return {
            async activate() {},
            async close() {},
          };
        },
        async createWindowsSignalChannel() {
          return {
            pipeName: "\\\\.\\pipe\\fitfreed-startup-" + "12".repeat(32),
            output: new PassThrough(),
            isConnected() {
              return false;
            },
            async close() {
              channelClosed = true;
            },
          };
        },
        inheritedEnvironment: {
          LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
          PATH: "C:\\Windows\\System32",
        },
        platform: "win32",
        prepareApplicationData() {},
        spawnApplication() {
          throw new Error("synthetic process creation failure");
        },
      },
    ),
    /application process could not be started/,
  );
  assert.equal(channelClosed, true);
});

test("closes the Windows startup channel when fresh activation setup fails", async () => {
  let channelClosed = false;

  await assert.rejects(
    measureFreshProcess(
      "C:\\FitFreed\\fitfreed.exe",
      "C:\\unused-home",
      { applicationVersion: "0.1.0", sourceRevision: revision },
      {
        architecture: "x64",
        async createApplicationActivator() {
          throw new Error("synthetic activation setup failure");
        },
        async createWindowsSignalChannel() {
          return {
            pipeName: "\\\\.\\pipe\\fitfreed-startup-" + "34".repeat(32),
            output: new PassThrough(),
            isConnected() {
              return false;
            },
            async close() {
              channelClosed = true;
            },
          };
        },
        inheritedEnvironment: {
          LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
          PATH: "C:\\Windows\\System32",
        },
        platform: "win32",
        prepareApplicationData() {},
      },
    ),
    /synthetic activation setup failure/,
  );
  assert.equal(channelClosed, true);
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
  assert.match(packageMetadata.scripts["verify:precommit"], /doctor.*format:check$/);
  assert.doesNotMatch(
    packageMetadata.scripts["verify:precommit"],
    /benchmark:|verify:e2e|verify:update-e2e|package|check:production-bundle|verify:update-recovery-preparation/,
  );
  assert.match(packageMetadata.scripts["verify:candidate"], /^npm run verify:precommit/);
  assert.match(packageMetadata.scripts["verify:candidate"], /verify:e2e.*verify:update-e2e.*package$/);
  assert.equal(
    packageMetadata.scripts["verify:full"],
    "npm run verify:candidate && npm run benchmark:cold-launch && npm run check:production-bundle && npm run verify:update-recovery-preparation",
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
    /name: Verify installed Windows cold-launch budget\n\s+if: inputs\.scope == 'complete'\n\s+run: npm run verify:windows-cold-launch/,
  );
  assert.ok(
    windowsWorkflow.indexOf("name: Verify installed Windows cold-launch budget")
      < windowsWorkflow.indexOf("name: Verify full-scale import budgets"),
    "Windows cold launch must fail before the long data campaigns",
  );
});
