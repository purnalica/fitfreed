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

## Polar Flow availability gate

Polar's official Dynamic API documents the necessary identifier, localized name, and parent relationship,
but complete catalogue retrieval requires authenticated `sports:read` access. No GPL-compatible right to
redistribute a retrieved complete catalogue has been established. Consequently the MVP repository contains
synthetic contract evidence only and does not bundle a Polar catalogue. Obtaining authenticated official
evidence and establishing either redistribution authority or an explicitly local-only acquisition path is a
documented human gate; it does not authorize inferred names.

Changing field meaning, snapshot identity, ambiguity, ordering, digest derivation, activation, or failure
semantics requires a new provider-catalogue evidence version.
