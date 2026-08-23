# Reporting Architecture

## Status

Implemented session, route, training-period comparison, question, exploration, and blank composition under
[ADR 0022](decisions/0022-persist-reproducible-evidence-reports.md) and E5 of the
[MVP experience delivery plan](../plans/mvp-experience-delivery.md). The application persists, reopens,
edits, resolves, privacy-reviews, and exports immutable version-1 definitions, composable version-2
definitions, analytical version-3 definitions, and provider-neutral multi-origin version-4 definitions.
It also detects stale evidence and deliberately refreshes an exact reviewed candidate without rewriting
authored content. A stale definition cannot be edited or exported until that decision completes.
Resolved reports expose an origin-aware path to their exact current session or training-period comparison
when that source is still available.

## Ownership

- The domain owns report identity, ordered typed blocks, authorship, compatibility, sensitivity choices, and definition invariants that are independent of a specific calculation or output technology.
- The application owns preparation, creation, editing, revision-bound removal, resolution, stale detection,
  deliberate refresh, preview composition, and export orchestration through explicit query and output ports.
- Insights queries remain the authoritative calculation paths. Report resolution references them; it does not copy their rules or read database rows.
- Persistence stores and migrates versioned definitions transactionally with the local library.
- Presentation owns the staged Library, Compose, and Preview workspace, current-candidate refresh review,
  privacy review, and explicit file-destination request. Switching stages preserves the mounted draft and
  resolved candidate but removes every inactive stage from visual and assistive-technology exposure.
- A replaceable outer adapter renders one resolved report into deterministic self-contained HTML and atomically promotes the completed file.
- Session sport identity uses the same canonical provider-neutral SVG sprite as the application. The adapter
  embeds that local sprite, chooses a semantic family or state symbol, and renders either the escaped authored
  label or the report locale's family label; technical family codes never become report copy.

## Definition and resolved output

`ReportDefinition` is durable user-authored information. Version 1 remains readable as one fixed session
block followed by one narrative. Version 2 contains 2–32 semantic positions, requires exactly one session
block and one narrative, and can include each authoritative route from the origin session once. Version 3
adds the training-period block family. Version 4 separates stable origin intent from the evolving answer and
accepts session, versioned-question, exact-exploration, and blank origins. A version-4 definition may contain
zero or one narrative block when supported evidence makes it factual; versions 1–3 retain their immutable
narrative requirement. Every block can be reordered; optional blocks can be added or removed. Existing
identities are preserved through edits, and editing an earlier definition produces a version-4 successor
without rewriting historical migration input.

## Report starts

`prepare_report_start` is the single application entry for question, exploration, and blank starts. It
binds the start to one current training snapshot, validates exploration queries, and derives bounded adjacent
periods for the supported question. Blank starts receive the same query only as optional composition help;
their persisted origin remains blank. Session starts already carry an exact session and snapshot capability
from the authoritative session search result and therefore require no separate preparation.

Question and exploration origins require coherent analytical evidence and prohibit session or route blocks.
Blank origins may remain narrative-only or gain analytical blocks later. Reopening a narrative-only blank
definition prepares a suggestion only when the current snapshot still equals its saved snapshot. No start
path stores a provider object, copied calculation, or presentation-only workspace state.

Reports opens on a result-first **Library**, where saved definitions and the supported question start have one
conceptual home. When saved results exist, presentation keeps the question start as one compact secondary
action in the Library heading; only an empty Library expands its orientation. Session and exploration starts enter from the exact evidence already being viewed. The
application compatibility path can still prepare a blank origin, but ordinary presentation does not expose a
generic blank start; persisted blank-origin reports remain readable and editable. A start enters **Compose**;
a successful save or a saved-report selection enters **Preview**. The full ordered
editor remains mounted while Library or Preview is active, so moving between stages does not discard title,
narrative, periods, measurements, privacy choices, or block order. Preview is independently inspectable and
replaces itself with stale-evidence review, export privacy review, or deletion confirmation; it never stacks
these decisions below the editor. **Cancel composition** is a distinct state transition rather than another
stage switch: for a saved definition it reconstructs the editor from the resolved reviewed revision, opens
Preview, and focuses the result heading; for an unsaved contextual start it clears the draft and returns
through the exact source-navigation contract; for a Library-owned start it clears the draft, opens Library,
and focuses the Library heading. None of those paths invokes a report write. Cancelling deletion restores
Preview and focus. A successful removal clears
the selected report, reloads the bounded Library, and focuses its heading; an optimistic conflict reloads and
resolves the latest definition without announcing removal. This hierarchy is disposable presentation state
and does not enter a definition, application DTO, or persistence row.

The result-first library projection is separate from complete report resolution. It pages at most 24 of the
1,000 bounded definitions, resolves only an indexed session selection or one authoritative comparison metric,
reuses identical comparison queries within the page, and caps visible per-source results without merging them.
It derives sensitivity from saved authority and never loads route geometry, exact signals, complete provenance,
or export output. One bounded retry prevents a library revision change from producing mixed evidence.
Presentation renders the subject, human date or period, primary result, evidence state, and sensitivity summary
as the card hierarchy. Stable references and revisions remain transport capabilities rather than visible card
copy. Selecting a card performs complete resolution only for that report and opens Preview rather than Compose.

Evidence-backed starts do not create an empty narrative block. Compose exposes one secondary **Add
commentary** action, focuses the resulting field, and keeps the authored block in the same ordering controls
as evidence. It allows removal only when supported evidence remains; this preserves a legacy narrative-only
blank report until evidence is deliberately added. Submission trims commentary and omits an empty draft, so
presentation never turns an untouched field into authorship. Successful save still resolves the exact saved
definition and moves to Preview.

