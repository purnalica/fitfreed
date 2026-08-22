# Polar Flow Training-Session Mapping

## Status

This is the normative anti-corruption-layer contract for mapping a compatible Polar Flow personal-data-export
training-session artifact into [canonical training-session summary version 1](../canonical/training-session.md)
and the independent [training-session structure](../canonical/training-session-structure.md) and
[training-session route](../canonical/training-session-route.md) and
[training-session signal](../canonical/training-session-signal.md) and
[training-session zone](../canonical/training-session-zone.md) contracts.

- Source provider: `polar-flow`
- Source adapter version introducing summary support: `polar-flow-archive@4`
- Source adapter version introducing structural support: `polar-flow-archive@7`
- Source adapter version introducing route support: `polar-flow-archive@8`
- Source adapter version introducing signal support: `polar-flow-archive@9`
- Source adapter version introducing zone support: `polar-flow-archive@10`
- Source adapter version introducing observed minute-precision pause compatibility: `polar-flow-archive@11`
- Current source adapter version: `polar-flow-archive@11`
- Historical summary mapping: `polar-flow-training-session@1`
- Historical summary-and-structure mapping: `polar-flow-training-session@2`
- Historical summary, structure, and route mapping: `polar-flow-training-session@3`
- Historical summary, structure, route, and signal mapping: `polar-flow-training-session@4`
- Historical summary, structure, route, signal, and zone mapping: `polar-flow-training-session@5`
- Current summary, structure, route, signal, and zone mapping: `polar-flow-training-session@6`
- Historical operation mapping sets: `polar-flow-mapping-set@1`, `polar-flow-mapping-set@2`, `polar-flow-mapping-set@3`, `polar-flow-mapping-set@4`, `polar-flow-mapping-set@5`
- Current operation mapping set: `polar-flow-mapping-set@6`
- Source evidence: [Polar Flow personal data export reference](../providers/polar-flow.md)

## Supported artifact boundary

The adapter recognizes the two documented `training-session` filename grammars. Support requires a root JSON
object and the fields below; recognition of a filename is not successful mapping. Unknown object fields are
accepted. A known field with an incompatible type or invalid value, duplicate session or exercise identity,
or a filename timestamp that disagrees with `startTime` rejects the complete package before canonical
visibility changes.

## Aggregate summary mapping

| Source path | Requirement and validation | Canonical outcome |
|---|---|---|
| resolved source subject | exactly one verified package subject | `originId` |
| `identifier.id` | required non-empty string | `sessionId` by exact value |
| `created` | required local-form ISO 8601 date-time with UTC semantics | validated source evidence; not canonical |
| `modified` | required local-form ISO 8601 date-time with UTC semantics | persisted source revision evidence |
| `startTime` | required local-form ISO 8601 date-time whose whole seconds match the filename | `startedAtLocal` |
| `stopTime` | required local-form ISO 8601 date-time | `stoppedAtLocal` |
| `timezoneOffsetMinutes` | absent or signed 32-bit integer | `utcOffsetMinutes`; absence maps to null |
| `durationMillis` | integer from zero through `359999999` | `durationMilliseconds` without derivation |
| `distanceMeters` | absent or finite number from zero through `9999000` | `distanceMeters`; absence maps to null |
| `calories` | absent or non-negative signed 64-bit integer | `energyKilocalories`; absence maps to null |
| `hrAvg` | absent or non-negative signed 64-bit integer | `averageHeartRateBpm`; absence maps to null |
| `hrMax` | absent or non-negative signed 64-bit integer and not below present `hrAvg` | `maximumHeartRateBpm`; absence maps to null |
| `sport.id` | absent or non-empty string | opaque `sportRef`; absence maps to null |
| `exercises` | absent or array | `exerciseCount` is null when absent and otherwise the exact array length |

Top-level values are authoritative for the aggregate summary. The adapter never substitutes one exercise or
sums, averages, selects, or otherwise derives summary values from children.

## Structural assessment and exercise mapping

Mapping versions 2 through 6 always emit a present `TrainingSessionStructure`, proving that the artifact was evaluated
under the structural contract. An absent `exercises` field produces null `exercises`; a present empty array
produces an empty collection. Entries retain source array order through `ordinal`.

