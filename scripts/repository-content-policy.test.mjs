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

function runRepositoryContentCheckWithDeletedTrackedFile() {
  const repository = mkdtempSync(join(tmpdir(), "fitfreed-content-policy-deletion-"));

  try {
    mkdirSync(join(repository, "scripts"));
    mkdirSync(join(repository, "docs"));
    cpSync(checker, join(repository, "scripts", "check-repository-content.sh"));
    writeFileSync(join(repository, "docs", "obsolete.md"), "Obsolete synthetic guidance.\n");
    spawnSync("git", ["init", "--quiet"], { cwd: repository, encoding: "utf8" });
    spawnSync("git", ["config", "user.name", "Synthetic Maintainer"], { cwd: repository });
    const publicTestEmail = ["1+synthetic", "users.noreply.github.com"].join("@");
    spawnSync("git", ["config", "user.email", publicTestEmail], {
      cwd: repository,
    });
    spawnSync("git", ["add", "scripts/check-repository-content.sh", "docs/obsolete.md"], {
      cwd: repository,
    });
    spawnSync("git", ["commit", "--quiet", "-m", "test: create synthetic baseline"], {
      cwd: repository,
    });
    rmSync(join(repository, "docs", "obsolete.md"));

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

test("accepts a privacy-minimized execution-environment classification", () => {
  const result = runRepositoryContentCheck(
    "The clean candidate campaign passed on local Apple Silicon.\n",
  );

  assert.equal(result.status, 0, result.stderr);
});

test("scans the prospective working tree without treating tracked deletions as files", () => {
  const result = runRepositoryContentCheckWithDeletedTrackedFile();

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /not a regular file/);
});
