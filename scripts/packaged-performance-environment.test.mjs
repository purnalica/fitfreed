import assert from "node:assert/strict";
import test from "node:test";

import {
  packagedWebviewRuntime,
  platformHostCommands,
} from "../test/e2e/support/performance-environment.js";

test("classifies packaged WebView evidence by the native execution platform", () => {
  assert.equal(packagedWebviewRuntime("darwin"), "packaged-macos-webview");
  assert.equal(packagedWebviewRuntime("linux"), "packaged-linux-webview");
  assert.equal(packagedWebviewRuntime("win32"), "packaged-windows-webview");
  assert.throws(() => packagedWebviewRuntime("freebsd"), /unsupported packaged WebView platform/);
  assert.throws(() => packagedWebviewRuntime("toString"), /unsupported packaged WebView platform/);
});

test("runs platform identity commands only where their meaning is defined", () => {
  assert.deepEqual(platformHostCommands("darwin"), {
    deviceModel: { arguments: ["-n", "hw.model"], program: "sysctl" },
    operatingSystemVersion: { arguments: ["-productVersion"], program: "sw_vers" },
  });
  assert.deepEqual(platformHostCommands("linux"), {
    deviceModel: null,
    operatingSystemVersion: null,
  });
  assert.deepEqual(platformHostCommands("win32"), {
    deviceModel: null,
    operatingSystemVersion: null,
  });
  assert.throws(() => platformHostCommands("aix"), /unsupported packaged WebView platform/);
});
