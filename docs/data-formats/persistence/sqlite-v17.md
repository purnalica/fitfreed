# SQLite Persistence Schema Version 17

## Status and migration

Schema version 17 applies `0017_training_session_signals.sql` atomically after version 16. It adds
provider-neutral signal assessments, regular-series metadata, and exact temporal samples below existing
training exercises. All earlier facts retain their version-16 meaning.

Current Polar writes use source adapter `polar-flow-archive@9`, operation mapping set
`polar-flow-mapping-set@4`, and training mapping `polar-flow-training-session@4`. Earlier provenance remains
valid and identical source bytes can be strictly enriched when the active mapping first evaluates signals.

## Assessment tables

`training_session_signal_assessment` contains one optional row per training session. `exercises_present`
preserves absent versus present exercise collections and `mapping_version` records the non-empty mapping that
made the assessment.

`training_exercise_signal_assessment` contains one source-ordered row per assessed structural exercise.
`signals_present` preserves an absent signal container. When present, `primary_present` and
`transition_present` independently distinguish absent, present-empty, and populated series collections.
`unsupported_primary_series_count` and `unsupported_transition_series_count` are non-negative compatibility
evidence. The table constrains all collection bits and counts to their null-container state and references the
same existing `training_exercise` identity.

The `training_exercise_signal_session_order` index supports deterministic assessment reads.

## `training_signal_series`

One row describes one mapped regular series.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id`, `session_id`, `exercise_id` | TEXT | no | Parent canonical identity. |
| `role` | TEXT | no | `primary` or `transition`; roles never merge. |
| `ordinal` | INTEGER | no | Zero-based contiguous order among mapped series in that role. |
| `kind` | TEXT | no | Canonical signal kind from version 1. |
| `unit` | TEXT | no | Exact canonical unit required by `kind`. |
| `interval_milliseconds` | INTEGER | no | Positive regular sample interval. |
| `sample_count` | INTEGER | no | Non-negative exact slot count. |
| `available_sample_count` | INTEGER | no | Non-null slots, not above `sample_count`. |

The table check enforces every valid kind/unit pair. The primary key is parent exercise, role, and ordinal;
duplicate kinds are permitted because distinct source series remain distinct.
`training_signal_series_exercise_order` supports deterministic overview reads.

## `training_signal_sample`

One row stores one exact source slot. `series_ordinal` identifies its parent series, `ordinal` is zero-based
and contiguous, and nullable finite `value` preserves an explicitly unavailable slot as SQL null. A null is
never omitted, zero-filled, carried forward, or interpolated. Elapsed time is derived with checked arithmetic
from `ordinal * interval_milliseconds` rather than duplicated in storage.

The composite primary and foreign keys bind every slot to exactly one series.
`training_signal_sample_series_order` supports exact stable pages and source-ordinal visual selection. The
partial `training_signal_sample_gap_order` index contains only unavailable slots, allowing a bounded visual
projection to retain discontinuities without scanning present values or loading the complete series.

## Reconciliation, snapshots, and resources

Import validates the complete artifact before the canonical transaction. Reconciliation reconstructs one
session's exact signal evidence at a time; create, strict mapping enrichment, and newer-source amendment then
replace summary, structure, routes, series, and samples atomically. Deletion proceeds from samples toward the
parent exercise, and insertion proceeds from the exercise toward samples. Reimport never appends duplicates.

Changes to `training_session_signal_assessment` advance `training_discovery_revision`, so bounded overview and
exact-page queries cannot combine evidence from different library revisions. Overview reads select at most
500 exact source ordinals per series; exact reads return at most 250 slots. Neither path loads a complete
history of sample values.

Signal values and protected identities remain local library state. Presentation receives only opaque,
domain-separated session, exercise, and signal capabilities. Migration interruption rolls back every table,
index, trigger, and version marker together. Version 16 remains a supported direct migration baseline.
