import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const windowsProcessQuery = [
  "$target = [IO.Path]::GetFullPath($env:FITFREED_E2E_PROCESS_EXECUTABLE)",
  "$comparer = [StringComparer]::OrdinalIgnoreCase",
  "Get-CimInstance Win32_Process | Where-Object { $null -ne $_.ExecutablePath -and $comparer.Equals([IO.Path]::GetFullPath($_.ExecutablePath), $target) } | ForEach-Object { '{0} {1}' -f $_.ProcessId, $target }",
].join("; ");

export function parseExactApplicationProcessIds(processTable, applicationBinary) {
  return processTable
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
      if (!match || match[2] !== applicationBinary) return [];
      return [Number.parseInt(match[1], 10)];
    });
}

export function applicationProcessTable(applicationBinary, {
  execute = execFileSync,
  platform = process.platform,
} = {}) {
  if (platform === "darwin" || platform === "linux") {
    return execute("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  }
  if (platform === "win32") {
    return execute(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", windowsProcessQuery],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          FITFREED_E2E_PROCESS_EXECUTABLE: applicationBinary,
        },
      },
    );
  }
  throw new Error(`unsupported packaged E2E process platform: ${platform}`);
}

export function exactApplicationProcessId(applicationBinary, options = {}) {
  const processTable = applicationProcessTable(applicationBinary, options);
  const processIds = parseExactApplicationProcessIds(processTable, applicationBinary);
  if (processIds.length !== 1) {
    throw new Error(`expected one packaged application process; found ${processIds.length}`);
  }
  return processIds[0];
}

export function recordRestartProcessIdentity(identityPath, applicationBinary) {
  const processId = exactApplicationProcessId(applicationBinary);
  writeFileSync(identityPath, `${JSON.stringify({ processId })}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return processId;
}

export function readRestartProcessIdentity(identityPath) {
  const parsed = JSON.parse(readFileSync(identityPath, "utf8"));
  if (!Number.isSafeInteger(parsed.processId) || parsed.processId <= 0) {
    throw new Error("packaged restart process identity is invalid");
  }
  return parsed.processId;
}
