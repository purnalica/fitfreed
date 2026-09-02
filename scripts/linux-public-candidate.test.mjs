import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { linuxPublicCandidateBuildArguments } from "./build-linux-public-candidate.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);

test("builds one Linux public candidate with mandatory updater artifacts", () => {
  assert.deepEqual(linuxPublicCandidateBuildArguments([], "linux"), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--bundles",
    "deb",
  ]);
  assert.deepEqual(linuxPublicCandidateBuildArguments(["--verbose"], "linux"), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--bundles",
    "deb",
    "--verbose",
  ]);
  assert.equal(
    packageJson.scripts["package:linux-public-candidate"],
    "npm run icons && node scripts/build-linux-public-candidate.mjs",
  );
});

test("rejects another host or unreviewed build arguments", () => {
  assert.throws(
    () => linuxPublicCandidateBuildArguments([], "darwin"),
    /requires Linux/,
  );
  assert.throws(
    () => linuxPublicCandidateBuildArguments(["--config", "another.json"], "linux"),
    /only accepts --verbose/,
  );
});
