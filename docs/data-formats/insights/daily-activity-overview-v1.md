# Daily Activity Overview Read Model Version 1

## Status and boundary

Normative provider-neutral Insights contract for the default daily-activity overview. The application builds this disposable read model from [canonical daily activity version 1](../canonical/daily-activity.md); it is not canonical history, portable export, or a persistence schema. The Tauri transport serializes the model as JSON conforming to [`activity-overview-v1.schema.json`](../../../schemas/activity-overview-v1.schema.json).

The default query selects at most 30 inclusive local calendar dates ending at the latest canonical activity date. If fewer dates exist between the earliest and latest observations, the complete available range is selected. No provider record or persistence row is exposed directly.

## Root fields

| Field | Type | Cardinality | Contract |
|---|---|---|---|
| `availableRange` | date range or null | exactly one | Earliest and latest canonical local dates across all origins. Null only when no daily activity exists. |
| `selectedRange` | date range or null | exactly one | Inclusive default window used to build every returned series. Null only when `availableRange` is null. |
| `series` | array | exactly one | One independently calculated series per opaque observation origin, ordered by `seriesRef`. Empty when the library has no daily activity. Origins are never combined. |

Each date range contains `from` and `through` as canonical `YYYY-MM-DD` local-date strings. `from` is not later than `through`. Date arithmetic does not use the computer time zone.

## Series fields

| Field | Type | Cardinality | Contract |
|---|---|---|---|
| `seriesRef` | string | exactly one | Opaque library-local reference used for stable series identity. It is not a provider username, filename token, or display label. |
| `summary` | object | exactly one | Aggregates for this origin and the complete selected calendar range. |
| `days` | array | 1 to 30 | One entry for every consecutive selected local date, ordered ascending without duplicates. |

The interface does not display `seriesRef`. When more than one origin exists, each series remains separate and receives a localized ordinal presentation label until a documented source-attribution contract is implemented.

## Daily fields and availability

| Field | Type | Cardinality | Contract |
|---|---|---|---|
| `localDate` | string | exactly one | Selected local date in `YYYY-MM-DD` form. |
| `stepCount` | decimal string or null | exactly one | Exact non-negative canonical step count when availability is `available`; null otherwise. Decimal text prevents JavaScript number precision loss. |
| `availability` | enumeration | exactly one | `available`, `unavailable`, or `missing`. |

`available` means that a canonical observation and step total exist. `unavailable` means that the canonical observation exists but its optional step total is null. `missing` means that no canonical observation exists for this origin and date. Missing and unavailable dates are never converted to zero.

## Summary fields

| Field | Type | Contract |
|---|---|---|
| `calendarDays` | integer | Number of dates in the inclusive selected range. |
| `observedDays` | integer | Days with a canonical observation, including unavailable step totals. |
| `availableStepDays` | integer | Days whose `availability` is `available`. |
| `unavailableStepDays` | integer | Days whose `availability` is `unavailable`. |
| `missingDays` | integer | Days whose `availability` is `missing`. |
| `totalStepCount` | decimal string or null | Exact sum across available step totals; null when no selected day has a step total. |
| `averageStepCount` | decimal string or null | Arithmetic mean across available step totals, rounded to the nearest whole step with half values rounded upward; null when no selected day has a step total. |

The count invariants are `observedDays = availableStepDays + unavailableStepDays` and `calendarDays = observedDays + missingDays`. Aggregates never treat missing or unavailable values as zero and never combine origins.

## Compatibility and validation

Version 1 is additive at the transport boundary only through a new versioned schema. Renaming fields, changing availability, window, ordering, rounding, numeric encoding, missing-value, or origin-separation semantics requires a new read-model version. A persistence adapter returning an invalid date, negative count, duplicate logical observation, or record outside the requested window fails the query instead of producing a partial or misleading report.

The schema validates transport shape, exact decimal encoding, availability coupling, and window-size limits. Application and adapter tests protect calendar arithmetic, ordering, gaps, unavailable values, per-origin separation, aggregates, database bounds, indexed range access, and atomic migration. Presentation and packaged E2E tests protect localized exact values and accessible visual and tabular alternatives.
