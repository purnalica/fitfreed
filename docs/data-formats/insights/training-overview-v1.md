# Training Overview Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for training-session overview, range filtering, and detail. The application derives this disposable read model from [canonical training-session summary version 1](../canonical/training-session.md). It is not canonical history, portable export, or a persistence schema.

The Tauri `query_training_overview` command accepts JSON conforming to [`training-overview-query-v1.schema.json`](../../../schemas/training-overview-query-v1.schema.json) and returns JSON conforming to [`training-overview-v1.schema.json`](../../../schemas/training-overview-v1.schema.json). Presentation reads detail from the selected overview; it does not query a provider record or a persistence table.

## Query and ranges

The command accepts `requestedRange`, either null or an object with `from` and `through`.

- Null selects at most the latest 30 inclusive local calendar dates ending at the latest training-session start date.
- An object selects the stated inclusive range.
- Dates use canonical `YYYY-MM-DD`, `from` is not later than `through`, both endpoints lie inside `availableRange`, and an explicit range contains at most 366 dates.
- Invalid syntax, ordering, bounds, or length returns `invalid-training-range` before origins or facts are queried.
- A library without training sessions returns null `availableRange` and `selectedRange` with an empty `series` array.

`availableRange` covers the earliest through latest canonical `startedAtLocal` date across all origins. `selectedRange` is the validated range used for every series. Each `series` belongs to one opaque, library-local `seriesRef`, is ordered by that reference, and is never combined with another origin. Presentation uses an ordinal label and does not expose the value.

## Summary and measurement coverage

Each series contains `summary` and `sessions`. Summary fields are:

| Field | Contract |
|---|---|
| `calendarDays` | Inclusive selected-range length. |
| `trainingDays` | Distinct local start dates containing at least one session. Absence on another date means no session was recorded; it is not a missing daily observation. |
| `sessionCount` | Number of sessions in the series and selected range. |
| `totalDurationMilliseconds` | Exact sum of every required declared duration, encoded as unsigned decimal text. |
| `distanceSessionCount` | Sessions whose aggregate distance is available. |
| `totalDistanceMeters` | Sum of available finite distances, or null when `distanceSessionCount` is zero. |
| `energySessionCount` | Sessions whose aggregate energy is available. |
| `totalEnergyKilocalories` | Exact sum of available energy values as unsigned decimal text, or null when `energySessionCount` is zero. |
| `heartRateSessionCount` | Sessions with an average or maximum heart-rate value. No cross-session heart-rate average is inferred. |

Distance and energy totals always travel with their coverage counts. A total never implies complete measurement coverage. Aggregates preserve origins and do not impute unavailable values.

## Session detail

Sessions are ordered by `startedAtLocal` descending, then `sessionRef`, without duplicate `(seriesRef, sessionRef)` identities. Each contains `sessionRef`, `startedAtLocal`, `stoppedAtLocal`, `utcOffsetMinutes`, `durationMilliseconds`, `distanceMeters`, `energyKilocalories`, `averageHeartRateBpm`, `maximumHeartRateBpm`, `sportRef`, and `exerciseCount` with the semantics of the canonical contract.

Required and optional integer measurements are encoded as decimal text so JavaScript cannot round them. Distance remains a finite JSON number because the canonical value is binary64. `sessionRef` and `sportRef` are transport-only opaque references. Presentation never displays either as a user-facing identifier or sport name. Until a separately documented catalogue mapping exists, it uses neutral localized training language.

## Validation and compatibility

The application rejects empty or duplicate origins, unknown origins, duplicate session identities, sessions outside the requested range, invalid local date-times, negative or non-finite measurements, inconsistent heart rates, and empty opaque references. A range with no sessions still returns a zero-valued series for every known training origin; it does not masquerade as an empty library.

Changing fields, ordering, aggregation, range limits, numeric encoding, null meaning, origin separation, or opaque-reference behavior requires a new read-model version. Application, SQLite, transport, component, packaged E2E, accessibility, and performance tests protect this contract.
