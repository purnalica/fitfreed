import assert from "node:assert/strict";
import test from "node:test";

import {
  publicOrigin,
  publicUpdateEndpoint,
  publicUpdateUrl,
  validatePublicOriginConfiguration,
} from "./public-origin.mjs";

test("derives every public Pages URL from the versioned canonical origin", () => {
  assert.equal(publicOrigin, "https://fitfreed.org/");
  assert.equal(publicUpdateEndpoint, "https://fitfreed.org/updates/stable.json");
  assert.equal(
    publicUpdateUrl("0.1.0/FitFreed_0.1.0_aarch64.app.tar.gz"),
    "https://fitfreed.org/updates/0.1.0/FitFreed_0.1.0_aarch64.app.tar.gz",
  );
});

test("rejects origins that are not one credential-free HTTPS apex", () => {
  const valid = {
    format: "org.fitfreed.public-origin",
    schemaVersion: 1,
    canonicalOrigin: "https://fitfreed.org/",
  };
  assert.deepEqual(validatePublicOriginConfiguration(valid), valid);

  for (const canonicalOrigin of [
    "http://fitfreed.org/",
    "https://www.fitfreed.org/",
    `https://account:secret${String.fromCharCode(64)}fitfreed.org/`,
    "https://fitfreed.org:8443/",
    "https://fitfreed.org/site/",
    "https://fitfreed.org/?source=test",
    "https://fitfreed.org/#site",
  ]) {
    assert.throws(() => validatePublicOriginConfiguration({
      ...valid,
      canonicalOrigin,
    }));
  }
});

test("rejects an unknown, incomplete, or future public-origin contract", () => {
  const valid = {
    format: "org.fitfreed.public-origin",
    schemaVersion: 1,
    canonicalOrigin: "https://fitfreed.org/",
  };
  for (const invalid of [
    { ...valid, format: "org.example.public-origin" },
    { ...valid, schemaVersion: 2 },
    { format: valid.format, schemaVersion: 1 },
    { ...valid, additional: true },
  ]) {
    assert.throws(() => validatePublicOriginConfiguration(invalid));
  }
});
