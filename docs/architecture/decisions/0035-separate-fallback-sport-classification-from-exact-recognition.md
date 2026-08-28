# ADR 0035: Separate fallback sport classification from exact recognition

- **Status:** Accepted
- **Date:** 2026-08-28
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-002](../../requirements.md#fr-002--idempotent-reimport),
  [FR-018](../../requirements.md#fr-018--source-provenance),
  [FR-026](../../requirements.md#fr-026--user-authored-sport-classification),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality), and
  [NFR-022](../../requirements.md#nfr-022--vendor-neutral-domain-and-application-core)
- **Related delivery plan:** [MVP redesign production migration](../../plans/mvp-redesign-production-migration.md)
- **Related architecture:** [ADR 0027](0027-resolve-sport-identity-from-versioned-provider-evidence.md),
  [ADR 0031](0031-scope-training-target-sport-evidence-to-one-session.md), and
  [training exploration](../training-exploration.md)

## Context

One source profile can back sessions with exact session-level sport evidence and sessions without it. Discovery
correctly represented those sets separately, but the persisted personal classification was keyed to the source
profile. Saving a label therefore caused the projection to reunite both sets, remove the recognized collection, and
change visible counts. The operation named an unresolved sport yet silently overrode stronger evidence and changed
which sessions the visible collection represented.

The decision must preserve source evidence, stable navigation, personal correction, migration of saved filters, and
a future deliberate way to relate identities. Provider-correlation and global catalogue acquisition remain separate
evidence decisions.

## Considered alternatives

### Let source-profile classification override every session using the profile

This offers one edit for all sessions but silently absorbs exact recognition. A collection changes membership and
identity after naming, so the action does more than it states and destroys the distinction established by exact
evidence.

### Create an independent personal classification for every exact collection

This keeps collections separate but duplicates personal meaning across evidence-derived identities and makes ordinary
correction depend on the current mapping revision. It also treats a fallback label and a deliberate relationship as
the same concept.

### Scope fallback classification to the non-exact source-profile remainder

This preserves exact evidence and gives the unresolved remainder one adaptable interpretation. A future relationship
that intentionally unifies identities remains a different aggregate and explicit operation.

## Decision

`SportClassification` has the single explicit scope `unresolved-source-profile`. It applies only to sessions backed
by the source profile that have no stronger exact-session sport evidence.

- Exact recognized and ambiguous collections expose no fallback `sportRef` or classification.
- The source-profile remainder keeps one stable classification capability and one stable exact-session filter.
- Save, reset, reimport, restart, and mapping refresh never move exact sessions into the fallback collection.
- Equal personal labels or families do not relate or merge identities.
- A future user-authored unified-sport relationship requires a separate aggregate, command, persistence contract,
  projection, and visible confirmation of affected sessions.
- A legacy workspace filter that denoted the complete source profile migrates to every current represented collection
  for that profile, preserving its historical session set without exposing the internal source key.

## Consequences

### Positive

- Personal naming cannot make recognized sports disappear or change size.
- Stronger evidence retains precedence without deleting user-authored meaning.
- Collection filters remain stable and their membership matches the action shown to the person.
- Future identity unification has an honest domain boundary rather than an implicit side effect.

### Negative

- One historical source profile can remain visible as more than one represented sport collection.
- A person who genuinely wants one identity across exact and fallback evidence needs a later explicit capability.
- Identity, discovery, Home, structure, story, report, and export contracts require coordinated version changes.

### Risks and mitigations

- Similar labels can look duplicative. Presentation retains evidence states and exact session counts rather than
  merging by text.
- Old saved filters could narrow accidentally. Migration resolves the internal source-profile identity to every
  represented collection and verifies the preserved session set with synthetic evidence.

## Verification

Domain tests require the explicit classification scope. Application and infrastructure tests prove that saving a
fallback classification preserves the exact collection, both filter identities, and each represented session set.
Migration tests prove a legacy profile capability expands to exact and fallback collections without making the source
identity public. Contract schemas reject a classification without its scope, and full reimport, restart, report, and
portable-output gates protect the downstream projections.
