# SQLite Persistence Schema Version 26

## Status and migration

Schema version 26 applies `0026_training_session_range_exercises.sql` atomically after version 25. It corrects
the unfinished range representation by making current ranges exercise-owned and exercise-relative. It does
not rewrite imported sessions, exercises, routes, signals, source structure, zones, criteria, reports, or
other application state. Versions 1 through 26 remain direct supported baselines.

The migration rebuilds `training_session_range` and its owner-order index inside the schema transaction.
Interruption before commit restores the complete version-25 table, rows, index, and schema marker. Retry starts
from that intact state.

Every version-25 row lacked the evidence needed to identify an exercise. The migration therefore preserves
its identity, session owner, title, boundaries, evidence revision, authorship, optimistic revision, and local
timestamps; adds a null exercise; records `legacy-session-elapsed`; and sets state to `review-required`. It
does not choose an exercise, transform a boundary, increment a revision, or delete authored evidence.

## `training_session_range`

One row is one named contiguous selection owned by one session and, for the current coordinate scope, one
exercise.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `range_id` | TEXT | no | Primary key and opaque `range-` capability with 64 lowercase hexadecimal characters. |
| `origin_id`, `session_id` | TEXT | no | Private canonical session owner identity resolved from the public session capability. It is never transported. |
| `exercise_id` | TEXT | yes | Private canonical exercise owner. Required for `exercise-elapsed`; null only for preserved `legacy-session-elapsed` evidence. |
| `coordinate_scope` | TEXT | no | Exactly `exercise-elapsed` or `legacy-session-elapsed`. |
| `title` | TEXT | no | Trimmed user-authored title from 1 through 80 characters; complete domain reconstruction also rejects control characters. |
| `started_at_elapsed_milliseconds` | INTEGER | no | Inclusive non-negative start on the coordinate named by `coordinate_scope`. |
| `ended_at_elapsed_milliseconds` | INTEGER | no | Exclusive end strictly after the start. A current exercise range cannot exceed the current exercise duration. |
| `evidence_revision` | TEXT | no | Opaque `range-evidence-` revision with 64 lowercase hexadecimal characters. |
| `authorship` | TEXT | no | Exactly `user`. |
| `state` | TEXT | no | Exactly `current` or `review-required`; legacy-session rows must be review-required. |
| `revision` | INTEGER | no | Positive optimistic aggregate revision. |
| `created_at_utc` | TEXT | no | Local-library creation timestamp; not a canonical fitness fact or public field. |
| `updated_at_utc` | TEXT | no | Latest effective authored or evidence-reconciliation transition timestamp. |

`training_session_range_owner_order` supports the bounded session query, coordinate and exercise grouping,
and elapsed ordering. Application-level title and opaque-identity comparison completes the deterministic
public order. Duplicate titles and overlapping exercise-relative boundaries are valid.

There is deliberately no foreign key from an authored range to imported session or exercise tables. The
range must survive as review-required evidence if either imported owner is temporarily unavailable; a cascade
would destroy the person's interpretation. Normal create and edit paths resolve the exact session and exercise
under one coherent training snapshot before writing. No operation may reassign a session owner or change an
established exercise owner.

## Transactions, concurrency, and reimport

Create, compare-and-save rename or adjustment, and compare-and-remove each use one immediate SQLite
transaction. Every mutation validates the current snapshot, owner, exercise, evidence revision, exercise
duration, aggregate revision, and complete committed result before commit. A stale optimistic revision changes
nothing. Removal deletes only the exact range and never affects imported evidence, criteria, reports, or other
ranges.

Explicit adjustment can anchor a preserved legacy row by setting its selected current `exercise_id`, changing
scope to `exercise-elapsed`, validating the complete replacement pair against that exercise, setting state to
`current`, and advancing its revision once in the same transaction. It does not reinterpret the old numeric
pair. Once set, `exercise_id` cannot change.

The evidence revision derives from the latest provenance event that actually changed visible canonical
session evidence and its timing contract. Exact repeat and semantically equivalent reimport leave ranges
unchanged. Compatible strict enrichment rebases an unchanged current range only while the same exercise and
boundaries remain valid. Amendment, missing exercise, shortened exercise duration, or legacy scope retains the
range as review-required without clamping, rescaling, redirecting, or deleting it. Reconciliation is part of
the same visibility transaction as the imported session change.

Session queries return at most 1,000 exercises and 1,000 ranges. Domain reconstruction rejects corrupted
identity, scope, owner, title, boundaries, authorship, state, evidence revision, or optimistic revision before
any result crosses the application boundary.

## Backup, portability, and privacy

The normal SQLite online backup includes the complete table and reopens it through the current adapter with
integrity checking. This makes ranges recoverable with the library; it does not make schema version 26 a
portable interchange format.

FitFreed's normalized portable export is not implemented in this version. A future portable contract must
preserve opaque range identity, session and exercise ownership, coordinate scope, elapsed units, title,
authorship, state, evidence revision, and optimistic revision without exposing private owner identities,
timestamps, provider identifiers, or storage layout. Until that contract exists, the presence of a range in
SQLite grants no authority to include it in reports, HTML export, MCP access, provider synchronization, or
another data transfer.
