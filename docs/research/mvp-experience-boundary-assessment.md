# MVP Experience Boundary Assessment

## Status

Recommendation ready for product-owner review as of 2026-08-18. This assessment resolves the
evidence work in D0 of the [MVP experience delivery plan](../plans/mvp-experience-delivery.md); it
does not change confirmed production scope until the recommendations are accepted and reflected in
the requirements and roadmap.

## Decision objective

Choose the smallest report-authoring and deep-session slices that make FitFreed distinctive without
shipping an attractive shell over unsupported behavior. The same assessment validates the
origin-aware navigation contract, establishes an honest sport-classification path, and identifies
which external libraries earn a place in the MVP.

The recommendations optimize for one complete value loop:

> find an owned record or answer → inspect its evidence → return without rebuilding the search →
> preserve a personal interpretation → export an independently useful result

## Evidence boundary

- The production application already imports, reconciles, persists, and queries provider-neutral
  activity, training-summary, sleep, recovery, and longitudinal views. Report definitions, deep
  session children, routes, samples, user criteria, and navigation snapshots do not yet exist in
  those lower layers.
- A local interactive prototype uses independently invented histories only. It exercises report
  creation from an answer, session, or blank definition; add, remove, reorder, configure, save,
  reopen, preview, stale refresh, sensitive-content review, export failure, retry, and origin-aware
  return. Its automated interaction, locale-parity, focus-restoration, and accessibility checks pass.
  The prototype remains local working material under the repository content policy.
- Clean-room inspection of the private reference export emitted field paths, types, optionality, and
  collection cardinality only. No value, identifier, filename, timestamp, coordinate, count, or
  derived personal fingerprint entered this assessment.
- Polar's current [Dynamic API reference](https://www.polar.com/polar-api-v4/) supplies public
  semantic correspondence for training exercises, laps, interval samples, routes, zones, pause
  times, swimming statistics, and the separately authenticated sports catalogue. It does not define
  the takeout ZIP or guarantee that the two delivery contracts evolve together.

## Recommended report MVP boundary

### Select an ordered evidence report

The MVP should implement an ordered, responsive report made of typed evidence blocks. It should not
implement a screenshot exporter, a free-form page-layout canvas, or a general analytical notebook.

The first complete report supports:

- starts from a supported answer, a session, or a reusable blank definition;
- a title and user-authored narrative;
- ordered finding, comparison, session, chart, exact-table, coverage-and-limitation, and narrative
  blocks, plus a route block only when the deep-session route contract is available;
- add, remove, move up, move down, and per-block inclusion of exact values, provenance, and
  limitations through semantic controls rather than drag-only interaction;
- transactional local save, edit, multiple reports, reopen after restart, explicit version and
  compatibility behavior, and portable backup with the rest of the library;
- references to versioned application questions and canonical evidence rather than copied display
  values or persistence queries;
- visible authorship of recorded facts, FitFreed calculations, and user text;
- stale detection after import or calculation changes, followed by review, deliberate refresh, or
  retention of the saved result;
- an output preview without editor or private navigation state; and
- sensitive-content review before export, including precise route geometry, endpoint redaction, and
  optional physiological context.

The first normative export should be a deterministic, self-contained HTML document with embedded
styles and graphics, semantic headings and tables, no scripts, no external requests, declared
locale, units, coverage, limitations, provenance, authorship, report-definition version, and source
revision metadata. It must reopen independently in a supported browser and remain useful when the
application is unavailable. Printing that document is a user-controlled convenience, not a claim
that FitFreed has produced an accessible archival PDF.

CSV is an optional exact-value appendix after the HTML contract passes; it cannot represent the
report by itself. Native PDF generation, shared templates, formulas, arbitrary queries, free-form
positioning, plug-in blocks, cloud collaboration, and scheduled generation remain outside this MVP
slice.

### Why this is the smallest complete slice

| Alternative | User value | Completeness | Risk | Decision |
|---|---:|---:|---:|---|
| Screenshot or print-current-screen export | Low | Low | Medium | Reject: it loses reproducibility, exact evidence, refresh semantics, and accessibility. |
| Ordered evidence report with self-contained HTML | High | High | Medium | Select: it closes composition, persistence, evolution, privacy, and portability as one journey. |
| Free-form report designer and multi-format publishing system | High | Medium | Very high | Defer: layout freedom and format breadth delay the first durable result without proving more ownership. |

## Recommended deep-session MVP boundary

### Source evidence

The private structural inspection and public API correspondence jointly establish these candidate
concepts without establishing a takeout guarantee:

