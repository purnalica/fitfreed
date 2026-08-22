# Training-Session Range Read Model Version 1

## Purpose and commands

This provider-neutral boundary persists and reopens a person's named contiguous selections within one
training session. It exposes authored range state independently from provider laps, reusable segmentation
criteria, and disposable derived sections.

- `query_training_session_ranges` accepts
  [`training-session-ranges-query-v1.schema.json`](../../../schemas/training-session-ranges-query-v1.schema.json).
- `create_training_session_range` accepts
  [`training-session-range-create-v1.schema.json`](../../../schemas/training-session-range-create-v1.schema.json).
- `rename_training_session_range` accepts
  [`training-session-range-rename-v1.schema.json`](../../../schemas/training-session-range-rename-v1.schema.json).
- `adjust_training_session_range` accepts
  [`training-session-range-adjust-v1.schema.json`](../../../schemas/training-session-range-adjust-v1.schema.json).
- `remove_training_session_range` accepts
  [`training-session-range-remove-v1.schema.json`](../../../schemas/training-session-range-remove-v1.schema.json).

Every command returns
[`training-session-ranges-v1.schema.json`](../../../schemas/training-session-ranges-v1.schema.json), the complete
committed range context for the requested session and snapshot. The boundary accepts only opaque `sessionRef`,
`snapshotRef`, and `rangeRef` capabilities. Provider identifiers, artifact locations, hashes, source-subject
evidence, account data, and local database identity never cross it.

## Query and mutation input

The query contains `sessionRef` and a nullable `snapshotRef`. Null establishes the current coherent training
snapshot; a supplied value must still be current. Every mutation requires that returned `snapshotRef`.

Create additionally contains `title`, `startedAtElapsedMilliseconds`, and
`endedAtElapsedMilliseconds`. Rename contains the exact `rangeRef`, positive `expectedRevision`, and new
`title`. Adjust contains the exact range and revision plus the complete replacement boundary pair. Remove
contains the exact range and revision. Elapsed values are canonical non-negative decimal strings so signed
64-bit millisecond precision survives JavaScript transport; the end must be positive and domain validation
requires it to be strictly after the start.

## Result shape and ordering

The result contains `snapshotRef`, `sessionRef`, decimal-text `sessionDurationMilliseconds`, opaque
`evidenceRevision`, and at most 1,000 `ranges`. Each range contains:

- opaque `rangeRef`;
- normalized user `title`;
- decimal-text `startedAtElapsedMilliseconds` and `endedAtElapsedMilliseconds`;
- the `evidenceRevision` against which those boundaries were last accepted;
- `authorship` equal to `user`;
- `state` equal to `current` or `review-required`; and
- positive optimistic `revision`.

Ranges are ordered by elapsed start, elapsed end, normalized title, and opaque identity. Overlap and duplicate
titles are valid and do not merge identity. A current range always carries the result evidence revision and
fits the current session duration. A review-required range retains its exact authored boundaries even when a
new duration no longer contains them.

## Atomicity, reimport, and failure semantics

Every mutation returns the complete context from the same SQLite transaction that committed the change.
Presentation never constructs success by combining a write with a later unrelated query. An idempotent rename
or adjustment performs no write and preserves the optimistic revision.

Exact-repeat and semantically equivalent reimports leave both range and evidence revisions unchanged.
Compatible strict enrichment rebases current ranges without changing their numeric boundaries. An amendment
retains them as review-required, and later enrichment cannot clear that state. Explicit adjustment against
current evidence completes review, including when the person deliberately confirms the same pair of boundaries.

Malformed capabilities, titles, elapsed strings, boundaries, or revisions fail as
`invalid-training-session-range`. A missing owner or range fails as `training-session-range-not-found`; stale
optimistic state as `training-session-range-conflict`; a changed canonical snapshot as
`training-session-ranges-changed`; and unavailable, inconsistent, interrupted, or corrupt persistence as
`training-session-range-failed`. Every failure leaves the previous committed context intact.

## Presentation and privacy obligations

Presentation must keep authorship and review state perceivable without relying on color, retain the route or
other exact evidence while a range is adjusted, expose cancel without mutation, and distinguish personal
ranges from source structure and reusable criteria. Range Summary metrics, synchronized boundary selection,
source-range projection, and export are separate contracts; this version does not authorize presentation to
join lower-layer queries or infer them.

Titles and boundaries can reveal location, physiological focus, or analytical intent. All processing remains
local. This contract grants no authority to export a range, include it in a report, expose it through MCP, or
synchronize it with any provider.
