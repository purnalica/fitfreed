import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  performanceBenchmarkExecutable,
  validatePerformanceBenchmarkHost,
} from "./performance-benchmark-profile.mjs";

test("admits the maintained macOS, Linux, and Windows performance hosts", () => {
  assert.equal(validatePerformanceBenchmarkHost("darwin", "arm64"), true);
  assert.equal(validatePerformanceBenchmarkHost("darwin", "x64"), true);
  assert.equal(validatePerformanceBenchmarkHost("linux", "x64"), true);
  assert.equal(validatePerformanceBenchmarkHost("win32", "x64"), true);
});

test("rejects unsupported systems and unsupported platform architectures", () => {
  assert.throws(
    () => validatePerformanceBenchmarkHost("darwin", "ia32"),
    /macOS performance admission requires arm64 or x64/,
  );
  assert.throws(
    () => validatePerformanceBenchmarkHost("linux", "arm64"),
    /Linux performance admission requires x64/,
  );
  assert.throws(
    () => validatePerformanceBenchmarkHost("win32", "arm64"),
    /Windows performance admission requires x64/,
  );
  assert.throws(
    () => validatePerformanceBenchmarkHost("freebsd", "x64"),
    /performance benchmark campaign does not support freebsd/,
  );
});

test("resolves the native benchmark executable suffix", () => {
  assert.equal(
    path.basename(performanceBenchmarkExecutable("import_benchmark", "linux")),
    "import_benchmark",
  );
  assert.equal(
    path.basename(performanceBenchmarkExecutable("import_benchmark", "win32")),
    "import_benchmark.exe",
  );
});
