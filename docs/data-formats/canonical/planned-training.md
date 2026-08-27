# Canonical Planned Training Version 1

## Status and scope

This is the normative provider-neutral contract for training intent imported into FitFreed. A planned-training
target describes what a source intended or saved as a reusable template. It is not a recorded training session and
does not become one through similarity of name, date, sport, duration, measurements, or phase shape.

The version-1 aggregate preserves scheduled targets and favourite templates, ordered exercises, ordered phases,
duration and distance goals, zone-range intensity, transition behavior, and bounded repeat graphs. Provider field
names, enum values, artifact locators, and private source codes remain in importer and provenance contracts.

## Aggregate

`PlannedTrainingTarget` is scoped to one opaque observation origin and has these canonical fields:

| Field | Type and cardinality | Meaning |
|---|---|---|
| `originId` | non-empty opaque string | Library-local observation origin established by source-subject correlation. |
| `targetId` | `planned-target-` plus 64 lowercase hexadecimal characters | Stable target identity inside the origin. |
| `evidenceRevision` | `planned-evidence-` plus 64 lowercase hexadecimal characters | Immutable source-evidence revision, independent from the mapping version. |
| `kind` | `scheduled` or `favorite-template` | Target lifecycle kind. |
| `scheduledAtLocal` | canonical local date-time, scheduled only | Source-authored local instant with no invented offset or zone. |
| `completion` | `pending` or `completed`, scheduled only | Source-authored completion state. It is not a session relationship. |
| `name` | required string, 1–160 characters | Source-authored target name. Whitespace-only content is invalid. |
| `description` | absent or string, at most 2,000 characters | Source-authored description. Present-empty remains distinct from absence. |
| `editability` | `editable`, `non-editable`, or `unspecified` | Source evidence about whether the target is editable. |
| `exercises` | absent or ordered array, at most 256 items | Planned exercises. Absent and present-empty remain distinct. |
| `mappingCoverage` | `complete` or `partial` plus non-negative unmapped count | Whether every encountered supported-source member has canonical meaning in the active mapping. |

A `complete` mapping has zero unmapped members. A `partial` mapping has one or more retained unmapped-field
locations. Partial does not mean invalid: known structure remains available, while presentation and export must
disclose the gap. Invalid known values reject the source record before canonical publication.

## Exercise

Exercises are contiguous and zero-based inside one target. Every `exerciseId` uses the
`planned-exercise-<64 lowercase hexadecimal characters>` form and is unique across the aggregate.

| Field | Type and cardinality | Meaning |
|---|---|---|
| `ordinal` | integer from zero | Exact canonical order. |
| `kind` | `open`, `phased`, `volume`, `strength`, or `unmapped` | Provider-neutral exercise shape. `unmapped` preserves the presence of a valid unknown source variant. |
| `durationGoalMilliseconds` | absent or positive integer | Exact whole-millisecond exercise goal. |
| `distanceGoalMeters` | absent or positive finite number | Exercise distance goal in metres. |
| `sport` | `unavailable`, `unmapped`, or `recognized` | Evidence state for the planned exercise's sport. |
| `phases` | absent or ordered array, at most 20 unique items | Planned phases. Absent and present-empty remain distinct. |

`unavailable` means the source supplied no sport evidence. `unmapped` means syntactically valid source evidence was
present but the active mapping has no provider-neutral interpretation. `recognized` contains localized names, an
optional canonical family suggestion, an opaque evidence reference, and exact mapping provenance. No provider code
crosses the canonical boundary.

## Phase, transition, and repeat graph

Phases are contiguous and zero-based inside one exercise. Phase, transition, and repeat identifiers use their
respective `planned-phase-`, `planned-transition-`, and `planned-repeat-` prefixes followed by 64 lowercase
hexadecimal characters and are unique across the aggregate.

| Field | Type | Meaning |
|---|---|---|
| `phaseId` | `planned-phase-` plus 64 lowercase hexadecimal characters | Stable phase identity inside the target revision. |
| `ordinal` | integer from zero | Exact canonical phase order. |
| `name` | absent or string, 1–120 characters | Exact source-authored phase name when present; absence means the source supplied an empty name and no label is invented in canonical data. |
| `goal` | duration, distance, or `unmapped` | One positive whole-millisecond duration, one positive finite metre distance, or an explicit unknown variant. |
| `intensity` | `none`, zone range, or `unmapped` | Intended intensity without implying recorded compliance. |
| `transitionId` inside `transition` | `planned-transition-` plus 64 lowercase hexadecimal characters | Stable identity of the transition after this phase. |
| `change` inside `transition` | `manual`, `automatic`, or `unmapped` | How the source says the transition occurs after the phase. |
| `repeat` inside `transition` | absent or repeat edge | Optional return edge that gives the plan its block structure. |

