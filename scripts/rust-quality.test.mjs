import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  rustQualityPlan,
  runRustQuality,
} from "./run-rust-quality.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manifest = path.join(repositoryRoot, "src-tauri", "Cargo.toml");
const vendorManifest = path.join(
  repositoryRoot,
  "src-tauri",
  "vendor",
  "tauri-plugin-updater",
  "Cargo.toml",
);
const vendorTarget = path.join(repositoryRoot, "src-tauri", "target", "vendor-updater");

test("builds and tests the complete Windows desktop host with portable commands", () => {
  assert.deepEqual(rustQualityPlan("build", "win32"), [{
    arguments: [
      "build",
      "--manifest-path",
      manifest,
      "--workspace",
      "--all-targets",
      "--all-features",
    ],
    environment: {},
    program: "cargo.exe",
  }]);
  assert.deepEqual(rustQualityPlan("test", "win32")[0].arguments, [
    "test",
    "--manifest-path",
    manifest,
    "--workspace",
    "--all-targets",
    "--all-features",
  ]);
});

test("isolates vendored updater output without POSIX environment assignment", () => {
  const [workspace, vendor] = rustQualityPlan("lint", "win32");
  assert.equal(workspace.program, "cargo.exe");
  assert.deepEqual(workspace.environment, {});
  assert.equal(vendor.program, "cargo.exe");
  assert.equal(vendor.environment.CARGO_TARGET_DIR, vendorTarget);
  assert.deepEqual(vendor.arguments, [
    "clippy",
    "--manifest-path",
    vendorManifest,
    "--lib",
    "--",
    "-D",
    "warnings",
  ]);
  assert.equal(rustQualityPlan("test-vendor", "linux")[0].program, "cargo");
  assert.equal(
    rustQualityPlan("test-vendor", "linux")[0].environment.CARGO_TARGET_DIR,
    vendorTarget,
  );
});

test("executes the declared quality plan in order and fails closed", () => {
  const calls = [];
  runRustQuality("format", {
    execute: (program, arguments_, options) => {
      calls.push({ program, arguments_, options });
      return { status: 0 };
    },
    inheritedEnvironment: { RETAINED: "yes" },
    platform: "darwin",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].program, "cargo");
  assert.equal(calls[0].options.env.RETAINED, "yes");
  assert.equal(calls[1].arguments_.includes(vendorManifest), true);

  assert.throws(
    () => runRustQuality("build", {
      execute: () => ({ status: 9 }),
      platform: "win32",
    }),
    /Rust quality command failed/,
  );
  assert.throws(() => rustQualityPlan("unknown", "linux"), /unsupported Rust quality action/);
});
