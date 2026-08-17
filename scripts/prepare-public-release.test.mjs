import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertPublicSigningEnvironment,
  publicArtifactNames,
  publicChannelTimes,
} from "./prepare-public-release.mjs";

function signingFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-signing-"));
  const repository = path.join(root, "repository");
  const secrets = path.join(root, "secrets");
  mkdirSync(repository);
  mkdirSync(secrets);
  const updaterKey = path.join(secrets, "updater.key");
  const appleKey = path.join(secrets, "notary.p8");
  writeFileSync(updaterKey, "synthetic updater private input");
  writeFileSync(appleKey, "synthetic notarization private input");
  chmodSync(updaterKey, 0o600);
  chmodSync(appleKey, 0o600);
  return {
    repository,
    environment: {
      APPLE_SIGNING_IDENTITY: "a".repeat(40),
      FITFREED_EXPECTED_APPLE_TEAM_ID: "A1B2C3D4E5",
      TAURI_SIGNING_PRIVATE_KEY_PATH: updaterKey,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "synthetic password",
      APPLE_API_ISSUER: "11111111-2222-3333-4444-555555555555",
      APPLE_API_KEY: "A1B2C3D4E5",
      APPLE_API_KEY_PATH: appleKey,
    },
  };
}

test("accepts path-based updater and App Store Connect release authority", () => {
  const fixture = signingFixture();
  assert.deepEqual(
    assertPublicSigningEnvironment(fixture.environment, fixture.repository),
    {
      signingIdentity: "a".repeat(40),
      expectedTeamIdentifier: "A1B2C3D4E5",
      updaterKeyPath: fixture.environment.TAURI_SIGNING_PRIVATE_KEY_PATH,
      notarizationMode: "app-store-connect-api",
      apiKeyPath: fixture.environment.APPLE_API_KEY_PATH,
    },
  );
});

test("rejects inline, repository-contained, broadly readable, or ambiguous private inputs", () => {
  for (const [mutate, expected] of [
    [(fixture) => { fixture.environment.TAURI_SIGNING_PRIVATE_KEY = "inline"; }, /inline updater/],
    [(fixture) => {
      const candidate = path.join(fixture.repository, "updater.key");
      writeFileSync(candidate, "synthetic");
      chmodSync(candidate, 0o600);
      fixture.environment.TAURI_SIGNING_PRIVATE_KEY_PATH = candidate;
    }, /outside the repository/],
    [(fixture) => { chmodSync(fixture.environment.APPLE_API_KEY_PATH, 0o644); }, /permissions/],
    [(fixture) => {
      fixture.environment.APPLE_ID = "synthetic-apple-id";
      fixture.environment.APPLE_PASSWORD = "synthetic";
      fixture.environment.APPLE_TEAM_ID = "A1B2C3D4E5";
    }, /exactly one/],
  ]) {
    const fixture = signingFixture();
    mutate(fixture);
    assert.throws(
      () => assertPublicSigningEnvironment(fixture.environment, fixture.repository),
      expected,
    );
  }
});

test("supports a complete Apple ID notarization mode without weakening team binding", () => {
  const fixture = signingFixture();
  delete fixture.environment.APPLE_API_ISSUER;
  delete fixture.environment.APPLE_API_KEY;
  delete fixture.environment.APPLE_API_KEY_PATH;
  Object.assign(fixture.environment, {
    APPLE_ID: "synthetic-apple-id",
    APPLE_PASSWORD: "synthetic application password",
    APPLE_TEAM_ID: "A1B2C3D4E5",
  });

  assert.equal(
    assertPublicSigningEnvironment(fixture.environment, fixture.repository).notarizationMode,
    "apple-id",
  );
  fixture.environment.APPLE_TEAM_ID = "Z9Y8X7W6V5";
  assert.throws(
    () => assertPublicSigningEnvironment(fixture.environment, fixture.repository),
    /does not match the expected team/,
  );
});

test("derives closed Apple Silicon artifact names and a seven-day channel window", () => {
  assert.deepEqual(publicArtifactNames("0.1.0"), {
    diskImage: "FitFreed_0.1.0_aarch64.dmg",
    updaterArchive: "FitFreed_0.1.0_aarch64.app.tar.gz",
    updaterSignature: "FitFreed_0.1.0_aarch64.app.tar.gz.sig",
  });
  const issuedAt = Date.parse("2026-08-17T20:00:00Z");
  assert.deepEqual(publicChannelTimes("2026-08-17T20:00:00Z", issuedAt), {
    issuedAt: "2026-08-17T20:00:00.000Z",
    publishedAt: "2026-08-17T20:00:00.000Z",
    expiresAt: "2026-08-24T20:00:00.000Z",
  });
  assert.throws(() => publicChannelTimes("not-a-time"), /issuance time is invalid/);
  assert.throws(
    () => publicChannelTimes("2026-08-17T20:00:00Z", issuedAt + 6 * 60 * 1_000),
    /outside the allowed execution window/,
  );
});
