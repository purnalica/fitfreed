# MVP Experience Delivery Plan

## Status

Active as of 2026-08-20. D0, P1, E2, P2, all three E3 slices, all seven E4 slices, and all six E5 verticals retain complete functional evidence, but the E6 audit has reopened E1 presentation acceptance. The production shell has now been corrected locally to provide explicit Home ownership, persistent left-sidebar selection, a compact navigation rail, a broader workspace, and a value-first empty-library entrance. Static contracts, focused React tests, and the complete packaged functional and performance journeys pass with real desktop and compact geometry; the remaining screen-hierarchy corrections are still open. E1 through E6 therefore remain release-incomplete until the screen-by-screen implementation is complete, the exact committed source passes hosted evidence, and the later independent product audit finds no material gap. The current exact functional baseline is recorded in the [public-release readiness ledger](../testing/public-release-readiness.md). The canonical <https://fitfreed.org/> origin has valid apex and `www` DNS, verified `purnalica` ownership, a valid certificate, enforced HTTPS, the intended redirect behavior, and exact English and Spanish hosted-byte acceptance under [ADR 0023](../architecture/decisions/0023-use-fitfreed-org-as-the-public-origin.md) and [ADR 0024](../architecture/decisions/0024-generate-localized-product-pages.md).

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
- Public product communication is part of the acquisition experience: the repository README must earn an interested visitor's next minute, while a product page must explain the value and intended experience without presenting roadmap capabilities as already available.
- Provider facts, FitFreed calculations, user-authored interpretation, uncertainty, and unavailable conclusions remain visibly distinct.

### Product boundaries closed by D0

The product owner accepted the evidence-led boundaries documented in [requirements](../requirements.md), [ADR 0021](../architecture/decisions/0021-model-training-as-attributed-evidence.md), and [ADR 0022](../architecture/decisions/0022-persist-reproducible-evidence-reports.md):

1. **Deep-session MVP boundary.** One common attributed session workspace proves a routed and a non-routed vertical, the verified initial series set, bounded visuals, paginated exact evidence, local route rendering, and the initial versioned `SegmentCriterion` variants.
2. **Personal-report MVP boundary.** One ordered evidence report supports typed blocks, persistence, deliberate refresh, sensitive-content review, and deterministic self-contained HTML export.
3. **Sport-classification boundary.** Provider-neutral user authorship resolves opaque source references without guessed sport names or an MVP provider-account dependency.

These decisions close the D0 human gate. Expanding them materially remains a product-scope decision under the autonomous execution policy.

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
| Public understanding | A verified product thesis, brand assets, requirements, and roadmap exist | A concise repository entrance and a visual product page that communicate the problem, present value, evidence, current status, and credible direction |
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

The accepted report slice lets a person deliberately select evidence, add interpretation, save a reproducible definition, reopen it after restart, understand whether new imports affect it, preview sensitive content, and export deterministic self-contained HTML.

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

**Status:** accepted and complete on 2026-08-18.

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
9. Derive one public narrative from `product-thesis.md` for two distinct entry surfaces: a scan-friendly README for users and contributors, and a visual product-page concept for people deciding whether FitFreed is worth following. Both surfaces distinguish present capability, active MVP work, and longer-term direction explicitly.

**Evidence gate:** the [MVP experience boundary assessment](../research/mvp-experience-boundary-assessment.md) presented concrete journeys, source-confidence boundaries, dependency and licence findings, and the smallest complete slices. The accepted decisions are canonical in `requirements.md`, `roadmap.md`, ADR 0021, and ADR 0022.

**Handoff:** E1 proceeds first. E3 through E5 may rely on the accepted D0 boundaries without another routine confirmation.

### P1 — Publish the truthful product entrance

**User value:** someone encountering FitFreed on GitHub can understand the problem, the current product state, and the credible direction without reading the engineering corpus or being promised unavailable functionality.

**Work:**

1. Build one complete GitHub Pages artifact that composes the product site at `/` with the independently generated update channel at `/updates/`; neither producer may erase the other.
2. Present the product thesis, current capability, active MVP experience, roadmap direction, privacy boundary, and project status with visually scannable evidence.
3. Link to user documentation, contributor onboarding, support, governance, and the repository through stable routes.
4. Keep download actions unavailable until an eligible immutable GitHub Release exists. Pages never owns binaries, release evidence, or mutable copies of release assets.
5. Verify the artifact locally and in CI, including internal links, accessibility, localization claims, absence of personal data, and the `/updates/` preservation invariant.

**Publication authority:** on 2026-08-18 the project owner explicitly authorized the first live GitHub Pages product-site deployment and its in-scope updates without another confirmation. Deployment still requires the exact workflow, artifact, URL, repository setting, and P1 checks to pass. This authority does not activate application downloads, releases, update trust, signing, or future public-release publication.

**Handoff:** technical preparation and deployment proceed autonomously alongside E1. Publication occurs as soon as the deployable artifact and its evidence are ready and no later than the E1 acceptance checkpoint.

