# MVP Experience Delivery Plan

## Status

Planned as of 2026-08-18. The accepted product-experience direction now has an implementation sequence. Production implementation has not started under this plan.

The existing import, reconciliation, persistence, Insights, localization, update-recovery, packaging, and continuous-integration capabilities remain the engineering baseline. This plan changes how those capabilities become a product people can understand and value; it does not discard their verified behavior.

## Objective

Deliver the smallest responsible FitFreed experience that can win attention, answer a real question from an owned history, support trustworthy drill-down, and leave the person with a reusable result.

The target journey is:

> understand the promise → obtain or choose an export → import safely → see what became useful → find a session or pattern → inspect its evidence → return without losing the exploration → save or export a personal interpretation

The plan optimizes for that journey before production trust activation and public-candidate preparation resume. It does not use a visually polished shell to conceal missing application, domain, persistence, or compatibility support.

## Why this intervention is necessary

The current application proves a strong technical spine, but its production interface still behaves like one long diagnostic document. Import controls, update state, coverage, longitudinal analysis, and four domain explorers compete in one surface. Training is limited to aggregate session summaries; sport references are deliberately unresolved; nested exercises, laps, routes, and sample series are not persisted; report definitions do not yet exist; and navigation state is component-local.

That baseline can demonstrate correctness but cannot yet deliver the accepted product thesis on its own. A person needs to understand why the library matters, reach a personally relevant record quickly, inspect what happened, know what is missing, and carry a result beyond the momentary screen.

The intervention therefore reuses the verified spine while replacing the product journey around it.

## Scope control

### Work that remains frozen

Until the experience candidate reaches its acceptance gate, the following work advances only to correct a regression, security issue, dependency emergency, or incompatibility caused by an in-scope increment:

- production signing, notarization, channel activation, and public release publication;
- Linux and Windows delivery;
- additional providers and connected provider APIs;
- MCP access;
- advanced application-level encryption;
- runtime importer plug-ins; and
- unrelated update, packaging, or release-platform refinements.

Existing release and recovery behavior remains protected by its tests. Freezing new work does not waive a failing quality or data-safety gate.

### Product boundaries already accepted

- The person's sports history is the primary product object.
- Questions and recognizable records lead; metrics support their answers.
- Activity, sleep, and recovery provide context without displacing training.
- Persistent language, zoom, and appearance settings belong in the MVP experience.
- A person without an export receives provider-owned acquisition guidance.
- Navigation returns to the exact exploration origin and restores its meaningful state.
- Report authoring is a real product capability, not a renamed comparison chart.
- Provider facts, FitFreed calculations, user-authored interpretation, uncertainty, and unavailable conclusions remain visibly distinct.

### Product boundaries that still require evidence

Two decisions cannot be made responsibly from the visual prototype alone:

1. **Deep-session MVP boundary.** The current confirmed MVP excludes routes and full-resolution samples, while the accepted product direction identifies session structure, temporal signals, routes, and exact evidence as the clearest differentiator. Clean-room source analysis, performance evidence, and an evidence-complete interaction prototype must establish the smallest deep-session slice worth shipping.
2. **Personal-report MVP boundary.** The report-authoring design milestone must establish the smallest complete composition, persistence, refresh, preview, and export journey. A screenshot exporter is too weak; the complete long-term report system is too broad.

These are product-scope gates under the autonomous execution policy. Work that does not depend on their outcome continues while the evidence is prepared.

## Current capability and gap map

