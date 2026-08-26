# ADR 0031: Scope training-target sport evidence to one session

- **Status:** Accepted
- **Date:** 2026-08-26
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-002](../../requirements.md#fr-002--idempotent-reimport),
  [FR-017](../../requirements.md#fr-017--multiple-data-source-importers),
  [FR-018](../../requirements.md#fr-018--source-provenance),
  [FR-026](../../requirements.md#fr-026--user-authored-sport-classification),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality), and
  [NFR-022](../../requirements.md#nfr-022--vendor-neutral-domain-and-application-core)
- **Related delivery plan:** [MVP redesign production migration](../../plans/mvp-redesign-production-migration.md)
- **Related architecture:** [ADR 0027](0027-resolve-sport-identity-from-versioned-provider-evidence.md),
  [source integration](../source-integration.md), and [storage](../storage.md)

## Context

Training sessions in the evaluated takeout expose an opaque `sport.id` without its identifier-to-name catalogue.
Sport profiles and completed training targets expose detailed source sport codes whose names are published in the
official AccessLink vocabulary, but neither source documents a global relationship to session `sport.id`.

Completed targets do provide an exact local start time. Some relate unambiguously to one current session in the
same source subject. That narrower evidence can recover provider-authored meaning for those sessions. Promoting it
to every session with the same opaque identifier would exceed the evidence; one evaluated opaque value is related
to different detailed target codes in different sessions.

## Considered alternatives

### Keep every session unknown until the separate catalogue is available

This preserves certainty but discards a direct source-authored relationship already present in some exports. It
unnecessarily leaves useful sessions unnamed.

### Learn a global opaque-identifier mapping from matching targets

This would label many more sessions, but assumes that equal opaque values mean one detailed sport across records.
The evaluated evidence contradicts that assumption. Frequency, profile order, measurements, and device context do
not repair it.

### Preserve exact target-to-session evidence

This uses only a completed target whose normalized local start identifies one and only one session in the same
origin. The detailed sport code remains adapter-private and becomes a provider-neutral suggestion for that session.
Unmatched and multiply matched targets change no identity.

## Decision

FitFreed will preserve completed training-target sport codes as session-scoped recognition evidence only when
normalized target start matches exactly one current session in the same resolved origin.

- `done = false`, no match, and multiple session matches contribute no candidate.
- Distinct codes on one exact target remain multiple candidates and produce `ambiguous`; order never chooses one.
- Repeated equal codes contribute once.
- The adapter maps only explicitly documented detailed-sport codes to localized names and an optional canonical
  family. Unknown valid codes remain evaluated but unmapped.
- Sport-profile codes validate the observed vocabulary shape but do not create a session join.
- Exact session candidates replace less-specific catalogue candidates for that session. Personal classification
  retains presentation precedence.
- Provider code, artifact locator, digest, record path, and export metadata remain inside infrastructure. Public
  projections receive only provider-neutral names, family suggestion, mapping provenance, opaque evidence
  identity, and candidate count.
- A mapping-set revision reassesses identical ZIP bytes. Equal evidence persistence is idempotent.

The normative relationship and persistence contracts are indexed in the
[data-format documentation](../../data-formats/README.md).

## Consequences

The application recognizes some planned sessions immediately without guessing or waiting for an authenticated
catalogue. Unplanned sessions and targets without a unique relationship remain honestly unknown. A single opaque
source sport can legitimately produce different session-level results, so later sport-summary and filtering
projections must group by effective evidence rather than assuming that opaque reference is a user-facing sport.

The solution adds a source-specific parser, independently authored vocabulary mapping, attributed persistence,
mapping-version lifecycle, and session-aware read resolution. It does not import target phases, objectives, or
other training-plan content; that remains a separate high-priority product increment.

## Verification

- Synthetic imports prove one exact completed target recognizes only its related session even when another session
  shares the same opaque sport reference.
- Tests prove incomplete targets and non-unique session starts contribute no recognition.
- Multiple exact source codes remain ambiguous, exact reimport is idempotent, selection preserves the same identity,
  and source codes do not cross the public read model.
- Every declared SQLite baseline migrates atomically through schema 29 with integrity checks before and after an
  injected interruption.
