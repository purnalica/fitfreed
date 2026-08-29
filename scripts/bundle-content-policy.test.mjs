import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectBundleBuffers,
  validateBundleContentFindings,
} from "./bundle-content-policy.mjs";

const macosUserPath = `/${["Users", "synthetic-builder", "project", "src", "main.rs"].join("/")}`;
const linuxUserPath = `/${["home", "synthetic-builder", "project", "src", "main.rs"].join("/")}`;
const windowsUserPath = ["C:", "Users", "synthetic-builder", "project", "src", "main.rs"].join("\\");

test("accepts a bundle whose build paths are normalized and production-native", () => {
  const findings = inspectBundleBuffers([
    Buffer.from("/fitfreed/source/src/main.rs\0/fitfreed/cargo/registry/crate/src/lib.rs"),
    Buffer.from("ordinary production content"),
  ]);

  assert.deepEqual(findings, {
    machineLocalPathMarkers: [],
    testRoutingMarkers: [],
  });
  assert.equal(validateBundleContentFindings(findings), true);
});

test("reports machine-local path classes without exposing the matched path", () => {
  const findings = inspectBundleBuffers([
    Buffer.from(`panic at ${macosUserPath}`),
    Buffer.from(`source at ${linuxUserPath}`),
    Buffer.from("root-owned source at /root/project/src/main.rs"),
    Buffer.from("temporary source at /tmp/synthetic/generated.rs"),
    Buffer.from("temporary /private/var/folders/synthetic/T/generated.rs"),
    Buffer.from("temporary /var/folders/synthetic/T/generated.rs"),
    Buffer.from(`source at ${windowsUserPath}`),
  ]);

  assert.deepEqual(findings.machineLocalPathMarkers, [
    "Linux root-home path",
    "Linux user-home path",
    "POSIX temporary path",
    "Windows user-home path",
    "macOS temporary path",
    "macOS user-home path",
  ]);
  assert.throws(
    () => validateBundleContentFindings(findings),
    (error) => {
      assert.match(error.message, /machine-local paths/);
      assert.doesNotMatch(error.message, /synthetic-builder|project\/src/);
      return true;
    },
  );
});

test("retains the existing prohibition on test-only routing", () => {
  const findings = inspectBundleBuffers([
    Buffer.from("__wdio_mocks__ and TAURI_WEBDRIVER_PORT"),
  ]);

  assert.deepEqual(findings.testRoutingMarkers, [
    "TAURI_WEBDRIVER_PORT",
    "__wdio_mocks__",
  ]);
  assert.throws(
    () => validateBundleContentFindings(findings),
    /test-only routing/,
  );
});

test("applies the shared content policy to production and human-review bundles", () => {
  const productionInspection = readFileSync(
    new URL("./check-production-bundle.sh", import.meta.url),
    "utf8",
  );
  const humanReviewInspection = readFileSync(
    new URL("./check-x6-review-bundle.mjs", import.meta.url),
    "utf8",
  );

  assert.match(productionInspection, /bundle-content-policy\.mjs/);
  assert.match(humanReviewInspection, /inspectBundleFiles/);
});
