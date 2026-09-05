import { execFile, execFileSync, spawn } from "node:child_process";
import {
  accessSync,
  constants,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statfsSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { linuxPackageContract } from "./linux-package-contract.mjs";
import {
  repositoryRoot,
  validatePerformanceBenchmarkHost,
} from "./performance-benchmark-profile.mjs";
import { windowsInstalledPackageActionCommand } from "./windows-installed-package.mjs";
import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";
import { windowsPackageContract } from "./windows-package-contract.mjs";

const measuredFreshProcesses = 100;
const p95BudgetMilliseconds = 2_500;
const launchTimeoutMilliseconds = 10_000;
const terminationTimeoutMilliseconds = 3_000;
const maximumOutputBytes = 64 * 1_024;
const revisionPattern = /^[0-9a-f]{40,64}$/;
const executeFile = promisify(execFile);
const macosActivationAttempts = 20;
const macosActivationRetryMilliseconds = 25;
const macosActivationTimeoutMilliseconds = 250;

function percentile(values, requested) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((sorted.length - 1) * requested)];
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

const phaseFields = {
  processCreationAndEvidenceTransport: "processCreationAndEvidenceTransportMilliseconds",
  hostStartupToSetupComplete: "hostStartupToSetupCompleteMilliseconds",
  setupCompleteToRendererStartupAndCommandTransport:
    "setupCompleteToRendererStartupAndCommandTransportMilliseconds",
  rendererStartupToLocaleReady: "rendererStartupToLocaleReadyMilliseconds",
  localeReadyToInteractiveSignal: "localeReadyToInteractiveSignalMilliseconds",
};

