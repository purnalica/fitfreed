import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  validateX6ReviewBundleFacts,
  x6ReviewApplicationBundle,
  x6ReviewBuildPlan,
  x6ReviewIdentifier,
  x6ReviewLaunchEnvironment,
  x6ReviewTargetDirectory,
} from "./x6-human-review-profile.mjs";

const revision = "a".repeat(40);

test("builds a revision-isolated review application with production adapters", () => {
  const plan = x6ReviewBuildPlan({
    revision,
    status: "",
    inheritedEnvironment: {
      FITFREED_E2E_DATABASE_PATH: "/private/e2e.sqlite",
      FITFREED_PUBLIC_UPDATE_CONTRACT: "unexpected",
      FITFREED_PUBLIC_UPDATE_ENDPOINT: "https://unexpected.invalid/stable.json",
      FITFREED_PUBLIC_UPDATE_TRUST: "unexpected",
      TAURI_WEBDRIVER_PORT: "4444",
      VITE_FITFREED_E2E: "true",
      RETAINED: "value",
    },
  });

  assert.equal(
    x6ReviewIdentifier(revision),
    "org.fitfreed.desktop.x6-review.raaaaaaaaaaaa",
  );
  assert.deepEqual(plan.arguments_.slice(0, 4), [
    "build",
    "--bundles",
    "app",
    "--config",
  ]);
  assert.deepEqual(JSON.parse(plan.arguments_[4]), {
    productName: "FitFreed X6 Review",
    identifier: x6ReviewIdentifier(revision),
  });
  assert.doesNotMatch(plan.arguments_.join(" "), /--features|e2e/);
  assert.equal(plan.environment.CARGO_TARGET_DIR, x6ReviewTargetDirectory);
  assert.equal(plan.environment.FITFREED_SOURCE_REVISION, revision);
  assert.equal(plan.environment.FITFREED_SOURCE_TREE_CLEAN, "true");
  assert.equal(plan.environment.RETAINED, "value");
  assert.equal(plan.environment.VITE_FITFREED_E2E, undefined);
  assert.equal(plan.environment.FITFREED_E2E_DATABASE_PATH, undefined);
  assert.equal(plan.environment.TAURI_WEBDRIVER_PORT, undefined);
  assert.equal(plan.environment.FITFREED_PUBLIC_UPDATE_CONTRACT, undefined);
  assert.equal(plan.environment.FITFREED_PUBLIC_UPDATE_ENDPOINT, undefined);
  assert.equal(plan.environment.FITFREED_PUBLIC_UPDATE_TRUST, undefined);
});

test("rejects a human-review build from a dirty or invalid source", () => {
  assert.throws(
    () => x6ReviewBuildPlan({ revision, status: " M docs/README.md", inheritedEnvironment: {} }),
    /clean source tree/,
  );
  assert.throws(
    () => x6ReviewBuildPlan({ revision: "invalid", status: "", inheritedEnvironment: {} }),
    /invalid Git revision/,
  );
});

test("keeps the human-review bundle outside production and E2E targets", () => {
  assert.equal(
    x6ReviewApplicationBundle,
    path.join(
      x6ReviewTargetDirectory,
      "release/bundle/macos/FitFreed X6 Review.app",
    ),
  );
  assert.notEqual(
    x6ReviewApplicationBundle,
    path.resolve("src-tauri/target/release/bundle/macos/FitFreed.app"),
  );
  assert.notEqual(
    x6ReviewApplicationBundle,
    path.resolve("src-tauri/target/e2e/release/bundle/macos/FitFreed.app"),
  );
});

test("launches without test routing or a substituted user home", () => {
  const environment = x6ReviewLaunchEnvironment({
    HOME: "/Users/synthetic",
    FITFREED_E2E_DATABASE_PATH: "/private/e2e.sqlite",
    TAURI_WEBDRIVER_PORT: "4444",
    VITE_FITFREED_E2E: "true",
    RETAINED: "value",
  });

  assert.equal(environment.HOME, "/Users/synthetic");
  assert.equal(environment.RETAINED, "value");
  assert.equal(environment.VITE_FITFREED_E2E, undefined);
  assert.equal(environment.FITFREED_E2E_DATABASE_PATH, undefined);
  assert.equal(environment.TAURI_WEBDRIVER_PORT, undefined);
});

test("accepts only a native production-adapter review bundle for the exact source", () => {
  const facts = {
    bundleIdentifier: x6ReviewIdentifier(revision),
    bundleExecutable: "fitfreed",
    bundleMinimumMacos: "15.0",
    binaryMinimumMacos: "15.0",
    embeddedSourceRevision: true,
    testRoutingMarkers: [],
  };

  assert.equal(validateX6ReviewBundleFacts(facts, revision), true);
  assert.throws(
    () => validateX6ReviewBundleFacts({ ...facts, bundleIdentifier: "org.fitfreed.desktop.e2e" }, revision),
    /bundle identifier/,
  );
  assert.throws(
    () => validateX6ReviewBundleFacts({ ...facts, embeddedSourceRevision: false }, revision),
    /source revision/,
  );
  assert.throws(
    () => validateX6ReviewBundleFacts({ ...facts, testRoutingMarkers: ["__wdio_mocks__"] }, revision),
    /test-only routing/,
  );
});

test("wires the reviewed native package into local and hosted human-gate preparation", () => {
  const packageScripts = JSON.parse(
    readFileSync(path.resolve("package.json"), "utf8"),
  ).scripts;
  const workflow = readFileSync(
    path.resolve(".github/workflows/ci.yml"),
    "utf8",
  );

  assert.match(packageScripts["build:x6-review"], /build-x6-review\.mjs/);
  assert.match(packageScripts["check:x6-review-bundle"], /check-x6-review-bundle\.mjs/);
  assert.match(packageScripts["launch:x6-review"], /run-x6-human-review\.mjs/);
  assert.match(packageScripts["review:x6"], /build:x6-review/);
  assert.match(packageScripts["review:x6"], /check:x6-review-bundle/);
  assert.match(packageScripts["review:x6"], /launch:x6-review/);
  assert.match(workflow, /Build and verify the native X6 review package/);
  assert.match(workflow, /npm run build:x6-review/);
  assert.match(workflow, /npm run check:x6-review-bundle/);
});
