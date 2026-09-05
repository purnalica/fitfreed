import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(repository, ...arguments_) {
  execFileSync("git", arguments_, { cwd: repository, stdio: "ignore" });
}

test("preserves LF text and binary bytes in a Windows-style checkout", () => {
  const repository = mkdtempSync(path.join(tmpdir(), "fitfreed-text-checkout-"));
  const textBytes = Buffer.from("first line\nsecond line\n", "utf8");
  const binaryBytes = Buffer.from([0x00, 0x0a, 0x0d, 0xff, 0x80, 0x41]);

  try {
    writeFileSync(
      path.join(repository, ".gitattributes"),
      readFileSync(path.join(repositoryRoot, ".gitattributes")),
    );
    writeFileSync(path.join(repository, "contract.rs"), textBytes);
    writeFileSync(path.join(repository, "asset.bin"), binaryBytes);

    git(repository, "init", "--quiet");
    git(repository, "config", "user.name", "FitFreed policy test");
    git(repository, "config", "user.email", "policy-test");
    git(repository, "config", "core.autocrlf", "false");
    git(repository, "add", ".gitattributes", "contract.rs", "asset.bin");
    git(repository, "commit", "--quiet", "-m", "fixture");

    rmSync(path.join(repository, "contract.rs"));
    rmSync(path.join(repository, "asset.bin"));
    git(repository, "config", "core.autocrlf", "true");
    git(repository, "checkout", "--", "contract.rs", "asset.bin");

    assert.deepEqual(readFileSync(path.join(repository, "contract.rs")), textBytes);
    assert.deepEqual(readFileSync(path.join(repository, "asset.bin")), binaryBytes);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
