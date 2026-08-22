# Training-Session Range Read Model Version 3

## Purpose and compatibility

This is the current provider-neutral boundary for reopening and changing a person's named contiguous
selections inside an explicit recorded coordinate. It replaces the unfinished
[version-2 exercise-duration response](training-session-range-v2.md) while retaining the version-1 query,
rename, and removal inputs.

- `query_training_session_ranges` accepts
  [`training-session-ranges-query-v1.schema.json`](../../../schemas/training-session-ranges-query-v1.schema.json).
- `create_training_session_range` accepts
  [`training-session-range-create-v3.schema.json`](../../../schemas/training-session-range-create-v3.schema.json).
- `rename_training_session_range` accepts
  [`training-session-range-rename-v1.schema.json`](../../../schemas/training-session-range-rename-v1.schema.json).
- `adjust_training_session_range` accepts
  [`training-session-range-adjust-v3.schema.json`](../../../schemas/training-session-range-adjust-v3.schema.json).
- `remove_training_session_range` accepts
  [`training-session-range-remove-v1.schema.json`](../../../schemas/training-session-range-remove-v1.schema.json).

Every command returns
[`training-session-ranges-v3.schema.json`](../../../schemas/training-session-ranges-v3.schema.json), the complete
committed range context for the requested session and snapshot. Version-1 and version-2 create, adjust, and
result payloads omit exact coordinate authority and are not accepted as version 3. The boundary accepts only
opaque application capabilities; provider identifiers, artifact locations, hashes, source-subject evidence,
account data, and database identity never cross it.

## Query and mutation input

The query contains `sessionRef` and a nullable `snapshotRef`. Null establishes the current coherent training
snapshot; a supplied value must still be current. Every mutation requires the returned `snapshotRef`.

Create additionally contains `exerciseRef`, `coordinate`, `title`, `startedAtElapsedMilliseconds`, and
`endedAtElapsedMilliseconds`. Adjust contains the exact `rangeRef`, positive `expectedRevision`,
`exerciseRef`, `coordinate`, and complete replacement boundary pair. Rename and remove retain their version-1
shapes because the application resolves the stored exact coordinate before either transition.

An input `coordinate` is discriminated by `scope` and is exactly one of:

- `{ "scope": "exercise-elapsed" }`;
- `{ "scope": "route-elapsed", "routeRef": "route-…" }`; or
- `{ "scope": "signal-elapsed", "signalRef": "signal-…" }`.

Mutation input never accepts `legacy-session-elapsed`. Explicit review anchors legacy evidence by supplying a
complete current coordinate and new boundary pair. The coordinate capability must appear under the selected
exercise in the accepted result context.

Elapsed values are canonical non-negative decimal strings within signed 64-bit range so millisecond precision
survives JavaScript transport. The end is positive and strictly after the start. Both values belong only to
the selected coordinate; the end cannot exceed that coordinate's `maximumElapsedMilliseconds`.

## Result shape and ordering

The result contains `snapshotRef`, `sessionRef`, decimal-text `sessionDurationMilliseconds`, opaque
`evidenceRevision`, at most 1,000 `exercises`, and at most 1,000 `ranges`. Session duration remains a session
fact and is not a universal range maximum.

Each exercise context contains opaque `exerciseRef`, unique non-negative source `ordinal`, and one through
1,000 unique `coordinates`. Every coordinate context contains:

- a non-legacy `coordinate` discriminated exactly as above; and
- decimal-text non-negative `maximumElapsedMilliseconds` for that exact authority.

`exercise-elapsed` is always present. A route coordinate is present only when that exact route has at least one
non-null recorded elapsed point, and its maximum is the greatest such point. A signal coordinate uses the
last exact regular sample position: `(sampleCount - 1) × intervalMilliseconds`, or zero for an empty series.
The context does not invent a trailing signal interval or align one representation with another.

Each range contains:

- opaque `rangeRef` and nullable `exerciseRef`;
- complete `coordinate`, including exact `routeRef` or `signalRef` when applicable;
- normalized user `title`;
- decimal-text `startedAtElapsedMilliseconds` and `endedAtElapsedMilliseconds`;
- the `evidenceRevision` against which those values were accepted or reconciled;
- `authorship` equal to `user`;
- `state` equal to `current` or `review-required`; and
- positive optimistic `revision`.

A current range names one exercise present in `exercises`, names one exact coordinate present under that
exercise, carries the result evidence revision, and fits that coordinate maximum. A review-required range can
retain an absent exercise, absent coordinate, or out-of-extent end. Null `exerciseRef` requires
`legacy-session-elapsed` and `review-required`; no current exercise context contains that legacy scope.

Ranges are ordered by owning exercise source ordinal, complete coordinate value, elapsed start, elapsed end,
normalized title, and opaque identity. Legacy evidence follows current exercise-owned ranges. Numeric offsets
from different coordinates are deliberately not used to claim a global session sequence. Overlap and
duplicate titles are valid and never merge identity.

## Atomicity, reimport, and failures

Every mutation returns the complete context from the same SQLite transaction that committed the change.
Presentation never constructs success by combining a write with a later unrelated query. An idempotent rename
or anchored adjustment performs no write and preserves the optimistic revision.

Exact-repeat and semantically equivalent reimports leave range and evidence revisions unchanged. Compatible
strict enrichment rebases a current range only while its exact exercise, coordinate capability, and boundaries
remain valid. An amendment, missing coordinate, or shorter exact extent retains the authored range as
review-required. Later enrichment cannot clear that state. A legacy range remains review-required until
explicit adjustment selects one current coordinate and validates the complete replacement pair.

Malformed capabilities, coordinate shapes, elapsed strings, boundaries, titles, or revisions fail as
`invalid-training-session-range`. A missing exercise, coordinate, or range fails as
`training-session-range-not-found`; stale optimistic state as `training-session-range-conflict`; a changed
canonical snapshot as `training-session-ranges-changed`; and unavailable, inconsistent, interrupted, or
corrupt persistence as `training-session-range-failed`. Every failure leaves the previous committed context
intact.

## Presentation and privacy obligations

Presentation keeps authorship and review state perceivable without relying on color, identifies the exercise
and coordinate in human language rather than exposing capabilities, retains exact evidence while boundaries
are adjusted, exposes cancellation without mutation, and distinguishes personal ranges from source structure
and reusable criteria.

Range Summary may combine only evidence proven to use the range coordinate or an explicit recorded alignment.
This contract does not authorize presentation to compare equal offsets across coordinates, subtract local
timestamps, interpolate missing values, or infer an alignment. Independently explorable evidence remains
available even when synchronized projection is unavailable.

Titles and boundaries can reveal location, physiological focus, or analytical intent. All processing remains
local. This contract grants no authority to export a range, include it in a report, expose it through MCP, or
synchronize it with any provider.
