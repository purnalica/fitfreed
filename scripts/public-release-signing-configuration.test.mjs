import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const publicKey = Buffer.from(
  "untrusted comment: synthetic public key\nRWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n",
).toString("base64");

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function activeConfiguration() {
  return {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 1,
    status: "active",
    purpose: "linux-release-checksums",
    algorithm: "minisign-ed25519",
    keys: [{ id: "linux-release.synthetic-1", publicKey }],
  };
}

test("keeps the canonical public release-signing authority inactive", () => {
  assert.deepEqual(loadPublicReleaseSigningConfiguration(repositoryRoot), {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 1,
    status: "inactive",
    purpose: "linux-release-checksums",
    algorithm: "minisign-ed25519",
    keys: [],
  });
  assert.equal(
    packageJson.scripts["check:public-release-signing-config"],
    "node scripts/public-release-signing-configuration.mjs",
  );
  assert.match(packageJson.scripts["test:fast"], /check:public-release-signing-config/);
});

test("accepts an active rotatable public release trust set", () => {
  const configuration = activeConfiguration();
  configuration.keys.push({ id: "linux-release.synthetic-2", publicKey });

  assert.equal(validatePublicReleaseSigningConfiguration(configuration), configuration);
});

test("rejects partial, duplicate, or cross-purpose release trust", () => {
  const inactiveWithKey = activeConfiguration();
  inactiveWithKey.status = "inactive";
  const duplicate = activeConfiguration();
  duplicate.keys.push({ ...duplicate.keys[0] });
  const wrongPurpose = activeConfiguration();
  wrongPurpose.purpose = "updater-packages";

  assert.throws(
    () => validatePublicReleaseSigningConfiguration(inactiveWithKey),
    /configuration violation/,
  );
  assert.throws(
    () => validatePublicReleaseSigningConfiguration(duplicate),
    /duplicate public release-signing key identifier/,
  );
  assert.throws(
    () => validatePublicReleaseSigningConfiguration(wrongPurpose),
    /configuration violation/,
  );
});

test("documents and indexes the public release-signing contract", () => {
  const document = readFileSync(
    path.join(
      repositoryRoot,
      "docs/data-formats/release/public-release-signing-configuration-v1.md",
    ),
    "utf8",
  );
  const index = readFileSync(
    path.join(repositoryRoot, "docs/data-formats/README.md"),
    "utf8",
  );
  for (const value of [
    "org.fitfreed.release-signing-configuration",
    "linux-release-checksums",
    "minisign-ed25519",
    "keys.*.id",
    "keys.*.publicKey",
  ]) {
    assert.match(document, new RegExp(escapeRegularExpression(value)));
  }
  assert.match(index, /public-release-signing-configuration-v1\.md/);
});
