import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { nodePackageScriptPath } from "./node-package-script.mjs";
import { updaterSignerEnvironment } from "./prepare-public-release.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export function signBytesWithTauri({
  bytes,
  environment = process.env,
  execute = execFileSync,
  filename,
  keyPath,
  password,
  repositoryPath = repositoryRoot,
  temporaryRoot = tmpdir(),
}) {
  const directory = mkdtempSync(path.join(temporaryRoot, "fitfreed-tauri-signing-"));
  const payloadPath = path.join(directory, filename);
  const signaturePath = `${payloadPath}.sig`;
  try {
    writeFileSync(payloadPath, bytes, { mode: 0o600 });
    execute(process.execPath, [
      nodePackageScriptPath("@tauri-apps/cli", "tauri"),
      "signer",
      "sign",
      payloadPath,
    ], {
      cwd: repositoryPath,
      encoding: "utf8",
      env: updaterSignerEnvironment({
        ...environment,
        TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password,
      }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (!existsSync(signaturePath)) throw new Error("detached signature is unavailable");
    return readFileSync(signaturePath, "utf8").trim();
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