| Source area | Structural observation | Public semantic correspondence | Consequence |
|---|---|---|---|
| Exercises | Absent, one, and multiple children occur; children can carry their own identity, time boundaries, sport reference, summary, and nested evidence | Exercises are ordered session children with local start/stop and optional measurements | Persist real child aggregates; never flatten a multisport session or substitute a child for its session. |
| Source laps and automatic laps | Both collections can contain one or many records with split time, duration, distance, and typed statistics | Split time is elapsed from exercise start; distance and statistics are optional | Preserve source and automatic lap kinds separately and never present either as user-authored structure. |
| Interval samples | Typed series have their own interval and a value sequence; series and types are optional | The public enumeration includes altitude, speed, distance, temperature, heart rate, cadence, stride length, movement, power-related, and other families | Map only independently specified numeric families; retain gaps and reject unsupported value encodings rather than guessing. |
| Routes | Exercise route and optional transition route have a local start and elapsed waypoints with coordinates and optional altitude | Transition routes apply to multisport sessions | Store geometry separately under a location-sensitive contract and preserve transition identity. |
| Pause times and zones | Optional collections occur with local boundaries or typed limits and accumulated time/distance | The public contract distinguishes heart-rate, power, speed, and other zones | Use source zones as evidence, not as the only segmentation model. |
| Pool evidence | Lap swimming statistics occur; the inspected package does not establish swimming-phase coverage | The public contract also defines optional swimming phases | Support only observed-and-specified lap statistics initially; absence of phases remains explicit. |
| Strength evidence | A strength-result object occurs without enough observed structure to validate useful child semantics | The public API defines structured completed sets and rounds | Defer detailed strength sets until independent takeout evidence establishes a safe mapping. |

### Select one evidence-complete session workspace

E4 should deliver a common session workspace with two demonstrable verticals rather than a generic
bag of provider fields:

1. An outdoor session with exercise boundaries, pauses, source and automatic laps, supported aligned
   numeric series, exact samples, and private route geometry.
2. An indoor or non-routed session with source structure when available, aligned supported series,
   exact samples, and user-defined segmentation that remains useful without a map.

The initial typed sample set should be selected from heart rate, speed or pace, distance, altitude,
cadence, and power only when the provider mapping establishes the exact enumeration, unit, interval,
missing-value encoding, valid range, exercise-relative origin, and reconciliation behavior. RR
samples, temperature, crank diagnostics, accelerometry, unknown sample types, full strength-set
structure, unobserved swimming phases, route similarity, and cartographic search remain outside the
first slice.

The application should introduce a versioned `SegmentCriterion` concept rather than a provider lap
alias or unrestricted expression language. Initial variants are equal elapsed time, equal distance,
heart-rate zone, and manual boundaries; each declares required measurements, units, applicability,
and evaluation version. Source laps, FitFreed-derived segments, and user criteria remain distinct,
attributed, reversible layers. Later pace, power, altitude, and route-section variants extend the
same discriminated contract only after their measurement prerequisites are implemented.

Exact reimport under a newer mapping version must reassess the original archive and enrich the
existing session without duplicating the session, exercises, series, laps, or routes. Large series
are staged and streamed, queried through bounded windows and downsampled views, and always retain a
paginated exact alternative.

### Why this slice is preferred

| Candidate | Distinctive value | Source confidence | Privacy and performance risk | Decision |
|---|---:|---:|---:|---|
| Rich summary with no samples or routes | Medium | High | Low | Insufficient: it improves presentation but does not answer what happened inside a session. |
| Outdoor-only route viewer | High for one sport class | Medium | High | Insufficient alone: it excludes indoor histories and does not solve workout structure. |
| Common evidence workspace plus one routed and one non-routed vertical | Very high | Medium | High but bounded | Select: it proves exact evidence, missing structure, privacy, and user criteria without pretending every sport is already decoded. |
| Complete provider training schema | Very high | Low | Very high | Defer: several families lack observed takeout semantics and would turn provider objects into the domain. |

## Sport-classification recommendation

The takeout preserves an opaque source sport reference but does not contain the provider catalogue
needed to resolve it. Polar's public sports-list endpoint is authenticated, mutable provider state;
it is not an offline takeout contract. The current `sport-profiles` artifact uses a different key and
cannot provide a safe join.

The MVP should therefore introduce a provider-neutral, user-authored classification keyed by local
origin and exact source sport reference. It contains an optional canonical sport family, a user
display label, authorship, revision, and explicit unknown state. The classification never overwrites
source evidence and is portable with the library. A classification workspace groups unresolved
references and shows their local sessions and available measurements so the person can label them
without exposing provider identifiers as names.

Later provider catalogues or connected APIs may offer a verified suggestion with catalogue version
and provenance. They must not silently replace a user choice. Multi-exercise sessions retain child
classifications and may present a provider-neutral multisport aggregate when no single classification
describes the whole session.

This path is preferable to a bundled value table with unknown origin, private-value inference, or an
MVP OAuth dependency.

