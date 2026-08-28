# Training-Session Search Read Model Version 5

## Status and boundary

Normative provider-neutral session-discovery contract. Version 5 retains every search query, pagination,
sorting, selection, snapshot, numeric, sport-identity, and error rule from
[version 4](training-session-search-v4.md). It replaces the aggregate-only calendar response with an
individually navigable activity projection.

`query_training_sessions` continues to accept
[`training-session-search-query-v2.schema.json`](../../../schemas/training-session-search-query-v2.schema.json)
and return
[`training-session-search-v4.schema.json`](../../../schemas/training-session-search-v4.schema.json).
`query_training_session_selection` continues to return
[`training-session-selection-v4.schema.json`](../../../schemas/training-session-selection-v4.schema.json).
`query_training_session_calendar` accepts
[`training-session-calendar-query-v2.schema.json`](../../../schemas/training-session-calendar-query-v2.schema.json)
and now returns
[`training-session-calendar-v2.schema.json`](../../../schemas/training-session-calendar-v2.schema.json).

## Calendar activity projection

Each source-separated day retains its exact version-1 aggregate fields and adds `activities`. The array has
exactly `sessionCount` entries and is ordered by `startedAtLocal`, with `sessionRef` as a deterministic final
tie-breaker. The sum of activity `durationMilliseconds` values equals the day's
`totalDurationMilliseconds`. Activity references are unique across the response. Every activity local start
belongs to its enclosing `localDate`.

An activity contains only the lightweight facts required for calendar discovery:

- opaque `sessionRef`, used to request the exact session through the ordered-selection boundary;
- exact `startedAtLocal`, used for local-time ordering and presentation;
- decimal-string `durationMilliseconds`, formatted at human scale by presentation; and
- provider-neutral version-3 `sport` identity, including the same recognition and personal-classification
  semantics used by search results.

Routes, samples, structure, zones, source identifiers, provider vocabulary, and provenance remain outside
the calendar response. Opening an activity resolves the current selection contract under the calendar
snapshot; it does not trust the lightweight card as session detail.

## Compatibility

Adding required per-session activity evidence is a breaking response change, so version 1 remains immutable
and version 2 is a distinct schema. Changing activity identity, ordering, sport semantics, numeric encoding,
source separation, aggregate invariants, or snapshot behavior requires a new contract version.
