import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const e2eTargetDirectory = path.join(repositoryRoot, "src-tauri/target/e2e");
export const e2eApplicationBinary = path.join(e2eTargetDirectory, "release/fitfreed");
export const updateE2eTargetDirectory = path.join(
  repositoryRoot,
  ".artifacts/update-e2e/target",
);
