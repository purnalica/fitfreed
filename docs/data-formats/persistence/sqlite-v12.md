# SQLite Persistence Schema Version 12

## Status and migration

Schema version 12 applies `0012_sport_classification.sql` atomically after version 11. It adds authored
sport meaning and an indexed detected-sport projection path without changing canonical training sessions,
source references, provenance, or import reconciliation.

## `sport_classification`

One row represents the current user-authored revision for exact key (`origin_id`, `source_sport_ref`).
`origin_id` references `observation_origin`; `source_sport_ref` preserves the exact non-empty source value.
The pair is the primary key and is never exposed as a presentation label.

`classification_state` is `unknown` or `classified`. `canonical_family` is null or one version-1 family
code from the [canonical contract](../canonical/sport-classification.md). `display_label` is null or a
trimmed value of one through 80 characters. `authorship` is `user`; `revision` is a positive monotonic
integer; and `updated_at_utc` is the application-written update time.

An `unknown` row has neither family nor label. A `classified` row has at least one. An absent row means an
unresolved revision-zero unknown and avoids writing inferred meaning during import. Compare-and-save uses
the stored `revision`; a stale editor changes no row.

## Discovery index

`training_session_origin_sport_start` orders `training_session` by `origin_id`, nullable `sport_ref`,
`started_at_local`, and `session_id`. It supports full-history detected-sport grouping and stable session
discovery. Null remains “source sport unavailable” and is never coalesced with an opaque source reference.

## Lifecycle and compatibility

Import and reimport never write `sport_classification`. They may add sessions carrying a previously unseen
source reference, which reads as unknown. Whole-library backup and restore include authored rows. Migration
interruption rolls back the table, index, and schema marker together. Version 11 remains a supported direct
migration baseline under the release upgrade matrix.
