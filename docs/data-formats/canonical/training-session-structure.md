# Canonical Training-Session Structure Version 1

## Status and authority

This is the normative provider-neutral contract for recorded structure below a FitFreed training-session
aggregate. Version 1 is introduced by Polar Flow mapping `polar-flow-training-session@2`, but its exercise,
lap, pause, order, missing-value, and reconciliation semantics do not depend on Polar naming.

The structure extends, but does not replace, [canonical training-session summary version 1](training-session.md).
The summary remains the aggregate root and authoritative session-level observation. Child measurements are
evidence about recorded parts; they are never summed or substituted to repair the aggregate.

## Assessment state and collection semantics

`TrainingSessionRecord` combines a required `summary` with optional `structure`:

- null `structure` means no compatible structural mapping has evaluated the persisted session;
- present `structure` means structural mapping completed, even when its `exercises` is absent or empty;
- null `exercises` means the provider collection was absent;
- an empty `exercises` collection means the provider supplied the collection without entries.

Every nested optional collection uses the same strict distinction: null is absent, an empty collection is
present-empty, and a populated collection contains source-ordered evidence. Importers never infer one state
from another.

## `TrainingExercise`

`TrainingSessionStructure.exercises` is an optional ordered collection. Each `TrainingExercise` contains:

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `exerciseId` | string | yes | Non-empty source-scoped child identity, unique inside the session. |
| `ordinal` | non-negative integer | yes | Zero-based contiguous source order. |
| `startedAtLocal` | ISO 8601 local date-time | yes | Exercise wall-clock start without zone or embedded offset. |
| `stoppedAtLocal` | ISO 8601 local date-time | yes | Exercise wall-clock stop without zone or embedded offset. |
| `utcOffsetMinutes` | signed 32-bit integer or null | yes | Offset at exercise start; null means unavailable. |
| `durationMilliseconds` | non-negative signed 64-bit integer | yes | Declared exercise duration. |
| `distanceMeters` | finite non-negative binary64 or null | yes | Declared distance in metres; null means unavailable. |
| `energyKilocalories` | non-negative signed 64-bit integer or null | yes | Declared energy; null means unavailable. |
| `sportRef` | non-empty string or null | yes | Opaque source-scoped sport reference, not a display name. |
| `manualLaps` | ordered lap collection or null | yes | Source/manual laps with absence preserved. |
| `automaticLaps` | ordered lap collection or null | yes | Automatic laps with absence preserved. |
| `pauses` | ordered pause collection or null | yes | Recorded pauses with absence preserved. |

Exercise timestamps use the summary contract's local-date-time syntax and the stop cannot precede the start.
Declared duration is not recalculated from boundaries. Neither a single exercise nor several exercises are
assumed to cover or equal the aggregate.

## `TrainingLap`

Each `TrainingLap` contains `kind`, zero-based contiguous `ordinal`, non-negative
`splitTimeMilliseconds`, non-negative `durationMilliseconds`, and optional finite non-negative
`distanceMeters`. `kind` is `manual` or `automatic`. The two collections remain distinct even when entries
have equal measurements. Lap identity is its parent exercise, kind, and ordinal; the provider need not supply
a separate identifier.

## `TrainingPause`

Each `TrainingPause` contains a zero-based contiguous `ordinal`, source-local `startedAtLocal`, and
source-local `endedAtLocal`. Both boundaries use the canonical local-date-time syntax and the end cannot
precede the start. Pause duration is not duplicated as a derived canonical field.

## Identity, ordering, and invariants

- Exercise identity is scoped to `(originId, sessionId, exerciseId)` and cannot become a cross-provider or
  portable identity.
- Exercise identifiers are unique within one session; ordinals are unique, contiguous, and equal collection
  positions.
- Lap identity is `(originId, sessionId, exerciseId, kind, ordinal)`.
- Pause identity is `(originId, sessionId, exerciseId, ordinal)`.
- All measurements are validated before any child becomes visible.
- A provider child identifier is protected evidence and is transformed into a domain-separated opaque
  capability before presentation.
- Unknown provider fields do not enter an unspecified canonical property bag.

## Reconciliation and mapping upgrade

Reconciliation applies to the complete `TrainingSessionRecord` under the summary aggregate identity:

1. an absent session creates summary and evaluated structure atomically;
2. complete record equality is equivalent;
3. an equal summary with null persisted `structure` and present incoming `structure` is strict `enrich`;
4. a later valid source revision atomically replaces summary and every mapped child;
5. an earlier revision preserves the complete visible record;
6. equal or unorderable revision evidence with different content is a conflict and changes no visible child.

Mapping-set compatibility participates in whole-ZIP exact-repeat reuse. Reimporting identical bytes under a
new structural mapping must execute reconciliation, enrich previously unevaluated sessions, and avoid
duplicate children.

## Known loss and compatibility

Version 1 has no route, coordinates, zones, samples, heart-rate series, speed or pace series, altitude series,
power series, cadence series, user-authored segments, notes, targets, devices, or provider analysis. These are
not represented as empty collections. Their later introduction requires explicit canonical and read-model
contracts with resource and privacy boundaries.

Changing assessment-state meaning, collection optionality, identity, order, units, time interpretation,
reconciliation, or an invariant requires a new canonical version.