| Product need | Reusable baseline | Gap that this plan closes |
|---|---|---|
| Safe historical ownership | ZIP validation, phased import, cancellation, complete coverage, deterministic exact and overlapping reimport | First-run acquisition guidance and a value-led post-import handoff |
| Durable local library | SQLite migrations, canonical activity, training summary, sleep, recovery, provenance, restart recovery | Persistent preferences, navigation workspace state where justified, user criteria, and report definitions |
| Questions over history | Four provider-neutral Insights read models and one longitudinal composition | A question-led home, discoverable exploration hierarchy, full-history discovery, and contextual next steps |
| Sports and sessions | Canonical session summaries with duration, distance, energy, heart-rate coverage, and opaque sport evidence | Safe sport naming/classification, sport browsing, search, calendar, and evidence-rich session detail |
| Deep training evidence | Original ZIP retains nested training content; the provider reference identifies its existence | Validated semantics, canonical contracts, mapping, scalable persistence, queries, route privacy, and accessible presentation |
| Navigation | One date can request a domain explorer; individual panels own temporary detail state | A single navigation model with canonical destinations and origin-aware restoration |
| Personal reports | Period comparisons and exact accessible tables exist as disposable views | Versioned report definitions, composition, persistence, deliberate refresh, preview, and export |
| Trust and inclusion | `en-US` and `es-ES`, WCAG-oriented components, 200% test coverage, local-first operation | Consistent new-shell behavior, focus restoration, appearance and zoom, privacy review, and end-to-end task evidence |
| Delivery confidence | Impact-aware CI, packaged macOS E2E, performance budgets, installation and update recovery | New journey coverage without rerunning expensive jobs for unchanged executable inputs |

## Experience acceptance model

The experience is not accepted because every designed screen exists. It must prove five user outcomes with synthetic histories through release-shaped entry points.

### 1. The promise is understandable

On first run, the visible surface explains that FitFreed turns an owned export into a private, explorable history. It presents two clear paths: choose an archive already on the device or learn how to obtain one. Settings and the local-only boundary are discoverable without dominating the promise.

### 2. Import ends in value

A successful import reports coverage and limitations, then leads directly to the usable time span, available domains, sports or sessions that can be identified honestly, and one conservative first question. File counts are supporting evidence, not the celebration.

### 3. A returning person can find and understand something

The ordinary start surface presents supported questions and recent or previously used explorations. A person can browse by sport, chronology, route when supported, or searchable session properties; open a session; inspect summary, structure, signals, exact values, provenance, and limitations; and distinguish unavailable data from zero.

### 4. Exploration remains reversible

Every drill-down has an explicit destination-aware return action. Returning restores the originating period, query, filters, sort, view mode, selections, comparison basket, expanded evidence, focus target, and scroll position where meaningful. Direct entry still has an understandable canonical hierarchy.

### 5. The result can outlive the screen

The accepted report slice lets a person deliberately select evidence, add interpretation, save a reproducible definition, reopen it after restart, understand whether new imports affect it, preview sensitive content, and export through at least one dependable format selected by the report-design gate.

## Information architecture target

The implementation will validate these conceptual homes rather than copy the prototype mechanically:

| Home | Owns | Does not own |
|---|---|---|
| Home | Supported questions, library coverage, recent or resumed explorations, post-import reveal | Provider diagnostics, every chart, or permanent preferences |
| Explore | Sports, sessions, chronology, routes when supported, activity, sleep, recovery, comparisons, exact evidence | Import operations or report layout editing |
| Reports | Saved definitions, creation entry points, refresh state, preview, exports | Canonical fitness facts or source parsing |
| Sources | Export acquisition, imports, coverage, compatibility, provenance, and library source operations | General preferences or ordinary history browsing |
| Settings | Language, content zoom, appearance, accessibility, data/privacy, updates, and application information | Import progress, exploration filters, or report content |

Names and grouping remain subject to interaction evaluation. Their responsibilities do not collapse into a miscellaneous screen.

## Navigation contract

### Canonical destination and exploration origin

Each durable subject has a provider-neutral canonical destination: a home answer, sport, session, date, route family, comparison, evidence view, report, source operation, or settings section. A direct launch, restored window, update notice, report reference, or future MCP handoff can open that destination without an origin.

When a destination is opened from an active exploration, the navigation request additionally carries an opaque local origin descriptor. The descriptor identifies:

- the origin destination;
- a local workspace-state reference;
- the initiating control for focus restoration;
- an optional stable content anchor for scroll restoration; and
- a short explicit return label such as “Back to running sessions” or “Back to comparison”.

Sensitive filters, dates, coordinates, measurements, free text, or source identifiers are not serialized into public or transferable links. The descriptor uses application-local opaque identities and expires safely when its origin no longer exists.

