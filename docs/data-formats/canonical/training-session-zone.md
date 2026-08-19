# Canonical Training-Session Zone Version 1

## Status and authority

This is the normative provider-neutral contract for `source-recorded` zone distributions below a FitFreed
training-session exercise. It extends the [training-session summary](training-session.md) and references the
exercise identities defined by [training-session structure](training-session-structure.md). A recorded zone
is aggregate source evidence. It is not a temporal interval, a source lap, a FitFreed-derived segment, or a
user-authored criterion.

## Assessment and collection states

`TrainingSessionRecord.zones` has distinct evidence states:

- null means no compatible zone mapping evaluated the persisted session;
- a present assessment with null `exercises` means the source exercise collection was absent;
- a present assessment with an empty `exercises` collection means the source supplied no exercises;
- every assessed exercise retains the structural `exerciseId` and `ordinal` and has an optional `zones`
  value;
- null exercise `zones` means the source zone collection was absent;
- present `zones` retains mapped groups in relative source order, including a present-empty collection.

`unsupportedGroupCount` reports source groups that the active mapping deliberately did not promote to a
canonical zone meaning. It is compatibility evidence, not an empty canonical group. The count is
non-negative and does not expose provider type tokens or values.

## Zone vocabulary

Version 1 defines three numeric zone meanings with exact units.

| `TrainingZoneKind` code | Required `TrainingZoneUnit` code | Meaning |
|---|---|---|
| `heart-rate` | `beats-per-minute` | Heart-rate bounds in beats per minute. |
| `speed` | `kilometers-per-hour` | Speed bounds in kilometres per hour. |
| `power` | `watts` | Power bounds in watts. |

Kind and unit must be one of the exact pairs above. A mapping cannot use a known numeric shape to invent a
meaning for an unknown provider zone type. Extending the vocabulary requires a canonical contract revision
and localized presentation.

## Entities

### `TrainingZone`

| Field | Type | Required | Semantics |
|---|---|---|---|
| `ordinal` | non-negative integer | yes | Zero-based contiguous order inside its mapped group. |
| `lowerLimit` | finite non-negative binary64 | yes | Inclusive recorded lower bound in the group's unit. |
| `higherLimit` | finite non-negative binary64 | yes | Inclusive recorded upper bound in the group's unit; never below `lowerLimit`. |
| `timeInZoneMilliseconds` | non-negative signed 64-bit integer or null | yes | Recorded aggregate time; null means the source did not provide it. |
| `distanceMeters` | finite non-negative binary64 or null | yes | Recorded aggregate distance for a speed zone; null means unavailable. It is null for every other kind. |
| `muscleLoad` | finite non-negative binary64 or null | yes | Recorded aggregate muscle load for a power zone; null means unavailable. It is null for every other kind. |

Zero is an exact recorded value and differs from null. FitFreed does not infer missing time from exercise
duration, missing distance from a route or distance series, or missing muscle load from power samples.

### `TrainingZoneGroup`

| Field | Type | Required | Semantics |
|---|---|---|---|
| `ordinal` | non-negative integer | yes | Zero-based contiguous order among mapped groups; unsupported groups are counted separately and relative supported-group order is preserved. |
| `kind` | `TrainingZoneKind` | yes | Provider-neutral zone meaning. |
| `unit` | `TrainingZoneUnit` | yes | Exact canonical unit required by `kind`. |
| `zones` | ordered zone collection or null | yes | Null preserves an absent source band collection; empty preserves present-empty. |

The same exercise may contain multiple groups of the same kind. Groups are not merged, deduplicated, sorted
by bounds, or normalized. Overlapping or discontinuous source bounds remain exact evidence rather than being
silently repaired.

### Assessments

`TrainingZones` contains ordered mapped `groups` and `unsupportedGroupCount`.
`TrainingExerciseZoneAssessment` contains `exerciseId`, matching `ordinal`, and optional `zones`.
`TrainingSessionZoneAssessment` contains the optional ordered `exercises` collection. Assessment exercise
identity and order must exactly match the same session's structural assessment whenever both are present.

## Presentation and exact evidence

The complete version-1 zone collection is the exact accessible evidence. A visual distribution may scale
only known aggregate time, distance, or muscle-load values within one compatible group and must retain the
exact table alongside it. Unknown aggregate values remain visibly unavailable and do not enter a
denominator. Bounds and units remain explicit.

A zone bar does not encode when the measurements occurred. Presentation must label the evidence as recorded
by the source and must not call the bands phases, intervals, laps, or FitFreed-derived segments. Medical or
training interpretation is outside this contract.

## Reconciliation

Reconciliation applies atomically to the complete `TrainingSessionRecord`:

1. a new session creates summary and every evaluated child assessment together;
2. complete record equality is equivalent;
3. an equal persisted field or a previously unevaluated field becoming evaluated is strict `enrich` when no
   evaluated field regresses or changes;
4. a later valid source revision replaces summary and every mapped child atomically;
5. an earlier revision preserves the complete visible record;
6. equal or unorderable revision evidence with changed evaluated content is a conflict.

Mapping-aware exact reimport must reassess identical bytes when zone support becomes active and must never
create a duplicate session, exercise, group, or band.

## Privacy and compatibility

Zone bounds and distributions are sensitive local fitness data. Import, persistence, queries, and rendering
perform no external request. Export, MCP exposure, telemetry, and provider synchronization require separate
explicit authority.

Version 1 does not define fit-versus-fat zones, provider configuration profiles, zone-lock settings,
calculation methods, temporal alignment with samples, medical meaning, or user-authored zones. Adding one of
those meanings or changing identity, units, missing-value semantics, assessment states, attribution, or
reconciliation requires a new canonical version.
