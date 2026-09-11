import assert from "node:assert/strict";
import test from "node:test";

import {
  assertUpdaterSigningAuthority,
  publicCandidateBuildArguments,
} from "./build-public-candidate.mjs";

test("always applies updater-artifact configuration to a public candidate build", () => {
  assert.deepEqual(publicCandidateBuildArguments(["--bundles", "app"]), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--bundles",
    "app",
  ]);
});

test("requires Tauri to receive the exact protected updater-key path", () => {
  assert.throws(() => assertUpdaterSigningAuthority({}), /signing authority is unavailable/);
  assert.throws(
    () => assertUpdaterSigningAuthority({
      TAURI_SIGNING_PRIVATE_KEY: "synthetic-private-input",
    }),
    /protected updater-key path/,
  );
  assert.throws(
    () => assertUpdaterSigningAuthority({
      TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/key/path",
    }),
    /protected updater-key path/,
  );
  assert.throws(
    () => assertUpdaterSigningAuthority({
      TAURI_SIGNING_PRIVATE_KEY: "/synthetic/other/path",
      TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/key/path",
    }),
    /protected updater-key path/,
  );
  assert.doesNotThrow(() =>
    assertUpdaterSigningAuthority({
      TAURI_SIGNING_PRIVATE_KEY: "/synthetic/key/path",
      TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/key/path",
    }),
  );
});
