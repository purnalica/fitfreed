# Canonical Training-Session Range Version 1

## Status and authority

This is the normative provider-neutral contract for a person's named, contiguous selection inside one
training session. A `TrainingSessionRange` is local user-authored evidence. It does not modify imported
session facts, become a provider lap, or replace a reusable
[`SegmentCriterion`](segment-criterion.md).

The range is its own aggregate root and references exactly one training-session capability. Session
ownership makes its meaning local and durable without placing mutable authored state inside the imported
session aggregate.

## Identity and fields

| Field | Type | Required | Semantics |
|---|---|---|---|
| `rangeRef` | opaque `range-` capability | yes | Stable local identity; provider identifiers never cross the presentation boundary. |
| `sessionRef` | opaque `session-` capability | yes | The only session that owns the range. It cannot be reassigned. |
| `title` | 1 through 80 Unicode characters | yes | Trimmed user-authored name with no control characters. Names need not be unique. |
| `startedAtElapsedMilliseconds` | non-negative signed 64-bit integer | yes | Inclusive start on the session elapsed coordinate. |
| `endedAtElapsedMilliseconds` | positive signed 64-bit integer | yes | Exclusive end, strictly after the start and no later than the current declared session duration when authored. |
| `evidenceRevision` | opaque `range-evidence-` capability | yes | Exact elapsed-evidence revision against which the boundaries were accepted. |
| `authorship` | `user` | yes | The selection and title are the person's interpretation. |
| `state` | `current` or `review-required` | yes | Whether the exact boundaries remain supported by current compatible elapsed evidence. |
| `revision` | positive integer | yes | Optimistic aggregate revision, starting at 1. |

Elapsed zero is the recorded session start and the declared session duration is the upper bound. A source
lap, route point, signal sample, or other exact representation can propose a boundary only when the
application can map that evidence to this session coordinate without interpolation or an invented clock
relationship. The stored boundary remains a session-relative integer; source identity and representation
are evidence used by the Range Summary, not the range's identity.

## Lifecycle and concurrency

Creation validates identity, title, ordered boundaries, current session duration, and evidence revision.
Renaming changes only the title. Adjustment accepts a complete new boundary pair against the current session
duration and evidence revision and returns the range to `current`. An unchanged rename or adjustment is
idempotent. Every effective transition advances `revision` exactly once.

Removal is an explicit domain decision carrying `rangeRef`, `sessionRef`, and the expected optimistic
revision. Persistence deletes that exact aggregate atomically only while the revision still matches; it does
not delete or modify the owning session, reusable criteria, reports, or other ranges. Version 1 does not
retain a canonical tombstone.

A stale expected revision is a conflict. It never overwrites a newer rename, adjustment, evidence
reconciliation, or removal. Range identity and session ownership cannot change during any transition.

## Reimport and evidence compatibility

The application assigns an evidence revision to the complete set of recorded timing relationships needed
to interpret session-relative boundaries. Import reconciliation classifies the next visible evidence rather
than comparing only archive bytes:

- equivalent evidence leaves the range unchanged;
- compatible strict enrichment can rebase the unchanged exact boundaries to the new evidence revision;
- an amendment that can alter elapsed alignment is incompatible;
- a missing owning session or a duration shorter than the stored end is incompatible.

A compatible rebase advances the optimistic revision because a concurrent editor must not save against the
older evidence. Incompatible or missing evidence preserves the range identity, title, and exact authored
boundaries, records the current evidence revision, advances the optimistic revision once, and sets
`review-required`. It never clamps, redirects, rescales, or attaches the range to another session.

Review is completed only through an explicit adjustment against current evidence, even when the person
chooses the same numeric boundaries. Repeating the same reconciliation state is idempotent.

## Separation from other evidence

A source lap or phase is recorded provider evidence. A range is one named selection authored for one
session. A segment criterion is a reusable question that can derive several sections on several exercises.
A derived segment is disposable FitFreed-calculated evidence. Equal numeric boundaries do not merge these
objects or their authorship.

Range lists and summaries must expose authorship and review state independently of color. A range may
overlap another range, share its title, or cover a source lap exactly. Those conditions are valid and do not
create identity or uniqueness.

## Privacy and portability

Titles and boundaries can reveal analytical intent, location context, or physiological focus. They remain
local unless a separately authorized export, report, MCP, or synchronization capability includes them.
Portable export must preserve opaque local identity, session ownership, elapsed units, authorship, state,
evidence revision, and optimistic revision without adding provider identifiers.

Changing identity, ownership, units, boundary inclusion, evidence-reconciliation behavior, states,
authorship, or revision semantics requires a new canonical version.
