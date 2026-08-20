# SQLite Persistence Schema Version 19

## Status and migration

Schema version 19 applies `0019_training_session_zones.sql` atomically after version 18. It adds exact
source-recorded zone assessments below existing training exercises. Existing provider-neutral summaries,
structure, routes, signals, personal segment criteria, workspace, and import evidence retain their version-
18 meaning.

The migration creates no zone assessment from an older row. Null assessment therefore means not evaluated
by a compatible mapping rather than an absent or empty source collection. Versions 1 through 18 remain
supported direct migration baselines; interruption leaves version 18 intact and retryable.

Current Polar writes use source adapter `polar-flow-archive@11`, operation mapping set
`polar-flow-mapping-set@6`, and training mapping `polar-flow-training-session@6`. Earlier provenance retains
its historical version, including `polar-flow-archive@10`, `polar-flow-mapping-set@5`, and
`polar-flow-training-session@5`, and becomes eligible for strict mapping enrichment.

## `training_session_zone_assessment`

One row proves that the complete session was evaluated by the zone mapping.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id`, `session_id` | TEXT | no | Protected canonical session identity and composite primary key. |
| `exercises_present` | INTEGER | no | Boolean preserving absent versus present source exercise collection. |
| `mapping_version` | TEXT | no | Non-empty mapping that produced the assessment. |

The foreign key binds the assessment to `training_session`. Insert, update, and delete triggers advance the
coherent training-discovery revision.

## `training_exercise_zone_assessment`

One row mirrors every present structural exercise.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id`, `session_id`, `exercise_id` | TEXT | no | Protected exercise identity and composite primary key. |
| `ordinal` | INTEGER | no | Non-negative source exercise order, unique within the session. |
| `zones_present` | INTEGER | no | Boolean preserving absent versus present source zone collection. |
| `unsupported_group_count` | INTEGER | no | Non-negative count; zero whenever `zones_present` is false. |

Foreign keys bind the row to both the session zone assessment and exact `training_exercise`. Provider type
tokens and unsupported values are not stored.

## `training_zone_group`

Each supported source group stores `origin_id`, `session_id`, `exercise_id`, contiguous mapped `ordinal`,
`kind`, `unit`, and `zones_present`. The composite primary key fixes group order. Exact allowed kind/unit
pairs are `heart-rate` with `beats-per-minute`, `speed` with `kilometers-per-hour`, and `power` with `watts`.
`zones_present` distinguishes an absent source band collection from present-empty.

`training_zone_group_exercise_order` supports deterministic exact reads.

## `training_zone`

Each band stores the group identity through `origin_id`, `session_id`, `exercise_id`, and `group_ordinal`,
plus contiguous `ordinal`, finite non-negative `lower_limit`, ordered `higher_limit`, nullable non-negative
`time_in_zone_milliseconds`, nullable non-negative `distance_meters`, and nullable non-negative
`muscle_load`. The composite primary key preserves exact order and the foreign key prevents orphan bands.

The import and application contracts additionally reject non-finite values and enforce kind-specific
aggregate fields: distance is available only for speed, muscle load only for power, and neither for heart
rate. Null remains unknown and differs from a recorded zero.

`training_zone_group_zone_order` supports the exact ordered response. Version 1 collections are bounded at
import to 64 groups per exercise and 256 bands per group; persistence never truncates an accepted group.

## Transactions, reimport, and privacy

Create, strict mapping enrichment, and later-source amendment replace zone evidence inside the same
visibility transaction as the session summary and every other mapped child. Equivalent, preserved, and
conflicting records do not duplicate or partially replace zone rows. Mapping-set version 5 forces identical
bytes completed under version 4 to be reassessed; equal previous evidence plus newly evaluated zones is
`enrich`.

Zone bounds and aggregates remain local sensitive fitness data. The schema contains no provider token,
artifact locator, raw account claim, route coordinate, export destination, telemetry field, or network
authorization.
