# ADR 0033: Model planned training as versioned intent

- **Status:** Accepted
- **Date:** 2026-08-27
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-002](../../requirements.md#fr-002--idempotent-reimport),
  [FR-017](../../requirements.md#fr-017--multiple-data-source-importers),
  [FR-018](../../requirements.md#fr-018--source-provenance),
  [FR-020](../../requirements.md#fr-020--fitfreed-format-documentation), and
  [FR-027](../../requirements.md#fr-027--structured-training-intent-phases-and-blocks)
- **Related delivery plan:** [X7-R5](../../plans/mvp-redesign-production-migration.md#x7-r5--import-and-explain-structured-training-intent)
- **Related architecture:** [Source integration](../source-integration.md), [storage](../storage.md),
  [ADR 0021](0021-model-training-as-attributed-evidence.md), and
  [ADR 0031](0031-scope-training-target-sport-evidence-to-one-session.md)
- **Related contracts:** [Canonical planned training](../../data-formats/canonical/planned-training.md),
  [Polar Flow planned-training mapping](../../data-formats/mappings/polar-flow-planned-training.md), and
  [SQLite schema version 31](../../data-formats/persistence/sqlite-v31.md), and
  [portable planned-training export version 1](../../data-formats/portable/planned-training-v1.md)

## Context

The supported export contains scheduled objectives and favourite templates with ordered exercises, phases, duration
or distance goals, intensity ranges, transitions, and repeat edges. Recorded sessions, laps, calculated segments, and
authored ranges answer what happened or how the user later interpreted it. A target answers what was planned. Merging
those meanings would make a provider-authored intention look like a recorded fact and would prevent honest comparison
when no authoritative relationship exists.

Source targets also evolve differently from recorded sessions. A scheduled item can move from pending to completed;
a mapping revision can interpret more of equal source evidence; a favourite can disappear from a later exported
collection without proving deletion of its history; and the source supplies no general orderable revision for changed
definitions. Import order therefore cannot select the winning meaning.

Provider neutrality does not justify flattening the graph into generic fields. Exercise and phase order, transition
kind, repeat range, total iterations, goal unit, and intensity metric are portable training concepts. Provider enum
tokens and artifact structure are not.

## Considered alternatives

### Attach target phases directly to recorded sessions

This would simplify one session screen but would falsely imply a relationship for pending, unmatched, or ambiguous
targets. Favourite templates have no recorded occurrence at all. It would also couple source planning history to
recorded-session reconciliation and make independent chronology impossible.

### Persist provider JSON or a generic key-value graph

Raw preservation would retain unknown values but move provider vocabulary into the product core, weaken invariants,
and force every query, report, and future importer to understand source-specific structure. Generic key-value storage
would hide units, ordering, repeat semantics, and compatibility behind runtime interpretation.

### Flatten repeats into an expanded phase list

Expansion is convenient for rendering but destroys the authored block boundary and repeat intent, multiplies data,
and makes source comparison ambiguous. A bounded expanded view can be derived from an intact graph when needed.

### Preserve a provider-neutral revisioned intent aggregate

This keeps planned meaning independent, retains graph structure, supports future importers, and allows exact or
ambiguous session relationships to be added only from source evidence. Immutable evidence-and-mapping revisions make
reimport outcomes reproducible without letting package order overwrite an unorderable change.

## Decision

FitFreed models training intent as a provider-neutral `PlannedTrainingTarget` aggregate with stable target identity,
immutable source-evidence revision, explicit mapping coverage, and ordered exercise/phase/transition/repeat structure.

- Scheduled targets and favourite templates are distinct kinds. Only scheduled targets carry local scheduled time and
  pending or completed state.
- Planned exercises, phase goals, intensity ranges, transition changes, and repeat edges use canonical types and units.
  Provider enum values stop in the importer adapter.
- Missing, present-empty, unmapped, and invalid remain distinct. Unknown source members contribute stable locators and
  partial coverage; unknown values are not promoted into a generic canonical object.
- Repeat meaning remains a bounded graph. Canonical limits reject crossing ranges, excessive nesting, or excessive
  expansion rather than truncating or flattening the source.
- A completed planned target has `absent`, `exact`, or `ambiguous` recorded-session relationship only after a source
  adapter supplies authoritative candidates. A favourite relationship is not applicable. Similarity is not evidence.
- Persistence keeps immutable `(evidence revision, mapping version)` representations behind one current target head.
  Equal evidence may be enriched by a newer mapping. Pending may advance to completed only when every other definition
  field is equal. Unorderable changes preserve both revisions and create an explicit conflict.
- Favourite exports are immutable ordered snapshots. A later omission or empty snapshot does not delete earlier
  target history.
- Source artifact identity, hashes, private sport codes, and unmapped locations remain infrastructure provenance.
  Application and presentation receive provider-neutral query models only.
- Recorded sessions, source laps, calculated segments, segmentation criteria, and authored ranges remain separate
  aggregates. Comparison composes them without changing their authority.

ADR 0031 remains in force for session-scoped sport recognition. The planned aggregate reuses the same independently
authored sport vocabulary evidence but does not broaden its exact target-to-session rule or create a global mapping
from provider sport identifiers.

## Consequences

### Positive

- Training plans survive independently from recorded history and can later be explored, compared, reported, and
  exported without provider terminology in the core.
- The normalized capability export retains every revision, conflict, favourite snapshot, mapping-coverage locator,
  and source-provenance event without treating the private SQLite schema as a portable API.
- Exact ordering, units, transitions, and repeat meaning remain available for visual composition and independent
  portable implementations.
- Reimport, mapping upgrades, conflicts, and favourite removal are reproducible and do not depend on import order.
- Future provider adapters can express equivalent intent without copying the Polar Flow JSON graph.

### Negative

- The domain, persistence, portable export, and read models require a new aggregate and explicit composition with
  recorded sessions.
- Unknown source values remain recoverable only from the original archive until a later mapping supports them; the
  library retains their locations and partial-coverage state rather than the values themselves.
- A changed definition without source revision order remains conflicted until a later contract establishes ordering
  or the product adds an explicit user resolution workflow.

### Risks and mitigations

- **Presentation may imply that intent was achieved.** Planned and recorded authority remain separately labeled, and
  comparison language cannot claim compliance or causation.
- **A heuristic may create attractive but false links.** Relationship resolution accepts only adapter-supplied source
  candidates and preserves multiple candidates as ambiguous.
- **Mapping upgrades may rewrite history.** Immutable evidence-and-mapping revisions remain attributed; enrichment
  advances only the current head and never deletes the former representation.
- **Favourite disappearance may be mistaken for deletion.** Snapshots retain complete membership history, including
  an explicit empty collection.
- **A raw phase table may overwhelm users.** Application read models lead with plan shape and purpose; exhaustive
  evidence remains behind deliberate disclosure.

## Verification

Acceptance requires domain tests for identity, ordering, units, optionality, relationship cardinality, repeats,
mapping coverage, and reconciliation; synthetic adapter tests for every supported and unmapped source variant;
transactional migration, import, exact-repeat, amendment, conflict, favourite-snapshot, rollback, backup, and export
evidence; provider-free application contracts; and accessible localized plan-versus-recorded journeys with bounded
performance. No personal export or derived personal value enters test or documentation evidence.
