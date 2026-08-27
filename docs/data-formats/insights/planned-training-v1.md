# Planned-Training Read Models Version 1

## Status and boundary

Normative provider-neutral desktop transport contracts for imported planned-training chronology, favourite-template
discovery, target detail, and the exact relationship between a completed session and imported intent. These read
models project the [canonical planned-training model](../canonical/planned-training.md); they do not expose provider
records, source sport identifiers, origin identifiers, raw evidence revisions, or persistence details.

The commands and contracts are:

- `query_planned_training_chronology` accepts
  [`planned-training-chronology-query-v1.schema.json`](../../../schemas/planned-training-chronology-query-v1.schema.json)
  and returns
  [`planned-training-chronology-v1.schema.json`](../../../schemas/planned-training-chronology-v1.schema.json);
- `query_planned_training_target` accepts
  [`planned-training-target-query-v1.schema.json`](../../../schemas/planned-training-target-query-v1.schema.json)
  and returns
  [`planned-training-target-v1.schema.json`](../../../schemas/planned-training-target-v1.schema.json); and
- `query_session_planned_training_relation` accepts
  [`planned-training-session-relation-query-v1.schema.json`](../../../schemas/planned-training-session-relation-query-v1.schema.json)
  and returns
  [`planned-training-session-relation-v1.schema.json`](../../../schemas/planned-training-session-relation-v1.schema.json).

Every request rejects unknown members. Opaque `targetRef`, `sessionRef`, `snapshotRef`, and `trainingSnapshotRef`
values are local references and convey no provider identity. Millisecond integers cross the desktop boundary as
canonical decimal strings so JavaScript never loses integer precision.

## Collections, filters, and ordering

The `scheduled` collection is a chronology of scheduled targets. It accepts the optional `completion` values
`pending` and `completed`, inclusive `from` and `through` local-date bounds, bounded `offset` and `limit`, and an
optional accepted `snapshotRef`. Results are ordered by scheduled local time and stable target identity. The
`favorite-templates` collection is separate from chronology: it accepts no completion or date filter and is ordered
by source position and stable target identity. An empty collection returns `targets: []`; it is not represented as
missing data.

`totalCount`, `offset`, `limit`, and `nextOffset` describe the exact filtered collection. Chronology pages contain
summaries only. A summary exposes `targetKind`, `name`, optional `description`, `editability`, `mappingCoverage`,
`shape`, `reconciliationState`, and `relation`; it deliberately omits the exhaustive exercise and phase graph.

`shape` distinguishes unavailable detail from an observed empty collection. Nullable `exerciseCount`, `phaseCount`,
`expandedPhaseCount`, and `repeatBlockCount` mean the relevant structure was not available for that summary.
`containsIntensityEvidence` reports whether any retained phase has mapped or explicitly unmapped intensity evidence;
it does not claim that the completed session followed the plan.

## Target detail

Target detail returns the same summary plus nullable ordered `exercises`. Each exercise retains `kind`, optional
`durationGoalMilliseconds`, optional `distanceGoalMeters`, provider-neutral `sport`, and nullable ordered `phases`.
Each phase retains nullable `name`, `goal`, `intensity`, and `transition`. Null means the source supplied no usable
phase name; presentation uses the ordinal for a localized display label without inventing source evidence. A transition can retain a `repeat` with
`returnToPhaseOrdinal` and `totalIterations`; consumers must not flatten that graph until repeat meaning is lost.

Mapped sport recognition exposes only an optional `canonicalFamily`, localized `localizedNames`, and the
provider-neutral evidence metadata `catalogueRevision`, `retrievedAtUtc`, `mappingVersion`, and `evidenceRef`.
`unavailable` means no sport value existed, `unmapped` means a value existed but this mapping version did not resolve
it, and `recognized` contains the attributable suggestion. No state authorizes a consumer to display a raw source
sport code.

Goal `kind` is `duration`, `distance`, or `unmapped`. Intensity `kind` is `none`, `zone-range`, or `unmapped`; a mapped
zone range retains its `metric`, `lowerZone`, and `upperZone`. Transition `change` is `manual`, `automatic`, or
`unmapped`. These distinctions are evidence, not inferred workout semantics.

## Planned-to-recorded relationship

A target summary relation has one of four states:

- `not-applicable`: the target is pending or is a reusable favourite template;
- `absent`: it is completed but no exact source-supported completed-session candidate exists;
- `exact`: exactly one candidate exists and `sessionRef` identifies it; or
- `ambiguous`: multiple completed-session candidates exist and only `candidateCount` is exposed.

The inverse completed-session query returns `absent`, `exact`, or `ambiguous`, plus the current candidate target
summaries. `candidateTargetCount` and `candidateSessionCount` explain ambiguity without choosing a winner. Exactness
is established in the source adapter from documented source evidence. Date proximity, name, duration, sport family,
phase shape, and recorded measurements are never used as heuristics.

The response carries both `snapshotRef` and `trainingSnapshotRef`. The planned snapshot combines current
planned-training and training-discovery revisions because importing another session can turn an exact relationship
into an ambiguous one without changing the plan. Supplying either stale snapshot fails atomically; a response never
combines target summaries and session relationships from different revisions.

## Reconciliation, partial mapping, and errors

`reconciliationState` is `current` for the accepted target revision and `conflicted` when equally ordered source
evidence disagreed and no revision could be selected silently. `mappingCoverage.state` is `complete` only when
`unmappedFieldCount` is zero; `partial` always carries a positive count. Exhaustive unmapped-field locators and source
provenance remain available through the normalized data exit rather than being repeated throughout the primary UI.

The command error codes are:

- `invalid-planned-training-query` for malformed references, filters, bounds, or pagination;
- `planned-training-changed` when either accepted snapshot is stale;
- `planned-training-not-found` when the exact target or session no longer exists; and
- `planned-training-query-failed` when persisted evidence violates the read-model contract or cannot be read.

After the first release, changing collection semantics, relationship evidence, nullable versus empty meaning,
identity, phase/repeat structure, numeric encoding, provider-neutrality, snapshot coherence, or error behavior
requires a new contract version. The nullable phase-name correction predates that release boundary.
