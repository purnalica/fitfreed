import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { nodePackageScriptPath } from "./node-package-script.mjs";

test("keeps project automation independent from platform-specific npm shims", () => {
  const scriptsDirectory = path.resolve(import.meta.dirname);
  const platformSpecificShimDirectory = ["node_modules", ".bin", ""].join("/");
  const offenders = readdirSync(scriptsDirectory)
    .filter((filename) => filename.endsWith(".mjs"))
    .filter((filename) => readFileSync(path.join(scriptsDirectory, filename), "utf8")
      .includes(platformSpecificShimDirectory));

  assert.deepEqual(offenders, []);
});

test("resolves JavaScript package binaries without platform-specific npm shims", () => {
  assert.match(
    nodePackageScriptPath("@tauri-apps/cli", "tauri"),
    /node_modules[/\\]@tauri-apps[/\\]cli[/\\]tauri\.js$/,
  );
  assert.match(
    nodePackageScriptPath("@wdio/cli", "wdio"),
    /node_modules[/\\]@wdio[/\\]cli[/\\]bin[/\\]wdio\.js$/,
  );
});

test("rejects package binary declarations that escape their package", () => {
  const repositoryRoot = mkdtempSync(path.join(tmpdir(), "fitfreed-node-package-script-"));
  const packageRoot = path.join(repositoryRoot, "node_modules/example");
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    path.join(packageRoot, "package.json"),
    `${JSON.stringify({ bin: { example: "../outside.js" } })}\n`,
  );
  writeFileSync(path.join(repositoryRoot, "node_modules/outside.js"), "process.exit(0);\n");

  try {
    assert.throws(
      () => nodePackageScriptPath("example", "example", repositoryRoot),
      /must remain inside its package/,
    );
  } finally {
    rmSync(repositoryRoot, { force: true, recursive: true });
  }
});
