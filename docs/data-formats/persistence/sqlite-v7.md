# SQLite Persistence Schema Version 7

## Status and boundary

Version 7 extends the immutable [version 6 schema](sqlite-v6.md) with canonical sleep periods, phase timelines, split-artifact provenance, conflicts, and a date-first query index. It implements [canonical sleep period version 1](../canonical/sleep-period.md) without persisting alarms, birthdays, device identifiers, trimming metadata, encoded feedback, scoring baselines, phase percentages, raw algorithm labels, or detailed cycle-depth models.

SQLite `PRAGMA user_version` stores value 7 after migration. New libraries apply every immutable migration through [`0007_sleep_period.sql`](../../../src-tauri/migrations/0007_sleep_period.sql) in one transaction. Existing version 6 libraries apply only version 7. An error or injected interruption rolls back every new table, index, and the version marker together.

Current Polar writes use source adapter `polar-flow-archive@5`, operation mapping set `polar-flow-mapping-set@1`, and family mapping `polar-flow-sleep@1`.

## `sleep_period`

One row is the current visible canonical period. The primary key is (`origin_id`, `sleep_date`), and `sleep_period_date_origin` indexes (`sleep_date`, `origin_id`) for chronological range queries.

| Column group | SQLite columns | Contract |
|---|---|---|
| Identity | `origin_id`, `sleep_date` | Opaque origin plus source-assigned ISO date. |
| Boundaries | `started_at`, `ended_at` | Normalized RFC 3339 offset date-times. |
| Declared durations | `span_milliseconds`, `asleep_milliseconds`, `interruption_milliseconds`, `long_interruption_milliseconds`, `short_interruption_milliseconds` | Non-negative canonical whole milliseconds satisfying the documented arithmetic. |
| Interruption counts | `interruption_count`, `long_interruption_count`, `short_interruption_count` | Non-negative counts whose long and short values total the overall count. |
| Analysis | `efficiency_percent`, `continuity_index`, `continuity_class` | Finite values inside their canonical ranges. |
| Optional context | `sleep_goal_milliseconds`, `self_reported_rating`, `cycle_count`, `recording_ended_by_power_loss` | Null retains unavailable source evidence; booleans use constrained 0 or 1. |
| Phase summary | `phase_wake_milliseconds`, `phase_rem_milliseconds`, `phase_light_milliseconds`, `phase_deep_milliseconds`, `phase_unrecognized_milliseconds` | All null or all present. Present phase arithmetic must match the canonical span and asleep duration. |
| Timeline availability | `stage_timeline_available` | Distinguishes null timeline data from an explicitly present empty transition collection. |
| Score set | `score_overall`, `score_own_target_duration`, `score_recommended_duration`, `score_continuity`, `score_efficiency`, `score_rem`, `score_deep`, `score_long_interruptions`, `score_duration`, `score_solidity`, `score_regeneration`, `score_relative_rating` | Core score components are all null or all present on the 1-to-100 scale. `score_relative_rating` may remain null inside a present set and otherwise uses 1 through 5. |

## `sleep_stage_transition`

One row is a canonical state transition inside a period.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | First foreign-key component to `sleep_period`. |
| `sleep_date` | TEXT | no | Second foreign-key component. |
| `position` | INTEGER | no | Non-negative source order and third primary-key component. |
| `offset_milliseconds` | INTEGER | no | Non-negative offset from the declared period start. |
| `stage` | TEXT | no | `wake`, `rem`, `light`, `deep`, or `unrecognized`. |

Deleting or replacing a period cascades to its transitions. Application validation protects start-at-zero, ordering, and span bounds before persistence.

## `sleep_period_provenance`

One append-only row records each period reconciliation decision under integer primary key `id`. It retains protected `result_artifact_locator`, `result_artifact_sha256`, optional paired `score_artifact_locator`, optional `score_artifact_sha256`, `source_provider`, `source_adapter_version`, `mapping_version`, and `import_operation_id` evidence.

`reconciliation_decision` is `create`, `equivalent`, `enrich`, `preserve`, or `conflict`. `contributes_to_visible_state` is true for create, equivalent, and enrichment; it is false for preserve and conflict. Locator and hash values remain protected library data and never enter public outcomes.

`sleep_period_provenance_observation` indexes (`origin_id`, `sleep_date`, `import_operation_id`).

## `sleep_period_conflict`

A conflict row uses integer primary key `id` and records the operation, canonical identity, incoming `result_artifact_locator`, optional `score_artifact_locator`, and `mapping_version` without duplicating personal values. The canonical identity is stored as `origin_id` and `sleep_date`. The matching provenance row retains source hashes. `sleep_period_conflict_operation` indexes by `import_operation_id`. User-controlled conflict resolution remains outside schema version 7.

## Reconciliation and transaction behavior

For one (`origin_id`, `sleep_date`) identity, exact canonical equality is equivalent. Strict optional enrichment replaces the visible row and transition set atomically. A strict loss of optional information is preserved without changing visible state. Changed known values, changed optional groups, and mixed additions and removals are conflicts because mapping version 1 has no orderable source revision.

Sleep rows, transitions, provenance, conflicts, source-subject state, report counters, and operation completion share the existing visibility transaction. Invalid split relationships, duplicate dates, cancellation, interruption, or commit failure expose no partial sleep history.

## Verification obligations

Contract and migration tests protect every table, column, index, constraint, version transition, and interrupted upgrade. Domain, adapter, and persistence tests protect missing scores, staged and non-staged variants, midnight and daylight-saving boundaries, duplicate and orphan split records, exact repeat, enrichment, preservation, conflict, provenance, restart, and canonical querying.
