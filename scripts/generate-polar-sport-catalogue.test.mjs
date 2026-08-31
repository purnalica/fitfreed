import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { generatePolarSportCatalogue } from "./generate-polar-sport-catalogue.mjs";

const contractSha256 = "a".repeat(64);

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function syntheticInputs() {
  const sourceBytes = jsonBytes({
    20: "WATERSPORTS_KAYAKING",
    2: "CYCLING",
  });
  const localizationIndexBytes = jsonBytes({
    version: "2.437.0",
    langs: ["en", "es"],
  });
  const englishLocalizationBytes = jsonBytes({
    cycling: { long: "Cycling", medium: "Cycling", short: "Cycling" },
    watersports_kayaking: { long: "Kayaking", medium: "Kayaking", short: "Kayaking" },
  });
  const spanishLocalizationBytes = jsonBytes({
    cycling: { long: "Ciclismo", medium: "Ciclismo", short: "Ciclismo" },
    watersports_kayaking: { long: "Piragüismo en kayak", medium: "Kayak", short: "Kayak" },
  });
  return {
    sourceBytes,
    localizationIndexBytes,
    englishLocalizationBytes,
    spanishLocalizationBytes,
    acquisition: {
      retrievedAtUtc: "2026-08-31T00:15:11Z",
      contractSha256,
      sourceSha256: sha256(sourceBytes),
      localizationRevision: "2.437.0",
      localizationIndexSha256: sha256(localizationIndexBytes),
      localizationSha256: {
        "en-US": sha256(englishLocalizationBytes),
        "es-ES": sha256(spanishLocalizationBytes),
      },
      mappingVersion: "polar-flow-sport-mapping@1",
    },
    familyByNameKey: {
      CYCLING: "cycling",
      WATERSPORTS_KAYAKING: "water-sport",
    },
  };
}

function replaceSource(inputs, source) {
  inputs.sourceBytes = jsonBytes(source);
  inputs.acquisition.sourceSha256 = sha256(inputs.sourceBytes);
}

test("generates a deterministic minimal catalogue from public Flow inputs", () => {
  const inputs = syntheticInputs();
  const first = generatePolarSportCatalogue(inputs);
  const second = generatePolarSportCatalogue(inputs);

  assert.deepEqual(first.catalogueBytes, second.catalogueBytes);
  assert.deepEqual(first.manifestBytes, second.manifestBytes);
  assert.equal(first.catalogue.sourceProvider, "polar-flow");
  assert.equal(first.catalogue.provenanceUri, "https://flow.polar.com/api/sports/sports");
  assert.deepEqual(first.catalogue.entries, [
    {
      sourceIdentifier: "2",
      providerNameKey: "CYCLING",
      localizedNames: { "en-US": "Cycling", "es-ES": "Ciclismo" },
      parentIdentifier: null,
      canonicalFamilySuggestion: "cycling",
    },
    {
      sourceIdentifier: "20",
      providerNameKey: "WATERSPORTS_KAYAKING",
      localizedNames: { "en-US": "Kayaking", "es-ES": "Piragüismo en kayak" },
      parentIdentifier: null,
      canonicalFamilySuggestion: "water-sport",
    },
  ]);
  assert.deepEqual(first.manifest.source.localization, {
    revision: "2.437.0",
    "en-US": {
      uri: "https://localizations.flow.polar.com/v2/json-namespaced/en/sport.json",
      sha256: inputs.acquisition.localizationSha256["en-US"],
    },
    "es-ES": {
      uri: "https://localizations.flow.polar.com/v2/json-namespaced/es/sport.json",
      sha256: inputs.acquisition.localizationSha256["es-ES"],
    },
  });
  assert.equal(first.manifest.output.entryCount, 2);
  assert.equal(first.manifest.output.sha256, sha256(first.catalogueBytes));
});

test("rejects localization drift and incomplete supported names", () => {
  const drifted = syntheticInputs();
  drifted.acquisition.localizationSha256["en-US"] = "b".repeat(64);
  assert.throws(
    () => generatePolarSportCatalogue(drifted),
    /en-US localization digest does not match/iu,
  );

  const incomplete = syntheticInputs();
  incomplete.spanishLocalizationBytes = jsonBytes({
    cycling: { long: "Ciclismo" },
  });
  incomplete.acquisition.localizationSha256["es-ES"] = sha256(
    incomplete.spanishLocalizationBytes,
  );
  assert.throws(
    () => generatePolarSportCatalogue(incomplete),
    /WATERSPORTS_KAYAKING.*es-ES localized name/iu,
  );
});

test("rejects non-canonical identifiers, invalid mappings, and unreviewed family keys", () => {
  const nonCanonicalIdentifier = syntheticInputs();
  replaceSource(nonCanonicalIdentifier, {
    "02": "CYCLING",
  });
  assert.throws(
    () => generatePolarSportCatalogue(nonCanonicalIdentifier),
    /source identifier.*canonical/iu,
  );

  const invalidNameKey = syntheticInputs();
  replaceSource(invalidNameKey, { 2: "Cycling" });
  assert.throws(
    () => generatePolarSportCatalogue(invalidNameKey),
    /provider name key.*invalid/iu,
  );

  const unknownFamilyKey = syntheticInputs();
  unknownFamilyKey.familyByNameKey.RUNNING = "running";
  assert.throws(
    () => generatePolarSportCatalogue(unknownFamilyKey),
    /unknown provider name key: RUNNING/iu,
  );

  const missingFamilyKey = syntheticInputs();
  delete missingFamilyKey.familyByNameKey.CYCLING;
  assert.throws(
    () => generatePolarSportCatalogue(missingFamilyKey),
    /missing reviewed family mapping: CYCLING/iu,
  );
});

test("allows multiple source identifiers to share one stable provider name key", () => {
  const inputs = syntheticInputs();
  replaceSource(inputs, {
    2: "CYCLING",
    200: "CYCLING",
  });
  delete inputs.familyByNameKey.WATERSPORTS_KAYAKING;

  const generated = generatePolarSportCatalogue(inputs);

  assert.deepEqual(
    generated.catalogue.entries.map((entry) => [entry.sourceIdentifier, entry.providerNameKey]),
    [["2", "CYCLING"], ["200", "CYCLING"]],
  );
});
