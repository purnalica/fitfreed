import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manifest = path.join(repositoryRoot, "src-tauri", "Cargo.toml");
const vendorManifest = path.join(
  repositoryRoot,
  "src-tauri",
  "vendor",
  "tauri-plugin-updater",
  "Cargo.toml",
);
const vendorTarget = path.join(repositoryRoot, "src-tauri", "target", "vendor-updater");

function command(arguments_, environment = {}, platform = process.platform) {
  return {
    arguments: arguments_,
    environment,
    program: platform === "win32" ? "cargo.exe" : "cargo",
  };
}

export function rustQualityPlan(action, platform = process.platform) {
  const workspace = ["--manifest-path", manifest, "--workspace", "--all-targets", "--all-features"];
  const vendorEnvironment = { CARGO_TARGET_DIR: vendorTarget };
  const plans = {
    build: [command(["build", ...workspace], {}, platform)],
    format: [
      command(["fmt", "--manifest-path", manifest, "--all", "--", "--check"], {}, platform),
      command([
        "fmt",
        "--manifest-path",
        vendorManifest,
        "--all",
        "--",
        "--check",
      ], {}, platform),
    ],
    lint: [
      command(["clippy", ...workspace, "--", "-D", "warnings"], {}, platform),
      command([
        "clippy",
        "--manifest-path",
        vendorManifest,
        "--lib",
        "--",
        "-D",
        "warnings",
      ], vendorEnvironment, platform),
    ],
    test: [command(["test", ...workspace], {}, platform)],
    "test-vendor": [command([
      "test",
      "--manifest-path",
      vendorManifest,
      "--lib",
    ], vendorEnvironment, platform)],
  };
  const plan = plans[action];
  if (!plan) throw new Error(`unsupported Rust quality action: ${action}`);
  return plan;
}

export function runRustQuality(action, {
  execute = spawnSync,
  inheritedEnvironment = process.env,
  platform = process.platform,
} = {}) {
  for (const step of rustQualityPlan(action, platform)) {
    const result = execute(step.program, step.arguments, {
      cwd: repositoryRoot,
      env: { ...inheritedEnvironment, ...step.environment },
      stdio: "inherit",
    });
    if (result.error || result.status !== 0) {
      throw new Error(
        `Rust quality command failed: ${step.program} ${step.arguments.join(" ")}`,
      );
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runRustQuality(process.argv[2]);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
