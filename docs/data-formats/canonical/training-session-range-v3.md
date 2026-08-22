# Canonical Training-Session Range Version 3

## Status and authority

This is the current normative provider-neutral contract for a person's named, contiguous selection inside
one recorded exercise and one explicit elapsed coordinate. It replaces the unfinished
[version-2 exercise-coordinate contract](training-session-range-v2.md) before a production range interface
was released. A `TrainingSessionRange` remains local user-authored evidence and its own aggregate root. It
does not modify imported facts, become a provider lap, or replace a reusable
[`SegmentCriterion`](segment-criterion.md).

The correction is necessary because declared exercise duration, route waypoint elapsed values, and regular
signal sample positions are separate recorded authorities. Equal numeric offsets do not align those
authorities. Version 3 names the authority explicitly and forbids FitFreed from manufacturing a relationship
through timestamp subtraction, proximity, interpolation, matching cardinality, or a shared exercise owner.

## Identity and fields

| Field | Type | Required | Semantics |
|---|---|---|---|
| `rangeRef` | opaque `range-` capability | yes | Stable local identity; provider and storage identifiers never cross the presentation boundary. |
| `sessionRef` | opaque `session-` capability | yes | The only session that owns the range. It cannot be reassigned. |
| `exerciseRef` | opaque `exercise-` capability or null | yes | The selected exercise. Null means preserved legacy session-coordinate evidence requiring explicit review. |
| `coordinate` | discriminated value object | yes | Exact authority that gives meaning to both elapsed boundaries. |
| `title` | 1 through 80 Unicode characters | yes | Trimmed user-authored name with no control characters. Names need not be unique. |
| `startedAtElapsedMilliseconds` | non-negative signed 64-bit integer | yes | Inclusive start in `coordinate`. |
| `endedAtElapsedMilliseconds` | positive signed 64-bit integer | yes | Exclusive end in the same `coordinate`, strictly after the start. |
| `evidenceRevision` | opaque `range-evidence-` capability | yes | Exact imported timing-evidence revision against which the owner, coordinate, and boundaries were accepted or reconciled. |
| `authorship` | `user` | yes | The selection and title are the person's interpretation. |
| `state` | `current` or `review-required` | yes | Whether the exact owner, coordinate, and boundaries remain supported by current compatible evidence. |
| `revision` | positive integer | yes | Optimistic aggregate revision, starting at 1. |

## Coordinate value object

Exactly one of these closed shapes is present:

| `scope` | Additional field | Authority and maximum |
|---|---|---|
| `exercise-elapsed` | none | Offset from the recorded exercise start. The declared exercise `durationMilliseconds` is its maximum. |
| `route-elapsed` | opaque `routeRef` | Offset from the start of that exact route representation. The greatest non-null recorded route-point `elapsedMilliseconds` is its maximum. A route with no recorded elapsed point supplies no range coordinate. |
| `signal-elapsed` | opaque `signalRef` | Regular sample position in that exact signal series. For a non-empty series, the maximum is `(sampleCount - 1) × intervalMilliseconds`; an empty series has maximum zero. No trailing interval after the last recorded sample is invented. |
| `legacy-session-elapsed` | none | Preserved version-1 session-relative evidence. It has no current exercise owner or current coordinate context and is always `review-required`. |

`routeRef` and `signalRef` are opaque application capabilities. Their internal provider or storage identity is
not part of this contract. A current non-legacy coordinate belongs to the named `exerciseRef`; a route or
signal capability from another exercise is invalid even if its numeric extent fits.

The maximum is a non-negative coordinate endpoint, not a duration claim and not an alignment with another
coordinate. A current range must end at or before that endpoint. Different coordinates can have different
maxima and gaps. Numeric boundaries from different coordinates cannot be compared, merged, ordered as one
timeline, or used to synchronize a map and signal without a separately recorded exact relationship.

## Lifecycle and concurrency

