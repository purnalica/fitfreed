import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { activatePublicUpdateKey } from "./activate-public-update-key.mjs";

function publicKey(seed = 1) {
  const keyBytes = Buffer.concat([
    Buffer.from("Ed"),
    Buffer.alloc(8, seed),
    Buffer.alloc(32, seed + 1),
  ]);
  return Buffer.from([
    "untrusted comment: synthetic updater public key",
    keyBytes.toString("base64"),
    "",
  ].join("\n")).toString("base64");
}

function inactiveConfiguration() {
  return {
    format: "org.fitfreed.public-update-configuration",
    schemaVersion: 1,
    status: "inactive",
    contract: "stable-v2",
    metadataEndpoint: "https://fitfreed.org/updates/stable.json",
    keys: [],
  };
}

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-key-activation-"));
  const repositoryRoot = path.join(root, "repository");
  const authorityRoot = path.join(root, "authority");
  mkdirSync(path.join(repositoryRoot, "release"), { recursive: true });
  mkdirSync(authorityRoot);
  const configurationPath = path.join(repositoryRoot, "release", "public-update-channel.json");
  const publicKeyPath = path.join(authorityRoot, "fitfreed-stable.key.pub");
  writeFileSync(configurationPath, `${JSON.stringify(inactiveConfiguration(), null, 2)}\n`);
  writeFileSync(publicKeyPath, publicKey());
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { configurationPath, publicKeyPath, repositoryRoot };
}

test("activates one generated Tauri public updater key without wrapping it again", (t) => {
  const input = fixture(t);

  const result = activatePublicUpdateKey({
    ...input,
    keyId: "stable.primary-1",
  });

  const configuration = JSON.parse(readFileSync(input.configurationPath, "utf8"));
  assert.deepEqual(configuration, {
    ...inactiveConfiguration(),
    status: "active",
    keys: [{
      id: "stable.primary-1",
      publicKey: publicKey(),
    }],
  });
  assert.deepEqual(result, {
    changed: true,
    fingerprint: result.fingerprint,
    keyCount: 1,
    keyId: "stable.primary-1",
    status: "active",
  });
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
});

test("accepts an exact repeat without rewriting trusted configuration", (t) => {
  const input = fixture(t);
  activatePublicUpdateKey({ ...input, keyId: "stable.primary-1" });
  const before = readFileSync(input.configurationPath, "utf8");

  const result = activatePublicUpdateKey({ ...input, keyId: "stable.primary-1" });

  assert.equal(result.changed, false);
  assert.equal(readFileSync(input.configurationPath, "utf8"), before);
});

test("rejects invalid input without changing the inactive configuration", (t) => {
  const input = fixture(t);
  const before = readFileSync(input.configurationPath, "utf8");

  for (const [label, mutate, expected] of [
    ["invalid identifier", (value) => ({ ...value, keyId: "Stable Primary" }), /identifier/],
    ["relative public path", (value) => ({ ...value, publicKeyPath: "key.pub" }), /absolute/],
    ["repository public path", (value) => {
      const publicKeyPath = path.join(value.repositoryRoot, "key.pub");
      writeFileSync(publicKeyPath, publicKey());
      return { ...value, publicKeyPath };
    }, /outside the repository/],
    ["malformed public key", (value) => {
      writeFileSync(value.publicKeyPath, "not-a-public-key");
      return value;
    }, /public key/],
  ]) {
    assert.throws(
      () => activatePublicUpdateKey(mutate({ ...input, keyId: "stable.primary-1" })),
      expected,
      label,
    );
    assert.equal(readFileSync(input.configurationPath, "utf8"), before, label);
    writeFileSync(input.publicKeyPath, publicKey());
  }
});

test("refuses to replace an active trust root", (t) => {
  const input = fixture(t);
  activatePublicUpdateKey({ ...input, keyId: "stable.primary-1" });
  const before = readFileSync(input.configurationPath, "utf8");
  writeFileSync(input.publicKeyPath, publicKey(4));

  assert.throws(
    () => activatePublicUpdateKey({ ...input, keyId: "stable.primary-2" }),
    /already active/,
  );
  assert.equal(readFileSync(input.configurationPath, "utf8"), before);
});
