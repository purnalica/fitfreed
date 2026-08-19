# Reporting Architecture

## Status

Implemented first vertical under [ADR 0022](decisions/0022-persist-reproducible-evidence-reports.md) and E5 of the [MVP experience delivery plan](../plans/mvp-experience-delivery.md). The application persists, reopens, edits, resolves, privacy-reviews, and exports the version-1 session report described here. Deliberate source refresh and additional block kinds remain later versioned capabilities; a stale definition cannot be exported by this vertical.

## Ownership

- The domain owns report identity, ordered typed blocks, authorship, compatibility, sensitivity choices, and definition invariants that are independent of a specific calculation or output technology.
- The application owns creation, editing, resolution, stale detection, preview composition, and export orchestration through explicit query and output ports. A later increment must add deliberate refresh as a use case rather than mutating a stale definition implicitly.
- Insights queries remain the authoritative calculation paths. Report resolution references them; it does not copy their rules or read database rows.
- Persistence stores and migrates versioned definitions transactionally with the local library.
- Presentation owns the editor interaction, preview, privacy review, and explicit file-destination request.
- A replaceable outer adapter renders one resolved report into deterministic self-contained HTML and atomically promotes the completed file.

## Definition and resolved output

`ReportDefinition` is durable user-authored information. Version 1 references one stable canonical training session, records one ordered evidence block followed by one plain-text narrative block, and preserves the report locale and physiological-context choice. It stores no resolved measurement and does not claim that a previously displayed value remains current.

A resolved preview or export is a time-bound projection. It records the definition version, source revision, locale, units, provenance, coverage, limitations, authorship, and resolution status. New imports or calculation changes can make a definition stale; comparison and refresh are deliberate use cases rather than automatic mutations.

## Export boundary

The first normative output is a self-contained semantic HTML document with embedded styles and graphics, no script, and no external request. Export is local, cancellable, deterministic for the same resolved input, and atomic. Failure or cancellation leaves no file that can be mistaken for a completed report.

Sensitive-content review is an application decision before rendering. Review can remove physiological context allowed by the saved definition but cannot add excluded context. Version 1 never authorizes routes, coordinates, or exact training samples. The adapter receives only the accepted resolved content and cannot infer additional authority.