### Return precedence

1. Close an ephemeral disclosure, menu, dialog, or inspector before leaving its durable destination.
2. If a valid exploration origin exists, return to and restore that workspace.
3. Otherwise, return through the provider-neutral canonical hierarchy.
4. If the canonical parent is unavailable after a data change, return to the nearest valid collection and explain the change without trapping the person.

Breadcrumbs communicate canonical hierarchy. They do not pretend to be transient history. Sidebar selection communicates the current conceptual home. Keyboard history commands and operating-system back behavior invoke the same navigation service as visible return controls.

### State-restoration acceptance matrix

The navigation implementation must cover:

- session opened from a filtered sport collection;
- session opened from search, chronology, route family, date context, comparison, and report evidence;
- nested exact evidence opened from a session;
- return after creating or editing a user-defined session criterion;
- comparison basket with multiple selected sessions;
- list, calendar, chart, table, and map view modes where supported;
- focus and scroll restoration after return;
- direct entry with no origin;
- restart restoration where the product deliberately persists a workspace;
- stale origin after reimport, report change, or deletion; and
- keyboard and assistive-technology operation in both locales at 100% and 200% content zoom.

Presentation owns navigation snapshots and focus behavior. Application use cases own canonical identities and queries. Persistence tables and provider objects never become navigation APIs.

## Delivery sequence

Each increment is a runnable vertical outcome. Within an increment, tests are written from behavior inward, and support is implemented in domain/application and persistence before a UI control claims the capability.

### D0 — Resolve the two value boundaries

**Outcome:** report authoring and deep-session exploration have enough evidence for one explicit MVP scope decision each.

**Work:**

1. Produce report-authoring interaction variants for question-led, exploration-led, session-led, and blank starts.
2. Exercise add, remove, reorder, configure, preview, save, reopen, deliberate refresh, stale-definition, sensitive-content review, export failure, and recovery behavior with synthetic histories.
3. Evaluate maintained open-source composition, visualization, map, pagination, and export libraries against GPL compatibility, offline use, accessibility, deterministic output, React and Tauri integration, maintenance, bundle cost, and replaceability. A library is evidence, not the product design.
4. Extend clean-room training-format analysis only as far as necessary to establish source structure, identity, ordering, units, time semantics, route relationships, laps or phases, sample families, revisions, optionality, and known ambiguity. Never derive versioned examples from the private export.
5. Establish how sport references can become honest user-facing classifications. Compare only structural paths: a versioned public source catalogue when adequate evidence exists, provider-neutral user-authored classification with retained source evidence, or an explicit unresolved state. Never guess a sport name from a private reference value.
6. Construct independent synthetic contracts for the candidate deep-session slice, including absent structure, mixed exercises, missing samples, malformed routes, amended sessions, exact reimport under a newer mapping version, and large bounded series.
7. Prototype navigation from every meaningful origin and test return restoration, direct entry, stale origin, keyboard history, focus, and 200% layouts.
8. Score candidate MVP slices by unique user value, completeness, source confidence, privacy risk, performance feasibility, accessibility, implementation dependency, and future discard risk.

**Evidence gate:** the product owner receives no request to choose between vague ideas. The gate presents concrete report and deep-session journeys, source-confidence boundaries, dependency and licence findings, and a recommended smallest complete slice. The accepted decisions update `requirements.md` and `roadmap.md` before production capability work that depends on them.

**Independent work while the gate is open:** E1 can proceed because its settings, acquisition, shell, and navigation responsibilities are already accepted.

### E1 — First-run shell, sources, settings, and navigation spine

**User value:** a new or returning person understands where to begin and never becomes trapped in a screen.

**Application and architecture:**

- Define typed destinations, canonical subject references, origin-aware workspace snapshots, fallback hierarchy, and focus restoration as a presentation-facing navigation contract.
- Replace the monolithic document flow with a responsive application shell and conceptual homes.
- Add application ports for a versioned preference set. Persist language, system/light/dark appearance, and 100%–200% content zoom atomically with safe defaults, validation, recovery, and reset.
- Expose provider acquisition guidance through a source capability contract owned by the importer adapter. Keep official links and provider terminology outside the provider-neutral core.
- Preserve offline instructions and the last-verified date; opening an official link remains an explicit user action.

