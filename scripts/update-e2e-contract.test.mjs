import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSyntheticUpdateBoundary,
  createUpdateEnvelope,
  createUpdatePayload,
  updateTarget,
} from "./update-e2e-contract.mjs";

test("classifies version-overridden packages only as updater-mechanics evidence", () => {
  assert.deepEqual(assertSyntheticUpdateBoundary({ applicationBaselineCount: 0 }), {
    evidence: "synthetic-updater-mechanics",
    declaredApplicationBaselines: 0,
  });
  assert.throws(
    () => assertSyntheticUpdateBoundary({ applicationBaselineCount: 1 }),
    /must derive packaged cases from every declared application baseline/,
  );
});

test("maps the supported macOS architectures to update-channel targets", () => {
  assert.equal(updateTarget("darwin", "arm64"), "darwin-aarch64");
  assert.equal(updateTarget("darwin", "x64"), "darwin-x86_64");
  assert.throws(() => updateTarget("linux", "arm64"), /macOS/);
  assert.throws(() => updateTarget("darwin", "ia32"), /architecture/);
});

test("constructs exact signed payload and untrusted Tauri mirror documents", () => {
  const payload = createUpdatePayload({
    target: "darwin-aarch64",
    packageUrl: "https://127.0.0.1:41234/package.tar.gz",
    packageSize: 42,
    packageSha256: "a".repeat(64),
    packageSignature: "cGFja2FnZS1zaWduYXR1cmU=",
    minimumReadableSchemaVersion: 1,
    schemaVersion: 9,
    issuedAt: "2026-08-17T10:00:00Z",
    expiresAt: "2026-08-24T10:00:00Z",
  });
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const envelope = createUpdateEnvelope({
    payload,
    payloadBytes,
    metadataSignature: "bWV0YWRhdGEtc2lnbmF0dXJl",
    keyId: "synthetic-e2e-key",
  });

  assert.deepEqual(payload.release.librarySchema, {
    minimumReadableVersion: 1,
    maximumReadableVersion: 9,
    targetVersion: 9,
  });
  assert.equal(payload.release.version, "0.2.0");
  assert.equal(payload.withdrawnVersions.length, 0);
  assert.deepEqual(envelope.platforms["darwin-aarch64"], {
    url: payload.release.platforms["darwin-aarch64"].url,
    signature: payload.release.platforms["darwin-aarch64"].tauriSignature,
  });
  assert.equal(
    Buffer.from(envelope.fitfreed.payloadBase64, "base64").toString("utf8"),
    payloadBytes.toString("utf8"),
  );
  assert.equal(envelope.fitfreed.signatureBase64, "bWV0YWRhdGEtc2lnbmF0dXJl");
});

test("constructs a distinct public stable v2 contract without changing private-alpha defaults", () => {
  const payload = createUpdatePayload({
    contractSchemaVersion: 2,
    channel: "stable",
    sequence: 23,
    releaseVersion: "1.2.3",
    publishedAt: "2026-08-17T11:00:00Z",
    minimumSupportedVersion: "1.0.0",
    releaseNotes: {
      "en-US": "Stable release notes.",
      "es-ES": "Notas de la versión estable.",
    },
    withdrawnVersions: [],
    target: "darwin-aarch64",
    packageUrl: "https://updates.example.test/1.2.3/FitFreed_1.2.3_aarch64.app.tar.gz",
    packageSize: 42,
    packageSha256: "a".repeat(64),
    packageSignature: "cGFja2FnZS1zaWduYXR1cmU=",
    minimumReadableSchemaVersion: 1,
    schemaVersion: 9,
    issuedAt: "2026-08-17T10:00:00Z",
    expiresAt: "2026-08-24T10:00:00Z",
  });
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const envelope = createUpdateEnvelope({
    payload,
    payloadBytes,
    metadataSignature: "bWV0YWRhdGEtc2lnbmF0dXJl",
    keyId: "stable.synthetic-1",
  });

  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.channel, "stable");
  assert.equal(payload.sequence, 23);
  assert.equal(payload.release.version, "1.2.3");
  assert.equal(payload.release.publishedAt, "2026-08-17T11:00:00Z");
  assert.equal(payload.release.releaseNotes["es-ES"], "Notas de la versión estable.");
  assert.equal(envelope.fitfreed.schemaVersion, 2);
});
