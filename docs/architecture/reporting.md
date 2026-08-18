# Reporting Architecture

## Status

Accepted target architecture under [ADR 0022](decisions/0022-persist-reproducible-evidence-reports.md). The current application provides disposable Insights comparisons but does not yet persist `ReportDefinition` or export a report. Implementation proceeds through E5 of the [MVP experience delivery plan](../plans/mvp-experience-delivery.md).

## Ownership

- The domain owns report identity, ordered typed blocks, authorship, compatibility, sensitivity choices, and definition invariants that are independent of a specific calculation or output technology.
- The application owns creation, editing, resolution, stale detection, deliberate refresh, preview composition, and export orchestration through explicit query and output ports.
- Insights queries remain the authoritative calculation paths. Report resolution references them; it does not copy their rules or read database rows.
- Persistence stores and migrates versioned definitions transactionally with the local library.
- Presentation owns the editor interaction, preview, privacy review, and explicit file-destination request.
- A replaceable outer adapter renders one resolved report into deterministic self-contained HTML and atomically promotes the completed file.

## Definition and resolved output

`ReportDefinition` is durable user-authored information. It references stable canonical evidence and versioned questions, records ordered blocks and choices, and preserves user narrative. It does not claim that a previously displayed value remains current.

A resolved preview or export is a time-bound projection. It records the definition version, source revision, locale, units, provenance, coverage, limitations, authorship, and resolution status. New imports or calculation changes can make a definition stale; comparison and refresh are deliberate use cases rather than automatic mutations.

## Export boundary

The first normative output is a self-contained semantic HTML document with embedded styles and graphics, no script, and no external request. Export is local, cancellable, deterministic for the same resolved input, and atomic. Failure or cancellation leaves no file that can be mistaken for a completed report.

Sensitive-content review is an application decision before rendering. The adapter receives only the accepted resolved content and cannot infer authority to include precise routes or optional physiological context.
