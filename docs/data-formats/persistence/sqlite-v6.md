# SQLite Persistence Schema Version 6

## Status and boundary

Current local-library schema. Version 6 extends the immutable [version 5 schema](sqlite-v5.md) with canonical training-session summaries, source-revision provenance, conflict evidence, amendment accounting, and a start-time query index. It implements [canonical training session summary version 1](../canonical/training-session.md) without persisting excluded routes, coordinates, samples, laps, zones, notes, device data, or nested exercise measurements.

SQLite `PRAGMA user_version` stores value 6 after migration. New libraries apply every immutable migration through [`0006_training_session_summary.sql`](../../../src-tauri/migrations/0006_training_session_summary.sql) in one transaction. Existing version 5 libraries apply only version 6. An error or injected interruption rolls back every new table, index, column, and the version marker together.

## Import-operation extension

Version 6 adds one column to `import_operation`:

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `amended_observations` | INTEGER | no | Non-negative count of existing canonical observations replaced atomically using later valid source-revision evidence. Existing rows migrate with zero. |

Current Polar writes use source adapter `polar-flow-archive@4` and operation mapping-set version `polar-flow-mapping-set@1`. The operation mapping set scopes exact-repeat reuse across all executable family mappings. Family-specific provenance continues to record `polar-flow-daily-activity@1` or `polar-flow-training-session@1`.

`canonical_history_changed` is true for a completed operation that creates, enriches, or amends at least one observation. An exact repeat and every rejected, cancelled, or failed operation remain false.

## `training_session`

One row is the current visible canonical session summary plus the source revision required for deterministic reconciliation.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Canonical `originId`, foreign key to `observation_origin`, and first primary-key component. |
| `session_id` | TEXT | no | Non-empty canonical `sessionId` and second primary-key component. |
| `source_modified_at_utc` | TEXT | no | Normalized source revision with UTC semantics. This is provenance control state, not a canonical training fact. |
| `started_at_local` | TEXT | no | Canonical `startedAtLocal` normalized ISO 8601 local date-time. |
| `stopped_at_local` | TEXT | no | Canonical `stoppedAtLocal` normalized ISO 8601 local date-time. |
| `utc_offset_minutes` | INTEGER | yes | Canonical `utcOffsetMinutes`; null means unavailable. |
| `duration_milliseconds` | INTEGER | no | Canonical non-negative `durationMilliseconds`. |
| `distance_meters` | REAL | yes | Canonical finite non-negative `distanceMeters`; null means unavailable. |
| `energy_kilocalories` | INTEGER | yes | Canonical non-negative `energyKilocalories`; null means unavailable. |
| `average_heart_rate_bpm` | INTEGER | yes | Canonical non-negative `averageHeartRateBpm`; null means unavailable. |
| `maximum_heart_rate_bpm` | INTEGER | yes | Canonical non-negative `maximumHeartRateBpm`; null means unavailable and cannot be below a present average. |
| `sport_ref` | TEXT | yes | Non-empty opaque canonical `sportRef`; null means unavailable and the value is not a display name. |
| `exercise_count` | INTEGER | yes | Canonical non-negative `exerciseCount`; null means the source collection was unavailable. |

The primary key is (`origin_id`, `session_id`). `training_session_start_origin` indexes (`started_at_local`, `origin_id`) for chronological range reads without creating a second identity.

## `training_session_provenance`

One append-only row records each training-session reconciliation decision, including decisions that do not change the visible summary.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `id` | INTEGER | no | Internal primary key. |
| `origin_id` | TEXT | no | First foreign-key component to `training_session`. |
| `session_id` | TEXT | no | Second foreign-key component to `training_session`. |
| `import_operation_id` | INTEGER | no | Foreign key to `import_operation`. |
| `artifact_locator` | TEXT | no | Protected ZIP member locator; never returned by the public outcome DTO. |
| `source_record_locator` | TEXT | no | Mapping version 1 uses `json-root`. |
| `source_artifact_sha256` | TEXT | no | Exact 64-character SHA-256 of expanded source bytes. |
| `source_provider` | TEXT | no | `polar-flow` for mapping version 1. |
| `source_adapter_version` | TEXT | no | `polar-flow-archive@4` for mapping version 1. |
| `mapping_version` | TEXT | no | `polar-flow-training-session@1`. |
| `source_modified_at_utc` | TEXT | no | Normalized incoming source revision. |
| `reconciliation_decision` | TEXT | no | `create`, `equivalent`, `amend`, `preserve`, or `conflict`. |
| `contributes_to_visible_state` | INTEGER | no | True for create, equivalent, and amend; false for preserve and conflict. |

`training_session_provenance_observation` indexes canonical identity and import operation. Provenance is protected personal-library state even when it contains opaque identifiers or hashes rather than display values.

## `training_session_conflict`

A conflict row records that equal source-revision evidence produced different canonical content without duplicating the complete competing summary.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `id` | INTEGER | no | Internal primary key. |
| `import_operation_id` | INTEGER | no | Foreign key to the operation that observed the conflict. |
| `origin_id` | TEXT | no | First foreign-key component to the retained session. |
| `session_id` | TEXT | no | Second foreign-key component to the retained session. |
| `existing_source_modified_at_utc` | TEXT | no | Revision of the visible session. |
| `incoming_source_modified_at_utc` | TEXT | no | Competing incoming revision. |
| `artifact_locator` | TEXT | no | Protected locator of the competing artifact. |
| `source_record_locator` | TEXT | no | Mapping version 1 uses `json-root`. |
| `mapping_version` | TEXT | no | Mapping that detected the conflict. |

The incoming artifact hash and decision remain available through the matching provenance row. `training_session_conflict_operation` indexes conflicts by import operation. Conflict resolution remains outside version 6.

## Reconciliation and transaction behavior

For one (`origin_id`, `session_id`) identity, canonical equality is equivalent. Different content with a later `source_modified_at_utc` replaces the full visible summary and increments `amended_observations`; an earlier revision is preserved without rollback; equal revision evidence is a conflict. Duplicate identity inside one ZIP rejects the package independently of member order.

Training rows, provenance, conflicts, report counters, source-subject state, and operation completion share the existing visibility transaction. Invalid input, cancellation, interruption, or a failed commit exposes no partial training history. Excluded nested data is consumed only for structural skipping and is never assigned a persistence table.

## Verification evidence

Contract, adapter, and integration tests protect minimal and multiple-exercise shapes, optional-field null semantics, values and official maxima, filename/content time agreement, excluded high-resolution content, duplicate identity, create, equivalent, amendment, preservation, conflict, opaque subject resolution, provenance, and canonical query results. Migration tests protect interrupted and recovered version 5 upgrades, the default amendment count for historical operations, table and index creation, and current-schema reopening.
