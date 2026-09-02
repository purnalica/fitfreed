import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const e2eTargetDirectory = path.join(repositoryRoot, "src-tauri/target/e2e");

export function e2eApplicationBinaryForPlatform(platform = process.platform) {
  if (!["darwin", "linux", "win32"].includes(platform)) {
    throw new Error(`unsupported E2E desktop platform: ${platform}`);
  }
  const executable = platform === "win32" ? "fitfreed.exe" : "fitfreed";
  return path.join(e2eTargetDirectory, "release", executable);
}

export const e2eApplicationBinary = e2eApplicationBinaryForPlatform();
export const updateE2eTargetDirectory = path.join(
  repositoryRoot,
  ".artifacts/update-e2e/target",
);
