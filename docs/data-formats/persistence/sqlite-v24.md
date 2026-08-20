# SQLite Persistence Schema Version 24

## Status and migration

Schema version 24 applies `0024_compact_training_signal_samples.sql` atomically after version 23. It changes
only the physical identity of regular training-signal series and samples. Every version-23 assessment,
series kind, unit, role, source order, interval, exact value, explicit null slot, count, exercise relation,
and mapping version retains its meaning. Versions 1 through 24 remain direct supported baselines.

The migration renames the two version-23 signal tables, creates the compact tables, copies series in stable
logical order, joins every old sample to its new internal series identity, then removes the old tables and
equivalent indexes inside one schema transaction. Interruption before commit restores the complete
version-23 representation and marker.

Dropping the old dense tables creates free pages without shrinking the SQLite file. The migration therefore
records a `compact-signal-storage` maintenance task before commit. Startup runs `VACUUM` outside the schema
transaction and removes the marker only after compaction succeeds. Interruption or insufficient storage
leaves the migrated evidence intact and the task retryable; ordinary library use does not proceed while the
required maintenance remains unsuccessful.

## `training_signal_series`

One row retains one mapped regular series.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `series_id` | INTEGER | no | Positive internal row identity and primary key; never a canonical or public identifier. |
| `origin_id`, `session_id`, `exercise_id` | TEXT | no | Parent canonical identity and foreign key to the assessed exercise. |
| `role` | TEXT | no | Exactly `primary` or `transition`. |
| `ordinal` | INTEGER | no | Zero-based source order among mapped series in the same role. |
| `kind` | TEXT | no | Canonical signal kind from training-signal version 1. |
| `unit` | TEXT | no | Exact canonical unit required by `kind`. |
| `interval_milliseconds` | INTEGER | no | Positive regular source interval. |
| `sample_count` | INTEGER | no | Non-negative exact slot count. |
| `available_sample_count` | INTEGER | no | Non-null slot count, never above `sample_count`. |

The unique key `(origin_id, session_id, exercise_id, role, ordinal)` remains the logical series identity and
supports ordered series lookup. Duplicate kinds remain valid when the source contains distinct series.
`series_id` is an infrastructure implementation detail assigned on insertion or migration.

## `training_signal_sample`

One `WITHOUT ROWID` row stores one exact source slot.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `series_id` | INTEGER | no | Foreign key to `training_signal_series`; series deletion cascades. |
| `ordinal` | INTEGER | no | Zero-based contiguous source slot and second primary-key component. |
| `value` | REAL | yes | Exact finite mapped value, or null for the explicit source `NaN` gap marker. |

The primary key `(series_id, ordinal)` is the only complete ordering structure. It supports exact pages,
selected visual ordinals, reconstruction, and streaming segmentation. The partial
`training_signal_sample_gap_order` index contains only null slots for bounded discontinuity checks. Elapsed
time remains checked application arithmetic over `ordinal * interval_milliseconds`; it is not duplicated.

## `library_maintenance`

The table contains only constrained implementation tasks required to finish a committed migration. Version
24 permits the exact `compact-signal-storage` task. It contains no provider, fitness, path, host, or user
information and is empty after successful maintenance.

## Reconciliation, querying, and privacy

Signal writes insert logical series metadata first, obtain its private numeric identity, and insert exact
samples beneath it. Whole-session amendment or enrichment deletes the old series and cascades their samples
before inserting the replacement inside the same canonical transaction. Exact reimport remains fingerprinted
and creates no new rows.

Infrastructure resolves opaque application capabilities against logical series identity. The numeric key
does not enter domain values, application DTOs, transport JSON, navigation, reports, diagnostics, or portable
formats. Bounded overview selects at most 500 exact ordinals per series, exact pages remain capped at 250,
and user-authored segmentation streams one resolved series without loading unrelated histories.

The deterministic dense-history gate is specified in the [performance benchmark guide](../../development/performance-benchmarks.md).
It covers 520 weekly sessions across ten years, four supported one-second series and 3,601 slots per series:
2,080 series and 7,490,080 exact samples. Three fresh production-import processes must preserve the exact
counts and pass initial import, exact reimport, peak memory, 512 MiB database size, complete-history session
discovery, bounded overview, and exact-page budgets on each maintained performance environment.
