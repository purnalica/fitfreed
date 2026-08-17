import assert from "node:assert/strict";
import test from "node:test";

import { validatePublicReleasePolicy } from "./public-release-policy.mjs";

function policy() {
  return {
    format: "org.fitfreed.public-release-policy",
    schemaVersion: 1,
    releaseVersion: "0.2.0",
    update: {
      sequence: 2,
      minimumSupportedVersion: "0.1.0",
      releaseNotes: {
        "en-US": "A synthetic stable release.",
        "es-ES": "Una versión estable sintética.",
      },
      withdrawnVersions: [],
    },
  };
}

const matrix = {
  releaseVersion: "0.2.0",
  applicationVersions: ["0.1.0"],
};

test("accepts versioned localized stable-channel policy", () => {
  const candidate = policy();
  assert.equal(validatePublicReleasePolicy(candidate, matrix), candidate);
});

test("derives the minimum supported application from the upgrade matrix", () => {
  const candidate = policy();
  candidate.update.minimumSupportedVersion = "0.2.0";
  assert.throws(
    () => validatePublicReleasePolicy(candidate, matrix),
    /minimum supported version must be 0.1.0/,
  );
  candidate.releaseVersion = "0.1.0";
  candidate.update.minimumSupportedVersion = "0.1.0";
  assert.doesNotThrow(() => validatePublicReleasePolicy(candidate, {
    releaseVersion: "0.1.0",
    applicationVersions: [],
  }));
});

test("requires both initial locales and rejects self or duplicate withdrawals", () => {
  const missingLocale = policy();
  delete missingLocale.update.releaseNotes["es-ES"];
  assert.throws(() => validatePublicReleasePolicy(missingLocale, matrix), /es-ES/);

  const withdrawn = policy();
  const entry = {
    version: "0.2.0",
    reason: "stability",
    guidance: {
      "en-US": "Do not install this synthetic release.",
      "es-ES": "No instale esta versión sintética.",
    },
    replacementVersion: null,
  };
  withdrawn.update.withdrawnVersions = [entry, { ...entry }];
  assert.throws(
    () => validatePublicReleasePolicy(withdrawn, matrix),
    /duplicate withdrawn version.*current public release/s,
  );
});
