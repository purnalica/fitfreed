import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

export function parseExactApplicationProcessIds(processTable, applicationBinary) {
  return processTable
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
      if (!match || match[2] !== applicationBinary) return [];
      return [Number.parseInt(match[1], 10)];
    });
}

export function exactApplicationProcessId(applicationBinary) {
  const processTable = execFileSync("ps", ["-axo", "pid=,command="], {
    encoding: "utf8",
  });
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
