# Training-Session Search Read Model Version 1

## Status and boundary

Normative provider-neutral contract for finding lightweight session evidence across the complete FitFreed
training library. The Tauri `query_training_sessions` command accepts
[`training-session-search-query-v1.schema.json`](../../../schemas/training-session-search-query-v1.schema.json)
and returns [`training-session-search-v1.schema.json`](../../../schemas/training-session-search-v1.schema.json).
It replaces the bounded summary window as the session-discovery path; `training-overview-v1` remains a
period-summary and comparison contract.

This read model contains only lightweight canonical facts. Routes, samples, laps, phases, user-defined
segments, and full session inspection belong to later detail contracts and are never loaded speculatively by
search.

The same discovery boundary also exposes a source-separated calendar and an ordered opaque selection. The
`query_training_session_calendar` command accepts
[`training-session-calendar-query-v1.schema.json`](../../../schemas/training-session-calendar-query-v1.schema.json)
and returns
[`training-session-calendar-v1.schema.json`](../../../schemas/training-session-calendar-v1.schema.json).
The `query_training_session_selection` command accepts
[`training-session-selection-query-v1.schema.json`](../../../schemas/training-session-selection-query-v1.schema.json)
and returns
[`training-session-selection-v1.schema.json`](../../../schemas/training-session-selection-v1.schema.json).

## Query

`from` and `through` are independently optional inclusive local-date bounds. When both exist, `from` cannot
follow `through`. An empty `sportRefs` array means every sport; otherwise each opaque reference must still be
discoverable in the current library. `requiredMeasurements` contains zero or more of `distance`, `energy`,
and `heart-rate`; a session must contain every requested measurement. Heart rate is available when either its
average or maximum is present.

`text` is optional trimmed user text of one through 80 Unicode scalar values. Version 1 applies Unicode
lowercase matching only to user-authored sport display labels. It does not search hidden source identifiers,
opaque references, provider vocabulary, inferred labels, or untranslated family codes. All filters combine
with logical AND.

`sort` is one of:

- `started-desc`: newest start first;
- `started-asc`: oldest start first;
- `duration-desc`: longest duration first, then newest start;
- `distance-desc`: greatest available distance first, absent distance last, then newest start.

Every order uses hidden canonical origin and session identity as final deterministic tie-breakers. Neither
identity crosses the presentation boundary.

## Coherent pagination

`offset` is zero based and `limit` is one through 100. A first request uses null `snapshotRef`. The result
returns an opaque snapshot derived from the current training-discovery revision. Every later page repeats the
same query and snapshot with the returned `nextOffset`. A canonical session or sport-classification mutation
changes the snapshot; a stale request returns `training-session-search-changed` and presentation restarts at
the first page. This prevents insertion, amendment, or reclassification from silently shifting offset pages.

`totalCount` is the exact number of matching sessions in that snapshot. `summaries` describes the complete
filtered result independently from the current page, while `sessions` contains at most `limit` items. A
non-final page is full and exposes its following offset; the final page has null `nextOffset`.
`availableRange` always describes the complete training library rather than the filtered result and is null
only when the library has no sessions.

## Filtered summaries

One summary is returned for each matching `sourceIndex`, in ascending source order. `sessionCount` values add
up exactly to `totalCount`; a source with no matching session has no summary. Each summary contains exact
`trainingDays`, `totalDurationMilliseconds`, `distanceSessionCount`, `totalDistanceMeters`,
`energySessionCount`, `totalEnergyKilocalories`, and `heartRateSessionCount` values over the complete filtered
result. A training day is a distinct local start date within one source. Optional distance and energy totals
are null exactly when their corresponding session count is zero. Duration and energy totals use decimal
strings so transport cannot lose integer precision. The summaries and page are read from the same snapshot;
presentation never reconstructs a complete-history aggregate from the visible page.

## Calendar projection

The calendar query repeats the search `from`, `through`, `sportRefs`, `requiredMeasurements`, and `text`
filters and replaces pagination and sorting with a required canonical `month` in `YYYY-MM` form. The same
`snapshotRef` coherence rules apply. The month is intersected with optional date bounds; days outside that
intersection have no entry.

`days` is ordered by `localDate` and then `sourceIndex`. Each item represents exactly one source on one local
date and contains positive `sessionCount`, exact decimal-string `totalDurationMilliseconds`,
`distanceSessionCount`, optional `totalDistanceMeters`, and `heartRateSessionCount`. Multiple sources on the
same date remain separate. A date without matching sessions has no item. The response repeats `month`,
`availableRange`, and the accepted `snapshotRef`; calendar and session pages can therefore be combined only
when their snapshots agree.

## Ordered selection

`sessionRefs` contains one through five unique opaque session references. Four references are available for
comparison; a fifth may represent a distinct open detail while restoring a workspace. The result contains
the same number of `sessions` in request order and the accepted `snapshotRef`. A reference that is malformed,
duplicated, or absent from the current snapshot rejects the complete selection. The resolver never exposes
canonical origin or source session identity and never substitutes a session from another snapshot.

## Session and sport context

`sessionRef`, `sportRef`, and `snapshotRef` are distinct library-local opaque capabilities. Presentation
never renders them. `sourceIndex` is a stable one-based ordinal over sorted opaque origins for the response,
allowing otherwise ambiguous sources to be distinguished without exposing identity.

Each session preserves exact `startedAtLocal` and `stoppedAtLocal` timestamps, optional `utcOffsetMinutes`,
`durationMilliseconds`, optional `distanceMeters`, `energyKilocalories`, `averageHeartRateBpm`,
`maximumHeartRateBpm`, and `exerciseCount`. Exact integers use decimal strings where JavaScript precision
could otherwise be lost. Missing measurements remain null and are never imputed.

Sport `state` and `classification` have the same meaning as
[`training-sports-v1`](training-sports-v1.md). Search returns the classification captured in the same database
snapshot as the session page. Provider values never become labels.

## Errors and compatibility

Malformed dates, duplicate filters, unsupported codes, invalid page sizes, invalid opaque references, and
references absent from the current library return `invalid-training-session-search`. A changed snapshot
returns `training-session-search-changed`. Storage or invariant failure returns
`training-session-search-failed`; no canonical fact is changed by any search.

Changing complete-history scope, filter semantics, label-search scope, summary meaning, source separation,
sort meaning, pagination coherence, opaque identity, sport-state meaning, numeric encoding, or error codes
requires a new contract version.
