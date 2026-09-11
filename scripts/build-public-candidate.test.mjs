import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertUpdaterSigningAuthority,
  publicCandidateBuildArguments,
} from "./build-public-candidate.mjs";

const publicUpdateConfiguration = JSON.parse(
  readFileSync(new URL("../release/public-update-channel.json", import.meta.url), "utf8"),
);
const selectedKey = publicUpdateConfiguration.keys[0];

test("binds updater artifacts to the explicitly selected canonical public key", () => {
  const arguments_ = publicCandidateBuildArguments(
    publicUpdateConfiguration,
    selectedKey.id,
    ["--bundles", "app"],
  );

  assert.deepEqual(arguments_.slice(0, 3), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--config",
  ]);
  assert.deepEqual(JSON.parse(arguments_[3]), {
    plugins: { updater: { pubkey: selectedKey.publicKey } },
  });
  assert.deepEqual(arguments_.slice(4), [
    "--bundles",
    "app",
  ]);
  assert.throws(
    () => publicCandidateBuildArguments(
      publicUpdateConfiguration,
      "stable.unknown",
    ),
    /outside the active public trust set/,
  );
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
