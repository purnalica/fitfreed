# Sleep Overview Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for sleep-period trends, gaps, summary coverage, and drill-down. The application derives this disposable read model from [canonical sleep period version 1](../canonical/sleep-period.md). It is not canonical history, a provider contract, a portable export, or a persistence schema.

The Tauri `query_sleep_overview` command accepts JSON conforming to [`sleep-overview-query-v1.schema.json`](../../../schemas/sleep-overview-query-v1.schema.json) and returns JSON conforming to [`sleep-overview-v1.schema.json`](../../../schemas/sleep-overview-v1.schema.json). The `query_sleep_detail` command accepts [`sleep-detail-query-v1.schema.json`](../../../schemas/sleep-detail-query-v1.schema.json) and returns [`sleep-detail-v1.schema.json`](../../../schemas/sleep-detail-v1.schema.json).

## Query and ranges

The overview command accepts `requestedRange`, either null or an object with `from` and `through`.

- Null selects at most the latest 30 inclusive source-assigned `sleepDate` values ending at the latest available date.
- An object selects the stated inclusive range.
- Dates use canonical `YYYY-MM-DD`, `from` is not later than `through`, both endpoints lie inside `availableRange`, and an explicit range contains at most 366 dates.
- Invalid syntax, ordering, bounds, or length returns `invalid-sleep-range` before origins or facts are queried.
- A library without sleep periods returns null `availableRange` and `selectedRange` with an empty `series` array.

`availableRange` covers the earliest through latest canonical `sleepDate` across every origin. `selectedRange` is used for every series. Each series belongs to one opaque library-local `seriesRef`, is ordered by that reference, and is never merged with another origin. Presentation uses an ordinal label and never exposes the reference.

## Nights and gaps

Each series contains one `days` item for every selected calendar date, ordered ascending:

- `availability` `available` carries one `period`;
- `availability` `missing` carries a null `period` and means no canonical primary sleep period exists for that origin and source-assigned date.

Missing does not mean zero sleep, no sleep, poor sleep, or absence of sleep-related content in another artifact family. In particular, the model does not promote an activity-family sleep summary into a primary sleep period.

An available period exposes `startedAt`, `endedAt`, `spanMilliseconds`, `asleepMilliseconds`, `interruptionMilliseconds`, `longInterruptionMilliseconds`, `shortInterruptionMilliseconds`, `interruptionCount`, `longInterruptionCount`, `shortInterruptionCount`, `efficiencyPercent`, `continuityIndex`, `continuityClass`, `sleepGoalMilliseconds`, `selfReportedRating`, `cycleCount`, `recordingEndedByPowerLoss`, `phaseSummary`, `stageTimelineAvailable`, `scoreOverall`, and `scoreRelativeRating` with canonical meaning. Integer measurements are decimal text so JavaScript cannot round them.

## Summary and measurement coverage

Each `summary` contains:

| Field | Contract |
|---|---|
| `calendarDays` | Inclusive selected-range length. |
| `observedNights` | Dates with a canonical primary sleep period. |
| `missingNights` | `calendarDays - observedNights`. |
| `totalAsleepMilliseconds` | Exact total for observed nights, or null when none exist. |
| `averageAsleepMilliseconds` | Half-up rounded mean across observed nights, or null. |
| `totalInterruptionMilliseconds` | Exact total for observed nights, or null. |
| `averageInterruptionMilliseconds` | Half-up rounded mean across observed nights, or null. |
| `averageEfficiencyPercent` | Arithmetic mean across observed nights, or null. |
| `phaseNightCount` | Observed nights with `phaseSummary`. |
| `phaseTotals` | Exact phase totals across those nights, or null when the coverage count is zero. |
| `stageTimelineNightCount` | Observed nights whose stage timeline is available, including an explicitly empty timeline. |
| `scoreNightCount` | Observed nights with a score set. |
| `averageOverallScore` | Arithmetic mean across score-bearing nights, or null. |
| `goalNightCount` | Observed nights with a sleep goal. |
| `goalMetNightCount` | Goal-bearing nights where asleep duration is at least the goal. |
| `powerStatusNightCount` | Observed nights with known recording power-loss status. |
| `powerLossNightCount` | Nights within that coverage where power loss ended the recording. |

Optional aggregates always travel with their coverage count. Missing values are never imputed and an aggregate never implies complete coverage.

## Detail

`query_sleep_detail` accepts a non-empty `seriesRef` and canonical `sleepDate`. It returns null when that exact identity is absent. A present result carries every canonical summary field, the complete optional `phaseSummary`, ordered `stageTransitions`, and complete optional `score` without returning the origin reference.

The application rejects an empty reference, invalid date, mismatched identity, malformed boundaries, arithmetic violations, invalid optional groups, out-of-order transitions, and values outside canonical ranges. Invalid input returns `invalid-sleep-reference`; invalid library facts return `library-query-failed`.

Separating detail prevents a 366-day overview from transporting every high-resolution transition. Presentation requests detail only after an available night is selected and discards stale responses when selection changes.

## Compatibility

Changing fields, ordering, gap meaning, calculations, range limits, numeric encoding, origin separation, detail identity, or null semantics requires a new read-model version. Application, SQLite, transport, component, packaged E2E, accessibility, and performance tests protect this contract.
