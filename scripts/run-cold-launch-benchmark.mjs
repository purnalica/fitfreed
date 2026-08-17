import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statfsSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const measuredFreshProcesses = 20;
const p95BudgetMilliseconds = 2_500;
const launchTimeoutMilliseconds = 10_000;
const terminationTimeoutMilliseconds = 3_000;
const maximumOutputBytes = 64 * 1_024;
const revisionPattern = /^[0-9a-f]{40,64}$/;

function percentile(values, requested) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((sorted.length - 1) * requested)];
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

export function evaluateColdLaunchRuns(durations) {
  if (durations.length !== measuredFreshProcesses) {
    throw new Error(`cold launch benchmark requires exactly ${measuredFreshProcesses} measured processes`);
  }
  if (durations.some((duration) => !Number.isFinite(duration) || duration < 0)) {
    throw new Error("cold launch benchmark requires a non-negative finite duration for every process");
  }
  const p95 = percentile(durations, 0.95);
  return {
    measuredFreshProcesses,
    medianMilliseconds: rounded(percentile(durations, 0.5)),
    p95Milliseconds: rounded(p95),
    maximumMilliseconds: rounded(Math.max(...durations)),
    p95BudgetMilliseconds,
    passed: p95 <= p95BudgetMilliseconds,
  };
}

export function validateInteractiveShellSignal(signal, expected) {
  if (
    signal?.format !== "org.fitfreed.startup-signal" ||
    signal?.schemaVersion !== 1 ||
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
    "schemaVersion",
    "sourceRevision",
    "sourceTreeClean",
  ];
  if (Object.keys(signal).sort().join("\0") !== exactKeys.join("\0")) {
    throw new Error("interactive-shell signal contains unexpected fields");
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

async function measureFreshProcess(applicationBinary, home, expected) {
  mkdirSync(home, { recursive: true });
  const startedAt = performance.now();
  const child = spawn(applicationBinary, [], {
    env: { ...process.env, HOME: home },
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
        resolve(performance.now() - startedAt);
      } catch (error) {
        reject(error);
      }
    };

    child.once("error", () => {
      clearTimeout(timeout);
      fail("application process could not be started");
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
  if (process.platform !== "darwin") throw new Error("cold launch benchmark requires macOS");
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const sourceRevision = run("git", ["rev-parse", "HEAD"], repositoryRoot);
  if (!revisionPattern.test(sourceRevision)) throw new Error("current Git revision is invalid");
  if (run("git", ["status", "--porcelain=v1", "--untracked-files=all"], repositoryRoot)) {
    throw new Error("cold launch benchmark requires a clean Git revision");
  }
  const applicationBundle = path.join(
    repositoryRoot,
    "src-tauri/target/release/bundle/macos/FitFreed.app",
  );
  const applicationBinary = path.join(applicationBundle, "Contents/MacOS/fitfreed");
  const informationPlist = path.join(applicationBundle, "Contents/Info.plist");
  run("scripts/check-production-bundle.sh", [], repositoryRoot);
  const applicationVersion = run(
    "plutil",
    ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", informationPlist],
    repositoryRoot,
  );
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "fitfreed-cold-launch-"));
  try {
    const durations = [];
    for (let index = 0; index < measuredFreshProcesses; index += 1) {
      durations.push(await measureFreshProcess(
        applicationBinary,
        path.join(temporaryDirectory, `home-${index}`),
        { applicationVersion, sourceRevision },
      ));
    }
    const measurement = evaluateColdLaunchRuns(durations);
    const evidence = {
      schemaVersion: 1,
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
        boundary: "immediately before process creation through the first painted localized interactive shell",
        signal: "application-owned host command after requestAnimationFrame",
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
