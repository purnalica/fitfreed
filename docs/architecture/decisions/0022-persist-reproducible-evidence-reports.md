# ADR 0022: Persist reproducible evidence reports

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** FitFreed maintainers and product owner
- **Related requirements:** [FR-005](../../requirements.md#fr-005--reports)
- **Related architecture:** [Reporting](../reporting.md), [module map](../module-map.md), [storage](../storage.md)

## Context

The implemented Insights comparisons are disposable read models. They can answer bounded questions but cannot preserve a person's selection, interpretation, ordering, or export. The accepted product direction requires a result that survives the current screen and remains understandable independently of FitFreed.

A screenshot or print action would capture presentation pixels without a reproducible definition, exact evidence, refresh semantics, authorship, or accessible structure. A free-form analytical notebook or publishing system would provide broad flexibility but would make persistence, compatibility, deterministic output, privacy, and accessibility too large for the first complete slice.

## Decision drivers

- Preserve a person's interpretation without copying unexplained display values.
- Keep report calculation inside provider-neutral application queries.
- Make reports evolvable after reimport, mapping, or calculation changes.
- Produce an independently useful, deterministic, accessible, and offline result.
- Expose sensitive health and location content before export.
- Deliver a complete composition journey without building a general publishing platform.

## Considered alternatives

### Export the current screen or a screenshot

This is visually familiar but loses exact evidence, semantic structure, provenance, refresh behavior, and accessibility. It cannot serve as the durable user-owned result.

### Build a free-form canvas or analytical notebook

This offers maximum flexibility but introduces arbitrary layout, formulas, query authoring, plug-ins, and multi-format rendering before the smaller evidence-report journey is validated.

### Persist an ordered evidence definition and export self-contained HTML

This closes composition, persistence, evolution, privacy review, and portable output with one bounded model. HTML supplies semantic structure, exact tables, embedded graphics, and offline reopening without a second document engine.

## Decision

FitFreed will persist a versioned `ReportDefinition` and use deterministic, self-contained HTML as the first normative report output.

- A report begins from a supported question, exploration, session, or reusable blank definition.
- Its ordered typed blocks may contain a finding, comparison, session, chart, exact table, coverage and limitations, narrative, and a route only when the accepted route contract is available.
- The definition stores stable references to canonical evidence and versioned application questions, query parameters, presentation choices, user narrative, provenance policy, sensitivity choices, refresh state, and compatibility version. It does not store copied screen values as its source of truth.
- Definitions support add, remove, move up, move down, configure, save, edit, multiple reports, reopen after restart, migration, and portable backup. Pointer reordering may enhance but never replace semantic controls.
- New imports or calculation changes mark an affected definition stale. The person can compare, deliberately refresh, or retain the saved interpretation; refresh never silently rewrites authored text.
- Preview and export distinguish recorded source facts, FitFreed calculations, user-authored text, coverage, limitations, and unavailable conclusions.
- Export passes through an application port and a replaceable local adapter. It is deterministic, cancellable, atomic, and cleans up incomplete output after failure.
- The HTML output embeds its styles and graphics, contains no scripts or external requests, declares locale and units, preserves semantic headings and tables, and records provenance, authorship, definition version, and source revision metadata.
- Sensitive-content review precedes export and can remove precise route geometry, redact route endpoints, and omit optional physiological context without mutating the saved definition accidentally.
- CSV may later become an optional exact-value appendix. Native PDF, formulas, arbitrary queries, free-form positioning, shared cloud templates, scheduled generation, and plug-in blocks are outside the first slice.

## Consequences

### Positive

- A report remains useful in a supported browser without FitFreed or a network connection.
- Definitions are testable, migratable, portable user-owned information rather than presentation state.
- Application use cases remain the only calculation path for presentation and export.
- Semantic HTML provides an accessible exact alternative and a stable foundation for user-controlled printing.

### Negative

- Report compatibility, stale detection, and migration become durable product responsibilities.
- Deterministic output constrains layout and embedded visual implementation.
- The first output is not a native PDF and does not provide free-form page design.

### Risks and mitigations

- Export could leak sensitive route or physiological information. A content inventory and explicit review precede every export.
- Stored references could become unavailable. Resolution reports missing evidence and compatibility state without inventing replacement facts.
- HTML could depend accidentally on the application runtime. Contract tests reopen output independently with network access disabled and reject scripts or external resources.

## Verification

Acceptance requires domain and use-case tests for definition invariants, ordering, authorship, compatibility, stale state, deliberate refresh, sensitivity, and missing evidence; migration and restart tests for multiple reports; exhaustive presentation tests for every control and failure state; and independent-output tests for deterministic bytes, semantic structure, exact values, metadata, no external requests, cancellation, and cleanup. A packaged journey must create a report from an exploration, restart, reopen it, import more data, review a refresh, export it, and verify the independent result in both locales.
