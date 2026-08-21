# UI and UX Redesign Plan

## Status

Active redesign phase as of 2026-08-21. Product capability, architecture, data safety, and the persistent desktop shell retain their verified evidence, but the current product experience is not accepted. The [independent product-experience audit](../research/mvp-product-experience-audit.md) identified concrete failures, and the subsequent product-owner review concluded that correcting those findings one by one would not guarantee the radical improvement required. The experience is dense, too control-led, insufficiently visual, and too often exposes implementation capability before user meaning.

Functional growth is frozen while this phase is active. Work may change lower-layer contracts only when necessary to make an already accepted MVP journey understandable and complete; it may not add providers, connected APIs, MCP access, new analytical domains, or other roadmap capability. Production presentation implementation resumes only after a coherent interaction direction passes the design gate defined here.

Current product behavior remains canonical in [requirements](../requirements.md). The previous production sequence and its evidence remain in the [MVP experience delivery plan](mvp-experience-delivery.md); they are an engineering baseline, not the design specification for this intervention. No parallel executable will be created. Exploratory alternatives remain non-production design material until one direction is accepted.

## Objective

Make FitFreed immediately useful as a personal history explorer. A person should understand within seconds that the application turns an owned fitness export into questions, comparisons, and trustworthy discoveries that remain under their control.

