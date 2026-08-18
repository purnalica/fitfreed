# SQLite Persistence Schema Version 15

## Status and migration

Schema version 15 applies `0015_training_session_structure.sql` atomically after version 14. It adds
provider-neutral exercise, lap, and pause structure to canonical training sessions and extends provenance with
the strict `enrich` decision. Session summaries, authored sport classification, discovery workspaces, and all
other canonical facts retain their version-14 meaning.

Current Polar writes use source adapter `polar-flow-archive@7`, operation mapping set
`polar-flow-mapping-set@2`, and training mapping `polar-flow-training-session@2`. Historical provenance using
`polar-flow-archive@4`, `polar-flow-archive@5`, `polar-flow-archive@6`,
`polar-flow-mapping-set@1`, or `polar-flow-training-session@1` remains valid and readable.

## Provenance extension

`training_session_provenance` is rebuilt without changing existing rows. It retains `id`, `origin_id`,
`session_id`, `import_operation_id`, `artifact_locator`, `source_record_locator`,
`source_artifact_sha256`, `source_provider`, `source_adapter_version`, `mapping_version`,
`source_modified_at_utc`, `reconciliation_decision`, and `contributes_to_visible_state`.
`reconciliation_decision` now accepts `create`, `equivalent`, `enrich`, `amend`, `preserve`, and
`conflict`. Enrichment contributes to visible state because a newer mapping has added previously unevaluated
structure without changing the existing summary. The `training_session_provenance_observation` index is
recreated over canonical identity and operation.

## `training_session_structure`

One optional row states that structural mapping has been evaluated for a canonical training session.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | First canonical session identity component and foreign key. |
| `session_id` | TEXT | no | Second canonical session identity component and foreign key. |
| `exercises_present` | INTEGER | no | Boolean presence bit; zero means the source collection was absent, not empty. |
| `mapping_version` | TEXT | no | Non-empty structural mapping version that produced the row. |

The primary key is (`origin_id`, `session_id`). An absent row means structure has not been evaluated by a
compatible mapping. A present row with `exercises_present` zero is distinct from a present row with no
`training_exercise` children.

## `training_exercise`

One row represents one ordered source exercise below a mapped session structure.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Parent session origin. |
| `session_id` | TEXT | no | Parent session identity. |
| `exercise_id` | TEXT | no | Non-empty source-scoped child identity, protected inside persistence. |
| `ordinal` | INTEGER | no | Zero-based source order, unique within the parent session. |
| `started_at_local` | TEXT | no | Normalized source-local exercise start. |
| `stopped_at_local` | TEXT | no | Normalized source-local exercise stop. |
| `utc_offset_minutes` | INTEGER | yes | Source UTC offset at exercise start; null means unavailable. |
| `duration_milliseconds` | INTEGER | no | Non-negative declared duration. |
| `distance_meters` | REAL | yes | Finite non-negative distance; null means unavailable. |
| `energy_kilocalories` | INTEGER | yes | Non-negative energy; null means unavailable. |
| `sport_ref` | TEXT | yes | Non-empty opaque source sport reference; null means unavailable. |
| `manual_laps_present` | INTEGER | no | Boolean presence bit for source/manual laps. |
| `automatic_laps_present` | INTEGER | no | Boolean presence bit for automatic laps. |
| `pauses_present` | INTEGER | no | Boolean presence bit for pauses. |

The primary key is (`origin_id`, `session_id`, `exercise_id`). Parent identity plus `ordinal` is also unique.
`training_exercise_session_order` supports deterministic parent-order reads.

## `training_lap`

One row represents one ordered lap within an exercise.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Parent session origin. |
| `session_id` | TEXT | no | Parent session identity. |
| `exercise_id` | TEXT | no | Parent exercise identity. |
| `kind` | TEXT | no | `manual` or `automatic`; kinds never merge. |
| `ordinal` | INTEGER | no | Zero-based source order within one kind. |
| `split_time_milliseconds` | INTEGER | no | Non-negative elapsed split boundary. |
| `duration_milliseconds` | INTEGER | no | Non-negative declared lap duration. |
| `distance_meters` | REAL | yes | Finite non-negative lap distance; null means unavailable. |

The primary key is the parent exercise, `kind`, and `ordinal`.
`training_lap_exercise_order` supports deterministic kind-and-order reads.

## `training_pause`

One row represents one ordered source pause within an exercise.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Parent session origin. |
| `session_id` | TEXT | no | Parent session identity. |
| `exercise_id` | TEXT | no | Parent exercise identity. |
| `ordinal` | INTEGER | no | Zero-based source order. |
| `started_at_local` | TEXT | no | Normalized source-local pause start. |
| `ended_at_local` | TEXT | no | Normalized source-local pause end, not earlier than its start. |

The primary key is the parent exercise plus `ordinal`.
`training_pause_exercise_order` supports deterministic parent-order reads.

## Reconciliation, revision, and privacy

Import validates the complete structure before persistence. A new session creates summary and structure in one
visibility transaction. A previously persisted summary with no structural assessment may be strictly enriched
when the same bytes are reimported under mapping version 2. A later source revision atomically replaces the
summary and all mapped children; an earlier or conflicting revision cannot change visible children. Replacement
never appends duplicate exercises, laps, or pauses.

Insert, update, or delete of `training_session_structure` advances `training_discovery_revision` through
`training_session_structure_discovery_revision_insert`,
`training_session_structure_discovery_revision_update`, or
`training_session_structure_discovery_revision_delete`. Readers therefore cannot combine a detail with an old
search snapshot after structural enrichment or amendment.

Raw `exercise_id`, `origin_id`, `session_id`, artifact locators, and source hashes remain protected library
state. Presentation receives only domain-separated opaque references. Version 15 stores no coordinates,
routes, zones, notes, device identifiers, or high-resolution samples.

Migration interruption rolls back the rebuilt provenance table, new tables, indexes, triggers, and version
marker together. Version 14 remains a supported direct migration baseline in the release upgrade matrix.
Backup and restore include all new tables; portable export remains a separately versioned contract.