function requireDuration(value, description) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${description} requires non-negative finite durations`);
  }
}

function summarize(values) {
  return {
    medianMilliseconds: rounded(percentile(values, 0.5)),
    p95Milliseconds: rounded(percentile(values, 0.95)),
    maximumMilliseconds: rounded(Math.max(...values)),
  };
}

export function deriveColdLaunchRun(totalMilliseconds, signal) {
  requireDuration(totalMilliseconds, "cold launch measurement");
  const host = signal.hostStartupMilliseconds;
  const renderer = signal.rendererStartupMilliseconds;
  const run = {
    totalMilliseconds,
    processCreationAndEvidenceTransportMilliseconds:
      totalMilliseconds - host.signal,
    hostStartupToSetupCompleteMilliseconds: host.setupComplete,
    setupCompleteToRendererStartupAndCommandTransportMilliseconds:
      host.signal - host.setupComplete - renderer.signal,
    rendererStartupToLocaleReadyMilliseconds: renderer.localeReady,
    localeReadyToInteractiveSignalMilliseconds:
      renderer.signal - renderer.localeReady,
  };
  for (const duration of Object.values(run)) {
    requireDuration(duration, "cold launch phase derivation");
  }
  return run;
}

export function evaluateColdLaunchRuns(runs) {
  if (runs.length !== measuredFreshProcesses) {
    throw new Error(`cold launch benchmark requires exactly ${measuredFreshProcesses} measured processes`);
  }
  if (runs.some((run) => !Number.isFinite(run.totalMilliseconds) || run.totalMilliseconds < 0)) {
    throw new Error("cold launch benchmark requires a non-negative finite duration for every process");
  }
  for (const run of runs) {
    for (const field of Object.values(phaseFields)) {
      requireDuration(run[field], "cold launch benchmark");
    }
  }
  const durations = runs.map((run) => run.totalMilliseconds);
  const p95 = percentile(durations, 0.95);
  const total = summarize(durations);
  const phases = Object.fromEntries(
    Object.entries(phaseFields).map(([name, field]) => [
      name,
      summarize(runs.map((run) => run[field])),
    ]),
  );
  return {
    measuredFreshProcesses,
    ...total,
    p95BudgetMilliseconds,
    phases,
    passed: p95 <= p95BudgetMilliseconds,
  };
}

export function validateInteractiveShellSignal(signal, expected) {
  if (
    signal?.format !== "org.fitfreed.startup-signal" ||
    signal?.schemaVersion !== 2 ||
    signal?.event !== "interactive-shell"
  ) {
    throw new Error("application did not emit the interactive-shell event");
  }
  if (signal.applicationVersion !== expected.applicationVersion) {
    throw new Error("interactive-shell signal has the wrong application version");
  }
  if (signal.sourceRevision !== expected.sourceRevision) {
    throw new Error("interactive-shell signal has the wrong source revision");
  }
  if (signal.sourceTreeClean !== true) {
    throw new Error("interactive-shell signal was not built from a clean source tree");
  }
  const exactKeys = [
    "applicationVersion",
    "event",
    "format",
    "hostStartupMilliseconds",
    "rendererStartupMilliseconds",
    "schemaVersion",
    "sourceRevision",
    "sourceTreeClean",
  ];
  if (Object.keys(signal).sort().join("\0") !== exactKeys.join("\0")) {
    throw new Error("interactive-shell signal contains unexpected fields");
  }
  const host = signal.hostStartupMilliseconds;
  if (
    !host ||
    Object.keys(host).sort().join("\0") !== "setupComplete\0signal" ||
    !Number.isFinite(host.setupComplete) ||
    !Number.isFinite(host.signal) ||
    host.setupComplete < 0 ||
    host.signal < host.setupComplete
  ) {
    throw new Error("interactive-shell signal has invalid host startup timings");
  }
  const renderer = signal.rendererStartupMilliseconds;
  if (
    !renderer ||
    Object.keys(renderer).sort().join("\0") !== "localeReady\0signal" ||
    !Number.isFinite(renderer.localeReady) ||
    !Number.isFinite(renderer.signal) ||
    renderer.localeReady < 0 ||
    renderer.signal < renderer.localeReady
  ) {
    throw new Error("interactive-shell signal has invalid renderer startup timings");
  }
  return true;
}

function run(program, arguments_, repositoryRoot) {
  return execFileSync(program, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commandValue(program, arguments_, repositoryRoot) {
  try {
    return run(program, arguments_, repositoryRoot);
  } catch {
    return null;
  }
}

function hostEvidence(repositoryRoot) {
  const storage = statfsSync(repositoryRoot);
  return {
    operatingSystem: os.platform(),
    operatingSystemVersion:
      commandValue("sw_vers", ["-productVersion"], repositoryRoot) ?? os.release(),
    architecture: os.arch(),
    deviceModel: commandValue("sysctl", ["-n", "hw.model"], repositoryRoot),
    processor: os.cpus()[0]?.model ?? null,
    totalMemoryBytes: os.totalmem(),
    freeStorageBytes: Number(storage.bavail) * Number(storage.bsize),
  };
}

function inspectExecutable(binary) {
  const metadata = lstatSync(binary);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error("cold launch requires a regular non-symbolic executable");
  }
  accessSync(binary, constants.X_OK);
}

export function resolveColdLaunchApplication({
  architecture = process.arch,
  environment = process.env,
  execute = run,
  inspectBinary = inspectExecutable,
  platform = process.platform,
  root = repositoryRoot,
} = {}) {
  validatePerformanceBenchmarkHost(platform, architecture);
  if (platform === "darwin") {
    const applicationBundle = path.join(
      root,
      "src-tauri/target/release/bundle/macos/FitFreed.app",
    );
    const applicationBinary = path.join(applicationBundle, "Contents/MacOS/fitfreed");
    const informationPlist = path.join(applicationBundle, "Contents/Info.plist");
    execute("scripts/check-production-bundle.sh", [], root);
    inspectBinary(applicationBinary);
    return {
      applicationBinary,
      applicationVersion: execute(
        "plutil",
        ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", informationPlist],
        root,
      ),
      boundary: "macos-application-bundle",
    };
  }

  if (platform === "win32") {
    if (typeof environment.LOCALAPPDATA !== "string" || environment.LOCALAPPDATA.length === 0) {
      throw new Error("LOCALAPPDATA is unavailable for the installed Windows package");
    }
    const installDirectory = path.win32.join(
      environment.LOCALAPPDATA,
      windowsPackageContract.bundleProductName,
    );
    const applicationBinary = path.win32.join(
      installDirectory,
      windowsPackageContract.executable,
    );
    const registryPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FitFreed";
    const query = `$registration = Get-ItemProperty -LiteralPath '${registryPath}'; `
      + "[ordered]@{ "
      + "displayName = [string]$registration.DisplayName; "
      + "displayVersion = [string]$registration.DisplayVersion; "
      + "installLocation = [string]$registration.InstallLocation; "
      + "mainBinaryName = [string]$registration.MainBinaryName "
      + "} | ConvertTo-Json -Compress";
    let registration;
    try {
      registration = JSON.parse(execute(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          query,
        ],
        root,
      ));
    } catch {
      throw new Error("the current-user FitFreed NSIS registration is unavailable");
    }
    const fields = Object.keys(registration ?? {}).sort();
    const expectedFields = [
      "displayName",
      "displayVersion",
      "installLocation",
      "mainBinaryName",
    ];
    const registeredDirectory = registration?.installLocation?.replace(/^"|"$/g, "");
    if (
      JSON.stringify(fields) !== JSON.stringify(expectedFields)
      || registration.displayName !== windowsPackageContract.bundleProductName
      || registration.mainBinaryName !== windowsPackageContract.executable
      || registeredDirectory?.toLowerCase() !== installDirectory.toLowerCase()
      || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(registration.displayVersion ?? "")
    ) {
      throw new Error("the current-user FitFreed NSIS registration has an invalid identity");
    }
    inspectBinary(applicationBinary);
    return {
      applicationBinary,
      applicationVersion: registration.displayVersion,
      boundary: "installed-current-user-nsis-package",
    };
  }

  const applicationBinary = `/${linuxPackageContract.executablePath}`;
  const status = execute(
    "/usr/bin/dpkg-query",
    ["-W", "-f=${Status}", linuxPackageContract.packageName],
    root,
  );
  if (status !== "install ok installed") {
    throw new Error("the FitFreed Debian package is not installed");
  }
  const applicationVersion = execute(
    "/usr/bin/dpkg-query",
    ["-W", "-f=${Version}", linuxPackageContract.packageName],
    root,
  );
  if (!applicationVersion) throw new Error("the installed Debian package has no version");
  inspectBinary(applicationBinary);
  return {
    applicationBinary,
    applicationVersion,
    boundary: "installed-debian-package",
  };
}

function awaitExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => child.kill("SIGKILL"), terminationTimeoutMilliseconds);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

export function coldLaunchEnvironment(
  home,
  inheritedEnvironment = process.env,
  platform = process.platform,
) {
  if (platform === "win32") {
    return windowsNativeToolEnvironment(inheritedEnvironment);
  }
  const environment = { ...inheritedEnvironment, HOME: home };
  if (platform === "linux") {
    environment.XDG_CACHE_HOME = path.posix.join(home, ".cache");
    environment.XDG_CONFIG_HOME = path.posix.join(home, ".config");
    environment.XDG_DATA_HOME = path.posix.join(home, ".local/share");
    environment.XDG_STATE_HOME = path.posix.join(home, ".local/state");
  }
  return environment;
}

export function resetInstalledWindowsApplicationData({
  architecture = process.arch,
  environment = process.env,
  execute = execFileSync,
  platform = process.platform,
  root = repositoryRoot,
} = {}) {
  const command = windowsInstalledPackageActionCommand({
    action: "reset-data",
    architecture,
    platform,
  });
  execute(command.file, command.arguments, {
    cwd: root,
    env: windowsNativeToolEnvironment(environment),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function activateMacosApplication(
  processIdentifier,
  { execute = executeFile, pause = wait } = {},
) {
  if (!Number.isSafeInteger(processIdentifier) || processIdentifier <= 0) {
    throw new Error("macOS application activation requires a process identifier");
  }
  const expression = `ObjC.import("AppKit"); const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(${processIdentifier}); app ? app.activateWithOptions($.NSApplicationActivateIgnoringOtherApps) : false;`;
  for (let attempt = 0; attempt < macosActivationAttempts; attempt += 1) {
    let activated = false;
    try {
      const result = await execute(
        "/usr/bin/osascript",
        ["-l", "JavaScript", "-e", expression],
        {
          encoding: "utf8",
          killSignal: "SIGKILL",
          maxBuffer: 4_096,
          timeout: macosActivationTimeoutMilliseconds,
        },
      );
      activated = result.stdout.trim() === "true";
    } catch {
      activated = false;
    }
    if (activated) return;
    if (attempt + 1 < macosActivationAttempts) {
      await pause(macosActivationRetryMilliseconds);
    }
  }
  throw new Error("the exact macOS application process could not be activated");
}

export async function measureFreshProcess(
  applicationBinary,
  home,
  expected,
  {
    architecture = process.arch,
    inheritedEnvironment = process.env,
    platform = process.platform,
    activateApplication = activateMacosApplication,
    prepareApplicationData = resetInstalledWindowsApplicationData,
    spawnApplication = spawn,
  } = {},
) {
  if (platform !== "win32") mkdirSync(home, { recursive: true });
  const environment = coldLaunchEnvironment(home, inheritedEnvironment, platform);
  if (platform === "win32") {
    prepareApplicationData({ architecture, environment, platform });
  }
  const startedAt = performance.now();
  const child = spawnApplication(applicationBinary, [], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let standardOutput = "";
  let standardErrorBytes = 0;
  let settled = false;

  const observation = new Promise((resolve, reject) => {
    const fail = (message) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    const timeout = setTimeout(
      () => fail("application did not report an interactive shell within 10 seconds"),
      launchTimeoutMilliseconds,
    );
    const succeed = (signal) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      try {
        validateInteractiveShellSignal(signal, expected);
        resolve(deriveColdLaunchRun(performance.now() - startedAt, signal));
      } catch (error) {
        reject(error);
      }
    };

    child.once("error", () => {
      clearTimeout(timeout);
      fail("application process could not be started");
    });
    child.once("spawn", () => {
      if (platform !== "darwin" || settled) return;
      void activateApplication(child.pid).catch(() => {
        fail("the exact macOS application process could not be activated");
      });
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      fail(`application exited before the interactive shell signal (${code ?? signal ?? "unknown"})`);
    });
    child.stderr.on("data", (chunk) => {
      standardErrorBytes += chunk.length;
      if (standardErrorBytes > maximumOutputBytes) {
        clearTimeout(timeout);
        fail("application diagnostics exceeded the benchmark bound");
      }
    });
    child.stdout.on("data", (chunk) => {
      standardOutput += chunk.toString("utf8");
      if (Buffer.byteLength(standardOutput) > maximumOutputBytes) {
        clearTimeout(timeout);
        fail("application output exceeded the benchmark bound");
        return;
      }
      const lines = standardOutput.split("\n");
      standardOutput = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let signal;
        try {
          signal = JSON.parse(line);
        } catch {
          continue;
        }
        if (signal?.format === "org.fitfreed.startup-signal") {
          succeed(signal);
          return;
        }
      }
    });
  });

  try {
    return await observation;
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await awaitExit(child);
  }
}

async function executeColdLaunchBenchmark() {
  const sourceRevision = run("git", ["rev-parse", "HEAD"], repositoryRoot);
  if (!revisionPattern.test(sourceRevision)) throw new Error("current Git revision is invalid");
  if (run("git", ["status", "--porcelain=v1", "--untracked-files=all"], repositoryRoot)) {
    throw new Error("cold launch benchmark requires a clean Git revision");
  }
  const { applicationBinary, applicationVersion, boundary } =
    resolveColdLaunchApplication();
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "fitfreed-cold-launch-"));
  try {
    const runs = [];
    for (let index = 0; index < measuredFreshProcesses; index += 1) {
      runs.push(await measureFreshProcess(
        applicationBinary,
        path.join(temporaryDirectory, `home-${index}`),
        { applicationVersion, sourceRevision },
      ));
    }
    const measurement = evaluateColdLaunchRuns(runs);
    const evidence = {
      schemaVersion: 2,
      runtime: "release-production-application",
      applicationVersion,
      sourceRevision,
      sourceTreeClean: true,
      host: hostEvidence(repositoryRoot),
      scenario: {
        measuredFreshProcesses,
        freshApplicationDataPerProcess: true,
        existingLibrary: false,
      },
      method: {
        applicationBoundary: boundary,
        boundary: "immediately before process creation through the first painted localized interactive shell",
        signal: "application-owned host command after requestAnimationFrame",
        phaseDiagnostics:
          "aggregate residual process/evidence transport, host setup, renderer startup/command transport, locale initialization, and painted-shell signaling",
        warmUpProcesses: 0,
        percentile: "sorted zero-based index ceil((n - 1) * 0.95)",
      },
      measurement,
      passed: measurement.passed,
    };
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
    if (!evidence.passed) throw new Error("cold launch performance budget failed");
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  executeColdLaunchBenchmark().catch((error) => {
    process.stderr.write(`Cold launch benchmark failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
