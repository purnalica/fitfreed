import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const sourceUri = "https://flow.polar.com/api/sports/sports";
const localizationIndexUri = "https://localizations.flow.polar.com/v2/json-namespaced/index.json";
const localizationUris = {
  "en-US": "https://localizations.flow.polar.com/v2/json-namespaced/en/sport.json",
  "es-ES": "https://localizations.flow.polar.com/v2/json-namespaced/es/sport.json",
};
const generatorVersion = "polar-sport-catalogue-generator@1";
const supportedFamilies = new Set([
  "running", "cycling", "swimming", "walking", "hiking", "strength", "mobility",
  "racket-sport", "team-sport", "winter-sport", "water-sport", "other",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function plainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function parseJson(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error(`${label} must be non-empty bytes`);
  }
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function boundedText(value, label, maximum) {
  if (
    typeof value !== "string" || value.length === 0 || value.length > maximum
    || value.trim() !== value || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function lowercaseSha256(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} is not a lowercase SHA-256 digest`);
  }
  return value;
}

function retrievalInstant(value) {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)
    || Number.isNaN(Date.parse(value))
  ) {
    throw new Error("catalogue retrieval instant is invalid");
  }
  return value;
}

function verifyDigest(bytes, expected, label) {
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(`${label} does not match: expected ${expected}, received ${actual}`);
  }
  return actual;
}

function validateAcquisition(value) {
  const acquisition = plainObject(value, "acquisition metadata");
  const localizationSha256 = plainObject(acquisition.localizationSha256, "localization digests");
  return {
    retrievedAtUtc: retrievalInstant(acquisition.retrievedAtUtc),
    contractSha256: lowercaseSha256(acquisition.contractSha256, "public contract digest"),
    sourceSha256: lowercaseSha256(acquisition.sourceSha256, "source mapping digest"),
    localizationRevision: boundedText(acquisition.localizationRevision, "localization revision", 256),
    localizationIndexSha256: lowercaseSha256(
      acquisition.localizationIndexSha256,
      "localization index digest",
    ),
    localizationSha256: {
      "en-US": lowercaseSha256(localizationSha256["en-US"], "en-US localization digest"),
      "es-ES": lowercaseSha256(localizationSha256["es-ES"], "es-ES localization digest"),
    },
    mappingVersion: boundedText(acquisition.mappingVersion, "mapping version", 256),
  };
}

function validateLocalizationIndex(bytes, acquisition) {
  verifyDigest(bytes, acquisition.localizationIndexSha256, "localization index digest");
  const index = plainObject(parseJson(bytes, "localization index"), "localization index");
  if (index.version !== acquisition.localizationRevision) {
    throw new Error(
      `localization revision does not match: expected ${acquisition.localizationRevision}, received ${index.version}`,
    );
  }
  if (!Array.isArray(index.langs) || !index.langs.includes("en") || !index.langs.includes("es")) {
    throw new Error("localization index does not advertise both supported source languages");
  }
}

function validateProviderNameKey(value) {
  const nameKey = boundedText(value, "provider name key", 256);
  if (!/^[A-Z0-9]+(?:[_-][A-Z0-9]+)*$/u.test(nameKey)) {
    throw new Error(`provider name key is invalid: ${nameKey}`);
  }
  return nameKey;
}

function validateFamilyMappings(value, providerNameKeys) {
  const mappings = plainObject(value, "family mappings");
  const normalized = {};
  for (const [nameKey, family] of Object.entries(mappings).sort(([left], [right]) => (
    left.localeCompare(right, "en")
  ))) {
    validateProviderNameKey(nameKey);
    if (!providerNameKeys.has(nameKey)) {
      throw new Error(`family mapping references an unknown provider name key: ${nameKey}`);
    }
    if (!supportedFamilies.has(family)) {
      throw new Error(`family mapping contains an unsupported family: ${family}`);
    }
    normalized[nameKey] = family;
  }
  for (const providerNameKey of [...providerNameKeys].sort()) {
    if (normalized[providerNameKey] === undefined) {
      throw new Error(`missing reviewed family mapping: ${providerNameKey}`);
    }
  }
  return normalized;
}

function sourceIdentifier(value) {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`source identifier is not canonical: ${value}`);
  }
  if (BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`source identifier exceeds the supported range: ${value}`);
  }
  return value;
}

function localizedLongName(localization, providerNameKey, locale) {
  const localizationKey = providerNameKey.toLocaleLowerCase("en-US");
  const localized = localization[localizationKey];
  if (localized === undefined) {
    throw new Error(`${providerNameKey} is missing ${locale} localized name`);
  }
  return boundedText(
    plainObject(localized, `${providerNameKey} ${locale} localization`).long,
    `${providerNameKey} ${locale} localized name`,
    120,
  );
}

function numericIdentifierOrder(left, right) {
  const leftValue = BigInt(left.sourceIdentifier);
  const rightValue = BigInt(right.sourceIdentifier);
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

export function generatePolarSportCatalogue({
  sourceBytes,
  localizationIndexBytes,
  englishLocalizationBytes,
  spanishLocalizationBytes,
  acquisition: acquisitionInput,
  familyByNameKey: familyMappingInput,
}) {
  const acquisition = validateAcquisition(acquisitionInput);
  verifyDigest(sourceBytes, acquisition.sourceSha256, "source mapping digest");
  validateLocalizationIndex(localizationIndexBytes, acquisition);
  verifyDigest(
    englishLocalizationBytes,
    acquisition.localizationSha256["en-US"],
    "en-US localization digest",
  );
  verifyDigest(
    spanishLocalizationBytes,
    acquisition.localizationSha256["es-ES"],
    "es-ES localization digest",
  );

  const source = plainObject(parseJson(sourceBytes, "sport mapping source"), "sport mapping source");
  const sourceEntries = Object.entries(source);
  if (sourceEntries.length === 0 || sourceEntries.length > 10_000) {
    throw new Error("sport mapping source has an invalid entry count");
  }
  const englishLocalization = plainObject(
    parseJson(englishLocalizationBytes, "en-US localization"),
    "en-US localization",
  );
  const spanishLocalization = plainObject(
    parseJson(spanishLocalizationBytes, "es-ES localization"),
    "es-ES localization",
  );
  const parsedEntries = sourceEntries.map(([identifier, nameKeyValue]) => ({
    sourceIdentifier: sourceIdentifier(identifier),
    providerNameKey: validateProviderNameKey(nameKeyValue),
  }));
  const providerNameKeys = new Set(parsedEntries.map((entry) => entry.providerNameKey));
  const familyByNameKey = validateFamilyMappings(familyMappingInput, providerNameKeys);
  const entries = parsedEntries
    .map((entry) => ({
      ...entry,
      localizedNames: {
        "en-US": localizedLongName(englishLocalization, entry.providerNameKey, "en-US"),
        "es-ES": localizedLongName(spanishLocalization, entry.providerNameKey, "es-ES"),
      },
      parentIdentifier: null,
      canonicalFamilySuggestion: familyByNameKey[entry.providerNameKey] ?? null,
    }))
    .sort(numericIdentifierOrder);

  const catalogue = {
    sourceProvider: "polar-flow",
    catalogueRevision: `polar-flow-sports@${acquisition.sourceSha256}`,
    retrievedAtUtc: acquisition.retrievedAtUtc,
    provenanceUri: sourceUri,
    provenanceSha256: acquisition.sourceSha256,
    mappingVersion: acquisition.mappingVersion,
    entries,
  };
  const catalogueBytes = Buffer.from(`${JSON.stringify(catalogue, null, 2)}\n`);
  const manifest = {
    schemaVersion: 1,
    generatorVersion,
    source: {
      mapping: {
        uri: sourceUri,
        sha256: acquisition.sourceSha256,
        retrievedAtUtc: acquisition.retrievedAtUtc,
      },
      localization: {
        revision: acquisition.localizationRevision,
        "en-US": {
          uri: localizationUris["en-US"],
          sha256: acquisition.localizationSha256["en-US"],
        },
        "es-ES": {
          uri: localizationUris["es-ES"],
          sha256: acquisition.localizationSha256["es-ES"],
        },
      },
      localizationIndex: {
        uri: localizationIndexUri,
        sha256: acquisition.localizationIndexSha256,
      },
      contractSha256: acquisition.contractSha256,
    },
    output: {
      sha256: sha256(catalogueBytes),
      entryCount: entries.length,
      catalogueRevision: catalogue.catalogueRevision,
      mappingVersion: catalogue.mappingVersion,
    },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  return { catalogue, catalogueBytes, manifest, manifestBytes };
}

function run() {
  const [
    sourcePath,
    localizationIndexPath,
    englishLocalizationPath,
    spanishLocalizationPath,
    acquisitionPath,
    familyMappingPath,
    cataloguePath,
    manifestPath,
  ] = process.argv.slice(2);
  if ([
    sourcePath,
    localizationIndexPath,
    englishLocalizationPath,
    spanishLocalizationPath,
    acquisitionPath,
    familyMappingPath,
    cataloguePath,
    manifestPath,
  ].some((value) => value === undefined)) {
    throw new Error(
      "usage: generate-polar-sport-catalogue <mapping> <localization-index> <en-localization> "
      + "<es-localization> <acquisition> <families> <catalogue> <manifest>",
    );
  }
  const generated = generatePolarSportCatalogue({
    sourceBytes: readFileSync(sourcePath),
    localizationIndexBytes: readFileSync(localizationIndexPath),
    englishLocalizationBytes: readFileSync(englishLocalizationPath),
    spanishLocalizationBytes: readFileSync(spanishLocalizationPath),
    acquisition: JSON.parse(readFileSync(acquisitionPath, "utf8")),
    familyByNameKey: JSON.parse(readFileSync(familyMappingPath, "utf8")),
  });
  mkdirSync(path.dirname(path.resolve(cataloguePath)), { recursive: true });
  mkdirSync(path.dirname(path.resolve(manifestPath)), { recursive: true });
  writeFileSync(cataloguePath, generated.catalogueBytes);
  writeFileSync(manifestPath, generated.manifestBytes);
  process.stdout.write(`${JSON.stringify(generated.manifest.output)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) run();