**Presentation:**

- Deliver the first-run promise, “choose an archive” and “learn how to obtain one” paths, source guide, settings, appearance preview, zoom preview, save/reset behavior, shell navigation, explicit return labels, and canonical fallback.
- Apply theme and zoom before the ordinary shell becomes visible after restart so preferences do not flash through an incorrect state.
- Keep import, update, and destructive-operation concurrency rules visible and intact.

**Acceptance evidence:**

- Unit tests cover preference validation, defaulting, obsolete-value recovery, acquisition-guide selection, and navigation fallback decisions.
- SQLite integration tests cover migration, atomic save, restart, corruption recovery, and preservation through update preparation.
- React tests enter and persist every setting, reset it, exercise invalid recovery, open both acquisition paths, follow every navigation control, and verify focus and state restoration rather than only checking that fields exist.
- Packaged E2E covers first run and restart in both locales, light/dark/system behavior, 100% and 200% zoom, keyboard-only navigation, official-link isolation, import/update blocking, and accessibility.
- User and contributor guidance explains the new shell, settings storage, acquisition ownership, and navigation model.

**Evaluation checkpoint:** the development package is useful to someone who has no export yet. No training-detail or report implementation is needed to evaluate this checkpoint.

### E2 — Import-to-first-answer and returning home

**User value:** import produces an immediate reason to explore, and reopening the application begins with history rather than maintenance controls.

**Application and architecture:**

- Add a provider-neutral library-home query that composes existing authoritative read models without reading persistence tables from presentation or inventing a second calculation path.
- Return usable date coverage, supported domains, measurement coverage, conservative question availability, and recent or resumable exploration references.
- Define a post-import reveal from the committed canonical outcome, not from ZIP file counts or provider artifacts.
- Keep import coverage and source diagnostics in Sources while making their limitations reachable from every affected answer.

**Presentation:**

- Present question-led entry points only when their application contracts can answer them.
- After import, show what period and domains became usable, what remains unavailable, and one or more safe next questions.
- On later launches, restore a valid last workspace or show Home with recent supported paths. Never create coercive streaks, unexplained scores, or fabricated recommendations.

**Acceptance evidence:**

- Composition tests prove coverage, missing-data, multiple-origin, empty, partial, and reimport behavior.
- UI tests verify every question entry, post-import action, limitation link, empty state, error recovery, and restart outcome.
- Packaged E2E imports realistic synthetic archives, reaches an answer without manual scrolling through source diagnostics, reimports, extends history, restarts, and confirms that the visible next steps update from canonical state.

**Evaluation checkpoint:** a reviewer can explain FitFreed's value after first import and can reach supporting evidence from the first answer.

### E3 — Sports and session discovery

**User value:** a person can locate a remembered workout and understand the shape of their sports history.

**Precondition:** D0 has established a safe sport-classification path. Opaque provider references are never displayed as invented sport names.

**Application and architecture:**

- Define the provider-neutral sport classification and unknown-value behavior, including the relationship between shared sport concepts, source-specific evidence, and any user-authored label.
- Version the canonical training contract and source mapping only when semantics and identity are established.
- Add query ports for full-history sport and session discovery with bounded pagination, date ranges, search, filtering, sorting, calendar distribution, comparison selection, and measurement coverage.
- Preserve origin separation and explicit cross-source ambiguity.

**Presentation:**

- Deliver sports overview, sport detail, session library, search, filters, chronological and calendar views, exact table alternatives, comparison basket, and empty/partial/unknown states.
- Open every session through the navigation contract and return to the exact source workspace.

**Acceptance evidence:**

- Domain and mapping tests cover classification, unknowns, amendments, mixed-sport sessions, and deterministic reconciliation.
- Persistence and query tests cover indexes, pagination stability, full-history scale, multiple origins, migration, restart, and exact values.
- UI tests enter real search and filter values, combine filters, change sort and view, select multiple sessions, clear and restore state, open results, and verify return restoration.
- Packaged E2E proves the discovery journey with at least four independently invented sports, multiple years, indoor and outdoor sessions, missing measurements, reimport, and both locales.

