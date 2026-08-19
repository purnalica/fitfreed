# Training-Session Segmentation Read Model Version 1

## Purpose and commands

This provider-neutral boundary lets a person create reusable questions about an exercise when source laps
or phases do not answer them, while keeping source and authored evidence independent.

- `query_training_session_segmentation` accepts
  [`training-session-segmentation-query-v1.schema.json`](../../../schemas/training-session-segmentation-query-v1.schema.json)
  and returns
  [`training-session-segmentation-v1.schema.json`](../../../schemas/training-session-segmentation-v1.schema.json).
- `create_training_segment_criterion` accepts
  [`training-segment-criterion-create-v1.schema.json`](../../../schemas/training-segment-criterion-create-v1.schema.json),
  persists the reusable definition, applies it to the selected exercise, and returns the complete read model.
- `update_training_segment_criterion` accepts
  [`training-segment-criterion-update-v1.schema.json`](../../../schemas/training-segment-criterion-update-v1.schema.json)
  and compares `expectedRevision` before changing the reusable definition everywhere it is applied.
- `apply_training_segment_criterion` and `remove_training_segment_criterion` accept
  [`training-segment-criterion-mutation-v1.schema.json`](../../../schemas/training-segment-criterion-mutation-v1.schema.json).
- `move_training_segment_criterion` accepts
  [`training-segment-criterion-move-v1.schema.json`](../../../schemas/training-segment-criterion-move-v1.schema.json).

Every mutation returns the same complete version-1 result under the supplied snapshot. The commands accept
only opaque `sessionRef`, `exerciseRef`, `criterionRef`, and `snapshotRef` capabilities. Source identifiers,
provider tokens, artifact locations, account evidence, and signal identities never cross this boundary.

## Result shape

The response contains the current `snapshotRef`, requested `sessionRef`, every reusable
`availableCriteria`, and `exercises`. Null exercises mean compatible structural detail has not been
evaluated; an empty collection means it was evaluated and the source supplied none. Exercise order and
opaque identities match the training-session structure read model.

Each exercise has ordered `appliedCriteria`. A value contains the complete criterion definition,
application `ordinal`, `applicability`, optional `requiredMeasurement`, `hasEvidenceGaps`, and at most 250
derived `segments`. Exact elapsed values are decimal strings so signed 64-bit precision survives JavaScript
transport. Distance remains a finite numeric metre value. Criterion and evaluation semantics follow the
[canonical segment criterion](../canonical/segment-criterion.md).

`availableCriteria` is a reusable library, not a claim that every criterion is applicable to every exercise.
The same `criterionRef` can occur in several exercises. An exercise cannot apply it twice. Criteria are
ordered by normalized title in the reusable library and by the person's explicit ordinal under an exercise.

## Evaluation and resource boundary

Time and manual rules evaluate from duration metadata. Distance and heart-rate rules require exactly one
matching primary canonical signal. Evaluation streams exact stored slots in ordinal order under the same
snapshot and never loads a complete signal into memory. It does not use transition series, bounded visual
projections, source laps, or chart pixels as evidence.

Derived results are recalculated after every query or mutation and are not stored as source facts. The
maximum of 250 segments bounds transport, layout, exact-table rendering, and future report use. A rule that
exceeds it is retained but reports `too-many-segments`, allowing the person to revise the definition without
losing authorship.

## Snapshot, concurrency, and failure semantics

When `snapshotRef` is supplied, it must still identify the current coherent training-discovery revision.
Import, reimport, classification, or another canonical change invalidates a stale request before evaluation
or mutation. A query without a snapshot establishes the current one; every mutation requires one.

Criterion edits use optimistic `expectedRevision`. A concurrent effective edit returns
`training-segment-criterion-conflict`. Malformed definitions or capabilities return
`invalid-training-segment-criterion`; a stale library returns `training-segmentation-changed`; unavailable,
inconsistent, or interrupted local persistence returns `training-segmentation-failed`. Presentation retains
the last valid workspace and never combines segments calculated from different snapshots.

Create plus initial application, edit, apply, remove, and reorder are atomic SQLite transactions. A failed
operation changes neither the reusable definition nor exercise ordering.

## Presentation obligations

Presentation must:

- name criterion authorship as the person's and segment calculation as FitFreed-derived;
- keep source laps and phases visually independent from personal segmentation;
- explain missing, ambiguous, incomplete, out-of-session, and bounded results where they occur;
- expose evidence gaps and valid zero-match results without converting either to zero evidence;
- provide a bounded timeline and an exact semantic table with elapsed start, end, duration, and attribution;
- allow create, configure, reuse, reorder, and remove operations without exposing opaque references; and
- state that editing a reusable criterion affects every exercise where it is applied.

All calculation and rendering are local. This contract grants no authority to export signals, routes, or
criteria, expose them through MCP, or synchronize them with a provider.
