# Portable Planned-Training Export Version 1

## Purpose and scope

[`planned-training-export-v1.schema.json`](../../../schemas/planned-training-export-v1.schema.json) is the normative,
open JSON representation of all planned-training intent retained by one FitFreed library. It provides an exact exit
path for this capability without exposing SQLite as a portable API.

This is a capability export, not a complete FitFreed library backup and not a full-library normalized export. It
contains scheduled targets, favourite templates, every retained mapped revision, current-head selection, conflicts,
favourite collection history, mapping coverage, and source provenance. It does not contain recorded sessions, daily
activity, sleep, recovery, authored ranges, report definitions, preferences, update state, or the private
source-subject correlation key. Those domains require their own portable contracts before a complete normalized
library export can claim that no supported information is omitted.

- Media type: `application/vnd.fitfreed.planned-training+json;version=1`
- Encoding: UTF-8 without a byte-order mark
- Container: one JSON object
- Format discriminator: `org.fitfreed.normalized-planned-training`
- Schema version: `1`
- Unknown members: rejected
- Output filename recommendation: `fitfreed-planned-training.json`

## Root and deterministic ordering

| Field | Contract |
|---|---|
| `format` | Fixed discriminator. |
| `schemaVersion` | Positive contract version, fixed to 1. |
| `libraryRevision` | Non-negative planned-training capability revision observed in the same SQLite read transaction as the exported data. It is not an export sequence or global library revision. |
| `targets` | Every retained target ordered by `originRef`, then `targetRef`. |
| `favoriteSnapshots` | Every retained favourite snapshot ordered by `originRef`, source observation order, then `snapshotRef`. |

The serializer emits compact JSON with stable object-member order. Identical retained state in one library produces
identical bytes and SHA-256. Library-local origin and operation references can differ when equivalent provider data
is imported independently into another library, so cross-library byte equality is not promised.

## Target identity and revisions

Each `targets` item contains:

- opaque `originRef` and stable canonical `targetRef`;
- `source.provider`, target `source.kind`, and the adapter's stable source `identity`;
- the exact `currentRevision` pair;
- `reconciliationState`, either `current` or `conflicted`;
- every immutable canonical `revisions` representation;
- ordered `provenance` observations and explicit `conflicts`.

`currentRevision` must identify exactly one item in `revisions`. `source.kind` must equal every revision's
`targetKind`. An export consumer must not select a later array item as current, infer source revision order, or erase
a conflicting revision.

A scheduled revision requires `scheduledAtLocal` and `completion`. A favourite template requires both members to be
null. `description` always appears and uses null for absence, preserving absent versus present-empty. `exercises`
always appears and uses null for an absent provider collection, an empty array for present-empty, and an ordered array
otherwise.

`mappingCoverage` carries the exact `complete` or `partial` state, count, and ordered unique
`unmappedFieldLocators`. A complete mapping has zero and an empty locator array. A partial mapping has a positive
count equal to the locator array length. Unknown source values are not present because the importer deliberately
retains their locations, not values whose meaning and privacy have not been established. The original provider
archive therefore remains necessary for later reinterpretation of unsupported values.

## Exercises, phases, and repeats

Exercises and phases retain stable references and zero-based semantic order. Null and empty phase collections remain
distinct. Duration values are positive whole milliseconds; distance values are positive metres.

Phase `goal` is one of:

- `duration`, with only `durationMilliseconds` populated;
- `distance`, with only `distanceMeters` populated;
- `unmapped`, with both values null.

Phase `intensity` is `none`, `zone-range`, or `unmapped`. A zone range supplies one provider-neutral metric,
inclusive zones from 1 through 5, and ordered lower and upper bounds. Other kinds leave metric and bounds null.

Every phase owns one `transition`. Its optional `repeat` retains a stable reference, the zero-based phase ordinal to
which execution returns, and total iterations. The export never flattens a repeat into copied phases.

## Sport evidence

Exercise `sport.state` is `unavailable`, `unmapped`, or `recognized`. Only recognized sport evidence carries a
provider-neutral `suggestion`, including optional canonical family, localized names, and the exact catalogue and
mapping provenance that produced the suggestion.

`sourceEvidence` deliberately preserves opaque provider codes and record locations. They remain data owned by the
person and are necessary for audit and future reinterpretation; their presence does not promote them into canonical
sport identity. Because this is an explicit user-controlled export, the file is sensitive and receives the same
protection as the source archive.

## Provenance, conflicts, and favourite snapshots

Provenance preserves `operationRef`, `sourceProvider`, `sourceAdapterVersion`, `mappingVersion`, `sourceIdentity`,
`sourceArtifactLocator`, `sourceArtifactSha256`, `sourceRecordLocator`, `sourceExportVersion`,
`reconciliationDecision`, and `contributesToVisibleState`. Local SQLite surrogate identifiers and the library
correlation key are excluded.

Conflict records bind the existing and incoming immutable revision pairs to the operation and source artifact that
created the unresolved state. Consumers retain both and do not treat array order as conflict resolution.

Favourite snapshots preserve source artifact provenance and ordered membership. Exactly one most recently observed
snapshot per origin has `current = true`; an explicitly empty current snapshot has an empty `members` array. Targets
and earlier snapshots remain even when a later snapshot omits them.

## Relationship boundary

Version 1 does not serialize a planned-target-to-recorded-session relationship. That relationship is a derived
cross-capability result, not part of canonical planned intent, and recorded sessions are outside this capability
export. A report may include a reviewed exact relationship, while a future complete normalized library contract must
carry both capabilities and an explicitly versioned relationship representation. Similar dates, names, durations,
distances, or phase shapes never authorize an export consumer to invent that relationship.

## Creation, cancellation, and compatibility

FitFreed reads one consistent library transaction, validates canonical invariants while reconstructing every
revision, writes through a private sibling file, synchronizes it, computes the exact SHA-256, checks cancellation,
and atomically replaces the chosen regular-file destination. Cancellation or failure before replacement preserves an
existing destination. Source and destination must differ.

A version-1 consumer validates the complete document before use. An unknown `schemaVersion`, unknown member, missing
revision, broken current reference, non-contiguous order, invalid repeat graph, inconsistent coverage count, or
cross-origin membership is unsupported. A backup-oriented tool may preserve an unknown later version as opaque
bytes, but must not rewrite it as version 1. Future compatible additions require a new schema version; version 1 is
never changed in place after release.

## Independent synthetic evidence

[`planned-training-export-v1.json`](../../../test/fixtures/synthetic/planned-training-export-v1.json) is independently
constructed and contains no personal source value. Automated contract verification compiles the JSON Schema,
validates this example, rejects an unknown member, and checks the implementation-owned format and schema constants.

## Known information boundaries

- The provider archive remains the only recovery source for unknown values that FitFreed did not retain.
- No recorded samples, route, achieved phase, or compliance conclusion appears.
- `originRef` is deliberately opaque and library-local; the private source-subject correlation key and digest remain
  excluded.
- Exported locators, hashes, operation references, names, descriptions, schedules, sport codes, and training
  structure can be sensitive personal data even though the format is open and local.
