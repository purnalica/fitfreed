# Sleep Comparison Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for comparing two sleep periods. It uses the origin catalog, indexed canonical facts, validation, summary semantics, and exact-number encoding defined by [sleep overview version 1](sleep-overview-v1.md).

The Tauri `query_sleep_comparison` command accepts [`sleep-comparison-query-v1.schema.json`](../../../schemas/sleep-comparison-query-v1.schema.json) and returns [`sleep-comparison-v1.schema.json`](../../../schemas/sleep-comparison-v1.schema.json).

## Query and response

The query contains `baselineRange` and `comparisonRange`. Each range has canonical `from` and `through` dates, lies inside `availableRange`, is ordered, and contains at most 366 inclusive dates. Periods may overlap and have different lengths. Invalid input returns `invalid-sleep-range` before origins or facts are queried.

The response contains `availableRange`, the validated `baselineRange` and `comparisonRange`, and one independently calculated series per ordered opaque `seriesRef`. An empty library returns null ranges and no series. Each series contains complete `baseline` and `comparison` summaries plus:

| Field | Contract |
|---|---|
| `observedNightChange` | `comparison.observedNights - baseline.observedNights` as exact signed decimal text. |
| `missingNightChange` | `comparison.missingNights - baseline.missingNights` as exact signed decimal text. |
| `averageAsleepMillisecondsChange` | Comparison average minus baseline average as exact signed decimal text, or null unless both averages exist. |
| `averageInterruptionMillisecondsChange` | Comparison average minus baseline average as exact signed decimal text, or null unless both averages exist. |
| `averageEfficiencyPercentagePointChange` | Comparison average efficiency minus baseline average, or null unless both exist. |
| `averageOverallScoreChange` | Comparison average overall score minus baseline average, or null unless both exist. |
| `goalMetPercentagePointChange` | Difference between goal-met percentages, or null unless both periods have at least one goal-bearing night. |

Signed decimal text uses `0`, never negative zero, a leading plus sign, or leading zeroes. Duration and score changes use per-observation averages so an unequal range does not turn calendar length alone into an apparent sleep change. The full summaries retain calendar length, missing nights, phase coverage, score coverage, goal coverage, and power-status coverage.

The model does not impute missing nights or scores, compare phase totals with partial coverage, infer physiological significance, normalize provider algorithms, or claim causality.

## Presentation and compatibility

Presentation renders a visual comparison and an exact accessible table, identifies both ranges, labels origins ordinally, preserves the previous valid result on invalid input, and clears only the disposable comparison result. It never exposes `seriesRef` as a user-facing identity.

Changing subtraction direction, averaging, coverage disclosure, numeric encoding, null behavior, range limits, or origin separation requires a new comparison version.
