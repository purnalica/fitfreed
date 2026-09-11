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

import { activatePublicReleaseKey } from "./activate-public-release-key.mjs";

function publicKey(seed) {
  const keyBytes = Buffer.concat([
    Buffer.from("Ed"),
    Buffer.alloc(8, seed),
    Buffer.alloc(32, seed + 1),
  ]);
  return Buffer.from([
    "untrusted comment: synthetic public key",
    keyBytes.toString("base64"),
    "",
  ].join("\n")).toString("base64");
}

function inactiveConfiguration() {
  return {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 2,
    status: "inactive",
    purpose: "public-release-checksums",
    algorithm: "minisign-ed25519",
    keys: [],
  };
}

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-release-key-activation-"));
  const repositoryRoot = path.join(root, "repository");
  const authorityRoot = path.join(root, "authority");
  mkdirSync(path.join(repositoryRoot, "release"), { recursive: true });
  mkdirSync(authorityRoot);
  const configurationPath = path.join(
    repositoryRoot,
    "release",
    "public-release-signing.json",
  );
  const publicKeyPath = path.join(authorityRoot, "fitfreed-release-checksum.key.pub");
  writeFileSync(configurationPath, `${JSON.stringify(inactiveConfiguration(), null, 2)}\n`);
  writeFileSync(publicKeyPath, publicKey(3));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return {
    configurationPath,
    publicKeyPath,
    repositoryRoot,
    updateConfiguration: {
      keys: [{ id: "stable.primary-1", publicKey: publicKey(1) }],
    },
  };
}

test("activates one independent public release-checksum key", (t) => {
  const input = fixture(t);
  const result = activatePublicReleaseKey({ ...input, keyId: "release.primary-1" });

  assert.deepEqual(JSON.parse(readFileSync(input.configurationPath, "utf8")), {
    ...inactiveConfiguration(),
    status: "active",
    keys: [{ id: "release.primary-1", publicKey: publicKey(3) }],
  });
  assert.deepEqual(result, {
    changed: true,
    fingerprint: result.fingerprint,
    keyCount: 1,
    keyId: "release.primary-1",
    status: "active",
  });
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/u);
});

test("accepts an exact repeat without rewriting release trust", (t) => {
  const input = fixture(t);
  activatePublicReleaseKey({ ...input, keyId: "release.primary-1" });
  const before = readFileSync(input.configurationPath, "utf8");

  const result = activatePublicReleaseKey({ ...input, keyId: "release.primary-1" });

  assert.equal(result.changed, false);
  assert.equal(readFileSync(input.configurationPath, "utf8"), before);
});

test("rejects invalid or coupled authority without changing configuration", (t) => {
  const input = fixture(t);
  const before = readFileSync(input.configurationPath, "utf8");

  for (const [mutate, expected] of [
    [(value) => ({ ...value, keyId: "Release Primary" }), /identifier/u],
    [(value) => ({ ...value, publicKeyPath: "key.pub" }), /absolute/u],
    [(value) => ({
      ...value,
      updateConfiguration: {
        keys: [{ id: "stable.primary-1", publicKey: publicKey(3) }],
      },
    }), /independent/u],
  ]) {
    assert.throws(
      () => activatePublicReleaseKey(mutate({ ...input, keyId: "release.primary-1" })),
      expected,
    );
    assert.equal(readFileSync(input.configurationPath, "utf8"), before);
  }
});

test("refuses to replace an active release trust root", (t) => {
  const input = fixture(t);
  activatePublicReleaseKey({ ...input, keyId: "release.primary-1" });
  const before = readFileSync(input.configurationPath, "utf8");
  writeFileSync(input.publicKeyPath, publicKey(4));

  assert.throws(
    () => activatePublicReleaseKey({ ...input, keyId: "release.primary-2" }),
    /already active/u,
  );
  assert.equal(readFileSync(input.configurationPath, "utf8"), before);
});
