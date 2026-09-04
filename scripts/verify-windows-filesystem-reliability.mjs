import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const powershellScript = fileURLToPath(
  new URL("./verify-windows-filesystem-reliability.ps1", import.meta.url),
);

export function verifyWindowsFilesystemReliability({
  architecture = process.arch,
  environment = process.env,
  platform = process.platform,
  run = spawnSync,
} = {}) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows filesystem reliability admission requires x86-64 Windows");
  }
  const result = run(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      powershellScript,
    ],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: windowsNativeToolEnvironment(environment),
      stdio: "inherit",
    },
  );
  if (result.error || result.signal !== null || result.status !== 0) {
    throw new Error("Windows filesystem reliability admission failed");
  }
  return { result: "passed" };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(verifyWindowsFilesystemReliability())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
