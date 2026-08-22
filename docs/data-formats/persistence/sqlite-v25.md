# SQLite Persistence Schema Version 25

## Status and migration

This immutable document records the preceding session-coordinate storage contract. The current schema is
[SQLite version 26](sqlite-v26.md), which preserves every version-25 range as unanchored review evidence and
requires exercise ownership for current ranges.

Schema version 25 applies `0025_training_session_ranges.sql` atomically after version 24. It adds durable
user-authored ranges without rewriting imported sessions, source structure, routes, signals, zones,
segmentation criteria, reports, or existing application state. Versions 1 through 25 remain direct supported
baselines.

The migration creates `training_session_range` and its owner-order index inside the schema transaction. An
interruption before commit restores the complete version-24 schema and marker; retry starts from that intact
state. The migration creates no ranges and derives no authored meaning from imported evidence.

## `training_session_range`

One row is one named contiguous selection owned by one training session.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `range_id` | TEXT | no | Primary key and opaque `range-` capability with 64 lowercase hexadecimal characters. |
| `origin_id`, `session_id` | TEXT | no | Private canonical owner identity resolved from the public session capability. It is never transported. |
| `title` | TEXT | no | Trimmed user-authored title from 1 through 80 characters; complete domain reconstruction also rejects control characters. |
| `started_at_elapsed_milliseconds` | INTEGER | no | Inclusive non-negative start on the session elapsed coordinate. |
| `ended_at_elapsed_milliseconds` | INTEGER | no | Exclusive end strictly after the start. A current authored range cannot exceed the current session duration. |
| `evidence_revision` | TEXT | no | Opaque `range-evidence-` revision with 64 lowercase hexadecimal characters. |
| `authorship` | TEXT | no | Exactly `user`. |
| `state` | TEXT | no | Exactly `current` or `review-required`. |
| `revision` | INTEGER | no | Positive optimistic aggregate revision. |
| `created_at_utc` | TEXT | no | Local-library creation timestamp; not a canonical fitness fact or public field. |
| `updated_at_utc` | TEXT | no | Latest effective authored or evidence-reconciliation transition timestamp. |

`training_session_range_owner_order` supports the bounded owner query ordered by elapsed start, elapsed end,
identity, with application-level title ordering completing the public deterministic order. Duplicate titles
and overlapping boundaries are valid.

There is deliberately no foreign key from an authored range to `training_session`. The range must survive as
review-required evidence if its imported owner is temporarily unavailable; a cascade would destroy the
person's interpretation. Normal create and edit paths nevertheless resolve the exact owner and coherent
training snapshot before writing. No operation may reassign a range to another session.

## Transactions, concurrency, and reimport

Create, compare-and-save rename or adjustment, and compare-and-remove each use one immediate SQLite
transaction. Every mutation validates the current training snapshot, owner, evidence revision, session
duration, aggregate revision, and complete committed result before commit. A stale optimistic revision changes
nothing. Removal deletes only the exact range and never affects imported evidence, criteria, reports, or other
ranges.

The evidence revision is derived from the latest provenance event that actually changed visible canonical
session evidence (`create`, `enrich`, or `amend`) and its timing contract. A semantically equivalent import is
not a new evidence revision merely because its archive bytes or provenance row differ. Exact repeat and
equivalent reimport therefore leave ranges unchanged. Compatible strict enrichment rebases unchanged current
boundaries to the new evidence revision but never clears an existing review requirement. Amendment marks every
retained range review-required without clamping, rescaling, redirecting, or deleting its authored boundaries.
Reconciliation is part of the same visibility transaction as the imported session change.

Owner queries return at most 1,000 ranges. Domain reconstruction rejects corrupted identity, title,
boundaries, authorship, state, evidence revision, or optimistic revision before any result crosses the
application boundary.

## Backup, portability, and privacy

The normal SQLite online backup includes the complete table and reopens it through the current adapter with
integrity checking. This makes ranges recoverable with the library; it does not make schema version 25 a
portable interchange format.

FitFreed's normalized portable export is not implemented in this version. A future portable contract must
preserve opaque range identity, session ownership, elapsed units, title, authorship, state, evidence revision,
and optimistic revision without exposing `origin_id`, `session_id`, timestamps, provider identifiers, or
storage layout. Until that contract exists, the presence of a range in SQLite grants no authority to include
it in reports, HTML export, MCP access, provider synchronization, or another data transfer.