A zone range has one metric—`heart-rate`, `speed`, or `power`—and inclusive `lowerZone` and `upperZone` integers
between 1 and 5, with the lower bound no greater than the upper bound.

A repeat edge has a stable `repeatId` in the `planned-repeat-` digest form and is attached to the phase after which
control returns. `returnToPhaseOrdinal` addresses an existing
phase at or before that phase. `totalIterations` includes the first execution and is between 2 and 100. Repeat ranges
may be disjoint or properly nested; they may not cross. Nesting depth is at most two, and expanding the graph may
produce at most 200 phase occurrences. These limits make validation, presentation, export, and performance
deterministic without flattening away repeat meaning.

## Text, time, units, and optionality

Canonical text permits tabs and line breaks but rejects other control characters. Character limits count Unicode
characters rather than encoded bytes.

`scheduledAtLocal` uses `YYYY-MM-DDTHH:mm:ss` with an optional canonical decimal fraction of one to nine digits.
The date and time must exist in the proleptic Gregorian calendar, year zero is invalid, leap years are validated,
seconds stop at 59, and a fractional representation never ends in zero. No offset, daylight-saving rule, or time-zone
identifier is inferred.

An absent phase name is distinct from an empty canonical string. Presentation may derive a localized ordinal label,
such as `Phase 1`, but that label is not source evidence and never enters persistence or portable export.

Durations are positive whole milliseconds. Distances are positive finite metres. Zone numbers are ordinal source
intensity bands, not physiological measurements. Missing, present-empty, zero, and unmapped are never interchangeable.

## Planned-to-recorded relationship

The provider-neutral relationship has four states:

| State | Meaning |
|---|---|
| `not-applicable` | A favourite template is not a completed scheduled occurrence. |
| `absent` | A pending target, or a completed target with no authoritative candidate, has no recorded-session link. |
| `exact` with `sessionRef` | Source evidence identifies exactly one valid session. |
| `ambiguous` with `candidateCount` | Source evidence identifies more than one distinct valid session and none is selected. |

Candidate session references must be valid and unique before relationship resolution. The canonical resolver does not
search by similarity and cannot turn an ambiguous set into an exact relationship. The source mapping that supplies
candidates owns the evidence rule; presentation must state the relationship independently from the plan itself.

## Reconciliation

Target identity and source evidence revision are separate. Import reconciliation returns `create`, `equivalent`,
`enrich`, `amend`, `preserve`, or `conflict` and records the decision with provenance.

- No existing target creates a new current head.
- Equal complete canonical state is equivalent.
- Equal source evidence under a richer mapping enriches the same target; a less complete mapping is preserved.
- For the same scheduled definition, `pending` to `completed` is the only source-orderable amendment in version 1.
  The reverse observation is older and cannot roll back the current head.
- A changed definition, favourite revision, or any other revision without source ordering is unorderable. Both
  revisions survive and the current head remains unchanged under an explicit conflict.
- Absence from a later favourite snapshot never deletes a target. Snapshot membership states what that export
  contained, including an explicit empty collection.

A mapping version may create a new immutable representation of equal evidence. Reusing the same evidence and mapping
identity with different canonical content, unmapped locations, or private sport-evidence structure is a contract
collision and invalidates the import.

## Separation and privacy

Planned training remains separate from:

- recorded `TrainingSession` and recorded exercises;
- source and automatic laps;
- FitFreed-calculated segments;
- reusable segmentation criteria; and
- user-authored session ranges.

The canonical aggregate contains no provider account identifier, filename, artifact hash, raw unsupported value, or
private provider sport code. Those facts remain in infrastructure provenance where required for reconciliation and
explanation. Exact source values that have no supported meaning are not silently promoted into a generic key-value
model; only their locations and the resulting partial-coverage count cross the mapping boundary.

## Compatibility evidence

Version 1 is implemented by the domain invariants in
`src-tauri/crates/fitfreed-domain/src/planned_training.rs`. Synthetic tests cover identity, optional collections,
ordering, goals, intensity bounds, repeat nesting and expansion, relationship cardinality, completion ordering,
mapping enrichment, and unorderable conflict behavior. Provider grammar and transformation are specified separately
in the [Polar Flow planned-training mapping version 2](../mappings/polar-flow-planned-training-v2.md).
