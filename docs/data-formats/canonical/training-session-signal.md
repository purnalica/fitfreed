# Canonical Training-Session Signal Version 1

## Status and authority

This is the normative provider-neutral contract for regularly sampled measurements below a FitFreed
training-session exercise. It extends the [training-session summary](training-session.md) and references the
exercise identities defined by [training-session structure](training-session-structure.md). Signal evidence
does not replace the aggregate summary, recorded laps, routes, zones, or user-authored segments.

## Assessment and collection states

`TrainingSessionRecord.signals` has distinct evidence states:

- null means no compatible signal mapping evaluated the persisted session;
- a present assessment with null `exercises` means the source exercise collection was absent;
- a present assessment with an empty `exercises` collection means the source supplied no exercises;
- every assessed exercise retains the structural `exerciseId` and `ordinal` and has an optional `signals`
  value;
- null exercise `signals` means the source signal container was absent;
- present `signals` retains independent optional `primary` and `transition` series collections;
- null series collection means the source collection was absent, while an empty collection means it was
  present-empty.

`unsupportedPrimarySeriesCount` and `unsupportedTransitionSeriesCount` report source series that the active
mapping deliberately did not promote to canonical measurement meaning. They are compatibility evidence, not
empty canonical series. The counts are non-negative and do not expose provider type tokens or values.

## Signal vocabulary

Version 1 defines only numeric measurements with established units.

| `TrainingSignalKind` code | Required `TrainingSignalUnit` code | Meaning |
|---|---|---|
| `heart-rate` | `beats-per-minute` | Heart rate in beats per minute. |
| `speed` | `kilometers-per-hour` | Speed in kilometres per hour. |
| `distance` | `meters` | Cumulative recorded distance in metres. |
| `altitude` | `meters` | Recorded altitude in metres. |
| `cadence` | `rotations-per-minute` | Recorded cadence in rotations per minute. |
| `temperature` | `degrees-celsius` | Recorded device or environmental temperature in degrees Celsius. |
| `left-crank-power` | `watts` | Power explicitly attributed to the left crank in watts; it is not relabeled as whole-system power. |

Kind and unit must be one of the exact pairs above. A mapping cannot use a known unit to invent a meaning for
an unknown provider series. Extending the vocabulary requires a canonical contract revision and localized
presentation.

## Entities

### `TrainingSignalSample`

| Field | Type | Required | Semantics |
|---|---|---|---|
| `ordinal` | non-negative integer | yes | Zero-based contiguous source slot. |
| `value` | finite binary64 or null | yes | Exact mapped measurement; null preserves an explicitly unavailable source slot. |

An unavailable slot remains part of the series and its timing. It is not removed, converted to zero, carried
forward, or interpolated.

### `TrainingSignalSeries`

| Field | Type | Required | Semantics |
|---|---|---|---|
| `ordinal` | non-negative integer | yes | Zero-based contiguous order inside the mapped collection after unsupported series are reported; relative source order is preserved. |
| `kind` | `TrainingSignalKind` | yes | Provider-neutral measurement meaning. |
| `unit` | `TrainingSignalUnit` | yes | Exact canonical unit required by `kind`. |
| `intervalMilliseconds` | positive signed 64-bit integer | yes | Regular source interval between adjacent slots. |
| `samples` | ordered sample collection | yes | Every source slot, including unavailable values. |

Elapsed time for sample ordinal `n` is exactly `n * intervalMilliseconds`. The product must fit a signed
64-bit integer. The interval is source evidence, not inferred from exercise duration or sample count.

Series identity is `(originId, sessionId, exerciseId, role, ordinal)`, where role is `primary` or
`transition`. Multiple series may have the same kind; source order remains authoritative and no series are
silently merged.

### `TrainingSignals`

`primary` describes measurements attributed to the exercise itself. `transition` describes measurements
explicitly attributed to a transition in a multisport-compatible source structure. FitFreed never appends a
transition series to a primary series or invents continuity between them.

### Assessments

`TrainingExerciseSignalAssessment` contains `exerciseId`, matching `ordinal`, and optional `signals`.
`TrainingSessionSignalAssessment` contains the optional ordered `exercises` collection. Assessment exercise
identity and order must exactly match the same session's structural assessment whenever both are present.

## Projection and exact evidence

Canonical storage retains every mapped sample slot. A visual projection may select a deterministic bounded
subset, but each selected item retains its exact original ordinal, elapsed time, and value. It also carries
derived gap evidence whenever an unavailable source slot exists after the preceding selected ordinal and no
later than the current selected ordinal. The projection is derived evidence and cannot replace canonical
data. Exact ordered samples remain available through stable pagination.

Charts must preserve unavailable gaps, name kind and unit, and provide an exact table alternative. They do
not smooth, fill, rescale into an undocumented unit, or imply medical interpretation.

## Reconciliation

Reconciliation applies atomically to the complete `TrainingSessionRecord`:

1. a new session creates summary and every evaluated child assessment together;
2. complete record equality is equivalent;
3. an equal persisted field or a previously unevaluated field becoming evaluated is strict `enrich` when no
   evaluated field regresses or changes;
4. a later valid source revision replaces summary and every mapped child atomically;
5. an earlier revision preserves the complete visible record;
6. equal or unorderable revision evidence with changed evaluated content is a conflict.

Mapping-aware exact reimport must reassess identical bytes when signal support becomes active and must never
create a duplicate session, exercise, series, or sample.

## Privacy and compatibility

Signal values are sensitive local fitness data. Import, persistence, queries, and rendering perform no
external request. Export, MCP exposure, telemetry, and provider synchronization require separate explicit
authority.

Version 1 does not define RR intervals, movement-state codes, advanced pedal dynamics other than explicit
left-crank power, body temperature, irregular samples, zones, statistics, route alignment, medical meaning,
or user-authored segments. Those values remain counted as unsupported mapping evidence where applicable.
Adding one of those meanings or changing identity, roles, units, unavailable-value semantics, timing,
assessment states, or reconciliation requires a new canonical version.