| Source exercise path | Requirement and validation | Canonical outcome |
|---|---|---|
| `exercises[].identifier.id` | required non-empty string, unique within the session | protected `exerciseId` |
| `exercises[].created` | required valid local-form ISO 8601 date-time with UTC semantics | validated source evidence; not canonical |
| `exercises[].modified` | required valid local-form ISO 8601 date-time with UTC semantics | validated source evidence; not independent aggregate revision |
| `exercises[].startTime` | required valid local-form ISO 8601 date-time | `startedAtLocal` |
| `exercises[].stopTime` | required valid local-form ISO 8601 date-time not before `startTime` | `stoppedAtLocal` |
| `exercises[].timezoneOffsetMinutes` | absent or signed 32-bit integer | `utcOffsetMinutes`; absence maps to null |
| `exercises[].durationMillis` | integer from zero through `359999999` | `durationMilliseconds` |
| `exercises[].distanceMeters` | absent or finite number from zero through `9999000` | `distanceMeters`; absence maps to null |
| `exercises[].calories` | absent or non-negative signed 64-bit integer | `energyKilocalories`; absence maps to null |
| `exercises[].sport.id` | absent or non-empty string | opaque `sportRef`; absence maps to null |
| `exercises[].laps` | absent or object | absent makes both canonical lap collections null |
| `exercises[].laps.laps` | absent or array | `manualLaps`, preserving absent, present-empty, and source order |
| `exercises[].laps.autoLaps` | absent or array | `automaticLaps`, preserving absent, present-empty, and source order |
| `exercises[].pauseTimes` | absent or array | `pauses`, preserving absent, present-empty, and source order |

Exercise `created` and `modified` values do not override the session's `modified` reconciliation evidence.
Mixed exercise sports remain separate evidence and never change the aggregate `sportRef`.

## Lap and pause mapping

Each `exercises[].laps.laps[]` and `exercises[].laps.autoLaps[]` entry requires integer
`splitTimeMillis` and `durationMillis` from zero through `359999999`. Optional `distanceMeters` must be finite
and between zero and `9999000`. Source order becomes zero-based `ordinal`; the enclosing collection provides
`manual` or `automatic` kind. Source `splitTimeMillis` becomes canonical `splitTimeMilliseconds` and source
`durationMillis` becomes canonical `durationMilliseconds`, both without derivation. No provider lap identifier
is required or invented.

The official correspondence defines `splitTimeMillis` as elapsed from exercise start. The evaluated takeout
uses it as the cumulative end boundary inside each manual or automatic collection: the first split equals the
first duration and each subsequent split equals the preceding split plus the current duration. Version 6 still
stores the two source measurements independently and does not materialize a derived start. A consumer may use
the recorded split as exercise-coordinate evidence; it must not substitute route or signal elapsed values.

Each `exercises[].pauseTimes[]` entry requires valid local-form `startTime` and `endTime`. Observed exports use
both minute (`YYYY-MM-DDTHH:mm`) and second or fractional-second precision within the same pause collection;
minute precision maps to exact second zero. The end must not precede the start. Source order becomes zero-based
`ordinal`; duration is not independently derived or stored.

## Route assessment and waypoint mapping

Mapping versions 3 through 5 always emit a present `TrainingSessionRouteAssessment`. Its `exercises` state exactly
matches the source `exercises` field. Every present exercise receives a route assessment tied to the same
protected `exerciseId` and zero-based `ordinal` as structure.

| Source exercise path | Requirement and validation | Canonical outcome |
|---|---|---|
| `exercises[].routes` | absent or object | null exercise `routes` when absent; present route collection otherwise |
| `exercises[].routes.route` | absent or object | optional `primary` route |
| `exercises[].routes.transitionRoute` | absent or object | optional `transition` route, never merged with primary |
| route `.startTime` | required valid local-form ISO 8601 date-time | `startedAtLocal` |
| route `.wayPoints` | required array | exact ordered `points`, including present-empty |
| `.wayPoints[].latitude` | required finite number from -90 through 90 | `latitudeDegrees` |
| `.wayPoints[].longitude` | required finite number from -180 through 180 | `longitudeDegrees` |
| `.wayPoints[].altitude` | absent or finite number | optional `altitudeMeters` |
| `.wayPoints[].elapsedMillis` | absent or non-negative signed 64-bit integer | optional `elapsedMilliseconds` |

Waypoint source order becomes contiguous zero-based `ordinal`. Present elapsed values must be
non-decreasing even when other points omit the field. Missing values are not interpolated. Empty routes,
one-point routes, repeated points, and primary and transition identity are preserved rather than repaired.
Each present elapsed value remains relative to that route's own recorded `startedAtLocal`; mapping does not
subtract exercise and route local timestamps or relabel the result as exercise elapsed time.

