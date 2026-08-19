# SQLite Persistence Schema Version 18

## Status and migration

Schema version 18 applies `0018_training_segment_criteria.sql` atomically after version 17. It adds reusable
user-authored segment criteria and ordered exercise associations. Existing provider-neutral session,
structure, route, signal, classification, workspace, and import evidence retains its version-17 meaning.

The migration creates no criterion or association from imported data. Empty version-17 libraries therefore
upgrade without invented personal interpretation.

## `segment_criterion`

One row stores one reusable definition.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `criterion_id` | TEXT | no | Primary `criterion-` identity with 64 lowercase hexadecimal characters. |
| `title` | TEXT | no | Trimmed 1-through-80-character authored title. |
| `criterion_kind` | TEXT | no | `equal-elapsed-time`, `equal-distance`, `heart-rate-zone`, or `manual-boundaries`. |
| `span_milliseconds` | INTEGER | yes | Positive time span only for `equal-elapsed-time`. |
| `span_meters` | REAL | yes | Finite distance span from 0.001 metres through the exclusive signed-64-bit millimetre ceiling, only for `equal-distance`. |
| `minimum_beats_per_minute` | INTEGER | yes | Inclusive lower heart-rate bound from 20 through 300 only for `heart-rate-zone`. |
| `maximum_beats_per_minute` | INTEGER | yes | Inclusive upper heart-rate bound from 20 through 300, not below the minimum. |
| `authorship` | TEXT | no | Exact code `user`; imported providers and FitFreed cannot author a definition. |
| `evaluation_version` | INTEGER | no | Exact current evaluator version `1`. |
| `revision` | INTEGER | no | Positive optimistic-concurrency revision. |
| `created_at_utc` | TEXT | no | Local-library creation audit timestamp. |
| `updated_at_utc` | TEXT | no | Latest effective edit audit timestamp. |

The row check enforces exactly the columns required by its kind. `segment_criterion_recent` supports stable
maintenance ordering without changing the title-ordered presentation query.

## `segment_criterion_manual_boundary`

Manual criteria store one exact positive `elapsed_milliseconds` value per zero-based `ordinal`. The
composite primary key is (`criterion_id`, `ordinal`); the foreign key binds the row to its criterion and the
unique (`criterion_id`, `elapsed_milliseconds`) constraint rejects repeated boundaries. Ordinal is limited
to 0 through 98. Domain restoration additionally requires strict ascending elapsed order.

Editing a criterion replaces its complete manual-boundary collection in the same transaction as the
compare-and-save revision update. Another definition kind has no boundary rows.

## `training_exercise_segment_criterion`

One row associates a reusable criterion with an exact source exercise identity.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id`, `session_id`, `exercise_id` | TEXT | no | Protected canonical exercise identity; only an opaque `exerciseRef` reaches presentation. |
| `criterion_id` | TEXT | no | Referenced reusable criterion. |
| `ordinal` | INTEGER | no | Non-negative contiguous personal order within the exercise. |
| `applied_at_utc` | TEXT | no | Local-library association audit timestamp. |

The primary key prevents duplicate application and the unique exercise-plus-`ordinal` constraint prevents
ambiguous ordering. `training_exercise_segment_criterion_order` supports deterministic reads.

The foreign key intentionally binds (`origin_id`, `session_id`) to `training_session`, while the exact
`exercise_id` remains protected association evidence. Import reconciliation deletes and recreates provider
exercise children; retaining the association at the session boundary lets an exact repeat or amendment with
the same exercise identity preserve personal intent. If a source revision removes or replaces that identity,
the association is not silently moved to another exercise. The reusable `segment_criterion` remains.

## Evaluation, transactions, and snapshots

Only definitions and ordered associations are persisted. `TrainingDerivedSegment` rows do not exist:
application queries deterministically stream current exact signal samples and calculate version-1 results.
This prevents stale calculations from masquerading as source evidence while allowing evaluator version and
criterion revision to remain explicit.

Create plus initial association, compare-and-save edit, apply, remove with ordinal compaction, and adjacent
move are separate atomic transactions. Move uses a temporary free ordinal so the uniqueness constraint
remains valid at every statement. Failed snapshots, missing identities, conflicts, or SQLite errors roll back
the complete mutation.

Criteria are authored library state and do not advance the canonical training-discovery snapshot. Their
queries nevertheless require the supplied snapshot to match current canonical evidence, so an import cannot
race a calculation. Opening a schema newer than 18 remains a rejected downgrade attempt. Migration
interruption leaves version 17 intact and retryable; versions 1 through 17 remain supported direct migration
baselines.

Criteria can reveal personal analytical intent and physiologic ranges. They remain inside the local SQLite
library unless a separately authorized export, report, MCP, backup, or synchronization capability includes
them deliberately.
