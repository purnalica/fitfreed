import assert from "node:assert/strict";
import test from "node:test";

import { validatePerformanceBenchmarkHost } from "./performance-benchmark-profile.mjs";

test("admits the maintained macOS and Linux performance hosts", () => {
  assert.equal(validatePerformanceBenchmarkHost("darwin", "arm64"), true);
  assert.equal(validatePerformanceBenchmarkHost("darwin", "x64"), true);
  assert.equal(validatePerformanceBenchmarkHost("linux", "x64"), true);
});

test("rejects unsupported systems and Linux architectures", () => {
  assert.throws(
    () => validatePerformanceBenchmarkHost("darwin", "ia32"),
    /macOS performance admission requires arm64 or x64/,
  );
  assert.throws(
    () => validatePerformanceBenchmarkHost("linux", "arm64"),
    /Linux performance admission requires x64/,
  );
  assert.throws(
    () => validatePerformanceBenchmarkHost("win32", "x64"),
    /performance benchmark campaign does not support win32/,
  );
});
