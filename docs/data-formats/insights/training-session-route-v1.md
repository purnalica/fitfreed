# Training-Session Route Read Models Version 1

## Purpose and boundary

These provider-neutral contracts let a person inspect locally stored route evidence without
exposing provider identifiers or requiring a network map. The bounded overview serves the visual
trace; the exact page serves accessible verification of every recorded waypoint. Neither read model
changes canonical evidence.

The Tauri commands and schemas are:

| Command | Request | Response |
|---|---|---|
| `query_training_session_routes` | [`training-session-route-query-v1.schema.json`](../../../schemas/training-session-route-query-v1.schema.json) | [`training-session-route-v1.schema.json`](../../../schemas/training-session-route-v1.schema.json) |
| `query_training_route_points` | [`training-route-points-query-v1.schema.json`](../../../schemas/training-route-points-query-v1.schema.json) | [`training-route-points-v1.schema.json`](../../../schemas/training-route-points-v1.schema.json) |

## Snapshot and opaque capabilities

Both requests require the opaque `sessionRef` returned by discovery and may carry its
`snapshotRef`. A supplied snapshot must still be current. Exact-point requests additionally require
the opaque `routeRef` returned by the overview. References are domain-separated local capabilities,
not source identifiers, labels, or portable identities.

A stale snapshot returns `training-session-detail-changed`. A malformed capability or result returns
`invalid-training-session-detail`. A missing session or route and persistence failures return
`training-session-detail-failed` without changing canonical data.

## Bounded route overview

`maxVisualPoints` is an integer from 2 through 500 and applies independently to each route. The
result repeats the accepted snapshot and session and preserves every canonical assessment state:

- null result `routes`: the session has not been evaluated for routes;
- null `routes.exercises`: source exercises were absent;
- empty `routes.exercises`: source exercises were present-empty;
- null exercise `routes`: its source route container was absent;
- present exercise `routes` with null route kinds: its container was present without those routes.

Each exercise has the same opaque `exerciseRef` and ordinal as structural detail. A present route has
an opaque `routeRef`, kind, source-local start, exact `pointCount`, counts of points with altitude and
elapsed evidence, and a bounded ordered `visualPoints` collection.

The transport fields are `routes`, `exercises`, `exerciseRef`, `ordinal`, `kind`, `startedAtLocal`,
`pointCount`, `altitudePointCount`, `elapsedPointCount`, `visualPoints`, `latitudeDegrees`,
`longitudeDegrees`, `altitudeMeters`, and `elapsedMilliseconds`. Route collections expose independent
`primary` and `transition` members.

When `pointCount <= maxVisualPoints`, the overview returns every point. Otherwise it returns exactly
`maxVisualPoints` source points. For point count `N`, output count `L`, and zero-based output index
`i`, the selected source ordinal is:

```text
floor(i * (N - 1) / (L - 1))
```

This deterministic endpoint-preserving projection is algorithm `source-ordinal-v1`. Every visual
point includes its original ordinal and exact recorded coordinate and optional values. It is a
selection, not interpolation or smoothing.

## Exact route-point page

`offset` is a non-negative integer and `limit` is from 1 through 250. The result includes exact
`pointCount`, accepted `offset`, ordered `points`, and `nextOffset`. An offset at or beyond the end
returns an empty page and null `nextOffset`. Otherwise `nextOffset` is the next source ordinal when
more points remain.

Every point contains its exact canonical ordinal, latitude, longitude, optional altitude, and
optional elapsed offset. Ordinals are contiguous within the full route, while one returned page may
start above zero. Pagination never uses a visual projection.

## Rendering, accessibility, and privacy

The first visual renderer uses an application-owned SVG on a neutral surface. It unwraps longitude
only for local drawing continuity across the antimeridian and scales the displayed bounds; it does
not modify transported values. Primary and transition routes are separate paths. Zero-point routes
show an explicit empty state and one-point routes show a point rather than an invented segment.

The SVG has a textual summary and the exact paginated table is reachable by keyboard for every
route. Visual color is never the only route-kind distinction. Coordinate formatting may follow the
selected locale, but transport numbers and stored evidence remain unchanged.

No route query or renderer loads external tiles, contacts a geocoder, sends coordinates, or embeds
remote content. Changing query bounds, projection selection, capability domains, exact pagination,
assessment states, or privacy behavior requires a new contract version.
