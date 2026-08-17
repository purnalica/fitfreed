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

test("requires updater signing authority without inspecting or returning its value", () => {
  assert.throws(() => assertUpdaterSigningAuthority({}), /signing authority is unavailable/);
  assert.doesNotThrow(() =>
    assertUpdaterSigningAuthority({ TAURI_SIGNING_PRIVATE_KEY: "synthetic-private-input" }),
  );
  assert.doesNotThrow(() =>
    assertUpdaterSigningAuthority({ TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/key/path" }),
  );
});
