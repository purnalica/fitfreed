import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runWindowsSignPathNsisBridge } from "./windows-signpath-nsis-bridge.mjs";

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-signpath-bridge-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const inner = path.join(root, "inner");
  mkdirSync(inner);
  const application = path.join(root, "fitfreed.exe");
  const uninstaller = path.join(root, "generated-uninstaller.exe");
  const setup = path.join(root, "FitFreed_0.1.0_x64-setup.exe");
  const plugin = path.join(root, "nsis-plugin.dll");
  writeFileSync(application, "application bytes");
  writeFileSync(uninstaller, "uninstaller bytes");
  writeFileSync(setup, "setup bytes");
  writeFileSync(plugin, "plugin bytes");
  return { application, inner, plugin, root, setup, uninstaller };
}

test("captures only the generated uninstaller while leaving packaging inputs unchanged", (context) => {
  const input = fixture(context);
  const environment = {
    FITFREED_SIGNPATH_BRIDGE_MODE: "capture-uninstaller",
    FITFREED_SIGNPATH_INNER_DIRECTORY: input.inner,
    FITFREED_SIGNPATH_VERSION: "0.1.0",
  };

  for (const targetPath of [input.application, input.plugin, input.setup]) {
    assert.deepEqual(runWindowsSignPathNsisBridge({ environment, targetPath }), {
      operation: "unchanged",
    });
  }
  assert.deepEqual(
    runWindowsSignPathNsisBridge({ environment, targetPath: input.uninstaller }),
    { operation: "captured-uninstaller" },
  );
  assert.equal(
    readFileSync(path.join(input.inner, "uninstall.exe"), "utf8"),
    "uninstaller bytes",
  );
  assert.equal(readFileSync(input.uninstaller, "utf8"), "uninstaller bytes");
});

test("injects the signed uninstaller and verifies the signed application", (context) => {
  const input = fixture(context);
  writeFileSync(path.join(input.inner, "fitfreed.exe"), "application bytes");
  writeFileSync(path.join(input.inner, "uninstall.exe"), "signed uninstaller bytes");
  const environment = {
    FITFREED_SIGNPATH_BRIDGE_MODE: "inject-signed-inner",
    FITFREED_SIGNPATH_INNER_DIRECTORY: input.inner,
    FITFREED_SIGNPATH_VERSION: "0.1.0",
  };

  assert.deepEqual(
    runWindowsSignPathNsisBridge({ environment, targetPath: input.application }),
    { operation: "verified-application" },
  );
  assert.deepEqual(
    runWindowsSignPathNsisBridge({ environment, targetPath: input.uninstaller }),
    { operation: "injected-uninstaller" },
  );
  assert.equal(readFileSync(input.uninstaller, "utf8"), "signed uninstaller bytes");
  assert.deepEqual(runWindowsSignPathNsisBridge({ environment, targetPath: input.setup }), {
    operation: "unchanged",
  });
});

test("fails closed for an unknown executable or mismatched application", (context) => {
  const input = fixture(context);
  const unknown = path.join(input.root, "provider-runtime.exe");
  writeFileSync(unknown, "unrelated bytes");
  const captureEnvironment = {
    FITFREED_SIGNPATH_BRIDGE_MODE: "capture-uninstaller",
    FITFREED_SIGNPATH_INNER_DIRECTORY: input.inner,
    FITFREED_SIGNPATH_VERSION: "0.1.0",
  };
  runWindowsSignPathNsisBridge({
    environment: captureEnvironment,
    targetPath: input.uninstaller,
  });
  assert.throws(
    () => runWindowsSignPathNsisBridge({ environment: captureEnvironment, targetPath: unknown }),
    /more than one uninstaller candidate/,
  );

  writeFileSync(path.join(input.inner, "fitfreed.exe"), "different application");
  writeFileSync(path.join(input.inner, "uninstall.exe"), "signed uninstaller");
  assert.throws(
    () => runWindowsSignPathNsisBridge({
      environment: {
        ...captureEnvironment,
        FITFREED_SIGNPATH_BRIDGE_MODE: "inject-signed-inner",
      },
      targetPath: input.application,
    }),
    /application bytes differ/,
  );
});

test("rejects invalid modes, versions, paths, and incomplete signed input", (context) => {
  const input = fixture(context);
  for (const [environment, targetPath, expected] of [
    [{}, input.application, /mode/],
    [{ FITFREED_SIGNPATH_BRIDGE_MODE: "capture-uninstaller" }, input.application, /version/],
    [{
      FITFREED_SIGNPATH_BRIDGE_MODE: "capture-uninstaller",
      FITFREED_SIGNPATH_INNER_DIRECTORY: "relative",
      FITFREED_SIGNPATH_VERSION: "0.1.0",
    }, input.application, /absolute/],
    [{
      FITFREED_SIGNPATH_BRIDGE_MODE: "inject-signed-inner",
      FITFREED_SIGNPATH_INNER_DIRECTORY: input.inner,
      FITFREED_SIGNPATH_VERSION: "0.1.0",
    }, input.uninstaller, /signed inner input is incomplete/],
  ]) {
    assert.throws(
      () => runWindowsSignPathNsisBridge({ environment, targetPath }),
      expected,
    );
  }
});
