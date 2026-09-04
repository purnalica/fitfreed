import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyWindowsColdLaunch } from "./verify-windows-cold-launch.mjs";

test("installs, measures, and removes the exact production package", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-cold-launch-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, "FitFreed_0.1.0_x64-setup.exe");
  writeFileSync(packagePath, "synthetic setup");
  const events = [];

  assert.deepEqual(
    verifyWindowsColdLaunch({
      architecture: "x64",
      environment: {
        APPDATA: "C:\\Users\\runner\\AppData\\Roaming",
        LOCALAPPDATA: "C:\\Users\\runner\\AppData\\Local",
        PATH: "C:\\Windows\\System32",
        FITFREED_WINDOWS_CERTIFICATE_SHA1: "protected",
      },
      packagePath,
      platform: "win32",
      run(file, arguments_, options) {
        const actionIndex = arguments_.indexOf("-Action");
        events.push(actionIndex >= 0 ? arguments_[actionIndex + 1] : "benchmark");
        assert.equal(options.env.FITFREED_WINDOWS_CERTIFICATE_SHA1, undefined);
        return { error: undefined, signal: null, status: 0 };
      },
      version: "0.1.0",
    }),
    { package: "FitFreed_0.1.0_x64-setup.exe", result: "passed" },
  );
  assert.deepEqual(events, ["preflight", "install", "benchmark", "remove"]);
});

test("removes an owned installation after the benchmark fails", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-cold-launch-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, "FitFreed_0.1.0_x64-setup.exe");
  writeFileSync(packagePath, "synthetic setup");
  const events = [];

  assert.throws(
    () => verifyWindowsColdLaunch({
      architecture: "x64",
      environment: {},
      packagePath,
      platform: "win32",
      run(_file, arguments_) {
        const actionIndex = arguments_.indexOf("-Action");
        const event = actionIndex >= 0 ? arguments_[actionIndex + 1] : "benchmark";
        events.push(event);
        return { error: undefined, signal: null, status: event === "benchmark" ? 7 : 0 };
      },
      version: "0.1.0",
    }),
    /cold-launch benchmark failed/,
  );
  assert.deepEqual(events, ["preflight", "install", "benchmark", "remove"]);
});
