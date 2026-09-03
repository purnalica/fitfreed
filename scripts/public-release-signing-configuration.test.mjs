import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assertIndependentPublicSigningKeys,
  loadPublicReleaseSigningConfiguration,
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const publicKey = createSyntheticMinisignAuthority().publicKey;

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function activeConfiguration() {
  return {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 2,
    status: "active",
    purpose: "public-release-checksums",
    algorithm: "minisign-ed25519",
    keys: [{ id: "linux-release.synthetic-1", publicKey }],
  };
}

test("keeps the canonical public release-signing authority inactive", () => {
  assert.deepEqual(loadPublicReleaseSigningConfiguration(repositoryRoot), {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 2,
    status: "inactive",
    purpose: "public-release-checksums",
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

test("retains validation for legacy Linux-only release evidence", () => {
  const configuration = activeConfiguration();
  configuration.schemaVersion = 1;
  configuration.purpose = "linux-release-checksums";

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

test("compares signing-key identity independently of its public comment", () => {
  const releaseConfiguration = activeConfiguration();
  const [, encodedKey] = Buffer.from(publicKey, "base64")
    .toString("utf8")
    .trimEnd()
    .split("\n");
  const sameKeyWithAnotherComment = Buffer.from([
    "untrusted comment: another description",
    encodedKey,
    "",
  ].join("\n")).toString("base64");
  const changedKeyIdentifier = Buffer.from(encodedKey, "base64");
  changedKeyIdentifier[2] ^= 1;
  const sameMaterialWithAnotherIdentifier = Buffer.from([
    "untrusted comment: another description",
    changedKeyIdentifier.toString("base64"),
    "",
  ].join("\n")).toString("base64");

  for (const updatePublicKey of [
    sameKeyWithAnotherComment,
    sameMaterialWithAnotherIdentifier,
  ]) {
    assert.throws(() => assertIndependentPublicSigningKeys({
      releaseKeyId: releaseConfiguration.keys[0].id,
      releaseSigningConfiguration: releaseConfiguration,
      updateConfiguration: {
        keys: [{ id: "update.synthetic-1", publicKey: updatePublicKey }],
      },
      updateKeyId: "update.synthetic-1",
    }), /independent public keys/);
  }
});

test("documents and indexes the public release-signing contract", () => {
  const document = readFileSync(
    path.join(
      repositoryRoot,
      "docs/data-formats/release/public-release-signing-configuration-v1.md",
    ),
    "utf8",
  );
  const version2Document = readFileSync(
    path.join(
      repositoryRoot,
      "docs/data-formats/release/public-release-signing-configuration-v2.md",
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
  for (const value of [
    "org.fitfreed.release-signing-configuration",
    "public-release-checksums",
    "minisign-ed25519",
  ]) {
    assert.match(version2Document, new RegExp(escapeRegularExpression(value)));
  }
  assert.match(index, /public-release-signing-configuration-v2\.md/);
});
