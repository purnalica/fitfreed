import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const performanceBenchmarkTargetDirectory = path.join(
  repositoryRoot,
  "src-tauri/target/performance-benchmarks",
);

export function validatePerformanceBenchmarkHost(
  platform = process.platform,
  architecture = process.arch,
) {
  if (platform === "darwin") {
    if (!["arm64", "x64"].includes(architecture)) {
      throw new Error(
        `macOS performance admission requires arm64 or x64, received ${architecture}`,
      );
    }
    return true;
  }
  if (platform === "linux") {
    if (architecture !== "x64") {
      throw new Error(
        `Linux performance admission requires x64, received ${architecture}`,
      );
    }
    return true;
  }
  if (platform === "win32") {
    if (architecture !== "x64") {
      throw new Error(
        `Windows performance admission requires x64, received ${architecture}`,
      );
    }
    return true;
  }
  throw new Error(
    `the performance benchmark campaign does not support ${platform}`,
  );
}

export function performanceBenchmarkEnvironment(
  inheritedEnvironment = process.env,
) {
  return {
    ...inheritedEnvironment,
    CARGO_TARGET_DIR: performanceBenchmarkTargetDirectory,
  };
}

export function performanceBenchmarkExecutable(example, platform = process.platform) {
  return path.join(
    performanceBenchmarkTargetDirectory,
    "release/examples",
    platform === "win32" ? `${example}.exe` : example,
  );
}

export function performanceBenchmarkBuildPlan(
  example,
  inheritedEnvironment = process.env,
) {
  return {
    program: "cargo",
    arguments_: [
      "build",
      "--quiet",
      "--release",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--example",
      example,
    ],
    options: {
      cwd: repositoryRoot,
      env: performanceBenchmarkEnvironment(inheritedEnvironment),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  };
}
