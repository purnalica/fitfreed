# ADR 0029: Separate package identity, compatibility, and safety

- **Status:** Accepted
- **Date:** 2026-08-25
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-001](../../requirements.md#fr-001--import-a-polar-flow-export),
  [FR-008](../../requirements.md#fr-008--explicit-format-coverage),
  [FR-009](../../requirements.md#fr-009--evolutionary-compatibility),
  [FR-010](../../requirements.md#fr-010--observable-and-recoverable-import), and
  [FR-012](../../requirements.md#fr-012--protection-from-malicious-or-defective-input)
- **Related delivery plan:** [MVP redesign production migration](../../plans/mvp-redesign-production-migration.md)
- **Related architecture:** [Import lifecycle](../import-lifecycle.md) and
  [source integration](../source-integration.md)

## Context

The import boundary previously reported ordinary nested files, a wrong ZIP, an incompatible provider export,
and genuinely dangerous archive members through overlapping generic outcomes. Presentation then hid the only
specific terminal reason behind a secondary disclosure. A person could therefore receive an alarming safety
message for an ordinary unrelated ZIP or a vague compatibility message with no clear next action.

The same workflow entered the durable `Committing` state before reconciling all canonical items. Large
training imports then appeared to remain in finalization while the adapter reopened and remapped every session.
The phase label and completed file count did not describe the work still being performed.

Package recognition must improve without allowing provider-shaped names to authorize extraction or weaken ZIP
protections. Progress must expose only bounded work that the application can actually count.

## Considered alternatives

### Keep one generic invalid-package category

This preserves a small error surface, but it cannot distinguish user selection, provider compatibility,
malformed current content, and archive safety. Recovery guidance remains either vague or wrong.

### Extract into a private staging directory before identifying the package

This would make nested provider layouts easier to inspect, but it expands the trusted input surface and creates
private cleanup and resource-management state before package identity is known. It is unnecessary for the
current flat export contract.

### Classify inventory evidence, retain independent protections, and emit typed outcomes

The adapter can inspect central-directory names without decoding member content, classify whether they match
the current provider grammar, resemble another provider version, or are unrelated, and still scan every member
against the complete safety and resource policy before content is read.

## Decision

- The source adapter owns provider-format evidence and classifies package inventory as current,
  provider-shaped but unsupported, or unrecognized. Current lexical shape is distinct from required-content
  validity; a missing or malformed account claim is malformed current content, not a new provider version.
- Package identity never authorizes extraction. Central-directory integrity, traversal, absolute paths,
  symbolic links, encryption, duplicate names, expanded sizes, compression ratios, and member counts retain
  precedence over ordinary compatibility classification.
- Ordinary nesting without provider evidence is `not-supported-export`. Provider-shaped nesting or new lexical
  grammar is `unsupported-provider-version`. Genuine unsafe patterns remain `suspicious-archive-layout`
  regardless of provider evidence, and resource violations remain `archive-safety-limit`.
- Recognized current content that cannot satisfy its supported mapping or source-subject contract is
  `malformed-supported-export`. Source-subject conflicts and local system failures remain separate outcomes.
- Validation and source mapping report source-file units. Canonical reconciliation reports actual library-item
  units and remains cancellable through rollback. `Committing` begins only when reconciliation is complete and
  exposes no fabricated count or percentage.
- Presentation places the localized terminal reason and safe next action in the primary result. Exact coverage
  remains supporting detail. A presentation watchdog may explain that unchanged authoritative progress is taking
  longer than usual, but it cannot terminate work, invent elapsed-time predictions, or change the persisted
  outcome.

## Consequences

### Positive

- Wrong-file selection, current-format defects, provider evolution, safety violations, and system failures have
  distinct factual recovery paths.
- Safety scanning remains independent of and stronger than provider recognition.
- Long reconciliation work is observable and cancellable instead of being mislabeled as final commit.
- The persisted outcome codes and transport contracts are stable, localizable, and suitable for future adapters.

### Negative

- Import transport gains a reconciliation phase and additional terminal codes.
- Provider adapters must maintain lexical identity evidence separately from artifact mapping rules.
- Historical terminal codes remain readable even though the current adapter no longer emits them.

### Risks and mitigations

- A provider-like filename in an unrelated ZIP can produce a compatibility outcome. The adapter requires an exact
  documented artifact grammar for the current format and uses provider prefixes only for the narrower
  unsupported-version category; it never reads content before protection checks pass.
- A long operation can produce no new authoritative event while processing one large item. The watchdog reports
  only continued local work and unchanged-library protection; bounded size limits and cancellation checks remain
  the operational controls.

## Verification

- Adapter tests cover unrelated archives, nested provider-shaped archives, malformed current content, traversal
  mixed with ordinary nesting, duplicate members, resource limits, and missing source-subject evidence.
- Import tests cover counted mapping and reconciliation, two-pass training work, cancellation with rollback,
  immediate retry, exact repeat, cumulative import, interruption, and restart recovery.
- JSON Schema and transport tests cover every progress phase and complete terminal outcome shape.
- React tests cover primary terminal reasons, factual counts, delayed-work explanation, cancellation, and retry.
- Packaged E2E imports unrelated, malformed, valid, repeated, and overlapping synthetic ZIPs and verifies the
  visible outcome and unchanged-library guarantees.
