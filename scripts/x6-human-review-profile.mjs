import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  productionBuildEnvironment,
  productionBuildIdentity,
} from "./build-production.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productName = "FitFreed X6 Review";
const reviewEnvironmentKeys = [
  "FITFREED_E2E_DATABASE_PATH",
  "TAURI_WEBDRIVER_PORT",
  "VITE_FITFREED_E2E",
];

export const x6ReviewTargetDirectory = path.resolve(
  repositoryRoot,
  "src-tauri/target/x6-review",
);
export const x6ReviewApplicationBundle = path.join(
  x6ReviewTargetDirectory,
  `release/bundle/macos/${productName}.app`,
);

function git(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function x6ReviewIdentifier(revision) {
  productionBuildIdentity(revision, "");
  return `org.fitfreed.desktop.x6-review.r${revision.slice(0, 12)}`;
}

export function x6ReviewBuildPlan({ revision, status, inheritedEnvironment }) {
  if (status.length !== 0) {
    throw new Error("X6 human review requires a clean source tree");
  }
  const identity = productionBuildIdentity(revision, status);
  const config = {
    productName,
    identifier: x6ReviewIdentifier(revision),
  };
  return {
    arguments_: ["build", "--bundles", "app", "--config", JSON.stringify(config)],
    environment: {
      ...productionBuildEnvironment(inheritedEnvironment, identity),
      CARGO_TARGET_DIR: x6ReviewTargetDirectory,
    },
  };
}

export function x6ReviewLaunchEnvironment(inheritedEnvironment) {
  const environment = { ...inheritedEnvironment };
  for (const key of reviewEnvironmentKeys) delete environment[key];
  return environment;
}

export function validateX6ReviewBundleFacts(facts, revision) {
  const expectedIdentifier = x6ReviewIdentifier(revision);
  if (facts.bundleIdentifier !== expectedIdentifier) {
    throw new Error(`unexpected X6 review bundle identifier: ${facts.bundleIdentifier}`);
  }
  if (facts.bundleExecutable !== "fitfreed") {
    throw new Error(`unexpected X6 review executable: ${facts.bundleExecutable}`);
  }
  if (facts.bundleMinimumMacos !== "15.0" || facts.binaryMinimumMacos !== "15.0") {
    throw new Error("X6 review bundle does not preserve the macOS 15.0 boundary");
  }
  if (!facts.embeddedSourceRevision) {
    throw new Error("X6 review bundle does not contain the exact source revision");
  }
  if (facts.machineLocalPathMarkers.length !== 0) {
    throw new Error(
      `X6 review bundle contains machine-local paths: ${facts.machineLocalPathMarkers.join(", ")}`,
    );
  }
  if (facts.testRoutingMarkers.length !== 0) {
    throw new Error(
      `X6 review bundle contains test-only routing: ${facts.testRoutingMarkers.join(", ")}`,
    );
  }
  return true;
}

export function buildX6ReviewPackage({
  execute = execFileSync,
  inheritedEnvironment = process.env,
} = {}) {
  const revision = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  const plan = x6ReviewBuildPlan({ revision, status, inheritedEnvironment });
  execute(
    path.join(repositoryRoot, "node_modules/.bin/tauri"),
    plan.arguments_,
    {
      cwd: repositoryRoot,
      env: plan.environment,
      stdio: "inherit",
    },
  );
  if (
    git(["rev-parse", "HEAD"]) !== revision
    || git(["status", "--porcelain=v1", "--untracked-files=all"]) !== status
  ) {
    throw new Error("source changed while the X6 human-review package was being built");
  }
}
