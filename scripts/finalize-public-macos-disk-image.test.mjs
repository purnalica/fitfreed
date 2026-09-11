import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { finalizePublicMacosDiskImage } from "./finalize-public-macos-disk-image.mjs";

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-public-dmg-test-"));
  const diskImagePath = path.join(directory, "FitFreed_0.1.6_aarch64.dmg");
  const apiKeyPath = path.join(directory, "AuthKey_A1B2C3D4E5.p8");
  writeFileSync(diskImagePath, "synthetic disk image");
  writeFileSync(apiKeyPath, "synthetic API key");
  return {
    diskImagePath,
    signing: {
      apiKeyPath,
      expectedTeamIdentifier: "A1B2C3D4E5",
      notarizationMode: "app-store-connect-api",
      signingIdentity: "a".repeat(40),
    },
    environment: {
      APPLE_API_ISSUER: "11111111-2222-3333-4444-555555555555",
      APPLE_API_KEY: "A1B2C3D4E5",
    },
  };
}

test("finalizes the exact DMG as an independently notarized distribution container", () => {
  const input = fixture();
  const calls = [];
  const result = finalizePublicMacosDiskImage({
    ...input,
    runCommand(stage, command, arguments_) {
      calls.push([stage, command, ...arguments_]);
      if (stage === "disk-image-notarization") {
        return JSON.stringify({
          id: "11111111-2222-3333-4444-555555555555",
          message: "Processing complete",
          status: "Accepted",
        });
      }
      if (stage === "disk-image-notarization-log") {
        return JSON.stringify({
          issues: null,
          jobId: "11111111-2222-3333-4444-555555555555",
          status: "Accepted",
          statusSummary: "Ready for distribution",
        });
      }
      return "";
    },
  });

  assert.deepEqual(result, {
    identifier: "org.fitfreed.desktop.dmg",
    notarized: true,
    stapled: true,
  });
  assert.deepEqual(calls.map(([stage]) => stage), [
    "disk-image-integrity",
    "disk-image-signature",
    "disk-image-signature-verification",
    "disk-image-notarization",
    "disk-image-notarization-log",
    "disk-image-stapling",
    "disk-image-ticket-validation",
  ]);
  assert.deepEqual(calls[1], [
    "disk-image-signature",
    "codesign",
    "--force",
    "--sign",
    input.signing.signingIdentity,
    "--timestamp",
    "--identifier",
    "org.fitfreed.desktop.dmg",
    input.diskImagePath,
  ]);
  assert.deepEqual(calls[3].slice(0, 8), [
    "disk-image-notarization",
    "xcrun",
    "notarytool",
    "submit",
    input.diskImagePath,
    "--output-format",
    "json",
    "--wait",
  ]);
  assert.equal(calls[3].includes("--timeout"), true);
  assert.equal(calls[3].includes(input.signing.apiKeyPath), true);
});

test("rejects an unaccepted or issue-bearing notarization before stapling", () => {
  const input = fixture();
  for (const [submit, log, expected] of [
    [{ status: "Invalid" }, null, /was not accepted/],
    [
      { id: "11111111-2222-3333-4444-555555555555", status: "Accepted" },
      { issues: [{ message: "synthetic issue", severity: "warning" }], status: "Accepted" },
      /reported issues/,
    ],
    [
      { id: "11111111-2222-3333-4444-555555555555", status: "Accepted" },
      { status: "Accepted" },
      /invalid issues field/,
    ],
  ]) {
    assert.throws(() => finalizePublicMacosDiskImage({
      ...input,
      runCommand(stage) {
        if (stage === "disk-image-notarization") return JSON.stringify(submit);
        if (stage === "disk-image-notarization-log") return JSON.stringify(log);
        return "";
      },
    }), expected);
  }
});

test("uses the complete Apple ID credential mode without changing the DMG contract", () => {
  const input = fixture();
  const calls = [];
  const environment = {
    APPLE_ID: "synthetic-apple-id",
    APPLE_PASSWORD: "synthetic application password",
    APPLE_TEAM_ID: "A1B2C3D4E5",
  };
  const signing = {
    expectedTeamIdentifier: "A1B2C3D4E5",
    notarizationMode: "apple-id",
    signingIdentity: input.signing.signingIdentity,
  };

  finalizePublicMacosDiskImage({
    diskImagePath: input.diskImagePath,
    environment,
    signing,
    runCommand(stage, command, arguments_) {
      calls.push([stage, command, ...arguments_]);
      if (stage === "disk-image-notarization") {
        return JSON.stringify({
          id: "11111111-2222-3333-4444-555555555555",
          status: "Accepted",
        });
      }
      if (stage === "disk-image-notarization-log") {
        return JSON.stringify({ issues: [], status: "Accepted" });
      }
      return "";
    },
  });

  const submission = calls.find(([stage]) => stage === "disk-image-notarization");
  assert.equal(submission.includes("--apple-id"), true);
  assert.equal(submission.includes(environment.APPLE_ID), true);
  assert.equal(submission.includes("--team-id"), true);
  assert.equal(submission.includes(environment.APPLE_TEAM_ID), true);
  assert.equal(submission.includes("--key-id"), false);
});

test("refuses missing artifacts and incomplete notarization authority", () => {
  const input = fixture();
  assert.throws(
    () => finalizePublicMacosDiskImage({
      ...input,
      diskImagePath: path.join(path.dirname(input.diskImagePath), "missing.dmg"),
      runCommand() {},
    }),
    /regular file/,
  );
  assert.throws(
    () => finalizePublicMacosDiskImage({
      ...input,
      environment: {},
      runCommand() {},
    }),
    /notarization authority/,
  );
});
