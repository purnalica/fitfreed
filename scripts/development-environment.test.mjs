import assert from "node:assert/strict";
import test from "node:test";

import {
  developmentCommandInvocation,
  parseEngineRange,
  validateDevelopmentEnvironmentFacts,
  versionInRange,
} from "./check-development-environment.mjs";

const baseFacts = {
  architecture: "x64",
  availableCommands: new Set(["cargo", "node", "npm", "rustc", "rustup"]),
  nodeRange: ">=22.14.0 <25",
  nodeVersion: "22.14.0",
  npmRange: ">=10.9.0 <11",
  npmVersion: "10.9.2",
  platform: "win32",
  rustComponents: new Set(["clippy", "rustfmt"]),
  rustHost: "x86_64-pc-windows-msvc",
  rustVersion: "1.97.1",
  supportedRustVersion: "1.97.1",
};

test("runs the Windows npm CLI through Node instead of treating a command file as executable", () => {
  assert.deepEqual(
    developmentCommandInvocation(
      "npm",
      ["--version"],
      "win32",
      "C:\\toolchain\\npm-cli.js",
      "C:\\toolchain\\node.exe",
    ),
    {
      arguments: ["C:\\toolchain\\npm-cli.js", "--version"],
      program: "C:\\toolchain\\node.exe",
    },
  );
  assert.equal(
    developmentCommandInvocation("cargo", ["--version"], "win32").program,
    "cargo.exe",
  );
});

test("parses and applies the supported engine range", () => {
  assert.deepEqual(parseEngineRange(">=22.14.0 <25"), {
    maximumMajor: 25,
    minimum: [22, 14, 0],
  });
  assert.equal(versionInRange("22.14.0", ">=22.14.0 <25"), true);
  assert.equal(versionInRange("24.9.1", ">=22.14.0 <25"), true);
  assert.equal(versionInRange("22.13.9", ">=22.14.0 <25"), false);
  assert.equal(versionInRange("25.0.0", ">=22.14.0 <25"), false);
  assert.equal(versionInRange("development", ">=22.14.0 <25"), false);
  assert.throws(() => parseEngineRange("^22"), /unsupported engine range/);
});

test("accepts the pinned x86-64 Windows MSVC development host", () => {
  assert.deepEqual(validateDevelopmentEnvironmentFacts(baseFacts), {
    architecture: "x64",
    nodeVersion: "22.14.0",
    npmVersion: "10.9.2",
    platform: "win32",
    rustHost: "x86_64-pc-windows-msvc",
    rustVersion: "1.97.1",
  });
});

test("reports every unsupported Windows toolchain fact", () => {
  const invalid = {
    ...baseFacts,
    architecture: "arm64",
    availableCommands: new Set(["cargo", "node", "npm", "rustc"]),
    nodeVersion: "25.0.0",
    npmVersion: "11.0.0",
    rustComponents: new Set(["rustfmt"]),
    rustHost: "aarch64-pc-windows-msvc",
    rustVersion: "1.96.0",
  };

  assert.throws(
    () => validateDevelopmentEnvironmentFacts(invalid),
    (error) => {
      assert.match(error.message, /Node.js >=22\.14\.0 <25 is required/);
      assert.match(error.message, /npm >=10\.9\.0 <11 is required/);
      assert.match(error.message, /Rust 1\.97\.1 is required/);
      assert.match(error.message, /Rust component clippy is required/);
      assert.match(error.message, /rustup is not installed/);
      assert.match(error.message, /x86-64 Windows MSVC host is required/);
      return true;
    },
  );
});

test("keeps native Linux and macOS prerequisites platform-scoped", () => {
  const linux = {
    ...baseFacts,
    architecture: "x64",
    availableCommands: new Set([
      ...baseFacts.availableCommands,
      "dpkg-deb",
      "pkg-config",
    ]),
    linuxModules: new Set(["gio-2.0", "glib-2.0", "gobject-2.0", "gtk+-3.0", "webkit2gtk-4.1"]),
    platform: "linux",
    rustHost: "x86_64-unknown-linux-gnu",
  };
  assert.equal(validateDevelopmentEnvironmentFacts(linux).platform, "linux");

  const macos = {
    ...baseFacts,
    architecture: "arm64",
    availableCommands: new Set([
      ...baseFacts.availableCommands,
      "ditto",
      "hdiutil",
      "openssl",
      "plutil",
      "shasum",
      "sqlite3",
      "strings",
      "xcode-select",
      "xcrun",
    ]),
    platform: "darwin",
    rustHost: "aarch64-apple-darwin",
    xcodeClangAvailable: true,
  };
  assert.equal(validateDevelopmentEnvironmentFacts(macos).platform, "darwin");
});