Creation validates identity, title, session and exercise ownership, a current non-legacy coordinate belonging
to that exercise, ordered boundaries, the exact coordinate maximum, and evidence revision. Renaming changes
only the title. Adjustment accepts one exercise capability, one complete coordinate value, and a complete new
boundary pair against the current context.

Session ownership cannot change. Once an exercise owner has been established it cannot change. Once a
non-legacy coordinate has been established, its scope and exact route or signal capability cannot change.
This prevents an edit from preserving equal numbers while silently changing their meaning.

A preserved legacy range is the sole exception: explicit adjustment may anchor it to one current exercise and
one current non-legacy coordinate. The complete boundary pair is treated as a new deliberate choice; no old
numeric value is assumed to transform into the selected coordinate. An unchanged rename or anchored
adjustment is idempotent. Every effective transition advances `revision` exactly once.

Removal is an explicit domain decision carrying `rangeRef`, `sessionRef`, nullable `exerciseRef`, the complete
`coordinate`, and the expected optimistic revision. Persistence deletes that exact aggregate atomically only
while owner, coordinate, and revision still match. It does not delete or modify imported evidence, criteria,
reports, or other ranges. Version 3 retains no canonical tombstone.

A stale expected revision is a conflict and never overwrites a newer authored change, evidence
reconciliation, or removal.

## Reimport and evidence compatibility

The evidence revision represents the visible imported timing evidence needed to resolve the range owner and
coordinate. Reconciliation classifies the next visible evidence rather than comparing only archive bytes:

- equivalent evidence leaves the range unchanged;
- compatible strict enrichment can rebase a current range only while the same exercise and exact coordinate
  capability still exist and still contain the unchanged boundaries;
- an amendment that can alter owner, coordinate identity, coordinate extent, or their evidence relationship
  is incompatible;
- a missing exercise, missing route or signal coordinate, or shorter exact coordinate extent is incompatible;
- a legacy range remains review-required under every automatic reconciliation.

A compatible rebase advances the optimistic revision because a concurrent editor must not save against older
evidence. Incompatible or missing evidence preserves identity, ownership, coordinate, title, exact authored
boundaries, and the latest evidence revision while setting `review-required`. It never clamps, rescales,
redirects, aligns, or deletes a range. Subsequent enrichment cannot clear an existing review requirement.

Review completes only through explicit adjustment against one current coordinate, even when the person
chooses the same numbers. Repeating the same reconciliation state is idempotent.

## Version-1 and version-2 preservation

SQLite schema 25 stored session-relative version-1 ranges. Schema 26 already retained those objects as
unanchored `legacy-session-elapsed`, null-`exerciseRef`, `review-required` evidence. Schema 27 preserves that
shape unchanged.

SQLite schema 26 also stored every exercise-owned version-2 range as `exercise-elapsed`. Schema 27 preserves
its identity, owners, title, numeric boundaries, evidence revision, state, optimistic revision, and local
timestamps; it records no coordinate reference because declared exercise elapsed remains its exact authority.

No migration or read adapter infers a route, signal, exercise, or transformation from ordinal, duration,
timestamps, availability, equal offsets, or nearby points.

## Separation, privacy, and portability

A source lap or phase is provider evidence. A route and a regular signal series are recorded representations
with independent coordinates. A range is one named selection authored in exactly one such coordinate. A
segment criterion is a reusable question that can derive several sections. A derived segment is disposable
FitFreed-calculated evidence. Equal numbers do not merge these objects or their authorship.

Range lists and summaries expose authorship and review state independently of color. Ranges may overlap,
share titles, or cover source laps exactly. Titles, boundaries, exercise relationships, and route or signal
selection can reveal analytical intent, location context, or physiological focus and remain local unless a
separately authorized export, report, MCP, or synchronization capability includes them.

Portable export must preserve opaque local identity, session and exercise ownership, the complete coordinate
shape, elapsed units, authorship, state, evidence revision, and optimistic revision without adding provider or
storage identifiers. Changing coordinate authority, identity, ownership, units, boundary inclusion, evidence
reconciliation, states, authorship, or revision semantics requires a new canonical version.
