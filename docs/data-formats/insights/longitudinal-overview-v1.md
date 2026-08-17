# Longitudinal Overview and Comparison Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for aligning daily activity, training, sleep, and nightly recovery on one calendar range without merging observation origins. It composes the established domain read models under [ADR 0007](../../architecture/decisions/0007-compose-longitudinal-insights-by-origin-and-date.md). It is a disposable report, not canonical history, a persistence format, a readiness score, medical interpretation, training advice, or evidence of causation.

The Tauri `query_longitudinal_overview` command accepts [`longitudinal-overview-query-v1.schema.json`](../../../schemas/longitudinal-overview-query-v1.schema.json) and returns [`longitudinal-overview-v1.schema.json`](../../../schemas/longitudinal-overview-v1.schema.json). The `query_longitudinal_comparison` command accepts [`longitudinal-comparison-query-v1.schema.json`](../../../schemas/longitudinal-comparison-query-v1.schema.json) and returns [`longitudinal-comparison-v1.schema.json`](../../../schemas/longitudinal-comparison-v1.schema.json).

## Global range

`availableRange` is the earliest through latest date represented by any canonical daily-activity observation, local training start, source-assigned sleep date, or source-assigned recovery date. Null `requestedRange` selects at most the latest 30 inclusive dates ending at that global latest date. An explicit range uses canonical `YYYY-MM-DD`, has ordered endpoints inside `availableRange`, and contains at most 366 dates.

The comparison request carries `baselineRange` and `comparisonRange`. Each is independently validated against the same global range and may have a different length. Invalid syntax, ordering, bounds, or length returns `invalid-longitudinal-range` before origin catalogs or facts are queried.

When all four histories are empty, overview returns null `availableRange` and `selectedRange`, and comparison returns null `availableRange`, `baselineRange`, and `comparisonRange`; both return an empty `series` array. A domain with bounds but no origins, origins but no bounds, blank or duplicate origins, invalid facts, or a projection that cannot align to the common series and dates returns `library-query-failed` rather than a partial result.

## Origin composition

The series catalog is the ordered union of opaque observation origins represented by any of the four domains. Each `seriesRef` remains library-local transport identity. Presentation uses an ordinal source label and never displays the reference.

Every domain model receives the same selected range and union catalog. A source represented only in some domains therefore still receives one independent series; its other domains contain their normal gaps or zero training-event counts. Dates and values from different origins are never merged.

## Daily alignment

Every series contains one `days` item for every selected calendar date in ascending order. Its `localDate` is the shared alignment key:

| Component | Exact aligned content |
|---|---|
| `activity` | `availability` `available`, `unavailable`, or `missing`, plus decimal-text `stepCount` only when available. |
| `training` | Exact `sessionCount` and decimal-text sum of declared `totalDurationMilliseconds`; zero sessions is an event count, not missing data. |
| `sleep` | `availability` `available` or `missing`, plus decimal-text `asleepMilliseconds` only when available. |
| `recovery` | `availability` `available` or `missing`, plus decimal-text `beatToBeatIntervalMilliseconds`, optional `heartRateVariabilityRmssdMilliseconds`, and `breathingIntervalMilliseconds` only when available. |

Activity uses its canonical local date. Training uses the local date portion of its validated `startedAtLocal`. Sleep and recovery retain their independently source-assigned dates. The projection does not shift, infer, or reconcile these labels from timestamps in another domain.

Each series also carries `activity`, `training`, `sleep`, and `recovery` summaries exactly as defined by their current overview contracts. Reusing those summaries preserves their distinct gap, optional-measurement coverage, aggregation, rounding, and source-specific exclusion rules. Full sessions, sleep periods and timelines, recovery assessment, baseline, guidance, and provenance remain in their authoritative domain explorers.

## Comparison

Each comparison series contains four domain components. Every component carries its exact `baseline` and `comparison` summary plus comparison-minus-baseline changes already defined by the corresponding domain contract:

- activity: `totalStepChange` and `averageStepChange`;
- training: `sessionCountChange`, `trainingDayChange`, `durationMillisecondsChange`, `distanceMetersChange`, and `energyKilocaloriesChange`;
- sleep: `observedNightChange`, `missingNightChange`, `averageAsleepMillisecondsChange`, `averageInterruptionMillisecondsChange`, `averageEfficiencyPercentagePointChange`, `averageOverallScoreChange`, and `goalMetPercentagePointChange`;
- recovery: `observedNightChange`, `missingNightChange`, `averageBeatToBeatIntervalMillisecondsChange`, `averageHeartRateVariabilityRmssdMillisecondsChange`, `averageBreathingIntervalMillisecondsChange`, `assessmentNightChange`, `baselineNightChange`, and `guidanceNightChange`.

Integer facts and changes use exact decimal text so JavaScript cannot round them. An optional aggregate change is null unless both periods contain the required aggregate. Source-specific recovery statuses, sublevels, charge, baseline values, and guidance are not compared. Unequal periods remain unequal; counts and coverage are not normalized, truncated, or imputed.

## Presentation and interpretation

The visual and exact table are alternative encodings of the same `days` values. Selecting a date exposes an exact four-domain synopsis and navigation to the detailed domain explorers. Missing activity, sleep, or recovery means that no canonical observation exists for that origin and assigned date. It never means a zero measurement, poor recovery, illness, or absence of every related source artifact.

The dashboard may reveal co-occurrence. It must not label a change in one domain as the cause of another, derive a provider-neutral recovery or readiness score, or turn source guidance into FitFreed advice.

## Compatibility

Changing global bounds, range limits, origin union, date alignment, daily fields, embedded domain-summary versions, comparison direction, null behavior, numeric encoding, source separation, navigation boundary, or interpretation requires a new longitudinal read-model version.