## Signal assessment and interval-series mapping

Mapping versions 4 and 5 always emit a present `TrainingSessionSignalAssessment`. Its `exercises` state exactly
matches the source `exercises` field. Every present exercise receives a signal assessment tied to the same
protected `exerciseId` and zero-based `ordinal` as structure.

| Source exercise path | Requirement and validation | Canonical outcome |
|---|---|---|
| `exercises[].samples` | absent or object | null exercise `signals` when absent; present signal container otherwise |
| `exercises[].samples.samples` | absent or array | optional `primary` mapped series collection |
| `exercises[].samples.transitionSamples` | absent or array | optional `transition` mapped series collection, never merged with primary |
| series `.type` | required string | mapped through the exact vocabulary below or counted as unsupported |
| series `.intervalMillis` | required integer from 1 through `359999999` for a mapped series | `intervalMilliseconds` |
| series `.values[]` | finite number or exact string `NaN` for a mapped series | ordered canonical samples; `NaN` becomes a null `value` slot |

| Source `.type` | Canonical `kind` | Canonical `unit` |
|---|---|---|
| `HEART_RATE` | `heart-rate` | `beats-per-minute` |
| `SPEED` | `speed` | `kilometers-per-hour` |
| `DISTANCE` | `distance` | `meters` |
| `ALTITUDE` | `altitude` | `meters` |
| `CADENCE` | `cadence` | `rotations-per-minute` |
| `TEMPERATURE` | `temperature` | `degrees-celsius` |
| `LEFT_CRANK_CURRENT_POWER` | `left-crank-power` | `watts` |

Mapped series retain relative source order and receive a contiguous zero-based `ordinal` after unsupported
series are excluded. Each source value retains its zero-based slot ordinal. The exact `NaN` marker preserves
an unavailable slot; no other string, non-finite number, interpolation, conversion, or imputation is accepted.
Heart rate, speed, distance, cadence, and left-crank power values must be non-negative. Altitude and
temperature may be negative. The last ordinal multiplied by `intervalMillis` must fit a signed 64-bit integer.

The derived ordinal product is a series-relative coordinate only. The source supplies no series time origin,
and mapping does not assert that ordinal zero equals exercise start, route start, or any source-lap boundary.
Equal numeric route and series offsets therefore remain values in different coordinate systems and are not an
alignment relationship.

An unknown series type is not assigned an invented meaning. It increments
`unsupportedPrimarySeriesCount` or `unsupportedTransitionSeriesCount`, while its provider token and values do
not enter canonical storage or presentation. `rrSamples`, `transitionRrSamples`, and other fields outside the
two regular-series arrays remain deliberately unmapped and are not misreported as regular-series counts.

## Zone assessment and aggregate-band mapping

Mapping version 5 always emits a present `TrainingSessionZoneAssessment`. Its `exercises` state exactly
matches the source `exercises` field. Every present exercise receives a zone assessment tied to the same
protected `exerciseId` and zero-based `ordinal` as structure.

| Source exercise path | Requirement and validation | Canonical outcome |
|---|---|---|
| `exercises[].zones` | absent or array of at most 64 groups | null exercise zones when absent; present zone container otherwise |
| group `.type` | required string | mapped through the exact vocabulary below or counted in `unsupportedGroupCount` |
| group `.zones` | absent or array of at most 256 bands for a supported group | null, present-empty, or exact ordered canonical bands |
| band `.lowerLimit` | required finite non-negative number for a supported group | `lowerLimit` without conversion |
| band `.higherLimit` | required finite number not below `lowerLimit` for a supported group | `higherLimit` without conversion |
| band `inZone` | absent or non-negative signed 64-bit integer | optional `timeInZoneMilliseconds`; absence remains null |
| band `.distanceMeters` | absent or finite non-negative number; accepted only for speed | optional `distanceMeters` without derivation |
| band `.muscleLoad` | absent or finite non-negative number; accepted only for power | optional `muscleLoad` without derivation |

| Source `.type` | Canonical `kind` | Canonical `unit` |
|---|---|---|
| `ZONE_TYPE_HEART_RATE` | `heart-rate` | `beats-per-minute` |
| `ZONE_TYPE_SPEED` | `speed` | `kilometers-per-hour` |
| `ZONE_TYPE_POWER` | `power` | `watts` |

Mapped groups retain relative source order and receive a contiguous zero-based `ordinal` after unsupported
groups are excluded. Bands retain their exact source order. The mapping does not merge groups, reorder bounds,
infer missing aggregates from samples, or treat aggregate time as a temporal interval. Zero is distinct from
an absent value.

