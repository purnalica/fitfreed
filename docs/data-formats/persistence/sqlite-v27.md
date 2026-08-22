# SQLite Persistence Schema Version 27

## Status and migration

Schema version 27 applies `0027_training_session_range_coordinates.sql` atomically after version 26. It makes
the exact elapsed authority of every personal range explicit without changing imported sessions, exercises,
routes, signals, source structure, zones, criteria, reports, or other application state. Versions 1 through 27
remain direct supported baselines.

The migration rebuilds `training_session_range` and `training_session_range_owner_order` inside the schema
transaction. Interruption before commit restores the complete version-26 table, rows, index, and schema marker.
Retry starts from that intact state.

Every version-26 exercise-owned row already used the declared exercise elapsed coordinate. Migration preserves
all columns and values exactly and adds null `coordinate_ref`. Every previously preserved
`legacy-session-elapsed` row remains unanchored and `review-required`. Migration does not infer a route or
signal from matching offsets, duration, ordinal, timestamp, or availability; does not change state or
revision; and does not delete authored evidence.

## `training_session_range`

One row is one named contiguous selection owned by one session and, for a current range, one exercise and one
exact coordinate.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `range_id` | TEXT | no | Primary key and opaque `range-` capability with 64 lowercase hexadecimal characters. |
| `origin_id`, `session_id` | TEXT | no | Private canonical session owner identity resolved from the public capability. It is never transported. |
| `exercise_id` | TEXT | yes | Private canonical exercise owner; required for every non-legacy coordinate and null only for preserved legacy evidence. |
| `coordinate_scope` | TEXT | no | Exactly `exercise-elapsed`, `route-elapsed`, `signal-elapsed`, or `legacy-session-elapsed`. |
| `coordinate_ref` | TEXT | yes | Null for exercise and legacy scope; exact opaque `route-` or `signal-` capability for its matching scope. |
| `title` | TEXT | no | Trimmed user-authored title from 1 through 80 characters; domain reconstruction also rejects control characters. |
| `started_at_elapsed_milliseconds` | INTEGER | no | Inclusive non-negative start in the stored coordinate. |
| `ended_at_elapsed_milliseconds` | INTEGER | no | Exclusive end strictly after the start. A current range cannot exceed its current exact coordinate maximum. |
| `evidence_revision` | TEXT | no | Opaque `range-evidence-` revision with 64 lowercase hexadecimal characters. |
| `authorship` | TEXT | no | Exactly `user`. |
| `state` | TEXT | no | Exactly `current` or `review-required`; legacy rows must be review-required. |
| `revision` | INTEGER | no | Positive optimistic aggregate revision. |
| `created_at_utc` | TEXT | no | Local-library creation timestamp; not a canonical fitness fact or public field. |
| `updated_at_utc` | TEXT | no | Latest effective authored or evidence-reconciliation transition timestamp. |

The table check makes scope, owner, and reference one indivisible representation:

- `exercise-elapsed` requires `exercise_id` and null `coordinate_ref`;
- `route-elapsed` requires `exercise_id` and one valid 70-character `route-` capability;
- `signal-elapsed` requires `exercise_id` and one valid 71-character `signal-` capability; and
- `legacy-session-elapsed` requires null `exercise_id`, null `coordinate_ref`, and `review-required` state.

SQLite checks protect representation shape. The application resolves the opaque capability under the exact
session and exercise and validates the range against the current coordinate extent before a write.

`training_session_range_owner_order` indexes private session identity, `coordinate_scope`, `coordinate_ref`,
`exercise_id`, boundaries, and `range_id`. Application ordering additionally uses exercise ordinal, title,
and complete capability ordering. Duplicate titles and overlapping boundaries in one coordinate are valid.
Offsets from different coordinates are never ordered as one elapsed timeline.

There is deliberately no foreign key from an authored range to imported session, exercise, route, or signal
tables. The range must survive as review-required evidence if current imported evidence is temporarily absent;
a cascade would destroy the person's interpretation.

## Coordinate extent and transactions

Create and adjustment resolve one coordinate context in the accepted snapshot:

- exercise maximum is the declared `duration_milliseconds` for that exercise only;
- route maximum is the greatest non-null `elapsed_milliseconds` in `training_route_point` for the exact route;
- signal maximum is `(sample_count - 1) × interval_milliseconds` for a non-empty exact
  `training_signal_series`, or zero when `sample_count` is zero.

Negative values, multiplication overflow, missing route elapsed evidence, invalid signal intervals, unknown
roles or kinds, and mismatched capability ownership fail before a range context crosses the adapter boundary.
No local timestamp subtraction or cross-representation numeric equality supplies alignment.

Create, compare-and-save rename or adjustment, and compare-and-remove use one immediate SQLite transaction.
Every mutation validates the current snapshot, exact owner and coordinate, evidence revision, coordinate
extent, aggregate revision, and complete committed result. A stale optimistic revision changes nothing.
Removal matches `exercise_id`, `coordinate_scope`, `coordinate_ref`, and revision before deleting only the
target range.

Explicit adjustment can anchor a legacy row by setting one current `exercise_id`, one current non-legacy
scope and reference, a complete newly validated boundary pair, `current` state, and the next revision in the
same transaction. Once established, the exercise and coordinate authority cannot change.

## Reimport, backup, and privacy

Exact repeat and semantically equivalent reimport leave ranges unchanged. Compatible enrichment rebases a
current range only while the same exercise, exact coordinate capability, and boundaries remain valid.
Amendment, missing coordinate, shorter extent, or legacy scope preserves the range as `review-required`
without clamping, rescaling, redirecting, aligning, or deleting it. Reconciliation shares the imported
session's visibility transaction.

SQLite online backup includes the complete schema-27 table and reopens it through current integrity checks.
This makes ranges recoverable with the library; it does not make schema version 27 a portable interchange
format.

FitFreed's normalized range export is not implemented in this version. A future portable contract must
preserve opaque range identity, session and exercise ownership, complete coordinate shape, elapsed units,
title, authorship, state, evidence revision, and optimistic revision without exposing private owner identity,
timestamps, provider identifiers, or storage layout. Until then, SQLite presence grants no authority to
include a range in reports, HTML export, MCP access, provider synchronization, or another transfer.
