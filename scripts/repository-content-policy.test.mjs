import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const checker = new URL("./check-repository-content.sh", import.meta.url);

function runRepositoryContentCheck(documentation) {
  const repository = mkdtempSync(join(tmpdir(), "fitfreed-content-policy-"));

  try {
    mkdirSync(join(repository, "scripts"));
    mkdirSync(join(repository, "docs"));
    cpSync(checker, join(repository, "scripts", "check-repository-content.sh"));
    writeFileSync(join(repository, "docs", "evidence.md"), documentation);
    spawnSync("git", ["init", "--quiet"], { cwd: repository, encoding: "utf8" });

    return spawnSync("bash", ["scripts/check-repository-content.sh"], {
      cwd: repository,
      encoding: "utf8",
    });
  } finally {
    rmSync(repository, { force: true, recursive: true });
  }
}

test("rejects an exact local workstation fingerprint in public documentation", () => {
  const result = runRepositoryContentCheck(
    "| Hardware | MacBook Air, Apple M9 Ultra, 24 CPU cores, 96 GiB memory |\n",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exact workstation details/);
});

test("accepts a privacy-minimized reference-profile classification", () => {
  const result = runRepositoryContentCheck(
    "The local host does not satisfy the provisional 8 GB Apple Silicon reference profile.\n",
  );

  assert.equal(result.status, 0, result.stderr);
});