**Accepted evidence:** commit `f8032aa` passed the local product-surface, page, documentation, workflow-topology, update-preservation, repository-content, and 125-script-test checks. The [hosted product-site workflow](https://github.com/purnalica/fitfreed/actions/runs/32143028575) then composed one artifact, confirmed that no update snapshot existed to preserve, deployed it through the `github-pages` environment, and verified every public product byte without redirects. The site exposes no supported download.

Commit `1650755` migrated the canonical public and no-redirect updater origin to `https://fitfreed.org/` through the versioned public-origin contract. GitHub reports the custom domain as organization-verified with enforced HTTPS; GitHub Pages health accepted both the apex records and the `www` redirect CNAME. The [custom-origin deployment](https://github.com/purnalica/fitfreed/actions/runs/32147443685) preserved the inactive update boundary, deployed the complete artifact, and verified all five public files byte-for-byte at the canonical HTTPS origin without redirects.

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

**Local accepted evidence:** the versioned provider-neutral guide contract, Polar Flow adapter, Tauri transport, least-privilege opener capability, Sources home, first-run navigation, both locale catalogs, user guidance, and contributor architecture are implemented together. The complete fast lane passed 125 automation tests, 67 React tests, the updater refinement, and every all-feature Rust workspace target. Clippy with warnings denied and both Rust format boundaries passed. The packaged macOS WebView journey then exercised both acquisition paths, every localized guide item, exact English and Spanish official destinations, import cancellation, reimport, restart, 200% zoom, and Axe without violations. Its independently isolated two-year performance scenario also passed every 500 ms common and 2 s maximum p95 budget.

**Hosted accepted evidence:** source `85f241e1d573489d7f82fca5aab3f283da25571b` passed the [complete GitHub Actions campaign](https://github.com/purnalica/fitfreed/actions/runs/32151950344). The portable job passed every fast gate and the bounded updater refinement. The macOS job passed private release preparation, cold launch, full-scale import, Insights performance, recovery preparation, installation boundaries, the instrumented packaged journey, and both real packaged update outcomes before recording the immutable executable-input fingerprint.

**Reopened presentation acceptance:** the E6 production audit found that E1 delivered destination behavior through a sticky top header rather than the persistent left sidebar required by the navigation contract and used a constrained document column rather than the accepted desktop workspace hierarchy. The prior React and packaged evidence exercised every control but did not assert this layout contract. Functional evidence remains valid; visual-shell acceptance does not. Explicit Home ownership, the responsive sidebar, the broad workspace, the value-first empty state, and their static and focused presentation contracts are now implemented locally. The instrumented macOS package passed the complete functional journey with native logical resizing at 1440- and 900-pixel widths, desktop and compact sidebar geometry, both locales, 100%–200% content zoom, current-location semantics, Axe, and no page-level horizontal overflow; the isolated Insights performance journey also passed unchanged. Closure still requires the remaining production-screen hierarchy corrections below, unchanged gates on the exact committed source, and the independent final audit.

**Production conformance inventory:** this is the implementation checklist for the reopened acceptance, not the later independent product audit.

| Surface | Lower-layer support | Production finding | Closure evidence |
|---|---|---|---|
| Application shell | All conceptual destinations and preference behavior exist | Corrected and passed locally: explicit Home, persistent desktop sidebar, compact rail, 1440-pixel content ceiling, larger initial window, localized current-location semantics, zoom, and real packaged geometry | Retain the contract through remaining surfaces, then pass the exact committed source and independent product audit |
| Empty first run | Source acquisition and local import paths exist | Corrected and passed locally: Home leads with representative supported value, two acquisition paths, and the local-only boundary before Sources | Retain the complete packaged first-run journey through exact-source and independent product-audit evidence |
| Populated Home | Library coverage, evidence-backed questions, post-import reveal, and resumable exploration exist | Corrected and passed locally: Home is a separate destination and leads with one answer derived from authoritative coverage before the complete question catalogue; sidebar Home preserves a resumable explorer while contextual return clears it explicitly | Retain populated, post-import, resume, restart, localization, exact-source, and independent product-audit evidence |
| Training discovery and session detail | Search, filters, chronology, calendar, comparison, sport classification, routed and non-routed detail, structure, signals, zones, segmentation, provenance, and return state exist | Corrected and passed locally: Training now has explicit Sessions, Sports, and Compare periods views; session results use the broad workspace; and detail progressively exposes Overview, Structure and segments, Signals and zones, Routes, and Source history without discarding origin state. React preserved all prior behavior, and the packaged journey passed navigation, localization, restart, zoom, accessibility, and isolated performance budgets. | Retain the corrected hierarchy and every existing control through the exact committed-source gates and independent product audit |
| Activity, sleep, recovery, and aligned history | Bounded application queries, exact detail, comparisons, and cross-navigation exist | Corrected and passed locally: every explorer now has an explicit history and Compare periods view; exact detail replaces discovery within history; current-location semantics are localized; and switching views preserves valid disposable results without exposing hidden content. React and the packaged journey preserved exact queries, validation, focus restoration, missing-data distinctions, cross-navigation, both locales, zoom, accessibility, restart, and all isolated performance budgets. | Retain the corrected hierarchy through the exact committed-source gates and independent product audit |
| Reports | Versioned composition, persistence, refresh, preview, privacy review, export, and origin navigation exist | Corrected and passed locally: Reports now separates Library, Compose, and Preview; a successful save or saved-report selection opens the independent preview; stale-evidence and export reviews replace that preview; and switching stages preserves the mounted draft. React and the packaged journey retain validation, add/remove/reorder, routes, every analytical block, concurrency, focus, both locales, origin-aware return, restart, accessibility, cancellation, and atomic export. | Retain the staged hierarchy through the exact committed-source gates and independent product audit |
| Sources | Import, cancellation, reimport, coverage, acquisition guidance, and provenance exist | The surface is functionally complete but becomes the default product experience for an empty library | Secondary data-library home reached from a value-first first run; import status and source limitations remain prominent when relevant |
| Settings and updates | Persistent language, appearance, zoom, reset, invalid recovery, update checks, and recovery notices exist | Settings has no scalable category orientation and update behavior visually competes with preferences | Clear settings hierarchy with category orientation, representative preview, local-storage boundary, and update behavior retained |
| Presentation tests | Functional React, packaged E2E, localization, focus, zoom, theme, and Axe evidence exists | Selectors and assertions protect actions and destinations but not the accepted shell or workspace composition | Layout contract automation plus real rendered-surface evidence at desktop and compact boundaries, followed by the unchanged functional gates |

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

**Local accepted evidence:** the provider-neutral Library Home application contract composes the established activity, training, sleep, recovery, longitudinal, and canonical import-outcome use cases without a persistence shortcut. SQLite schema 11 stores only a versioned, answerable exploration destination and safely ignores stale or unavailable state. Composition, presentation, persistence, migration, restart, exact-repeat, overlap, missing-data, multiple-origin, and lazy-mount tests pass. The complete presentation suite passes 77 tests with 733 messages in each complete locale catalog. The packaged macOS WebView journey imports realistic synthetic history, reaches every available question, verifies source limitations, traverses English and Spanish detail and comparison controls, exercises 200% dark-mode accessibility without violations, resumes exactly one saved explorer, clears it through an explicit Home return, and proves the cleared state after another restart. Its independent two-year performance scenario passes every 500 ms common and 2 s maximum p95 budget across the five exploration paths.

### P2 — Localize the public product entrance

**User value:** an English- or Spanish-speaking visitor can understand FitFreed's promise immediately and can retain an explicit language choice without creating an account.

**Work:**

1. Keep `en-US` as the canonical product-page source and fallback, and generate a complete `es-ES` surface from separate translation resources compatible with the project translation workflow.
2. On the first visit, select Spanish only when the browser's ordered language preferences contain supported Spanish; use English when preferences are absent, unreadable, or unsupported.
3. Provide a visible manual language control on every localized page, persist the visitor's explicit choice locally, and give that choice precedence over later automatic detection.
4. Keep locale routing, canonical and alternate-language metadata, internal links, and readiness-gated download destinations deterministic. Language selection must not redirect, localize, or otherwise alter the language-neutral `/updates/` protocol surface.
5. Extend product-surface, translation, accessibility, Pages-artifact, and exact hosted-byte checks to cover both locales, direct localized entry, automatic fallback, manual switching, persistence, keyboard use, and translated-text expansion.

**Sequencing:** P2 does not interrupt the active E2 application vertical. It is an independently deployable public-site increment scheduled after E2 reaches its first complete local vertical checkpoint and before E3 acceptance; it may publish earlier when it cannot delay E2 evidence.

**Evaluation checkpoint:** a fresh browser with Spanish preference reaches Spanish product content, an unsupported preference reaches English, a manual choice survives navigation and reload, and both paths expose identical truthful product status and actions.

**Local accepted evidence:** one canonical `en-US` HTML source and a complete 137-message `es-ES`
JSON catalog generate deterministic `/` and `/es/` documents under ADR 0024. Exact key-parity checks reject
missing, extra, empty, duplicated-source, or unmarked messages. Tests cover ordered browser preferences,
English fallback, persisted-choice precedence, unavailable preferences and storage, stable direct localized
entry, ordinary-link switching, localized metadata, truthful status, artifact inventory, `/updates/`
preservation, and exact public-route verification. Both generated documents pass automated accessibility
analysis. Browser review at wide and 390-pixel viewports covers English and Spanish expansion, light and
dark appearance, complete assets, and zero page-level horizontal overflow. The integral fast lane passes
135 automation tests, 77 presentation tests, two updater tests, 171 host and infrastructure tests, 64
application tests, six domain tests, and two private acceptance tests; documentation, workflow, build,
format, repository-content, and secret checks are also green.

**Hosted accepted evidence:** source `3c1fceaa0bbf3af88872c4c645a07622f0b85b50` passed the
[product-site publication](https://github.com/purnalica/fitfreed/actions/runs/32161349157). The workflow
generated and deployed both locale surfaces as one artifact, preserved the language-neutral update
boundary, and verified every hosted byte at the canonical HTTPS origin. Direct requests to `/` and `/es/`
return the declared `en-US` and `es-ES` documents with reciprocal language metadata and truthful localized
content. Repository safety passed independently for the same source revision.

### E3 — Sports and session discovery

**User value:** a person can locate a remembered workout and understand the shape of their sports history.

**Precondition:** FR-026 and ADR 0021 establish the accepted sport-classification path. Opaque provider references are never displayed as invented sport names.

**Execution slices:**

1. Deliver detected-sport coverage and persistent user classification through domain invariants,
   compare-and-save storage, application read models, localized editing, restart, and reimport evidence.
2. Replace bounded-year summary loading as the discovery path with indexed full-history pagination,
   combinable date, sport, measurement, and text filters, stable sorting, and exact accessible results.
3. Add chronology and calendar views, comparison selection, complete workspace restoration, session
   navigation and return, full-scale performance evidence, and the packaged bilingual journey.

Each slice remains executable from the ordinary application. A lower-layer contract without its observable
user outcome is not an accepted E3 increment.

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

**Slice 1 local accepted evidence:** detected sport groups now span the complete canonical training library,
preserve origin separation, expose only opaque presentation references, and distinguish classified, unknown,
and source-unavailable evidence. A user can assign a broad localized family, add an optional personal label,
amend it, cancel an edit, or explicitly return it to unknown. Compare-and-save revisions reject stale editors,
while the save response returns the application-owned refreshed ordering instead of duplicating it in the
renderer. SQLite schema 12 migrates atomically, uses the sport-discovery index, and preserves authored values
through restart, exact reimport, and cumulative reimport. Domain, application, persistence, transport, JSON
Schema, bilingual component, accessibility, and packaged macOS WebView tests pass. The packaged journey also
proves English-to-Spanish editing and restoration after a process restart. This evidence accepts slice 1 only;
it does not accept the session-search, alternative-view, or navigation slices.

**Slice 2 local accepted evidence:** a distinct provider-neutral discovery port now searches the complete
canonical training library with inclusive date, opaque sport, authored-label, and combined measurement
filters; four deterministic orders; exact source-separated summaries over the complete filtered result; and
bounded 25-session pages. Session, sport, and snapshot capabilities expose no provider or persistence
identity. SQLite schema 13 adds indexed duration and distance traversal plus a mutation revision that keeps
count, summaries, classification context, and page inside one coherent read transaction and rejects a stale
next page. The application validates every request and persisted result before transport, including exact
summary coverage and missing-value invariants.

The localized session library enters every filter, exercises every sort, clears and restores results, opens
lightweight exact detail, reports empty and failed states, and restarts coherently after a simulated library
change. The complete portable lane passed documentation, schema 1–13 migration, architecture, localization,
85 React, 177 host, 73 application, and nine domain tests together with strict formatting and Clippy. The
packaged functional journey passed combined sport, text, date, distance, energy, and heart-rate filtering,
source summaries, missing measurements, detail, reimport, restart, both locales, 200% content zoom, and
automated accessibility. A second packaged process used an independent generated library to prove exact
forward and backward pagination over 731 sessions and every applicable interaction budget. This evidence
accepts slice 2 only; chronology and calendar views, comparison selection, complete workspace restoration,
and destination-aware session return remain in slice 3.

**Slice 3 local accepted evidence:** chronology and a source-separated local-date calendar now project the
same complete-history filters and coherent discovery snapshot. A person can move across bounded months,
open a populated day, compare two through four sessions selected across pages, inspect lightweight exact
detail, and return to the complete chronology or exact calendar origin. The detailed workspace persists the
applied query, page, view, month, selected day, ordered comparison, and open session; restart resolves those
opaque capabilities against the same snapshot, while library changes retain valid query intent and discard
stale session-specific evidence. Explicit return to Home clears both resumable workspaces.

SQLite schema 14 adds the constrained disposable workspace and an atomic direct migration from version 13.
Versioned search, calendar, selection, workspace, and persistence contracts have independent synthetic
validation. The packaged bilingual journey proves calendar and chronology switching, day selection,
comparison, origin-specific return, durable restart restoration, explicit clearing, and 200% layouts;
application tests prove stale-snapshot selection clearing. Its separate 731-session process measures calendar
navigation at 39 ms p95 against the 500 ms budget and selects four exact sessions. The release read-model
campaign over 14,612 sessions measures a page at 7.369 ms p95,
a calendar month at 2.951 ms p95, and ordered four-session resolution at 11.006 ms p95. This accepted the E3
local checkpoint; its executable boundary was later included in the hosted acceptance recorded by the
[public-release readiness ledger](../testing/public-release-readiness.md). Evidence-complete routed and non-routed
session destinations and their cross-workspace navigation continue in E4, while report-origin navigation
continues in E5.

### E4 — Evidence-complete session inspection

**User value:** opening a session answers “what happened?” rather than repeating its summary row.

**Precondition:** FR-025 and ADR 0021 define the accepted deep-session scope.

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

**Recorded-structure slice local accepted evidence:** schema 15, adapter version 7, mapping-set version 2,
and training mapping version 2 preserve the evaluated exercise collection, source/manual laps, automatic
laps, and pauses as typed provider-neutral children. Absent, present-empty, populated, and not-yet-evaluated
states remain distinct. Whole-record reconciliation creates, enriches, amends, preserves, or conflicts the
summary and its children atomically; reimporting identical bytes from the previous mapping reassesses and
enriches the existing session without duplicate children. Exercise-only sport references in mixed sessions
remain distinct opaque unknowns; this slice neither invents a label nor exposes the source value.

The versioned canonical, mapping, provider, persistence, query, response, architecture, user, and performance
contracts pass their synchronized checks. The complete fast lane passed 135 automation tests, 90 React
tests, 181 host tests, 85 application tests, and 12 domain tests with strict Clippy and formatting. The
production `.app` and DMG exclude test instrumentation. The packaged bilingual journey proves one and
multiple exercises, mixed sports, exact laps, pauses, absent measurements, mapping-aware reimport, restart,
200% zoom, keyboard semantics, and automated accessibility. The release read-model campaign over 14,612
sessions measured exact structure retrieval at 7.144 ms p95 against the 500 ms budget. The five-GiB import
campaign passed at 14.692 s first-import p95, 90.272 ms exact-repeat p95, 1.356 ms paired-query p95, and
33.703 MiB maximum resident memory. This accepts only the recorded-structure vertical.

**Route slice local accepted evidence:** schema 16, adapter version 8, mapping-set version 3, and training
mapping version 3 preserve independent primary and transition routes and every ordered waypoint below the
same provider-neutral exercise identity. Unevaluated, absent, present-empty, zero-point, one-point, and
populated states remain distinct. Exact reimport from mapping version 2 enriches the existing session without
duplicate routes or points, while invalid coordinates and elapsed ordering fail before visibility.

The session workspace now draws an endpoint-preserving selection of at most 400 exact source points with
local SVG, makes no tile or geocoder request, identifies route kind without relying on color, and exposes
every original coordinate through stable 100-row UI pages backed by a 250-row application maximum. The
packaged bilingual journey proves primary and transition presentation, privacy disclosure, visual-to-table
parity, exact-point opening and closing, localization, 200% layout coverage, restart, keyboard semantics, and
automated accessibility. The complete fast lane passed 135 automation tests, 90 React tests, 182 host tests,
91 application tests, and 13 domain tests with strict Clippy and formatting.

The local Apple Silicon read-model campaign stored one million independently generated route points. The
bounded 400-point overview measured 7.303 ms p95 and the 250-point exact page measured 12.167 ms p95 against
the 500 ms budget, with 21.391 MiB peak process memory for the complete campaign.

**Temporal-signal slice local accepted evidence:** schema 17, adapter version 9, mapping-set version 4, and
training mapping version 4 preserve independent exercise and transition collections, seven exact kind/unit
pairs, source order, interval, unsupported-series counts, and every value or unavailable slot. Unevaluated,
absent, present-empty, populated, unsupported, and gapped states remain distinct. Reimport of identical bytes
from mapping version 3 enriches the existing session without duplicate series or samples; invalid intervals,
units, values, ordinals, or elapsed-time overflow fail before visibility.

The session workspace draws an endpoint-preserving selection of at most 300 exact source slots per series,
splits local SVG traces at source gaps, distinguishes exercise and transition signals without relying on
color, discloses unsupported series, and exposes every original value or null slot through stable 100-row UI
pages backed by a 250-row application maximum. The packaged bilingual journey proves supported and
unsupported series presentation, gap visibility, visual-to-table parity, exact-sample pagination,
localization, 200% layout coverage, restart behavior, keyboard semantics, and automated accessibility. The
complete fast lane passed 135 repository-automation tests, 90 React tests, 183 host tests, 97 application
tests, and 14 domain tests.

The local Apple Silicon read-model campaign stored 400,000 independently generated signal samples. The
bounded 300-sample overview measured 7.873 ms p95 and the 250-sample exact page measured 9.021 ms p95 against
the 500 ms budget, with 22.422 MiB peak process memory for the complete campaign. The packaged WebView
campaign against a 20,001-slot source series measured 113 ms p95 for detail through laid-out chart and 35 ms
p95 for the exact 100-row page.

**Reusable-segmentation slice local accepted evidence:** schema 18 introduces reusable personal criteria and
ordered exercise applications without persisting derived results as source facts. The version-1 domain and
application contracts validate optimistic revisions, equal elapsed-time, equal recorded-distance, recorded
heart-rate-range, and manual elapsed-boundary rules. Exact reimport retains personal definitions; mapping
enrichment or a later source revision recalculates them against current evidence while retaining an
application only for the same source exercise identity. Missing, ambiguous, incomplete, out-of-session,
too-large, zero-match, and source-gap outcomes remain distinct.

The session workspace identifies criterion authorship and FitFreed-derived attribution, keeps source laps
independent, and provides a bounded timeline plus an exact semantic table. It accepts real values, rejects
invalid drafts, and supports create, configure, reuse, reorder, and remove operations in both locales. The
packaged journey proves multiple criteria, invalid input, exact boundaries, ordering, an enriching reimport,
localization, evaluation-version disclosure, 200% layout, and restart restoration. The complete fast lane
passed 135 repository-automation tests, 95 React tests, 184 host tests, 105 application tests, 18 domain
tests, and two private acceptance tests with strict Clippy and formatting. The local read-model campaign
recalculated a heart-rate criterion by streaming 100,000 exact source slots at 23.889 ms p95 against the
500 ms budget; the complete campaign used 22.797 MiB peak process memory. At that checkpoint, E4 continued
with recorded zones, provenance presentation, and progressive cross-signal inspection.

**Recorded-zone slice local accepted evidence:** schema 19, adapter version 10, mapping-set version 5, and
training mapping version 5 preserve independently evaluated exercise zone collections. Supported heart-rate,
speed, and power groups retain their canonical units, source order, exact bounds, and only the applicable
recorded time, distance, or muscle-load aggregates. Unevaluated, absent, present-empty, populated,
unsupported-group, unavailable-aggregate, zero, and not-applicable states remain distinct. Unsupported source
vocabulary and values do not cross the anti-corruption boundary. Reimport of identical bytes from mapping
version 4 enriches the existing session without duplicate groups or zones, while invalid shapes, bounds,
units, counts, and kind-specific aggregates fail before visibility.

The session workspace presents each source group as aggregate evidence with an accessible distribution and
exact table. It does not invent a timeline, lap, phase, or relationship to FitFreed-derived segmentation. The
packaged bilingual journey proves all three supported kinds, missing and kind-specific aggregates,
unsupported-group disclosure without provider tokens, mapping-aware amendment, restart, 200% layout,
keyboard semantics, and automated accessibility. The complete fast lane passed 135 repository-automation
tests, 98 React tests, 185 host tests, 110 application tests, 19 domain tests, and two private acceptance tests
with strict Clippy and formatting. Packaged update replacement and forced recovery also passed against schema
19.

The local Apple Silicon read-model campaign stored the maximum supported 65,536 independently generated
zones across four sessions. Complete exact retrieval measured 20.846 ms p95 against the 500 ms budget; the
complete campaign used 26.297 MiB peak process memory. E4 remains active for complete provenance
presentation and progressive cross-signal inspection.

**Session-provenance slice local accepted evidence:** the versioned query and response contracts expose an
on-demand, privacy-bounded account of how a training session entered and evolved in the local library. The
application contract accepts validated provider-neutral source codes, while the Polar Flow adapter maps its
own provider, adapter, and training-mapping versions. Stable oldest-first pages retain create, equivalent,
enrich, and amend contributions; preserve and conflict remain visible without being misrepresented as
current contributors. The result reports complete contributor and non-contributor counts and derives current
attribution from the latest contributing event.

The session workspace loads this history only when requested, presents ten exact events per page, supports
retry and reversible pagination in both locales, and resets stale state when the selected session or library
snapshot changes. Archive names, package or content digests, provider identifiers, source-subject evidence,
operation identifiers, and local paths remain outside the transport contract and interface. The mapping-aware
integration journey proves an initial create under training mapping version 4 followed by enrichment under
version 5 without duplicate sessions, while the packaged bilingual journey proves disclosure, navigation,
localization, restart, keyboard semantics, and automated accessibility.

The complete fast lane passed 135 repository-automation tests, 101 React tests, 186 host tests, 116
application tests, 19 domain tests, and two private acceptance tests with strict Clippy and formatting. The
local Apple Silicon read-model campaign stored one event for each of 14,612 independently generated sessions.
Stable provenance retrieval measured 6.381 ms p95 against the 500 ms budget; the complete campaign used
27.734 MiB peak process memory.

**Cross-signal slice local accepted evidence:** the established version-1 signal overview now also supports
selection of two through four recorded series from one exercise and one role. Each series retains a labeled
kind, source order, unit, range, coverage, and independent vertical scale while all lanes share one stable
elapsed-time axis. Primary and transition evidence remain separate. Missing values split traces, no value is
interpolated or normalized into an undisclosed common unit, and visual co-occurrence does not assert
causation. Every selected lane opens the existing exact paginated sample evidence.

No new persistence or application read model was introduced: the presentation composes the bounded,
validated overview and exact-sample use case already owned by E4. Component and packaged bilingual journeys
prove the default three-series selection, two-through-four selection limits, gap preservation, stable axis,
localized controls and units, direct exact-sample access, 200% layout, keyboard operation, and automated
accessibility. The performance archive contains four independently generated primary series of 20,001 slots
each. Its packaged WebView campaign measured the complete four-chart and four-lane detail at 62 ms p95
against the 1-second budget and the exact 100-row page at 157 ms p95 against the 500 ms budget. The gate
exposed a scan-amplifying SQLite join order before acceptance; selected ordinals now drive indexed point
lookups instead of weakening the scenario or budget.

The complete fast lane passed 137 repository-automation tests, 105 React tests, 186 host tests, 116
application tests, 19 domain tests, and two private acceptance tests with strict Clippy and formatting.
Packaged update replacement and forced recovery also pass against the resulting executable. This completes
the E4 checkpoint; its executable is included in the exact hosted fingerprint accepted with the third E5
vertical.

### E5 — Personal report authoring and export

**User value:** a person can turn an exploration into a reusable, portable result.

**Precondition:** FR-005 and ADR 0022 define the accepted report scope and export format; implementation waits only for authoritative application queries required by each selected block.

**Delivery sequence:** E5 started with a session-origin vertical that persists a versioned report containing
resolved session evidence and user narrative, reopens it after restart, reviews its included sensitive
content, and exports deterministic self-contained HTML. This proves the durable model, authoritative query,
SQLite, transport, editor, and output-adapter boundaries through one immediately useful artifact. The next
two slices added route composition and the accepted finding, comparison, chart, exact-table, and
coverage-and-limitation family. The fourth slice added question, exploration, and blank starts. The fifth
slice added deliberate refresh. The final slice completed origin-aware return.
Each slice remains runnable and documented. E5 acceptance required the complete FR-005 journey to pass.

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

**First vertical local checkpoint:** the version-1 definition contains one authoritative session-evidence block
and one plain-text narrative block. Domain and application tests protect invariants, authorship, optimistic
edits, current and stale resolution, sensitivity reduction, authorization, and cancellation. SQLite tests
cover atomic v19 migration, multiple definitions, ordering, edit conflict, restart, non-destructive reimport,
and incompatible-row retention. Presentation tests exercise real field input, validation, creation, editing,
reopening, privacy review, destination cancellation, adapter failure, stale export blocking, exact return, and
both locales. The packaged macOS journey creates and reopens the report, independently reads the exported
HTML, reimports new evidence, verifies stale behavior after restart, and passes the complete packaged
performance campaign. This was an evaluable checkpoint rather than E5 completion.

**Route-composition local checkpoint:** version 2 adds ordered route blocks while preserving version-1
definitions as immutable readable evidence. A route block is bound to the selected session and authoritative
route identity, carries a saved endpoint-redaction distance, and can be added, configured, reordered, removed,
saved, reopened, and previewed alongside the session and narrative blocks. SQLite schema 21 migrates version-20
libraries atomically without rewriting existing definitions. Export review can omit each route or increase its
redaction, but cannot disclose more than the saved definition; the generated HTML contains only a normalized
local SVG shape and never recorded latitude or longitude values. Contract, domain, application, persistence,
transport, component, HTML, migration, and packaged macOS tests protect these boundaries. The complete fast
lane, strict Clippy, production build, packaged functional journey, and packaged performance campaign pass
locally. At this incremental checkpoint, the other accepted block types, start paths, deliberate refresh,
and complete report-origin navigation were not yet claimed.

**Training-period comparison implementation checkpoint:** version 3 adds finding, comparison, chart,
exact-table, and coverage blocks as five independently selectable and reorderable views of one versioned
question. The user chooses both inclusive periods and the finding and chart measurements. Domain invariants
prevent mixed queries or duplicate analytical kinds; creation, resolution, and export rerun one authoritative
training comparison with snapshot checks around it. SQLite schema 22 stores only intent and migrates
version-21 reports atomically. Strict transport and public JSON schemas, the bilingual editor and preview,
visible exact alternatives for charts, privacy review, and deterministic bilingual HTML preserve exact
values, missing measurements, coverage, source separation, attribution, and descriptive-only limitations.
Domain, application, persistence, migration, transport, component, contract, and independent HTML tests,
the complete fast lane, strict Clippy, production build, packaged functional journey, and packaged performance
campaign pass locally. A dedicated production read-model benchmark resolves all five views over two 365-day
periods and four source-separated histories at 26.888 milliseconds p95 against a 500-millisecond budget.
The same executable-input fingerprint passed the complete
[hosted campaign](https://github.com/purnalica/fitfreed/actions/runs/32257914407): portable quality checks,
private release preparation, cold launch, full-scale import, Insights performance, update-recovery
preparation, installation boundaries, the instrumented packaged journey, and packaged update replacement
and forced recovery.

**Multi-origin start local checkpoint:** version 4 gives every accepted entry path one durable workflow.
Question starts derive conservative adjacent periods from the current training range; exploration starts
retain the exact completed comparison query; blank starts persist authored narrative without claiming data
evidence and can add analysis later; session starts retain their recorded-evidence boundary. The shared
definition records its typed origin and never invents a provider, session, or provenance for a non-session
report. SQLite schema 23 migrates older definitions without rewriting them and constrains every origin shape.

Domain, application, persistence, migration, transport, public-schema, component, HTML, and navigation tests
cover creation, editing, exact-query retention, authored-only provenance, later analysis from a blank start,
multiple saved reports, restart, and exact comparison return. The complete fast lane passed 137 automation
tests, 121 React tests, 206 host tests, 135 application tests, 32 domain tests, strict Clippy, formatting,
and the production build. The packaged
macOS journey created session and exploration reports, returned to the exact comparison, reopened both after
restart, and independently verified the exported output. The packaged performance campaign passed every
500-millisecond common and 2-second maximum p95 budget; its slowest measured interaction was 113
milliseconds locally.

The exact fourth-slice executable-input fingerprint subsequently passed the complete
[hosted campaign](https://github.com/purnalica/fitfreed/actions/runs/32280636479), including portable quality
checks, private release preparation, cold launch, full-scale import, Insights performance, update-recovery
preparation, installation boundaries, the instrumented packaged journey, and packaged update replacement
and forced recovery.

**Deliberate-refresh local checkpoint:** a stale saved report exposes one current candidate for explicit
review without fabricating historical canonical values that the library does not retain. The review names
the saved and candidate revisions, distinguishes preserved authorship, origin, layout, and provenance policy
from recalculated evidence, and permits cancellation without a write. Confirmation is bound to the exact
saved revision and reviewed candidate snapshot; a concurrent edit or another library change fails without
mutation. A successful refresh changes only the evidence snapshot and revision, then re-enables editing and
privacy-reviewed export.

Domain, application, persistence, transport, public-schema, component, localization, documentation, and
contract tests protect idempotence, every report origin, exact candidate review, optimistic conflicts,
restart, cancellation, and export. The complete fast lane passed 137 automation tests, 122 React tests, 207
host tests, 139 application tests, 33 domain tests, and two private-acceptance tests. Strict Clippy, formatting,
the production build, repository-content inspection, and diff checks passed. The packaged macOS journey
imported amended evidence, identified the affected report as stale, reviewed and cancelled the candidate,
confirmed the same exact candidate, preserved authored content, reopened revision 2, and independently read
its provider-neutral version-4 HTML export. It also retained an unaffected stale report, preserved and then
explicitly cleared resumable exploration across restart, and passed Axe without violations. The isolated
two-year packaged performance campaign passed every budget; its slowest p95 interaction was 126 milliseconds
against the 2-second maximum-interaction budget. This checkpoint preceded the final report-origin navigation
slice and was accepted with it by the final E5 campaign.

**Origin-aware navigation local checkpoint:** a transient report start returns to its still-mounted session
or comparison and restores the initiating control. A reopened saved report derives only an exact typed source
from its resolved definition: a current session capability or the complete versioned comparison query. The
source action opens that exact evidence, restores keyboard focus to its heading, and offers **Back to report**
for the same saved definition. Blank reports invent no source. These visits neither overwrite nor clear the
independent resumable exploration destination, and no report, provider identity, result, or navigation
snapshot is added to SQLite.

Mapping, component, application-shell, localization, documentation, and packaged acceptance tests protect
session, exploration, question, and blank origins; exact queries and session identities; missing-source
behavior; both directions of navigation; focus restoration; explicit user focus changes; reimport; restart;
and resumable exploration. The complete fast lane passed 137 automation tests, 133 React tests, 207 host
tests, 139 application tests, 33 domain tests, two private-acceptance tests, and the bounded updater tests.
Strict Clippy, formatting, production build, repository-content inspection, and diff checks passed. The
rebuilt macOS package completed the full functional journey in both locales and the isolated two-year
performance campaign. Every interaction met its budget; the slowest p95 was 507 milliseconds against the
2-second maximum-interaction budget. The final E5 executable-input fingerprint subsequently passed the
complete hosted acceptance recorded in the [public-release readiness ledger](../testing/public-release-readiness.md).

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
8. After every planned E6 correction and its internal evidence are complete, run an independent product-experience audit from a clean first-run perspective. The audit must not assume that milestone status, green tests, or the accepted prototype prove the production experience. It evaluates the real application screen by screen, records every material finding, and reopens the MVP for any issue that prevents a person from understanding the promise, reaching useful evidence, or wanting to continue within the first minutes.

**Acceptance evidence:** all scoped requirements link to passing unit, integration, presentation, layout-conformance, packaged E2E, accessibility, localization, performance, installation, update-recovery, documentation, repository-safety, and privacy evidence for the same executable-input fingerprint. The independent product-experience audit is a separate closing gate and may invalidate that internal acceptance.

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
| Public promise or product direction | `product-thesis.md` for the argument, `requirements.md` for the promise, `product-status.json` for the public status snapshot, and generated audience-specific entry surfaces |
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
| Independent post-plan audit | Clean first run, first import, returning exploration, session detail, report, Sources, and Settings in the real application | Whether the product earns continued attention and whether internal evidence missed any material usability, visual-hierarchy, trust, or coherence defect |

Durable architectural choices receive ADRs when selected, not speculative ADRs for every candidate. Evaluation feedback changes canonical requirements before implementation scope changes.

## Autonomous execution and human gates

Implementation proceeds without routine confirmation through accepted increments, focused commits, privacy scans, and normal fast-forward pushes to `origin/main`.

Human intervention is required only for:

- accepting a material change to platform, privacy, licensing, or product behavior;
- authorizing a dependency with unresolved license or supply-chain risk;
- Apple Developer, production signing, protected-environment, tag, release, application-download, update-channel, or public-release publication authority; product-site Pages publication is already authorized under P1;
- destructive real-library operations; and
- final human usability or accessibility acceptance that cannot be automated.

If a human gate is temporarily unavailable, work continues on independent accepted increments, tests, documentation, synthetic fixtures, or technical evidence. SSH unavailability delays synchronization only; it does not stop local verified work.

## Completion rule

This plan is complete only when the accepted experience works as one release-shaped journey, every included UI capability has real lower-layer support, navigation restores origin context, report output is reproducible and portable at the selected boundary, all affected data contracts are public and verified, user and developer documentation match the candidate, the exact executable-input fingerprint passes its applicable quality gates, and the subsequent independent product-experience audit has no unresolved material finding.

A mockup, attractive dashboard, source parser, database migration, report library, chart, map, exported file, or green lower-level test is not independently sufficient completion evidence.
