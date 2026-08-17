# Nightly Recovery Overview and Detail Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for nightly recovery measurements, source-specific interpretation coverage, gaps, and exact drill-down. The application derives this disposable read model from [canonical nightly recovery version 1](../canonical/nightly-recovery.md). It is not canonical history, a medical assessment, a provider contract, a portable export, or a persistence schema.

The Tauri `query_recovery_overview` command accepts JSON conforming to [`recovery-overview-query-v1.schema.json`](../../../schemas/recovery-overview-query-v1.schema.json) and returns JSON conforming to [`recovery-overview-v1.schema.json`](../../../schemas/recovery-overview-v1.schema.json). The `query_recovery_detail` command accepts [`recovery-detail-query-v1.schema.json`](../../../schemas/recovery-detail-query-v1.schema.json) and returns [`recovery-detail-v1.schema.json`](../../../schemas/recovery-detail-v1.schema.json).

## Query and ranges

The overview command accepts `requestedRange`, either null or an object with `from` and `through`.

- Null selects at most the latest 30 inclusive source-assigned `recoveryDate` values ending at the latest available date.
- An object selects the stated inclusive range.
- Dates use canonical `YYYY-MM-DD`, `from` is not later than `through`, both endpoints lie inside `availableRange`, and an explicit range contains at most 366 dates.
- Invalid syntax, ordering, bounds, or length returns `invalid-recovery-range` before origins or facts are queried.
- A library without recovery nights returns null `availableRange` and `selectedRange` with an empty `series` array.

`availableRange` covers the earliest through latest canonical `recoveryDate` across every origin. `selectedRange` is used for every series. Each series belongs to one opaque library-local `seriesRef`, is ordered by that reference, and is never merged with another origin. Presentation uses an ordinal label and never exposes the reference.

## Nights and gaps

Each series contains one `days` item for every selected calendar date, ordered ascending:

- `availability` `available` carries one `recovery` observation;
- `availability` `missing` carries a null `recovery` and means no canonical nightly recovery exists for that origin and source-assigned date.

Missing does not mean zero recovery, poor recovery, illness, or absence of related data in another artifact family. No gap is imputed.

An available recovery exposes exact `beatToBeatIntervalMilliseconds`, optional `heartRateVariabilityRmssdMilliseconds`, and exact `breathingIntervalMilliseconds`. Integer measurements are decimal text so JavaScript cannot round them. FitFreed does not derive heart rate, breathing rate, readiness, diagnosis, or medical meaning from these intervals.

Optional `sourceAssessment` contains the source-declared `scheme`, `autonomicCharge`, `autonomicStatus`, `overallStatus`, and exact decimal-text `overallSublevel`. These ordinal and source-specific values are presented as recorded; they are not averaged or translated into provider-neutral health labels. `sourceBaselineAvailable` and `sourceGuidanceAvailable` report group coverage without transporting complete source-specific baseline values or guidance text in a range response.

## Summary and measurement coverage

Each `summary` contains:

| Field | Contract |
|---|---|
| `calendarDays` | Inclusive selected-range length. |
| `observedNights` | Dates with canonical nightly recovery. |
| `missingNights` | `calendarDays - observedNights`. |
| `averageBeatToBeatIntervalMilliseconds` | Half-up rounded mean across observed nights, or null. |
| `rmssdNightCount` | Observed nights with `heartRateVariabilityRmssdMilliseconds`. |
| `averageHeartRateVariabilityRmssdMilliseconds` | Half-up rounded mean across RMSSD-bearing nights, or null. |
| `averageBreathingIntervalMilliseconds` | Half-up rounded mean across observed nights, or null. |
| `assessmentNightCount` | Observed nights with complete `sourceAssessment`. |
| `baselineNightCount` | Observed nights with complete source-specific baseline data. |
| `guidanceNightCount` | Observed nights with complete source-specific guidance. |

Optional aggregates always travel with their coverage count. Missing values are never imputed, and an aggregate never implies complete coverage. Source assessment statuses and sublevels are deliberately excluded from aggregation because their scale is source-specific and ordinal.

## Detail

`query_recovery_detail` accepts a non-blank `seriesRef` and canonical `recoveryDate`. It returns null when that exact identity is absent. A present result carries the three canonical measurements and the complete optional `sourceAssessment`, `sourceBaseline`, and `sourceGuidance` groups without returning the origin reference.

`sourceBaseline` contains its source `scheme`, `meanBeatToBeatIntervalMilliseconds`, `standardDeviationBeatToBeatIntervalMilliseconds`, optional paired `meanHeartRateVariabilityRmssdMilliseconds` and `standardDeviationHeartRateVariabilityRmssdMilliseconds`, `meanBreathingIntervalMilliseconds`, and `standardDeviationBreathingIntervalMilliseconds`. `sourceGuidance` contains its source `scheme` and the source-provided `exercise`, `sleep`, and `vitality` text. Guidance is informational source content, not advice authored or endorsed by FitFreed.

The application rejects a blank reference, invalid date, mismatched identity, invalid measurements, incomplete optional groups, non-finite or out-of-range source assessment fields, and blank or oversized guidance. Invalid input returns `invalid-recovery-reference`; invalid library facts return `library-query-failed`.

Separating detail prevents a 366-day overview from repeatedly transporting source guidance and baseline values. Presentation requests detail only after an available night is selected and discards stale responses when selection changes.

## Compatibility

Changing fields, ordering, gap meaning, calculations, range limits, numeric encoding, origin separation, detail identity, source-specific semantics, or null behavior requires a new read-model version. Application, SQLite, transport, schema, component, packaged E2E, accessibility, and performance tests protect this contract.