The durable cross-feature decisions extracted from this work are normative in the [product experience contract](../requirements.md#product-experience-contract). This plan evaluates concrete ways to satisfy that contract; its current screen composition is not itself a permanent product requirement.

Import, coverage, storage, updates, and provider compatibility remain necessary capabilities, but they must not dominate the ordinary experience. The primary interface begins with the person's history and the questions it can answer.

The redesign is successful only if it changes the order in which a person experiences the product:

> recognizable meaning → visual explanation → supporting evidence → optional exact detail and control

It is not a restyling exercise. New typography, color, spacing, cards, or charts cannot compensate for the wrong task hierarchy, disclosure model, navigation state, or default result.

## Non-negotiable redesign mandate

- **Meaning before machinery.** Results and recognizable records lead; forms, filters, editors, diagnostics, and raw evidence refine them.
- **Visual explanation before numeric inventory.** A visual must answer or clarify a question, not merely prove that a series exists. Related structure and signals align when evidence supports the relationship.
- **Progressive control for different levels of engagement.** A person can obtain value without becoming an analyst, while advanced users retain reproducible criteria, exact evidence, provenance, and composition controls.
- **Coverage has a precise home.** The import result explains what entered the library and what did not. Elsewhere, a limitation appears only when it changes the current answer or action.
- **The history must be recognizable.** Sports have trustworthy names and visual identity, sessions read as workouts rather than rows, and unknown source evidence can be resolved in context.
- **Reports open as results.** Guided and saved reports are read, refreshed, and exported before they are edited. Advanced composition is a deliberate mode.
- **Data remains free after import.** Export and portability are visible ownership outcomes, and user-authored classifications, criteria, and reports do not become an application-only dead end.
- **Human scale is the default.** Locale, units, dates, durations, quantity, and precision serve comprehension; exact stored evidence is available on demand.
- **Context survives depth.** Detail is a distinct navigable state with an explicit route back to the exact origin, never an appendix placed after a large list.

## Product questions

The redesign must help a person ask and answer at least these classes of question:

1. What does my history contain, over what period, and where are its gaps?
2. What changed recently compared with an earlier period?
3. When was I more active or consistent, and what exact records support that view?
4. How did training, activity, sleep, and recovery measurements coincide over time?
5. What happened on one date, session, or night?
6. How do two periods differ, including measurement coverage and missing data?
7. What can FitFreed not conclude from the available information?
8. Which sports make up my history, and how did that mix change over seasons or years?
9. How can I find an exact session by sport, date, route, or distinctive measurement?
10. What happened inside one session, including its intervals, laps, temporal signals, and exact samples?
11. Where did my outdoor sessions happen, which routes did I repeat, and how can I protect sensitive locations?
12. Which sessions are meaningfully comparable, what changed between them, and what limits that comparison?
13. When the source has no useful laps or phases, how can I define my own repeatable way to segment and inspect a session?
14. Where can I control lasting application preferences such as language, content zoom, and light, dark, or system appearance?
15. If I do not yet have an export, how do I request and obtain the correct archive from the provider before importing it?
16. How can I compose a reusable report from my own questions, periods, records, and session criteria, then export it when needed?
17. After following a record into detail, how do I return to the exact exploration that led me there without losing its state?

The interface distinguishes recorded facts, calculated comparisons, observed co-occurrence, source-specific assessments, and unavailable conclusions. It does not present correlation as causation, invent a readiness score, provide medical interpretation, or disguise missing data as zero.

## First-run promise

The initial experience has very little time to establish relevance and trust. It must:

- communicate the concrete outcome before explaining the import mechanism;
- show representative questions and visual value without pretending that synthetic examples belong to the person;
- make the first action unambiguous;
- explain local processing and the absence of an account without a legal or technical wall of text;
- set honest expectations about supported information and processing time; and
- turn successful import into a personal reveal rather than an ingestion report.

Evaluation will use three bounded comprehension targets:

- after a five-second view, the person can identify the promised outcome;
- within thirty seconds, a first-time user can identify the first action, the local-data boundary, and examples of questions the application will answer; and
- after import, the first viewport exposes the history period, its useful coverage, at least one supported comparison or observation, and direct paths into exploration.

## Design method and delivery gates

This phase uses explicit experience-design evidence rather than moving directly from an audit finding to a screen. Provisional models will be labelled as hypotheses; repository history, verified product behavior, product-owner observations, and privacy-safe evaluation are evidence, while invented interview quotations or unsupported demographic claims are not.

### X0 — Establish the experience model

Define behavioral user segments, their jobs and questions, engagement levels, critical journeys, failure and recovery journeys, and the tasks that determine whether FitFreed becomes useful. Map the current product against those journeys and trace every required action to existing application, domain, and persistence support.

**Gate:** the model explains novice consultation, returning exploration, advanced inspection, report use, import recovery, and data exit without creating separate products for each level. Every assumption is visible and has a validation route.

### X1 — Rebuild the information and state architecture

Define conceptual homes, object hierarchy, default results, progressive-disclosure levels, origin-aware navigation, selection and comparison state, empty/loading/partial/error states, and the relationship between overview, detail, editor, diagnostics, and export. Specify what owns each piece of information and remove duplicate or ambient coverage messaging.

**Gate:** a task can be walked end to end without relying on screen styling; result and detail never compete in one unbounded document; no visible field or control lacks lower-layer support.

### X2 — Compare interaction directions

Create at least two materially different low-fidelity interaction directions for the critical journeys, then develop only the strongest candidates to sufficient fidelity for realistic evaluation. Alternatives must differ in task hierarchy or navigation—not merely color, card shape, or typography. Comparable-product research may inform patterns but cannot replace FitFreed's evidence and privacy constraints.

The comparison covers first run, active import, import result, populated Home, training history, sport recognition, session story, report result and editing, export, return navigation, partial data, and recovery. It uses independently constructed multi-sport data at realistic density.

**Gate:** one coherent direction demonstrates a materially faster route to meaning, makes the product's functional depth discoverable, and satisfies the non-negotiable mandate. The product owner reviews the direction before production presentation code changes.

### X3 — Specify the accepted experience

Record the selected information architecture, task flows, interaction and state contracts, visual-explanation grammar, content hierarchy, responsive behavior, localization behavior, accessibility alternatives, and component responsibilities. Produce reviewable high-fidelity views for every critical state rather than only an ideal populated dashboard.

Review at realistic macOS desktop and compact sizes, 100% and 200% content zoom, reduced motion, light and dark appearance, and both initial locales. Evaluate five-second promise comprehension, thirty-second first-action comprehension, time to first useful result, session findability, report-result recognition, and recovery from realistic failure.

**Gate:** the direction is coherent, lower-layer feasibility is traced, all critical states are represented, and acceptance observations are recorded. A visually attractive screen set without task evidence does not pass.

### X4 — Plan the production migration

Derive vertical increments from the accepted journeys. Each increment begins with required application and persistence contracts, proceeds through TDD, replaces the ordinary product surface without creating a second executable, and preserves existing safety, exact evidence, provenance, localization, accessibility, navigation, and report reproducibility.

**Gate:** every increment delivers an evaluable user outcome, has explicit regression and usability evidence, and leaves the application coherent if later increments have not yet landed.

### X5 — Implement and validate

Implement in order of time to personal value: import confidence and result, first populated answer, recognizable training history, coherent session story, result-first reporting and export, then cross-journey density and consistency. Run exhaustive interface behavior tests, the complete packaged journey, performance gates, and privacy-safe usability evaluation against the accepted design contract.

**Gate:** the independent product-experience audit is repeated against the ordinary release-shaped application. Functional implementation, attractive presentation, or green automation alone cannot close this phase.

## Design thesis under evaluation

The primary candidate is a question-first desktop workspace with an editorial, non-judgmental visual language. It is not yet an accepted production direction.

- The default view offers one bounded observation or comparison before presenting supporting metrics.
- A structured question catalogue expresses user intent without implying unsupported natural-language or artificial-intelligence capabilities.
- Every calculated statement provides a direct route to its dates and source-derived records.
- Domain-specific coverage and limitations accompany the conclusion they affect; FitFreed does not collapse unrelated coverage into a single score.
- Provider import, schema coverage, reimport, and local-library controls remain fully inspectable in a secondary data-library surface.
- The first-run experience demonstrates the answer structure with explicitly illustrative data, then offers local archive processing as the primary action.
- The interface remains warm without grading, coaching, diagnosing, or inferring causation.

An alternative chronological direction is also being evaluated for its stronger emotional connection to long personal histories. It is not the leading default because it makes analytical controls less direct and requires full-history aggregates beyond the existing bounded insight queries. Its strongest narrative qualities may be incorporated into the question-first workspace without adopting it as the application structure.

The current application contracts already support the principal training comparison, training-day counts, aligned multi-domain days, domain-specific availability, and date-level inspection used in the leading prototype. Production implementation still requires an application-level home and question-catalogue contract; the presentation layer must not assemble a new business read model from unrelated commands.

## Training-centred expansion

The first prototype established a substantially stronger question-first direction but made training sessions appear secondary to longitudinal health context. The next design iteration corrects that hierarchy:

- the owned sports history is the primary product object;
- sports, sessions, training structure, temporal samples, and spatial routes are first-class exploration levels;
- activity, sleep, and recovery provide optional context around training rather than defining the application identity;
- multiple sports must remain legible without reducing their distinct measurements to a lowest-common-denominator session;
- the same session must be reachable from chronological history, sport exploration, comparisons, routes, and contextual observations; and
- sensitive geospatial history reinforces the local-first promise and requires deliberate privacy presentation.

The exploratory prototype will cover a synthetic multi-sport library, session discovery, a sport-specific view, and deep session inspection including intervals, laps, pace or equivalent temporal series, elevation, zones, and route geometry. These views define a product destination, not an implicit MVP scope change. After the direction is evaluated and accepted, implementation planning will sequence the required provider-format research, provider-neutral and sport-specific canonical contracts, mappings, persistence, application read models, privacy controls, accessible alternatives, tests, and migrations.

Session structure must not assume that a provider supplies meaningful phases, intervals, or laps. The design distinguishes three coexisting and visibly attributed layers:

- immutable source structure, when the export contains laps, phases, or markers;
- deterministic FitFreed views calculated from available samples, such as equal distance, equal time, zones, elevation, or route sections; and
- user-defined criteria and manual markers that can be named, adjusted, reused, and removed without changing the imported record.

A criterion is valid only when the underlying measurements support it. The interface explains unavailable criteria, preserves missing samples, keeps derived segments reproducible, and always provides a path back to the unmodified source timeline. User-defined interpretation belongs to the person's portable library and must not become an undocumented application-only silo.

No private sport selection, route, coordinate, value, date sequence, session structure, or other personal-data fingerprint may influence versioned or exploratory examples. All prototype histories and routes remain independently invented and synthetic.

## Navigation continuity

The same session or date can be opened from sport history, search results, a route family, chronology, comparison, contextual observation, report, or direct restoration. A fixed “back to all sessions” action is therefore insufficient.

The design will evaluate an origin-aware return contract that restores the complete meaningful state of the originating workspace while retaining a stable canonical hierarchy for direct entry. Review scenarios must include nested detail, return after editing a user criterion, comparison selection, filtered list and map views, deep links without an origin, keyboard navigation, restart restoration, and an origin that is no longer available after import or deletion. Return labels state the destination explicitly; breadcrumbs describe hierarchy and do not impersonate transient browser history.

## Extensible application settings

FitFreed requires a dedicated, discoverable settings space rather than scattering lasting preferences across unrelated screens. Its information architecture must be able to grow without becoming an unstructured collection of controls.

The initial settings surface covers:

- interface language, initially English (United States) and Spanish (Spain);
- default content zoom from 100% through 200%; and
- appearance using system, light, or dark mode.

These are persistent application preferences, distinct from temporary evaluator controls and from commands that manage imported data. Settings are grouped by user outcome—initially appearance and language, with stable homes reserved for accessibility, imports, data and privacy, updates, and application information. Data-library operations such as adding or deleting an archive remain in the data library; settings may control their policy or defaults but must not duplicate those operations.

Every preference needs a safe default, a clear description of its effect, recovery from invalid or obsolete saved values, and an obvious way to restore defaults. Appearance and zoom changes require a representative preview before saving. The settings design must remain keyboard accessible, usable at 200% content zoom, and explicit about which preferences stay only on the device.

## Provider export acquisition

Import begins before a ZIP reaches FitFreed. A first-time user who does not already have an export must be able to move from intent to the provider's official export process without leaving the application to discover the procedure unaided.

The import experience therefore has two equally visible starting points: choose an archive already on the device, or learn how to obtain one. Provider guidance must:

- explain why the export is needed and that requesting it does not import anything into FitFreed;
- identify the supported provider and expected archive without requiring knowledge of takeout terminology;
- present a short, ordered procedure based on the provider's official process, including expected delivery delay when known;
- link to the provider's official privacy or data-download entry point while keeping useful instructions available offline;
- tell the person what to do when the archive arrives and how to recognise the file without exposing personal paths;
- distinguish FitFreed guidance from provider-controlled screens and avoid implying affiliation; and
- expose when the instructions were last verified, because providers can change their websites and export formats independently.

The capability is provider-specific behind a shared acquisition journey. Each future importer owns its acquisition guide, supported archive description, official links, verification date, and troubleshooting notes. The common interface remains stable as providers are added or their procedures change. Guidance is documentation and navigation support, not automated credential entry, account access, or archive downloading on the person's behalf.

## Result-first personal reporting

The existing report engine proves composition, persistence, deliberate refresh, privacy review, and deterministic export, but its interaction begins with authoring mechanics. The redesign must define how a person first reads, trusts, refreshes, and exports a useful result, and only then chooses to alter its definition. This remains a product-design problem rather than a charting or document-generation library choice.

The report-authoring experience must let the person:

- begin from a question, an existing exploration, a session, or a reusable blank report;
- select periods, sports, sessions, measurements, comparisons, user-defined session criteria, and contextual records without needing database terminology;
- arrange narrative findings, exact values, tables, charts, maps, provenance, coverage, and limitations while retaining accessible alternatives;
- preview the result independently of the editor and understand which elements contain sensitive location or health information;
- save a versioned, reproducible definition that references evidence rather than copying unexplained values;
- refresh a report deliberately when newly imported data or calculation definitions can change its results; and
- export through explicit formats and privacy choices while keeping the saved report usable inside FitFreed.

Implementation selection includes a focused evaluation of maintained open-source libraries for composable layouts, accessible visualisation, paginated document rendering, and export. Reuse is preferred when it preserves local-first operation, licence compatibility, portability, accessibility, deterministic output, and the Clean Architecture boundary. No library choice is mandatory if it compromises those outcomes.

The design must also define empty, partial-coverage, stale-definition, missing-measurement, incompatible-segmentation, export-failure, and reimport-change states. Exported reports must distinguish source facts, FitFreed calculations, user-authored text, and unavailable conclusions just as clearly as the application does.

## Working-material policy

Exploratory screenshots, external visual references, discarded directions, and temporary prototypes remain under the ignored local research area. Only the accepted direction, original project-owned assets, durable rationale, and implementation-facing specifications enter the repository.

## Acceptance boundary

A visually attractive dashboard is not sufficient. The accepted direction must make consultation and discovery easier than the current document-like sequence, preserve exact accessible alternatives, expose uncertainty and coverage, work without an account or network connection, and remain feasible through the Clean Architecture and DDD boundaries.
