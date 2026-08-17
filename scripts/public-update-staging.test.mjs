import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { stageStableUpdateChannel } from "./public-update-staging.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-update-"));
  const packagePath = path.join(root, "FitFreed.app.tar.gz");
  const packageBytes = Buffer.from("synthetic signed updater package");
  writeFileSync(packagePath, packageBytes);
  writeFileSync(`${packagePath}.sig`, "U3ludGhldGljIHBhY2thZ2Ugc2lnbmF0dXJl\n");
  return {
    root,
    packagePath,
    packageBytes,
    outputDirectory: path.join(root, "pages"),
    configuration: {
      format: "org.fitfreed.public-update-configuration",
      schemaVersion: 1,
      status: "active",
      contract: "stable-v2",
      metadataEndpoint: "https://purnalica.github.io/fitfreed/updates/stable.json",
      keys: [
        {
          id: "stable.synthetic-1",
          publicKey: "U3ludGhldGljIHB1YmxpYyBrZXkgZm9yIGNvbnRyYWN0IHRlc3RzLg==",
        },
      ],
    },
  };
}

function stageArguments(fixtureValues) {
  return {
    ...fixtureValues,
    packageSignaturePath: `${fixtureValues.packagePath}.sig`,
    signingKeyId: "stable.synthetic-1",
    version: "0.2.0",
    sequence: 2,
    issuedAt: "2026-08-17T10:00:00Z",
    expiresAt: "2026-08-24T10:00:00Z",
    publishedAt: "2026-08-17T09:00:00Z",
    minimumSupportedVersion: "0.1.0",
    minimumReadableSchemaVersion: 1,
    maximumReadableSchemaVersion: 9,
    targetSchemaVersion: 9,
    releaseNotes: {
      "en-US": "Synthetic public update.",
      "es-ES": "Actualización pública sintética.",
    },
    withdrawnVersions: [],
    signPayload(payloadBytes) {
      const payload = JSON.parse(payloadBytes);
      assert.equal(payload.schemaVersion, 2);
      assert.equal(payload.channel, "stable");
      return "U3ludGhldGljIG1ldGFkYXRhIHNpZ25hdHVyZQ==";
    },
  };
}

function relativeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else files.push(path.relative(root, entryPath));
    }
  };
  visit(root);
  return files.sort();
}

test("stages one atomic Pages snapshot with exact stable metadata and package bytes", () => {
  const values = fixture();
  const result = stageStableUpdateChannel(stageArguments(values));

  assert.deepEqual(relativeFiles(values.outputDirectory), [
    "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
    "updates/stable.json",
  ]);
  const envelope = JSON.parse(
    readFileSync(path.join(values.outputDirectory, "updates/stable.json"), "utf8"),
  );
  const payloadBytes = Buffer.from(envelope.fitfreed.payloadBase64, "base64");
  const payload = JSON.parse(payloadBytes);
  const artifact = payload.release.platforms["darwin-aarch64"];
  assert.equal(envelope.fitfreed.schemaVersion, 2);
  assert.equal(envelope.fitfreed.keyId, "stable.synthetic-1");
  assert.equal(payload.sequence, 2);
  assert.equal(payload.release.version, "0.2.0");
  assert.equal(
    artifact.url,
    "https://purnalica.github.io/fitfreed/updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
  );
  assert.equal(artifact.size, values.packageBytes.length);
  assert.equal(artifact.sha256, createHash("sha256").update(values.packageBytes).digest("hex"));
  assert.deepEqual(
    readFileSync(
      path.join(
        values.outputDirectory,
        "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
      ),
    ),
    values.packageBytes,
  );
  assert.equal(result.payloadSha256, createHash("sha256").update(payloadBytes).digest("hex"));
});

test("preserves the previous Pages snapshot when staging cannot be signed", () => {
  const values = fixture();
  mkdirSync(values.outputDirectory, { recursive: true });
  writeFileSync(path.join(values.outputDirectory, "previous-snapshot"), "preserved\n");
  const arguments_ = stageArguments(values);
  arguments_.signPayload = () => {
    throw new Error("synthetic signing failure");
  };

  assert.throws(() => stageStableUpdateChannel(arguments_), /synthetic signing failure/);
  assert.deepEqual(relativeFiles(values.outputDirectory), ["previous-snapshot"]);
  assert.equal(readFileSync(path.join(values.outputDirectory, "previous-snapshot"), "utf8"), "preserved\n");
});

test("rejects a signing key outside the active public trust set", () => {
  const values = fixture();
  const arguments_ = stageArguments(values);
  arguments_.signingKeyId = "stable.unknown";

  assert.throws(() => stageStableUpdateChannel(arguments_), /active public trust set/);
});
