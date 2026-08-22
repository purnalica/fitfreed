# Training-Session Range Read Model Version 2

## Purpose and compatibility

This is the current provider-neutral boundary for reopening and changing a person's named contiguous
selections inside recorded exercises. It replaces the unfinished
[version-1 session-coordinate response](training-session-range-v1.md) while retaining the same query, rename,
and removal inputs.

- `query_training_session_ranges` accepts
  [`training-session-ranges-query-v1.schema.json`](../../../schemas/training-session-ranges-query-v1.schema.json).
- `create_training_session_range` accepts
  [`training-session-range-create-v2.schema.json`](../../../schemas/training-session-range-create-v2.schema.json).
- `rename_training_session_range` accepts
  [`training-session-range-rename-v1.schema.json`](../../../schemas/training-session-range-rename-v1.schema.json).
- `adjust_training_session_range` accepts
  [`training-session-range-adjust-v2.schema.json`](../../../schemas/training-session-range-adjust-v2.schema.json).
- `remove_training_session_range` accepts
  [`training-session-range-remove-v1.schema.json`](../../../schemas/training-session-range-remove-v1.schema.json).

Every command returns
[`training-session-ranges-v2.schema.json`](../../../schemas/training-session-ranges-v2.schema.json), the complete
committed range context for the requested session and snapshot. Version-1 create, adjust, and result payloads
do not carry enough exercise ownership to be accepted by version 2. The boundary accepts only opaque
application capabilities; provider identifiers, artifact locations, hashes, source-subject evidence, account
data, and database identity never cross it.

## Query and mutation input

The query contains `sessionRef` and a nullable `snapshotRef`. Null establishes the current coherent training
snapshot; a supplied value must still be current. Every mutation requires the returned `snapshotRef`.

Create additionally contains `exerciseRef`, `title`, `startedAtElapsedMilliseconds`, and
`endedAtElapsedMilliseconds`. Adjust contains the exact `rangeRef`, positive `expectedRevision`,
`exerciseRef`, and complete replacement boundary pair. Rename and remove retain their version-1 shapes.

Elapsed values are canonical non-negative decimal strings so signed 64-bit millisecond precision survives
JavaScript transport. The end is positive and must be strictly after the start. Create and adjust resolve the
exercise against the accepted session snapshot and require the end not to exceed its declared duration. An
anchored range cannot be moved to another exercise. Adjust may explicitly anchor an unanchored legacy range.

## Result shape and ordering

The result contains `snapshotRef`, `sessionRef`, decimal-text `sessionDurationMilliseconds`, opaque
`evidenceRevision`, at most 1,000 `exercises`, and at most 1,000 `ranges`.

Each exercise context contains:

- opaque `exerciseRef`;
- unique non-negative source `ordinal`; and
- decimal-text `durationMilliseconds`.

The context is authority for create and adjust validation, not a complete exercise read model. Clients obtain
sport, structure, route, signal, and zone evidence through their existing coherent application boundaries.

Each range contains:

- opaque `rangeRef` and nullable `exerciseRef`;
- normalized user `title`;
- decimal-text `startedAtElapsedMilliseconds` and `endedAtElapsedMilliseconds`;
- the `evidenceRevision` against which those boundaries were last accepted or reconciled;
- `authorship` equal to `user`;
- `state` equal to `current` or `review-required`; and
- positive optimistic `revision`.

A current range always names one exercise present in `exercises`, carries the result evidence revision, and
fits that exercise duration. A review-required range can retain an absent exercise or out-of-duration end. A
null exercise is permitted only for preserved version-1 session-coordinate evidence and is always
review-required.

Ranges are ordered by elapsed start, elapsed end, normalized title, and opaque identity. The coordinate is
meaningful only within the range's exercise; list ordering does not join exercise timelines or claim a global
session sequence. Overlap and duplicate titles are valid and never merge identity.

## Atomicity, reimport, and failures

Every mutation returns the complete context from the same SQLite transaction that committed the change.
Presentation never constructs success by combining a write with a later unrelated query. An idempotent rename
or anchored adjustment performs no write and preserves the optimistic revision.

Exact-repeat and semantically equivalent reimports leave range and evidence revisions unchanged. Compatible
strict enrichment rebases current ranges only while the same exercise and exact boundaries remain valid. An
amendment, missing exercise, or shortened exercise retains the authored range as review-required. Later
enrichment cannot clear that state. An unanchored migrated range remains review-required until explicit
adjustment selects one exercise and validates the complete replacement pair.

Malformed capabilities, titles, elapsed strings, boundaries, or revisions fail as
`invalid-training-session-range`. A missing owner, exercise, or range fails as
`training-session-range-not-found`; stale optimistic state as `training-session-range-conflict`; a changed
canonical snapshot as `training-session-ranges-changed`; and unavailable, inconsistent, interrupted, or
corrupt persistence as `training-session-range-failed`. Every failure leaves the previous committed context
intact.

## Presentation and privacy obligations

Presentation keeps authorship and review state perceivable without relying on color, identifies the exercise
in human language rather than exposing its capability, retains the exact evidence while boundaries are
adjusted, exposes cancellation without mutation, and distinguishes personal ranges from source structure and
reusable criteria.

Range Summary metrics, synchronized boundary selection, exact source-range projection, and export are
separate contracts. This version does not authorize presentation to join lower-layer queries, treat local
timestamps as elapsed alignment, interpolate missing values, or infer an exercise for legacy evidence.

Titles and boundaries can reveal location, physiological focus, or analytical intent. All processing remains
local. This contract grants no authority to export a range, include it in a report, expose it through MCP, or
synchronize it with any provider.
