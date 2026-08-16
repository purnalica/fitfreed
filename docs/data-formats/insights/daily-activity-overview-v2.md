# Daily Activity Overview Read Model Version 2

## Status and boundary

Normative provider-neutral Insights contract for default and interactive daily-activity exploration. It supersedes [version 1](daily-activity-overview-v1.md) for the application interface while preserving its field, exact-number, availability, ordering, aggregation, gap, and origin-separation semantics. The application derives this disposable read model from [canonical daily activity version 1](../canonical/daily-activity.md); it is not canonical history, portable export, or a persistence schema.

The Tauri transport accepts JSON conforming to [`activity-overview-query-v2.schema.json`](../../../schemas/activity-overview-query-v2.schema.json) and serializes the response as JSON conforming to [`activity-overview-v2.schema.json`](../../../schemas/activity-overview-v2.schema.json). Presentation can select one returned local date to display daily detail, but it does not query persistence rows or provider records.

## Query input

The `query_activity_overview` command accepts `requestedRange`, either null or a date-range object with `from` and `through` fields.

- Null selects at most the latest 30 inclusive local calendar dates ending at the latest canonical activity date.
- An object selects the stated inclusive range.
- Both dates are canonical `YYYY-MM-DD` local dates, independent of the computer time zone.
- `from` is not later than `through`.
- Both dates lie inside `availableRange`.
- An explicit range contains at most 366 inclusive calendar days.

Invalid syntax, ordering, bounds, or length returns the stable `invalid-activity-range` command error before canonical facts are queried. A library without daily activity returns an empty overview for either input.

## Response

| Field | Type | Cardinality | Contract |
|---|---|---|---|
| `availableRange` | date range or null | exactly one | Earliest and latest canonical local dates across all origins. Null only when no daily activity exists. |
| `selectedRange` | date range or null | exactly one | Inclusive default or explicit range used to build every returned series. Null only when `availableRange` is null. |
| `series` | array | exactly one | One independently calculated series per opaque observation origin, ordered by `seriesRef`. Empty when the library has no daily activity. Origins are never combined. |

Each non-empty series contains `seriesRef`, `summary`, and `days`. `seriesRef` is an opaque library-local identity and is never presented as a source name. The application obtains the library's distinct origin catalog separately from the range facts, so an explicit range containing no observations still returns one all-missing series per known origin rather than masquerading as an empty library. Empty, duplicate, or inconsistent origin metadata fails the query. `days` contains one entry for every consecutive selected local date, ordered ascending without duplicates, with a minimum of one and maximum of 366 entries.

## Daily values, summaries, and detail

Each day contains `localDate`, exact non-negative `stepCount` encoded as decimal text or null, and `availability` as `available`, `unavailable`, or `missing`. Available means an observation and step total exist; unavailable means an observation exists without a step total; missing means the origin has no observation on that date. Missing and unavailable never become zero.

Each series summary contains `calendarDays`, `observedDays`, `availableStepDays`, `unavailableStepDays`, `missingDays`, `totalStepCount`, and `averageStepCount`. The count invariants, exact total, null behavior, and half-up whole-step average are unchanged from version 1. Aggregates never combine origins.

Daily detail is a presentation projection of the selected date already present in every returned series. It shows the localized date, exact step total or explicit unavailability, availability meaning, and a localized ordinal series label. It does not expose `seriesRef`, infer provider identity, or retrieve extra source fields.

## Compatibility and validation

Version 2 changes the selectable-window contract from a fixed default of at most 30 dates to a validated explicit range of at most 366 dates. Version 1 remains immutable and continues to describe the earlier default-only response. Further changes to fields, maximum range, ordering, rounding, numeric encoding, missing-value meaning, or origin separation require a new read-model version.

Application tests protect default and explicit selection, all-missing ranges, origin-catalog consistency, calendar arithmetic, bounds, maximum length, gaps, unavailable values, aggregates, and invalid adapter facts. SQLite integration tests protect distinct origins and indexed inclusive access. Transport tests protect input decoding and exact decimal output. Component and packaged E2E tests enter dates, submit and reset filters, open and close daily detail, exercise invalid and all-missing ranges, verify localized exact values, and preserve accessible visual and tabular alternatives.