**Evaluation checkpoint:** a reviewer can find a specified synthetic session by at least three distinct paths and return to each origin without reconstruction.

### E4 — Evidence-complete session inspection

**User value:** opening a session answers “what happened?” rather than repeating its summary row.

**Precondition:** the deep-session scope decision from D0 is accepted and documented.

**Application and architecture:**

- Model supported session structure as real domain concepts rather than generic provider key-value blobs. Source exercises, source laps, pauses, zones, route geometry, and sample series retain their distinct identity and provenance where included.
- Keep source-provided structure separate from FitFreed-derived views and user-authored segmentation.
- Stream and stage large nested data; do not load an entire archive or unbounded series into memory.
- Version source mapping and mapping-set compatibility so importing the same archive after the upgrade reassesses its bytes and enriches existing sessions without duplicates.
- Add query ports for session overview, supported structure, progressively windowed or downsampled series, route summary, exact paginated samples, coverage, and provenance. Downsampling never replaces access to exact values.
- Define route privacy behavior before rendering geography. No external tile request may disclose a private location silently.

**Presentation:**

- Deliver a progressive session workspace: identity and summary, structure, temporal signals, route when supported, exact evidence, provenance, and limitations.
- Explain absent provider structure without presenting it as an error.
- Allow the person to apply supported reusable criteria such as time, distance, heart-rate zone, pace, power, altitude, or route segment only when required measurements exist.
- Attribute each segment as source-provided, FitFreed-derived, or user-authored and provide an accessible exact alternative for every visual.

**Acceptance evidence:**

- Contract tests bind provider reference, canonical versions, mappings, schemas, fixtures, and migrations.
- Reimport tests first import the old mapping, then import the exact same ZIP under the new mapping and prove enrichment, amendment policy, provenance, and zero duplicate sessions or children.
- Integration tests cover no structure, one and multiple exercises, mixed sports, laps with gaps, pauses, missing sample families, invalid points, route discontinuity, amendment, cancellation, transaction rollback, and restart.
- Performance tests enforce bounded memory, progressive query, common interaction, complex visualization, and exact-table budgets against generated million-sample scenarios.
- UI and packaged E2E exercise every included control with values, multiple criteria, add/remove/reorder where applicable, route privacy, visual/table parity, 200% zoom, keyboard, VoiceOver-oriented semantics, restart, and stateful return to every origin.

**Evaluation checkpoint:** the selected synthetic outdoor and indoor sessions each reveal something not available from the existing summary experience, while missing structures remain honest and usable.

### E5 — Personal report authoring and export

**User value:** a person can turn an exploration into a reusable, portable result.

**Precondition:** the report scope and export format decision from D0 is accepted and the selected report blocks have authoritative application queries.

**Application and architecture:**

- Introduce a versioned `ReportDefinition` in Insights with identity, title, ordered blocks, query parameters, presentation choices, user narrative, provenance policy, sensitivity flags, refresh state, and compatibility behavior.
- Store references to canonical evidence and question definitions rather than unexplained copied values.
- Resolve definitions through application use cases and explicit query ports. Presentation and export adapters do not read SQLite tables.
- Persist definitions transactionally, migrate them explicitly, detect stale or incompatible definitions, and make refresh after imports or calculation changes deliberate.
- Implement export behind a replaceable port with deterministic, local, cancellable generation and safe failure cleanup. The portable report-definition contract and generated-output boundary are documented separately.

**Presentation:**

- Support every accepted start path, block add/remove/reorder/configure behavior, narrative editing, preview, save, reopen, refresh comparison, sensitive-content review, export, cancellation, and failure recovery.
- Preserve exact values, units, coverage, limitations, and authorship in the preview and export.
- Make the report's origin navigable and return to the exact editor or exploration state.

**Acceptance evidence:**

