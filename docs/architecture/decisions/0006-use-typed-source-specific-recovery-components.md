# ADR 0006: Use typed source-specific recovery components

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Source integration](../source-integration.md), [module map](../module-map.md), [canonical nightly recovery](../../data-formats/canonical/nightly-recovery.md)

## Context

Nightly recovery combines physiological measurements with algorithm-derived statuses, comparison baselines, sublevels, and generated guidance. Beat-to-beat interval and RMSSD have established measurement meaning and units. A provider's overall recovery score, autonomic charge scale, baseline algorithm, and recommendations do not become comparable merely because another provider offers concepts with similar names.

The first supported source also contains a separate sample blob with no date, record identifier, or documented relationship to the dated recovery records. Array position and archive order cannot become hidden identity rules.

FitFreed needs to preserve useful source information without either discarding it or allowing provider vocabulary and conditionals to spread through the core.

## Decision drivers

- Keep shared physiological observations provider-neutral and unit-explicit.
- Preserve useful source-derived assessments and guidance with their exact semantic boundary.
- Prevent comparisons between values whose algorithms or scales are not established as compatible.
- Retain compile-time structure, validation, reconciliation, and migration safety.
- Allow later importers to add meaning without reducing the model to untyped key-value data.

## Considered alternatives

### Shared measurements only

The canonical aggregate could retain only beat-to-beat interval, RMSSD, and breathing measurements. This would keep a small shared model but discard recovery statuses, baselines, and guidance that are central to the user-facing source history.

### Generic key-value observations

All provider-specific content could use arbitrary names, values, and metadata. This would be extensible at the storage boundary, but invariants, units, optionality, reconciliation, translation context, and query behavior would move into scattered runtime conventions.

### Provider-specific recovery aggregates

Each provider could add a separate aggregate and application path. Semantics would remain precise, but shared identity, physiological measurements, exploration, and comparison behavior would be duplicated and provider conditionals would leak beyond the anti-corruption layer.

### Canonical aggregate with typed namespaced components

One provider-neutral nightly recovery aggregate can own shared identity and measurements. Typed optional components can retain source-specific assessment, baseline, and guidance semantics, each carrying an opaque versioned scheme code.

## Decision

FitFreed adopts a canonical nightly recovery aggregate with typed source-specific components.

- `NightlyRecovery` owns opaque origin identity, source-assigned recovery date, and unit-explicit physiological summaries with established shared meaning.
- `SourceSpecificRecoveryAssessment`, `SourceSpecificRecoveryBaseline`, and `SourceSpecificRecoveryGuidance` are typed value objects. Their fields are explicit rather than arbitrary key-value pairs.
- Every source-specific component carries a non-empty versioned `scheme` code assigned by the source adapter. Values from different scheme codes are not combined or compared unless a later compatibility decision establishes equivalence.
- A source adapter maps external fields into these components. Domain and application code understand component capabilities but contain no provider names, source JSON fields, or provider-specific branching.
- Reconciliation compares shared required facts and each typed component. An absent component may enrich an existing observation; a later omission preserves known information; a changed known component conflicts when no orderable source revision exists.
- Unidentifiable sample collections are not attached to a dated recovery observation by position, package order, or filename. They remain explicitly excluded until a documented relationship or independent identity is available.
- New source-specific fields extend an existing typed component only when they share its lifecycle and comparison boundary. A meaningfully different capability receives another typed component and an explicit compatibility contract.

This decision does not make source guidance medical advice, establish algorithm comparability, define cross-origin merging, or require every provider to supply every component.

## Consequences

### Positive

- Shared measures remain portable and independently understandable.
- Algorithm-specific values retain useful meaning without masquerading as universal scores.
- Compile-time types and tests protect units, optionality, reconciliation, and persistence.
- Future providers can reuse the aggregate while introducing only the typed semantic components they actually support.

### Negative

- Adding a new source algorithm may require a canonical component-version change even when its source JSON is easy to parse.
- Queries and portable export must expose scheme and coverage alongside source-specific values.
- The first version deliberately excludes sample data that cannot be joined safely.

### Risks and mitigations

- **A scheme code becomes an informal provider switch:** architecture checks reject provider terminology in core source; behavior is defined by component contracts, not code branches on scheme text.
- **Similar values are compared across incompatible algorithms:** read models group by origin and disclose scheme; cross-scheme aggregation requires an explicit later decision.
- **Arbitrary text becomes trusted advice:** guidance is labeled as source-generated, length-bounded, local-only, and non-diagnostic.
- **Delivery order is mistaken for identity:** adapter tests permute records and artifacts and reject any relationship that lacks a documented key.

## Verification

Contract and domain tests must cover shared measurement invariants, independent optional components, scheme mismatch, strict enrichment, preservation, conflict, and source-order independence. Adapter tests must cover observed structural variants and prove that the undated blob is never joined by array position. Persistence, migration, read-model, transport, and UI tests must retain scheme and coverage without exposing opaque origins or treating unavailable values as zero.