Preview leads with the authored title and first ordered evidence or commentary block before its secondary
action rail. When evidence is stale, both the direct edit action and the Compose workspace location remain
disabled until the exact candidate has been reviewed and accepted; a disabled form is never presented as an
alternative route around that boundary.

## Origin-aware navigation

Report navigation has two deliberately different lifetimes. Starting a report from a mounted session or
comparison captures only a transient presentation return target and initiating control. **Back to the
session** or **Back to the comparison** reveals that still-mounted workspace and restores keyboard focus;
this state is not added to the report definition or SQLite.

Opening a saved report derives its canonical source from the resolved definition. A session origin maps to
the exact current opaque session capability and its recorded local date. An exploration origin retains its
exact versioned comparison query; a question origin derives the same query from its coherent analytical
block family. A narrative-only blank report has no invented source. Presentation sends the typed target to
the established session-selection or training-comparison command, focuses the resulting heading, and keeps
only the report identity required by **Back to report**. Returning reopens that exact saved report. If
resolution cannot provide the referenced session or coherent analytical query, the source action is absent
rather than falling back to an unrelated explorer.

These navigation descriptors contain no provider identity, raw database key, copied result, or durable
browser-history surrogate. Opening a saved report source neither saves nor clears the resumable exploration
destination; returning to the report restores the previously mounted Explore destination. Application use
cases remain responsible for snapshot validation and exact selection; presentation owns mounting, transient
return state, and focus restoration.

A route block stores only the origin session capability, route capability, and an authored 0–5,000-metre endpoint-redaction choice. The application verifies membership through `TrainingSessionRoutePort`, obtains exact points through the same authoritative route port, and performs two memory-bounded passes: total cumulative haversine distance followed by deterministic selection of recorded points inside the retained interval. Internal report processing requests at most 10,000 points per page; the separate interactive exact-point contract remains capped at 250. It neither interpolates coordinates nor reads route tables. At most 500 retained recorded points cross into the resolved report.

A resolved preview or export is a time-bound projection. It records the definition version, source revision, locale, units, provenance, coverage, limitations, authorship, and resolution status. New imports or calculation changes can make a definition stale; comparison and refresh are deliberate use cases rather than automatic mutations.

Report removal is deliberately revision-bound. The application reloads the definition, asks the domain to
authorize removal of the exact reviewed revision, and performs one optimistic compare-and-remove operation.
SQLite cascades only the report's owned blocks; imported history and every other report remain unchanged. A
successful operation returns the removed report identity, title, and revision so presentation never invents
the object named in confirmation or outcome copy.

## Deliberate refresh

Stale resolution returns the complete current candidate while retaining the saved definition and locking
editing and export. FitFreed does not store previous canonical snapshots, so the review never fabricates old
numeric values. It discloses that boundary and identifies what remains authored versus what will be resolved
again.

`refresh_report` accepts the exact definition revision, saved snapshot, and candidate snapshot that were
reviewed. The application reloads the definition, resolves the candidate again through the same
authoritative ports, rejects current, unavailable, incompatible, mismatched, or concurrently changed
evidence, creates a successor that changes only `sourceSnapshotRef` and `revision`, verifies that successor
as current, and performs optimistic compare-and-save. Cancellation writes nothing. A failed verification or
write retains the prior definition. Persistence needs no new storage shape because these two values already
belong to the versioned definition; restart tests prove the successor is durable.

## Training-period comparison family

Finding, comparison, chart, exact-table, and coverage blocks are five implemented ordered views of one
`training-period-comparison` question, not five independent calculations. Each block carries the same
versioned baseline and comparison ranges; the domain rejects mixed parameters and duplicate analytical
kinds. Finding and chart blocks select a supported metric, while the other blocks retain the complete
authoritative result. The application resolves the family once through `TrainingLibraryPort` and the
established training comparison use case. Persistence schemas 22 and 23 store only question and origin
intent, React receives the resolved provider-neutral projection, and version-3 or version-4 HTML renders it without
reading SQLite. Snapshot checks surround the single comparison query so a concurrent import cannot combine
revisions.

## Export boundary

The first normative output is a self-contained semantic HTML document with embedded styles and graphics, no script, and no external request. Export is local, cancellable across paginated resolution and staged output, deterministic for the same resolved input, and atomic. Failure or cancellation leaves no file that can be mistaken for a completed report.

Sensitive-content review is an application decision before rendering. Review can remove physiological context allowed by the saved definition, omit each route, or increase its endpoint redaction. It cannot add excluded physiology, introduce another route, or reduce the saved location protection. Exact choices are bound to block identities before the adapter runs.

The review always lists the report title and lists authored commentary only when the resolved definition has
that block. This disclosure mirrors the generated content; a factual report cannot claim an interpretation
that the user never supplied.

Version-2 through version-4 HTML render selected route blocks as normalized local SVG shapes in definition
order. Version-3 and version-4 analytical blocks use exact visible tables and CSS-only bars from one
authorized comparison. Version-4 provenance is discriminated: session attribution includes the current
source, analytical non-session output names the local-library revision, and narrative-only output explicitly
states that it contains no imported evidence. Recorded latitude, longitude, altitude, elapsed point values,
exact training samples, opaque source-series identities, and nonexistent provider relationships never enter
the generated bytes. The adapter receives only the authorized bounded projection and cannot infer additional
authority.