- Domain and use-case tests cover definition invariants, ordering, compatibility, stale state, refresh, authorship, missing evidence, and export authorization.
- Persistence and migration tests prove save, edit, multiple reports, restart, old-definition migration, incompatible-definition recovery, and non-destructive reimport behavior.
- UI tests type narrative and configuration values, add/remove/reorder multiple blocks, save, reload, refresh, preview, export, and recover from invalid input and adapter failure.
- Export tests reopen the generated output independently, verify deterministic structure and declared metadata, and confirm that cancellation or failure leaves no misleading completed file.
- Packaged E2E creates a report from an exploration, restarts, reopens it, imports more data, reviews a deliberate refresh, exports it, and verifies accessible content in both locales.

**Evaluation checkpoint:** a reviewer can create a useful artifact without learning provider or database terminology and can explain which parts are recorded, calculated, or authored.

### E6 — Experience hardening and release handoff

**User value:** the complete experience is coherent, safe to install, resilient to update, and documented for ordinary use.

**Work:**

1. Remove obsolete production navigation and presentation paths only after inventorying all behavior and incoming references, migrating every live capability, and proving no live dependency remains.
2. Run cross-feature consistency review for language, empty and error states, uncertainty, focus, keyboard history, theme, zoom, responsive layouts, reduced motion, exact alternatives, and privacy boundaries.
3. Meet cold-start, import, query, visualization, report-generation, memory, package, installation, update, recovery, migration, and removal budgets with release-shaped artifacts.
4. Update version-matched user documentation for first run, acquisition, imports, exploration, navigation, settings, session detail, reports, privacy, updates, recovery, and removal.
5. Update contributor onboarding, architecture, ADRs, data contracts, schemas, migrations, testing, performance, translation, and troubleshooting documentation in the same increments as their behavior.
6. Complete scenario-based usability and manual accessibility evaluation with synthetic data; record only privacy-safe findings.
7. Hand the accepted source revision back to Milestone 3. Production trust, Apple credentials, protected environments, exact-candidate evaluation, and publication remain separate human gates.

**Acceptance evidence:** all scoped requirements link to passing unit, integration, presentation, packaged E2E, accessibility, localization, performance, installation, update-recovery, documentation, repository-safety, and privacy evidence for the same executable-input fingerprint.

## Architecture rules for every increment

1. Read application commands, DTOs, use cases, and persistence support before designing a production control. Add lower-layer behavior first when it does not exist.
2. Preserve the dependency direction: presentation → host/transport → application → domain; concrete provider, database, export, operating-system, and map integrations remain outer adapters.
3. Keep provider vocabulary and format versions inside Source Translation and compatibility documentation. Provider-neutral product concepts must not guess external meaning.
4. Treat user-authored criteria and reports as durable domain behavior with explicit identity and evolution, not browser-local decorations.
5. Make migrations additive and recoverable. Never use destructive schema replacement to accelerate a prototype.
6. Document provider formats, canonical models, mappings, Insights contracts, portable definitions, persistence, and migrations completely with independently constructed synthetic evidence.
7. Preserve source facts during recalculation, refresh, reimport, and mapping upgrades. Derived and authored layers remain distinguishable and reversible.
8. Do not add a general abstraction for future providers, reports, sports, or platforms until the current vertical demonstrates the responsibility it must own.

## Test and continuous-integration strategy

### Per-change evidence

- Run formatting, static analysis, architecture, data-contract, documentation, localization, repository-content, secret, and focused unit/integration/presentation tests for the affected behavior before commit.
- Run the complete contributor fast lane for each coherent vertical increment.
- Build and exercise the packaged E2E journey whenever executable input changes in a way that affects a completed user path.
- Run migration matrices whenever canonical, preference, navigation, criterion, report, or persistence contracts change.
- Run focused performance gates whenever import volume, series storage, query shape, visualization, report generation, startup, or packaging is affected.

### Cost control without quality loss

- Reuse the existing executable-input fingerprint. Documentation-only changes do not rebuild an unchanged application after both complete lanes have passed for that fingerprint.
- Do not dispatch duplicate full campaigns for the same source revision and environment qualification.
- Fail fast in order: contract and unit checks, production build and cold launch, focused E2E, large import/query/report performance, update/recovery, then release-shaped packaging evidence.
- Keep expensive scenarios broad enough to prove the integrated journey but avoid running identical fixtures through multiple jobs when one artifact can feed downstream gates safely.
- Never use retries, skipped E2E, reduced assertions, or synthetic success markers to claim savings.

