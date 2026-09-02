import assert from "node:assert/strict";
import test from "node:test";

import {
  validateStableUpdateV3Envelope,
  validateStableUpdateV3Payload,
} from "./update-channel-v3.mjs";

const signature = Buffer.from("synthetic Minisign document").toString("base64");

function artifact(version, suffix) {
  return {
    url: `https://fitfreed.org/updates/${version}/FitFreed_${version}_${suffix}`,
    size: 4096,
    sha256: suffix.startsWith("amd64") ? "a".repeat(64) : "b".repeat(64),
    tauriSignature: signature,
  };
}

function payload() {
  return {
    format: "org.fitfreed.update-channel",
    schemaVersion: 3,
    channel: "stable",
    sequence: 3,
    issuedAt: "2026-09-02T08:00:00Z",
    expiresAt: "2026-09-09T08:00:00Z",
    release: {
      version: "0.2.0",
      publishedAt: "2026-09-02T07:00:00Z",
      minimumSupportedVersion: "0.1.0",
      librarySchema: {
        minimumReadableVersion: 1,
        maximumReadableVersion: 37,
        targetVersion: 38,
      },
      releaseNotes: {
        "en-US": "Synthetic stable release.",
        "es-ES": "Versión estable sintética.",
      },
      platforms: {
        "darwin-aarch64": artifact("0.2.0", "aarch64.app.tar.gz"),
        "linux-x86_64-deb": artifact("0.2.0", "amd64.deb"),
      },
      recoveryArtifacts: [
        {
          version: "0.1.0",
          target: "linux-x86_64-deb",
          packageKind: "deb",
          librarySchemaVersions: [36, 37],
          ...artifact("0.1.0", "amd64.deb"),
        },
      ],
    },
    withdrawnVersions: [],
  };
}

function expectedRecoveryArtifacts() {
  return [
    {
      version: "0.1.0",
      target: "linux-x86_64-deb",
      librarySchemaVersions: [36, 37],
    },
  ];
}

function envelopeFor(signedPayload) {
  return {
    version: signedPayload.release.version,
    platforms: Object.fromEntries(
      Object.entries(signedPayload.release.platforms).map(([target, value]) => [
        target,
        { url: value.url, signature: value.tauriSignature },
      ]),
    ),
    fitfreed: {
      format: "org.fitfreed.update-envelope",
      schemaVersion: 3,
      algorithm: "minisign-ed25519",
      keyId: "stable.synthetic-1",
      payloadBase64: Buffer.from(JSON.stringify(signedPayload)).toString("base64"),
      signatureBase64: signature,
    },
  };
}

test("accepts an exact stable channel with one authenticated Linux predecessor", () => {
  const signedPayload = payload();

  assert.equal(
    validateStableUpdateV3Payload(signedPayload, expectedRecoveryArtifacts()),
    signedPayload,
  );
  const envelope = envelopeFor(signedPayload);
  assert.equal(validateStableUpdateV3Envelope(envelope, signedPayload), envelope);
});

test("accepts an initial release with no declared predecessor", () => {
  const signedPayload = payload();
  signedPayload.release.version = "0.1.0";
  signedPayload.release.minimumSupportedVersion = "0.1.0";
  signedPayload.release.platforms = {
    "darwin-aarch64": artifact("0.1.0", "aarch64.app.tar.gz"),
    "linux-x86_64-deb": artifact("0.1.0", "amd64.deb"),
  };
  signedPayload.release.recoveryArtifacts = [];

  assert.equal(validateStableUpdateV3Payload(signedPayload, []), signedPayload);
});

test("rejects missing, extra, or mismatched recovery baseline evidence", () => {
  for (const [mutate, expected] of [
    [(value) => { value.release.recoveryArtifacts = []; }, /does not match the declared application baselines/],
    [(value) => { value.release.recoveryArtifacts[0].version = "0.0.9"; }, /does not match the declared application baselines/],
    [(value) => { value.release.recoveryArtifacts[0].target = "windows-x86_64-nsis"; }, /current release target/],
    [(value) => { value.release.recoveryArtifacts[0].packageKind = "nsis"; }, /package kind/],
    [(value) => { value.release.recoveryArtifacts[0].librarySchemaVersions = [37, 36]; }, /ordered/],
    [(value) => { value.release.recoveryArtifacts[0].librarySchemaVersions = [38]; }, /readable source range/],
    [(value) => { value.release.recoveryArtifacts[0].version = "0.2.0"; }, /older than the release/],
  ]) {
    const candidate = payload();
    mutate(candidate);
    assert.throws(
      () => validateStableUpdateV3Payload(candidate, expectedRecoveryArtifacts()),
      expected,
    );
  }
});

test("rejects mutable URLs, duplicate recovery entries, and mirror drift", () => {
  const mutable = payload();
  mutable.release.recoveryArtifacts[0].url += "?temporary=1";
  assert.throws(
    () => validateStableUpdateV3Payload(mutable, expectedRecoveryArtifacts()),
    /credential-free HTTPS without a query or fragment/,
  );

  const duplicate = payload();
  duplicate.release.recoveryArtifacts.push(structuredClone(duplicate.release.recoveryArtifacts[0]));
  assert.throws(
    () => validateStableUpdateV3Payload(duplicate, expectedRecoveryArtifacts()),
    /unique and ordered/,
  );

  const signedPayload = payload();
  const envelope = envelopeFor(signedPayload);
  envelope.platforms["linux-x86_64-deb"].url = "https://fitfreed.org/updates/other.deb";
  assert.throws(
    () => validateStableUpdateV3Envelope(envelope, signedPayload),
    /mirror/,
  );
});