`ZONE_TYPE_FIT_FAT` and every other unlisted group type increment `unsupportedGroupCount`. Their provider
tokens and values do not enter canonical storage or presentation. A supported group rejects missing bounds,
reversed or non-finite bounds, negative aggregates, distance outside speed groups, and muscle load outside
power groups. One invalid supported group rejects the complete package before visibility changes.

## Reimport, revision, and mapping upgrade

Identity remains `(originId, identifier.id)`. Reconciliation compares the complete mapped session record:

- absent identity creates summary, structure, route, signal, and zone assessments atomically;
- complete equality is equivalent;
- equal evaluated fields plus previously unevaluated structure, routes, signals, or zones is `enrich` when no
  evaluated field changes or regresses;
- later `modified` evidence atomically replaces summary and every mapped child;
- earlier evidence preserves the complete visible record;
- equal or unorderable revision with different content is a conflict and changes no visible record.

Two artifacts with the same mapped identity in one ZIP are invalid independently of order. Whole-package
exact-repeat reuse requires equal archive fingerprint, adapter version, and operation mapping-set version.
Consequently, a package completed under any earlier mapping set is reassessed under
`polar-flow-mapping-set@6`; identical bytes enrich missing structure, route, signal, or zone evidence without
duplicating sessions, exercises, routes, points, series, samples, groups, or bands. Per-observation provenance
records `polar-flow-training-session@6` for current mapping decisions. Mapping set 6 reassesses packages
previously completed or rejected under mapping set 5 so observed minute-precision pause times can be mapped
without weakening validation of other date-time fields.

## Historical version 1 behavior

`polar-flow-training-session@1`, introduced by `polar-flow-archive@4` and retained through
`polar-flow-archive@6`, mapped only the aggregate table above. It used `exercises` solely to derive
`exerciseCount`: absent mapped to null and an array mapped to its length. Nested objects could therefore omit
all fields because their content was not evaluated. Version 1 deliberately did not create a structural
assessment and used `polar-flow-mapping-set@1` for exact-repeat compatibility.

Historical canonical rows and provenance remain valid. Their null structural assessment is not equivalent to
an absent or empty source collection and is eligible for strict mapping-version enrichment.

## Historical version 2 behavior

`polar-flow-training-session@2`, introduced by `polar-flow-archive@7`, added exercise, lap, and pause
structure under `polar-flow-mapping-set@2`. Route containers and waypoints remained unevaluated. Existing
version-2 rows therefore have null route assessment and are eligible for strict enrichment under version 3
without changing their equal structure or summary.

## Historical version 3 behavior

`polar-flow-training-session@3`, introduced by `polar-flow-archive@8`, added primary and transition route
geometry under `polar-flow-mapping-set@3`. Signal containers and values remained unevaluated. Existing
version-3 rows therefore have null signal assessment and are eligible for strict enrichment under version 4
without changing their equal summary, structure, or route evidence.

## Historical version 4 behavior

`polar-flow-training-session@4`, introduced by `polar-flow-archive@9`, added primary and transition regular
signal series under `polar-flow-mapping-set@4`. Zone groups and bands remained unevaluated. Existing version-4
rows therefore have null zone assessment and are eligible for strict enrichment under version 5 without
changing their equal summary, structure, route, or signal evidence.

## Deliberately unmapped information

Mapping version 5 still does not persist:

- session- or exercise-level standalone `latitude` and `longitude` fields outside route waypoints;
- values or provider tokens from unsupported regular series;
- `rrSamples`, `transitionRrSamples`, irregular samples, or other non-regular signal structures;
- provider values from unsupported zone groups, detailed statistics, hills, tests, and source analysis;
- names, notes, comments, feelings, targets, training benefit, training load, or recovery time;
- energy-source percentages, physical information, devices, products, or application references.

These fields are not represented as empty canonical collections. Their source bytes remain only in the user's
original archive. The artifact is `supported` when all mapping-version-5 fields pass; coverage and UI disclose
the current boundary without exposing locators, identifiers, coordinates, notes, or personal values.

## Sport limitation

Both aggregate and exercise `sport.id` values refer to Polar's separately managed catalogue. The evaluated
takeout has no authoritative identifier-to-name join. FitFreed retains exact references only as opaque
same-source classification evidence and applies a user-authored provider-neutral classification separately.
It never guesses a label or equates a reference with another provider's taxonomy.
