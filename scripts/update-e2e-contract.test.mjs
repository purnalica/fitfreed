import assert from "node:assert/strict";
import test from "node:test";

import {
  createUpdateEnvelope,
  createUpdatePayload,
  updateTarget,
} from "./update-e2e-contract.mjs";

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
