# Training Comparison Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for comparing two training periods. It uses the same origin catalog, indexed canonical facts, validation, summary semantics, and exact-number encoding as [training overview version 1](training-overview-v1.md).

The Tauri `query_training_comparison` command accepts [`training-comparison-query-v1.schema.json`](../../../schemas/training-comparison-query-v1.schema.json) and returns [`training-comparison-v1.schema.json`](../../../schemas/training-comparison-v1.schema.json).

## Query and response

The query contains `baselineRange` and `comparisonRange`. Each range has canonical `from` and `through` dates, lies inside `availableRange`, is ordered, and contains at most 366 inclusive dates. Periods may overlap and have different lengths. Invalid input returns `invalid-training-range` before facts are queried.

The response contains `availableRange`, the validated `baselineRange` and `comparisonRange`, and one independently calculated series per ordered opaque `seriesRef`. An empty library returns null ranges and no series. Each series contains complete `baseline` and `comparison` summaries plus:

| Field | Contract |
|---|---|
| `sessionCountChange` | `comparison.sessionCount - baseline.sessionCount` as exact signed decimal text. |
| `trainingDayChange` | `comparison.trainingDays - baseline.trainingDays` as exact signed decimal text. |
| `durationMillisecondsChange` | `comparison.totalDurationMilliseconds - baseline.totalDurationMilliseconds` as exact signed decimal text. |
| `distanceMetersChange` | Comparison distance total minus baseline distance total, or null unless both totals exist. |
| `energyKilocaloriesChange` | Comparison energy total minus baseline energy total as exact signed decimal text, or null unless both totals exist. |

Signed decimal text uses `0`, never negative zero or a leading plus sign. A distance or energy change is shown only with both periods' `sessionCount`, `distanceSessionCount`, `energySessionCount`, and `heartRateSessionCount`, so partial measurement coverage remains visible. The model does not normalize unequal period lengths, infer missing values, calculate physiological significance, or claim causality.

## Presentation and compatibility

Presentation renders a visual comparison and an exact accessible table, identifies both date ranges, labels origins ordinally, preserves the previous valid result on invalid input, and clears only the disposable comparison result. It never exposes `seriesRef` or `sportRef` as user-facing names.

Changing range limits, subtraction direction, summary meaning, measurement-coverage disclosure, numeric encoding, null behavior, or origin separation requires a new comparison version. Application, transport, component, and packaged E2E tests protect positive, zero, negative, unavailable, unequal-period, multi-origin, and empty-library behavior.
