# Nightly Recovery Comparison Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for comparing two nightly recovery periods. It derives from [nightly recovery overview version 1](nightly-recovery-overview-v1.md) and shares its measurement, gap, coverage, origin, and numeric-encoding rules. It is not canonical history, a medical assessment, or a provider readiness model.

The Tauri `query_recovery_comparison` command accepts JSON conforming to [`recovery-comparison-query-v1.schema.json`](../../../schemas/recovery-comparison-query-v1.schema.json) and returns JSON conforming to [`recovery-comparison-v1.schema.json`](../../../schemas/recovery-comparison-v1.schema.json).

## Query

The request contains inclusive `baselineRange` and `comparisonRange` objects, each with `from` and `through`. Every range independently uses canonical dates, ordered endpoints inside `availableRange`, and at most 366 dates. Invalid input returns `invalid-recovery-range` before origins or facts are queried.

A library without nightly recovery returns null `availableRange`, `baselineRange`, and `comparisonRange` with an empty `series` array. Otherwise, both requested ranges are returned exactly.

## Series and summaries

Every opaque `seriesRef` has a `baseline` and `comparison` summary. Each summary preserves `calendarDays`, `observedNights`, `missingNights`, `averageBeatToBeatIntervalMilliseconds`, `rmssdNightCount`, `averageHeartRateVariabilityRmssdMilliseconds`, `averageBreathingIntervalMilliseconds`, `assessmentNightCount`, `baselineNightCount`, and `guidanceNightCount` exactly as defined by the overview contract.

The two ranges may have different lengths. Counts and missing coverage therefore remain explicit rather than normalizing, truncating, aligning weekdays, or imputing observations.

## Changes

The response calculates comparison minus baseline for:

- `observedNightChange` and `missingNightChange`;
- `averageBeatToBeatIntervalMillisecondsChange`;
- `averageHeartRateVariabilityRmssdMillisecondsChange`;
- `averageBreathingIntervalMillisecondsChange`;
- `assessmentNightChange`, `baselineNightChange`, and `guidanceNightChange`.

All changes are exact signed decimal text. An average change is null unless both summaries have that average. Counts always produce a signed change. Source-specific ordinal `autonomicStatus`, `overallStatus`, `overallSublevel`, and `autonomicCharge` are not compared or averaged.

The read model exposes association and change, not causation, diagnosis, training advice, or a provider-neutral recovery score.

## Compatibility

Changing range rules, summary calculations, difference direction, null semantics, decimal encoding, source-specific exclusions, or origin separation requires a new comparison version.
