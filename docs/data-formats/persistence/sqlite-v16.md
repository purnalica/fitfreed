# SQLite Persistence Schema Version 16

## Status and migration

Schema version 16 applies `0016_training_session_routes.sql` atomically after version 15. It adds
provider-neutral route-assessment, route-summary, and exact waypoint storage below existing training
exercises. All earlier canonical facts retain their version-15 meaning.

Current Polar writes use source adapter `polar-flow-archive@8`, operation mapping set
`polar-flow-mapping-set@3`, and training mapping `polar-flow-training-session@3`. Historical
provenance using `polar-flow-archive@7`, `polar-flow-mapping-set@2`, and
`polar-flow-training-session@2` remains valid and can be strictly enriched by reassessing identical
source bytes.

## `training_session_route_assessment`

One optional row states that route mapping has evaluated a canonical training session.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | First parent-session identity component. |
| `session_id` | TEXT | no | Second parent-session identity component. |
| `exercises_present` | INTEGER | no | Boolean presence bit for the source exercise collection. |
| `mapping_version` | TEXT | no | Non-empty route mapping version that produced the assessment. |

The primary key is (`origin_id`, `session_id`). An absent row means not evaluated. A present row with
`exercises_present` zero means the source collection was absent, while one with no child rows means
the collection was present-empty.

## `training_exercise_route_assessment`

One row preserves the route-container assessment for an existing structural exercise.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Parent-session origin. |
| `session_id` | TEXT | no | Parent-session identity. |
| `exercise_id` | TEXT | no | Protected source exercise identity and foreign key. |
| `ordinal` | INTEGER | no | Zero-based exercise order, unique within the session. |
| `routes_present` | INTEGER | no | Boolean source route-container presence bit. |

The primary key is the parent session and `exercise_id`. A present assessment with
`routes_present` zero is distinct from a present empty route container. The
`training_exercise_route_session_order` index supports deterministic ordered reads.

## `training_route`

One row represents one explicit route kind below an assessed exercise.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Parent-session origin. |
| `session_id` | TEXT | no | Parent-session identity. |
| `exercise_id` | TEXT | no | Parent-exercise identity. |
| `kind` | TEXT | no | `primary` or `transition`; kinds never merge. |
| `started_at_local` | TEXT | no | Normalized source-local route start. |
| `point_count` | INTEGER | no | Non-negative exact waypoint count. |
| `altitude_point_count` | INTEGER | no | Points with recorded altitude, not above `point_count`. |
| `elapsed_point_count` | INTEGER | no | Points with elapsed time, not above `point_count`. |

The primary key is parent exercise plus `kind`. Counts permit bounded overview queries without
loading exact geometry and are verified against child rows when canonical evidence is reconstructed.

## `training_route_point`

One row stores one exact source-ordered waypoint.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Parent-session origin. |
| `session_id` | TEXT | no | Parent-session identity. |
| `exercise_id` | TEXT | no | Parent-exercise identity. |
| `kind` | TEXT | no | Parent route kind. |
| `ordinal` | INTEGER | no | Zero-based contiguous source order. |
| `latitude_degrees` | REAL | no | Finite latitude from -90 through 90 degrees. |
| `longitude_degrees` | REAL | no | Finite longitude from -180 through 180 degrees. |
| `altitude_meters` | REAL | yes | Finite recorded altitude; null means unavailable. |
| `elapsed_milliseconds` | INTEGER | yes | Non-negative recorded route offset; null means unavailable. |

The primary key is the parent route and `ordinal`. `training_route_point_route_order` supports exact
ordered pages and deterministic source-ordinal visual selection.

## Reconciliation, snapshots, and privacy

Import validates complete route evidence before persistence. Create, strict mapping enrichment, and
newer-source amendment replace summary, structure, routes, and points in one visibility transaction.
Replacement deletes old point and route children before structural exercises and then inserts the
complete incoming evidence. It never appends duplicates. Older or conflicting evidence changes no
visible route.

Insert, update, or delete of `training_session_route_assessment` advances
`training_discovery_revision` through `training_session_route_discovery_revision_insert`,
`training_session_route_discovery_revision_update`, or
`training_session_route_discovery_revision_delete`. A route read therefore cannot silently combine
new geometry with an older discovery snapshot.

Coordinates, protected identities, artifact locators, and source hashes remain local library state.
Presentation receives domain-separated route and exercise capabilities. The schema performs no
external map, tile, geocoder, telemetry, or location request.

Migration interruption rolls back all four tables, indexes, triggers, and the version marker
together. Version 15 remains a supported direct migration baseline. Backup and recovery include the
new tables; the portable user export remains a separate future contract.
