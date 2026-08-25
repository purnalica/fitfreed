# ADR 0027: Resolve sport identity from versioned provider evidence

- **Status:** Accepted
- **Date:** 2026-08-25
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-002](../../requirements.md#fr-002--idempotent-reimport),
  [FR-017](../../requirements.md#fr-017--multiple-data-source-importers),
  [FR-018](../../requirements.md#fr-018--source-provenance),
  [FR-020](../../requirements.md#fr-020--open-fitfreed-data-specifications),
  [FR-026](../../requirements.md#fr-026--user-authored-sport-classification),
  [NFR-002](../../requirements.md#nfr-002--privacy-of-reference-data),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality), and
  [NFR-009](../../requirements.md#nfr-009--developer-experience-quality),
  [NFR-022](../../requirements.md#nfr-022--vendor-neutral-domain-and-application-core)
- **Related delivery plan:** [MVP redesign production migration](../../plans/mvp-redesign-production-migration.md)
- **Related architecture:** [Source integration](../source-integration.md),
  [training exploration](../training-exploration.md), and [storage](../storage.md)

## Context

Imported training sessions preserve an exact source sport identifier, but a takeout need not contain the
provider-managed catalogue that assigns a human name to that identifier. Treating every such value as unknown
delegates basic recognition to the person and makes a populated library look broken. The identifier itself is
not an acceptable label: it is provider-specific, often opaque, and may expose source implementation detail.

Sport recognition cannot be inferred safely from route, speed, distance, heart rate, device, or other session
measurements. Those observations can fit multiple sports, and a plausible guess would be presented as imported
fact. User-authored labels solve personal naming but are a separate kind of evidence and must not erase or
masquerade as provider recognition.

The required provider catalogue is also not a canonical domain taxonomy. Providers own different identifiers,
hierarchies, localized names, revisions, access controls, and redistribution terms. Polar's complete official
catalogue currently requires authenticated `sports:read` access, and no redistribution basis has been established
for a bundled snapshot. The architecture must therefore support trustworthy evidence without assuming that one
provider's catalogue can be committed to the repository.

## Considered alternatives

### Keep all source sports unknown until a person classifies them

This preserves neutrality and avoids unsupported claims, but it makes the product transfer routine recognition
work to every person. It also collapses two different truths—missing provider evidence and deliberate personal
meaning—into one user-authored mechanism.

### Infer sport from recorded measurements

This can produce attractive labels without another source, but the evidence cannot establish a unique sport.
It was rejected because false recognition is worse than an explicit unknown and conflicts with the product's
evidence-first positioning.

### Promote one provider catalogue into the canonical domain

This provides direct names and hierarchy for one provider, but couples every read model and future importer to
that provider's taxonomy and lifecycle. It was rejected because it narrows a deliberately multi-provider model
and makes provider revisions appear to be domain changes.

### Install versioned provider evidence and project provider-neutral suggestions

Each adapter retains the exact join identifiers and catalogue provenance. Installation derives immutable,
versioned provider-neutral recognition candidates; application projections expose only localized names,
provider-neutral family suggestions, candidate cardinality, and opaque evidence capabilities. Personal meaning
remains an independent higher-precedence layer.

## Decision

FitFreed will resolve sport identity from an explicitly installed, activated, and versioned provider-catalogue
evidence snapshot:

- The infrastructure adapter owns provider code, source identifier, provider name key, parent identifier,
  retrieval source, and raw catalogue shape. None is promoted into the canonical training domain or displayed.
- A snapshot is immutable under `(sourceProvider, catalogueRevision, mappingVersion)` and carries retrieval time,
  provenance URI, source digest, normalized content digest, and deterministic candidate identities.
- The adapter maps each entry to localized names and an optional provider-neutral `SportFamily` suggestion. It
  does not translate provider hierarchy into a canonical hierarchy.
- Activation is explicit per provider. A different catalogue or mapping selection advances the training-
  discovery revision so Home, History, session, and report projections cannot mix identity generations.
- One exact candidate is `recognized`; multiple candidates are `ambiguous`; no candidate is `unknown`; absence
  of a recorded source sport is `unavailable`. Candidate order never selects a winner.
- A saved user classification produces `personally-overridden`. Its label or family wins in presentation while
  recognition evidence remains intact and inspectable. Reimport and catalogue refresh never overwrite it.
- Provider identifiers never cross the adapter boundary. Presentation and portable HTML receive an opaque local
  sport capability, state, personal classification, provider-neutral recognition, and candidate count only.
- No real provider catalogue may be bundled without verified retrieval provenance, update procedure, and lawful
  redistribution authority. A local-only acquisition mechanism would require its own reviewed implementation.

The normative evidence, identity, persistence, and read-model contracts are indexed in the
[data-format documentation](../../data-formats/README.md).

## Consequences

### Positive

- A populated library can use trustworthy localized sport names without weakening provider neutrality.
- Ambiguity and absence remain explicit rather than becoming guesses.
- Personal labels retain durable precedence without destroying source recognition or changing imported facts.
- Catalogue enrichment is reproducible, revision-coherent, and independently testable with synthetic evidence.
- Future providers can supply their own catalogue adapter without changing the domain states or presentation
  precedence.

### Negative

- Recognition adds a separate evidence lifecycle, persistence tables, activation policy, and contract versions.
- A provider with no authorized catalogue source remains honestly unknown even when a human could make a likely
  guess.
- Localized provider names add deterministic locale fallback behavior that every embedding read model and export
  must preserve.

## Verification

- Domain tests cover exact recognized, ambiguous, unknown, personally overridden, and unavailable states plus
  precedence and locale-independent evidence.
- Infrastructure tests cover validation, immutable identity, idempotent installation, conflicting content,
  activation, revision invalidation, reimport, migration, and rollback.
- Application and transport tests cover every embedding projection and reject provider identifiers at the public
  boundary.
- Machine-readable schemas compile in strict mode against independently constructed valid and invalid evidence.
- React and HTML tests cover localized recognition, personal precedence, semantic icons, filtering, reports, and
  ambiguous/unknown wording in both supported locales.
