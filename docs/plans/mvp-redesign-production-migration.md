# MVP Redesign Production Migration Plan

## Status and authority

Authorized for autonomous execution as of 2026-08-21. The independent R5 checkpoint audit completed on
2026-08-22 and reopened X5-R3 and X5-R5 before X5-R6. Its immutable findings are recorded in the
[R5 checkpoint audit](../research/mvp-redesign-r5-checkpoint-audit.md).
The X5-R1 product entrance is live and its CI resource policy is covered by the current hosted
portable checks. The product owner accepted the X3 direction and its amendments on 2026-08-21. This
document is the single implementation-facing plan for X4 and X5 of the systemic MVP redesign.

### Current execution snapshot

Updated 2026-08-26. X4-P0 and X5-R1 through X5-R10 retain their engineering evidence. The renewed X6 machine-assisted
[product-experience reaudit](../research/mvp-product-experience-reaudit.md) has no unresolved critical or major
finding after two TDD corrections. Exact [repository-safety run
`32743509862`](https://github.com/purnalica/fitfreed/actions/runs/32743509862) and [hosted campaign
`32743509696`](https://github.com/purnalica/fitfreed/actions/runs/32743509696) pass for corrected source `246faed`.
The campaign passes the portable lane, every performance and lifecycle gate, the complete functional package,
native replacement, deliberate candidate rejection, exact recovery, and the immutable evidence-marker job for
executable-input fingerprint `3e0c2eb1dddc33cd295c8b6b504650b32e392589d396b7f835f53dec4f68e9d8`.
The portable job completed in 4 minutes and 27 seconds and the macOS job in 1 hour, 3 minutes, and 27 seconds;
the bounded 75-minute allowance remained sufficient without changing an operation watchdog,
product-performance budget, or acceptance criterion. The first human session then exposed an evaluation-process
defect: the documented launch used the instrumented E2E application, whose mocked native boundaries make it
invalid for archive-picker and external-link evaluation. A revision-isolated production-native profile corrected
that boundary. Exact [repository-safety run
`32827945310`](https://github.com/purnalica/fitfreed/actions/runs/32827945310) and [hosted campaign
`32827945185`](https://github.com/purnalica/fitfreed/actions/runs/32827945185) pass for source `41ffad2`.

The completed repeated [production-native human evaluation](../research/x6-product-experience-human-evaluation.md)
still rejects the product experience. X6-C1 through X6-C5 retain their verified engineering corrections, but real use
reopened external destination completion, resource-limit explanations, progress responsiveness, sport recognition,
and sport-level drill-down. The wider review also established material Settings, empty-state, number grouping,
duration precision, comparison-default, route-zoom, structured-training, table-alignment, information-density,
charting, and report-reuse findings. These findings contradict product-experience acceptance without invalidating
lower-layer safety, data-preservation, lifecycle, or already measured performance evidence.

The first exact hosted campaign after those corrections reached every native product gate for source `23631be` before
the Insights benchmark rejected self-contained maximum-route HTML export at 2,057.706 milliseconds p95 against the
unchanged 2,000-millisecond budget. [Repository-safety run
`32898559229`](https://github.com/purnalica/fitfreed/actions/runs/32898559229) passed; [hosted campaign
`32898559348`](https://github.com/purnalica/fitfreed/actions/runs/32898559348) remains a failed result and created no
executable evidence marker. Root-cause tracing found that both bounded-memory endpoint-redaction passes retrieved
the 250,000-point route in 10,000-point pages through positional `OFFSET`; later pages repeatedly discarded every
preceding row. Exact route pagination now seeks from its contiguous source ordinal through the existing composite
index. A controlled local Apple Silicon comparison against unchanged source `23631be` reduced route-report resolution
from 729.691 to 442.691 milliseconds p95, self-contained export from 735.299 to 447.263 milliseconds p95, and a deep
exact page from 15.539 to 6.606 milliseconds p95. The complete fast, Rust lint, Rust format, packaged functional,
restart, adaptive-session, and performance gates pass for the corrected tree. Correction `31751b2` then passed exact
[repository safety `32904901418`](https://github.com/purnalica/fitfreed/actions/runs/32904901418) and the complete
[hosted campaign `32904901151`](https://github.com/purnalica/fitfreed/actions/runs/32904901151). Hosted route-report
resolution measured 766.714 milliseconds p95, self-contained export 698.089 milliseconds p95, and a deep exact page
10.784 milliseconds p95. The portable job completed in 4 minutes and 23 seconds, the macOS job in 53 minutes and
20 seconds, and the immutable marker records executable-input fingerprint
`81de4cd9104612488f7eab6c84bfa95cb5a3afdb0a801b237f44cf6e77d4e793`. This closes the corrected exact-source
automation gate without changing a product budget. It does not close findings that the hosted campaign did not
exercise or make perceptible to a person. X7 below owns the post-review corrective sequence, including the newly
confirmed FR-027 structured-training vertical and FR-005 report-example and duplication contracts. External-tile
cartography, additional providers, advanced personalization, and public-candidate work stay outside this sequence.

The [increment status](#increment-status) gives the one-line phase view. The
[R10.2 evidence matrix](#r102-evidence-matrix) records what has been verified and what remains, and
[X6](#x6--repeat-the-independent-product-experience-audit) defines the final independent audit.

The [MVP experience specification](../design/experience-specification.md) owns screen, interaction,
state, navigation, adaptive, localization, and accessibility behavior. The
[UI and UX redesign plan](ui-redesign.md) owns the design method, rationale, and gates. The
[original MVP experience delivery plan](mvp-experience-delivery.md) remains immutable engineering
and evidence history for D0 through E6; it is not edited into a fictional record of the redesign.
This plan maps that implemented baseline into small production migrations without creating another
executable or a second product path.

The ordinary application does not yet conform to the accepted experience merely because the design
contract and prototype do. Each increment below becomes current product behavior only after its own
code, data, test, documentation, and release-shaped gates pass.

Reports and personal range definition remain **Alpha UX** throughout this plan. Alpha permits
substantial later interaction and composition refinement; it does not relax identity, persistence,
authorship, provenance, safety, export, accessibility, localization, or recovery guarantees.

## Outcome

Transform the implemented technical MVP into one coherent experience that earns attention quickly,
makes a person's sports history recognizable, makes outdoor-session investigation exceptional, and
keeps exact evidence and data exit under the person's control.

The production journey at completion is:

> understand the local product → obtain or choose an export → import without risking the existing
> library → see what became useful → find a remembered session → investigate its visual story →
> define personal meaning when useful → create, reopen, and export a durable report

This is a presentation migration only where the existing application contract is sufficient. Where
the accepted experience requires a composed result or durable user object that does not yet exist,
the increment starts in domain and application layers and reaches production UI only after the lower
boundary is verified.

## Scope boundary

### Included

- The accepted five-workspace shell: Home, History, Reports, Sources, and Settings.
- First run, source acquisition, archive selection, import progress and outcomes.
- Result-led Home, conservative questions, contextual activity, sleep, recovery, training, and
  aligned-history answers.
- Structured full-history discovery, sport identity, classification, filters, chronology, and
  comparison.
- Evidence-dependent session stories, including a dominant interactive local route workbench,
  conditionally synchronized evidence only when an exact recorded relationship exists, independently
  explorable regular signals otherwise, source structure, zones, provenance, exact alternatives,
  partial sessions, and non-routed sessions.
- Reusable personal segmentation and session-owned, user-named contiguous ranges.
- Result-first report library, curated evidence-aware examples, contextual creation, independent duplication,
  composition, deliberate refresh, privacy review, deterministic self-contained HTML export, and deletion.
- Imported structured training objectives, phases, blocks, repetitions, and constraints, kept distinct from recorded,
  calculated, and user-authored session structure.
- A shared data-presentation contract for precision, grouping, tabular alignment, progressive disclosure, and mature
  offline analytical charts with exact accessible alternatives.
- `en-US` and `es-ES`, system/light/dark appearance, 100%–200% content zoom, reduced motion, WCAG 2.2
  AA and WCAG2ICT behavior, privacy, performance, documentation, packaging, and update regressions.
- Early truthful renewal of the public product site and repository entrance.

### Excluded

- Additional providers, provider APIs, MCP, Linux, Windows, public application downloads, signing,
  notarization, production update-channel activation, and public-release publication.
- External map, tile, geocoding, routing, or telemetry requests. Recorded location remains on the
  current device.
- Invented place names, inferred samples, hidden interpolation, provider-sport guesses, medical
  conclusions, recommendations, gamification, or promotional claims unsupported by the library.
- A free-form publishing system, generic dashboard builder, community report-template exchange, reusable
  route-segmentation rules, or a second saved-view/saved-answer library.
- Curated themes beyond system, light, and dark appearance, and advanced appearance personalization. These remain on
  the post-MVP experience-personalization track.
- Functional expansion beyond the accepted FR-005, FR-025, FR-026, and FR-027 boundaries.

## Verified production baseline and missing contracts

The inventory below is derived from the current application commands, DTOs, use cases, domain
aggregates, SQLite adapters, React surfaces, architecture documents, and their retained tests. A UI
increment must verify the named lower layers again before changing its surface.

| Accepted experience need | Reusable implemented support | Missing production contract | First owner |
|---|---|---|---|
| Five stable workspaces and settings | `ApplicationShell`, typed homes, persisted language, appearance, and zoom | Accepted hierarchy, density, adaptive labels, first-run composition, and exact return behavior | Presentation |
| Source acquisition and safe import | Provider guide, native chooser, transactional import, progress, cancellation, coverage, repeated and extended import | Calm outcome hierarchy and direct value handoff | Presentation and Library Home application use case |
| Recognizable Home | Library Home v1 coverage, questions, post-import reveal, resumable destination | Recent recognizable sessions and sports, one bounded answer, and honest historical fallback | Application composition |
| Contextual answers | Four authoritative Insights models and longitudinal composition | Accepted Answer Canvas hierarchy and origin restoration | Presentation |
| Full-history discovery | Search, selectors, sorting, calendar, comparison selection, durable workspace, and sport classification | Results-first composition, coherent icons, structured refinements, and accepted navigation | Presentation |
| Evidence-backed sport identity | Versioned provider-catalogue aggregate, recognition precedence, durable personal override, and opaque source references | Import the available source vocabulary, establish only authoritative joins, keep unresolved granularity honest, and open represented sessions from every sport summary | Source adapter, application composition, then presentation |
| Outdoor session investigation | Independent structure, route, signal, zone, segmentation, and provenance queries | One revision-coherent session-story projection with conditional exact-recorded route/signal interaction and explicit separation otherwise | Application composition, then presentation |
| Partial and non-routed sessions | Explicit unavailable, absent, empty, populated, unsupported, and gap states | Evidence-dependent page composition rather than empty visual placeholders | Application projection and presentation |
| Reusable segmentation | Versioned `SegmentCriterion`, commands, SQLite persistence, and derived sections | Integration into the map-led workbench without merging source and authored identity | Presentation |
| Session-owned ranges | Version-2 exercise-owned domain aggregate, application transitions, SQLite schema 26, and desktop transport | Revision-coherent Range Summary, production interaction, and reusable-criteria integration | Application composition, then presentation |
| Result-first reports | Versioned definitions, typed blocks, multi-origin resolution, staleness, refresh, persistence, privacy review, and deterministic HTML export | Meaningful library projection, report deletion, optional narrative invariant, accepted result-first composition | Domain, application, persistence, presentation |
| Reusable report starts | Contextual report preparation and independent report identities | Versioned built-in example descriptors, prerequisite resolution, use-as-basis, and independent duplication with fresh report and block identities | Application, domain, persistence, presentation |
| Structured training intent | Unsupported source-artifact classification plus recorded exercise, lap, calculated-segment, and personal-range models | Provider mapping, provider-neutral planned-training aggregate, reconciliation, persistence, queries, session relationship rules, result-led presentation, report/export, and complete format contracts | Source adapter, domain, application, persistence, presentation |
| Mature analytical visualization | Semantic HTML charts and local Leaflet route geometry | Reviewed OSS charting dependency, axes, units, scales, gaps, selection, exact alternative, shared-coordinate overlays, bounded route zoom, deterministic report rendering, and accessibility | Architecture decision, presentation adapters, report export |
| Coherent data presentation | Localized formatting helpers and live data tables | Context-specific precision, forced grouping where counts require it, numeric alignment, set-level attribution, and global progressive disclosure | Presentation system, then every live consumer |
| Public entrance | Generated localized Pages artifact, automatic locale selection, manual locale control, and truthful product-status source | Accepted sincere product narrative and new visual hierarchy | Product surfaces |

No field or control may be added on the assumption that the corresponding missing contract will be
implemented later. The table identifies the lower-layer starting point for each affected increment.

## Delivery rules

### What counts as one functional increment

Every runtime increment must:

1. give a person one complete new or materially improved outcome through the ordinary application or
   public product site;
2. preserve every previously completed outcome through the same executable and local library;
3. add required domain, application, persistence, transport, presentation, localization, and
   documentation changes together rather than leaving disconnected layers;
4. remain coherent if all later increments are cancelled;
5. contain no dormant production control, synthetic success state, alternate executable, hidden
   prototype route, or claim about a later increment;
6. pass its focused behavior tests, complete fast lane, production build, privacy checks, and all
   affected release-shaped gates before commit; and
7. produce one focused commit followed by a bounded normal push to `origin/main`.

The ignored prototype is evaluation evidence only. Production code is implemented from the accepted
specification and application contracts, never copied as a parallel source of truth.

### TDD order inside every increment

1. State the observable outcome and affected acceptance rows in the increment notes.
2. Inspect current commands, DTOs, use cases, ports, adapters, schema, and tests.
3. Add failing domain and application tests for missing business behavior.
4. Add failing persistence and migration tests for durable behavior.
5. Implement the minimum lower-layer behavior and refactor under passing tests.
6. Add or update strict host DTO and public-schema contract tests.
7. Add failing React behavior tests using meaningful input, all actions, validation, cancellation,
   multiple items, persistence, reload, and focus behavior.
8. Implement the complete localized, adaptive, accessible presentation outcome.
9. Extend packaged E2E through the real production boundary and assert persisted outcomes after
   restart.
10. Update canonical user, developer, architecture, format, test, and product-status documentation.
11. Run the applicable verification ladder, inspect the actual screen, and run the independent
    falsification checklist before commit.

### Verification ladder

The cheapest authoritative check runs first. Later gates never compensate for an earlier failure.

1. Focused Rust, React, script, schema, and contract tests.
2. Formatting, strict Clippy, TypeScript production build, architecture, data-contract, localization,
   documentation, site, workflow, repository-content, secret, and diff checks.
3. Complete contributor fast lane.
4. Focused performance benchmark when query shape, storage, rendering volume, startup, or export is
   affected.
5. Instrumented packaged macOS functional and accessibility journey whenever executable inputs
   change.
6. Import, dense-history, cold-launch, packaging, installation, update, migration, and recovery gates
   only when their inputs or protected behavior change, plus once for the final exact candidate.
7. Hosted campaign once per distinct executable-input fingerprint; an unchanged fingerprint is never
   rebuilt merely because documentation changed.

Retries, muted errors, disabled strictness, removed assertions, reduced fixtures, or skipped packaged
behavior are not resource optimizations. CI path selection and artifact reuse provide cost control.

### Mandatory UX falsification before each increment closes

The implemented surface is inspected independently of its implementation checklist at:

- wide and short laptop viewports, compact desktop width, and the narrow supported window;
- 100%, 175%, and 200% content zoom;
- English/light and Spanish/dark, including longest realistic content;
- first, empty, loading, populated, partial, stale, invalid, cancelled, failed, and recovery states
  affected by the increment;
- pointer, keyboard, reduced-motion, and screen-reader semantics; and
- initial viewport, complete scrolled journey, focus movement, return, restart, and persisted state.

The pass explicitly looks for wrong hierarchy, excessive numeric density, unreadable precision,
clipping, hidden navigation labels, undersized controls, unnoticed content below the viewport,
obstructed visual evidence, duplicate warnings, marketing language, and functionality that appears
more capable than its evidence. Critical or major findings reopen the increment before review.

## Dependency and delivery map

```mermaid
flowchart TD
    P0[X4-P0 accepted contract and migration plan] --> R1[X5-R1 truthful public entrance]
    P0 --> R2[X5-R2 first-run shell, Sources, and Settings]
    R2 --> R3[X5-R3 import-to-value Home]
    R3 --> R4[X5-R4 contextual Answer Canvas]
    R3 --> R5[X5-R5 History and sport identity]
    R5 --> R6[X5-R6 outdoor session workbench]
    R6 --> R7[X5-R7 evidence-adaptive session story]
    R7 --> R8[X5-R8 personal ranges and segmentation]
    R6 --> R9[X5-R9 result-first reports and export]
    R1 --> R10[X5-R10 whole-product hardening]
    R4 --> R10
    R8 --> R10
    R9 --> R10
    R10 --> A[X6 independent product-experience audit]
    A --> P7[X7-P0 post-review contract]
    P7 --> C71[X7-R1 trustworthy responsive import]
    C71 --> C72[X7-R2 recognizable navigable history]
    C72 --> C73[X7-R3 coherent data presentation]
    C73 --> C74[X7-R4 mature visualization]
    C74 --> C75[X7-R5 structured training intent]
    C75 --> C76[X7-R6 reusable report starts]
    C76 --> C77[X7-R7 whole-product falsification]
    C77 --> A2[repeated X6 human gate]
```

Execution is sequential by default so each increment receives complete local and hosted evidence and
the next increment starts from a known source revision. Work may overlap only when it changes disjoint
non-runtime artifacts and does not obscure the executable-input fingerprint.

## Increment status

| Increment | Status | Functional checkpoint |
|---|---|---|
| X4-P0 | Complete — 2026-08-21 | Accepted X3 contract, exhaustive production plan, traceable roadmap |
| X5-R1 | Complete — current hosted portable checks cover the product entrance and CI resource policy | A truthful visitor can understand and follow the product |
| X5-R2.1 | Complete locally — exact packaged gates passed 2026-08-22 | A new person can orient and act through the labelled shell and first-run Home |
| X5-R2.2 | Complete locally — exact packaged gates passed 2026-08-22 | Sources leads with acquisition, a protected active task, and a calm exact outcome |
| X5-R2.3 | Complete locally — exact packaged gates passed 2026-08-22 | Durable language, appearance, zoom, and update settings form one coherent workspace |
| X5-R3 | Complete locally — R3.1 and R3.2 exact packaged gates passed 2026-08-22 | Import ends in recognizable personal value |
| X5-R4 | Complete locally — exact packaged and exhaustive adaptive gates passed 2026-08-22 | Existing health and aligned-history questions read as answers |
| X5-R5 | Complete locally — R5.4, R5.5, and real-process restart gates passed 2026-08-22 | A remembered session is findable and sports are recognizable |
| X5-R6 | Complete locally — R6.1 through R6.5 passed exact packaged, adaptive visual, and dense-route gates on 2026-08-22; R8.4 subsequently removed unproven route-signal alignment | A routed workout is investigated through a dominant local map without invented relationships |
| X5-R7 | Complete locally — R7.1 through R7.6 passed the exact fast, functional, restart, adaptive, accessibility, visual, and performance gates on 2026-08-22 | Every session composition reflects its actual evidence |
| X5-R8 | Complete locally — R8.1 through R8.6 passed the final Alpha gate on 2026-08-23 | Personal ranges and reusable criteria work end to end |
| X5-R9 | Complete locally — all six slices passed fast, packaged, restart, accessibility, visual, migration, and performance gates on 2026-08-23 | Reports open as results and leave FitFreed safely |
| X5-R10 | Complete — exact local and hosted gates passed 2026-08-24; executable-input evidence marker retained | The complete release-shaped product is coherent and documented |
| X6 | Rejected — the completed production-native review reopened material behavior through XH-23 | Independent audit has no unresolved material finding |
| X6-C1 | Reopened by XH-08 — temporal meaning and provider-neutral identity infrastructure remain valid, but an ordinary archive still yields unknown sports | Sports are recognizable from trustworthy evidence and Home ranges state what they measure |
| X6-C2 | Reopened by XH-01 — visible local outcomes remain valid, but accepted delegation does not prove default-browser appearance | Every successful or failed acquisition action produces a visible, reachable result |
| X6-C3 | Reopened by XH-03 and XH-06 — classification and progress units exist, but resource-limit meaning and runtime responsiveness fail in real use | Import recovery is calm and specific, and long work remains perceptibly active |
| X6-C4 | Reopened by XH-09 — shell operation truth remains valid, but represented sport collections still contain dead ends | Prominent summaries and collections open useful evidence |
| X6-C5 | Reopened by XH-12 through XH-22 — the geometry correction remains valid but does not constitute a coherent data-presentation system | Data is concise, aligned, precise, visual, and progressively disclosed |
| X7-P0 | Complete in working tree — post-review requirements, causes, boundaries, sequence, and gates consolidated | One executable corrective plan owns every accepted finding |
| X7-R1 | Pending | Import guidance, rejection, progress, navigation, and completion remain truthful and responsive |
| X7-R2 | Complete locally — exact represented-sport identity, comparison presets, and the complete natural-drill-down campaign passed 2026-08-26 | Sports are evidence-backed and every represented collection opens its exact sessions |
| X7-R3 | Complete locally — independent density review and exact fast, packaged, accessibility, restart, localization, visual, and performance gates passed 2026-08-26 | Settings and data presentation use clear transactions, meaningful precision, alignment, and disclosure |
| X7-R4 | In progress — production-shaped decision spike passed and ADR 0032 accepted 2026-08-26; production migration remains | Analytical charts and route navigation provide a mature, accessible, bounded visual foundation |
| X7-R5 | Pending | Exported objectives, phases, blocks, repetitions, and constraints survive and become useful |
| X7-R6 | Pending | Relevant built-in examples and duplication make reports understandable and reusable |
| X7-R7 | Pending | Exact local and hosted evidence plus independent falsification leave no material finding |

## X4-P0 — Freeze the executable contract

**User outcome:** implementation can proceed without redesign-by-accident, hidden scope growth, or
repeated routine decisions.

**Work:**

1. Record X3 acceptance and the report/range Alpha boundary in the canonical design documents.
2. Correct compact prototype navigation so every workspace retains visible text.
3. Inventory reusable and missing production contracts across all architecture layers.
4. Define this dependency sequence, verification policy, documentation ownership, and human gates.
5. Link the active plan from the roadmap and redesign plan without rewriting the historical D0–E6
   evidence record.

**Exit evidence:** prototype contract checks; documentation, links, product-surface, repository-content,
privacy, and diff checks; one focused commit and push.

## X5-R1 — Renew the truthful public entrance

**User outcome:** a first-time visitor understands within seconds what FitFreed does, why owned data
matters, what is available now, and why the project is worth following or contributing to.

**Product work:**

1. Recompose the generated product site around concise purpose, recognizable history, outdoor-session
   investigation, reports and export, local processing, current status, and participation.
2. Use sincere factual language. Separate implemented capability, accepted migration work, Alpha
   experience, later roadmap, and unavailable download status visually and semantically.
3. Refresh the repository README as the scan-friendly project entrance; link rather than duplicate
   technical, product, support, and contribution detail.
4. Preserve automatic locale selection with English fallback and manual `en-US`/`es-ES` switching.
5. Preserve the canonical `product-status.json` generation boundary and inactive download boundary.
6. Use only project-owned brand and illustrative assets. Any target-experience visual is explicitly
   identified as a product direction until its production increment lands.

**Tests and evidence:** generated-artifact equality, localized content parity, links, canonical origin,
no redirects, no download leak, 200% layout, narrow/wide layout, light/dark contrast, keyboard order,
automated accessibility, no personal or machine-specific data, Pages workflow preservation of the
update subtree, live deployment, and remote byte verification.

**Documentation:** `site/README.md` remains contributor-focused and excludes DNS-operation history;
product status, README, user links, and contribution links remain generated or canonical at one source.

**Rollback/coherence:** the site remains usable and truthful if application R2–R10 never land; no
future screen is described as current product behavior.

## X5-R2 — Deliver the first-run shell, Sources, and Settings

**User outcome:** a new person can understand the local product, learn how to obtain an export, choose
an archive, and configure durable interface behavior without becoming trapped or reading diagnostics.

**Lower-layer precondition:** verify existing preference, acquisition-guide, archive-picker, official
link, import-concurrency, and update-concurrency contracts. No new persistence shape is expected unless
the verification exposes a real contract gap.

**Production work:**

1. Establish the production visual tokens and reusable shell primitives used by all later surfaces.
2. Implement the five-workspace shell with visible icon-and-text labels at every supported width and
   zoom. Use a labelled compact rail or labelled horizontal navigation; never icon-only navigation.
3. Use the complete desktop workspace rather than a narrow promotional document column.
4. Present the first-run purpose, illustrative multi-sport preview, local-device boundary, no-account
   boundary, ZIP action, and provider-owned acquisition route with restrained language.
5. Recompose Sources around acquisition, import readiness, active operation, outcome history, and
   exact coverage disclosure. Technical detail is deliberate, not repeated across the app.
6. Recompose Settings around explicit save/reset of language, appearance, and zoom with preview,
   recovery of obsolete values, and stable update controls.
7. Preserve actual native archive-picker and official-link adapters in production; instrumented E2E
   adapters remain isolated from ordinary packages.

**Behavior coverage:** every workspace action; direct and return navigation; invalid/stale origin;
all preference values, save, reset, cancel-by-navigation, restart, invalid stored values; both source
paths; picker cancellation and failure; official-link cancellation and failure; import/update mutual
exclusion; keyboard focus and current-location semantics; all locales, themes, and zoom levels.

**Documentation:** first-run, source acquisition, settings, navigation, development preview, module
map, UI contract checks, and contributor component guidance.

**Rollback/coherence:** existing Home, History/Explore, and Reports capabilities stay reachable through
the new shell until their own surfaces are replaced. No duplicate shell or hidden legacy route remains.

## X5-R3 — Turn import into a recognizable Home

**User outcome:** a successful import immediately reveals what history became useful; a later launch
starts with recognizable personal context rather than maintenance controls.

**Application-first work:**

1. Version the Library Home contract without breaking v1 migration evidence.
2. Add bounded recent-session and sport-family projections using authoritative discovery and
   classification ports.
3. Add one conservative bounded comparison or observation selected by explicit availability rules.
4. Add an honest historical fallback when recent evidence cannot support a current comparison.
5. Keep source coverage, import outcome, and answer evidence under one coherent library revision.
6. Preserve explicit added, enriched, amended, unchanged, repeated, unsupported, and invalid import
   semantics without exposing artifact locators.

**Production work:**

1. Lead Home with imported span, session count, recognizable sports, recent sessions, and one bounded
   evidence-backed answer.
2. Lead post-import with what became usable and one useful next action; keep exact incorporation
   coverage one deliberate action away.
3. Present old-history fallback without implying recent performance or wellness.
4. Route recent sessions to their exact current detail identity and questions to the Answer Canvas.
5. Keep absent evidence quiet unless it affects the current result.

**Behavior coverage:** empty library, first import, repeat, extended import, mapping-version reassessment,
multiple origins, old-only history, partial domains, no training, unresolved sport, invalid and failed
archives, cancellation, restart, direct session entry, stale recent identity, and canonical fallback.
Performance covers dense ten-year Home composition and post-import reveal within the common-query budget.

**Data and documentation:** Library Home versioned contract, transport schema, composition architecture,
import lifecycle, user import/result guidance, localization, synthetic fixtures, and product status.

## X5-R4 — Reframe contextual questions as Answer Canvases

**User outcome:** activity, sleep, recovery, training-period, and aligned-history questions produce a
clear answer first while retaining exact evidence and provider-neutral uncertainty.

**Lower-layer precondition:** verify the four Insights read models and longitudinal composition already
own every calculation. Add a presentation-facing result field only when the application cannot express
the accepted factual conclusion without UI calculation.

**Production work:**

1. Host supported questions in a bounded Answer Canvas within the stable shell rather than a generic
   maintenance-oriented Explore destination.
2. Lead with a plain result and useful visual relationship; disclose evidence counts, coverage, exact
   tables, and limitations progressively.
3. Format dates, durations, quantities, units, changes, and precision at a human scale while retaining
   exact source values on request.
4. Preserve range selection, comparison, exact day/night detail, cross-navigation, missing versus zero,
   and origin separation.
5. Restore originating Home state, focus, scroll, periods, selections, and result when returning.

**Behavior coverage:** meaningful values in every range field, invalid and inverted dates, apply/reset,
both periods, missing/zero/unavailable values, multiple origins, exact detail, all navigation actions,
partial data, loading, contextual failure and retry, return, restart where promised, locale, theme,
zoom, reduced motion, exact visual parity, and dense-history performance.

**Documentation:** Insights contracts only if their fields change; user exploration, interpretation,
precision, missing-data, and navigation guidance; architecture ownership and presentation tests.

### R4 delivery increments

R4 is delivered as five independently usable vertical increments. Each increment retains the current
exact-data route and leaves the application coherent if the following increment has not landed.

**Status:** R4.1 through R4.5 passed their focused, full fast, packaged functional, packaged
performance, privacy, and actual macOS visual gates on 2026-08-22. R4 remains complete; current
execution status is maintained in the increment table above.

| Increment | User-visible outcome | Required implementation and evidence |
|---|---|---|
| R4.1 — Activity answer | The Home question about changing daily activity opens an immediate equal-period answer. A plain conclusion and proportional relationship lead; period controls and exact metrics remain available on request. | Reuse the activity comparison use case without presentation-owned aggregation; add direct question navigation, result-first composition, meaningful default periods, coverage disclosure, exact-table disclosure, focus/return restoration, component tests, both locales, responsive review, and the affected packaged journey. |
| R4.2 — Training-period answer | A Home training comparison opens on its exact accepted periods and reads as an answer rather than a form followed by a table. | Preserve report creation, exact comparison evidence, multiple origins, no-distance and no-energy states, period editing, origin focus, and existing report-return behavior. Test direct Home entry, manual comparison, report handoff, return, and dense-history performance. |
| R4.3 — Sleep and recovery answers | The latest supported sleep and recovery patterns lead with human-scale results and useful visual relationships; exact nights and physiological evidence remain deliberate disclosures. | Recompose the existing overview and comparison use cases without medical interpretation. Preserve exact-night navigation, missing nights, source-specific recovery boundaries, meaningful ranges, locale precision, loading/failure retry, and keyboard behavior. |
| R4.4 — Aligned-history answer | The cross-domain question opens a bounded aligned-history canvas whose visual relationship is primary and whose exact day and domain links remain reachable. | Preserve independent availability, origin separation, cross-domain day navigation, range/comparison modes, and the explicit non-causality boundary. Test partial combinations, multiple origins, exact day detail, destination return, and high zoom. |
| R4.5 — Coherence gate | All supported Home questions use the same answer grammar and restore the exact originating Home state while ordinary History remains recognizable and independently navigable. | Complete shared presentation semantics, remove superseded control-first paths, run both locales/themes, 100%–200% zoom, reduced motion, accessibility, packaged functional and performance suites, privacy checks, documentation checks, and an actual wide/compact macOS visual audit before recording R4 complete. |

R4.3 is implemented in two coherent checkpoints without weakening its joint acceptance boundary:

1. **R4.3a — Sleep answer:** the latest selected sleep period leads with observed-night coverage,
   human-scale recorded duration, and the existing per-night visual. Range controls, complete summary
   coverage, the exact night table, and physiological or source-derived detail become deliberate
   disclosures. The comparison leads with the recorded-duration change, observed-night evidence, and
   a proportional visual; editing and exact values follow the answer. Missing nights remain visible
   and exact-night navigation retains focus restoration.
2. **R4.3b — Recovery answer and joint gate:** the latest selected recovery period leads with recorded-
   interval coverage and its existing per-night relationship without assigning wellness meaning.
   Exact shared intervals and source-specific assessment, baseline, and guidance remain deliberate
   disclosures. The comparison leads with the factual beat-to-beat interval change and explicit
   coverage, never a better/worse interpretation. This checkpoint closes R4.3 only after both domains
   pass localized loading, empty, partial, multi-origin, detail, comparison, failure/retry, keyboard,
   high-zoom, packaged, performance, privacy, and documentation gates together.

Neither checkpoint changes an Insights calculation or merges origins. Presentation may round a primary
duration or interval for reading, but the exact application values and comparison-minus-baseline changes
remain available unchanged.

R4.4 reuses longitudinal read-model version 1 because it already owns the required source-separated
calendar alignment, complete daily values, independent domain summaries, comparison changes, and exact
domain destinations. Presentation does not count new overlap categories or infer a relationship that the
application has not supplied. It gives the existing facts a result-first hierarchy in two checkpoints:

1. **R4.4a — Aligned-period answer:** the current shared period leads with its calendar span and one
   source-separated four-lane timeline. Direct domain coverage follows the visual; the complete summary
   and exact-day table become deliberate disclosures. Selecting an exact day replaces the canvas with a
   focused synopsis whose available domain destinations return through the existing origin-aware path.
   The non-causality boundary remains next to the visual evidence rather than hidden in diagnostics.
2. **R4.4b — Aligned comparison and joint gate:** a completed comparison leads with four factual
   baseline-versus-comparison relationships per origin. Range controls and exact values follow the
   result, and a contextual failure preserves the last valid comparison with a retry. This checkpoint
   closes R4.4 only after partial-domain, zero-event, unavailable, multi-origin, exact-day, destination,
   focus, locale, high-zoom, packaged, performance, privacy, and documentation gates pass together.

Neither checkpoint labels co-occurrence as causation, turns recovery evidence into a readiness measure,
normalizes unequal periods, combines origins, treats missing observations as zero, or claims that a
visually aligned date proves a physiological relationship.

R4.4 verification on 2026-08-22 covered 12 focused longitudinal presentation tests and the complete
fast suite: 152 automation tests, 219 React tests, 2 vendored-updater tests, 211 host tests, 147
application tests, and 33 domain tests. The packaged functional journey passed the complete import,
navigation, reimport, accessibility, restart, and cross-domain path. The packaged two-year benchmark
measured the longitudinal common range at 18 ms p95, maximum range at 51 ms p95, and comparison at
18 ms p95 against respective 500 ms, 2,000 ms, and 500 ms budgets. Actual 1280-by-820 macOS WebView
inspection covered the overview and comparison in English light appearance at 100% and Spanish dark
appearance at 200%, with no document overflow or clipped primary action. Repository-content and complete
reachable-history secret scans passed without versioning local host evidence.

R4.5 closes R4 through three independently reviewable checkpoints:

1. **R4.5a — Answer grammar audit:** exercise the activity, training-period, sleep, recovery, and
   aligned-history entry paths against one behavioral matrix. Each supported answer must lead with a
   localized factual conclusion and bounded visual, retain source separation and missing semantics,
   disclose exact evidence and period editing deliberately, preserve the last valid answer on a
   contextual failure, and focus the resulting answer without stealing an explicit focus change. Remove
   any superseded control-first question path, but do not turn ordinary History discovery into a forced
   answer or hide its recognizable session and sport navigation.
2. **R4.5b — Origin and workspace continuity:** verify every question, the recent training comparison,
   and a recent session from Home through open, temporary top-level navigation, contextual return, and
   restart where the destination is durable. **Back to Home** must clear only disposable exploration,
   restore the exact initiating control and its Home scroll state, and never leave a longitudinal day,
   report return, period, or training selection attached to a later unrelated question. History workspace
   choices, exact detail close actions, comparison results, and entered periods must retain their existing
   bounded ownership.
3. **R4.5c — Joint adaptive and release-shaped gate:** inspect all five answers and their comparisons in
   both locales, light and dark appearance, wide and compact allocation, 100%, 175%, and 200% content
   zoom, keyboard operation, reduced motion, and automated accessibility. Exact alternatives must remain
   reachable, wide evidence must scroll only inside its labelled region, focus and errors must not depend
   on color, and no page may overflow horizontally. Run the complete fast, packaged functional, packaged
   performance, privacy, documentation, and actual macOS visual gates before recording R4 complete.

R4.5 changes no domain calculation, storage contract, or provider mapping. A coherence defect is fixed at
the presentation or navigation owner that causes it; a missing factual capability returns to the
application boundary rather than being approximated in React.

R4.5 verification on 2026-08-22 covered exact question-origin return, temporary shell navigation, and
preserved aligned-history state in 54 application-shell tests; semantic Answer Canvas hierarchies and
form-origin behavior in 39 focused presentation tests; and the complete fast suite of 152 automation,
224 React, 2 vendored-updater, 211 host, 147 application, and 33 domain tests. A WebKit stress test
recalculated an already-visible training comparison 30 consecutive times. It exposed that a submit event
may precede focus transfer to its button; every form-driven result now uses the event's actual submitter
as its initiating control, while explicit user focus changes still cancel restoration.

The packaged functional journey passed import, reimport, cancellation, both locales, maximum zoom,
every analytical workspace, reports, accessibility, restart, and origin-aware return in 1 minute 18
seconds. The isolated two-year packaged campaign kept every accepted performance budget: the slowest
common interaction p95 was 33 ms, the slowest maximum-range p95 was 132 ms, and the bounded signal
overview p95 was 63 ms. The actual macOS WebView then passed 192 Answer Canvas inspections covering the
complete product of `en-US` and `es-ES`, light and dark appearance, wide and compact allocation, and
100%, 175%, and 200% content zoom. Every inspection retained focused and visible conclusions, bounded
visual and exact alternatives, zero page-level horizontal overflow, and zero Axe violations. Human
inspection of the representative wide, compact 175%, and dark 200% contact sheets found no clipped or
obscured primary result. The reduced-motion contract found its single motion declaration inside the
`no-preference` boundary. Repository-content, complete reachable-history secret, formatting,
documentation, localization, site, and product-surface checks passed without versioning local evidence.

For every increment, the red test must describe the user consequence before presentation code changes.
An Answer Canvas may format an existing application result and choose a visual hierarchy; it must not
recalculate domain aggregates, combine origins, infer causality, classify physiological meaning, or
silently replace unavailable evidence. If a supported plain conclusion cannot be expressed from the
existing result, extend the application contract and its schema first.

## X5-R5 — Make History recognizable and searchable

**User outcome:** a person can find a remembered session by sport, date, available evidence, label, or
imprecise text and can understand the result set without provider terminology.

**Lower-layer precondition:** verify search, calendar, selection, workspace, sport discovery, sport
classification, and optimistic persistence commands before replacing the UI.

The precondition is satisfied by the existing application ports and validated DTOs. Session discovery
already owns canonical date bounds, stable sorting, bounded pagination, measurement and sport filters,
imprecise text, immutable snapshot continuity, calendar projection, a four-session comparison selection,
and a versioned persisted workspace. Sport discovery already owns provider-neutral evidence grouping,
unknown and unavailable states, authored family and label validation, revision-checked persistence, and
conflict detection. Tauri commands are transport adapters over those use cases, and SQLite remains the
authoritative local implementation. R5 therefore changes composition and presentation without
recalculating discovery or classification facts in React.

### R5.1 — Establish the recognizable History Desk

Deliver a functional default History surface whose first viewport contains real sessions and recognizable
sport identity rather than a filter form. Keep chronology, calendar, pagination, comparison selection,
session opening, and persisted workspace behavior operational. Add the same semantic sport icon and
visible label to sport summaries, session results, comparison headings, and the dedicated classification
workspace; unknown and unavailable sport remain explicit states rather than invented identities. Move
refinements behind a clearly named secondary disclosure without changing their query contract.

The increment is complete only when focused React journeys prove initial results, all existing History
actions, exact return focus, keyboard operation, both locales, and narrow layouts. A visual self-review
must reject clipped identity, a controls-first first viewport, placeholder symbols, or loss of comparison
and calendar power before the increment is offered for review.

R5.1 verification on 2026-08-22 covered 19 focused History and sport-presentation journeys and the
complete fast suite of 226 React, 2 vendored-updater, 211 host, 147 application, and 33 domain tests.
The packaged macOS journey passed archive selection, outcomes, cancellation, cumulative reimport, both
locales, maximum zoom, History filters and summaries, reports, accessibility, restart, and durable state
in 1 minute 20 seconds. Its isolated two-year performance campaign retained every accepted budget; the
slowest History interaction p95 was 33 ms and the bounded signal overview p95 was 63 ms.

The first actual WebKit visual pass rejected the implementation because the first session began below a
728 px viewport. The causal composition was the accumulated shell introduction, duplicated History
introduction, separately stacked control rows, and aggregate summary before results—not the filter
disclosure alone. The corrected hierarchy keeps sport identity and sessions before optional detail,
places refinements and view controls together, and moves the aggregate result summary after the session
list. A repeated light, dark, wide, compact, and real 175% zoom matrix retained visible session evidence,
labelled navigation, zero page-level horizontal overflow, and zero Axe violations. Repository-content,
complete reachable-history secret, formatting, documentation, localization, site, product-surface, and
diff checks passed without versioning local evidence.

### R5.2 — Make every refinement legible and reversible

Present sport, date, measurement, text, and sorting as structured, domain-backed controls. Show the
applied query independently from the editable draft, with a localized chip for every active refinement,
individual removal, clear-all, and exact result count. Keep text complementary to structured choices.
An empty result names the active query, confirms that the library was not changed, and offers a direct
clear action. Preserve stable sort, pagination reset, calendar bounds, selection, and snapshot recovery
for every individual and combined refinement.

The increment is complete only after realistic multi-sport tests enter and apply every field, remove each
kind of refinement, reload persisted state, exercise every sort, navigate both result views and multiple
pages, recover from stale snapshots, and prove the same behavior in both locales with no accessibility or
horizontal-overflow regression from 100% through 200% zoom.

R5.2 verification on 2026-08-22 covered 21 focused History journeys, including draft-versus-applied
state, individual removal, clear-all, all four sorts, empty recovery, unavailable saved sports, durable
workspace restoration, both locales, focus restoration, equivalent empty recovery in both views, and atomic
failure in chronology and calendar. The complete fast suite passed 152 automation, 234 React, 2
vendored-updater, 211 host, 147 application,
and 33 domain tests. The packaged macOS journey passed the complete functional, localized, maximum-zoom,
accessibility, restart, reimport, and durable-state campaign in 1 minute 21 seconds. The isolated two-year
performance campaign retained every accepted budget; the slowest common-interaction p95 was 34 ms, the
slowest maximum-range p95 was 124 ms, and the bounded signal-overview p95 was 62 ms.

The first actual WebKit pass rejected the default composition because the applied-query block left too
little of the first session visible. The corrected unrefined state is one compact result sentence; an
active query expands only for refinements a person can remove. Further review removed a duplicate clear
action from the empty state, kept the editor below the sticky compact navigation, and changed the
maximum-zoom editor from four cramped columns to two legible columns. The final nine-state macOS matrix
covered default, editor, applied, and chronology/calendar empty results across wide and compact allocation,
light and dark appearance, and 100%, 175%, and 200% zoom with zero page-level horizontal overflow and zero Axe
violations. The packaged journey also exposed that Tauri WebKit's native WebDriver select command did not
change this sorting control; the retained event adapter now verifies both the selected value and the
visible applied order instead of accepting a silently untested sort. Repository-content, reachable-history
secret, formatting, documentation, localization, site, product-surface, and diff checks passed without
versioning local evidence.

### R5.3 — Classify in context and close the identity system

Place one restrained classification task beside an unresolved sport where it is encountered, while the
full sport workspace remains the management surface. Both entry points use the same application command,
family vocabulary, label rules, optimistic revision, conflict recovery, and saved overview; there is no
second editor contract. Saving updates Home, History, filters, session identity, reports, and both sport
surfaces. Cancel restores the prior presentation, reset returns to an explicit unknown state, and restart
or reimport preserves the authored classification.

The increment closes with an icon-and-label coherence audit across every product surface and every state,
origin-aware navigation tests from Home, chronology, calendar, comparison, and reports, the full fast and
packaged suites, dense-history performance, both locales and appearances, 100%–200% zoom, Axe, repository
content, privacy, documentation, and an actual macOS visual matrix. R5 remains incomplete if any surface
uses a placeholder, provider terminology, a divergent classification editor, or an inexact return target.

**Production work:**

1. Open History on visible sport families and sessions, with refinements secondary.
2. Use one coherent provider-neutral icon family plus visible text across Home, History, session,
   reports, filters, and empty states. Placeholder glyphs are prohibited.
3. Use structured sport, date, and measurement selectors populated from application values. Free text
   complements but never replaces them.
4. Display active refinements, individual removal, clear-all, exact result count, and stable sorting.
5. Preserve chronology/calendar views, comparison selection, pagination, and complete-history scope.
6. Present unresolved sport in context and complete classification with family, authored label,
   validation, save, cancel, optimistic conflict recovery, restart, and reimport preservation.
7. Open session detail from list, calendar, comparison, recent Home, or report while retaining an exact
   origin descriptor.

**Behavior coverage:** realistic multi-sport input; every filter alone and in combination; multiple
items; add/remove comparison; all sorts; pagination; calendar movement; empty filtered result; clear;
classification edit/save/cancel/reset/conflict; authored labels; navigation from every origin; reload;
stale snapshot; keyboard; both locales/themes; 100%–200%; accessibility; dense-history p95.

**Documentation:** sport classification and discovery contracts remain canonical; update user History,
classification, filters, calendar, comparison, navigation, icon semantics, and developer component guidance.

**Incremental execution:**

1. **R5.3a — One classification task, available in context.** Extract the existing family, personal-label,
   validation, save, cancel, reset, progress, and optimistic-conflict behavior into one reusable presentation
   task. Use that exact task in the full Sports workspace and beside one unresolved sport in the History sport
   summary. Keep only one contextual task open, restore focus to its initiating action on cancel and to the
   newly named identity on completion,
   preserve the person's unsaved values when a conflict reloads newer evidence, and retain every existing
   full-workspace behavior. This slice is runnable only when both entry points exercise the same Tauri command
   and the same localized vocabulary; a second abbreviated editor is a rejection condition.
2. **R5.3b — Coherent identity propagation without context loss.** Treat a successful classification as a
   versioned library change. Refresh the current History snapshot, calendar, selected comparison sessions,
   and open session against the new revision while preserving applied refinements, page, calendar day,
   detail section, and exact return origin. Refresh the hidden Sports workspace and Home projection from the
   returned overview without navigating the person elsewhere. Prove that filters, list cards, detail,
   comparison, recent sessions, report preparation/resolution, restart, and reimport all read the authored
   identity; a partially refreshed surface or an avoidable stale-data warning rejects the slice.
3. **R5.3c — Close visual and navigation coherence.** Inventory every rendered sport identity and require a
   semantic icon plus visible localized or personally authored label in Home, History summary, filter choices,
   chronology, calendar-derived results, comparison, detail, report preview/export, and relevant empty states.
   Exercise entry and exact return from Home recent sessions, chronology, calendar, comparison, and reports.
   Close with both locales, light/dark/system appearance, 100%, 125%, 150%, 175%, and 200% zoom, compact and
   wide allocation, keyboard-only operation, reduced motion, Axe, no page-level horizontal overflow, the dense
   History performance campaign, full packaged macOS journeys, repository/privacy/content gates, and an actual
   WebKit screenshot matrix reviewed before acceptance.

R5.3c closes through three independently testable checkpoints:

1. **R5.3c1 — One complete sport identity system.** Move the existing project-authored family geometry into
   one canonical SVG sprite consumed by the React primitive and self-contained report exporter. Close the
   label-only classified state with a distinct non-empty icon. Add icon-plus-label composition to the session
   heading, exercise summaries, report preview, and exported HTML; export localized family names rather than
   technical codes. Verify every family, unknown, unavailable, and personal-label-only state in both locales.
2. **R5.3c2 — Exact origin closure.** Exercise entry and focus-preserving return from a recent Home session,
   chronological result, calendar-derived result, comparison report start, saved report comparison, and saved
   report session. The visible return action must describe its actual destination, and a visit must preserve
   the mounted origin state rather than reconstructing a generic workspace.
3. **R5.3c3 — Adaptive and release-shaped closure.** Run the complete locale, appearance, zoom, allocation,
   keyboard, reduced-motion, Axe, overflow, dense-history, packaged, repository, privacy, and documentation
   gates. Review actual WebKit screenshots that include the canonical same-document sprite in Home, History,
   detail, Sports, and report states before accepting R5.

Each slice receives focused behavior tests before implementation and remains independently runnable after its
applicable fast and packaged checks. Documentation changes land with the slice whose behavior they describe;
local screenshots and exploratory drivers remain ignored evidence. A slice is reopened immediately when the
first actual WebKit review exposes hierarchy, density, focus, overflow, contrast, or context-loss defects.

R5.3a verification on 2026-08-22 covered 29 focused shared-task, Sports, and History journeys. They prove
the same command, vocabulary, validation, progress, reset, conflict recovery, authored-draft preservation,
single contextual task, immediate visible identity, and exact cancel and completion focus. The complete fast
suite passed 152 automation, 236 React, 2 vendored-updater, 211 host, 147 application, and 33 domain tests.
The packaged macOS journey passed the complete functional, localized, maximum-zoom, accessibility, restart,
reimport, report, and durable-state campaign in 1 minute 18 seconds.

The first actual WebKit review rejected the contextual composition because an inherited broad selector
truncated the personal-label guidance inside the shared task. Scoping compact summary typography to the
identity row restored the complete guidance without enlarging the summary cards. The repeated matrix retained
the prior nine History states and added wide light 100% and compact dark 200% contextual-classification states,
with the session list still visible, exact cancellation focus, zero page-level horizontal overflow, and zero
Axe violations. Repository-content, complete reachable-history secret, formatting, documentation,
localization, site, product-surface, and diff checks passed without versioning local evidence.

R5.3b verification on 2026-08-22 covered the classification event owner, both classification entry points,
the current History page, calendar and comparison selections, open detail, Home, and report preparation. It
proves that one ordered save event refreshes every revision-bound projection without changing the person's
applied filters, page, selected calendar day, comparison, detail section, or return origin. A failed dependent
refresh keeps the saved identity visible, explains the recoverable local inconsistency without claiming a
rollback, and succeeds through an explicit retry. A draft already open in the hidden Sports workspace remains
authored and reports the newer saved revision instead of being overwritten.

The complete fast suite passed 152 automation, 241 React, 2 vendored-updater, 211 host, 147 application, and
33 domain tests. The packaged macOS journey passed the complete functional, localized, maximum-zoom,
accessibility, restart, reimport, report, and durable-state campaign in 1 minute 18 seconds. The isolated
packaged insight campaign passed every accepted interaction budget in 1 minute 2 seconds.

The first actual WebKit review rejected a persistent success message because it consumed a grid row and moved
the first session below the intended result position. Retaining it as an assistive announcement removed the
visual displacement without losing save confirmation. The repeated wide light 100% History and Home states
and compact dark 200% Sports state retained labelled navigation and task hierarchy, showed the authored
identity across workspaces, produced no page-level horizontal overflow, and passed Axe. Local screenshots and
their exploratory driver remain ignored evidence.

R5.3c local verification on 2026-08-22 covers one canonical 15-symbol geometry source across all twelve
families and the personal-label-only, unknown, and unavailable states. The application mounts the trusted
sprite once for same-document references; the deterministic self-contained HTML adapter embeds the same
source and emits localized or personally authored labels rather than technical family codes. Focused tests
cover the icon primitive, session heading and exercises, report preview and export, and exact focus-preserving
return from Home, chronology, calendar, comparison, and saved-report origins.

The complete fast lane passed 153 automation, 246 React, 2 vendored-updater, 212 host, 147 application, and 33
domain tests. Strict Clippy, Rust formatting, the production TypeScript build, dependency audit, repository
content, complete reachable-history secret, documentation, localization, site, product-surface, and diff
checks passed. The exact dense-history campaign retained 7,490,080 supported signal samples and passed every
accepted budget; its slowest query p95 was 8.20 ms and its first-import p95 was 10.64 seconds. Environment
fingerprints remain local ignored evidence and are not project documentation.

Actual packaged WebKit review rejected three intermediate results before local acceptance: external SVG
fragment references rendered empty, maximum zoom compressed the detail actions against the session title, and
the report entrance read as promotional copy while delaying the first useful result. Same-document symbols,
stacked high-zoom detail actions, and a concrete report heading corrected those causes. The final matrix covers
Home, History, detail, Sports, report, and empty states across wide and compact allocations; light, dark, and
system appearance; and 100%, 125%, 150%, 175%, and 200% zoom. It retains visible icon geometry, exact labels,
keyboard focus, zero page-level horizontal overflow, and zero Axe violations. The current exact executable
fingerprint passed the complete packaged functional, localized, maximum-zoom, accessibility, restart, reimport,
report, and durable-state journey in 1 minute 17 seconds. Its isolated packaged Insights campaign passed every
accepted budget in 1 minute 16 seconds; the slowest common-interaction p95 was 36 ms, the slowest maximum-range
p95 was 121 ms, and the bounded signal-overview p95 was 63 ms. At that gate, R5 was recorded complete
locally; the independent checkpoint disposition below supersedes that status without invalidating the
recorded engineering evidence.

### Independent R5 checkpoint disposition

The later [R5 checkpoint audit](../research/mvp-redesign-r5-checkpoint-audit.md) preserves the original gate
evidence but contradicts its product-experience conclusion. It reopens R3 and R5 through the following
ordered correction slices before R6:

1. **R3.1 — Personal-value handoff.** Reduce the transient import receipt to supporting evidence, make the
   useful personal result the initial Home hierarchy, and keep exact coverage in Sources as a deliberate
   action.
2. **R3.2/R5.4 — Distinct unresolved sport identity.** Preserve each stable unresolved source profile in
   Home, expose one contextual path to the existing classification task, and retain coherent authored
   identity propagation everywhere.
3. **R5.5 — Human-scale session discovery.** Compose cards from available evidence, apply locale-appropriate
   human-scale date and quantity formatting, replace opaque source ordinals, and make every sport refinement
   visibly discoverable at supported geometry.
4. **R5.6 — Application-process restart evidence.** Replace `reloadSession()`-based restart claims with a controlled
   packaged process termination and relaunch against the same durable state. Preserve every behavioral
   assertion while changing the evidence mechanism.

Each slice follows the ordinary TDD and release-shaped gates. The checkpoint's copy advisory is corrected
with the owning surface; it does not independently reopen R2. R3 and R5 return to complete only after a fresh
clean-first-use and representative multi-sport inspection confirms the required product outcome.

### R3.1 local closure — 2026-08-22

The application contract already provided coherent personal results and a revision-correlated import outcome;
the defect was the presentation order. Home now leads with its summary, recognizable sports, historical
highlight, and recent sessions. A compact changed, unchanged, or exact-repeat acknowledgement follows those
personal results. Sources remains the single detailed owner of incorporation counts, coverage, diagnostics,
and provider evidence.

Focused presentation and integration tests preserve both the useful handoff and exact coverage reachability.
The complete fast lane passed 153 automation, 246 React, 2 vendored-updater, 212 host, 147 application, and 33
domain tests, together with the production build, localization, UI-contract, documentation, repository, and
privacy gates. The packaged functional journey and isolated performance suite passed. Actual macOS WebView
inspection covered wide light 100% and compact dark 200% Home states; personal results preceded the receipt,
the receipt remained calm and legible, the page had no horizontal overflow, and Axe reported no violations.
At that checkpoint, R3 remained reopened because RC-02 still required distinct, actionable identity for
unresolved sport profiles.

### R3.2/R5.4 local closure — 2026-08-22

Library Home version 3 retains one safe opaque capability for each distinct unresolved sport profile instead
of grouping every unknown value into one false identity. Home gives those profiles separate localized ordinal
labels, associates recent sessions with the same ordinal, and routes each contextual action to the existing
Sports classification task. The capability is never displayed, exported, interpreted, or used as provider
vocabulary. Saving through the shared task refreshes Home and mounted History identities; cancellation and
return preserve the exact focus origin.

Application, infrastructure, transport, schema, presentation, integration, and packaged tests cover four
distinct unresolved profiles, bounded aggregation, safe capability propagation, editor focus, cancellation,
save, cross-surface refresh, exact return, reimport, restart, localization, and accessibility. The complete
fast lane passed 153 automation, 249 React, 2 vendored-updater, 212 host, 148 application, and 33 domain tests;
Clippy, Rust formatting, production build, documentation, localization, UI-contract, repository, and privacy
checks also passed. The final packaged functional journey and the isolated performance campaign passed every
accepted assertion and budget.

The first compact 200% visual pass was rejected because four technically present cards stayed in one row and
ellipsized the identities they were meant to distinguish. The corrected adaptive composition uses two rows,
keeps every ordinal, count, and naming action readable, and is protected by the UI-contract gate. A repeated
macOS WebView inspection of a deterministic four-sport history covered wide light 100% and compact dark 200%
in both supported locales, with no page-level horizontal overflow and zero Axe violations. RC-02 is closed;
R3 returns to complete locally, while R5 remains reopened for RC-03 and RC-04.

### R5.5 local closure — 2026-08-22

History chronology now presents a medium localized date and short time, a human-scale rounded duration, and
metres or kilometres at useful precision. A card creates distance, energy, and average-heart-rate rows only
when that evidence exists; it no longer repeats unavailable values or opaque source ordinals. Exact timestamps,
unrounded source quantities, source separation, and provenance remain unchanged in deliberate detail,
comparison, result-summary, and source-evidence surfaces. A calendar date backed by more than one separated
history states that multiplicity in plain language without exposing a reference or unexplained ordinal.

The complete sport index is a wrapping grid rather than an unannounced horizontal rail. Its high-zoom
composition uses an explicit readable minimum so 150%, 175%, and 200% zoom reduce column count instead of
compressing a label to individual characters. The first automated geometry pass was rejected after screenshot
inspection exposed that exact failure at 200%; the corrected English and Spanish compact-dark captures retain
four complete labels, counts, icons, and naming actions with no horizontal page overflow and zero Axe violations.
Wide light inspection also proved both complete and sparse cards: omitted evidence changes composition while
recorded facts remain concise and recognizable.

The complete fast lane passed 154 automation, 255 React, 2 vendored-updater, 212 host, 148 application, and 33
domain tests, together with Clippy, Rust formatting, production build, localization, UI-contract,
documentation, repository, and privacy gates. The final packaged functional journey passed both locales,
maximum zoom, accessibility, reimport, and durable-state behavior. The isolated packaged performance campaign
passed every unchanged interaction budget. Its completion boundary was corrected to use the documented next
browser task and synchronous layout read rather than an animation frame that macOS can suspend when the WebView
is occluded; a configuration test now prevents that visibility dependency from returning. RC-03 and RC-04 are
closed, and R5 returns to complete locally.

### R5.6 local closure — 2026-08-22

The packaged gate now distinguishes WebDriver continuity from application restart. The complete functional
journey retains its session-replacement assertions but no longer labels them as restart evidence. At its final
durable boundary, it records the exact instrumented application process identity only after the training
calendar, selected day, comparison basket, and open session have been confirmed through the persisted workspace
query. The service then terminates that process. A second WebdriverIO invocation starts the same packaged
executable against the same unique temporary library and must prove a different process identity before it can
inspect recovered state.

The second process recovered the Spanish locale, dark appearance, 200% content zoom, History destination,
calendar month and day, comparison selection, open session, personal sport classification, two authored segment
criteria, two saved reports and their resolved result, and the latest import outcome through ordinary startup
and user-visible surfaces. The performance campaign remains a third process with a separate library. No process
identity command or restart authority was added to the application; the harness observes the exact executable
from outside the production boundary, and the ignored identity record exists only for the lifetime of one
successful generated campaign.

The first packaged attempt exposed an ordering defect in the new test: visible calendar state was inspected
before its asynchronous workspace write completed. The corrected journey waits for the exact persisted calendar,
day, session, and comparison condition instead of using a fixed delay. Nine harness configuration tests,
documentation checks, and the complete packaged sequence passed: the functional journey in 2 minutes 58 seconds,
the distinct-process recovery in under 1 second, and the isolated performance campaign in 3 minutes 53 seconds
with every unchanged interaction budget satisfied. The complete fast lane also passed 156 automation, 255 React,
2 vendored-updater, 212 host, 148 application, and 33 domain tests. EV-01 is closed.

## X5-R6 — Deliver the outdoor session workbench

**User outcome:** a routed session becomes an exceptional investigation surface in which recorded
position, time, pace or speed, heart rate, elevation, cadence, stroke rate, temperature, or power stay
visibly synchronized when those facts exist.

**Application-first work:**

1. Introduce one `SessionStory` query and projection over the authoritative session selection,
   structure, route, signal, zone, classification, and provenance ports.
2. Bind every sub-result to one discovery and evidence revision; reject mixed snapshots.
3. Align route points and signal slots only by compatible recorded elapsed time. Preserve exercise and
   route-role discontinuities, signal gaps, absent timestamps, source roles, units, exact ordinals, and
   unavailable values. Canonical route version 1 contains no source-authored intra-route break, so missing
   elapsed time cannot be presented as a geometric gap; such a capability requires explicit source evidence
   and a later canonical contract.
4. Project sport-specific primary labels and eligible overlays without choosing presentation color.
5. Return bounded overview geometry and lanes plus stable capabilities for exact pagination.
6. Add no joined cache or presentation reconstruction in SQLite.

**Spatial rendering decision:** the accepted interaction now justifies re-evaluating ADR 0013 for one
bounded spatial exception. Measure a custom semantic SVG implementation and maintained GPL-compatible
local renderers against pan/zoom, synchronized selection, keyboard parity, accessibility, bundle size,
WebView reliability, contributor cost, and offline privacy. Record the durable choice in a new ADR;
do not rewrite ADR 0013. External tiles, geocoding, invented labels, and network requests remain excluded.

**Production work:**

1. Lead with compact session identity and evidence availability, then give the full-width route the
   majority of the primary viewport.
2. Keep the complete track visible initially with direction, start/end, selected point, gaps, north/
   coordinate context, and scale. Support pan, zoom, full-track reset, and focused/full-screen map.
3. Offer eligible sport-specific route overlays with a legend and non-color structured alternative.
4. Synchronize map, attached value strip, full-width signal lanes, elapsed-position control, and exact
   table for pointer and keyboard selection.
5. Keep exact coordinates, samples, provenance, and source versions behind deliberate disclosure.
6. Preserve context, overlay, selected point, and origin when focusing the map or returning.

**Behavior coverage:** running and paddling routes, cycling eligibility, one point, empty route, primary
and transition routes, anti-meridian, missing elapsed times, signal gaps, multiple signals, overlay
changes, pointer/keyboard traversal, pan, zoom, reset, focus/restore, exact pagination, locale units,
responsive component widths, 200% zoom, reduced motion, contrast, no external request, and dense-session
performance. Visual and exact selected values must agree at every tested point.

**Documentation:** composed Session Story v1 contract, transport schema, architecture and ADR, privacy,
route/signal interpretation, exact evidence, synthetic contract examples, performance benchmark, and
user session/map guidance.

### R6.1 local closure — 2026-08-22

The application now owns one provider-neutral `SessionStory` use case. It resolves the selected session
first, pins structure, route, signal, zone, and provenance reads to that accepted snapshot, and rejects
mixed revisions or conflicting exercise identities. The result retains every original assessment while
adding exercise-level primary/transition composition, ordered sport-aware metrics, exact route and signal
capabilities, and bounded route/signal matches only at identical recorded elapsed times. Missing route
timestamps, null signal values, signal gaps, source units, roles, and exact ordinals remain explicit. A
water-sport cadence series remains cadence until distinct stroke evidence exists, and the application
chooses no presentation color.

The `query_session_story` Tauri command, version-1 request and response schemas, TypeScript boundary,
contract documentation, architecture link, and executable schema checks are present. The command composes
the existing independent SQLite ports; no migration, joined persistence query, story cache, or presentation
reconstruction was added. Eight application tests cover coherent running composition, revision rejection,
role separation, running/cycling/water-sport priorities, conservative cadence semantics, source assessment
states, partial-evidence sport restraint, and exercise conflicts. The production TypeScript build,
documentation and data-contract checks, all 213 host, 156 application, and 33 domain tests, formatting, and
workspace-wide all-feature Clippy passed. R6 remains open for the spatial-rendering ADR and the complete
map-led workbench, interaction, accessibility, exact-evidence, privacy, responsive, and performance gates.

### R6.2 local closure — 2026-08-22

[ADR 0026](../architecture/decisions/0026-use-leaflet-for-the-local-route-workbench.md) records the measured
spatial exception without rewriting ADR 0013. The evaluation compared the existing application-owned SVG
projection with stable Leaflet 1.9.4, OpenLayers 10.10.0, and MapLibre GL JS 6.5.0 across required interaction,
synchronized selection, keyboard behavior, accessibility, minified and gzip package cost, WebView risk,
contributor surface, maintenance, GPL compatibility, and offline privacy. Leaflet is selected for one lazily
loaded local vector-only presentation adapter. It adds no runtime dependency graph, worker, WebGL context,
tile, geocoder, geolocation, plugin, remote asset, source-authored popup HTML, or transport type. The Session
Story remains the sole evidence input; FitFreed retains elapsed selection, route roles and gaps, overlays,
semantic alternatives, exact evidence, focus, and navigation ownership. R6 remains open until the complete
production workbench and every unit, packaged-WebView, accessibility, privacy, synchronization, responsive,
and dense-session gate pass.

### Production session reader cut-over — 2026-08-22

The ordinary session surface now reads structure, routes, signals, zones, exercise composition, and current
provenance from one revision-coherent `query_session_story` response. It no longer launches four independent
detail queries whose responses could arrive or fail separately. Exact route points and exact signal samples
remain deliberate, independently paginated disclosures. A story failure produces one calm contextual alert
and no duplicate shell alert; successful sport classification updates both the selected session and its
composed exercise identities without a stale technical reference becoming visible.

Focused React coverage proves the one-command boundary, bounded overview requests, every retained detail
operation, classification refresh, restoration, and one contextual failure. The complete 255-test React
suite, contributor fast lane, production build, documentation, localization, repository-content and secret
checks passed. The exact committed-source macOS campaign passed the complete functional journey, a real
process restart, accessibility checks, and the packaged insight-performance suite. R6 remains open for the
dominant Leaflet route workbench and its synchronized interaction, adaptive-layout, privacy, and visual
falsification gates.

### R6.3 implementation checkpoint — 2026-08-22

The production session story now leads with a full-width local vector route workbench whenever bounded
recorded geometry exists and renders no map when it does not. One presentation-owned model preserves exact
source coordinates and ordinals while unwrapping anti-meridian viewport geometry, keeps primary and
transition roles separate, derives sparse direction markers, selects bounded points, transforms supported
display metrics without changing their exact source value, and leaves missing or discontinuous overlay
evidence unconnected. A replaceable Leaflet adapter owns only local projection, SVG vectors, pan, zoom, fit,
scale, pointer hit testing, resize, and disposal; package and architecture contracts pin its reviewed versions
and reject tiles, remote URLs, location services, popups, transport access, or Leaflet types outside that
adapter.

Packaged WebView falsification found that Leaflet 1.9.4 received a focused `ArrowRight` event with its
legacy key code but did not execute its document-level keyboard handler. The adapter therefore disables
that handler and translates only unmodified arrow and conventional zoom keys on the focused map element
into Leaflet pan and zoom operations. Focus, event scope, disposal, pure key mapping, and visible packaged
movement are explicit tests; this is a WebView compatibility boundary rather than a second spatial engine.

The responsive surface gives the map a laptop-bounded majority region, offers named zoom/reset and reversible
focused-view controls, preserves focus on initial session entry, restores the initiating control on button or
`Escape` exit, and keeps a native recorded-position control, selected elapsed/value strip, non-color overlay
range, source-aware exact actions, and local-privacy statement attached to the same story. A route action opens
the existing paginated Routes evidence and a metric action opens its exact Signals source, moving focus and
the visible workspace to the requested result without adding a second reader. Unit and component tests,
translation and architecture contracts, dependency audit, production build, and the complete contributor
fast lane pass. The exact `3c8e217` packaged source passed the 3-minute 11-second functional journey, a real
application-process restart, and the 4-minute 2-second dense insight campaign. The route journey covers local
pointer selection, keyboard evidence traversal, WebView-safe keyboard pan, named zoom and fit, route-role
separation, transformed overlay evidence, modal isolation and restoration, exact-result focus, local-only
rendering, adaptive layout, and accessibility. Training p95 measurements were 46 ms for common filtering,
46 ms for the maximum filter, 21 ms for comparison, 36 ms for calendar navigation, 42 ms for signal overview,
and 202 ms for an exact signal page, all within their accepted budgets. R6 remains open for synchronized
full-width signal lanes and exact-row selection, remaining locale/theme/zoom/accessibility visual matrices,
dense-session route-interaction evidence, and the personal/source range workbench integration already assigned
to R8.

### R6.4 implementation checkpoint — 2026-08-22

The route workbench now attaches full-width heart-rate, pace or speed, elevation, cadence, temperature,
and power lanes only when the coherent Session Story contains that evidence. One shared elapsed-position
model keeps the map, value strip, recorded-range summary, every lane, and exact evidence action aligned.
Complete bounded signal series draw the visual line and explicit source gaps; selected values and route
overlays appear only for samples whose recorded elapsed time is exactly aligned. Missing elapsed time,
unaligned samples, null values, and unavailable series remain visibly distinct rather than being interpolated.
Opening exact evidence resolves the containing source page and current row by stable ordinal, then moves focus
to that row without reconstructing or replacing the source record.

The adaptive visual review covered the map and lanes independently in English and Spanish, light and dark
appearance, wide and compact windows, and 100%, 175%, and 200% content zoom. It found and corrected three
material presentation defects before closure: undersized native route selectors in the packaged WebView,
assistive-only instructions rendered as visible content because of a noncanonical class, and in-page reveals
covered by the persistent compact navigation. Native selectors now retain a 44-pixel minimum target, the
single `sr-only` utility owns visually hidden instructions, and one shell reveal-offset token governs the
workbench, map, lanes, comparisons, and answer headings at every navigation geometry. Packaged assertions
scroll to and measure each route region outside the persistent navigation instead of relying on CSS inspection.

The complete contributor lane passed 156 automation, 274 React, 2 vendored-updater, 213 host, 156 application,
and 33 domain tests. The exact `3eed7fd` packaged source passed the 3-minute 31-second functional journey,
distinct-process restart in under 1 second, and the 3-minute 53-second two-year insight campaign. Training
p95 measurements were 49 ms for common filtering, 48 ms for the maximum filter, 23 ms for comparison,
46 ms for calendar navigation, 43 ms for a four-lane signal overview, and 210 ms for an exact 20,001-sample
signal page, all within their accepted budgets. R6 remains open only for explicit dense-session route-
interaction evidence; personal and source-authored ranges remain intentionally assigned to R8.

### R6.5 local closure — 2026-08-22

The packaged performance archive now places one independently generated 20,001-point route beside four
aligned 20,001-slot signals in the latest session. Production requests one shared bounded 400-item visual
evidence budget for route and signal projections, preserving exact matches for equal-cardinality streams
without authorizing proximity matching for different cadences. The bounded control now names every selected
position by its retained source ordinal and complete exact count rather than exposing its internal projected
index. The dense final selection therefore reads point 20,001 of 20,001 and opens the exact containing page
with that original row focused and current.

The packaged campaign repeatedly opens the complete local workbench, requires a non-empty recorded overlay,
three default lanes and four available lane choices, alternates first and last positions while checking both
the Leaflet marker and every lane cursor, alternates recorded overlays, and retrieves the final exact source
row. It measures the complete Tauri, SQLite, application, transport, React, Leaflet, DOM, and layout boundary.
The campaign watchdog grew only to contain the expanded scenario; the 1-second workbench, 100-millisecond
selection, 250-millisecond overlay, and every existing interaction budget remain unchanged or newly explicit.

The complete contributor lane passed 156 automation, 275 React, 2 vendored-updater, 213 host, 156 application,
and 33 domain tests. The exact `7fb81da` packaged source passed the functional journey in 2 minutes 42 seconds,
distinct-process restart in under 1 second, and the expanded two-year performance campaign in 5 minutes
47 seconds. Dense-route p95 measurements were 79 ms for workbench opening, 6 ms for synchronized source-point
selection, and 5 ms for overlay replacement. Signal overview and exact-page p95 remained 42 ms and 252 ms;
every other domain and longitudinal path remained within its accepted budget. X5-R6 is complete locally.
Personal and source-authored range work remains in X5-R8 rather than being absorbed into the map increment.

## X5-R7 — Make session composition evidence-adaptive

**User outcome:** indoor, partial, mixed, and non-routed sessions foreground their best recorded evidence
without empty map boxes, repeated warnings, fabricated structure, or loss of analytical depth.

**Application-first work:** extend Session Story composition states for route absence, absent or empty
structure, unsupported and unavailable series, recorded zones, provenance changes, and mixed exercises.
The application describes availability and attribution; presentation selects the accepted composition.

**Production work:**

1. Render no map when no route exists. Give the primary supported signal or structure the visual region.
2. Keep one concise evidence account and one route to exact source detail; never repeat a general
   missing-data warning across sections.
3. Integrate source laps, pauses, phases, recorded zones, aligned signals, and provenance through
   progressive disclosure without implying nonexistent chronology.
4. Adapt sport-specific labels, units, defaults, and visuals while preserving the common interaction
   grammar.
5. Preserve exact origin-aware return for all entry paths and meaningful scroll/focus state.

**Behavior coverage:** outdoor complete, indoor structured, indoor unstructured, no route, no heart
rate, zones without timeline, transitions, mixed exercises, empty collections, unsupported series,
gaps, amended evidence, failed independent query, exact tables, section navigation, disclosure scroll,
collapse focus, direct entry, stale origin, report return, both locales/themes/zoom levels, and all
performance budgets.

**Documentation:** Session Story state table, user evidence/limitations guidance, architecture, UI state
ownership, and synthetic scenario catalogue.

### R7.1 application composition contract — 2026-08-22

Session Story version 2 now adds application-owned assessment states plus exact supported-evidence counts
without changing the preceding version-1 response. The composition distinguishes unevaluated, source-absent,
source-empty, and source-present exercise containers. Every composed exercise and independent primary or
transition role describes structure, route points, supported signal series, empty, unavailable and partial
series, unsupported series, exact sample availability, recorded zone bands, timed zone bands, and unsupported
zone groups. A partial exercise created solely from signal evidence remains in the story when structure and
route evidence are absent.

Application, transport, JSON Schema, TypeScript, architecture, and contract documentation consume the same
versioned definitions. Focused Rust tests cover routed, signal-only, empty, unavailable, partial, unsupported,
untimed-zone, transition, and conflicting exercise states. The complete Rust workspace, 275 React tests,
TypeScript production build, schema checks, documentation checks, localization checks, formatting, and strict
Clippy passed. This closes the R7 application contract only; evidence-adaptive production composition and its
packaged visual and interaction gates remain open.

### R7.2 signal-only production composition — 2026-08-22

Session detail now consumes composed exercises independently from source structure. When no bounded route can
be drawn, the first application-ranked supported signal takes the leading visual region with the declared
sport-aware metric, source gaps, source coverage, interval, source identity, and a direct exact-sample path.
The route and signal workbenches share one deterministic value-transform function, so running pace has the
same meaning with or without a route. A compact session evidence account reports supported counts, missing
sample values, and unsupported source collections once rather than turning absence into repeated page-level
warnings.

Detail navigation removes Routes when no composed route exists and removes Signals and zones when neither
signal nor zone evidence exists. Structure and segments deliberately remains available because personal
segmentation is independent from provider-authored structure. The signals and routes sections now iterate
Session Story exercises, so signal-only, route-only, and future mixed compositions are not discarded by an
absent structure collection. Focused tests prove signal-leading composition, gap preservation, dynamic route
navigation, retained sport identity, and the exact source-sample path. The complete behavior matrix,
responsive visual review, packaged journey, and remaining structure- and zone-leading states keep R7 open.
The complete fast contributor lane passed 156 automation, 279 React, 2 vendored-updater, 213 host,
159 application, and 33 domain tests together with architecture, contracts, workflows, documentation,
product surfaces, localization, site, production TypeScript build, and Rust formatting gates.

### R7.3 structure-only production composition — 2026-08-22

A session with recorded exercise structure but no drawable route or supported visual signal now gives that
structure the leading visual region. Sport identity, exercise duration, distance, source laps, automatic laps,
and pauses are concise before the person requests detail. Recorded lap split times and durations determine the
bar geometry against the recorded exercise duration. Pause positions remain undisclosed because the current
contract carries local timestamps rather than a validated elapsed-session alignment; presentation reports the
count and leaves exact timestamps in the structural detail instead of inventing a timeline.

The workbench supports each composed structured exercise, distinguishes source and automatic lap authorship,
and moves focus to Structure and segments through an explicit action. Source structure remains separate from
personal segmentation. Focused behavior proves that no route or signal workbench appears, one half-duration
source lap occupies exactly half the recorded-duration track, session evidence is counted once, irrelevant
detail destinations stay absent, and the structural action reveals and focuses both source detail and the
personal-segment capability. Responsive layout, high zoom, both locales, production compilation, localization,
and UI contracts pass their focused gates. The complete R7 behavior matrix, packaged visual journey, and
zone-leading composition remain open. The complete fast contributor lane passed 156 automation, 280 React,
2 vendored-updater, 213 host, 159 application, and 33 domain tests together with architecture, contracts,
workflows, documentation, product surfaces, localization, site, production TypeScript build, and Rust
formatting gates.

### R7.4 zone-only production composition — 2026-08-22

Supported recorded zone bands now receive the leading visual region when a session has no drawable route,
supported visual signal, or recorded structure. The workbench keeps exercise sport identity, source group,
exact band ranges, aggregate coverage, and recorded total together without presenting aggregate zones as a
timeline. Recorded time leads when available; speed distance and power muscle load are supported factual
fallbacks when time is absent. Groups and exercises remain selectable rather than being silently combined.

Missing aggregate values render as a distinct unavailable pattern and text, never as a zero-length recorded
bar. The direct detail action retains the selected exercise and group, reveals Signals and zones, and focuses
that exact source group. Source zones remain separate from user-authored segments, and unsupported groups
remain a concise evidence count rather than acquiring invented bands. Focused behavior covers partial
heart-rate time, a complete distance-only speed group, group switching, exact band and unavailable-value
inspection, evidence totals, capability-adaptive navigation, and exact focus restoration. The complete R7
behavior matrix, responsive visual review, and packaged journey remain open. The complete fast contributor
lane passed 156 automation, 281 React, 2 vendored-updater, 213 host, 159 application, and 33 domain tests
together with architecture, contracts, workflows, documentation, product surfaces, localization, site,
production TypeScript build, and Rust formatting gates.

### R7.5 evidence-adaptive behavior matrix — 2026-08-22

`sessionStoryLayout` is now the single presentation decision for both the leading evidence and the available
detail destinations. It distinguishes a route object from drawable bounded route points, supported signal
detail from an eligible visual series, source structure from personal segmentation, supported zone bands from
unsupported-group counts, and loading from a resolved summary-only story. The session panel consumes that one
decision instead of independently repeating capability predicates around each workbench and navigation item.

The pure matrix proves route → signal → structure → zone priority, signal fallback when an exact route has no
bounded visual points, unsupported-only detail without a fabricated leading visual, summary-only destination
removal, and the complete loading navigation. Integrated journeys retain full outdoor and partial signal
coverage, add structure-only and multi-group zone-only composition, distinguish missing aggregates from zero,
exercise exact focus paths, and execute the zone journey in both `en-US` and `es-ES`. Static UI contracts now
require every non-route workbench to reflow its heading and summary at 175% and 200% zoom and to stack summaries
and actions without horizontal continuation at compact width. Packaged geometry, keyboard/accessibility, and
process-restart evidence remain the final R7 gate. The complete fast contributor lane passed 156 automation,
290 React, 2 vendored-updater, 213 host, 159 application, and 33 domain tests together with architecture,
contracts, workflows, documentation, product surfaces, localization, site, production TypeScript build, and
Rust formatting gates.

### R7.6 packaged adaptive-session checkpoint — 2026-08-22

The packaged campaign now gives evidence-adaptive session composition an isolated application process and
library between the retained restart journey and the performance journey. Its independently generated source
archive imports three deliberately different sessions through the real import boundary: supported signals
without route or source structure, source laps and a pause without route or supported signals, and recorded
structure with heart-rate, speed, power, and unsupported zone groups. The last state deliberately proves the
accepted structure-before-zones priority; a provider archive cannot carry Polar zone groups without an
exercise container, while the pure and React matrices retain the structurally possible zone-leading case.

The real WebKit journey proves leading-workbench selection, capability-adaptive navigation, selector changes,
exact samples, exact source laps, recorded zone alternatives, unsupported evidence counts, focus transfer, and
return. It covers English/light at broad desktop geometry and Spanish/dark at compact geometry with 200%
content zoom. Every workbench and revealed target remains within the visible workspace, below persistent
compact navigation, and without page-level horizontal overflow. Four privacy-safe synthetic screenshots are
retained under the ignored evidence directory for local review.

Automated accessibility exposed two implementation defects before acceptance: overriding native `dl`
semantics orphaned its terms and definitions in WebKit, and the session title skipped a heading level. Native
description-list semantics, a complete Training → session → section hierarchy, matching visual selectors, and
one shared reveal-target scroll margin now form static UI contracts. The focused packaged scenario passes with
zero Axe violations.

The complete contributor lane passed 156 automation, 290 React, 2 vendored-updater, 213 host, 159 application,
and 33 domain tests. The exact `8304227` packaged source then passed the 1-minute-29-second functional journey,
distinct-process restart in 894 milliseconds, the isolated adaptive-session journey in 3.7 seconds, and the
two-year performance journey in 2 minutes 28 seconds. Training p95 measurements were 43 milliseconds for common
filtering, 38 milliseconds for the maximum filter, 18 milliseconds for comparison, 35 milliseconds for calendar
navigation, 76 milliseconds for route-workbench opening, 3 milliseconds for synchronized selection,
5 milliseconds for overlay replacement, 37 milliseconds for signal overview, and 42 milliseconds for exact
signal pagination. Activity, sleep, recovery, and longitudinal interactions also remained inside every accepted
budget. X5-R7 is complete locally.

## X5-R8 — Add personal ranges and integrate segmentation

**User outcome:** a person can name and revisit a contiguous part of one session and can apply reusable
criteria without confusing either object with provider laps or recorded evidence.

**Domain-first work:**

1. Add a session-owned `TrainingSessionRange` aggregate with stable local identity, user authorship,
   non-blank title, ordered elapsed boundaries, evidence revision, optimistic revision, and explicit
   create, rename, adjust, and remove transitions.
2. Keep a range distinct from reusable `SegmentCriterion`, derived section, and attributed source range.
3. Define reimport behavior: retain exact boundaries only while the referenced session and compatible
   elapsed evidence revision remain valid; otherwise preserve the authored object in a review-required
   state rather than redirecting it silently.

**Application and persistence work:** commands and ports for create/update/remove; additive recoverable
SQLite migration; bounded listing; one revision-coherent Range Summary query resolving the selected exact
coordinate, its gaps, source attribution, direction, duration, distance, sport-specific measurements,
coverage, and exact boundary evidence while keeping independent route, signal, and source clocks unaligned.
Publish canonical, portable/backup, persistence, migration, and read-model contracts with independent
synthetic fixtures.

**Production work:**

1. Create a temporary range from map, signal lane, source structure, or exact evidence with synchronized
   adjustable handles.
2. Keep the route visible during naming and adjustment; use an in-workbench inspector on wide screens
   and a stacked task mode at compact width/high zoom.
3. Validate a non-blank name and ordered boundaries locally and in the domain.
4. Save, reopen, rename, adjust, cancel, remove, and survive restart/reimport review.
5. Present source ranges and user ranges with authorship independent of color.
6. Integrate existing equal-time, recorded-distance, heart-rate-range, and manual criteria with complete
   create/update/apply/reorder/remove behavior and distinct authorship.

**Behavior coverage:** boundary selection from every representation; pointer and keyboard adjustment;
invalid, equal, reversed, outside-session, gapped, and unavailable boundaries; multiple overlapping
ranges; duplicate names where allowed; save/cancel/reload/edit/remove; stale revision conflict; reimport;
multiple criteria; every criterion rule; add/remove/reorder/apply; missing prerequisites; restart;
locale/theme/zoom; accessibility; dense-session performance and migration recovery.

**Alpha evidence:** a separate density, discoverability, and boundary-selection review records findings
without weakening correctness or delaying unrelated accepted work.

### R8.1 personal-range domain contract — 2026-08-22

`TrainingSessionRange` is now a distinct session-owned aggregate rather than a special case of a reusable
criterion or source lap. It retains stable local range and owning-session capabilities, a normalized
non-blank title, ordered session-relative elapsed boundaries, explicit user authorship, the accepted elapsed-
evidence revision, current or review-required state, and an optimistic aggregate revision. Create, rename,
adjust, evidence reconciliation, and revision-bound removal are explicit domain transitions. Duplicate names
and overlapping ranges remain valid because neither title nor geometry is identity.

Compatible strict enrichment can rebase unchanged exact boundaries of a current range to a new evidence
revision. An incompatible amendment, missing owner, or shortened duration preserves the authored title and
numeric boundaries in review-required state instead of clamping or redirecting them; later enrichment cannot
clear that state. Explicit adjustment against current evidence completes review, including when the person
deliberately retains the same values. Every
effective authored or reconciliation transition advances the revision exactly once; repeated equivalent
state is idempotent.

The canonical range, architecture, domain, and format-index sources document session elapsed coordinates,
separation from source and derived evidence, concurrency, reimport, deletion, privacy, and future portability.
Nine focused domain tests, the complete 42-test domain suite, strict domain Clippy, formatting, and public
documentation checks pass. Application commands, persistence, the revision-coherent Range Summary, and
production interaction remain open under R8.

### R8.2 personal-range application transitions — 2026-08-22

The application now owns bounded query plus create, rename, adjust, and remove use cases over a dedicated
`TrainingSessionRangePort`. Every mutation validates opaque session, snapshot, range, and optimistic-revision
inputs before writing. It resolves the current session duration and elapsed-evidence revision through the
port, delegates meaning to the domain transition, and accepts only a complete committed context returned by
the same persistence operation. An idempotent rename or adjustment performs no write.

The returned collection is bounded to 1,000 ranges, rejects duplicate or foreign identities and mismatched
evidence revisions, permits an out-of-duration boundary only while its aggregate is review-required, and is
ordered deterministically by elapsed start, end, title, and identity. Stale source snapshots, missing ranges,
optimistic conflicts, invalid requests, query failures, and update failures have separate application and
desktop error codes. Eight focused application behaviors, the complete 167-test application suite, strict
application Clippy, architecture checks, and host transport compilation pass. SQLite persistence, import-time
evidence reconciliation, JSON transport shapes, and the Range Summary remain open.

### R8.3 personal-range persistence and desktop transport — 2026-08-22

SQLite schema 25 now persists each user-authored range separately from imported structure and reusable
criteria. The additive migration is atomic from every supported schema baseline, creates no inferred ranges,
keeps authored ownership recoverable without a destructive cascade, and remains part of the normal online
backup. Bounded reads reconstruct complete aggregates; create, compare-and-save, and compare-and-remove each
return their committed context from one immediate transaction with snapshot and optimistic-revision checks.

Import-time reconciliation runs inside the same visibility transaction as the canonical session change.
Exact repeat and semantically equivalent archives leave evidence and range revisions stable. Compatible
enrichment rebases current ranges without moving their boundaries; it cannot clear an existing review
requirement. Amendment retains exact authored boundaries as review-required until the person explicitly
adjusts or confirms them. Restart, overlap, duplicate titles, stale edits, removal, compatible enrichment,
amendment, review completion, and the version-24 rollback/retry migration are covered through real SQLite and
archive paths.

Five Tauri commands expose opaque query, create, rename, adjust, and remove inputs and one complete result.
The six JSON Schemas preserve exact elapsed milliseconds as decimal text, reject provider or storage identity,
and are checked against synthetic valid and invalid values. The canonical format, read model, schema-25
persistence, storage architecture, compatibility matrix, release notes, and release-readiness sources are
linked and current.

The final `test:fast` gate passes 156 tooling tests, 290 React tests, two vendored-updater tests, 216 host tests,
167 application tests, 42 domain tests, and two private-acceptance example tests, together with architecture,
contract, workflow, documentation, site, i18n, and UI-contract checks. Workspace Clippy with warnings denied,
Rust formatting, and diff whitespace checks also pass. The revision-coherent Range Summary, production range
interaction, criteria integration, packaged E2E/accessibility/performance evidence, and alpha UX review remain
open under R8.

### R8.4 exercise-ownership correction and Range Summary — complete 2026-08-23

The accepted range concept defines one range inside one exercise and requires route, signal, source-structure,
gap, and exact-boundary evidence to share that exercise's elapsed coordinate. R8.1 through R8.3 instead stored
only session ownership and session-relative boundaries. The canonical session duration is deliberately
independent of wall-clock timestamps, while route offsets are relative to route start and regular signal
offsets belong to an exercise role. Consequently, session ownership alone cannot prove the transformation
needed by Range Summary; subtracting local timestamps or assuming that every exercise starts with the session
would invent a clock relationship.

R8.4 therefore corrects the unfinished Alpha contract before adding presentation. Current authored ranges must
carry an opaque exercise owner and exercise-relative elapsed boundaries. Any version-25 row created through
the lower-layer command before production UI existed is retained as an explicitly review-required legacy
session-coordinate range; it is never guessed onto an exercise or discarded. Explicit review can anchor that
legacy object to one current exercise, while an already anchored range cannot be reassigned silently. The
additive migration, application transitions, transport schemas, canonical documentation, and reimport
reconciliation must be corrected and verified before the revision-coherent Range Summary is implemented.

The exercise-ownership correction is complete locally. Canonical range version 2, read-model version 2, and
SQLite schema 26 now define one exercise-relative current range, immutable established exercise ownership,
and explicit anchoring of preserved legacy evidence. The atomic schema-25 migration retains every authored
field and optimistic revision while changing only the unverifiable owner and review state; interruption leaves
the complete version-25 representation intact. Query and mutation contexts carry a bounded current exercise
catalogue, and domain, application, persistence, removal, reimport, and desktop transport all validate the
same ownership contract.

The complete fast gate passes 156 tooling tests, 290 React tests, two vendored-updater tests, 217 host tests,
170 application tests, 44 domain tests, and two private-acceptance tests. Strict workspace Clippy, Rust
formatting, architecture, contract, migration, compatibility, documentation, localization, site, workflow,
and UI checks also pass. Range Summary remains the active R8.4 work; production range interaction, criteria
integration, packaged E2E/accessibility/performance evidence, and the Alpha UX review remain open under R8.

Range Summary falsification then exposed a second lower-layer mismatch before any UI used the contract. The
official source correspondence defines route waypoint offsets relative to route start and lap split offsets
relative to exercise start, while declared exercise duration remains an independent measurement. Regular
series have their own interval coordinate. A privacy-minimized structural check of the maintained compatibility
source confirms that route start, route extent, lap extent, series extent, and declared duration cannot be
treated as one interchangeable upper-bounded coordinate. No personal value, count, timestamp, path, or
fingerprint enters this evidence record.

R8.4 is therefore reopened at the coordinate model rather than hiding the mismatch inside Range Summary.
The next correction must represent the exact coordinate authority of a boundary, preserve the schema-26
exercise-owned rows without guessing a representation, and permit cross-representation synchronization only
when an explicit recorded relationship proves it. Declared duration remains a useful source measurement but
cannot be the universal upper bound for route, series, source-lap, and manual boundaries. Range Summary starts
only after domain, application, persistence, and transport enforce that distinction.

### R8.4 Session Story coordinate correction — 2026-08-22

The first correction removes one invalid downstream dependency before the range model builds on it. Session
Story version 3 adds an explicit `alignmentState` to every eligible signal overlay. The current Polar mapping
emits `unavailable` and an empty aligned-sample collection because route and regular-series offsets have
different recorded authorities. Presentation keeps that signal independently explorable and excludes it from
route coloring and synchronized cursor interaction. The versioned contract reserves `exact-recorded` only for
a future explicit source or canonical relationship; equal numbers, compatible cardinality, timestamp
subtraction, proximity, and interpolation cannot establish it.

The focused application, desktop transport, presentation, and schema checks pass. The complete fast gate
passes with 156 tooling tests, 291 presentation tests, two vendored-updater tests, 217 desktop-adapter tests,
170 application tests, and 44 domain tests. Strict Clippy and Rust formatting also pass. The next R8.4 slice
defines coordinate authority for personal ranges; Range Summary remains downstream of that contract.

### R8.4 explicit range-coordinate correction — 2026-08-22

Personal ranges now name the exact elapsed authority that gives their boundaries meaning. The closed
provider-neutral value object distinguishes declared exercise elapsed, one opaque route coordinate, one
opaque regular-signal coordinate, and preserved legacy session elapsed. Established exercise and coordinate
ownership cannot change; only explicit review may anchor a legacy object to one current exercise and
coordinate. Bounds are validated against that exact authority rather than a universal exercise duration, and
range ordering never compares offsets from different coordinates as one timeline.

SQLite schema 27 preserves every schema-26 value and timestamp exactly while adding a scope-bound opaque route
or signal reference. It derives route extent from the greatest exact recorded waypoint offset and signal
extent from the last exact regular-sample position, without inventing a trailing interval. Creation, update,
removal, reimport reconciliation, restart, and review-required editing match the complete owner and coordinate.
A missing current coordinate can keep and rename authored review evidence, but cannot make it current.
Atomic interruption, retry, every declared schema baseline, mismatched scope/reference storage, route bounds
smaller than exercise duration, compatible enrichment, and missing-coordinate behavior have real SQLite
coverage.

Canonical range version 3, read-model version 3, three version-3 JSON Schemas, SQLite version 27, architecture,
compatibility, release, and current-status sources describe one contract. Machine checks add signed-64-bit
extent validation, exact scope/reference discrimination, current-coordinate availability, legacy-state, and
cross-object consistency evidence. The complete fast gate passes 156 tooling tests, 291 presentation tests,
two vendored-updater tests, 218 all-feature host tests, 172 application tests, and 46 domain tests. Strict
workspace Clippy, Rust formatting, architecture, migration, contract, documentation, localization, site,
workflow, and UI checks also pass. Range Summary is now the active R8.4 slice.

### R8.4 revision-coherent Range Summary — 2026-08-23

One application-owned read model now answers a named personal range only against its exact discovery snapshot,
optimistic range revision, exercise owner, and exercise, route, or regular-signal coordinate. Its dedicated
port reads validated context and then visits raw route points or signal slots in source order; SQLite does not
join independent clocks or calculate presentation metrics. Exercise ranges can attribute exact source-lap
overlap, route ranges calculate recorded Haversine geometry and initial bearing, and signal ranges aggregate
the half-open `[start, end)` interval while retaining the end sample as exact boundary evidence. Moving and
paused duration remain explicitly unavailable until recorded evidence can prove them.

Falsification covers non-exact boundaries without interpolation, independently missing waypoint elapsed and
altitude values, gaps, distance-series deltas, ambiguous source distance, stale snapshot and range revision,
malformed streams, 100,001 streamed signal slots with bounded returned gaps, and the exact route-end case that
must exclude a following untimed point. Review-required ranges remain queryable when their route, signal, or
owned exercise has disappeared; their authored owner, coordinate, boundaries, and prior evidence revision
remain intact and the summary becomes unavailable instead of guessing or failing. A real amendment that
removes the exercise passes import reconciliation, optimistic revision, SQLite restart/query, summary, and
provenance coverage.

The Tauri command exposes stable invalid, changed, and local-failure outcomes through two version-1 JSON
Schemas. The versioned read-model specification, data-format index, architecture, testing strategy, transport
serialization, exact signed-64-bit strings, public provider attribution, cross-object semantics, and
private-identifier exclusions are machine checked. The complete fast gate passes 156 tooling tests, 291 React
tests, two vendored-updater tests, 220 all-feature host tests, 192 application tests, 46 domain tests, and two
private-acceptance tests. Strict workspace Clippy, Rust formatting, architecture, contracts, documentation,
localization, site, workflow, and UI checks also pass. R8.5 owns the complete production interaction for
creating, selecting, reviewing, adjusting, renaming, removing, and reopening ranges; reusable-criterion and
cross-surface boundary integration, plus the final Alpha UX review, remain open under R8.

### R8.5 production range library and editor — complete locally 2026-08-23

The independently usable increment adds a dedicated personal-ranges task inside session detail. It queries the
complete revision-bound range context, presents current and review-required authored ranges without exposing
opaque capabilities, resolves the selected Range Summary, and supports create, reopen, rename, adjust, cancel,
and guarded remove operations through the existing atomic commands. Exercise and coordinate choices come only
from the returned context; exact millisecond values remain decimal text internally while people edit localized
elapsed values with ordered, in-extent validation. The concise result uses human-scale duration, distance,
direction, and measurement values before a closed exact-evidence disclosure. Empty, loading, unavailable,
stale, conflicting, failed, multiple-range, restart, reimport-review, keyboard, focus, and compact/zoom states
belong to the increment rather than deferred error decoration.

The final packaged campaign passed the complete import journey in 2 minutes 41.3 seconds, new-process restart in
989 milliseconds, and evidence-adaptive composition in 3.9 seconds. It creates, validates, reopens, renames, adjusts,
reviews after reimport, cancels and confirms removal, preserves one range through restart, scans accessibility,
and asserts English wide plus Spanish dark compact 200% geometry without horizontal overflow. The isolated two-year
dense campaign passed in 3 minutes 16.9 seconds: route-workbench open p95 was 84 milliseconds, route selection
1 millisecond, deliberate independent-signal reveal 21 milliseconds, four-series signal overview 323
milliseconds, deliberate fourth-series selection 7 milliseconds, and exact signal pagination 200 milliseconds,
all below their accepted budgets. The complete fast
gate passes 156 tooling tests, 306 React tests, two vendored-updater tests, 220 all-feature host tests, 192
application tests, 46 domain tests, and two private-acceptance tests. Visual review rejected source-scale distance,
fractional summary noise, incorrect singular evidence copy, and clipped high-zoom result context before accepting
the final evidence.

An earlier performance campaign exposed that the runner added WebDriver transport and polling time for deliberate
fourth-lane selection to the independently measured signal-overview opening. The final evidence separates the two
user interactions, and the selection timer begins at the actual captured click inside the WebView.

Subsequent self-review rejected an existing-but-zero-extent coordinate as an adjustable timeline and bounded
elapsed-field input before `BigInt` parsing. The application rebuilt from those exact inputs passed the complete
fast and packaged campaigns recorded above.

R8.6 will then make the same draft and selected range controllable from the dominant route map, regular-signal
lanes, and source structure. It will add synchronized adjustable handles only within one proven coordinate,
retain the route during naming and adjustment, and use an in-workbench inspector at wide geometry plus a
stacked task mode at compact width or high zoom. R8.5 does not simulate cross-representation alignment or add
parallel range state; the atomic range context and editor draft remain the single production interaction
model consumed by R8.6.

### R8.6 cross-representation range interaction — complete locally

R8.6 proceeds as five independently demonstrable slices while preserving one range state and one command path:

1. Lift the R8.5 query, selection, draft, mutation, and conflict lifecycle into a session-owned controller that
   can compose more than one representation without duplicating persistence or mounted state.
2. Add pointer and keyboard route-range handles on the exact selected route coordinate. The map remains dominant
   and visible beside the shared inspector at wide geometry, then stacks above it at compact width or high zoom.
3. Add equivalent range selection to a regular signal's own elapsed coordinate. It remains in the signal
   workbench unless an importer supplies an exact route relationship; equal offsets never synchronize it to a map.
4. Add source-structure and exact-evidence boundary entry points only where their recorded coordinate is explicit.
   Source laps remain attributed evidence, and an authored range remains a separate object even when boundaries
   or titles overlap.
5. Close duplicate-name, overlap, invalid/gapped/unavailable, cancellation, restart/reimport, locale, theme,
   keyboard, assistive-technology, responsive, dense-session performance, and Alpha UX review evidence together.

Each slice must remain usable after its own commit. A representation may request or adjust the controller's
temporary boundaries, but only the controller may create, rename, adjust, remove, reload, or resolve a saved
range. Direct representation integration must not introduce a second editor, an inferred coordinate transform,
or a presentation-owned copy of durable range state.

Slices 1 and 2 are complete locally. The session detail now owns one range controller and one reusable form;
the dominant route workbench requests and adjusts that draft through exact timed route points, projects only
exactly represented boundaries, retains approximately three quarters of a wide workspace for the map, and stacks
the inspector at compact width or high zoom. A saved range for the visible route remains explicitly selectable
even when the shared controller currently points at another coordinate; route changes never redirect it.

The independently usable route slice passes 156 tooling tests, 308 React tests, two vendored-updater tests,
220 all-feature host tests, 192 application tests, 46 domain tests, and two private-acceptance examples, together
with the production build, strict Clippy, Rust formatting, architecture, data-contract, documentation,
localization, workflow, site, UI-contract, and diff gates. The exact packaged executable passed the complete
functional journey in 2 minutes 45.4 seconds, a new-process restart in 1 second, adaptive-session composition in
3.9 seconds, and the isolated two-year performance campaign in 3 minutes 26.4 seconds. Route-workbench opening
was 76 milliseconds at p95 and route selection was 2 milliseconds at p95, below their respective 1,000- and
100-millisecond budgets. The final evidence-refined functional journey passed in 2 minutes 48 seconds.

Independent visual review rejected a 63.75% map allocation caused by a fixed inspector minimum, a sole visible-
route range that disappeared while another coordinate was selected, and compact evidence that did not actually
show the stacked map and inspector. The accepted evidence now covers saved and editing states, both ends of the
internally scrollable wide inspector, map and inspector stacking, English wide geometry, Spanish dark 200%
geometry, and unobstructed placement below sticky navigation. Slices 3 through 5 and the complete final R8.6
gate remain open; this checkpoint does not claim signal, structure, or exact-evidence interaction.

Slice 3 is complete locally. The same controller and editor now compose beside the leading independent signal
chart. The recorded-position control, exact start/end controls, plot selection, saved-range choice, adjustment,
cancel, and exact-sample handoff all retain the selected regular signal's own elapsed coordinate. Typed
boundaries absent from the bounded visual projection remain exact and unmarked. Equal route or other-signal
offsets are never consulted.

The complete fast gate passed 156 tooling tests, 312 React tests, two vendored-updater tests, 220 all-feature
host tests, 192 application tests, 46 domain tests, and two private-acceptance examples, together with the
production build, strict Clippy, Rust formatting, architecture, contracts, documentation, localization,
workflow, site, UI-contract, and diff gates. The exact packaged executable passed the complete functional
journey in 2 minutes 51.7 seconds, general new-process recovery in 990 milliseconds, adaptive-session
composition in 6 seconds, independent-signal range recovery in a second new process in 697 milliseconds, and
the isolated two-year performance campaign in 3 minutes 6.7 seconds. Signal overview measured 339 milliseconds
at p95, fourth-series selection 6 milliseconds, exact signal pagination 207 milliseconds, independent-signal
reveal 21 milliseconds, route-workbench opening 76 milliseconds, and route selection 2 milliseconds, all below
their accepted budgets.

Independent visual review covers the editor and saved states in English at wide geometry, and the chart plus
stacked inspector in Spanish, dark appearance, compact geometry, and 200% content zoom. The first compact
capture was rejected because it proved only adaptive navigation rather than the signal task itself. The
corrected packaged evidence scrolls both the chart and inspector below sticky navigation, asserts that neither
is obstructed or creates horizontal overflow, and retains zero Axe violations. Slices 4 and 5 and the complete
final R8.6 gate remain open; this checkpoint does not claim structure or exact-evidence interaction.

Final self-review also rejected allowing the visible signal, visible route, or saved-range selectors to replace
or hide the sole shared draft. These context selectors now remain visibly locked while an edit is active and
become available again after save or cancellation; focused component and packaged tests cover both transitions.

Slice 4 is complete locally. Valid complete-
exercise, source-lap, and automatic-lap intervals can seed the same unnamed exercise-coordinate draft without
renaming, modifying, or hiding the attributed source evidence. Paginated exact route and signal disclosures
offer one compact native selector for entries with explicit elapsed evidence. A selected point or sample seeds
adjacent exact boundaries, and an active same-coordinate draft can deliberately reuse another selected entry as
either boundary. Points without elapsed evidence are excluded rather than assigned a position from table order.
One exact-evidence editor is composed before session-detail navigation, receives focus and scrolls into view, and
uses the controller's coordinate authority; no table, picker, or workbench owns another command path or durable
draft.

The final complete fast gate passed 156 tooling tests, 316 React tests, two vendored-updater tests, 220 all-
feature host tests, 192 application tests, 46 domain tests, and two private-acceptance examples. The production
build, strict Clippy, Rust formatting, architecture, contract, documentation, localization, workflow, site, UI-
contract, and diff gates pass. The exact packaged executable passed the complete functional journey in 3 minutes
17 seconds, general new-process recovery in 1 second, adaptive-session composition in 7.5 seconds, exact range
recovery through a second process after reimport in 1.2 seconds, and the isolated two-year performance campaign
in 3 minutes 38.4 seconds. Route-workbench opening measured 75 milliseconds at p95, route selection 1
millisecond, independent-signal reveal 24 milliseconds, signal overview 296 milliseconds, fourth-series
selection 8 milliseconds, and exact signal pagination 234 milliseconds, all below their accepted budgets.

Independent visual review covers the exact-sample selector, selected recorded row, and separate range action;
the source-structure timeline with attributed laps and an overlapping personal band; and the stacked selector in
Spanish, dark appearance, compact geometry, and 200% content zoom. The first exact-sample capture was rejected
because scrolling to the selected row hid the new entry point. The first compact structure capture was rejected
because it proved navigation rather than the range task. The corrected evidence explicitly reveals each target,
asserts unobstructed geometry and no horizontal overflow, and retains zero Axe violations.

Full regression exposed and corrected two structural assumptions rather than weakening their tests. Recorded
source laps are now identified by their visible collection identity instead of their former first-child position.
An exact result can no longer win a focus race after an explicit range-editor action: the shared focus policy gives
that action priority only until the new heading receives focus, then again preserves any later user movement.
At the slice 4 checkpoint, slice 5 and the complete final R8.6 Alpha gate remained open.

Slice 5 and the complete R8.6 Alpha gate are complete locally. The final audit found that equal authored titles
were legal but not distinguishable in every choice, and that route and signal component tests used value-change
events while claiming keyboard evidence. Every saved-range choice now exposes its exact coordinate boundaries;
duplicate-title action names include those boundaries, so titles remain labels rather than identity. Route and
signal controls use one bounded Arrow, Home, and End stepping policy. Component tests send real key presses, and
the packaged journey sends those keys to the active native range control in the application process.

The closed acceptance matrix retains overlapping and duplicate-titled authored ranges as distinct aggregates;
covers invalid, equal, reversed, gapped, unavailable, and out-of-extent evidence; and exercises save,
cancellation, adjustment, removal, conflict, restart, exact reimport, review-required recovery, both locales,
dark appearance, compact layout, 200% content zoom, pointer and keyboard use, and exact-evidence entry. Axe
reports no violations in the packaged journey. Application and component tests own exhaustive boundary cases;
the packaged campaign owns the integrated lifecycle rather than duplicating every lower-layer permutation.

The final complete fast gate passed 156 tooling tests, 319 React tests, two vendored-updater tests, 220 all-
feature host tests, 193 application tests, 46 domain tests, and two private-acceptance examples. The production
build, strict Clippy, Rust formatting, architecture, data, release, update, workflow, product-surface,
documentation, site, localization, UI-contract, syntax, and diff gates pass. The exact packaged executable
passed the complete functional journey in 3 minutes 1.8 seconds, general new-process recovery in 1 second,
adaptive-session composition in 7.6 seconds, exact range recovery through a second process after reimport in
1.2 seconds, and the isolated two-year performance campaign in 3 minutes 25.2 seconds. Route-workbench opening
measured 76 milliseconds at p95, route selection 2 milliseconds, independent-signal reveal 22 milliseconds,
signal overview 312 milliseconds, fourth-series selection 8 milliseconds, and exact signal pagination 229
milliseconds, all below their accepted budgets.

Independent visual review accepted the range library, route editor, signal editor, source-structure picker, and
exact-evidence entry in English wide and Spanish dark compact 200% states without horizontal overflow or sticky-
navigation obstruction. It rejected raw metre-scale summary output discovered in the compact structure capture;
the corrected summary now uses the same localized human-scale distance policy as other scannable session
surfaces while exact detail remains unchanged. No material Alpha range finding remains open. X5-R9 is the next
production increment.

## X5-R9 — Make reports result-first and portable

**User outcome:** a saved report opens as a useful resolved document, can be deliberately edited, and can
leave FitFreed as a trustworthy self-contained file.

**Domain and application work:**

1. Permit an empty narrative when title and supported evidence form a factual report; retain narrative
   as an optional authored block.
2. Add optimistic report deletion through domain/application policy and persistence, naming the exact
   removed object and preserving imported history and other reports.
3. Add a bounded report-library projection with subject, one meaningful resolved result, evidence state,
   period/date, sensitivity summary, and current/stale/unavailable status.
4. Preserve older blank-origin reports as readable data while removing the generic blank start from the
   ordinary MVP UI.
5. Preserve exact deliberate refresh, stable reviewed revision, deterministic HTML, privacy limits, and
   atomic failure behavior.

**Production work:**

1. Open Reports on a visual result library; an item opens its result, never its editor.
2. Start creation contextually from a supported session or comparison with compatible evidence selected.
3. Make result/finding and visual evidence primary; source, evidence state, export, edit, and delete are
   visible secondary actions.
4. Keep the editor's outline, substantial result preview, and focused inspector coordinated. Save returns
   to result; cancel restores the saved definition or creates nothing.
5. Replace the result with stale-evidence or export review rather than appending controls below a long
   editor. Reveal and collapse move focus and scroll predictably.
6. Show exactly what leaves FitFreed. Sensitive choices appear only for included sensitive blocks and
   cannot expand saved authority.
7. Export one deterministic self-contained HTML report; failed or cancelled write changes neither the
   saved report nor the destination.

**Behavior coverage:** contextual session/comparison starts; title and evidence validation; optional
narrative; multiple blocks; every compatible add; remove; move up/down; inspector edits; save; cancel;
reload; multiple reports; result-first reopen; current/stale/unavailable; refresh review cancel/accept/
conflict; source navigation and return; delete cancel/confirm/conflict; all privacy combinations; export
cancel/failure/success; independent output inspection; locale/theme/zoom; keyboard; accessibility;
restart; migration; report-library and export performance.

**Documentation:** reporting architecture, report-definition versioning, persistence/migration, HTML
format, user report lifecycle, privacy and export, deletion/recovery, test fixtures, and product status.

**Alpha evidence:** report hierarchy and composition receive a focused review; findings may refine the
Alpha interaction without changing its durable identity or export guarantees implicitly.

### R9 execution audit and slices — complete

The existing vertical already owns saved-definition resolution, a Preview workspace independent from
Compose, stale-evidence review, contextual source return, per-export privacy reduction, deterministic
self-contained HTML, cancellation, and atomic destination replacement. The audit found three structural gaps
rather than a missing vertical: version 4 still requires narrative commentary, no optimistic removal command
exists, and the bounded library projection exposes only title, locale, and revision instead of a recognizable
result and evidence state.

R9 proceeds in six independently usable slices:

1. permit factual version-4 reports without mandatory commentary and add revision-bound removal through the
   domain, application, persistence, transport, schemas, and contract documentation;
2. introduce a bounded result-oriented library projection through authoritative resolution paths;
3. replace the production library with result-first cards, remove the generic blank start from ordinary use,
   and expose deliberate deletion;
4. make commentary optional in Compose while preserving save, cancel, ordering, and result return;
5. retain stale review, source return, privacy reduction, deterministic export, and independent output
   inspection in the new hierarchy; and
6. close locale, theme, zoom, keyboard, accessibility, restart, migration, performance, and visual evidence.

No slice may resolve every saved report through the complete export path merely to render the library. The
bounded projection must obtain only the evidence needed for recognition and current-state disclosure.

**Execution state:** slices 1 through 3 are complete locally. Version-4 factual definitions accept no authored
narrative, while versions 1–3 retain their historical contract. Removal crosses domain authorization,
application orchestration, optimistic SQLite persistence, desktop transport, machine-readable schemas, and
normative documentation. The new result-first library pages up to 24 definitions, resolves one session or comparison
metric, preserves up to four sources without merging them, caches identical page queries, identifies current,
stale, unavailable, and authored-only evidence, and avoids route, signal, provenance, and export work.
Production now renders those facts as human-scale cards without visible references or revisions, opens a
saved card in Preview rather than Compose, removes the generic blank start, and offers revision-bound deletion
with cancellation, exact conflict recovery, focus restoration, and no imported-history mutation. The
supported comparison start remains expanded only for an empty Library and becomes one compact secondary
action once saved results exist. Visual falsification rejected an earlier composition that placed its expanded
start before saved results at 200% zoom; the corrected hierarchy keeps a useful portion of the first result in
view.

Slice 4 is complete locally. Evidence-backed starts now begin without an empty authored block. Compose exposes
deliberate optional commentary, preserves block ordering and drafts across stage changes, focuses add and remove
transitions outside compact navigation, omits empty drafts, protects legacy authored-only reports until evidence
exists, and resolves successful saves into Preview. Privacy review and deterministic HTML expose the title always
and commentary only when present. Factual reports survive restart, explicit evidence refresh, source return, and
export without manufacturing authorship. The packaged gate exposed and closed two cross-surface defects: compact
navigation reveal lacked report scroll margins, and the HTML renderer still assumed a narrative block solely for
buffer sizing.

The updated complete fast gate passed 156 tooling tests, 325 React tests, 2 vendored-updater tests, 224
desktop-host tests, 199 application tests, 48 domain tests, and 2 private-example tests. Strict formatting,
Clippy, the production build, localized contract checks, and the exact rebuilt packaged macOS journey passed. That
journey covered the main import and exploration flow, process restart, adaptive report composition, and the dense
two-year performance campaign inside every accepted budget. English and Spanish dark-theme evidence at 200% zoom
showed no horizontal overflow, clipped controls, or content covered by compact navigation. Slice 5 is next.

Slice 5 is complete locally. Preview now leads with the report title and its first ordered result before the
secondary action rail. A stale definition disables both direct editing and the Compose location, so neither
path can bypass deliberate candidate review. The audit traced stale review, exact source navigation and return,
per-export physiology and route reduction, authority non-escalation, deterministic self-contained output, and
atomic cancellation or failure through their domain, application, adapter, presentation, and packaged evidence.
The exact packaged functional journey passed with independent inspection of exported HTML and preservation of
the prior destination after cancellation. One initial performance campaign recorded a single longitudinal
outlier; no production or measurement file on that causal path had changed, and the unchanged isolated scenario
then passed every accepted budget. Slice 6 is next.

Slice 6 and R9 are complete locally. The final audit found and closed one lifecycle omission: changing report
locations preserved a draft as intended, but there was no explicit way to cancel it. **Cancel composition** now
restores the exact reviewed definition and Preview for a saved report, returns an unsaved contextual start to
its exact session or comparison, or returns a Library-owned start to Library; every path restores a meaningful
focus target and performs no report write. Component tests activate saved and new cancellation from the
keyboard. Cross-workspace focus requests now deliberately override a control left active in the workspace being
hidden, for both session and comparison return paths.

The bounded benchmark now owns a full 24-report Library page, including reused comparison evidence, and a
complete maximum-route HTML export through application authorization, deterministic rendering, private staging,
synchronization, and atomic replacement. Their p95 measurements remain below the accepted 500-millisecond and
2-second budgets. On the clean executable-input revision `af60a49`, the maximum page measured 33.888
milliseconds p95 and the complete export 741.638 milliseconds p95. Migration evidence covers every declared
schema through version 27, including lossless report migration, and separate packaged processes restore report
definitions and the complete user state.

The final complete fast gate passed 156 tooling tests, 328 React tests, two vendored-updater tests, 224 desktop-
host tests, 199 application tests, 48 domain tests, and two private-example tests. Strict Rust formatting and
Clippy also pass. The clean executable-input revision `af60a49` passed the 3-minute-6-second functional journey,
the separate process-restart journey, both adaptive-session journeys, and the 3-minute-4.6-second isolated
two-year performance campaign inside every accepted budget. Axe, hierarchy, overflow, focus-return, and reveal assertions cover Library,
Preview, evidence review, and export review across English and Spanish, light and dark appearance, ordinary
zoom, and compact 200% zoom. Independent review accepted nine report captures after rejecting and correcting a
sticky-navigation obstruction in the review surfaces. No material R9 finding remains open. X5-R10 is next.

## X5-R10 — Harden the complete product journey

**User outcome:** the entire release-shaped application feels like one serious product and preserves the
existing library through installation, restart, update simulation, migration, and recovery.

**Work:**

1. Inventory every legacy presentation component, route, locale key, test, script, CSS selector, and
   incoming reference. Rehome live behavior and prove no live reference remains before removal.
2. Audit terminology, tone, hierarchy, dates, units, precision, icons, visuals, progressive disclosure,
   empty/partial/error states, exact evidence, focus, navigation, responsive behavior, reduced motion,
   theme, zoom, and privacy across every workspace.
3. Consolidate reusable components only where repeated responsibility is proven. Do not abstract merely
   to make the redesign appear internally uniform.
4. Exercise the complete first-run → acquisition → import → Home → answer → History → outdoor/indoor
   session → range/criterion → report → export → restart journey.
5. Repeat dense-history, dense-session, cold-start, import, query, report, bundle, memory, packaging,
   clean installation, migration, update replacement, forced recovery, and removal evidence for one
   exact executable-input fingerprint.
6. Update all version-matched user guidance, contributor onboarding, architecture, data formats,
   translation guidance, testing, troubleshooting, security, privacy, support, readiness, and product
   status. Remove stale claims only from current documents; historical closed plans remain unchanged.
7. Run the mandatory pre-human falsification audit and close every critical or major internal finding.

**Exit evidence:** complete local fast/full lanes as applicable, exact packaged E2E, Axe, automated
keyboard traversal, prepared manual VoiceOver and visual-evaluation protocols, all automated
responsive/locale/theme/zoom matrices, performance budgets, repository privacy and content gates, hosted
campaign for the exact fingerprint, and a coherent source revision handed to the independent audit. Manual
keyboard, VoiceOver, scaling, contrast, and realistic-use execution remains the final human gate after X6.

### R10.1 live-surface inventory — complete locally 2026-08-23

The production graph contains 88 reachable presentation entries from `src/main.tsx`; no component or route
module is orphaned. The five stable shell destinations and their activity, training, sleep, recovery,
aligned-history, report, source, and settings substates remain owned by their typed navigation contracts.
The automated inventory also accounts for all 567 CSS classes, 1,921 matching English and Spanish locale
messages, 101 automation scripts including 38 automatic script-test roots, and all nine packaged-test and
support files. Generated class families, SVG sprite ownership, Leaflet classes, typed dynamic dictionaries,
and contextual message interfaces are modeled as explicit consumers.

The incoming-reference review identified and removed five selectors belonging only to replaced history,
route, and signal compositions; 41 messages belonging only to the original import screen, superseded Home
answer, old training browser, old import summary, and unused update progress; and the fixed allowlist plus
script whose sole purpose was the already-completed first repository publication. Current repository-content,
secret-history, metadata, workflow, release, and publication gates retain the live safety responsibilities.
The compact overflow diagnostic now names only current recovery surfaces. A repository-wide reference search
returns no remaining consumer of the removed artifacts.

`npm run check:presentation-inventory` now fails on an unreachable production module, unconsumed locale key,
unowned CSS class, unreferenced automation script, or unregistered packaged-test file. It is part of the fast
lane and the portable CI quality job. Focused checker tests distinguish live imports, generated and external
class ownership, and exact versus dynamic locale consumption. R10.2 begins the cross-workspace language,
hierarchy, evidence, adaptive, and recovery audit against this clean live surface.

The complete fast lane passed 159 automation, 328 React, two vendored-updater, 224 host, 199 application,
and 48 domain tests. Rust formatting, strict Clippy, the production build, documentation, localization,
workflow, UI-contract, repository-content, and diff checks also passed. The rebuilt packaged macOS campaign
passed the functional journey, real process restart, adaptive complete and partial session compositions, and
the isolated two-year performance scenario. Every measured interaction stayed within its accepted budget;
the slowest common-interaction p95 was 37 ms, the slowest maximum-range p95 was 128 ms, and the route
workbench p95 was 75 ms.

### R10.2 whole-product presentation audit — in progress 2026-08-23

The first correction slice removes implementation language from ordinary import progress, History orientation,
and unsupported session-evidence notices. Import coverage still exposes every classified file and exact
incorporation count on deliberate request, while its visible terminology now describes files, usable history,
and records rather than artifacts, reconciliation, or canonical state. A limitation in a detailed signal or
zone view now states what that view does not show and confirms that the original ZIP retains it; it is no longer
presented as an alarm or as an internal support-status announcement.

The shared training formatter now exposes only meaningful recorded clock precision. Zero seconds and zero-only
fractional digits are omitted from session and report labels, while non-zero seconds and fractional digits remain
visible in exact evidence. An exact zero elapsed duration is shown at a human seconds scale rather than as zero
milliseconds; physiological interval measurements retain milliseconds because that is their meaningful unit.
The behavior is covered directly and through the affected report, route, session, source, import, comparison,
and localized packaged journeys rather than by deleting prior assertions.

The sleep and nightly-recovery answers now follow the accepted disclosure order. When one history is present,
the primary conclusion is the recorded average that answers the user's question; observation coverage follows
as supporting evidence. When several histories are present, their shared result identifies the number of
histories and every series leads with its own recorded average. Coverage remains the fallback conclusion when
no average can be calculated, so a missing result is not invented or duplicated. Home and History now describe
provider-neutral recorded sport types instead of exposing the source-profile implementation concept.

The full test run also exposed a latent synchronization race in the History refinement test introduced with
the reversible-filter journey: it waited for the always-present library shell and immediately queried a result
that appears only after the asynchronous search. The test now waits for that result boundary while retaining
every draft, applied-filter, removal, focus, and persistence assertion. This is test determinism work; no
production delay or bypass was added.

The third correction slice separates the product entrance from ordinary application work. First-run Home keeps
the visual impact needed to explain an unfamiliar local product, while Sources, History, Reports, and Settings
use a restrained task-workspace heading scale that leaves useful controls and results in the initial viewport.
The Sources heading now names the operation directly instead of using campaign language. An automated style
contract prevents these workspace headings from returning to promotional scale without an explicit contract
change.

Packaged visual review also exposed a false-positive Settings viewport assertion. It measured document
coordinates even when the workspace correctly restored a prior scroll position, so an off-screen heading could
still satisfy a check described as the initial viewport. The evidence helper now establishes the top of the
workspace and measures viewport coordinates before accepting the form placement. Separate scroll-restoration
coverage continues to protect the person's position when returning to a previously visited workspace.

The fourth correction slice treats cancellation and rejection as ordinary, recoverable import outcomes instead
of alarming failures. In both locales, the result, its consequence for the existing library, and the next safe
action fit in the initial viewport. A rejected archive presents no red alert and keeps the compatibility reason
collapsed until the person deliberately requests it; cancellation states plainly that no history changed. The
functional journey still opens and verifies the exact reason, so progressive disclosure does not weaken the
diagnostic contract.

The same slice removes implementation vocabulary from ordinary decisions without diluting deliberate exact and
provenance views. Repeat imports now explain future source-support improvements rather than mapping mechanics;
unclassified sports describe what the source did or did not name; route reports describe the remembered route
and endpoint hiding rather than opaque references; and report refresh describes earlier imported history rather
than canonical snapshots. Home, first-run preview, sleep orientation, and the session overview now lead with
recorded data, answers, and useful detail. Technical mapping, reconciliation, and evidence terminology remains
available where a person explicitly inspects source coverage, provenance, exact ranges, or report reproducibility.

The preceding answer-hierarchy slice passes all 332 React tests, the production build, localization parity,
live-presentation inventory, UI contracts, strict Rust linting, and Rust formatting. A rebuilt packaged
application passed the complete functional journey, separate real-process restart, complete and partial
adaptive-session scenarios, and the isolated two-year performance campaign. The slowest common-interaction p95
was 38 ms, the slowest maximum-range p95 was 125 ms, and the route workbench p95 was 76 ms; each remains inside
its accepted budget. R10.2 continues
with the remaining cross-workspace hierarchy, state, adaptive-layout, accessibility, privacy, and visual audit;
this evidence does not mark the work item complete.

The clean workspace-hierarchy revision `47729d4` passes the complete fast lane, production build, strict Rust
linting, Rust formatting, localization parity, live-presentation inventory, and UI contracts. Its rebuilt
package passes the 2-minute-6-second functional journey, real-process restart, complete and partial adaptive
session scenarios, and the isolated two-year performance campaign. The slowest common-interaction p95 was
86 ms, the slowest maximum-range p95 was 419 ms, and the route-workbench p95 was 79 ms; each remains inside
its accepted budget. Falsification review accepted the Sources, Settings, and training History captures
after the corrected Settings initial-viewport evidence placed its heading and controls on screen. R10.2 remains
open for the state, adaptive-layout, accessibility, privacy, and visual checks not covered by this slice.

The clean state-and-language revision `db6a8c1` passes the same complete fast lane, production build, strict
Rust linting, Rust formatting, localization parity, live-presentation inventory, UI contracts, repository-content
gate, and secret scan. Its rebuilt package passes the 2-minute-47-second functional journey, real-process
restart, complete and partial adaptive-session scenarios, and the isolated two-year performance campaign. The
slowest common-interaction p95 was 74 ms, the slowest maximum-range p95 was 441 ms, and the route-workbench p95
was 78 ms; each remains inside its accepted budget. Exact English rejection and Spanish cancellation captures
confirm the calm state hierarchy and collapsed diagnostic details. Current session-range evidence also confirms
human-scale zero duration, the simplified overview introduction, and useful summary content before exact values.
R10.2 remains open for the adaptive-layout, accessibility, privacy, and remaining visual checks not covered by
this slice.

The fifth correction slice applies the same restrained task-workspace hierarchy to activity, sleep, recovery,
and aligned-history exploration that already governs training, Sources, Reports, and Settings. Home no longer
truncates recorded or user-authored sport identities: names wrap at ordinary widths as well as enlarged content
zoom, and a session whose source records no sport uses the same concise identity as History. The packaged
journey now captures all six principal populated workspaces plus Spanish dark Home at compact navigation and
200% content zoom. Each capture boundary rejects horizontal overflow, content hidden beneath compact navigation,
and Axe violations before retaining visual evidence. The complete fast lane passes 159 automation, 335 React,
two vendored-updater, 224 host, 199 application, and 48 domain tests; the production build, strict Rust linting,
Rust formatting, documentation, localization, live-presentation inventory, and UI contracts also pass. Exact
package revision `6e9e358` passed the functional, restart, adaptive-session, and performance campaigns, but
manual capture review rejected its sleep answer because the final duration unit wrapped onto an isolated line.
The follow-up correction renders localized measurement parameters in their translated position while binding
each value to its unit. Sleep and recovery contracts cover the shared behavior, and the packaged journey now
rejects a result measurement spanning more than one rendered line. A rebuilt package containing that correction
remains the next gate, so R10.2 is still open.

The clean measurement revision `cd91496` passes the complete 3-minute-11-second functional journey, real-process
restart, complete and partial adaptive-session scenarios, and the isolated two-year performance campaign. The
slowest common-interaction p95 was 116 ms, the slowest maximum-range p95 was 523 ms, and route-workbench opening
remained 75 ms; each is inside its accepted budget. Automated layout evidence confirms one rendered line for the
localized sleep and recovery measurement parameters. Manual review accepts the corrected sleep capture: its
headline now wraps before the complete `7 h 30 min` value rather than isolating `min`, while the result, period,
coverage, visual explanation, and exact-detail disclosure remain in the initial viewport. R10.2 remains open for
the remaining adaptive-layout, state, keyboard, assistive-technology, privacy, and cross-workspace visual checks.

The sixth correction slice follows a presentation failure found while reviewing the complete current screenshot
set rather than accepting successful overflow and Axe checks as sufficient. Selecting a different section inside
a long session detail could replace content outside the visible area; at compact 200% zoom, the retained scroll
position left the session heading partly behind persistent navigation without revealing the newly selected
section. Every session-detail navigation action now focuses its selected region and aligns it through the shared
responsive reveal offset. Component tests preserve both focus and scrolling, packaged geometry rejects a selected
section behind desktop or compact navigation, and the static presentation contract binds all six section
destinations to the same behavior. The complete fast lane passes 159 automation, 335 React, two vendored-updater,
224 host, 199 application, and 48 domain tests together with production build, strict Rust linting, Rust formatting,
documentation, localization, live-presentation inventory, UI contracts, repository-content inspection, and secret
scanning. Clean revision `c783def` passes the 3-minute-42-second functional journey, real-process restart, complete
and partial adaptive-session scenarios, and the isolated two-year performance campaign. The slowest common
interaction p95 was 98 ms, the slowest maximum-range p95 was 482 ms, and route-workbench opening remained 78 ms;
all are inside their accepted budgets. The localized maximum-zoom section transitions retain focus, reject
horizontal overflow, and place every selected region below persistent navigation. R10.2 remains open for the
uncovered state, keyboard, assistive-technology, privacy, and remaining cross-workspace visual checks.

The seventh correction slice extends the truthfulness audit to the public entrance. The product site, README,
and canonical product-status model still described the accepted experience as a future presentation migration
after the map-led session workbench, personal ranges, and result-first reports had entered the current source.
The illustrative route also implied pace and heart-rate synchronization at a selected map point even though R8
deliberately removed that unsupported relationship. The public explanation now distinguishes implemented source
experience from release readiness, describes the remaining whole-product validation and independent audit, and
shows only route-point evidence that the application supports. A product-page contract rejects both stale future-
direction language and any renewed route-to-signal claim. Generated English and Spanish status surfaces remain
owned by `docs/product-status.json`; no download or release claim has been introduced. Product-surface equality,
localization, accessibility, publication, and composed Pages tests pass. The exact
[Product site workflow run](https://github.com/purnalica/fitfreed/actions/runs/32643545241) deployed revision
`6561148`, verified every public byte, and direct English and Spanish requests return the new implemented-
experience boundary. The matching repository-safety workflow also passes.

Rendered-page review accepts the updated English wide entrance and Spanish narrow entrance: the release boundary,
implemented-capability label, explanatory copy, five workspace labels, and dominant route surface remain readable
without visible clipping or truncation. These ignored synthetic captures are inspection aids, not publication
artifacts or release evidence.

The state review adds the missing presentation contract for a recoverable import failure. It preserves the previous
library, avoids an alert role, withholds Home because no new result exists, keeps the technical reason collapsed,
and retains a direct archive-selection action. The focused component suite passes all completed, repeated, rejected,
and failed outcome cases. This is regression coverage of existing production behavior, not a new failure path or a
substitute for final packaged failure evaluation.

The [hosted quality run for `6561148`](https://github.com/purnalica/fitfreed/actions/runs/32643545150)
then exposed a five-second timeout in a History presentation test. History investigation found that the test had
accumulated filtering, summary, exact session detail, personal ranges, source structure, route and signal evidence,
zones, provenance, focus return, and pagination across successive increments. The section-reveal assertions added
by `c783def` moved this already monolithic scenario just beyond the hosted per-test limit; increasing that limit or
removing an assertion would preserve the cause. Filtering and stable-snapshot detail are now separate behavioral
scenarios, with every prior assertion retained and the detail scenario selecting its intended session explicitly.
Its longest scenario takes approximately 1.2 seconds locally. The same full-suite run also revealed that the empty
calendar recovery scenario waited only for the permanently mounted library shell before requesting an asynchronously
loaded view control. It now waits for that observable control boundary. The focused scenarios and all 337 React tests
pass locally without retries, disabled validation, or a larger timeout. Hosted evidence for the corrected revision
remains required before this correction is accepted.

The current-document audit found that the accepted experience specification still disclaimed production
implementation, the redesign plan and roadmap still described X5 delivery as future work, the contributor
index pointed first to the paused release sequence, and the public-readiness ledger still reported the audit
state that preceded the systemic replacement. Their canonical status was corrected at that stage to distinguish
implemented R1–R9 capability, active R10 hardening, pending X6 acceptance, and unavailable public distribution. The ledger also
records the observed remote boundary rather than the obsolete setup plan: verified Actions-backed HTTPS Pages
is live, while the protected macOS release environment, independent release reviewer, immutable-release
setting, production trust, and candidate authority remain open. The automated current-document checker now
covers eleven canonical sources and rejects a regression to any of the three superseded redesign states.
Current user journeys, training and reporting architecture, data-format contracts, localization guidance,
support boundaries, and conditional release procedures agree with that status; closed plans, ADRs, and
historical audits retain their original evidence.

A second current-document pass then challenged task instructions and evidence descriptions rather than only
milestone status. It corrected first-run evaluation to begin from both direct Home actions, made the candidate
protocol exercise map navigation, independent signals, personal ranges, result-first report reopening,
deliberate composition, refresh, deletion, keyboard focus, and VoiceOver alternatives, and removed unsupported
route-to-signal synchronization from both candidate guides. The performance guide now describes the actual
20,001-point unavailable-alignment campaign, including recorded-track selection, source-ordinal focus, and
independent-signal reveal instead of superseded overlays and attached lanes. Requirements and the redesign
direction now reserve shared cursors and propagation for application-certified exact relationships while
retaining deliberate independent exploration. The contributor index identifies Milestone 3 as the later public
distribution sequence, and versioned execution guidance no longer publishes a workstation-specific SSH agent.
The requirements source now identifies itself as the living normative contract and no longer lists the resolved
macOS platform, accessibility, or release-architecture boundaries as open decisions. These corrections follow
current production contracts and executable test sources. The roadmap also retains the accepted environment-
qualified performance policy rather than referring to an unavailable fixed workstation profile; closed
checkpoint evidence remains unchanged.

Visual review also resolved an ambiguity between the map requirement and the accepted privacy boundary. The
MVP map promises geographically proportioned local geometry, direction, scale, bounds, gaps, and selection on a
neutral coordinate surface; it does not promise streets, terrain, place names, or external tiles. This is the
implemented and previously accepted local-first boundary, not a removal of recorded route investigation. The
current route guide now also reflects completed personal-range entry from independent signals, source structure,
and exact evidence instead of presenting that R8 behavior as future work.

#### Live reimport projection regression — open 2026-08-24

Manual development-preview use exposed two post-import failures after a previously processed ZIP was reimported
with a newer FitFreed build that supports more of its contents. Library Home did not present the newly incorporated
history, and opening the Sessions workspace left an activity indicator visible indefinitely without session content.
Restarting FitFreed made both the expanded Home projection and Sessions available, which proves that the new evidence
was persisted and narrows the defect to same-process projection invalidation or presentation request lifecycle rather
than import durability.

This is an R10.2 release blocker. Diagnosis must reproduce the upgrade-shaped reimport with synthetic evidence,
trace import completion through persisted projections and every renderer refresh boundary, identify the exact change
that introduced each regression, and assess whether other Home questions or History workspaces share the same defect.
Closure requires focused failing tests before production changes, successful reimport of newly supported evidence
without duplicates, immediate same-process Home refresh, a Sessions request that always settles into content, an
explicit empty result, or a recoverable failure, and packaged restart verification in both locales. A forced restart,
timeout, cleared local library, or suppressed loading state is not an acceptable correction.

The focused renderer reproduction holds the initial Home request, completes an upgrade-shaped reimport that enriches
existing evidence, observes the new Home projection, and only then releases the older startup result. Before the
correction, that late result replaced the post-import sports and restored the previous Training destination. Because
Training mounts independently of the visible top-level workspace, the stale destination also started a Sessions
request before the user deliberately opened History; a slow request therefore became the unexplained activity
indicator reported in manual use. The persisted mapping-upgrade integration scenario already proves that identical
source bytes are reassessed under the current adapter and mapping contracts, enrich structure, route, signal, and zone
evidence atomically, preserve authored ranges, and retain one logical session.

History identifies `cc0fccab` as the change that introduced unconditional publication by each completed Home request.
The later navigation-revision guard protected the selected top-level workspace but not `libraryHome` or
`exploreDestination`; `923b8c9` then added request ordering only to sport-classification projection refreshes. All Home
query producers now participate in one request sequence. Only its most recent success can publish the Home projection
or exploration destination, and a superseded failure cannot replace a newer successful state with an error. The
focused regression and all 56 application-shell tests pass. The packaged same-process repeat, cumulative extension,
settled Sessions, process restart, and both-locale evidence also pass in the exact `90a15af` application. Hosted
confirmation remains required before this blocker can close.

The exact hosted package for `ee8c856` then failed the 100-process cold-launch gate at 2,609 milliseconds p95
against the unchanged 2,500-millisecond budget. Earlier accepted revisions on the same runner image, operating
system, and hardware class ranged from 1,633 to 2,338 milliseconds p95, while the runtime change since the most
recent accepted baseline added only 319 CSS bytes and reduced the main JavaScript bundle by 80 bytes. Phase
evidence places the variation primarily between host setup and renderer start, so the single hosted result does
not prove a feature-level regression. It does prove that the current startup graph lacks enough tail headroom.
Rather than rerunning unchanged code or changing the budget, the correction removes work from the real production
boundary: the main JavaScript bundle is now 351,590 bytes instead of 491,694 bytes, the selected Spanish catalog
loads as its own cached module before a Spanish shell can become interactive, and ordinary Home startup defers
Sources, Settings, and import-outcome presentation modules. Explicit early navigation still reaches those
destinations, failed preference recovery still blocks unsafe work, and locale save, preview, reset, restart, and
fallback behavior remains covered. Focused TDD and the complete local fast lane pass with 339 React tests. The
clean local Apple Silicon package for `fd908ea` passes all 100 measured fresh processes at 445 milliseconds p95
against the unchanged 2,500-millisecond budget. The matching hosted package passes at 1,910 milliseconds p95,
then passes full-scale import, dense history, Insights, update-recovery preparation, and installation boundaries.
The subsequent functional E2E correctly rejected its export review because keyboard focus reached the review
heading while WebKit left that heading above the viewport. Root-cause history traces the focus contract to
`36d080e` and the explicit visibility gate to `af60a49`: the implementation relied on implicit focus scrolling,
which is not a deterministic reveal contract. A new component assertion fails against that behavior and passes
only when report Preview, refresh, privacy, deletion, cancellation, refresh outcome, export outcome, and removal
transitions explicitly align their revealed target. The focused 23-test report suite passes; full and packaged
verification pass locally with all 339 React tests and the complete functional, restart, adaptive-session, and
two-year performance journeys. Hosted revision `bb7298c` passes the corrected cold launch, full-scale import, dense
history, Insights, update-recovery preparation, and installation boundaries. Its functional journey crosses the
formerly failing export review and then rejects the Spanish dark compact 200% Reports Library because the useful
result is outside the measured viewport. Revision `fbe01f6` added an explicit result boundary, passed the complete
local package at the default requested window, and then failed identically in the hosted 1280-by-720 viewport. A
local test fixed to the same 1280-by-720 window reproduces the hosted coordinates and failure. History traces the
failure to two navigation offsets: `b3918ff` introduced a manual offset before report reveal margins existed, and
`af60a49` later supplied the same persistent-navigation clearance through the shared production
`scroll-margin-block-start`. The result wait remains valid, the 60% useful-result requirement is unchanged, and the
deterministic test now uses that production reveal margin as the single source of positioning truth. Complete local
verification passes for exact revision `90a15af`, including all 340 React tests and the packaged functional, restart,
adaptive-session, and two-year performance journeys. Clean hosted verification remains required before this
correction becomes accepted evidence.

Clean hosted run `32717706989` for `975c38b` passes the portable lane, cold launch, full-scale import, dense history,
Insights, update-recovery preparation, installation boundaries, and the complete instrumented functional package.
Its final synthetic replacement journey then fails before publishing a recovery attempt. The retained screen shows
the authenticated 0.2.0 candidate and the stable `update-recovery-failed` boundary; both hosted evidence and an exact
local reproduction leave only the private outcome lock, before the attempts directory exists. Inspection of the
copied 0.1.0 bundle identifies `org.fitfreed.desktop.e2e`, while recovery correctly accepts only the canonical
production `org.fitfreed.desktop` identity. History traces the mismatch to `8a08ef0`: that revision deliberately gave
ordinary packaged UI tests a stable isolated macOS identity, but the shared configuration also changed the synthetic
update packages that must exercise production recovery identity.

The correction does not weaken recovery validation or remove functional-test isolation. The update build contract
now requires an application identifier, and the update harness obtains the production value from the canonical Tauri
configuration for both synthetic versions. The ordinary packaged journey retains its distinct E2E identity and target.
A focused configuration regression fails before the correction and passes after it. The complete local synthetic
journey then replaces 0.1.0 with 0.2.0, confirms the new candidate, deliberately rejects a second candidate, restores
the exact 0.1.0 application/library pair, retains Spanish preferences and SQLite integrity, presents both terminal
outcomes, and removes recovery state only after acknowledgement. Hosted verification of the correction remains the
R10 gate.

Hosted run `32724259485` for `caa800c` proves the corrected identity through every portable and macOS gate before
GitHub cancels the still-running final replacement/recovery step. The macOS job ran for 60 minutes and 17 seconds;
its first sixteen steps passed, the final campaign had run for 8 minutes and 52 seconds without an assertion failure,
and no failure-evidence step ran because the job conclusion was `cancelled`, not `failure`. The preceding hosted
identity failure reached its deterministic result after 9 minutes and 21 seconds. This identifies the fixed
60-minute orchestration limit, introduced with the update campaign itself, as the cancellation boundary rather than
a product or scenario defect. The job allowance is now 75 minutes, retaining a bounded 15-minute margin while every
operation watchdog and product-performance budget remains unchanged. A workflow contract protects that allowance;
one clean hosted campaign is still required before R10 acceptance.

Exact hosted run [`32730636262`](https://github.com/purnalica/fitfreed/actions/runs/32730636262) for `80a4709`
then passes repository safety, the 4-minute-18-second portable lane, every macOS performance and lifecycle gate,
the 12-minute-41-second functional package, and the 9-minute-27-second replacement/recovery campaign. The macOS
job completes successfully in 55 minutes and 30 seconds, and the final evidence job records executable-input
fingerprint `29dd0dd0b8d63c4d62e57c989f33ae3e8c3ca5997cfa980f4cdf8dc60e85f3a0`. No failure artifact is produced.
This closes the automatable R10 gate without changing a product budget, scenario watchdog, security validator, or
acceptance assertion.

#### R10.2 evidence matrix

| Concern | Current evidence | Remaining gate |
|---|---|---|
| Public purpose and truthfulness | Generated README and bilingual site now match current implemented capability; exact Pages and repository-safety workflows pass for `6561148`. | Reopen only if X6 or a later correction changes a public claim. |
| Terminology, hierarchy, dates, units, precision, icons, visuals, and disclosure | Seven R10 correction slices, the complete live-surface inventory, the complete React suite, static contracts, and the renewed X6 inspection cover the current ordinary application. | Final human comprehension and usefulness review remains required. |
| Empty, active, completed, repeated, cumulative, rejected, cancelled, failed, partial, stale, and recovery states | Exact R10 journeys cover every named state. X6 then independently repeated active import, cancellation, rejection, exact repeat, extension, library preservation, partial-session adaptation, and stale-report refresh. It corrected repeated unavailable partial-session measurements instead of accepting fixed empty slots, and exact hosted source `246faed` passes the complete campaign. | No automatable X6 gate remains; eventual sealed-candidate evidence remains separate. |
| Navigation, return, restart, and focus | Packaged process restart, workspace restoration, contextual return, cancellation return, and all six session-section focus and geometry contracts pass. X6 independently preserved exact Home-origin focus across session depth and checked the focused route state. | Complete the all-controls manual keyboard traversal under the X6 product-experience profile, then repeat the applicable evidence for an eventual exact candidate. |
| Responsive layout, locale, appearance, zoom, contrast, and reduced motion | R10 matrices cover both locales, appearances, wide and compact geometry, and 100% through 200% zoom. The renewed audit adds 47 fresh application states without page-level horizontal overflow, including Spanish, dark, compact, 200% use. | Complete contrast, scaling, and reduced-motion observation under the X6 product-experience profile. |
| Assistive technology | Packaged Axe runs cover the complete product journey. X6 found and corrected a duplicate import-coverage landmark; all 47 renewed states then completed without an Axe violation and focused behavior contracts remain green. | Complete manual VoiceOver evaluation in English and Spanish under the X6 product-experience profile. |
| Privacy and data exit | Exact packaged export review proves per-export physiology omission, endpoint reduction, no latitude, longitude, script, or network reference, atomic cancellation, and self-contained HTML; repository and secret scans pass. | Apply the privacy-safe X6 product-experience profile without retaining personal evidence; repeat the complete procedure for an eventual exact candidate. |
| Performance and lifecycle | [Hosted campaign `32743509696`](https://github.com/purnalica/fitfreed/actions/runs/32743509696) passes the complete portable and macOS campaign for corrected source `246faed` and executable-input fingerprint `3e0c2eb1dddc33cd295c8b6b504650b32e392589d396b7f835f53dec4f68e9d8`. | Retain this reusable evidence or repeat the campaign for an eventual release tag if its executable-input fingerprint differs. |
| User, contributor, architecture, format, translation, testing, support, and readiness documentation | The current-document audit aligns the accepted specification, redesign plan, roadmap, contributor index, readiness ledger, current user journeys, thematic architecture, data-contract index, localization, support, and conditional release guidance. The renewed reaudit is the durable disposition of the X6 machine-assisted boundary, and the exact hosted result is recorded. | Retain the final human result in the readiness ledger without duplicating its procedure. |

## X6 — Repeat the independent product-experience audit

The audit starts from a clean first run and does not use milestone status, prototype familiarity, test
knowledge, or implementation intent as evidence. It evaluates:

1. five-second purpose and trust comprehension;
2. acquisition and real production archive selection;
3. safe compatibility, import, repeat, extension, and recovery;
4. time to the first evidence-backed personally recognizable result;
5. remembered-session discovery and origin-aware return;
6. outdoor route investigation, separate signal inspection, exact evidence, relationship boundaries, and
   partial-session honesty;
7. personal range and criterion control;
8. report result, edit, refresh, deletion, and independent export;
9. settings, localization, appearance, zoom, keyboard, assistive technology, responsive layout, and
   serious factual tone; and
10. desire and credible reasons to continue using the product after the first minutes.

Any unresolved critical or major finding reopens the owning increment. Green automation, attractive
screens, or successful lower-layer operations cannot override the finding. Final human product-owner
experience review occurs only after the independent machine-assisted audit has challenged and corrected
the candidate.

### Machine-assisted and hosted result — complete 2026-08-24

The renewed [product-experience reaudit](../research/mvp-product-experience-reaudit.md) starts from a clean
synthetic library and challenges first run, acquisition, import outcomes, Home, History, route and signal
evidence, partial sessions, personal ranges, report creation/edit/refresh/export/deletion, Settings, localization,
appearance, zoom, compact layout, and origin-aware return through the packaged application. It records 47 fresh
states without page-level horizontal overflow or an Axe violation.

The audit found two defects rather than accepting the initial result: duplicate named landmarks around the
import-coverage table and repeated unavailable metrics in a partial-session overview. Both have focused failing
tests, corrections at their presentation causes, and fresh packaged evidence. No critical or major finding remains.

This closes the automatable X6 boundary. Exact repository safety and the complete hosted campaign pass for
corrected source `246faed` and executable-input fingerprint
`3e0c2eb1dddc33cd295c8b6b504650b32e392589d396b7f835f53dec4f68e9d8`. Native archive selection, full
keyboard use, VoiceOver in both locales, contrast, reduced motion, realistic comprehension, and desire to
continue remain human evidence and are not inferred from Axe, screenshots, or hosted automation.

### Human evaluation — rejected 2026-08-25

The first session stopped before import because the documented E2E application replaced production-native boundaries.
Finding XH-02 in the [human evaluation record](../research/x6-product-experience-human-evaluation.md) owns that invalid
session and the corrected review profile. The profile builds a revision-isolated application without the E2E feature,
frontend test flag, WebDriver command routing, or production library identity. Its complete bundle scanner, local
verification, repository-safety run, and hosted campaign pass for source `41ffad2`.

The restarted production-native session rejects that source independently of the green automation. Acquisition
actions appear inert, wrong and successfully reselected archives lose their explanation or visible destination,
finalization appears stationary, temporary History unavailability is unexplained, every imported sport remains
unrecognized, prominent Home summaries are dead ends, the overall date boundary is not trustworthy, and shared text
and form composition underuse the desktop workspace. Cancellation followed by immediate retry and finalization
followed by navigation recovery do pass. The session stopped after Home because the critical and major findings already
invalidate X6; later workspaces cannot repair a failed first-value journey.

### Human-rejection causal disposition

| Findings | Root cause established before correction | Owning increment |
|---|---|---|
| XH-08 | Training mapping preserves an opaque numeric sport reference. The export's sport-profile artifact carries stable sport codes but no numeric session identifier, and its array order does not correspond to the numeric values present in sessions. Training targets can carry a stable sport code, but only some targets share an exact scheduled timestamp with a recorded session, and one opaque numeric value can occur with more than one detailed target sport. A global numeric lookup or profile-array positional join would therefore invent identity. The importer currently ignores every available source-side naming artifact and delegates all recognition to the user. | X7-R2 |
| XH-10 | Home combines the minimum and maximum dates of all domains. Activity persistence can retain a source day even when its supported measurement is unavailable, so a placeholder observation can define the prominent global boundary without explaining its domain or usability. | X6-C1 |
| XH-01, XH-04 | The application-owned opener reports success after spawning a detached operating-system process; it does not observe whether that process accepted the destination or whether the default browser appeared. Spatial transitions inside Sources remain a separate focus-and-scroll contract. | X7-R1 |
| XH-03 | Resource-limit validation distinguishes entry count, member size, total expansion, compression ratio, and read bounds internally, then collapses them into one terminal code and one vague processing-limit sentence. The stable presentation contract has discarded the reason needed for a useful recovery action. | X7-R1 |
| XH-06, XH-07 | Reconciliation now emits one progress event per canonical item through a Tauri channel and React state update. Large libraries can therefore saturate the renderer with thousands of updates. Outside Sources, the shell strips the numeric progress and retains only a static phase label, so navigation appears stuck even when work continues. | X7-R1 |
| XH-09 | Home sport cards and History sport summaries remain facts with classification actions, while the session library already supports an exact sport refinement. Navigation lacks a typed represented-sport-to-filtered-sessions route with origin and focus restoration. | X7-R2 |
| XH-05, XH-11, XH-19, XH-20 | Role-based line measures and one corrected form do not supply a global presentation system. Live surfaces still expose exhaustive detail, repeated set-level attribution, inconsistent numeric alignment, and task controls before conclusions. | X7-R3 |
| XH-12 | Settings mixes an immediately persisted reset with a local preview discard and a later save. The labels and separated action geometry expose two incompatible transaction models. | X7-R3 |
| XH-13 | Empty-state privacy copy reuses the populated-library promise and therefore names an archive and library that do not yet exist. | X7-R1 |
| XH-14, XH-15 | Direct `Intl.NumberFormat` calls inherit locale-specific minimum grouping for four-digit counts, while one shared duration formatter always emits every non-zero unit through milliseconds regardless of presentation purpose. | X7-R3 |
| XH-16 | The local Leaflet adapter sets no route-relative minimum zoom, allowing a session route to shrink to a meaningless continental or planetary scale. External-tile cartography remains a separate post-MVP capability. | X7-R4 |
| XH-17 | Training, sleep, recovery, and longitudinal comparison forms initialize both sides from the same range; only activity computes adjacent periods. There is no shared period-preset contract anchored to available evidence. | X7-R2 |
| XH-18 | The artifact registry explicitly classifies training targets as unsupported. The source files contain named objectives, exercise sports, ordered phases, goals, intensity bounds, transitions, jumps, and repetitions, but no provider-neutral planned-training model or authoritative completed-session relationship exists. | X7-R5 |
| XH-21 | System, light, and dark appearance meet the first-MVP setting contract. Curated visual themes are a confirmed evolution direction but are not required to correct the rejected evidence experience. | Post-MVP experience-personalization track |
| XH-22 | ADR 0013 deliberately chose semantic HTML for bounded early visuals and defines richer interaction as a reconsideration trigger. Multi-series analytical comparison, axes, scale, gaps, selection, and reusable report graphics now cross that trigger; the application is recreating chart-engine behavior without a viable general foundation. | X7-R4 |
| XH-23 | Report definitions already have independent identities and complete persistence, but the application exposes neither versioned built-in example descriptors nor an application use case that deep-copies a definition into fresh report and block identities. | X7-R6 |

This table records causes, not implementation permission to weaken safety, evidence provenance, privacy, or
accessibility. Each correction must change the owning contract and preserve every valid passing behavior.

### X6-C1 — Restore trustworthy identity and temporal meaning

**User outcome:** the first populated Home names sports from verifiable evidence, reserves unknown for genuinely
unresolved values, keeps personal naming as an override, and states a date range whose included evidence is clear.

1. Introduce a provider-catalogue evidence contract separate from user-authored classification. It records provider,
   source identifier, provider name key, localized names when supplied, parent identifier, catalogue revision or
   retrieval timestamp, and provenance. The domain remains provider-neutral: adapters translate catalogue entries to
   versioned canonical suggestions, while a user-authored family or label always wins without erasing source evidence.
2. Support exact recognized, ambiguous, unknown, and personally overridden states through domain, application,
   persistence, transport, Home, History, session, report, filter, and export projections. Provider identifiers remain
   opaque outside the adapter and are never displayed as names.
3. Polar's official Dynamic API defines the required identifier, localized names, and parent relationship, but its
   complete catalogue endpoint requires authenticated `sports:read` access and is not part of the evaluated takeout.
   Before committing a bundled snapshot, establish its retrieval provenance, update procedure, redistribution basis,
   and exact relationship to takeout `sport.id`. The limited official BLE SDK vocabulary may provide test evidence for
   its explicitly named identifiers only; it cannot masquerade as the complete catalogue. A developer or product-owner
   authentication step is a human gate only if no official redistributable source can be obtained autonomously.
4. Replace one unexplained combined Home range with documented per-domain usable ranges and an honest overall
   composition. A record with no available supported measurement may remain source evidence and coverage, but it cannot
   silently define the primary usable-history boundary. Preserve exact source coverage in Sources.
5. Start with failing lower-layer tests for catalogue provenance, precedence, persistence, reimport, mapping-version
   enrichment, ambiguous/unknown behavior, and unavailable-only range boundaries. Finish with realistic multi-sport
   import, Home-to-History, filter, session, report/export, restart, and reimport journeys in both locales.

**Execution state:** the temporal subincrement and provider-neutral sport-identity foundation are implemented
through Library Home version 5, Training Sports version 2, Session Story version 4, report resolution version 5, and
SQLite schema 28. Recorded evidence, usable measurement coverage, and the explicitly scoped primary range are
separate contracts; activity days without step measurements no longer define usable history; training counts use the
complete training range; and recorded-but-unusable evidence opens a source-review state rather than first run.
Recognized, ambiguous, unknown, personally overridden, and unavailable identities now retain exact precedence and
revision semantics through application, persistence, transport, Home, History, session, report, filter, and portable
HTML projections without exposing provider identifiers. The complete contributor lane, production build, strict
Rust lint and formatting gates, and packaged macOS journeys pass with independently constructed synthetic catalogue
evidence, including reimport, process restart, adaptive session composition, accessibility, and the unchanged
performance budgets. Official-source review on 2026-08-25 confirmed that the complete authenticated sports endpoint
has no established GPL-compatible redistribution path; the official BLE SDK supplies only a narrow numeric
vocabulary, and AccessLink v3 supplies stable detailed-sport codes without joining them to the numeric references in
the archive's recorded sessions. Post-review export analysis then established a more precise boundary: the
sport-profile artifact itself contains stable detailed-sport codes but no numeric session identifier, while training
targets contain codes only for the planned exercises they describe. Neither source authorizes an archive-wide numeric
lookup, profile-array positional join, or inference from route and measurements. The provider-neutral foundation
remains valid, but the ordinary archive still appears entirely unknown because its available naming evidence is
ignored. X7-R2 must import that evidence, attach exact per-record recognition where source relationships establish it,
retain ambiguity where they do not, and document any additional versioned correlation evidence before activation.

**Rejection conditions:** inferred sport from route or measurements; an unexplained value table; provider taxonomy in
the canonical domain; user choices overwritten by catalogue refresh; an early date suppressed without retaining its
source coverage; or a Home range whose included domains cannot be inspected.

### X6-C2 — Make acquisition actions spatially and natively complete

**User outcome:** guidance, official destinations, and native archive selection always end at a visible result and an
obvious next action, including when the action begins from a scrolled result.

1. Treat reveal as one focus-and-scroll transition with a maintained-navigation offset and reduced-motion behavior.
   Apply it to `Show me how`, initial selection, and post-result reselection; keep the updated archive and import action
   together in the resulting viewport.
2. Keep official destinations explicit and external. Add a production-native opener boundary test that can distinguish
   successful delegation from plugin, scope, process, or OS failure. A failure appears beside the initiating action,
   receives focus without stealing it during success, states what did not open, and preserves a copyable destination.
3. Exercise the actual Tauri production adapter in the revision-isolated package. Mocked component and E2E tests remain
   useful for state permutations but cannot close native browser-opening acceptance.
4. Verify pointer, keyboard, focus, scroll geometry, compact navigation, both locales, 100%–200% zoom, reduced motion,
   cancellation, repeated action, and return from every acquisition state.

**Execution state:** the correction is implemented through the provider-neutral application use case,
typed desktop request and outcome, native infrastructure launcher, [ADR 0028](../architecture/decisions/0028-own-official-destination-opening-in-the-application.md),
and the versioned [opening contract](../data-formats/guidance/official-source-link-opening-v1.md). React no longer
holds arbitrary native URL authority. Each official action displays its exact destination and retains an accepted
result or a focused actionable failure beside the initiating control. Guide expansion and every successful initial
or post-result archive selection perform a reduced-motion-aware focus-and-scroll transition; selection cancellation
returns focus without a false result. High content zoom recomposes the source choices so the selected archive and
import action remain in one viewport. The complete contributor lane, build, strict Rust lint and formatting gates,
and the full packaged macOS journey pass, including both locales, compact navigation, 200% zoom, keyboard activation,
selection cancellation, post-result reselection, exact destination instrumentation, restart, accessibility, and
performance. The automated journey exposed and then closed one 200%-zoom viewport regression. X6-C2 cannot close
until a revision-isolated production-native package confirms that both official destinations appear in the actual
default browser; an accepted operating-system request alone is not that evidence.

### X6-C3 — Separate archive compatibility from safety and expose real work

**User outcome:** choosing the wrong ZIP produces a calm, specific recovery path; choosing a supported export shows
continuing progress until one visible terminal result.

1. Establish package identity before assigning a user-facing compatibility category while retaining path traversal,
   link, encryption, size, count, and extraction protections. Distinguish not-a-supported-export, malformed supported
   artifact, unsupported provider version, suspicious member layout, and internal failure. A directory entry or nested
   ordinary archive that contains no recognized export evidence is not described as a provider compatibility incident.
2. Put the established reason and safest next action in the primary result. Diagnostic detail remains optional but may
   not contain the only explanation. Selection, cancellation, retry, and library preservation remain explicit.
3. Model reconciliation and persistence as real bounded work units. Emit monotonic progress while countable work is
   performed, then use a factual indeterminate transaction-finalization state only for an uncountable atomic boundary.
   Do not fabricate a percentage or promise a duration. Preserve the existing no-cancel boundary once commit becomes
   externally visible.
4. Add a stall watchdog that changes the explanation without terminating or corrupting a valid long transaction. Test
   ordinary completion, slow completion, genuine command failure, cancellation before commit, immediate retry, exact
   repeat, extension, and process restart against one durable library.

**Execution state:** the correction is implemented locally through package-inventory identity, an independent complete
member-protection scan, stable compatibility and safety outcomes, and the versioned
[import-control contract](../data-formats/guidance/import-control-v1.md) under
[ADR 0029](../architecture/decisions/0029-separate-package-identity-compatibility-and-safety.md). Reconciliation now
emits monotonic canonical-item progress and remains rollback-cancellable; commit begins only afterward and exposes no
fabricated count. The primary result distinguishes an unrelated ZIP, malformed current content, an unsupported
provider version, suspicious layout, and resource limits before optional coverage. An unchanged-progress watchdog
changes only the explanation. The complete contributor lane, production build, strict Rust lint and formatting gates,
and full packaged macOS journey pass across cancellation, immediate retry, unrelated and malformed input, successful
import, exact repeat, cumulative extension, restart, both locales, accessibility, and 200% zoom. That campaign also
exposed and closed a pre-existing race in first-run picker cancellation: after Home yields to Sources, focus now lands
deterministically on the durable Sources chooser rather than depending on the unmounted initiating control. The
repeated production-native X6 evaluation remains the human confirmation boundary.

### X6-C4 — Keep operation truth global and make Home lead somewhere

**User outcome:** leaving Sources never hides an active import, temporarily unavailable destinations explain why, and
the first prominent Home summaries open the corresponding evidence.

1. Lift the active operation projection to the application shell. Home shows a restrained continuing-work status with
   a route back to Sources; History exposes why it is temporarily unavailable and becomes usable immediately after a
   successful projection refresh. Failed and cancelled operations cannot leave stale busy state.
2. Make the session aggregate open unfiltered training History and the sport aggregate open the complete sport view or
   sport refinement entry. Preserve exact origin, mounted filters, return focus, pointer and keyboard equivalence, and
   direct-entry fallback. Any summary without a meaningful destination must lose control-like styling.
3. Verify active, completed, failed, cancelled, retry, route-away, route-back, refresh-failure, and restart states, plus
   every aggregate destination and exact return path.

**Execution state:** complete locally. `App` owns one active-import projection independently from the visible
workspace. Outside Sources, a restrained shell status reports the authoritative phase and opens the active Sources
surface from its beginning rather than restoring an obsolete scroll position. History retains its stable name and
explains initial loading, first import, post-commit projection, empty-library, and projection-failure states beside
the disabled destination; a failed post-commit projection offers a local retry that does not repeat the import, and
a successful response enables History immediately. Home prevents a second source-acquisition action while the
active import owns the operation. Sources stops presenting the completed import percentage while
Home and History are being refreshed and instead names that distinct indeterminate projection operation. Completed,
failed, and cancelled operations clear the shell status.

Positive Home session and sport totals are explicit controls. Sessions clears the disposable training-discovery
workspace before opening the complete newest-first session history; Sports opens the complete sport-management view.
Both routes preserve the exact Home origin and restore focus on return, accept pointer and keyboard activation, and
use the normal durable training destination for direct-entry recovery. Zero totals remain facts rather than controls.
Component and application integration tests cover the state matrix, refresh retry without reimport, exact aggregate
destinations, unfiltered-session semantics, failure cleanup, and focus restoration. The complete packaged macOS
journey additionally covers route-away and route-back during a cancellable import, visible restriction ownership,
both aggregate destinations, process restart, accessibility, both locales, maximum zoom, dense evidence, and
performance budgets. Production-native human re-evaluation remains part of the repeated X6 gate.

### X6-C5 — Recompose information by role and supported geometry

**User outcome:** the application uses a desktop workspace without producing uncomfortably long prose, and forms keep
one coherent rhythm at every maintained allocation and content zoom.

1. Inventory every live maximum line measure and grid track by role: reading prose, task instruction, status, result,
   control help, exact evidence, and navigation. Keep deliberate prose measures, but let task and status copy use the
   width supplied by their composition unless a reviewed role-specific bound exists.
2. Build forms from aligned label, control, help, validation, and action regions. The sport editor must preserve the
   complete existing application command, validation, optimistic conflict, save/reset/cancel, multi-item, persistence,
   reimport, and reload behavior; presentation work cannot create a second contract.
3. Add rendered-geometry assertions and actual WebKit review at wide and compact allocation, both locales, light/dark,
   100%, 125%, 150%, 175%, and 200% zoom, long translated and authored values, validation, reduced motion, keyboard,
   Axe, and no page-level horizontal overflow. A self-review precedes any human handoff.

**Execution state:** complete locally. Reading prose now uses one shared role-based measure, while task instruction,
status, result, control help, and exact evidence use their allocated composition instead of inheriting arbitrary
character limits. Structural bounds remain responsible only for page, inspector, overlay, and table geometry. Static
contracts inventory these roles and prevent the removed constraints from returning.

The sport-classification editor aligns label, control, help, validation, and action regions on shared grid rows at
wide allocations. Its native selector and text input retain semantic controls with equal scaled height, and the
composition becomes one column from 150% through 200% content zoom. The complete command, validation, optimistic
revision conflict, save, reset, cancel, multi-item, persistence, reimport, and reload behavior remains covered by
component and integration tests.

Packaged WebKit exercises 40 geometry combinations across wide and compact allocations, both locales, light and dark
appearance, and 100%, 125%, 150%, 175%, and 200% content zoom. It checks long translated and authored values,
validation, keyboard focus order, Axe, navigation clearance, control alignment, and absence of page-level horizontal
overflow. Representative wide and compact maximum-zoom evidence was visually reviewed. That review found the compact
form could begin beneath the persistent navigation; the shared reveal offset and regression assertion were corrected
before closure. Reduced-motion behavior remains enforced by the existing motion-policy contract and requires the
system-setting observation in the repeated human profile.

## X7 — Correct the complete repeated-review result

X7 is the only post-review implementation sequence. It does not add isolated patches to reviewed screens. Each
increment corrects the lowest contract that caused the observed failure and then carries that change through the
ordinary application, persisted library, export boundary, documentation, and release-shaped evidence that consume
it. X7-P0 freezes this sequence; X7-R1 through X7-R6 deliver value in dependency order; X7-R7 falsifies the complete
result before another human handoff.

The sequence deliberately separates three kinds of work:

1. **correctness and trust** — opening, import meaning, progress, sport identity, navigation, precision, and
   provenance;
2. **comprehension and analytical power** — progressive disclosure, aligned tables, mature charts, route navigation,
   and structured training intent; and
3. **reuse and exit** — report examples, duplication, result-first review, and deterministic portable output.

System, light, and dark appearance remain the first-MVP contract. Several curated themes are confirmed for the
post-MVP experience-personalization track, where they can be evaluated without delaying correction of the rejected
evidence experience. External-tile cartography likewise remains post-MVP: X7 bounds and improves the exact local
route workbench but does not make network, attribution, caching, or location-privacy decisions by accident.

### X7-P0 — Freeze the post-review contract and causal plan

**User outcome:** every review observation has one accountable increment, and implementation can proceed without
reinterpreting feedback, hiding new functionality inside presentation work, or repeatedly requesting routine product
decisions.

1. Reconcile requirements, roadmap, this plan, and the immutable human record. FR-027 and the expanded FR-005 report
   boundary enter the first-MVP path explicitly; cartography, community template exchange, curated themes, additional
   providers, connected APIs, and MCP do not.
2. Record the established causal chain for every XH finding. A test or implementation may refine a cause with stronger
   evidence, but it may not silently replace the product requirement or weaken a passing invariant.
3. Keep the observed personal archive local. Only independently constructed schemas, synthetic fixtures, aggregate
   format facts, public authoritative references, and non-identifying evidence enter the repository.
4. Retain one active implementation plan, one requirements source, one roadmap, and one immutable review record.

**Exit evidence:** documentation, link, repository-content, privacy, secret, and diff checks; one focused commit and
normal push. No hosted executable campaign runs for a documentation-only fingerprint.

### X7-R1 — Make acquisition and import trustworthy and responsive

**Findings:** XH-01, XH-03, XH-06, XH-07, XH-13, and the import-facing part of XH-14.

**User outcome:** official guidance either appears in the real default browser or reports a verified failure beside
the initiating action; every rejected archive states the actual bounded reason and recovery; a large import remains
navigable and visibly advances from selection through refreshed library without fabricating progress.

**Lower-layer work:**

1. Replace detached fire-and-forget destination delegation with an application-owned native launch result whose
   production adapter observes the platform launcher exit status. Keep the allowlisted URL and provider-neutral port.
   Distinguish request rejection, launcher failure, and accepted browser delegation without claiming that a particular
   browser rendered a page before human observation.
2. Replace `ResourceLimit(String)` and the single `archive-safety-limit` presentation code with a typed resource-limit
   reason covering entry count, expanded member size, total expanded size, compression ratio, and bounded read
   exhaustion. Persist only safe categories and bounded facts; never retain member paths or personal values in the
   user-facing outcome.
3. Coalesce reconciliation events before they cross the Tauri channel. The producer emits the first update, bounded
   time- or item-based changes, cancellation boundaries, and the terminal update; the React shell renders at most one
   current operation projection and cannot schedule one full application render per canonical item. Progress remains
   monotonic and exact at completion.
4. Preserve the existing transaction boundary: cancellation remains effective before commit, final atomic commit is
   not given a false count, and projection refresh remains a distinct operation. Instrument duration and event count
   without logging personal data.

**Presentation work:**

1. Put numeric processed/total progress and the current phase in the global shell status, with locale-consistent
   grouping on both sides of a ratio and a route back to Sources. Navigation remains operable during cancellable
   reconciliation; a destination that truly depends on the new projection explains that boundary locally.
2. State resource-limit failures in plain language: what kind of limit was reached, that the existing library was not
   changed, and what safe next action is available. Do not call ordinary incompatibility unsafe and do not hide the
   only explanation in a disclosure.
3. Make local-first copy state-aware. Before selection it explains that a chosen archive will be processed on the
   current device and nothing is uploaded; after import it can truthfully state that the local library remains there.
4. Retain spatial transitions for `Show me how`, selection, cancellation, retry, and result replacement. Browser and
   archive actions each keep their result adjacent to the action that produced it.

**Verification:** failing use-case and adapter tests first; real process success and failure for the platform launcher;
typed import-outcome compatibility tests; synthetic small and dense archives; bounded progress-event and render-count
tests; route-away and route-back during reconciliation; cancellation, immediate retry, exact repeat, cumulative
extension, projection refresh, restart, both locales, 100%–200% zoom, keyboard, VoiceOver semantics, performance,
and the revision-isolated production-native browser observation.

**Rejection conditions:** accepting process spawn as browser success; one generic resource-limit sentence; throttling
that loses cancellation or terminal state; a spinner without phase or count during countable work; disabling all
navigation to mask renderer starvation; or a test-only import path.

**Execution checkpoint — native destination acceptance:** the macOS infrastructure adapter no longer accepts a
detached process spawn. It invokes `/usr/bin/open` with the exact application-selected URL as a separate argument,
captures process output locally, waits for the launcher exit status, and returns success only for a successful exit.
**Execution checkpoint — typed archive-resource outcomes:** archive entry count, expanded member size, total expanded
size, compression ratio, and bounded read exhaustion now remain distinct through rejection persistence and localized
presentation. Bounded reads stop before allocating beyond the limit; terminal outcomes retain stable categories and
never expose member paths. Historical aggregate codes remain readable but are no longer emitted.
**Execution checkpoint — bounded import progress delivery:** the desktop host now coalesces progress before IPC by
item, byte, and time thresholds while always preserving first, phase, cancellation, exact-completion, and terminal
events. Same-phase regressions are not delivered. A dense 12,000-item synthetic reconciliation is bounded to 50
channel events in the no-time-advance profile, and the shell now displays the localized phase and grouped numeric
progress while the user works outside Sources.
**Execution checkpoint — factual local-state copy:** first-run Home no longer claims that an archive or library already
remains on the device. Sources distinguishes the state before selection, after local ZIP selection, and after a usable
library exists. Each state says only what has happened or will happen and retains the no-upload and no-credential
boundary in both locales.
Process creation still maps permission, missing-launcher, and operating-system failures to stable application
categories; a non-successful exit maps to delegation failure. Focused tests cover the exact invocation and every
result without granting presentation arbitrary URL authority. Actual default-browser appearance remains the
revision-isolated native observation in X7-R1 rather than an automated claim.

### X7-R2 — Make history recognizable and every collection navigable

**Findings:** XH-08, XH-09, XH-17, and the unresolved identity consequence in XH-18.

**User outcome:** trustworthy source evidence names every session it can actually identify, unresolved records remain
honest rather than collapsed, every sport summary opens its represented sessions, and comparisons begin with a useful
contrast while preserving manual control.

**Source and identity work:**

1. Promote sport-profile and training-target artifacts from ignored naming evidence to parsed adapter inputs. Document
   their stable sport-code vocabulary, export versions, missing identifiers, and exact relationship limitations. Stable
   source codes map to provider-neutral localized names and visual identifiers behind the existing catalogue port.
2. Establish recognition per evidence scope, not by appearance. A source-authored detailed code attached to one
   training target may identify an exactly related session when the adapter proves a unique relationship. It does not
   label every session sharing an opaque numeric `sport.id`. Array position, frequency, route, device, pace, heart
   rate, and user history are never sport identity.
3. Evaluate versioned correlation sources structurally: independently reproducible export relationships, official
   public vocabularies, and reviewed synthetic fixtures may become an activated mapping revision with provenance.
   Conflicting candidates remain ambiguous. A user override still wins without deleting source recognition.
4. Reimporting identical bytes after a mapping revision reassesses and enriches existing sessions atomically without
   duplicating their identities. Sport-profile and target coverage becomes explicit in Sources and format docs.

**Navigation and comparison work:**

1. Add a typed filtered-session destination carrying the represented local sport identity, disposable search state,
   and exact origin. Home and History sport cards expose a primary `View sessions` action; nested classification
   remains a separate control. Counts and headings that look actionable use the same route. Back restores the exact
   card, tab, scroll position, and prior filters.
2. Audit every visible bounded collection, count, period, sport, session group, report result, and evidence set against
   the natural-drill-down requirement. If no meaningful destination exists, remove control styling rather than adding
   a dead action.
3. Introduce one provider-neutral period-preset value object and presentation control for current versus previous
   week, month, and year, plus manual ranges at all times. Presets anchor to the latest usable evidence when the
   library does not cover the current calendar period and name that fact honestly. Baseline and comparison never
   default to the same interval.

**Verification:** synthetic multi-sport archives with recognized, conflicting, unresolved, unavailable, and
personally overridden records; exact and extended reimport; mapping upgrade; restart; filters; direct entry; every
sport-card and count destination; nested edit action; origin return; current/previous presets at calendar boundaries,
leap years, sparse history, stale history, and manual validation; both locales and supported zooms; report and portable
export identity projections.

**Rejection conditions:** one global opaque-number lookup without evidence scope; array-index joins; inferring sport
from measurements; collapsing several unknown values; a whole-card click that traps the nested edit control; a preset
whose labels misdescribe stale evidence; or losing a person's mounted discovery state.

**Execution checkpoint — exact completed-target sport evidence:** adapter version 12 now parses sport-profile
vocabulary shape and completed training-target sport codes. A normalized target start contributes only when it
identifies one current session in the same origin; incomplete, unmatched, and multiply matched targets contribute
nothing, while several distinct exact codes remain ambiguous. The provider code and target provenance remain inside
SQLite schema 29; session search and ordered selection expose only provider-neutral localized recognition and can
find that recognized name. Exact reimport is version-scoped and idempotent.

**Execution checkpoint — represented-session identity and navigation:** training sports version 3 now separates the
personal-classification `sportRef` from the exact collection `sessionFilterRef`. Exact recognized, ambiguous,
unresolved remainder, unavailable, and personally overridden collections filter search and calendar through one
validated identity; exact evidence also works when a session has no source profile. A personal override deliberately
reunites exact and unresolved sessions for its source profile. Home may aggregate several collection capabilities
without inventing one editable profile. Home and History sport cards expose independent session and classification
actions; direct entry, Back, prior filters, tab, and focus survive the round trip. SQLite schema 30 lazily expands
legacy saved profile filters into their current exact collections. Versioned identity, Home, search, selection,
workspace, story, and report contracts cover the new boundary. The complete natural-drill-down audit and route matrix
are recorded below.

**Execution checkpoint — evidence-anchored comparison presets:** one provider-neutral presentation value object now
derives week-to-date, month-to-date, and year-to-date comparisons for Activity, Training, Sleep, Recovery, and the
aligned four-domain history. Each preset compares the elapsed part of the latest recorded calendar period with the
matching part of the preceding period, says when the anchor is the latest recorded date rather than today, and is
disabled when the required historical boundary is unavailable. A short history falls back to adjacent equal periods;
a one-date history leaves the baseline explicitly empty instead of comparing one interval with itself. The same
accessible control appears above four always-editable native date fields in every comparator and preserves the chosen
periods through failure and retry. Report definitions continue to consume their application-authored comparison query;
the presentation does not infer a wider history boundary from a session-owned report start.

Pure calendar tests cover ISO-week boundaries, month ends, leap years, stale and sparse histories, manual edits, and
invalid ranges. Component tests cover the shared control and all five integrations. The complete contributor lane,
Rust lint and formatting, localization and documentation contracts, production build, packaged functional journey,
real process restart, adaptive-session journeys, and dense insight campaign passed on 2026-08-26. The functional
journey additionally verifies distinct packaged defaults and retained manual control; every measured p95 remained
inside its documented budget. The route matrix below closes the remaining natural-drill-down boundary.

**Execution checkpoint — natural drill-down audit:** the bounded-summary audit now covers every production workspace,
not only elements that already looked like controls. The resulting route matrix is:

| Surface | Represented collection or evidence | Natural route |
| --- | --- | --- |
| Home summary | All training sessions and all represented sports | Separate Sessions and Sports actions; zero-count facts remain plain text |
| Home sports | Each exact represented sport collection and any omitted remainder | Each sport opens its exact filtered sessions; the remainder opens the complete Sports collection; classification remains an independent nested action |
| Home highlights and recent history | Both bounded comparison periods, historical training, and each recent session | The comparison opens with its exact ranges, historical training opens Sessions, and each recent item opens its session |
| Home usable-history coverage | Every usable domain count and complete source coverage | Each usable domain opens its explorer, unavailable evidence remains a plain unavailable state, and source coverage opens Sources |
| Activity | Selected-period summary, visual dates, and exact daily rows | Visible dates open the authoritative day detail; the adjacent chart and table expose the evidence represented by the summary |
| Training | Sport groups, search and calendar results, result counts, selected comparisons, routes, signals, structures, zones, and personal ranges | Sport groups apply exact filters; session cards and calendar entries open the session; pagination traverses the complete result set; exact evidence disclosures retain their own focused routes |
| Sleep and recovery | Selected-period answers, nightly visuals, counts, and exact nights | A co-located exact-evidence disclosure exposes the complete bounded set; every available night opens authoritative detail and a missing night never offers invented detail |
| Aligned history | Four-domain visual, coverage counts, and aligned dates | A co-located exact-evidence disclosure exposes every date; each date opens aligned detail with routes to all four authoritative explorers |
| Reports | Saved report summaries, primary results, supporting evidence, and provenance | Every library card opens the result-first preview; a saved session or comparison report exposes its canonical source action; coverage and provenance remain inspectable in the preview |
| Import result and Sources | Incorporation counts, artifact coverage, and classified artifact families | The terminal result discloses the complete incorporation account and per-family explanation; rejected or unavailable evidence never receives a false history route |

The audit found two residual dead ends on Home: the omitted-sport count was plain text and usable domain cards stated
record counts without an explorer action. Both now use explicit, independently focusable actions. Returning from an
omitted-sport or domain-coverage route restores that exact control and the open disclosure rather than only the Home
heading. The audit deliberately does not turn adjacent explanatory values into controls: where the exact records are
already exposed by a labelled disclosure, table, pagination control, or source action, the surrounding summary remains
visually non-interactive. Component and application tests exercise the two corrections, pending navigation, unavailable
coverage, exact destination selection, and origin-focus restoration. The rebuilt packaged journey exercises the same
domain-coverage round trip.

The 2026-08-26 verification passed the complete fast contributor lane, Rust lint and formatting, the production
build, and the rebuilt packaged macOS campaign. The packaged functional journey covered both locales, supported
zoom levels, classification cancellation and save, collection navigation, reimport, durable state, accessibility,
and application-process restart in 3 minutes 12 seconds. Independent adaptive-session, adaptive-range restart, and
insight-performance journeys also passed; every measured p95 remained inside its documented budget.

### X7-R3 — Establish one coherent data-presentation and Settings system

**Findings:** XH-05, XH-11, XH-12, XH-14, XH-15, XH-19, and XH-20.

**User outcome:** primary screens answer before they enumerate, totals use meaningful precision, tables support visual
comparison, exact evidence appears on demand, and Settings behaves as one understandable save transaction.

**Shared contracts:**

1. Define presentation roles for conclusion, visual explanation, essential metric, supporting detail, exact evidence,
   provenance, limitation, and action. Build reusable result sections, metric groups, disclosure summaries, and data
   tables from those roles. Feature components provide meaning; they do not reimplement spacing, alignment, or
   disclosure policy independently.
2. Replace the universal duration formatter with explicit summary, detail, and exact-evidence policies. Summaries round
   at a scale appropriate to the magnitude; ordinary session detail may include seconds; milliseconds appear only in
   an exact context where source resolution or a boundary calculation makes them material. Underlying values and
   exports remain exact.
3. Centralize integer, decimal, ratio, date, duration, distance, pace, energy, and percentage formatting. Count ratios
   force grouping consistently when either side requires it; all policies remain locale- and unit-aware. Static checks
   prevent direct ad hoc formatters from returning to product surfaces.
4. Define numeric table columns with tabular figures, consistent unit placement, semantic header association, and
   alignment chosen by value type. Move repeated attribution to the containing evidence-set explanation. Tables remain
   responsive without turning each row into an unreadable label/value grid.
5. Audit Home, History, Activity, Training, Sleep, Recovery, Longitudinal, session evidence, ranges, and Reports.
   Primary surfaces retain the conclusion, best visual, and few decision-relevant values; exhaustive rows, raw
   timestamps, provenance, and calculation detail move behind explicit, labelled disclosure without becoming hidden
   from keyboard or assistive technology.

**Settings transaction:**

1. `Restore defaults` changes the mounted draft and live preview only. `Cancel changes` restores the last persisted
   preferences and exits or resets editing without a write. `Save changes` performs the one durable write. Unsaved
   navigation uses the established guard rather than a competing `Discard preview` concept.
2. Place the actions in one ordered group with a clear primary action and stable keyboard order at every supported
   width and zoom. Keep language, system/light/dark appearance, zoom, validation, invalid-value recovery, restart, and
   future extensibility on the existing application and persistence ports.

**Verification:** formatter boundary and property tests; locale placeholder and grouping contracts; semantic-table
tests; visual-regression states with large positive and negative values, sparse and dense evidence, long labels,
milliseconds at exact boundaries, and no data; Settings entry, change, reset-draft, cancel, save, validation, reload,
and multiple sequential edits; full pointer, keyboard, screen-reader, reduced-motion, both-locale, appearance, and
100%–200% zoom matrix; an independent screen-by-screen density review before closure.

**Rejection conditions:** truncating exact stored data; one precision rule for every context; hiding limitations or
provenance entirely; replacing one giant table with dozens of equally noisy cards; immediate persistence from reset;
CSS-only alignment applied to a single screenshot; or deleting behavior assertions when composition changes.

**Execution checkpoint — one explicit Settings transaction:** `Restore defaults` now changes only the mounted draft and
live preview, `Cancel changes` restores the persisted preferences without writing, and `Save changes` is the sole durable
Settings write. Leaving Settings with an unsaved draft opens one focused guard that can retain editing or discard the
draft before completing the requested navigation. The former native reset command and its application use case were
removed so no second persistence path can bypass the transaction. The action group retains one stable order and one
primary action across supported widths, locales, appearances, and content zooms.

The exact committed source `4e1c6de890ed61d4741886bd86ac5ae1da40eb27` passed the complete fast contributor lane,
Rust lint and formatting, production build, and rebuilt packaged macOS campaign on 2026-08-26. The functional packaged
journey covered both locales, Settings save and discard paths, import, navigation, reimport, accessibility, and a real
application-process restart. Independent adaptive-session, adaptive-range restart, and dense insight-performance
journeys also passed, with every measured p95 inside its documented budget.

**Execution checkpoint — one presentation-format boundary:** every production formatter now enters the named
provider-neutral boundary for integer counts, signed values, summary/detail/exact decimals, count ratios, dates and
times, durations, distances, pace, energy, percentages, coordinates, and plural selection. Home no longer owns a
parallel duration or distance vocabulary, and count and exact-measurement grouping is consistent in both locales.
The UI-contract scan fails when a production TypeScript or TSX source constructs an `Intl` formatter outside that
boundary. Boundary tests cover precision transitions, signs, locale separators, dates, coordinates, and grouping;
the complete 394-test React suite, localization contract, UI contract, and production build pass. Screen hierarchy,
table composition, responsive alignment, and the independent density review remain open within X7-R3.

**Execution checkpoint — concise segment and zone evidence:** personal segment timelines and recorded-zone
distributions now answer before their complete values enumerate. Native disclosures retain every exact row for
keyboard and assistive-technology use, while one shared `DataTable` owns the labelled scroll boundary and explicit
tabular numeric alignment. Segment authorship and calculation attribution remain in the containing explanation and
were removed from the repeated row schema.

**Execution checkpoint — one production table contract:** activity, import coverage, domain comparisons, exact
daily evidence, report analysis, training laps, pauses, route points, signal samples, session comparisons, and
source history now enter the same semantic `DataTable` boundary as segments and zones. Each numeric header and cell
declares its alignment explicitly; dates, identities, statuses, explanations, and actions remain text-aligned.
Nested task regions and their scroll boundaries have distinct localized names. The UI-contract scan rejects direct
production table ownership and positional CSS alignment, while component tests preserve the established table names
and task landmarks. Primary-screen disclosure and the independent density review remain open within X7-R3.

**Execution checkpoint — Activity answers before exact enumeration:** the selected range now retains its summary,
daily visual, and direct day actions in the primary composition while the complete gap-aware table starts inside one
labelled native disclosure. Period controls follow the answer in a separate disclosure and close after a successful
replacement while the prior answer remains visible during pending work; focus returns to the Activity heading rather
than remaining in hidden controls. Opening either control performs no second query, and the exact rows remain coherent
through locale changes and range replacement. The remaining primary screens and the independent density review remain
open within X7-R3.

**Execution checkpoint — History sessions before the complete sport index:** chronology now remains visible while the
complete provider-neutral sport grid starts inside one labelled native disclosure. The route remains immediately
reachable and retains every identity, icon, represented-session action, and contextual classification task. Selecting
one sport applies the existing exact refinement, closes the index, and focuses the visible result count rather than
leaving focus in hidden content. The remaining primary screens and the independent density review remain open within
X7-R3.

**Execution checkpoint — session answer before the compatibility inventory:** the strongest available route, signal,
structure, or zone workbench remains the primary session story while the complete composed evidence account now starts
inside one labelled native disclosure. Opening it performs no query and retains every exercise, route-point, signal,
gap, lap, pause, zone, and unsupported-evidence statement in both locales. Adaptive leadership and every exact-detail
path remain unchanged; compatibility limitations no longer interrupt the visual answer by default. The remaining
primary screens and the independent density review remain open within X7-R3.

**Execution checkpoint — independent density review and X7-R3 closure:** the rebuilt packaged review found two
material defects after the primary-screen hierarchy audit. At compact 200% zoom, WebKit sized the open sport-index
disclosure content to its min-content width; this reduced a 680-pixel workspace to a 268-pixel sport section and made
the 80-character classification preview wrap almost one character per line. A failing packaged geometry assertion now
protects a readable editor measure and bounded preview line count across the existing 40-combination locale, theme,
viewport, and zoom matrix. The sport section, editor container, and form now occupy their available width; the rebuilt
targeted journey passed and the generated compact evidence shows readable three-line copy with contained, aligned
fields. Analytical reports also repeated the same accessible landmark name for exact tables belonging to different
report blocks; each table and scroll region now derives a unique contextual name from its block heading and source,
with component coverage. Packaged evidence also protects the closed-by-default session inventory and its complete
exact account.

The screen-by-screen review now covers Home, Activity, History, the training workspace, the sport editor, Sleep,
Recovery, Longitudinal, all three comparison views, Settings, Source, import outcomes, Reports, route, signal,
structure, zones, and personal ranges at representative wide and compact 200% states. It found two further material
presentation defects. One-night Sleep and Recovery evidence used the plural noun in both locales; the panels now
select the localized singular or plural form through the shared plural-rules boundary, with coverage for the main
answer and exact-coverage disclosure. Signal and zone workbenches also repeated unsupported-evidence warnings in the
primary composition even though the closed session inventory already retained the complete compatibility account.
Those local warnings now remain available in labelled, closed native disclosures; tests and packaged journeys protect
both their quiet default state and their complete on-demand content. No unsupported count or compatibility evidence
was removed.

The report tests, focused disclosure and plural tests, localization contract, UI-contract scan, production build,
rebuilt E2E package, targeted adaptive journey, and targeted main journey passed. The complete fast contributor lane
then passed with 399 presentation tests and 521 Rust tests after the final review changes. A fresh package subsequently
passed the complete functional journey, real-process restart, evidence-adaptive session journey, independent-range
restart, Axe checks, and dense-history performance journey on 2026-08-26. The functional journey completed in 2
minutes 3 seconds; every measured p95 remained inside its documented budget. Inspection of the regenerated synthetic
evidence confirmed the corrected compact editor measure, singular one-night copy, ordinary `0 s` precision, quiet
closed compatibility state, complete on-demand warnings, and intact result-first hierarchy. Strict Rust lint, Rust
formatting, the production build, documentation contracts, and repository diff checks passed. X7-R3 is complete.

### X7-R4 — Adopt a mature analytical visualization foundation

**Findings:** XH-16 and XH-22.

**User outcome:** charts state scale, units, series, gaps, and selection clearly; several signals can be compared when
their coordinate is authoritative; exact values remain accessible; and a route cannot be zoomed into meaningless
planetary context.

**Decision spike:**

The [production-shaped chart evaluation](../research/x7-r4-chart-foundation-evaluation.md) completed on 2026-08-26
and selected Apache ECharts 6.1.0 for live analytical views. The subsequent report-boundary review selected
feature-limited Plotters 0.3.7 for authorized static SVG. [ADR 0032](../architecture/decisions/0032-use-specialized-analytical-visualization-engines.md)
records the accepted mixed rendering boundary; dependency introduction and production migration remain.

**Current implementation checkpoint (2026-08-26):** the exact ECharts dependency, renderer-neutral presentation
model, validated adapter, lazy React boundary, localized failure states, and the `TrainingSignalPlot`, cross-signal,
and longitudinal-history migrations are implemented. These charts inherit the application palette, typography, and content zoom; keep
exact values available through existing semantic alternatives; and retain authoritative coordinate, range,
selection, and gap meaning. The cross-signal projection gives two through four independent scales separate labelled
grids over one stable elapsed domain, with linked cursor and zoom behavior and no normalization or causal claim. The
former structural tests now verify those contracts through the renderer-neutral model and compiled adapter after
their original purposes were traced through repository history. TypeScript compilation, dependency audit,
localization, presentation inventory, architecture, UI-contract, and documentation checks pass. Obsolete renderer-
internal CSS selectors have been removed, and the automated architecture guard enforces ECharts as a single
presentation-adapter dependency. Longitudinal history now uses four independently scaled lanes over one exact
local-date coordinate, retains missing values as gaps and zero training as zero, uses canvas plus zoom for the
maximum 366-day view, and keeps its exact accessible table. A separate timing defect found by the complete suite
was fixed and committed as `77101cc`. The current complete presentation suite passes with 417 tests across 62
files. TypeScript, automation, localization, presentation-inventory, architecture, UI-contract, documentation,
and production-build gates pass without renderer warnings. The production build keeps ECharts outside the initial
graph in one lazily loaded approximately 205-kilobyte gzip chunk. The conditional linked route-signal view now also
uses the same stacked-lane port for one through four independently scaled measurements over only an
application-authorized route elapsed coordinate. It preserves gaps, formats pace as `M:SS`, synchronizes chart,
native keyboard control, and map selection without inventing an exact sample relationship, and updates the mounted
renderer in place during traversal. The live boundary and all live analytical migrations are documented in the
current architecture, developer, testing, performance, and user guides.

On 2026-08-27, deterministic static report rendering migrated to the feature-limited Plotters adapter. Portable
report output version 6 now carries bounded vector charts with labelled units, localized accessible descriptions,
explicit missing-value gaps, and exact semantic tables derived from the same resolved evidence. The adapter admits
no executable script or external request, and architecture automation keeps Plotters inside its sole infrastructure
boundary. Focused Rust tests, the complete fast suite, strict linting, formatting, dependency audit, production build,
and the exact packaged macOS journey pass. The packaged journey completed in 3 minutes 3.5 seconds and verified the
new output after reimport and application-process restart; inspected synthetic report artifacts were 14,234 and
16,324 bytes. Route-relative zoom bounds and the complete X7-R4 acceptance gates remain.

The exact instrumented macOS package passed the complete functional journey, application-process restart,
evidence-adaptive composition, independent-signal range restart, and isolated two-year performance scenario. The
functional journey completed in 2 minutes 13.3 seconds, while the adaptive composition and its fresh-process range
restoration completed in 8.8 seconds and 1.3 seconds. In the dense session, route-workbench opening measured 72
milliseconds at p95, route selection 1 millisecond, independent-signal reveal 82 milliseconds, signal overview 152
milliseconds, fourth-series selection 34 milliseconds, and exact-signal pagination 79 milliseconds. Every accepted
interaction budget passed. The chart range retained its exact saved and reimported boundaries in both the rendered
annotation contract and its accessible description after a new process.

1. Supersede ADR 0013 only after a focused production-shaped comparison of Apache ECharts, uPlot, Observable Plot,
   and Vega-Lite, or a better candidate discovered during the review. Use official source, licence, release, security,
   and maintenance evidence. Verify GPL-3.0 compatibility, offline bundling, tree-shaking, contributor ergonomics,
   macOS WebKit behavior, deterministic output, accessibility, localization, theming, replaceability, and long-term
   project health.
2. Exercise the actual required shapes: sparse daily series, dense exercise signals with gaps, multiple axes and
   units, exact cursor/selection, keyboard-accessible alternatives, two synchronized charts, a report graphic, dark
   appearance, both locales, 200% content zoom, and representative dense data. Measure load, render, interaction,
   memory, and export budgets before selecting.
3. Keep a FitFreed chart port and evidence-series DTO between application meaning and library configuration. Domain,
   application, persistence, and portable schemas never depend on library option objects.

**Migration:**

1. Replace live ad hoc analytical charts by question, not by CSS resemblance. Every migrated chart has a title or
   adjacent question, labelled axes and units, scale and domain, series legend where needed, visible missing data,
   restrained interaction, exact accessible alternative, and empty/partial/error states.
2. Allow multi-signal overlay or linked cursors only when the importer and canonical series establish the same exact
   coordinate. Independent signals remain separate and never imply alignment or causation. Route synchronization
   continues through the exact range-interaction contract rather than chart-library state.
3. Extend deterministic self-contained report export with a reviewed static rendering strategy that performs no
   external request and does not embed executable third-party scripts. Export visuals and their exact tables derive
   from the same resolved evidence.
4. After fitting a recorded route, derive a sensible route-relative minimum zoom and a reviewed maximum zoom, including
   single-point and degenerate bounds. Buttons, keyboard controls, announced level, and programmatic requests honor the
   same bounds. No basemap or network request enters this increment.

**Verification:** dependency and licence automation; adapter and interaction unit tests; WebKit component tests;
missing-data, multiple-axis, cursor, keyboard, screen-reader, reduced-motion, locale, theme, zoom, and exact-alternative
tests; dense-series and report-export benchmarks; route fit and zoom-bound tests; packaged routed, non-routed,
signal-only, partial, and report journeys; visual review at short laptop, wide, compact, and narrow supported windows.

**Rejection conditions:** library objects crossing inward architecture boundaries; canvas-only meaning without an
accessible alternative; fabricated shared coordinates; external requests; unbounded bundle or render cost; static
screenshots as report data; or a route zoom bound chosen as one arbitrary global constant.

### X7-R5 — Import and explain structured training intent

**Finding:** XH-18 and FR-027.

**User outcome:** exported objectives, phases, blocks, repetitions, transitions, and intensity constraints survive in
FitFreed and become understandable without being confused with what the person actually recorded or later authored.

**Model and import:**

1. Document training-target and favourite-target source grammars with synthetic examples. Map source name,
   description, scheduled time, completion state, exercise order, sport code, phase order, phase name, change type,
   goal type and bound, intensity type and bounds, jump/repeat semantics, units, export version, and unsupported fields.
2. Introduce a provider-neutral planned-training aggregate with stable target, exercise, phase, and transition
   identities. Keep authored intent separate from recorded `TrainingSession`, source laps, automatic laps,
   FitFreed-calculated segments, personal ranges, and reusable criteria. Provider enums stop at the adapter.
3. Define deterministic exact, ambiguous, and absent target-to-session relationship states. A unique source composite
   may establish a link only after format evidence and conflict tests prove it; a matching date, name, duration, sport
   family, or measurement pattern alone is not sufficient. Unlinked completed targets remain useful planned history.
4. Reconcile unchanged, amended, removed-from-later-export, duplicate, and extended targets transactionally. A mapping
   revision can enrich canonical intent without duplicating targets or rewriting recorded session evidence. Add schema,
   migration, portable backup, open normalized export, provenance, coverage, and compatibility contracts together.

**Application and presentation:**

1. Add query use cases for planned-training chronology, target detail, and the target relationship of a completed
   session. Compose phases visually as an ordered workout plan with work/recovery identity, repetitions, transitions,
   duration or distance goals, and intensity ranges. Lead with the plan's shape and purpose; put the exhaustive phase
   table and source details behind disclosure.
2. When a session is exactly linked, compare planned structure with recorded evidence without claiming compliance or
   causation. When it is not linked, state that separately and never substitute calculated equal segments for the
   provider-authored plan.
3. Make structured intent available to report blocks, curated report examples, deterministic HTML export, exact data
   exit, user documentation, and provider/canonical format reference.

**Verification:** domain invariants for order, nesting, transition graphs, repetitions, bounds, units, and identities;
adapter fixtures for duration, distance, intensity, repeat, optional, malformed, partial, and unknown variants;
reimport, amendment, mapping upgrade, ambiguity, rollback, migration, backup/restore, restart, report, and export;
visual and accessible planned-versus-recorded journeys in both locales and at supported zooms; performance against a
synthetic long history of phased targets.

**Rejection conditions:** flattening phases until repeat meaning is lost; treating scheduled intent as recorded fact;
linking by a heuristic; converting provider phases into personal ranges; showing a giant raw table as the primary
experience; silently discarding unsupported fields; or implementing only a session component without durable lower
layers.

### X7-R6 — Make reports understandable and reusable from the first visit

**Finding:** XH-23 and the retained Alpha report direction.

**User outcome:** Reports opens with relevant examples that demonstrate real supported value; a person can use one as
the basis of a report, duplicate an existing report, review the result first, refine it deliberately, and export it
without locking data inside FitFreed.

**Built-in examples:**

1. Define versioned provider-neutral example descriptors in application code, with stable identifier, localized
   purpose, question, required evidence capabilities, parameter requirements, block recipe, and explanation for unmet
   prerequisites. They are not persisted report rows and contain no synthetic personal result.
2. Start with a small curated set that demonstrates distinct value rather than every block: training volume and
   consistency across adjacent periods; one session's visual story; an outdoor route investigation when route evidence
   exists; and planned-versus-recorded training when an exact structured-intent relationship exists. The final set may
   change only if the same capability breadth and prerequisite honesty remain.
3. `Use as basis` resolves the person's current evidence and opens an unsaved draft with fresh report and block
   identities. It never mutates the descriptor, silently chooses among ambiguous sessions, or writes before explicit
   save. Missing prerequisites explain what evidence is needed and offer the natural route to it.

**Duplication:**

1. Add an application `duplicate report` use case and typed desktop command. It loads one exact source revision,
   validates a requested new title, creates a fresh report identity and fresh identity for every block, copies content,
   locale, underlying origin, queries, authorship, and the reviewed source snapshot, resets report revision to one,
   persists atomically, and returns the new result. The source report remains byte-for-byte unchanged.
2. The duplicate has no runtime dependency on the source report and survives source edit or deletion. Because it
   initially retains the same reviewed source snapshot, it initially has the same stale/fresh relationship; refresh is
   still deliberate and independent. A title prefilled from localized presentation is editable before the command and
   is not generated inside the domain.
3. Expose `Duplicate report` from a saved result and library item with confirmation only where overwrite or deletion
   risk exists; duplication itself is non-destructive. On success open the duplicate result, announce it, and make
   returning to the report library predictable.

**Result-first refinement and export:**

1. Re-audit report Library, Result, Edit, Preview, Refresh review, privacy review, Export, and Delete as separate tasks.
   Opening and duplication lead to the result. Editing never pushes a result below a long list or leaves the person
   unsure whether changes are saved.
2. Example-based and duplicated reports use the same domain, persistence, staleness, refresh, privacy, and export paths
   as any other report. Self-contained HTML remains deterministic, script-free, external-request-free, factual, and
   complete with exact evidence alternatives and data exit.

**Verification:** descriptor and prerequisite tests; current evidence, missing evidence, ambiguity, and empty library;
use-as-basis cancellation and save; duplicate validation, fresh identities, copied content, revision one, unchanged
source, duplicate refresh, source edit/delete independence, persistence, restart, migration, backup/restore, export,
multiple items, keyboard, focus, both locales, 200% zoom, accessibility, and packaged E2E through real commands.

**Rejection conditions:** preloading fake report results; storing built-in examples as undeletable user rows; shallow
copy with reused block identities; auto-saving an example click; duplicating only presentation state; opening in edit
mode; or introducing community exchange before the local contract is accepted.

### X7-R7 — Falsify the complete corrected product before handoff

**User outcome:** the next review build is a credible product candidate for the agreed private macOS alpha journey,
not a collection of individually green corrections.

1. Perform a live-surface inventory and verify that every production command, DTO, use case, persistence path, state,
   and control introduced or affected by X7 has one real reachable surface and one complete behavior test. Remove no
   assertion merely because a component moved; preserve its behavior through the new route.
2. Run an independent screen-by-screen audit from clean first use through acquisition, wrong archive, resource limit,
   import, navigation during reconciliation, first value, sports, filters, comparisons, routed and non-routed sessions,
   exact evidence, structured intent, personal ranges, report example, save, duplicate, refresh, export, Settings,
   cancellation, retry, reimport, extension, restart, and recovery.
3. Challenge wide and short laptop, compact desktop, and narrow supported windows at 100%, 175%, and 200% zoom;
   English/light and Spanish/dark; longest realistic localized and user-authored content; pointer, keyboard, VoiceOver,
   reduced motion, focus/scroll/return, empty/loading/partial/stale/invalid/failure states, and visual hierarchy. Capture
   no personal data.
4. Run focused performance gates for import event volume, dense history, charts, structured targets, report resolution,
   and HTML export. Run the complete fast lane, production build, strict Rust lint and format, architecture, contracts,
   localization, docs, repository safety, packaged functional/accessibility/restart/adaptive journeys, migration,
   backup/restore, install/update/recovery, and exact hosted campaign selected by executable-input fingerprint.
5. Build one revision-isolated production-native review package only after every machine-assisted critical or major
   finding is corrected and exact-source evidence passes. Scan it to exclude E2E features and mocked native boundaries.
   Do not publish it.

The repeated human profile uses prior findings as regression prompts but is not limited to them. It must still assess
five-second comprehension, trust, time to recognizable value, natural navigation, outdoor and indoor analytical power,
progressive detail, report usefulness, data exit, Settings clarity, localization, accessibility, factual tone, and a
credible reason to continue using FitFreed. Any unresolved critical or major finding reopens its owning X7 increment.

## Traceability to the retained D0–E6 baseline

| Retained baseline | Redesign migration |
|---|---|
| D0 boundaries | Preserved throughout; map renderer receives a focused ADR only because accepted interaction changed |
| P1 product site | X5-R1 replaces public presentation while preserving generator and publication boundaries |
| E1 shell, sources, settings | X5-R2 replaces the ordinary composition and retains tested behavior |
| E2 Library Home and import reveal | X5-R3 versions the result projection and presentation |
| E3 discovery and classification | X5-R5 replaces the History presentation |
| E4 session evidence and segmentation | X5-R6 through X5-R8 compose and present the same evidence, adding only accepted story/range contracts |
| E5 reports and export | X5-R9 replaces report hierarchy and adds the accepted missing lifecycle contracts |
| E6 hardening | X5-R10 reruns it against the redesigned product rather than reusing obsolete experience evidence |
| Independent audit | X6 repeats it from clean first use and may reopen any increment |
| Repeated-review corrections | X7-P0 through X7-R7 own the accepted post-review causes, new vertical contracts, and exact repeat gate |

## Documentation ownership

Each fact has one canonical home:

| Knowledge | Canonical home |
|---|---|
| Normative product behavior | `docs/requirements.md` |
| Accepted screen and interaction behavior | `docs/design/experience-specification.md` |
| Current production sequence and status | This plan |
| Milestone sequencing and exclusions | `docs/roadmap.md` |
| Durable structure and responsibility | Thematic architecture plus a new ADR when the decision is structural |
| Provider, canonical, mapping, Insights, portable, persistence, or migration representation | `docs/data-formats/` indexed by its README |
| Current executable evidence | `docs/testing/public-release-readiness.md` and applicable test records |
| User tasks | Version-matched `docs/user/` English and Spanish resources where published |
| Build, test, diagnose, translate, or contribute tasks | `docs/development/`, `CONTRIBUTING.md`, and linked policies |
| Public capability/status statement | `docs/product-status.json` and generated product surfaces |
| Historical implementation evidence | Closed milestone and D0–E6 plans, unchanged |

Implementation notes do not duplicate durable architecture. Prototype notes do not become product
documentation. Machine-specific paths, dimensions, accounts, data, and incidents never enter public
evidence.

## Autonomous execution and human intervention

Execution continues through X7-R1 to X7-R7 without routine confirmation. Each verified increment is
committed and pushed under the repository's standing authority. If SSH approval is unavailable, the
bounded push stops and later local increments continue; synchronization is retried when possible.

Human intervention is required only for:

- a material change to accepted scope, platform, privacy, licensing, or product behavior;
- a new dependency with unresolved licence or supply-chain risk;
- destructive operations on a real personal library;
- Apple credentials, signing, notarization, tags, releases, public application downloads, or
  production update-channel authority; or
- the final product-owner usability/accessibility gate after X7-R7 repeats X6.

Pages content publication within the existing authorized workflow remains autonomous. Alpha review
findings for reports or personal ranges are documented and corrected when they are critical or major;
they do not create routine approval stops.

## Completion rule

This plan is complete only when X5-R1 through X5-R10 retain their evidence, X7-P0 through X7-R7 pass, X6 is repeated
and has no unresolved critical or major
finding, every user-visible capability has verified lower-layer support, all affected documentation is
current, all provider and FitFreed-owned formats remain fully specified, one exact release-shaped source
fingerprint passes its applicable gates, and the final human gate accepts the complete experience.

Completion does not authorize a public application release. Milestone 3 signing, notarization, trusted
download, update-channel activation, and publication remain separate release gates.