### Mandatory behavior coverage

- Every field accepts meaningful input, persists it, and restores it after reload where the feature promises persistence.
- Every button, keyboard command, add/remove/reorder operation, view switch, filter combination, reset, cancel, and recovery action is exercised.
- Invalid, empty, partial, missing, stale, conflicting, unsupported, interrupted, and multiple-item states are tested.
- Visuals and exact alternatives agree.
- `en-US` and `es-ES`, light and dark appearance, 100% and 200% zoom, keyboard operation, reduced motion, and automated accessibility checks cover critical journeys.
- Navigation tests assert the restored origin state, focus, and persisted outcomes rather than only the presence of a destination screen.

## Documentation delivery matrix

Every increment updates only the canonical homes it affects:

| Change | Required canonical documentation |
|---|---|
| Product behavior or scope | `requirements.md`, `roadmap.md`, active plan |
| Navigation, settings, reports, or context ownership | Current thematic architecture and an ADR when the structural choice is durable |
| Provider structure or semantics | Provider reference with evidence levels and verification date |
| Canonical concept or mapping | Canonical and mapping specifications, synthetic schemas/examples, known loss |
| Query or report behavior | Versioned Insights contract |
| SQLite or portable representation | Persistence or portable contract and migration path |
| User-visible journey | Version-matched `en-US` and `es-ES` user guidance and locale resources |
| Build, test, debug, translate, or contribute path | Contributor and developer documentation |
| Release behavior or limitation | Release notes, readiness ledger, operations, and support guidance |

Completed milestone plans remain historical evidence. They are linked, not rewritten to pretend that newly added behavior existed in their original scope.

## Evaluation checkpoints and decision records

| Checkpoint | Reviewable artifact | Decision or evidence |
|---|---|---|
| D0 | Interactive report and navigation variants; source-confidence and library assessment | Explicit deep-session and report MVP boundaries |
| E1 | Packaged first-run, acquisition, settings, and navigation journey | Shell orientation and preference behavior |
| E2 | Packaged import-to-answer and returning-home journey | Whether first value is visible and trustworthy |
| E3 | Four-sport synthetic discovery journey | Whether a remembered session is findable without provider knowledge |
| E4 | Indoor and outdoor deep-session journeys | Whether detail provides a distinctive reason to use FitFreed |
| E5 | Saved, refreshed, reopened, and exported personal report | Whether exploration creates a lasting user-owned result |
| E6 | Exact candidate and complete evidence ledger | Handoff to public-release acceptance |

Durable architectural choices receive ADRs when selected, not speculative ADRs for every candidate. Evaluation feedback changes canonical requirements before implementation scope changes.

## Autonomous execution and human gates

Implementation proceeds without routine confirmation through accepted increments, focused commits, privacy scans, and normal fast-forward pushes to `origin/main`.

Human intervention is required only for:

- accepting the D0 deep-session and report MVP scope decisions;
- accepting a material change to platform, privacy, licensing, or product behavior;
- authorizing a dependency with unresolved license or supply-chain risk;
- Apple Developer, production signing, protected-environment, tag, release, Pages, or public publication authority;
- destructive real-library operations; and
- final human usability or accessibility acceptance that cannot be automated.

If a human gate is temporarily unavailable, work continues on independent accepted increments, tests, documentation, synthetic fixtures, or technical evidence. SSH unavailability delays synchronization only; it does not stop local verified work.

## Completion rule

This plan is complete only when the accepted experience works as one release-shaped journey, every included UI capability has real lower-layer support, navigation restores origin context, report output is reproducible and portable at the selected boundary, all affected data contracts are public and verified, user and developer documentation match the candidate, and the exact executable-input fingerprint passes its applicable quality gates.

A mockup, attractive dashboard, source parser, database migration, report library, chart, map, exported file, or green lower-level test is not independently sufficient completion evidence.
