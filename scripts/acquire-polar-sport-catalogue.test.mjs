import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { acquirePolarSportInputs } from "./acquire-polar-sport-catalogue.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("acquires the four public non-account inputs with a reproducible observation", async () => {
  const requests = [];
  const responses = new Map([
    ["https://flow.polar.com/api/sports/sports", { 1: "RUNNING" }],
    ["https://localizations.flow.polar.com/v2/json-namespaced/index.json", {
      version: "2.437.0",
      langs: ["en", "es"],
    }],
    ["https://localizations.flow.polar.com/v2/json-namespaced/en/sport.json", {
      running: { long: "Running" },
    }],
    ["https://localizations.flow.polar.com/v2/json-namespaced/es/sport.json", {
      running: { long: "Correr" },
    }],
  ]);
  const acquired = await acquirePolarSportInputs({
    fetchImpl: async (uri, options) => {
      requests.push([uri, options]);
      return jsonResponse(responses.get(uri));
    },
    retrievedAtUtc: "2026-08-30T22:31:31Z",
  });

  assert.equal(requests.length, 4);
  assert.ok(requests.every(([, options]) => options.credentials === "omit"));
  assert.deepEqual(Object.keys(acquired.files), [
    "sports.json",
    "localization-index.json",
    "sport-en.json",
    "sport-es.json",
  ]);
  assert.equal(acquired.observation.retrievedAtUtc, "2026-08-30T22:31:31Z");
  assert.equal(acquired.observation.localizationRevision, "2.437.0");
  for (const [filename, bytes] of Object.entries(acquired.files)) {
    assert.equal(acquired.observation.inputs[filename].sha256, sha256(bytes));
    assert.equal(acquired.observation.inputs[filename].byteCount, bytes.length);
  }
});

test("rejects an unavailable endpoint and malformed public JSON", async () => {
  await assert.rejects(
    acquirePolarSportInputs({
      fetchImpl: async () => jsonResponse({ error: "unavailable" }, 503),
      retrievedAtUtc: "2026-08-30T22:31:31Z",
    }),
    /HTTP 503/iu,
  );

  await assert.rejects(
    acquirePolarSportInputs({
      fetchImpl: async () => new Response("not JSON", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      retrievedAtUtc: "2026-08-30T22:31:31Z",
    }),
    /not valid JSON/iu,
  );
});
