# ADR 0036: Unify sport collections through explicit user authorship

- **Status:** Superseded by [ADR 0037](0037-apply-reusable-local-sport-correlation-rules.md)
- **Date:** 2026-08-29
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-018](../../requirements.md#fr-018--source-provenance),
  [FR-026](../../requirements.md#fr-026--user-authored-sport-classification),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality), and
  [NFR-022](../../requirements.md#nfr-022--vendor-neutral-domain-and-application-core)
- **Related architecture:** [ADR 0027](0027-resolve-sport-identity-from-versioned-provider-evidence.md),
  [ADR 0031](0031-scope-training-target-sport-evidence-to-one-session.md),
  [ADR 0035](0035-separate-fallback-sport-classification-from-exact-recognition.md), and
  [training exploration](../training-exploration.md)

## Context

One provider export can represent one provider-visible sport through several exact code sets, an unresolved source
profile, or no usable sport evidence at all. The bounded private correlation established that these shapes can have
stable local one-to-one meaning, while also establishing that absence from the export does not prove absence from the
provider account. The observation cannot establish a universal mapping and cannot authorize FitFreed to collapse
similar evidence automatically.

Fallback classification already interprets only the unresolved source-profile remainder. Extending it across exact
collections would recreate the defect that made recognized sports disappear. The product therefore needs a separate
user-owned concept that can state, revise, and dissolve an intentional relationship without modifying imported
evidence or pretending that the relationship came from the provider.

## Decision drivers

- Preserve exact provider evidence, fallback classification, and personal relationship authorship as distinct facts.
- Make the complete affected session coverage and identity precedence explicit before a save.
- Keep the operation provider-neutral, reversible, local-first, and stable across reimport and restart.
- Fail closed when later evidence no longer supports one of the stored collection capabilities.

## Considered alternatives

### Extend source-profile classification across exact collections

This would make one label convenient, but the classification would silently acquire sessions backed by stronger
evidence. It would conflate an interpretation with a relationship and make its visible scope depend on import shape.

### Install a bundled mapping from one private correlation

This would appear automatic, but one library cannot establish a provider-wide contract. A reusable mapping requires
independent provenance, ambiguity, version, update, licence, and correction rules that the correlation does not
provide.

### Merge equal names or broad families

Text equality and broad taxonomy do not prove identity. This would create implicit relationships across providers and
origins and would make later correction unpredictable.

### Author an explicit relationship between represented collections

This preserves every source-backed collection and records only the person's deliberate statement. One member supplies
the visible identity by explicit precedence; every member remains inspectable as attributed evidence.

## Decision

FitFreed models `UnifiedSportRelationship` as a separate user-authored aggregate.

- A relationship contains two through 64 distinct opaque represented-collection references.
- Exactly one member is the primary identity whose recognized or personally classified meaning takes precedence.
- The member set is canonical and unordered; presentation may place the primary first without changing the aggregate.
- One represented collection can belong to at most one active relationship.
- Revision one is created only by an explicit action. Effective revision changes increment once; an identical revision
  is idempotent; removal requires the revision the person reviewed.
- The stable relationship reference is derived from its initial primary opaque capability and does not change when
  precedence or membership is revised.
- Import, reimport, catalogue activation, and fallback classification never create, revise, or remove a relationship.
- Missing or changed member capabilities place the relationship in review-required state. They never cause an
  automatic remap, implicit member substitution, or loss of the underlying collections.
- Removing a relationship removes only authored relationship state. Imported evidence, fallback classifications,
  reports, and sessions remain.

Application projections combine coverage only while every member is current and the selected primary has a usable
visible identity. Filters retain the exact underlying member capabilities rather than persisting a synthetic merged
predicate. This keeps saved exploration and report questions meaningful after a relationship is dissolved.

## Consequences

### Positive

- A person can reconcile provider export fragmentation without claiming provider or catalogue authority.
- Exact evidence and unresolved classifications remain independently auditable and recoverable.
- Combined sport discovery can become concise while retaining an explicit route to its members and authorship.
- Reversal does not delete or rewrite imported fitness history.

### Negative

- The workflow needs a deliberate preview and cannot be reduced to matching equal labels.
- Relationship persistence, projections, filters, reports, backup, migration, and recovery require coordinated
  contract versions.
- Evidence enrichment can require review instead of silently preserving a possibly obsolete combination.

### Risks and mitigations

- A primary identity can disappear after an evidence change. The relationship fails closed into review-required state
  and exposes the surviving members for revision or removal.
- A broad selection can combine unrelated sports accidentally. The save boundary presents each member's session count,
  date range, identity state, and the chosen precedence before confirmation.
- A relationship could become a new data silo. It is user-owned library data, belongs in backup and future portable
  export, and remains removable without affecting source evidence.

## Verification

Domain tests cover minimum and maximum membership, uniqueness, explicit precedence, canonical ordering, idempotent and
effective revision, restoration, and revision-bound removal. Application and persistence tests must cover complete
coverage preview, overlap rejection, exact and export-missing members, concurrent evidence change, reimport, restart,
migration, backup, restore, report resolution, export, and dissolution. Presentation and packaged end-to-end evidence
must prove that the operation names affected sessions and precedence before save and exposes review-required state.
