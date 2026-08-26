# ADR 0030: Preserve typed archive resource limits

- **Status:** Accepted
- **Date:** 2026-08-26
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-001](../../requirements.md#fr-001--import-a-polar-flow-export),
  [FR-010](../../requirements.md#fr-010--observable-and-recoverable-import), and
  [FR-012](../../requirements.md#fr-012--protection-from-malicious-or-defective-input)
- **Related delivery plan:** [MVP redesign production migration](../../plans/mvp-redesign-production-migration.md)
- **Related architecture:** [Import lifecycle](../import-lifecycle.md)
- **Refines:** the aggregate resource-limit outcome in
  [ADR 0029](0029-separate-package-identity-compatibility-and-safety.md)

## Context

The import boundary protects the device with limits on archive member count, per-member expanded size, total expanded
size, compression ratio, and bytes read from a member. These conditions previously became `ResourceLimit(String)` and
then the single persisted code `archive-safety-limit`. The interface could therefore say only that an unspecified
processing limit had been exceeded. That message did not identify what happened or support a specific recovery, even
though the adapter already knew the cause.

Detailed archive member names and paths are private source evidence. Persisting the diagnostic string would reveal
those values and make presentation depend on unstable implementation text.

## Considered alternatives

### Keep one terminal code and improve its wording

One sentence cannot give accurate recovery for an excessive file count, an oversized member, an excessive total,
extreme compression, and a member that supplies more bytes than declared. The application would continue discarding
known information before presentation.

### Persist the infrastructure error string

This would retain detail, but it would expose member locators, couple the public contract to implementation text, and
make localization unreliable.

### Preserve a typed reason and persist only its stable category

The infrastructure error can carry bounded numeric facts for diagnostics while the persisted import outcome stores a
stable category. Presentation can then explain the actual limit and recovery without receiving paths or personal
values.

## Decision

- Archive resource failures are represented by a closed typed reason: entry count, expanded member size, total
  expanded size, compression ratio, or bounded read exhaustion.
- The in-process reason may contain only the observed bounded count or size and the configured maximum. It never
  contains an archive member name, path, or source value.
- Each reason maps to a distinct stable terminal code. The existing `archive-safety-limit` and
  `archive-resource-limit` codes remain localized for historical libraries but are not emitted by current imports.
- Member reads enforce the same per-member limit independently of ZIP metadata and stop before appending bytes beyond
  that boundary.
- Localized primary outcomes name the actual limit, confirm that the existing library was not changed, and provide a
  recovery appropriate to that condition.

## Consequences

### Positive

- A rejected import explains the known cause instead of presenting an unspecified safety warning.
- Recovery differs appropriately between a fresh export, provider-format assessment, and confirmation of the source
  archive.
- Malformed metadata cannot bypass the memory bound used after validation.
- Persisted outcomes remain stable and privacy-preserving.

### Negative

- The public terminal-code vocabulary grows by five values.
- Changes to configured limits require coordinated updates to code, localized copy, and the import-control reference.

## Verification

- Infrastructure tests cover the terminal code for every typed reason, the compressed-ratio rejection, and a bounded
  read that supplies more bytes than its configured limit.
- Translation and data-contract checks require every current code in both supported locales and in the import-control
  reference.
- Import integration tests verify that a rejected resource outcome leaves canonical history unchanged.
- The production-native review repeats a rejected archive journey and evaluates the primary explanation and recovery.
