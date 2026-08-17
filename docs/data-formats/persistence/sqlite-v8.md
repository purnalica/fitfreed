# SQLite Persistence Schema Version 8

## Status and boundary

Version 8 extends the immutable [version 7 schema](sqlite-v7.md) with canonical nightly recovery, typed source-specific assessment, baseline and guidance components, provenance, conflicts, and a date-first query index. It implements [canonical nightly recovery version 1](../canonical/nightly-recovery.md) without storing the unidentifiable recovery blob, derived heart or breathing rates, assumed measurement boundaries, or provider status labels.

SQLite `PRAGMA user_version` stores value 8 after migration. New libraries apply every immutable migration through [`0008_nightly_recovery.sql`](../../../src-tauri/migrations/0008_nightly_recovery.sql) in one transaction. Existing version 7 libraries apply only version 8. An error or injected interruption rolls back every new table, index, and the version marker together.

Current Polar writes use source adapter `polar-flow-archive@6`, operation mapping set `polar-flow-mapping-set@1`, family mapping `polar-flow-nightly-recovery@1`, and source-specific scheme `polar-nightly-recharge@1`. Earlier activity, training, and sleep rows retain their family mapping versions and may record the current adapter version when imported by this application.

## `nightly_recovery`

One row is the current visible canonical observation. The primary key is (`origin_id`, `recovery_date`), and `nightly_recovery_date_origin` indexes (`recovery_date`, `origin_id`) for chronological range queries.

| Column group | SQLite columns | Contract |
|---|---|---|
| Identity | `origin_id`, `recovery_date` | Opaque origin plus source-assigned ISO date. |
| Shared measurements | `beat_to_beat_interval_milliseconds`, `heart_rate_variability_rmssd_milliseconds`, `breathing_interval_milliseconds` | Required intervals are positive. Optional RMSSD is non-negative and null means unavailable. |
| Assessment | `assessment_scheme`, `autonomic_charge`, `autonomic_status`, `overall_status`, `overall_sublevel` | All null or all present. Scheme is non-blank; charge uses -10 through 10, autonomic status 1 through 5, and overall status 1 through 6. |
| Baseline | `baseline_scheme`, `baseline_mean_beat_to_beat_interval_milliseconds`, `baseline_standard_deviation_beat_to_beat_interval_milliseconds`, `baseline_mean_heart_rate_variability_rmssd_milliseconds`, `baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds`, `baseline_mean_breathing_interval_milliseconds`, `baseline_standard_deviation_breathing_interval_milliseconds` | Core fields are all null or all present. The two RMSSD values are both null or both present. Means use the canonical positive or non-negative constraints; standard deviations are non-negative. |
| Guidance | `guidance_scheme`, `exercise_guidance`, `sleep_guidance`, `vitality_guidance` | All null or all present. Scheme and texts are non-blank; each text is limited to 4,096 characters. |

Typed components are stored as constrained columns rather than serialized provider objects or generic key-value rows. Scheme values are semantic data; they do not authorize adapter branching inside the core.

## `nightly_recovery_provenance`

One append-only row records each reconciliation decision under integer primary key `id`. It retains protected `artifact_locator`, `source_record_locator`, `source_artifact_sha256`, `source_provider`, `source_adapter_version`, `mapping_version`, and `import_operation_id` evidence.

`reconciliation_decision` is `create`, `equivalent`, `enrich`, `preserve`, or `conflict`. `contributes_to_visible_state` is true for create, equivalent, and enrichment; it is false for preserve and conflict. Locator and hash values remain protected library data and never enter public outcomes. `nightly_recovery_provenance_observation` indexes (`origin_id`, `recovery_date`, `import_operation_id`).

## `nightly_recovery_conflict`

A conflict row uses integer primary key `id` and records the operation, canonical identity, protected incoming `artifact_locator`, `source_record_locator`, and `mapping_version` without duplicating physiological values or guidance. The matching provenance row retains the source hash. `nightly_recovery_conflict_operation` indexes by `import_operation_id`.

## Reconciliation and transaction behavior

For one (`origin_id`, `recovery_date`) identity, exact canonical equality is equivalent. Strict optional enrichment replaces the visible row atomically. A strict loss of optional information is preserved without changing visible state. Changed required facts, changed known optional facts or schemes, and mixed additions and removals are conflicts because mapping version 1 has no orderable source revision.

Recovery rows, provenance, conflicts, source-subject state, report counters, and operation completion share the existing visibility transaction. Invalid structure, duplicate dates, cancellation, interruption, or commit failure exposes no partial recovery history.

## Verification obligations

Contract and migration tests protect every table, column, index, constraint, version transition, and interrupted upgrade. Domain, adapter, and persistence tests protect minimal and complete variants, independent optional groups, missing RMSSD, invalid ranges and groups, duplicate dates independent of order, exact repeat, enrichment, preservation, conflict, provenance, restart, range querying, excluded blob coverage, and the absence of sample content from canonical storage.
