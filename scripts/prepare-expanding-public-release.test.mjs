import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertExpandingPublicReleaseOutput,
  assertExpansionSigningEnvironment,
  assertIndependentExpansionSigningTrust,
} from "./prepare-expanding-public-release.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";

const updateAuthority = createSyntheticMinisignAuthority();
const releaseAuthority = createSyntheticMinisignAuthority();

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-expansion-signing-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const repository = path.join(root, "repository");
  const secrets = path.join(root, "secrets");
  mkdirSync(repository);
  mkdirSync(secrets);
  const files = {
    apple: path.join(secrets, "notary.p8"),
    release: path.join(secrets, "release.key"),
    updater: path.join(secrets, "updater.key"),
  };
  for (const file of Object.values(files)) {
    writeFileSync(file, "synthetic private input");
    chmodSync(file, 0o600);
  }
  return {
    environment: {
      APPLE_API_ISSUER: "11111111-2222-3333-4444-555555555555",
      APPLE_API_KEY: "A1B2C3D4E5",
      APPLE_API_KEY_PATH: files.apple,
      APPLE_SIGNING_IDENTITY: "a".repeat(40),
      FITFREED_EXPECTED_APPLE_TEAM_ID: "A1B2C3D4E5",
      FITFREED_RELEASE_PRIVATE_KEY_PASSWORD: "release password",
      FITFREED_RELEASE_PRIVATE_KEY_PATH: files.release,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "updater password",
      TAURI_SIGNING_PRIVATE_KEY_PATH: files.updater,
    },
    files,
    repository,
  };
}

test("admits distinct path-based updater and release checksum authority", (context) => {
  const input = fixture(context);
  const result = assertExpansionSigningEnvironment(input.environment, input.repository);

  assert.equal(result.updaterKeyPath, input.files.updater);
  assert.equal(result.releaseKeyPath, input.files.release);
  assert.equal(result.expectedTeamIdentifier, "A1B2C3D4E5");
});

test("rejects missing, shared, repository-contained, or readable release authority", (context) => {
  for (const [mutate, expected] of [
    [(input) => { delete input.environment.FITFREED_RELEASE_PRIVATE_KEY_PASSWORD; }, /password/],
    [(input) => { chmodSync(input.files.release, 0o644); }, /permissions/],
    [(input) => {
      const file = path.join(input.repository, "release.key");
      writeFileSync(file, "private");
      chmodSync(file, 0o600);
      input.environment.FITFREED_RELEASE_PRIVATE_KEY_PATH = file;
    }, /outside the repository/],
    [(input) => {
      input.environment.FITFREED_RELEASE_PRIVATE_KEY_PATH = input.files.updater;
    }, /distinct/],
  ]) {
    const input = fixture(context);
    mutate(input);
    assert.throws(
      () => assertExpansionSigningEnvironment(input.environment, input.repository),
      expected,
    );
  }
});

test("confines an expanding candidate to its exact version directory", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-expansion-output-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const outputRoot = path.join(root, "public-releases");

  assert.equal(
    assertExpandingPublicReleaseOutput(
      path.join(outputRoot, "0.2.0"),
      outputRoot,
      "0.2.0",
    ),
    path.join(outputRoot, "0.2.0"),
  );
  for (const candidate of [
    outputRoot,
    path.join(outputRoot, "another-version"),
    path.join(outputRoot, "0.2.0", "nested"),
    path.join(root, "outside", "0.2.0"),
  ]) {
    assert.throws(
      () => assertExpandingPublicReleaseOutput(candidate, outputRoot, "0.2.0"),
      /exact version directory/,
    );
  }
});

test("requires independent updater and release checksum public keys", () => {
  const updateConfiguration = {
    keys: [{ id: "update-2026-1", publicKey: updateAuthority.publicKey }],
  };
  const releaseSigningConfiguration = {
    keys: [{ id: "release-2026-1", publicKey: releaseAuthority.publicKey }],
  };

  assert.deepEqual(assertIndependentExpansionSigningTrust({
    releaseKeyId: "release-2026-1",
    releaseSigningConfiguration,
    updateConfiguration,
    updateKeyId: "update-2026-1",
  }), {
    releaseKeyId: "release-2026-1",
    updateKeyId: "update-2026-1",
  });

  releaseSigningConfiguration.keys[0].publicKey = updateAuthority.publicKey;
  assert.throws(() => assertIndependentExpansionSigningTrust({
    releaseKeyId: "release-2026-1",
    releaseSigningConfiguration,
    updateConfiguration,
    updateKeyId: "update-2026-1",
  }), /independent public keys/);
});