## Library and export assessment

Versions and maintenance observations were verified on 2026-08-18. A compatible licence is
necessary but not sufficient; every dependency must also earn its bundle, accessibility, offline,
security, and contributor cost.

| Candidate | Evidence | Assessment | MVP decision |
|---|---|---|---|
| Native React and semantic HTML/CSS | Already selected by [ADR 0013](../architecture/decisions/0013-render-mvp-visualizations-with-semantic-html.md) for bounded views | Small, inspectable, accessible, and deterministic for report layout, tables, and current charts | Use for report composition and simple visuals. |
| [TanStack Table](https://tanstack.com/table/latest) | MIT, React 19 adapter, headless sorting/filtering/pagination and controlled state | Strong fit when exact sample tables require substantial table state; it supplies behavior, not accessible markup | Defer until a measured table interaction or scale need exceeds the existing semantic table. |
| [Vega-Lite](https://vega.github.io/vega-lite/) | BSD-3-Clause; declarative grammar; SVG output supports generated ARIA descriptions | Credible for dense, aligned session plots but adds Vega runtime and still requires an exact alternative and product-specific interaction model | Run a focused E4 spike only if semantic HTML/SVG misses density or interaction budgets. Do not add for reports alone. |
| [Leaflet](https://github.com/Leaflet/Leaflet) | BSD-2-Clause; keyboard and accessibility improvements; tile imagery is a separate dependency | Mature 2D map interaction, but a tile source introduces separate licence, offline, packaging, and location-request decisions | Defer. The first private route uses local SVG geometry on a neutral reference surface. |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | BSD-3-Clause, actively released, WebGL2 vector-map renderer | Strong later candidate for large route atlases and offline vector tiles; materially larger and more complex than the first route need | Defer until cartographic context or atlas scale is accepted and benchmarked. |
| [Paged.js](https://github.com/pagedjs/pagedjs) | MIT browser paged-media polyfill | Useful for print layouts, but it does not improve the first self-contained HTML contract and adds a second layout engine | Defer until a normative paginated output is accepted. |
| [Vivliostyle](https://github.com/vivliostyle/vivliostyle.js) | Rich HTML/CSS typesetting under AGPL-3.0 | Capable but would introduce a stronger combined-program licence boundary and a large publishing subsystem | Do not embed in the GPL-3.0-or-later MVP. Reassess only with an explicit licensing and process-boundary decision. |
| [printpdf](https://github.com/fschutt/printpdf) | MIT Rust PDF library; its own documentation describes HTML rendering as evolving | Avoids a browser executable but does not yet establish tagged accessible PDF, CSS parity, or deterministic FitFreed layout | Defer; direct PDF is not the first export contract. |

No drag-and-drop dependency is required. Move-up and move-down controls are primary, complete,
keyboard-operable behavior; pointer reordering may be added later as an enhancement over the same
ordered definition.

## Navigation validation

The prototype supports the accepted separation between a canonical destination and a transient,
opaque local origin. It demonstrates explicit labels such as “Back to filtered sessions,” restores
filter, view, position, and focus, uses the same service for visible and keyboard history actions,
and falls back to the canonical session collection after direct entry.

Production implementation still needs typed destination identities, bounded workspace snapshots,
stale-origin fallback after data changes, nested-disclosure precedence, and persistence policy. The
prototype validates the interaction model; it is not evidence that browser history or component
state can own that contract.

## Public communication boundary

`product-thesis.md` remains the narrative source of truth, `requirements.md` owns the public promise,
`roadmap.md` owns delivery sequence, and `product-status.json` owns the available, active, and later
public snapshot. Two audience-specific entrances derive from those sources:

- The root README must explain the problem, concrete value, current truth, privacy model, visual
  direction, how to evaluate or contribute, and the next meaningful milestones before exposing the
  documentation catalogue.
- A visual product page must lead with ownership and recognizable user questions, demonstrate the
  training-first experience with synthetic concepts, explain local processing and open formats,
  distinguish available capability from active work and future direction, invite contribution, and
  avoid a download call to action while no supported release exists.

Neither surface becomes a second roadmap, compatibility ledger, or legal specification. Their
status blocks are generated from the shared snapshot, and they link to the other canonical sources
for detail.

## Acceptance decisions requested

1. Accept the ordered evidence report and self-contained HTML as the report MVP boundary.
2. Accept the common deep-session workspace with one routed and one non-routed vertical, the initial
   typed sample set, and the initial `SegmentCriterion` variants.
3. Accept user-authored provider-neutral sport classification as the offline MVP path.

If accepted, `requirements.md` and `roadmap.md` become authoritative for these boundaries; E3, E4,
and E5 production contracts then proceed through the lower layers before their UI.
