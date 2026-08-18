# Training-Session Structure Read Model Version 1

## Purpose and boundary

This provider-neutral contract exposes the recorded structure available inside one training session. It lets
the user inspect source exercises, source/manual laps, automatic laps, and pauses without exposing provider
identifiers. Routes, zones, sample series, user-defined segmentation, and reports have separate contracts and
are not implied by this version.

The Tauri command is `query_training_session_structure`. Its request and response conform to
[`training-session-structure-query-v1.schema.json`](../../../schemas/training-session-structure-query-v1.schema.json)
and [`training-session-structure-v1.schema.json`](../../../schemas/training-session-structure-v1.schema.json).

## Query and snapshot coherence

`sessionRef` is the opaque session capability returned by training-session search. Optional `snapshotRef` is
the opaque discovery snapshot from the page that opened the detail. A supplied snapshot must still be current;
the query never substitutes a similarly dated session or resolves a source identifier. A null `snapshotRef`
asks for the current coherent snapshot and is intended for initial programmatic reads rather than paginated UI
navigation.

The result repeats the accepted `snapshotRef` and `sessionRef`. `structure` is null only when the session was
mapped before this structural contract and has not yet been reassessed by a compatible importer. This differs
from a non-null structure whose `exercises` is null: in that case the source exercise collection was absent.
A present empty `exercises` array means the source supplied an empty collection. No state is converted into
another.

## Exercise structure

Exercises retain source order through a zero-based contiguous `ordinal`. `exerciseRef` is a library-local,
domain-separated opaque reference; it is unique within the result, must not be displayed, and is not the
provider exercise identifier.

Each exercise contains exact source-local `startedAtLocal` and `stoppedAtLocal`, optional
`utcOffsetMinutes`, exact decimal-string `durationMilliseconds`, optional `distanceMeters`, optional exact
decimal-string `energyKilocalories`, and provider-neutral `sport` state. Time, missing-value, and sport
semantics match the training-session search contract. Aggregate session values remain authoritative for the
session summary and are never recalculated from exercises. A malformed stored interval whose stop precedes
its start is rejected before presentation.

`manualLaps`, `automaticLaps`, and `pauses` each independently preserve three states: null means the source
collection was absent, an empty array means it was present without entries, and a populated array preserves
its source order. FitFreed does not invent a lap or pause from timestamps.

## Laps and pauses

Every lap has an opaque `lapRef`, a zero-based contiguous `ordinal`, exact decimal-string
`splitTimeMilliseconds` and `durationMilliseconds`, and optional `distanceMeters`. Manual/source laps and
automatic laps are separate collections and identities; equal values do not merge them.

Every pause has an opaque `pauseRef`, a zero-based contiguous `ordinal`, and source-local
`startedAtLocal` and `endedAtLocal`. The end cannot precede the start. Pause duration is not transported as a
second potentially inconsistent measurement.

All child references use distinct prefixes and SHA-256-derived domains. References are navigation
capabilities, not portable identities, source evidence, labels, or stable cross-library identifiers. Arrays
contain unique references and their ordinals must equal their positions.

## Errors, privacy, and compatibility

Malformed capabilities or invalid result invariants return `invalid-training-session-detail`. A changed
snapshot returns `training-session-detail-changed`. Missing storage, absent session resolution, or persistence
failure returns `training-session-detail-failed`. A failed read changes no canonical fact.

The response contains no origin identity, provider name, provider session or exercise identifier, archive
member locator, coordinates, route, note, device identifier, or sample value. All processing and rendering
remain local to the device running FitFreed.

Changing optional-collection semantics, order, identity domains, units, numeric encoding, snapshot behavior,
sport meaning, or error codes requires a new contract version. Adding routes, zones, series, user-authored
segments, or report definitions requires a separate versioned read model rather than an undocumented field.
