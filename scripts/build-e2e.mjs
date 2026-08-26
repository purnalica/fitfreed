import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  productionBuildEnvironment,
  productionBuildIdentity,
} from "./build-production.mjs";
import { e2eTargetDirectory, repositoryRoot } from "./e2e-paths.mjs";

function git(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function e2eBuildEnvironment(inheritedEnvironment, revision, status) {
  return {
    ...productionBuildEnvironment(
      inheritedEnvironment,
      productionBuildIdentity(revision, status),
    ),
    CARGO_TARGET_DIR: e2eTargetDirectory,
    VITE_FITFREED_E2E: "true",
  };
}

export function e2eBuildArguments(arguments_ = []) {
  return [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "app",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    ...arguments_,
  ];
}

export function buildE2ePackage({
  arguments_ = process.argv.slice(2),
  execute = execFileSync,
  inheritedEnvironment = process.env,
} = {}) {
  const revision = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  execute(
    path.join(repositoryRoot, "node_modules/.bin/tauri"),
    e2eBuildArguments(arguments_),
    {
      cwd: repositoryRoot,
      env: e2eBuildEnvironment(inheritedEnvironment, revision, status),
      stdio: "inherit",
    },
  );
  if (
    git(["rev-parse", "HEAD"]) !== revision
    || git(["status", "--porcelain=v1", "--untracked-files=all"]) !== status
  ) {
    throw new Error("source changed while the E2E package was being built");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildE2ePackage();
  } catch (error) {
    process.stderr.write(`E2E build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
