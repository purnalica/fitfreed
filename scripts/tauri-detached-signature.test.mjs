import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { signBytesWithTauri } from "./tauri-detached-signature.mjs";

test("gives detached Tauri signing exactly one private-key input", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-tauri-signing-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  let signingDirectory;

  const signature = signBytesWithTauri({
    bytes: Buffer.from("exact candidate bytes"),
    environment: {
      PATH: "/synthetic/bin",
      TAURI_SIGNING_PRIVATE_KEY: "/protected/updater.key",
      TAURI_SIGNING_PRIVATE_KEY_PATH: "/protected/updater.key",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "parent password",
    },
    execute(command, arguments_, options) {
      const payloadPath = arguments_.at(-1);
      signingDirectory = path.dirname(payloadPath);
      assert.equal(command, process.execPath);
      assert.deepEqual(arguments_.slice(1, 3), ["signer", "sign"]);
      assert.equal(readFileSync(payloadPath, "utf8"), "exact candidate bytes");
      assert.equal(options.env.PATH, "/synthetic/bin");
      assert.equal(options.env.TAURI_SIGNING_PRIVATE_KEY, undefined);
      assert.equal(
        options.env.TAURI_SIGNING_PRIVATE_KEY_PATH,
        "/protected/release.key",
      );
      assert.equal(options.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD, "release password");
      writeFileSync(`${payloadPath}.sig`, "detached signature\n");
    },
    filename: "FitFreed_0.1.9_amd64.deb",
    keyPath: "/protected/release.key",
    password: "release password",
    repositoryPath: root,
    temporaryRoot: root,
  });

  assert.equal(signature, "detached signature");
  assert.equal(existsSync(signingDirectory), false);
});
