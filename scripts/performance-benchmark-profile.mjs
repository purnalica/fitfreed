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

export function performanceBenchmarkEnvironment(inheritedEnvironment = process.env) {
  return {
    ...inheritedEnvironment,
    CARGO_TARGET_DIR: performanceBenchmarkTargetDirectory,
  };
}

export function performanceBenchmarkExecutable(example) {
  return path.join(
    performanceBenchmarkTargetDirectory,
    "release/examples",
    example,
  );
}

export function performanceBenchmarkBuildPlan(example, inheritedEnvironment = process.env) {
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
