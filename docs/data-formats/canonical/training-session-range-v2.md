# Canonical Training-Session Range Version 2

## Status and authority

This is the current normative provider-neutral contract for a person's named, contiguous selection inside
one recorded exercise. It replaces the unfinished
[version-1 session-coordinate contract](training-session-range.md) before a production range interface was
released. A `TrainingSessionRange` remains local user-authored evidence and its own aggregate root. It does
not modify imported exercise facts, become a provider lap, or replace a reusable
[`SegmentCriterion`](segment-criterion.md).

The range references exactly one training session and, for current version-2 evidence, exactly one exercise
inside that session. Session ownership cannot change. Exercise ownership cannot change after it has been
established. A nullable exercise is accepted only to preserve a version-1 object whose session-relative
coordinate cannot be transformed truthfully; that object is always `review-required`.

## Identity and fields

| Field | Type | Required | Semantics |
|---|---|---|---|
| `rangeRef` | opaque `range-` capability | yes | Stable local identity; provider and storage identifiers never cross the presentation boundary. |
| `sessionRef` | opaque `session-` capability | yes | The only session that owns the range. It cannot be reassigned. |
| `exerciseRef` | opaque `exercise-` capability or null | yes | The selected exercise. Null means preserved legacy session-coordinate evidence requiring explicit review. |
| `title` | 1 through 80 Unicode characters | yes | Trimmed user-authored name with no control characters. Names need not be unique. |
| `startedAtElapsedMilliseconds` | non-negative signed 64-bit integer | yes | Inclusive start on the selected exercise's elapsed coordinate, or the preserved session coordinate when `exerciseRef` is null. |
| `endedAtElapsedMilliseconds` | positive signed 64-bit integer | yes | Exclusive end, strictly after the start. A current range cannot exceed the current selected exercise duration. |
| `evidenceRevision` | opaque `range-evidence-` capability | yes | Exact imported timing-evidence revision against which the boundaries were accepted or last reconciled. |
| `authorship` | `user` | yes | The selection and title are the person's interpretation. |
| `state` | `current` or `review-required` | yes | Whether the owner and exact boundaries remain supported by current compatible evidence. |
| `revision` | positive integer | yes | Optimistic aggregate revision, starting at 1. |

Elapsed zero is the recorded start of the selected exercise, and that exercise's declared duration is the
upper bound. Exercise elapsed time is independent from the session's declared duration and from local
wall-clock timestamp subtraction. A source lap, route point, signal sample, or other exact representation can
propose a boundary only when the application can prove that it uses this exercise coordinate. It cannot
interpolate, use proximity, subtract unrelated local timestamps, or assume that an exercise starts with its
session.

## Lifecycle and concurrency

Creation validates identity, title, exercise ownership, ordered boundaries, current exercise duration, and
evidence revision. Renaming changes only the title. Adjustment accepts one exercise capability and a complete
new boundary pair against that exercise's current duration and evidence revision. It returns the range to
`current`.

An anchored range can be adjusted only within its existing exercise. A preserved unanchored range can be
anchored through explicit adjustment to one current exercise; its preserved numeric boundaries are not
assumed to describe that exercise, so the complete pair is validated as a new deliberate choice. An unchanged
rename or anchored adjustment is idempotent. Every effective transition advances `revision` exactly once.

Removal is an explicit domain decision carrying `rangeRef`, `sessionRef`, nullable `exerciseRef`, and the
expected optimistic revision. Persistence deletes that exact aggregate atomically only while the revision
still matches. It does not delete or modify the owning session, exercise, reusable criteria, reports, or other
ranges. Version 2 does not retain a canonical tombstone.

A stale expected revision is a conflict and never overwrites a newer authored change, evidence
reconciliation, or removal. Range identity, session ownership, and established exercise ownership cannot
change during a transition.

## Reimport and evidence compatibility

The application assigns an evidence revision to the complete set of recorded timing relationships needed to
interpret exercise-relative boundaries. Import reconciliation classifies the next visible evidence rather
than comparing only archive bytes:

- equivalent evidence leaves the range unchanged;
- compatible strict enrichment can rebase a current range's unchanged exact boundaries to the new evidence
  revision only while the same exercise exists and still contains them;
- an amendment that can alter exercise identity, duration, or elapsed alignment is incompatible;
- a missing owning session or exercise, or an exercise duration shorter than the stored end, is incompatible;
- an unanchored legacy range remains review-required under every automatic reconciliation.

A compatible rebase advances the optimistic revision because a concurrent editor must not save against older
evidence. Incompatible or missing evidence preserves identity, ownership, title, exact authored boundaries,
and the latest evidence revision while setting `review-required`. It never clamps, rescales, redirects, or
attaches a range to another exercise. Subsequent enrichment cannot clear an existing review requirement.

Review completes only through explicit adjustment against current exercise evidence, even when the person
chooses the same numeric boundaries. Repeating the same reconciliation state is idempotent.

## Version-1 preservation

Every range persisted by SQLite schema 25 used a session-relative coordinate and carried no exercise owner.
The schema-26 migration retains its range identity, session owner, title, numeric boundaries, evidence
revision, optimistic revision, and local timestamps. It records a private `legacy-session-elapsed` coordinate
scope, sets `exerciseRef` to null, and sets state to `review-required`.

No migration or read adapter infers an exercise from ordinal, duration, timestamps, route availability, or
signal availability. The preserved object becomes a current version-2 range only after explicit adjustment
provides one current exercise and a valid exercise-relative boundary pair.

## Separation, privacy, and portability

A source lap or phase is recorded provider evidence. A range is one named selection authored for one
exercise. A segment criterion is a reusable question that can derive several sections on several exercises.
A derived segment is disposable FitFreed-calculated evidence. Equal numeric boundaries do not merge these
objects or their authorship.

Range lists and summaries expose authorship and review state independently of color. Ranges may overlap,
share titles, or cover source laps exactly. Titles, boundaries, and exercise relationships can reveal
analytical intent, location context, or physiological focus and remain local unless a separately authorized
export, report, MCP, or synchronization capability includes them.

Portable export must preserve opaque local identity, session and exercise ownership, coordinate scope,
elapsed units, authorship, state, evidence revision, and optimistic revision without adding provider or
storage identifiers. Changing identity, ownership, units, boundary inclusion, evidence reconciliation,
states, authorship, or revision semantics requires a new canonical version.
