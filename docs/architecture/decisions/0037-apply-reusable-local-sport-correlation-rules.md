# ADR 0037: Apply reusable local sport-correlation rules

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decision owners:** FitFreed maintainers
- **Supersedes:** [ADR 0036](0036-unify-sport-collections-through-explicit-user-authorship.md)
- **Related requirements:** [FR-018](../../requirements.md#fr-018--source-provenance),
  [FR-026](../../requirements.md#fr-026--user-authored-sport-classification),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality), and
  [NFR-022](../../requirements.md#nfr-022--vendor-neutral-domain-and-application-core)
- **Related architecture:** [ADR 0027](0027-resolve-sport-identity-from-versioned-provider-evidence.md),
  [ADR 0031](0031-scope-training-target-sport-evidence-to-one-session.md),
  [ADR 0035](0035-separate-fallback-sport-classification-from-exact-recognition.md), and
  [training exploration](../training-exploration.md)

## Context

ADR 0036 correctly separated a deliberate personal relationship from imported source evidence, but represented that
relationship as a fixed set of current discovery capabilities. A later import can introduce another exact-evidence
collection for an already reviewed source sport identity. Treating that collection as unrelated forgets the person's
decision and forces the same correction after future imports.

The source adapter can also encounter distinct opaque provider identifiers whose exact, independently documented
sport evidence has the same provider-neutral meaning. FitFreed needs useful defaults for those reproducible cases,
without turning values observed in one private library into a public provider mapping.

## Decision drivers

- Remember an explicit personal correlation across restart, reimport, migration, backup, and later compatible evidence.
- Preserve every imported provider identifier and exact evidence record without exposing either outside the adapter.
- Keep user-authored meaning stronger than a provider-normalization default and make correction possible.
- Reject ambiguous or conflicting expansion instead of selecting a result by order or frequency.
- Permit bundled defaults only when their rule and evidence are independently reproducible, versioned, and auditable.

## Considered alternatives

### Retain only the current represented-collection references

This preserves the reviewed snapshot but forgets its reusable meaning. A newly represented exact-evidence collection
for the same reviewed source identity would return as a separate sport after every enrichment.

### Publish opaque identifier pairs learned from one private library

This would make one installation appear automatic while asserting an unsupported provider-wide relationship. It
would also turn private observations into shipped source data and provide no defensible ambiguity or update policy.

### Infer equality from label, broad family, frequency, route, or measurements

These signals do not establish sport identity. They can make unrelated sports look similar and cannot authorize an
automatic merge.

### Persist local source selectors and keep provider defaults evidence-driven

The library can retain a private selector for each reviewed source identity while continuing to expose only opaque
FitFreed capabilities. Later collections that resolve to exactly one retained selector inherit the relationship.
Separately, a versioned provider rule can normalize collections only when documented source evidence establishes the
same provider-neutral meaning.

## Decision

FitFreed retains the user-authored relationship aggregate from ADR 0036 and adds reusable matching semantics.

- The reviewed member capabilities remain the immutable evidence of what the person saw at each relationship revision.
- Persistence also records the distinct library-local source selectors represented by those members. A selector is the
  resolved observation origin plus the exact source sport reference; it never crosses the infrastructure port.
- Query projection expands a relationship with every current collection that matches one retained selector. Expansion
  applies the existing relationship revision; it does not pretend that the person authored another edit.
- A later import may therefore broaden effective session coverage, but it does not rewrite imported evidence, the
  reviewed member snapshot, the primary identity, or relationship authorship.
- A current collection with no source selector remains bound only by its reviewed capability. Unusable primary
  replacement remains review-required. Selector overlap or an effective membership above the bounded contract fails
  the coherent query without returning a partial or truncated projection.
- Revising a relationship replaces both its reviewed member snapshot and its derived selector set atomically. Removing
  it removes both sets and no imported evidence.
- Existing version-1 relationships migrate by deriving selectors from their current represented members. A selector
  claimed by incompatible relationships blocks migration rather than choosing one.
- Provider-normalization defaults are a separate adapter-owned, versioned rule set. The first supported default treats
  equal exact documented sport-code evidence within one observation origin as equal provider-neutral identity even
  when the provider session records carry distinct opaque identifiers. It does not assign that identity to unresolved
  sessions merely because they share an opaque identifier.
- Adding or changing a bundled provider rule requires a public or independently reproducible source-format contract,
  provenance, mapping version, synthetic fixtures, migration semantics, and a user-visible correction path. Private
  identifiers, equal display text, equal broad family, and frequency are never sufficient.
- An explicit personal relationship takes precedence over a provider-normalization default.

## Consequences

### Positive

- A correction is learned once and remains useful as a larger export introduces compatible collections.
- Distinct provider identifiers with the same exact documented meaning no longer fragment recognized history.
- Private source values remain local and provider-specific while application and presentation contracts stay opaque.
- Defaults and personal decisions have distinct authority, provenance, and correction semantics.

### Negative

- Relationship persistence now contains a private matching index in addition to the reviewed public aggregate.
- Projection must resolve dynamic members coherently and detect overlap after every evidence change.
- Provider normalization needs its own compatibility tests and cannot grow from anecdotal mappings.

### Risks and mitigations

- **Unexpected later member:** the rule is limited to exact retained selectors, visible effective coverage is recalculated,
  and conflicting expansion fails closed.
- **Silent provider overreach:** bundled rules require reproducible contract evidence and never contain values copied from
  a private export.
- **Loss of source detail:** base collections and imported evidence remain available; normalization changes projection,
  not storage.
- **Stale saved questions:** navigation and report execution continue to resolve the current exact member capabilities
  rather than storing a synthetic predicate.

## Verification

Domain and application tests retain every ADR-0036 invariant. Persistence and integration tests additionally prove
selector derivation, later compatible collection expansion, incompatible non-expansion, overlap rejection, revision,
removal, restart, backup, and migration from schema 36. Provider-normalization contract tests prove equal exact codes
across distinct opaque source identities, unequal-code separation, origin separation, personal precedence, and absence
of private identifiers from transport and diagnostics. Packaged end-to-end evidence must show that a saved correction
remains effective after a non-identical cumulative reimport.
