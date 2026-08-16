# Daily Activity Comparison Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for comparing two daily-activity periods. The application derives the disposable comparison from [canonical daily activity version 1](../canonical/daily-activity.md) through the same origin catalog and indexed facts used by [daily activity overview version 2](daily-activity-overview-v2.md). It is not canonical history, portable export, or a persistence schema.

The Tauri `query_activity_comparison` command accepts JSON conforming to [`activity-comparison-query-v1.schema.json`](../../../schemas/activity-comparison-query-v1.schema.json) and returns JSON conforming to [`activity-comparison-v1.schema.json`](../../../schemas/activity-comparison-v1.schema.json).

## Query input

The query contains `baselineRange` and `comparisonRange`. Each has canonical local-date `from` and `through` fields, lies within the available daily-activity history, is ordered, and contains at most 366 inclusive calendar days. The periods may overlap and may have different lengths; the response always discloses each period's calendar and availability coverage. Invalid input fails before origins or facts are queried.

## Root and series fields

| Field | Type | Contract |
|---|---|---|
| `availableRange` | date range or null | Earliest and latest canonical daily-activity dates. Null only for an empty library. |
| `baselineRange` | date range or null | Validated reference period, or null for an empty library. |
| `comparisonRange` | date range or null | Validated period being compared, or null for an empty library. |
| `series` | array | One comparison per ordered opaque origin. Origins are never combined. |

Each series contains opaque `seriesRef`, `baseline`, `comparison`, `totalStepChange`, and `averageStepChange`. Presentation uses a localized ordinal label and never exposes `seriesRef` as a source name.

`baseline` and `comparison` are complete summary objects with `calendarDays`, `observedDays`, `availableStepDays`, `unavailableStepDays`, `missingDays`, `totalStepCount`, and `averageStepCount`. Their invariants, exact decimal encoding, null behavior, missing-value semantics, and half-up average are identical to overview version 2. A period containing no observations remains an all-missing summary for every known origin.

## Change semantics

`totalStepChange` is `comparison.totalStepCount - baseline.totalStepCount`. `averageStepChange` is `comparison.averageStepCount - baseline.averageStepCount`. Both are exact signed decimal strings, use `0` rather than negative zero, and are null unless both corresponding period values exist. Positive, zero, negative, and unavailable changes remain distinct.

Totals and averages include only days whose step total is available. A change is therefore never presented without both periods' available, unavailable, and missing-day counts. The read model does not claim statistical significance, impute missing values, normalize unequal periods, or infer causality.

## Presentation and compatibility

The localized interface requires users to enter all four period endpoints. It renders a visual two-bar total comparison plus an exact table containing totals, averages, and coverage for both periods and their changes. Invalid inputs preserve the prior valid result. Clearing a comparison removes only the disposable result and does not change canonical history or saved preferences.

Any change to range limits, summary semantics, subtraction direction, decimal encoding, null rules, coverage disclosure, or origin separation requires a new comparison version. Application, transport, component, and packaged E2E tests protect exact signed arithmetic, invalid input, missing periods, all controls, both locales, responsive layout, and accessible exact alternatives.
