import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

import {
  x6ReviewApplicationBundle,
  x6ReviewLaunchEnvironment,
} from "./x6-human-review-profile.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function git(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

if (process.platform !== "darwin") {
  throw new Error("X6 human review requires macOS");
}
if (git(["status", "--porcelain=v1", "--untracked-files=all"]).length !== 0) {
  throw new Error("X6 human review requires a clean source tree");
}

execFileSync(process.execPath, ["scripts/check-x6-review-bundle.mjs"], {
  cwd: repositoryRoot,
  env: x6ReviewLaunchEnvironment(process.env),
  stdio: "inherit",
});

const binary = path.join(x6ReviewApplicationBundle, "Contents/MacOS/fitfreed");
const result = spawnSync(binary, [], {
  cwd: repositoryRoot,
  env: x6ReviewLaunchEnvironment(process.env),
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`X6 human-review application exited with status ${result.status}`);
}
