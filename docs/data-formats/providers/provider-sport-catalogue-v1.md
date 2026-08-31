# Provider Sport Catalogue Evidence Version 1

## Status and boundary

Normative adapter-input contract for installing verifiable provider sport names without adding a provider
taxonomy to the FitFreed domain. A source adapter translates lawfully obtained catalogue material into JSON
conforming to
[`provider-sport-catalogue-v1.schema.json`](../../../schemas/provider-sport-catalogue-v1.schema.json)
and the equivalent `ProviderSportCatalogueEvidence` application boundary. The archive importer does not
invent this evidence and recorded route, speed, distance, heart rate, or device values never substitute for
it.

The contract is provider-specific evidence on the infrastructure side. Its installed output is the
provider-neutral [training sport identity](../insights/training-sport-identity-v1.md). Neither the provider
identifier nor its raw sport identifier crosses that read boundary.

## Catalogue evidence

`sourceProvider` is the adapter-owned provider code. `catalogueRevision` identifies the exact upstream
catalogue revision, while `retrievedAtUtc` is its RFC 3339 retrieval instant ending in `Z`.
`provenanceUri` is an absolute URI identifying the exact official or otherwise authorized retrieval source and
`provenanceSha256` is the lowercase SHA-256 digest of the retained source evidence. `mappingVersion`
identifies the independently reviewable provider-to-canonical suggestion rules.

`entries` contains between one and 10,000 candidates. Each entry has:

- `sourceIdentifier`, the exact provider value joined to imported source evidence only inside the adapter;
- `providerNameKey`, the provider's stable name key;
- `localizedNames`, one or more BCP 47-style language-tag/name pairs;
- nullable `parentIdentifier`, preserved as provider evidence but not treated as a canonical hierarchy; and
- nullable `canonicalFamilySuggestion`, one provider-neutral FitFreed family suggestion.

Names contain one through 120 Unicode scalar values, exclude control characters and outer whitespace, and
remain provider evidence rather than user-authored labels. Family values are `running`, `cycling`,
`swimming`, `walking`, `hiking`, `strength`, `mobility`, `racket-sport`, `team-sport`, `winter-sport`,
`water-sport`, and `other`.

More than one distinct entry may deliberately share `sourceIdentifier`; that produces an ambiguous
resolution. An exact duplicate candidate is invalid. Input order has no meaning: installation sorts
candidates deterministically and assigns contiguous zero-based candidate ordinals per source identifier.

## Integrity, identity, and activation

The immutable snapshot identity is (`sourceProvider`, `catalogueRevision`, `mappingVersion`). Installation
derives a deterministic `contentSha256` over normalized evidence and one `sport-evidence-` reference with 64
lowercase hexadecimal characters per candidate. Reinstalling identical evidence is idempotent. Reusing the
same snapshot identity with different content fails atomically.

Activation is explicit per provider. Selecting another catalogue revision or mapping version increments the
training-discovery revision so every earlier Home, History, session, and report snapshot becomes stale rather
than mixing identities. Mapping enrichment never edits an immutable snapshot. It installs and selects a new
snapshot.

## Validation and failure

Identifiers and revision values are non-empty, trimmed, control-free and bounded as defined by the schema.
Digests are lowercase SHA-256 values. The retrieval instant must parse as RFC 3339 and end in `Z`. Localized
names and canonical suggestions are reconstructed through domain validation before any row is committed.
Any invalid field, duplicate candidate, conflicting immutable snapshot, database failure, or interrupted
transaction leaves the previously selected catalogue and all imported training history unchanged.

The schema validates independently constructed JSON evidence. Runtime installation uses the equivalent typed
Rust representation; JSON is the stable inspectable expression of that boundary rather than a public user
import format.

## Polar Flow acquisition and activation

Polar Flow publicly exposes the numeric identifier-to-stable-name-key relationship required by this contract at
`https://flow.polar.com/api/sports/sports`. Its versioned public `en/sport.json` and `es/sport.json` localization
namespaces supply the supported human names. A maintainer acquisition command records the exact input digests,
localization revision, and retrieval instant, then emits only the minimal deterministic compatibility snapshot used by
FitFreed. Account records, authorization, profiles, sessions, devices, tokens, provider descriptions, and unrelated
sport settings are neither generator inputs nor bundled output. The public mapping does not expose parent evidence,
so generated entries leave `parentIdentifier` absent rather than inventing hierarchy.

The supported application activates this snapshot out of the box so supported takeout identifiers resolve without
requiring the person using FitFreed to connect a Polar account. The upstream responses remain ignored,
replaceable maintainer inputs; the generated compatibility snapshot, its provenance manifest, and its generator are
the reviewable product artifacts. A later optional connected-provider adapter may retrieve and activate a newer
global snapshot through the same contract.

The versioned artifacts are:

- [`polar-flow-sport-acquisition-v1.json`](../../../assets/provider-compatibility/polar-flow-sport-acquisition-v1.json),
  the exact accepted input digests, localization revision, retrieval instant, API-contract digest, and mapping version;
- [`polar-flow-sport-family-v1.json`](../../../assets/provider-compatibility/polar-flow-sport-family-v1.json), the
  explicit reviewed provider-name-key to provider-neutral visual-family decisions;
- [`polar-flow-sport-catalogue-v1.json`](../../../assets/provider-compatibility/polar-flow-sport-catalogue-v1.json),
  the generated runtime evidence; and
- [`polar-flow-sport-catalogue-v1.manifest.json`](../../../assets/provider-compatibility/polar-flow-sport-catalogue-v1.manifest.json),
  the generator, source, and output integrity binding.

Run `npm run catalogue:polar:acquire` to retrieve the four public inputs into the ignored local research directory.
Compare `observation.json` with the accepted acquisition metadata. Any changed digest, localization revision, stable
key, translation, or family coverage requires review before updating the accepted metadata. Run
`npm run catalogue:polar:generate` only after that review; generation fails on digest drift, malformed input,
non-canonical identifiers, missing supported names, unsupported families, or an unreviewed stable key. Run
`npm run check:data-contracts` and the acquisition and generation script tests before accepting the output. Repeating
generation from identical accepted inputs must produce byte-identical catalogue and manifest files.

A privacy-bounded authenticated diagnostic on 2026-08-30 established that the current catalogue identifier is the
exact join to every non-null takeout `sport.id` in the authorized local library and that the catalogue supplies
human-readable identity. No private value or retrieved catalogue content was retained. This establishes the semantic
join independently from the maintainer catalogue acquisition.

Changing field meaning, snapshot identity, ambiguity, ordering, digest derivation, activation, or failure
semantics requires a new provider-catalogue evidence version.
