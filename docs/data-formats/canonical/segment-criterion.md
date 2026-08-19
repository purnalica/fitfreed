# Canonical Segment Criterion Version 1

## Status and authority

This is the normative provider-neutral contract for a person's reusable interpretation of one or more
training exercises. A `SegmentCriterion` is user-authored evidence. Applying it produces disposable,
versioned FitFreed-derived segments; neither the definition nor its result changes imported exercises,
source laps, automatic laps, pauses, routes, or signal samples.

## Identity and lifecycle

| Field | Type | Required | Semantics |
|---|---|---|---|
| `criterionRef` | opaque `criterion-` capability | yes | Stable local identity; provider identifiers never cross the presentation boundary. |
| `title` | 1 through 80 Unicode characters | yes | Trimmed user-authored name with no control characters. |
| `definition` | `SegmentCriterionDefinition` | yes | One exact version-1 rule below. |
| `authorship` | `user` | yes | The definition is personal interpretation, not source or FitFreed authorship. |
| `evaluationVersion` | positive integer | yes | Exact deterministic evaluator; version 1 is the only current value. |
| `revision` | positive integer | yes | Starts at 1 and advances exactly once for every effective edit. |

An unchanged edit preserves the revision. A stale expected revision is rejected rather than overwriting a
newer definition. A criterion is reusable across exercises and sources in the same local library. Editing it
therefore changes its next derived result everywhere it is applied. Removing it from one exercise removes
only that ordered association; the reusable definition remains available.

Criteria and associations are local authored data, independent of import provenance. Exact reimport retains
them. A source amendment retains an association when the same source exercise identity remains. If that
identity disappears, FitFreed does not silently retarget the authored rule to a different exercise; the
definition remains reusable and can be deliberately applied again.

## Definition variants

All elapsed values use integer milliseconds and all distance values use metres.

### `equal-elapsed-time`

`spanMilliseconds` is a positive signed 64-bit integer. Evaluation starts at elapsed zero and divides the
complete declared exercise duration into adjacent spans. The final segment may be shorter. A zero-duration
exercise is outside the rule's domain.

### `equal-distance`

`spanMeters` is a finite binary64 value of at least 0.001 metres whose millimetre conversion remains below
the signed 64-bit upper bound.
Evaluation requires exactly one primary cumulative `distance` signal. Each boundary is the first exact
recorded slot to meet the next distance target. FitFreed does not interpolate a crossing between slots.

A missing slot, decreasing cumulative value, or one recorded step that crosses more than one boundary makes
the evidence incomplete. This conservative result prevents a visually plausible timestamp from being
presented as a recorded or exactly calculable boundary.

### `heart-rate-zone`

`minimumBeatsPerMinute` and `maximumBeatsPerMinute` are inclusive integers from 20 through 300, with minimum
not above maximum. Evaluation requires exactly one primary `heart-rate` signal and returns every contiguous
run of exact slots inside the range. A missing slot closes the current run and the next available matching
slot begins a new run. An exercise can validly have zero matching runs.

### `manual-boundaries`

`elapsedMilliseconds` contains 1 through 99 unique, strictly increasing, positive signed 64-bit values.
Every value must fall strictly before the exercise duration. Evaluation adds elapsed zero and the exact
exercise end, producing one more segment than authored boundaries.

## Applicability

An applied criterion has exactly one applicability code:

| Code | Meaning |
|---|---|
| `applicable` | The rule was evaluated deterministically; the segment collection may validly be empty. |
| `missing-prerequisite` | The required canonical measurement is absent. |
| `ambiguous-prerequisite` | More than one matching canonical series exists and none is chosen silently. |
| `incomplete-evidence` | Gaps, invalid cumulative evidence, or insufficient exact resolution prevent the requested boundaries. |
| `outside-session` | The duration is zero or at least one manual boundary is not strictly inside the exercise. |
| `too-many-segments` | Evaluation would produce more than 250 derived segments. |

`requiredMeasurement` is null for time and manual rules, `distance` for equal distance, and `heart-rate` for
heart-rate ranges. `hasEvidenceGaps` is true only when an otherwise applicable result deliberately exposes
missing source slots. An inapplicable result contains no segments.

## Derived segment contract

Every `TrainingDerivedSegment` contains contiguous result `ordinal`, non-negative
`startedAtElapsedMilliseconds`, strictly greater `endedAtElapsedMilliseconds`, and attribution
`fitfreed-derived`. Boundaries never exceed the declared exercise duration. Result order is chronological;
heart-rate runs may have gaps between them, while time, distance, and manual partitions are adjacent.

The result is recalculated from the current criterion revision and current canonical evidence. It is not a
new source fact and is not persisted as one. Presentation and exports must retain the criterion's `user`
authorship, the segment's `fitfreed-derived` attribution, evaluation version, applicability, prerequisites,
and gap evidence.

## Privacy and portability

Criterion definitions reveal personal analytical intent and can select physiological evidence. They remain
local unless a separate export, report, MCP, or synchronization capability receives explicit authority.
Their documented provider-neutral form is the portability boundary; a provider-specific object is not a
valid criterion definition.

Changing identity, authorship, revision behavior, units, applicability meaning, evaluation algorithms,
limits, or attribution requires a new canonical version.
