# FitFreed Product Requirements

## Document status

Living product-requirements source. Confirmed requirements are normative; genuinely unresolved decisions remain
explicitly listed under [Open decisions](#open-decisions) and do not enter scope by implication.

## Vision

Build a cross-platform desktop application that imports personal activity, training, sleep, recovery, and related data exported from vendor platforms and transforms it into a particularly clear and engaging experience for exploration, reporting, and visual analysis.

The product is vendor-neutral and multi-source by design. Polar Flow will be the only data source supported by the MVP; later importers may support Garmin and other platforms without turning any provider into the product's identity.

The application is named **FitFreed** and will be an open-source project published on GitHub under the `fitfreed` repository slug. [ADR 0001](architecture/decisions/0001-select-tauri-application-stack.md) selects Tauri 2, a Rust core, and a TypeScript and React presentation layer.

The architecture will follow Clean Architecture and Domain-Driven Design (DDD).

## Product objective

Enable people who hold data in vendor platforms to understand and benefit from their own history without depending on the exploration and reporting capabilities selected by those platforms. Data portability is only meaningful when people also have practical software that can use, present, and analyze the exported data.

FitFreed has one product utility: enable a person to consult their imported history and derive understandable, trustworthy information from it. Import, storage, coverage accounting, format compatibility, and update delivery are enabling capabilities, not user value in isolation. An experience that stops at ingestion status, raw records, or generic summary cards does not meet the product objective.

Allow later exports and additional supported sources to be incorporated without duplicating or losing previously imported information.

The product must provide an exceptional user experience and an exceptional developer experience. Open-source sustainability is a product objective: the project must actively reduce the cost of understanding, using, contributing to, reviewing, and maintaining it.

## Product thesis

Legal access to personal data and practical freedom to use it are different capabilities. Where the GDPR right to data portability applies, it provides a legal path for a person to receive qualifying personal data in a structured, commonly used, machine-readable format and to transmit it elsewhere. Open-source software can turn that legal possibility into durable practical agency by making exported data understandable, useful, inspectable, extensible, and independent of a vendor's product decisions.

The project's central argument is:

> **GDPR-enabled portability + open-source software = meaningful user freedom.**

This thesis will guide product naming, public messaging, onboarding, documentation, architecture, local storage, interoperability, and roadmap priorities. The product must not replace a vendor silo with another opaque or inescapable silo.

The project will remain legally precise: it will not claim that the GDPR requires a particular ZIP archive, that every field in a vendor export necessarily falls under the right to portability, or that this application is a legal-compliance service. The canonical interpretation and messaging rules are maintained in [`product-thesis.md`](product-thesis.md).

## Confirmed scope

### Import

- The MVP input will be the ZIP archive provided by a Polar Flow personal data export.
- The application will process the ZIP archive directly; users will not need to extract it first.
- The same ZIP archive can be imported again without duplicating information or degrading the existing state.
- Later ZIP archives containing additional information can be imported.
- Successive imports will integrate new information with existing information.

### Data use

- Explore imported data.
- Produce reports derived from imported data.
- Visualize the information through an interface with a strong emphasis on visual communication.

### Distribution

- The product will be a cross-platform desktop application.
- The project will be published as open-source software on GitHub.
- The canonical repository is `purnalica/fitfreed` at `https://github.com/purnalica/fitfreed`.
- The repository is owned by the `purnalica` GitHub organization from its creation; the superseded plan to begin under a personal account was never adopted.
- Supported platforms will receive straightforward native installation packages and an in-application update path.
- The MVP will support macOS only.
- Linux will be the next supported desktop platform, followed by Windows.
- The macOS MVP will be a private evaluation alpha without Apple code signing or notarization.
- No unsigned macOS binary will be promoted to a public release channel.
- The first publicly distributed macOS release will use Developer ID signing and Apple notarization.
- The project is licensed under `GPL-3.0-or-later`.

### Vendor neutrality

- The product name, visual identity, domain model, primary navigation, and general product copy will not reference or imply affiliation with Polar, Garmin, or any other data provider.
- Provider names will appear only where needed to identify an importer, explain compatibility, attribute a data source, or give factual import guidance.
- Supporting a new provider will require a new importer and compatibility mapping, not a provider-specific fork of the product or a redesign of existing provider-neutral use cases.

### Language

- English is the canonical source and project language.
- Source code, identifiers, comments, technical documentation, tests, logs, configuration examples, contribution materials, and release artifacts will use English.
- Localized user-interface resources are the explicit exception to the English-only artifact rule.
- The initial product will support English for the United States (`en-US`) and Spanish for Spain (`es-ES`).
- The internationalization design will make additional languages straightforward to add and suitable for collaborative translation workflows.

## Initial functional requirements

### FR-001 — Import a Polar Flow export

The application will allow the user to select a Polar Flow takeout ZIP archive, validate that its structure is recognizable, and process the compatible data it contains.

### FR-002 — Idempotent reimport

Reimporting the same content will produce the same logical state: it will not create duplicates or improperly alter information that has already been incorporated.

### FR-003 — Cumulative import

Importing a later export will incorporate new information and reconcile previously known information according to deterministic rules.

### FR-004 — Exploration

The application will provide understandable navigation and querying of imported information. Specific entities, filters, searches, and relationships will be defined after the real takeout format has been inventoried.

Calendar exploration will present each training session as an activity rather than reduce a day to an unexplained
count. Each visible activity will include its recognizable sport identity and duration, and multiple sessions on one
day will follow their local start order. Navigation will provide direct access to every year represented in the
current library and one action that returns to the current month.

### FR-005 — Reports

The application will let users compose, save, revisit, refresh, and export their own reports. A report may begin from a question, exploration, session, or reusable blank definition and combine periods, sports, sessions, measurements, comparisons, user-defined segmentation, narrative, exact values, tables, charts, maps, provenance, coverage, and limitations.

Saved reports will retain a documented, versioned, reproducible definition rather than only copied presentation values. The authoring experience will preview output, expose sensitive content, distinguish source facts, FitFreed calculations, user-authored text, and unavailable conclusions, and make refresh after new imports or calculation changes deliberate.

The ordinary report journey is result-first. Opening a saved report, or starting one from a question, exploration, or session, will show a useful rendered result before exposing composition mechanics. Editing is a deliberate secondary mode, and returning from it restores the report result without placing that result below the editor or a long report list. Blank composition and advanced block controls remain available without becoming the default path for people who only need to review, refresh, or export a result.

A report definition will distinguish its durable structure, its saved default parameters, and the effective
parameters of one viewing run. Supported run parameters—at least report date periods and any other frequently changed
filter admitted by the report subject—will remain directly adjustable beside the rendered result. Changing them will
rerun the report without silently rewriting its saved definition; editing the definition remains the deliberate way
to change durable structure or defaults. Period controls will offer meaningful paired presets such as current and
preceding week, month, quarter, or year while preserving manual selection. Export will identify the effective run
parameters and will not imply that transient values were saved as report defaults.

Reports will include a curated set of relevant built-in examples that demonstrate meaningful product capabilities over
the evidence actually available in the person's local library. An example with unmet prerequisites will explain them
rather than fabricate a result. A person can use an example as the basis of a new independently owned report without
mutating the built-in definition.

When an example or contextual start requires a session, comparison, route, or another bounded subject, the report
journey will present eligible candidates in context and require an explicit selection. It will not abandon the report
task in an unfiltered general workspace or require the person to infer a hidden continuation action.

A saved report can be duplicated deliberately. Duplication creates a new local report identity and an independently
editable definition while retaining the source report unchanged. Exact naming, evidence-snapshot, stale-state, origin,
and revision semantics will be fixed by the post-review implementation plan before the control is exposed.

Cancelling a saved composition restores its exact reviewed definition and result without writing the draft.
Cancelling a new contextual composition returns to its exact source and creates nothing; cancelling a start
owned by the report Library returns to that Library and creates nothing. Merely moving between Library,
Compose, and Preview preserves the mounted draft and is not cancellation.

The first report will be an ordered evidence document with finding, comparison, session, chart, exact-table,
coverage-and-limitation, and optional commentary blocks, plus a route block when route evidence is available.
Its normative export will be deterministic self-contained HTML with embedded styles and graphics, semantic
headings and tables, no scripts or external requests, declared locale and units, and explicit provenance,
coverage, limitations, authorship when present, definition version, and source revision. Native PDF, formulas,
arbitrary queries, free-form layout, community template exchange, scheduled generation, and plug-in blocks are outside
the MVP. Curated built-in examples and creating an independent report from one are inside the confirmed report scope.

### FR-006 — Visualization

The application will use visual explanation as a primary way to interpret evolution, distribution, relationships, structure, and patterns in the data. Visuals will answer a recognizable question or explain a record before asking the person to interpret isolated plots or dense numeric summaries. Related time, route, structure, and measurement evidence will be aligned where that relationship is supported; source gaps and uncertainty will remain visible without becoming ambient warning noise. Exact values and accessible non-visual alternatives remain available through progressive disclosure.

### FR-007 — Import history management

The application will retain the information needed to explain which files were processed, when they were processed, and what the outcome was. This history will not replace duplicate detection based on content or logical identity.

## Confirmed design principles

- Import must be safe to repeat.
- Historical data must evolve cumulatively.
- The visual experience is a core product capability, not a later enhancement.
- Production charting will prefer a maintained specialized OSS library after explicit evaluation of GPL compatibility,
  accessibility, offline operation, deterministic rendering, macOS WebView behavior, performance, large-series
  handling, localization, replaceability, and maintenance health. Custom code will focus on FitFreed-specific
  composition, evidence semantics, and interaction rather than recreating a general charting engine without a proven
  product need.
- Charts will provide the axes, units, scales, legends, selection, missing-data treatment, exact alternatives, and
  visual hierarchy needed to interpret their question. A person may compare or overlay several exercise signals to
  inspect co-variation when the importer establishes an exact shared coordinate. Signals without that authority remain
  independently explorable and are never visually aligned in a way that implies a recorded relationship.
- User experience and developer experience are first-class quality attributes, not polish deferred until after feature implementation.
- The project will optimize for sustainable external contribution rather than assuming a permanent closed group of maintainers.
- Product construction will be gradual and will expose working increments early enough to evaluate behavior, usability, architecture, and priorities before the full product is built.
- The implementation roadmap and planning model will be explicit before implementation begins, while preserving the shortest responsible path to a usable MVP.
- Unit, integration, and end-to-end testing will form the primary evidence for product quality throughout development.
- Installation and update reliability are adoption-critical: a release that fails either path can immediately and permanently lose users.
- Repeatable development, verification, documentation, translation, packaging, release, and maintenance processes will be automated wherever reliable automation is possible.
- Single source of truth is mandatory across product, architecture, code, interface, documentation, planning, and automation; canonical ownership and derived-consumer rules follow [`documentation-policy.md`](documentation-policy.md).
- Once implementation starts, execution will proceed autonomously through the agreed roadmap and will pause only when human authority, credentials, product decisions, or an external-state change are genuinely required.
- Technology choices will be driven by product requirements and are not predetermined.
- Analysis of the real format will precede data-model design and implementation.
- The architecture will follow Clean Architecture and DDD.

## Product experience contract

The following decisions define FitFreed across features and releases. They are functional and design requirements, not a commitment to the current prototype's particular layout. A future interface may replace every screen while preserving this contract. Capabilities still enter delivery through the milestone boundaries in [`roadmap.md`](roadmap.md); this contract does not move post-MVP work onto the MVP critical path.

### The person's history is the product

- FitFreed will open toward what a person can understand, revisit, compare, or create from their history rather than toward ingestion status, generic metrics, or provider structure.
- The sports history is the central product object. Sports, session collections, individual sessions, routes, chronology, and exact evidence are connected scales of the same history rather than unrelated feature silos.
- Activity, sleep, recovery, and other health-adjacent records provide relevant context without displacing training as the primary exploration hierarchy or implying medical interpretation.

### Questions lead; metrics support

- Primary journeys will begin from recognisable user questions, records, or prior explorations. They will not require knowledge of source filenames, schemas, database concepts, or provider terminology.
- Answers will lead to their supporting dates, sessions, samples, calculations, provenance, coverage, and limitations. Summary cards and charts are views over evidence, not substitutes for it.
- Every visible summary of a bounded collection, count, period, sport, session group, report result, or evidence set will
  provide the natural route to the represented records or exact supporting data. A person who reads that sessions or
  records exist can inspect them without reconstructing filters elsewhere. Non-interactive context must neither look
  actionable nor imply a drill-down that does not exist.
- Default views will present the smallest set of evidence needed to understand an answer. Dense tables, raw precision, and exhaustive metadata belong to deliberate detail views rather than the first reading path.
- Every production workspace will undergo a global information-density and progressive-disclosure review. Its primary
  state must make the current object, conclusion, visual explanation, and next useful action understandable without
  first traversing exhaustive rows or diagnostic evidence. Detailed tables, complete segment lists, source fields,
  repeated attribution, and exact values remain reachable on demand and accessible, but do not become the ordinary
  screen merely because the data exists.
- Exploration will provide structured selectors for known dimensions such as sport, date range, measurement availability, and other bounded domain values whenever the data supports them. Free-text search remains available for session names and imprecise recall, but it will not force a person to type values the application already knows or make valid filter choices undiscoverable.
- Comparison entry points will propose distinct, meaningful relative periods derived from the current context, such as
  this week and the preceding week, this month and the preceding month, or this year and the preceding year. They will
  not default both sides to the same range. Manual selection of both inclusive ranges remains available at all times.
- Dates, times, durations, quantities, units, and numeric precision will be localized and chosen for the scale and decision being communicated. Exact stored precision remains available when it is meaningful; it will not dominate summaries where it creates false significance or visual noise.
- Tables will align numeric, temporal, and comparable values by their reading structure so rows can be scanned and
  compared without reconstructing columns mentally. Provenance or attribution shared by an entire result belongs in
  that result's definition or explanation; it will not consume a repeated per-row column unless attribution genuinely
  differs between rows.
- Because FitFreed's primary value is making owned data understandable, alignment, spacing, precision, hierarchy, and
  comparable-value presentation are product correctness concerns rather than cosmetic finishing work. A data surface
  is not accepted merely because every value is technically present.
- Text scaling and responsive layout will react to the space actually available to each component, not only to the outer window width. Labels, values, controls, legends, and alternatives will reflow or change composition before words, units, or numeric meaning are squeezed into unreadable fragments.
- Every recognized sport will have a coherent provider-neutral visual identifier used consistently on Home, History, session, comparison, and report surfaces. A sport icon always appears with a textual name or accessible name; arbitrary characters, provider logos, color-only coding, and generic placeholders are not an acceptable final icon system.
- When an outdoor session contains supported GPS geometry, its primary session story will show the recorded track in geographically proportioned local context—with direction, scale, bounds, gaps, and selected position—rather than as an abstract decorative line. The MVP does not add streets, terrain, or place names. The map will remain local-first, expose distance and exact route evidence through an accessible alternative, distinguish missing or partial geometry, and apply explicit location-privacy behavior where information leaves the application.
- A route map will support deliberate pan and zoom and will share one exploration position only with session evidence for which the importer supplies an exact recorded relationship. Selecting or traversing a recorded track point will identify the same elapsed instant in every related signal—such as pace or speed, heart rate, power, cadence, altitude, and temperature—and traversing such a signal will identify its mapped route position. Regular signals without that authority remain independently explorable on their own recorded clocks. FitFreed will not correlate streams merely because timestamps, offsets, or sample counts appear compatible; it will not fabricate values across missing samples or imply that an unavailable signal was recorded. Keyboard and structured exact-evidence alternatives will provide the same supported selection and values without requiring pointer or map interaction.
- Tracking exploration is a primary adoption journey, not a secondary session decoration. Running, paddling, cycling, hiking, and other route-bearing sports will retain their own meaningful units and recorded signals while sharing the same map-led investigation grammar. In a route-bearing session, the map will be the dominant exploration surface rather than a thumbnail, a narrow card, or a peer of generic summary graphics. It will receive the largest useful share of the ordinary session workspace and remain large enough to read route shape, geography, direction, selected position, and section relationships while exactly related evidence stays directly reachable and independent signals remain a deliberate nearby destination. The composition will adapt by reorganizing supporting evidence and controls before sacrificing that map workspace; detailed route investigation will not require switching to an unrelated diagnostics surface.
- For a person whose sports are primarily outdoors, map investigation is expected to carry most of the session experience. Product design, implementation sequencing, usability evidence, and regression coverage will treat the map workbench and its route interactions as approximately three quarters of the perceived value of an outdoor-session detail, not as one interchangeable visualization among many.
- A contiguous range within a routed session will be a first-class exploration object, not merely a temporary chart zoom. FitFreed will show attributed ranges supplied by the source when they can be mapped safely, including their original names and boundaries. A person will also be able to select a range from the map, signal evidence, structure, or exact evidence; adjust both boundaries; give it a name; save, reopen, rename, and remove it; and inspect its route, direction, elapsed or moving time, distance, sport-specific measurements, coverage, and missing samples. Selection propagates only across representations whose shared coordinate is explicitly established; independent evidence remains independent. Source ranges and user-authored ranges remain visibly distinct and may coexist without either rewriting imported evidence.
- A named session range is distinct from a reusable segmentation criterion. A range identifies one contiguous part of one recorded session and preserves its exact boundary references and authorship. A criterion is a reusable rule that can derive several sections from compatible evidence. The domain model will own their identities and invariants; application commands and queries will resolve their summaries and failure semantics through explicit persistence ports. Presentation code will not infer range metrics or store them only as component state.
- FitFreed will expose only questions it can actually answer. It will not imitate unrestricted natural-language or artificial-intelligence understanding when the available application contracts support only a defined catalogue.

### Navigation preserves exploration context

- Opening a sport, session, date, route, comparison, evidence table, or report will retain the origin of that exploration. The primary return action will name and restore the exact originating view rather than always returning to a fixed collection.
- Returning will preserve the meaningful state of the origin, including period, search, filters, sort, view mode, selected records, comparison basket, expanded evidence, and scroll position where applicable.
- Every detail also has a provider-neutral canonical location and hierarchy so a direct link, restored window, notification, report, or MCP handoff remains understandable when no in-application origin exists.
- Breadcrumbs, contextual return actions, sidebar navigation, keyboard history commands, and operating-system back behavior will express one coherent navigation model. A person will not need to reconstruct prior exploration manually or become trapped in a detail surface.
- When an action reveals detail outside the current viewport—especially beneath a table, list, or long summary—the interface will make the destination perceptible. It will either reveal the detail in an already visible associated region or move the viewport with restrained, reduced-motion-aware scrolling and place keyboard focus on the revealed region or its heading. Content will never appear silently below the fold and leave the person to discover where it went.
- Sensitive state will not be encoded into public or externally transferable links. Restorable navigation state remains local and references opaque application identities.

### Knowledge has visible authorship

- The interface and exported outputs will distinguish immutable source facts, provider assessments, deterministic FitFreed calculations, observed co-occurrence, user-authored text or criteria, and unavailable conclusions.
- Provider-supplied structure, FitFreed-derived views, and user-defined session segmentation will remain visibly attributed, reversible, and independently inspectable.
- Reimport, synchronization, recalculation, or report refresh will not silently rewrite a person's authored interpretation or present a later calculation as an original source fact.

### Uncertainty remains part of the answer

- Missing measurements, partial coverage, unsupported source content, incompatible criteria, and comparison limitations will be presented where they affect an answer rather than hidden in a remote diagnostic screen or collapsed into one overall score.
- Import coverage is explained explicitly in the import result and source history. Ordinary exploration will surface a coverage limitation only when it changes the current answer, comparison, action, or interpretation; it will not repeatedly advertise a general importer limitation across unrelated screens.
- Absence will not be treated as zero, correlation will not be presented as causation, and provider or FitFreed scores will not become unexplained judgments about readiness, health, effort, or personal worth.
- Visual emphasis will never remove access to exact values, units, provenance, or an accessible non-visual alternative.

### Ownership is an end-to-end journey

- FitFreed will help a person obtain an initial provider export, establish a historical local library, incorporate later archives safely, and—when supported—keep it current through explicitly authorized provider APIs.
- The person will be able to reinterpret the library through reusable criteria, create reproducible reports, export documented representations, and grant revocable, scoped local MCP access to supported questions.
- No stage will replace one provider lock-in with a FitFreed-only dead end. Normalized data, report definitions, personal criteria, provenance, and compatibility semantics will be documented and portable when their capability enters scope.
- Data exit is a flagship ownership outcome rather than a maintenance escape hatch. Export journeys will make the available scope, format, provenance, privacy implications, and known information loss understandable, and FitFreed-owned outputs will use open documented representations suitable for independent reuse.

### Local-first trust is shown through control

- Local processing, offline continuity, absence of a required FitFreed account, and explicit control over destructive or sensitive operations will be communicated at the moment they matter rather than only in legal documentation.
- Location, physiological, credential, agent-access, and bulk-export capabilities will use specific permission and privacy decisions; a broad preference or connection will not imply unrestricted authority.
- Provider account screens, API availability, delivery timing, and export contents remain provider-controlled. FitFreed will state that boundary and never imply affiliation or authority it does not have.

### Extensibility remains understandable

- Provider-neutral navigation and use cases remain stable as providers, sports, measurements, report blocks, settings, and agent capabilities are added.
- General ownership, privacy, and storage language will use platform-neutral device terminology. A platform name will appear only when instructions or behavior genuinely differ for that operating system.
- Persistent preferences, source-library operations, exploration controls, report authoring, and external connections have distinct conceptual homes. New controls will join the home that owns their outcome instead of accumulating in a miscellaneous panel.
- Sport-specific meaning will be preserved through extensions to a common session identity; new sports will not be flattened into a lowest-common-denominator collection of generic metrics.

### Respect is expressed through restraint

- Application language will be calm, specific, and proportionate to the evidence and consequence. It will not use promotional superlatives, theatrical reveals, routine-operation celebration, or claims of intelligence, freedom, insight, or success that the current result does not demonstrate.
- FitFreed will inform rather than persuade. It will not conceal a material limitation, manufacture urgency, or steer a person toward an action for the product's benefit. Capability, evidence, uncertainty, unsupported information, and consequence will remain accessible in the context where each matters.
- Transparency does not mean repeating every limitation on every surface. Progressive disclosure will keep the complete account reachable while the default view remains concise enough to understand and use.
- The public product entrance—including the product site—and the working application have different communication jobs. The public entrance may explain FitFreed's proposition, present current capability, and label future direction honestly, but it will inform rather than advertise; first run may establish relevance briefly; ordinary workspaces will prioritize the current object, result, state, and action rather than repeat campaign slogans or product-selling introductions.
- A calculated statement will identify its period, comparison, evidence, and limitation in plain language. A successful import will state what changed; a failure will state consequence and recovery. Neither becomes an opportunity for vague reassurance or alarmist technical language.
- Warmth will come from clarity, humane terminology, visual care, and non-judgmental behavior rather than hype, gamification, anthropomorphic language, or exaggerated typography. Serious does not mean cold, and engaging does not mean promotional.
- Interface text must earn the attention and space it consumes. Repeated hero headings, explanatory preambles, and trust claims will be removed once context or prior action already establishes them.

### Every visit should offer a useful next step

- First run will establish the value of owned history before asking for an archive and will help a person who has not yet requested one.
- A successful import will show the usable period, meaningful coverage, and a conservative first question or comparison instead of celebrating file counts alone.
- Returning workspaces will lead with the person's recognizable result or history. Search, filters, editors, diagnostics, and exhaustive evidence refine that result instead of displacing it from the initial viewport.

### The public promise is concrete and honest

- The repository README and product page will lead with the problem FitFreed solves, the outcomes a person can obtain, the ownership model, the product's current state, and a useful path for contributors. They will not lead with framework or ingestion internals.
- Available behavior, active product work, and deliberately later capabilities will remain visibly distinct. No planned capability will be described as released, and no supported-download action will appear before the applicable release-readiness gate passes.
- The README is the concise repository gateway; the product page is the visual narrative. Both derive claims from and link to the canonical product thesis, requirements, roadmap, and readiness evidence instead of becoming competing specifications.
- `https://fitfreed.org/` will be the canonical public product entrance under [ADR 0023](architecture/decisions/0023-use-fitfreed-org-as-the-public-origin.md). It will turn interest into an honest next action through product evaluation, documentation, support, security, contribution, or a readiness-gated download.
- The public product entrance will provide complete `en-US` and `es-ES` experiences from one canonical English source and separate translation resources. On a first visit it will select `es-ES` when the browser preferences contain supported Spanish and will otherwise use `en-US`; an absent, unreadable, or unsupported preference must never displace the English fallback.
- A visible language control will let a visitor override automatic selection at any time. The selected public-site locale will persist locally without an account, remain reversible, and never affect the language-neutral `/updates/` protocol surface.
- Supported download actions will resolve to the immutable GitHub Release and its evidence. The product site will not duplicate release ownership or present an unsigned or unaccepted package as supported.
- Returning visits will surface supported paths through the evolving history without relying on coercive streaks, rankings, mystery scores, or notification pressure.

## Confirmed architectural constraints

### Clean Architecture

- The domain will be independent of the user interface, persistence, operating system, development frameworks, and Polar Flow export format.
- Code dependencies will point toward the domain: presentation and infrastructure will depend on use cases and the domain, never the reverse.
- Use cases will coordinate application operations through explicit ports.
- ZIP and JSON processing, persistence, file generation, and integrations will be implemented as replaceable adapters.

### Domain-Driven Design

- The model will express the product language—activity, training, sleep, recovery, imports, and reports—instead of directly mirroring the JSON structure.
- Identity, reconciliation, and idempotency rules will be explicit invariants of the import domain.
- Bounded contexts will be defined during domain design according to capabilities and life cycles, not according to takeout folders.
- The Polar Flow format will be treated as an external model and translated into the internal model through an anti-corruption layer.
- Aggregates, entities, value objects, and domain services will be used when they protect real business invariants; DDD will not justify abstractions without a domain responsibility.

### Architectural verification

- Domain tests will not require a graphical interface, database, ZIP files, or external services.
- Use-case tests will use controllable ports and verify coordination without depending on concrete adapters.
- Integration tests will separately verify import, persistence, and presentation adapters.
- Code structure and automated checks will prevent dependencies from the domain toward outer layers.

## Private reference data

A private local Polar Flow export has been explicitly supplied outside the repository for format analysis. Its exact path, archive identifier, and personal contents are local-only and must not be recorded in versioned artifacts.

The source archive, extracted files, copied fragments, derived databases, screenshots, logs, reports, and benchmark outputs must not be added to the repository or published artifacts. Versioned test samples must be independently constructed, synthetic, and minimal under `repository-content-policy.md`.

## Verified inventory of the reference format

Private analysis confirms that realistic exports can contain thousands of files, multiple gigabytes, and high-resolution time series. Exact private archive counts and sizes are deliberately not versioned. Import cannot be designed under the assumption that all content can be loaded into memory at once.

The following information families have been identified:

| Area | Available information |
|---|---|
| Account | Account data, profile, and preferences |
| Devices | Active and archived devices, registrations, and settings |
| Daily activity | Steps, distance, calories, MET values, activity levels, summarized sleep, and inactivity alerts |
| Heart rate | Continuous heart rate and PPI samples |
| Training | Sessions, exercises, sports, duration, distance, calories, load, routes, pauses, laps, zones, and sample series |
| Planning | Targets, favorites, calendar entries, programs, and personal events |
| Sleep | Timing, phases, interruptions, continuity, efficiency, scores, and ratings |
| Recovery | Heart-rate variability, breathing, recommendations, and perceived recovery |
| Tests | Orthostatic and fitness tests |
| Physical evolution | Weight, VO2 max, thresholds, heart rate, and other historical physical information |
| Sport configuration | Sport profiles and zone, unit, and reminder settings |

The format is not homogeneous: it combines JSON objects and collections, singleton files, daily files, monthly files, and per-session files. It also contains historical variants of equivalent structures and high-resolution time series. Some records contain particularly sensitive data, including routes and coordinates, physiological data, birth dates, and device and account identifiers.

## Requirements derived from the verified format

### FR-008 — Explicit format coverage

Every archive artifact will be classified as supported, unsupported, deliberately ignored, unrecognized, or invalid. The import result will report what became usable, what did not enter the library, the consequence for the person's history, and a family-level breakdown with a localized reason and next action. No file will be silently discarded and no source locator or personal value will be exposed by that view. This explicit result is the canonical user-facing account of source coverage; other workspaces refer to a limitation only when it materially affects their current answer or action.

### FR-009 — Evolutionary compatibility

Import will tolerate known historical format variants and maintain an explicit strategy for versions, fields, or types that are not yet recognized.

### FR-010 — Observable and recoverable import

The interface will show phased progress and the final import outcome. A partial failure will not leave an inconsistent state or require the user to rebuild the library manually.

### FR-011 — Provenance and reconciliation

Normalized data will retain the minimum provenance needed to diagnose an import and reconcile reimports. Fast detection of an identical ZIP archive may rely on its fingerprint, but integration of later exports will use each entity's logical identity rather than relying only on file names.

### FR-012 — Protection from malicious or defective input

The application will validate the ZIP archive, limit uncontrolled resource consumption, and reject paths, sizes, structures, or content that could compromise the computer or corrupt the library. A resource rejection will preserve a typed reason for entry count, expanded member size, total expanded size, compression ratio, or bounded read exhaustion so the interface can explain the actual limit and a safe recovery without exposing archive paths or personal values.

### FR-013 — Locale selection

The application will select a supported locale from the operating-system preference on first run, fall back to English when no match exists, and allow the user to change the locale explicitly without reimporting data.

### FR-014 — Initial localized experience

All user-facing features included in the first release will be available in English and Spanish for Spain. Missing or invalid translations will fall back predictably to the canonical English source.

### FR-015 — Update availability notifications

- The application will check for new stable releases periodically and on explicit user request.
- When an update is available, the application will show a localized, non-disruptive notification containing the installed version, available version, release notes, and a clear update action.
- Users may dismiss or postpone an update unless the installed version is known to be unsafe or incompatible with the local data format; the policy for exceptional mandatory action remains to be defined.
- Failure to contact the update service will not prevent normal offline use and will not produce repeated intrusive errors.

### FR-016 — Safe application update

- The application will provide a guided update path appropriate to each supported operating system.
- Update installation will verify the authenticity and integrity of downloaded artifacts before execution.
- Updating the application will preserve the user's imported library, settings, and locale.
- Data-schema migrations will be versioned, tested, recoverable, and completed before the updated application exposes partially migrated data.
- The application will report the result of an update and provide actionable recovery guidance if installation or migration fails.

### FR-017 — Multiple data-source importers

- The application will expose a provider-neutral import capability implemented by source-specific adapters.
- Each importer will detect or validate its own export format, interpret source versions, and translate external records into provider-neutral application inputs through an anti-corruption layer.
- The MVP will provide one Polar Flow importer through the same application boundary intended for later importers.
- A new importer will declare its supported artifacts, format versions, capabilities, limitations, and synthetic compatibility fixtures.

### FR-018 — Source provenance

- Imported information will preserve enough source provenance to explain where a fact originated, diagnose mappings, and reconcile later imports.
- Exploration and reports will normally use provider-neutral concepts while allowing users to inspect source attribution when it is relevant.
- Cross-source reconciliation will remain separate from source parsing so future imports cannot silently merge semantically different records.

### FR-019 — Open export-format reference

- For each supported provider export, the project will identify and link any adequate official format specification.
- When no adequate official specification exists, FitFreed will publish a clean-room, observation-based reference covering file families, naming patterns, structural shapes, fields, types, relationships, known semantics, historical variants, compatibility status, and unresolved questions needed to use the export independently.
- The reference will distinguish official guarantees from observed behavior and FitFreed interpretations, identify when evidence was last verified, and evolve alongside importer compatibility.
- Published examples and schemas will be independently constructed and synthetic. No real record, value, route, identifier, timestamp sequence, or private data-set fingerprint will be copied into the reference.
- This documentation is a product outcome of practical data liberation, not merely internal importer documentation.

### FR-020 — Open FitFreed data specifications

- Every data representation owned by FitFreed will be documented completely and versioned alongside its implementation. This includes the provider-neutral canonical model, the portable export format, and implementation-specific persisted schemas and migrations.
- The normative canonical and portable-format specifications will define entities, value objects, fields, types, units, optionality, cardinality, identities, relationships, invariants, provenance, time and time-zone rules, enumerations, compatibility behavior, and known information loss.
- Each source importer will document how supported external fields map into the canonical model, including transformations, derived values, ignored information, ambiguity, and loss.
- Machine-readable schemas will be provided wherever the representation permits them. Automated contract tests will verify schemas, synthetic examples, migrations, and importer mappings against the implementation.
- Documentation will distinguish the stable portable contract from replaceable persistence details. A storage engine or internal schema will not silently become the only way to recover a user's normalized data.
- No new or changed FitFreed data field, mapping, migration, or portable representation will be complete until its corresponding specification and compatibility status are updated.

### FR-021 — Persistent application settings

- The application will provide a dedicated and extensible settings space rather than scattering persistent preferences across unrelated screens.
- Initial preferences will include interface language, default content zoom from 100% through 200%, and system, light, or dark appearance.
- Product evolution will offer several curated visual themes that create a perceptible change while preserving the
  application's sober, elegant character. Theme selection remains distinct from system, light, or dark appearance;
  an arbitrary theme editor is not required. Curated themes follow the accepted first-MVP experience gate and must not
  weaken readability, accessibility, localization, or cross-platform coherence.
- Preferences will have safe defaults, explain their effect, survive restart, recover from invalid or obsolete values, and provide an explicit way to restore defaults.
- Settings will distinguish preferences from data-library operations and group future controls by user outcome, including accessibility, imports, data and privacy, updates, and application information.

### FR-022 — Provider export acquisition guidance

- The import journey will help a user who does not yet have an export obtain the supported archive through the provider's official process.
- Each importer will own versioned guidance containing a concise offline-capable procedure, the expected archive, provider-controlled delivery constraints, official links, troubleshooting information, and the date on which the instructions were last verified.
- Guidance will distinguish FitFreed from the provider and will not automate credential entry, account access, or archive download on the user's behalf.
- A provider website change will not make already available local instructions disappear, and unsupported or uncertain instructions will be identified rather than guessed.

### FR-023 — Local Model Context Protocol access

- FitFreed will be able to expose a local Model Context Protocol (MCP) server so user-authorized artificial-intelligence agents can query supported information from the person's library.
- MCP resources and tools will use provider-neutral application use cases rather than reading the database or provider artifacts directly.
- Access will be disabled by default, explicitly enabled by the user, limited by declared capabilities and privacy scopes, observable, revocable, and bound to the local device unless a later product decision defines a separately secured remote boundary.
- Responses will preserve provenance, coverage, units, missing-data semantics, and FitFreed's distinction between recorded facts, calculations, user-authored interpretation, and unavailable conclusions.
- Sensitive routes, physiological records, bulk extraction, and write-capable operations will require separately designed permissions; enabling general MCP access will not imply authority for all library contents or mutations.

### FR-024 — Incremental connected-provider synchronization

- After a historical export has established the library, FitFreed will be able to connect to supported provider APIs and ingest newly available records without requiring repeated full exports.
- Connected synchronization will be implemented through source-specific adapters behind the same provider-neutral ingestion and reconciliation boundaries as archive import.
- Each connector will declare authorization scopes, available history window, supported data families, polling or notification behavior, rate limits, freshness, known omissions, revocation, and deletion behavior.
- API records and archive records from the same provider will reconcile through explicit source identity and revision rules; connection order will not create duplicates, silently overwrite richer history, or invent equivalence.
- Credentials and refresh tokens will use operating-system protected storage, never enter logs or portable data exports, and remain revocable independently of the local library.
- Offline use and historical exploration will remain available when a provider is unreachable, access is revoked, or an API is discontinued.

### FR-025 — Evidence-complete session exploration

- The MVP will provide one common session workspace that proves an outdoor routed session and an indoor or non-routed session without assuming every source supplies laps, phases, routes, or samples.
- Ordinary session discovery will use locale-appropriate human-scale dates and quantities and will compose each session card only from evidence that is actually available. Exact timestamps, source separation, unrounded values, and provenance will remain reachable through deliberate evidence inspection rather than dominating the first scan.
- Source-separated histories will remain distinguishable without exposing opaque source references or unexplained ordinal badges. When more than one separated history contributes to the same calendar date, discovery will state that multiplicity in plain language.
- Supported source exercises, source and automatic laps, pauses, zones, routes, and numeric sample series will retain distinct identity, ordering, provenance, optionality, and mapping version beneath a provider-neutral session identity.
- The initial numeric sample families are heart rate, speed or pace, cumulative distance, altitude, cadence, and power only where their exact enumeration, unit, interval, origin, missing-value encoding, valid range, and reconciliation behavior are documented and verified.
- Visual queries will be bounded and may use attributed downsampling; exact values will remain available through a stable paginated alternative.
- The initial reusable `SegmentCriterion` variants are equal elapsed time, equal distance, heart-rate zone, and manual boundaries. Each will declare measurement prerequisites, units, applicability, attribution, and evaluation version; unavailable prerequisites will be explained rather than guessed.
- Source structure, FitFreed-derived segments, and user-authored criteria will remain visibly distinct, reversible, and independently inspectable.
- Precise route geometry will remain local. The first MVP route view will use local project-rendered geometry without
  an external tile request, and export will require sensitive-content review. Cartographic basemaps are deliberately
  deferred rather than rejected: post-MVP evolution will evaluate OSS renderers and openly licensed map data or
  services without weakening location privacy, attribution, offline use, or user control.
- Reimporting identical source bytes after a mapping upgrade will reassess and atomically enrich the existing session without duplicating its session, exercise, lap, route, or series identities.

### FR-026 — User-authored sport classification

- An unresolved source sport reference will remain explicitly unknown until trustworthy evidence or the user supplies a classification; the application will never invent a sport name from an opaque provider value.
- A provider-neutral classification will be scoped by observation origin and exact source sport reference and may contain a canonical sport family and user display label with authorship and revision.
- Classification will survive restart, reimport, migration, and portable backup without overwriting source evidence.
- Automatic recognition will use only versioned, provenance-bearing provider evidence. This may be an explicitly
  installed and activated provider catalogue or a source-authored detailed code related to exactly one session by a
  documented export relationship. A session-scoped candidate never labels every record sharing an opaque source
  reference. One exact candidate is recognized, multiple candidates remain ambiguous, no candidate remains unknown,
  and absence of recorded sport evidence remains unavailable; candidate order never selects a winner.
- Provider identifiers, catalogue keys, and provider hierarchy remain inside the source adapter. Home, History, session, report, filter, and export projections receive only localized names, an optional provider-neutral family suggestion, candidate cardinality, and opaque local evidence capabilities.
- User-authored meaning produces a personally overridden identity and wins within its explicitly declared scope
  without deleting recognition evidence. Classifying the unresolved remainder of an opaque source profile will not
  silently replace a more specific session-scoped or catalogue-backed identity merely because both records carry the
  same opaque reference. Deliberately unifying those identities requires an explicit relationship whose affected
  sessions and precedence are visible before save. Reimport or catalogue enrichment may update retained source
  recognition but may not silently replace the personal choice within that declared scope.
- Activating another catalogue or mapping revision invalidates earlier training-discovery snapshots before any new identity is projected.
- Training history will use a recognizable provider-neutral sport label and visual identifier wherever trustworthy identity evidence exists. Unresolved references remain honest but are classifiable from the affected history itself; assigning or revising a display label and sport family updates every relevant view without requiring reimport.
- Every sport identity available to the current history will be visibly discoverable at supported widths and zoom levels. Discovery will wrap complete labels and actions instead of relying on unannounced horizontal scrolling, truncation, or hidden continuation.
- Home will preserve each unresolved sport profile as a distinct visible identity and offer a contextual path to the same classification task used by History. Multiple unresolved profiles will never collapse into one apparent sport, expose source values, or create competing editors.

### FR-027 — Structured training intent, phases, and blocks

**Priority: high.** FitFreed will import and preserve supported provider-authored training objectives, phases, blocks,
repetitions, work and recovery structure, and their documented duration, distance, and intensity constraints. This is
a fundamental training capability rather than optional presentation enrichment.

- Source-authored planning structure will retain identity, ordering, nesting, units, optionality, provenance, source
  revision, and its relationship to the completed session when that relationship is established by source evidence.
- Imported objectives, phases, and blocks will remain distinct from recorded exercises, manual or automatic laps,
  FitFreed-calculated segments, and user-authored ranges or criteria.
- Reimport and connected-provider synchronization will reconcile later or amended structure without duplicating it,
  rewriting recorded evidence, or inventing a relationship between a plan and a completed session.
- Session exploration will expose the imported structure naturally and state clearly when planning evidence was
  absent, unsupported, only partially mapped, or not authoritatively linked to the recorded session.
- Provider mappings and canonical contracts will document supported fields, known loss, ambiguity, units, time
  semantics, and version evolution with independently constructed synthetic evidence.

## Confirmed MVP scope

The MVP is a private unsigned macOS alpha that provides one complete user journey:

1. Launch the application in `en-US` or `es-ES` and persistently configure language, content zoom, and system, light, or dark appearance.
2. Obtain a Polar Flow account export through verified provider guidance when needed, then select and import the ZIP archive directly.
3. Inspect phased progress and a coverage report that distinguishes supported, unsupported, deliberately ignored, unrecognized, and invalid data, then explains each data family and the applicable next action.
4. Persist normalized data locally and recover it after restarting the application.
5. Explore a longitudinal dashboard covering daily activity, training sessions, sleep, and recovery.
6. Find a remembered session through sport, chronology, search, or filtering and return to the exact originating exploration state.
7. Inspect one routed and one non-routed session through supported structure, signals, exact evidence, provenance, limitations, and reusable user segmentation.
8. Explore imported training objectives, phases, blocks, repetitions, and constraints without confusing planned intent
   with recorded, calculated, or user-authored session structure.
9. Start from a relevant built-in example or an existing report, compose an independently owned report, save,
   reopen, deliberately refresh, duplicate, preview, and export it as self-contained HTML.
10. Reimport the same archive without duplicates and import a later overlapping archive cumulatively.
11. Receive actionable guidance for invalid, partial, unsupported, interrupted, or failed imports.

The MVP also publishes the Polar Flow export-format reference required by FR-019 for every file family evaluated by the importer, including explicit gaps and unsupported structures. It publishes the FitFreed specifications required by FR-020 for every canonical concept, mapping, persisted schema, migration, and portable representation implemented by the MVP.

The accepted report, deep-session, segmentation, sport-classification, and structured-training boundaries are defined
by FR-005, FR-025, FR-026, and FR-027. Existing architecture is recorded in ADRs 0021 and 0022. The active production
sequence is owned by the MVP redesign production migration plan; it must add or supersede structural decisions when
the report-template, duplication, training-intent, or charting contracts require them.

The MVP explicitly excludes:

- External-tile cartography, route atlases, route search, and geospatial analysis beyond the local session route. This
  is a first-MVP boundary; cartographic context remains an explicit post-MVP direction.
- Sample families and provider-specific training structures outside the verified FR-025 and FR-027 sets.
- Free-form report layout, formulas, arbitrary queries, native PDF generation, cloud collaboration, and scheduled reports.
- Additional source providers.
- Linux and Windows packages.
- Apple code signing, notarization, and public binary distribution.
- Advanced application-level encryption.
- A runtime importer plug-in marketplace.
- Model Context Protocol access.
- Connected provider-API synchronization.

### NFR-001 — Local scalability

Import and queries must work with multi-gigabyte histories, thousands of files, and millions of samples without requiring the entire data set to reside in memory.

### NFR-002 — Privacy of reference data

Personal data supplied for analysis may only be read from its local location. It will not be copied into the repository, used in versioned tests, or included in diagnostic logs.

The MVP will apply baseline protections: local processing and storage by default, no transmission of imported data, no personal values in logs or diagnostics, restricted temporary-file handling, and explicit user control over destructive data operations. Advanced controls such as application-level encryption may remain in the post-MVP roadmap unless threat analysis identifies an MVP blocker.

### NFR-003 — Representative tests without personal data

Importer tests will use synthetic cases representing the variants and edge cases observed in the sample, including repeated ZIP archives, overlapping exports, new data, historical structures, unknown files, and invalid input.

### NFR-004 — Documentation as part of the product

User and technical documentation are mandatory deliverables. Every increment that changes behavior, architecture, installation, operation, or contribution procedures will update its canonical documentation source as part of the same change.

### NFR-005 — Reproducible developer onboarding

A new developer must be able to prepare the environment, run the application, execute automated checks, and understand the architectural boundaries using only the versioned repository documentation.

### NFR-006 — English as the canonical project language

All canonical engineering artifacts and source text will use English. Localized product resources are maintained separately and are the only multilingual project content. Automated checks will enforce this separation where practical.

### NFR-007 — Translation-tool interoperability

- User-facing text will be externalized from source code and represented through stable translation keys.
- The chosen resource format and workflow must support lossless import and export with established collaborative translation platforms such as Weblate, Crowdin, or Transifex.
- Translation resources will retain translator context, plural rules, interpolation metadata, and source-language changes.
- Automated checks will detect missing keys, invalid placeholders, malformed resources, and untranslated source text in the user interface.
- Interface layouts will tolerate translated text expansion and locale-specific number, date, time, duration, distance, and measurement formatting.
- The translation workflow will support adding a locale without changing domain or application code.

### NFR-008 — User experience quality

- User experience means the complete path from obtaining and importing personal data to understanding something valuable from it; visual styling and interface composition are necessary but insufficient evidence.
- The first successful import will produce an immediate, evidence-backed personal result from the available history and lead into further answerable questions. The user must not have to combine disconnected domain tools mentally to determine why the history is useful.
- The first-run experience will guide users from an empty library to a successfully imported and explorable history without requiring prior knowledge of the takeout structure.
- Information architecture will use progressive disclosure: summaries will remain approachable while detailed physiological and time-series data remain accessible.
- Product surfaces will lead with meaning and recognizable records rather than setup controls, editor mechanics, diagnostics, or exhaustive numeric inventory. Detail will open as a deliberate state with a clear return path, not appear after an unbounded list or unrelated control surface.
- Long-running operations will keep the interface responsive and provide meaningful progress, safe cancellation when technically possible, and actionable recovery guidance.
- Empty, loading, success, partial-success, error, and unsupported-data states will be deliberately designed and tested.
- Destructive or privacy-sensitive actions will make their scope and consequences clear before execution.
- Keyboard navigation, focus behavior, color contrast, screen-reader semantics, reduced-motion preferences, and scalable text will be treated as core behavior under the WCAG 2.2 Level AA and WCAG2ICT target defined in `quality-targets.md`.
- Visualizations will remain interpretable without relying on color alone and will expose exact values and units through accessible alternatives.
- Locale-aware units, dates, times, durations, numbers, and terminology will be consistent throughout the product.
- UX acceptance will include realistic end-to-end usability sessions, not only component-level or screenshot review.
- Experience design will use explicit behavioral segments, jobs and questions, end-to-end journeys, task models, information architecture, interaction-state models, and competing reviewable alternatives. Attractive styling or implementation completeness alone will not satisfy acceptance.

### NFR-009 — Developer experience quality

- A clean clone will provide one documented primary path to install prerequisites, build, run, test, lint, format, package, and diagnose the application.
- The default local workflow will not require personal data, proprietary credentials, or access to private infrastructure.
- Synthetic fixtures and data generators will make import behavior and visual states easy to reproduce.
- Fast checks will provide early local feedback, while comprehensive checks will remain available before integration.
- Formatting, static analysis, dependency rules, tests, documentation checks, packaging checks, and translation validation will run consistently locally and in continuous integration.
- Architectural boundaries, extension points, domain terminology, and representative implementation patterns will be discoverable and enforced where practical.
- Failures will report the violated rule and a concrete remediation path rather than exposing only an opaque tool error.
- Development tasks will be automatable and non-interactive by default so contributors and continuous integration use the same commands.

### NFR-010 — Open-source community sustainability

- The repository will include a concise product-first README, a reviewable product-page source, contribution guide, code of conduct, security policy, support policy, license, governance information, and issue and pull-request templates.
- The project will publish its supported scope, roadmap, compatibility status, release process, and change history.
- Contribution units will be independently understandable and reviewable, with suitable issues prepared for first-time contributors when real bounded work exists.
- Contribution requirements will be proportional to risk and will not impose unexplained process or accidental tooling barriers.
- Decisions and review feedback with durable value will be reflected in canonical documentation rather than remaining available only in conversations.
- Dependency choices will consider project health, licensing, maintenance burden, contributor familiarity, and long-term availability in addition to technical capability.
- Public repository history and artifacts will protect contributor email privacy and use GitHub identities or approved `noreply` addresses instead of private personal addresses.

### NFR-011 — Incremental and evaluable delivery

- Development will proceed through small vertical increments that exercise the required domain, application, adapter, persistence, presentation, testing, and documentation paths for a coherent capability.
- Every product increment will be runnable and will provide an observable outcome that can be evaluated by users or contributors.
- The first increment will establish the smallest production-shaped end-to-end path, and later increments will extend it without replacing it with a disconnected implementation.
- User-interface elements will not be treated as complete until their supporting use case, domain behavior, and persistence path work end to end.
- Foundational work without visible product behavior must identify the next vertical increment it enables and provide direct verification of its architectural purpose.
- Early evaluation will include realistic interaction and representative data, not only compilation, isolated unit tests, or static mockups.
- Feedback from an increment will inform later decisions, but changes to agreed scope or constraints require an explicit product decision and corresponding documentation update.
- Gradual delivery will not relax architecture, testing, documentation, accessibility, privacy, localization, or code-quality requirements.

### NFR-012 — Roadmap and planning clarity

- A versioned product roadmap will define ordered outcomes, dependencies, milestone boundaries, MVP boundaries, acceptance gates, risks, and deferred capabilities before implementation begins.
- The roadmap will cover the expected product evolution, while detailed task planning will use progressive elaboration: the current milestone will be actionable and later milestones will remain outcome-oriented until they approach execution.
- Product roadmap, milestone execution plan, and implementation backlog will remain distinct. The roadmap defines direction and sequencing; milestone plans define verifiable delivery; backlog items define executable work.
- Every milestone will state its purpose, included scope, explicit exclusions, dependencies, evaluation method, and exit criteria.
- Progress will be traceable from requirement to milestone, increment, implementation evidence, and acceptance result.
- Roadmap changes will record their reason and impact. They will not silently redefine agreed scope or acceptance criteria.

### NFR-013 — MVP protection

- The MVP will be the first milestone that delivers a complete, usable product outcome to its intended user, not a collection of technical foundations or disconnected demonstrations.
- Pre-MVP work will be limited to capabilities required to deliver the MVP or to satisfy confirmed architectural, security, privacy, quality, localization, documentation, and distribution constraints.
- Post-MVP extensibility will be preserved through Clean Architecture and DDD boundaries, but speculative features and generalized infrastructure will not delay MVP validation.
- MVP quality requirements are not reduced versions of final quality requirements. Scope may be smaller, but included behavior must be integrated, documented, tested, and suitable for real evaluation.
- Post-MVP milestones must not become implicit prerequisites for accepting the MVP.

### NFR-014 — Installation and update quality

- Installation will use conventions familiar to each supported operating system and will not require a development toolchain or terminal commands.
- Release artifacts and update metadata will be produced through a reproducible, documented release process.
- Installers, application bundles, and update artifacts will be signed or notarized according to the security model of each supported platform.
- The private macOS MVP alpha is the only exception to Apple code signing and notarization. Its distribution will remain restricted to evaluation participants and outside public release channels.
- The private-alpha exception does not permit unverified update payloads: update artifacts and metadata must still have cryptographically verified integrity and origin within the update mechanism.
- Developer ID signing and Apple notarization are release blockers for the first publicly distributed macOS binary.
- Update checks will transmit only the minimum technical information needed to determine compatibility and availability. They will not transmit imported health, location, account, or usage data.
- Users will be able to inspect the current version, trigger an update check, and access release notes from within the application.
- Installation, update from every supported upgrade baseline, migration, failed-update recovery, and removal will be verified on every supported platform before release.
- Removing the application will clearly distinguish removal of application binaries from deletion of the user's imported library.
- The application will remain functional without network access except for capabilities that explicitly require it, including update checks and downloads.

### NFR-015 — Installation and update release gate

- Clean installation, first launch, update discovery, update installation, data migration, failure recovery, and removal are release-blocking journeys on every supported platform.
- A release will not be published for a platform unless its signed or otherwise platform-trusted release-shaped artifact has passed the applicable installation and update matrix in a clean environment.
- An update failure must leave either the previous application version usable or a documented automated recovery path; it must not leave a partially installed application as the only state.
- Application updates and data migrations will be coordinated so that a failed application replacement cannot strand the user with an unreadable or partially migrated library.
- Before an update changes persistent data, the application will verify recoverability and preserve the information needed to restore a consistent supported state.
- Published releases will include checksums, signatures, release notes, supported upgrade baselines, known limitations, and recovery instructions.
- Release procedures will define how to halt or withdraw a defective update and how users return to a supported version without losing their library.
- Installation or update regressions reported on a supported platform will receive the highest product-defect priority.

### NFR-016 — Behavior-based automated quality

- Every included behavior and invariant will be verified at the lowest test level that provides trustworthy evidence, with higher-level tests covering integration boundaries and complete user journeys.
- Tests will protect observable behavior and domain rules rather than implementation structure.
- A change is not complete while its required unit, integration, and end-to-end evidence is absent or failing.
- Test suites will be deterministic, isolated, reproducible, and suitable for both local execution and continuous integration.
- Real personal exports will never be test fixtures. Synthetic fixtures will preserve the structural and behavioral cases needed for confidence.
- Test coverage metrics may identify unexamined code, but numerical coverage alone will not be treated as quality evidence or motivate tests without behavioral value.

### NFR-017 — Unit testing

- Domain invariants, value objects, reconciliation rules, idempotency, version interpretation, calculations, and error classification will have fast focused unit tests.
- Use-case tests will verify orchestration through controllable ports without requiring concrete persistence, file systems, networks, or graphical interfaces.
- Test setup will expose only dependencies relevant to each behavior and will retain strict detection of unused or incorrect test doubles.

### NFR-018 — Integration testing

- Integration tests will verify ZIP and JSON adapters, database behavior, transactions, migrations, import provenance, translation resources, update metadata, packaging boundaries, and other framework integrations.
- Import integration tests will cover repeated archives, overlapping exports, amended records, historical format variants, unknown files, corrupted content, interrupted imports, and retry behavior.
- Persistence tests will verify committed state, rollback, restart recovery, concurrency rules, query correctness, and migration from every supported schema baseline.
- Contract tests will protect the boundary between the Polar Flow external model and the internal domain model.

### NFR-019 — End-to-end testing

- End-to-end tests will drive the packaged desktop application through real user entry points and verify the resulting persisted behavior.
- Critical journeys will include first run, locale selection, ZIP selection, successful import, repeated import, cumulative import, exploration, filtering, report or visualization interaction, restart and recovery, update notification, update migration, and error handling.
- Interface tests will enter realistic values, persist them, reload the application, exercise every control in scope, verify multiple-item behavior, and cover invalid and boundary inputs.
- Visualizations will be tested for interaction, exact displayed values, accessible alternatives, localization, and recovery from empty or partial data—not merely for presence on screen.
- Installer and updater journeys will be tested on every supported operating system using release-shaped artifacts.

### NFR-020 — Quality gates

- Pull requests and release candidates will not pass while required automated tests, architecture checks, static analysis, translation validation, documentation validation, packaging verification, or security checks fail.
- Fast unit and focused integration tests will support the inner development loop. Broader integration, E2E, packaging, migration, performance, and platform matrices will run at explicitly documented continuous-integration stages.
- Every defect fix will include a failing automated reproduction at the appropriate level before the correction whenever technically feasible.
- Flaky tests will be treated as product-quality defects with ownership and diagnosis; they will not be silently retried or disabled to obtain a green build.

### NFR-021 — Process automation

- Every repeatable process will be evaluated for automation and will remain manual only when automation would reduce safety, reliability, transparency, or decision quality.
- The same versioned entry points will drive local development and continuous integration; CI-only command sequences will be avoided.
- Environment setup, formatting, static analysis, architecture checks, tests, synthetic fixture generation, documentation validation, localization validation, dependency and license checks, vulnerability scanning, packaging, signing preparation, installer verification, update metadata, and release assembly will be automated where supported.
- Versioning, change-log assembly, release notes, checksums, software bills of materials, provenance, and publication artifacts will be generated from versioned and reviewable inputs.
- Dependency updates and routine maintenance checks may be proposed automatically, but they must pass the same quality gates and review as contributor changes.
- Automation will be deterministic, non-interactive by default, cross-platform where contributors need it, and safe to rerun.
- Automated failures will explain the violated rule and provide a concrete remediation path.
- Secrets will be supplied by protected execution environments and will never be embedded in scripts, configuration committed to the repository, logs, fixtures, or generated artifacts.
- Automation will not bypass required human approval for scope changes, architectural decisions, security exceptions, secret use, signing authority, or public release.
- Remaining manual steps will be documented, justified, and periodically reviewed for safe automation opportunities.
- Repository initialization, contribution, release, and publication checks will detect private email addresses in Git metadata and public artifacts before they leave the local environment.

The canonical automation strategy is maintained in [`automation-strategy.md`](automation-strategy.md).

### NFR-022 — Vendor-neutral domain and application core

- Domain concepts and use cases will represent user-owned activity, training, sleep, recovery, and related information without importing provider terminology or schemas into the core.
- Provider-specific parsers, schema handling, identifiers, and mappings will remain in source adapters.
- The normalized model will not collapse all providers into a lowest-common-denominator record. Shared concepts will be modeled explicitly, while genuinely source-specific observations will retain their meaning and provenance through a controlled extension boundary.
- The domain may evolve when a new source reveals a genuine product concept. Vendor neutrality does not require predicting every future provider in the MVP.
- Importer separation will be enforced through code boundaries and contract tests. A runtime plug-in marketplace or dynamic extension system is not required for the MVP.

The canonical source-integration architecture is maintained in [`architecture/source-integration.md`](architecture/source-integration.md).

### NFR-023 — Measurable quality targets

- Accessibility will target WCAG 2.2 Level AA, interpreted for the desktop application through WCAG2ICT and supplemented by native macOS keyboard and VoiceOver evaluation.
- The macOS MVP functional support boundary is Apple Silicon on macOS 15.0 or later with sufficient SSD capacity. Package metadata, executable deployment target, and hosted verification must agree with that boundary. Performance evidence is qualified by its reproducible local Apple Silicon or hosted macOS execution environment rather than by an unavailable fixed-memory reference machine.
- Cold launch to an interactive application shell will complete within 2.5 seconds at the 95th percentile in every maintained performance environment.
- Visible interaction feedback will begin within 100 milliseconds. Common navigation and filtering results will complete within 500 milliseconds at the 95th percentile; complex historical visualizations may take up to 2 seconds when their loading state is explicit.
- Long-running work will not block the interface. Progress will appear within 1 second, cancellation will be acknowledged within 1 second, and processing will reach a consistent cancellation boundary within 5 seconds unless an operating-system operation cannot be interrupted safely.
- The independently generated large synthetic scenario defined in `quality-targets.md` will import within 10 minutes in every maintained performance environment while peak application memory remains below 1.5 GB and does not grow without bound as history grows.
- The independently generated dense supported-signal scenario defined in `quality-targets.md` will preserve exactly 520 sessions, 2,080 series, and 7,490,080 samples while its current-schema library remains at or below 512 MiB. Complete-history session discovery, bounded signal overview, and exact sample pagination will each remain within the 500-millisecond p95 common-interaction budget.
- Reimporting an identical archive will complete within 30 seconds after fingerprinting and will not repeat full normalization or persistence work.
- Installation and supported update matrices require a 100% pass rate; data-loss, library-corruption, migration, and recovery failures have zero accepted occurrences.
- All scoped user-interface strings require valid `en-US` and `es-ES` resources before acceptance.

These are acceptance budgets, not aspirational observations. A result proves the recorded environment and does not promise identical timing on every supported Mac. Relaxing a budget requires measured evidence and an explicit product decision. The evidence model is defined by [ADR 0015](architecture/decisions/0015-qualify-performance-evidence-by-execution-environment.md).

The canonical definitions and measurement method are maintained in [`quality-targets.md`](quality-targets.md).

### NFR-024 — Autonomous execution

- Normal implementation choices within confirmed requirements will be resolved through evidence, documented trade-offs, and reversible decisions without requesting permission to continue.
- Build failures, test failures, defects, uncertain code behavior, and difficult implementation work will trigger root-cause analysis and continued in-scope work rather than a request for routine confirmation.
- Progress, decisions, verification evidence, known limitations, and remaining work will be preserved in versioned canonical documentation so execution can continue across long sessions.
- Execution will pause only when no safe in-scope path remains without human authority or information, including credentials, account ownership, public publication, destructive action, scope change, conflicting product requirements, legal acceptance, or access to unavailable external state.
- A pause will identify the exact blocker, completed safe work, available evidence, and the smallest human action needed to resume.
- Autonomous execution will not reinterpret a partial implementation as completion, bypass quality gates, broaden scope, or weaken a confirmed constraint to avoid a pause.

The canonical autonomy and intervention policy is maintained in [`execution-policy.md`](execution-policy.md).

The canonical testing strategy is maintained in [`testing-strategy.md`](testing-strategy.md).

### NFR-025 — No replacement lock-in

- The application will not require an account, subscription, or hosted service to import, retain, explore, report on, back up, or recover the user's library.
- The internal data model, persistence format, schema evolution, and recovery procedures will be documented sufficiently for independent inspection and implementation.
- Users must have a supported path to leave the application with their information intact. A portable backup and an
  open normalized-data export are architectural obligations. Versioned capability exports may deliver this path
  incrementally, but no partial set may be described as a complete library export.
- Data migrations will preserve recoverability, and documented procedures will allow a library to be restored without depending on an unavailable proprietary service.
- Provider provenance will remain attached to normalized records so that portability does not erase origin or prevent future reinterpretation.

## Delivery model

Each increment will follow this cycle:

1. Define a coherent user or contributor outcome and measurable acceptance criteria.
2. Identify the smallest vertical slice that can demonstrate that outcome without introducing a disposable parallel design.
3. Implement the slice through the appropriate Clean Architecture layers using tests that protect behavior and architectural boundaries.
4. Run the application with representative synthetic data and evaluate the complete interaction.
5. Update user, technical, architectural, and compatibility documentation affected by the slice.
6. Present the runnable increment and its verification evidence for feedback before selecting or refining the next increment.

An increment is not accepted merely because its internal components exist. It must be integrated, observable, documented, and evaluable from its intended entry point.

The canonical product roadmap is maintained in [`roadmap.md`](roadmap.md).

## Documentation requirements

### User documentation

At minimum, it will cover:

- Supported platforms, installation, updates, and removal.
- Update notifications, postponement, release notes, migration behavior, and recovery from a failed update.
- First run and import of a Polar Flow ZIP archive.
- Reimports, cumulative imports, and the meaning of their outcomes.
- Included exploration features, reports, visualizations, and exports.
- Data location and handling, privacy, backups, and deletion.
- Common errors, safe diagnostics, and recovery.
- Known limitations and the Polar Flow format compatibility matrix.

User, technical, and contribution documentation use canonical English. Spanish is a supported application locale and remains isolated in the `es-ES` translation catalog; project documentation is not duplicated as a second-language source of truth.

### Technical and contribution documentation

At minimum, it will cover:

- A quick start from a clean repository clone.
- Environment requirements, build, run, test, static analysis, and packaging procedures.
- Clean Architecture overview, dependency direction, and layer responsibilities.
- Domain model, ubiquitous language, bounded contexts, and primary invariants.
- Use cases, ports, adapters, and persistence strategy.
- Import pipeline, reconciliation, idempotency, and takeout version compatibility.
- Testing strategy and synthetic data generation.
- Durable architectural decisions through architecture decision records.
- Contribution workflow, review criteria, versioning, and publishing.
- Procedures for diagnosing errors without exposing personal data.

### Documentation governance

- Every piece of knowledge will have one canonical source; other documents will link to it.
- Documentation will distinguish the current design from historical decisions.
- Public examples will use synthetic data exclusively.
- Documented commands will be covered by automated verification when practical.
- Every change review will explicitly determine whether documentation must be updated.

## Open-source contributor experience

The public repository will provide a clear path through four stages:

1. **Evaluate:** understand the purpose, current capabilities, screenshots, supported data, platforms, license, and project status quickly.
2. **Run:** launch the application with synthetic data from a clean clone using the documented primary workflow.
3. **Contribute:** find a bounded issue, understand the relevant architecture and acceptance criteria, make a change, and run the same checks used by continuous integration.
4. **Maintain:** diagnose failures, review changes, publish releases, evolve schemas, and record durable decisions without relying on undocumented maintainer knowledge.

## Open decisions

1. Minimum versions and processor architectures for later Linux and Windows support. The macOS boundary is already fixed at Apple Silicon on macOS 15.0 or later.
2. Privacy model beyond the confirmed local baseline, including user-controlled backup and possible encryption.
3. Exact composed format and delivery milestone for the complete normalized-data export and portable library backup.
   The planned-training capability has its own version-1 portable JSON contract; that does not close this decision for
   the complete library.
4. Support for one person or multiple independent libraries.
5. Long-term retention or deletion policy for original ZIP archives and extracted source artifacts. Version 0.1.0 exposes no archive-copy feature and requires users to preserve the selected ZIP independently.
6. Governance evolution beyond the bootstrap owner-maintainer model defined in `GOVERNANCE.md`.
7. Accountable production custody and activation timing for updater signing, Developer ID, App Store Connect, and independent release approvals. The release architecture and fail-closed procedures are already defined; the external authority is not configured.
8. Exceptional public security-update policy beyond the defined stable-channel compatibility, withdrawal, recovery, and ordinary update schedule.
9. Cross-source identity, overlap, conflict, and user-controlled reconciliation rules after the single-source MVP.

The canonical product spelling, positioning constraints, and public-branding validation gate are maintained in [`naming.md`](naming.md).

## Product acceptance criteria

The final criteria will be refined during analysis. At minimum, they must cover:

- Successful import of a compatible real export.
- Reimport of the same content without duplicates.
- Cumulative import of a later export.
- Correct persistence and recovery after restarting the application.
- Exploration of all information types included in scope.
- A first populated viewport that communicates one understandable personal result or recognizable record before inventory, controls, or diagnostics.
- Creation, persistence, deliberate refresh, preview, and deterministic self-contained HTML export of an agreed evidence report.
- Result-first reopening of a saved or guided report, with editing and advanced composition entered deliberately and without losing the result context.
- Bounded visual and exact inspection of the accepted routed and non-routed session verticals, including honest missing structures and reusable criteria.
- User-authored sport classification that preserves unknown and source-evidence states across restart and reimport.
- Recognizable localized sport labels and visual identifiers for classified history, with in-context resolution of unknown references.
- Functional verification of all filters, controls, and interactions in every visualization.
- Understandable handling of invalid, partial, or unsupported data.
- Verified installation and execution on every declared platform.
- No real personal data in the repository or public artifacts.
- Verified developer onboarding from a clean clone using the technical documentation.
- A complete walkthrough of included features using only the user documentation.
- Complete English and Spanish user-interface coverage with correct fallback, pluralization, interpolation, and locale-aware formatting.
- Human-readable locale-aware summaries whose date, duration, quantity, unit, and precision choices match the scale being communicated, with exact evidence still reachable.
- Successful round-trip of translation resources through at least one supported collaborative translation workflow.
- Successful completion of first-run, import, exploration, and recovery usability scenarios by participants who did not implement the feature.
- Successful build, test, and application launch by a new contributor from a clean clone using only repository documentation.
- Equivalent results from the documented local checks and continuous-integration checks.
- Unit, integration, and E2E evidence passing for every behavior included in the accepted increment.
- Public-launch readiness review covering community health files, licensing, security reporting, governance, roadmap, and contribution workflow.
- Early review of every increment through its real entry point, with acceptance evidence covering the complete vertical slice.
- Clean installation, update notification, signed update, data migration, failed-update recovery, and removal verified on every supported platform.
- Demonstrated preservation of a usable application and a consistent user library when update installation or migration is deliberately interrupted.
- Successful execution of documented automated workflows from a clean clone, with equivalent local and continuous-integration results.
- Demonstrated isolation of Polar Flow parsing and terminology from provider-neutral domain and application code.
- Compliance with the performance, responsiveness, accessibility, localization, installation, and data-integrity budgets in `quality-targets.md`.
- No unsigned macOS binary present in a public release channel; successful Developer ID and notarization verification for the first public macOS release.

## Scope boundary

The confirmed MVP exclusions are listed under `Confirmed MVP scope`. A capability that does not appear as a confirmed requirement is not authorized for implementation unless the project owner explicitly changes the scope and the canonical requirements and roadmap are updated together.
