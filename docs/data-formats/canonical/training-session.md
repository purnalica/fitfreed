# Canonical Training Session Summary Version 1

## Status and authority

This is the normative provider-neutral contract for a FitFreed training-session summary. Version 1 is introduced with Polar Flow mapping version `polar-flow-training-session@1`, but no field or invariant depends on Polar naming or archive layout.

The canonical summary represents one source observation of a training session. It does not claim that observations imported from different providers describe different real-world workouts or the same one. Cross-source composition is a separate, future decision.

## Aggregate and identity

`TrainingSession` is an aggregate root with identity `(originId, sessionId)`:

- `originId` is the non-empty opaque library-local source-subject identity resolved before mapping;
- `sessionId` is a non-empty source-scoped record identifier supplied by the adapter;
- both components compare by exact Unicode scalar sequence;
- neither component is a user-facing label, sport classification, global person identifier, or cross-provider identity;
- an importer must not derive `sessionId` from an archive path, package fingerprint, import order, mutable summary values, or a nested child record.

## Fields

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `originId` | string | yes | Opaque library-local source-subject identity. |
| `sessionId` | string | yes | Opaque source-scoped session identity. |
| `startedAtLocal` | ISO 8601 local date-time | yes | Wall-clock start without an embedded offset or zone. |
| `stoppedAtLocal` | ISO 8601 local date-time | yes | Wall-clock stop without an embedded offset or zone. |
| `utcOffsetMinutes` | signed 32-bit integer or null | yes | Offset from UTC in minutes at the session start; null means unavailable, never zero by default. |
| `durationMilliseconds` | non-negative signed 64-bit integer | yes | Declared session duration. It is independent of the start-to-stop wall-clock difference. |
| `distanceMeters` | finite non-negative IEEE 754 binary64 or null | yes | Aggregate distance in metres; null means unavailable and zero is a measured zero. |
| `energyKilocalories` | non-negative signed 64-bit integer or null | yes | Aggregate expended energy in kilocalories; null means unavailable. |
| `averageHeartRateBpm` | non-negative signed 64-bit integer or null | yes | Average heart rate in beats per minute; null means unavailable. |
| `maximumHeartRateBpm` | non-negative signed 64-bit integer or null | yes | Maximum heart rate in beats per minute; null means unavailable. |
| `sportRef` | non-empty string or null | yes | Opaque source-scoped sport classification reference; null means unavailable. It is not a display name or a cross-provider taxonomy key. |
| `exerciseCount` | non-negative unsigned count or null | yes | Count of declared child exercises; null means the child collection was unavailable. |

All fields are explicit. A missing optional measurement maps to null; it never maps to zero. The canonical model does not carry an unspecified bag of provider fields.

## Invariants

- `startedAtLocal` and `stoppedAtLocal` accept `YYYY-MM-DDTHH:mm:ss` with an optional fractional component of one through nine digits and no embedded offset.
- `durationMilliseconds`, distance, energy, heart-rate values, and `exerciseCount` cannot be negative.
- When both heart-rate fields are present, `averageHeartRateBpm <= maximumHeartRateBpm`.
- Calendar grouping uses the date component of `startedAtLocal` and never the current computer time zone.
- Local start and stop values are temporal evidence, not session identity or an identity tie-breaker. Distinct
  source sessions may legitimately share either value.
- An absolute start instant exists only when `utcOffsetMinutes` is present. It is `startedAtLocal - utcOffsetMinutes`.
- The declared duration is authoritative. It is never recalculated from the local timestamps.
- `sportRef` may support exact same-source grouping but cannot be shown as a human sport name or equated with another provider's classification without a documented catalogue mapping.

## Reconciliation

Reconciliation is scoped to an exact aggregate identity. An importer may supply separately persisted, orderable source-revision evidence; revision metadata is provenance and is not a canonical training fact:

1. an absent identity is created;
2. canonical equality is equivalent, independently of package identity;
3. differing content with later valid source-revision evidence amends the complete visible summary atomically;
4. differing content with earlier valid source-revision evidence is preserved without rolling back the visible summary;
5. differing content with equal or unorderable revision evidence is a conflict and changes no visible summary.

Every decision retains import-operation and source-artifact provenance. Amendment never creates a second visible session with the same identity. Conflict never silently selects archive order.

## Known loss and compatibility

Version 1 summary has no route, coordinates, samples, laps, zones, exercise children, sport display name, note, target, device, product, physical snapshot, training-load interpretation, or provider-specific analysis. Recorded exercise, lap, and pause children are defined separately by [canonical training-session structure version 1](training-session-structure.md); they do not alter this summary's identity, fields, or authority. Importers disclose ignored source information in their mapping specifications.

Readers must ignore future additive fields only when the enclosing representation declares a compatible minor extension. A change to identity, units, null meaning, time interpretation, reconciliation, or an invariant requires a new canonical version.
