# UI and UX Redesign Plan

## Status

Active production migration. X2 selected History Desk with a bounded Answer Canvas pattern, and the product owner accepted the [X3 MVP experience specification](../design/experience-specification.md) on 2026-08-21 as the production redesign contract. X4 derived the delivery increments and X5-R1 through X5-R10 retain their engineering evidence. The renewed [X6 product-experience reaudit](../research/mvp-product-experience-reaudit.md) has no unresolved critical or major machine-assisted finding, and exact repository safety and hosted verification pass. A revision-isolated production-native review profile corrected the invalid first human launch, but the restarted valid [human evaluation](../research/x6-product-experience-human-evaluation.md) rejected source `41ffad2` during its first-value journey. The [production migration plan](mvp-redesign-production-migration.md) now owns corrective increments X6-C1 through X6-C5. Reports and personal range definition retain their explicit Alpha classification, and the compact-navigation amendment recorded by the pre-review audit remains mandatory. Product capability, architecture, data safety, and the persistent desktop shell retain their verified evidence, but the complete production experience is not accepted. The original [independent product-experience audit](../research/mvp-product-experience-audit.md) remains the historical diagnosis that triggered this systemic intervention.

Functional growth remains frozen while this phase is active. Work may change lower-layer contracts only when necessary to make an accepted MVP journey understandable and complete; it may not add providers, connected APIs, MCP access, new analytical domains, or other roadmap capability. The [production migration plan](mvp-redesign-production-migration.md) owns current increment and evidence status.

Current product behavior remains canonical in [requirements](../requirements.md). The previous production sequence and its evidence remain in the [MVP experience delivery plan](mvp-experience-delivery.md); they are an engineering baseline, not the design specification for this intervention. No parallel executable will be created. Exploratory alternatives remain non-production design material until one direction is accepted.

## Objective

Make FitFreed immediately useful as a personal history explorer. A person should understand within seconds that the application turns an owned fitness export into questions, comparisons, and evidence-backed findings that remain under their control.

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
- **Trust is earned through restraint.** In-application copy states the current fact, consequence, evidence, or action without promotional theatre. Visual distinction and warmth remain, but the working application does not keep selling itself after the person has entered the task.

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

## Provisional experience model

The current evidence supports behavioral modes, not demographic personas. Names, ages, occupations, motivations, and quotations would be invented rather than researched and therefore must not drive the design. One person may move through every mode as confidence and curiosity grow.

| Mode | Immediate intent | Required default | Complexity available on request |
|---|---|---|---|
| Reclaim | Obtain and safely incorporate an owned export | Clear promise, provider guidance, visible local processing, consequence-led result | Artifact coverage, compatibility evidence, provenance, reimport semantics |
| Recognize | See whether the library feels like their actual sporting history | Time span, sports with names and visual identity, recent or memorable sessions, one honest observation | Search, calendar, filters, domain coverage, source separation |
| Investigate | Understand what happened in a period or session | Coherent visual story with the most relevant comparison, structure, and context | Aligned signals, routes, zones, criteria, exact values, limitations, provenance |
| Author and reuse | Preserve an interpretation and use it elsewhere | A useful report result ready to read, refresh, and export | Composition, narrative, exact tables, privacy choices, versioning, portable definitions |
| Steward | Maintain trust in the local library over time | Clear source status, update state, and next safe action only when needed | Import history, compatibility detail, settings, recovery, future backup and normalized export |

These are engagement modes, not separate editions or permission tiers. The same canonical object and navigation model must support them. Progressive disclosure adds evidence and control without replacing the result, changing terminology, or forcing a person to restart in an “advanced” workspace.

### Jobs the product must complete

1. **Establish ownership:** when a person obtains data from a provider, help turn it into a safe, durable local library and explain exactly what became usable.
2. **Restore recognition:** when the archive is abstract or unfamiliar, reconstruct a history the person recognizes through sports, time, places where safe, and individual sessions.
3. **Answer a real question:** when curiosity arises, provide one bounded understandable answer and a direct path to the records that support it.
4. **Explain a workout:** when a session matters, align its structure, route, signals, and authored criteria into one story without inventing unavailable evidence.
5. **Preserve interpretation:** when an answer matters beyond the current screen, let the person save, refresh, inspect, and export it without losing authorship or provenance.
6. **Leave with the result:** when a person wants another tool or no longer wants FitFreed, provide open documented outputs rather than creating replacement lock-in.
7. **Recover trust:** when input, compatibility, update, or evidence is partial or fails, state the consequence for the existing library first and provide one safe next action before diagnostics.

### Progressive engagement contract

| Level | Person receives | Product withholds until requested |
|---|---|---|
| Glance | One conclusion or recognizable record, relevant period, strong visual explanation, plain-language consequence | Exhaustive metrics, source terminology, editor controls, raw precision |
| Explore | Browsable history, direct comparisons, clear refinements, contextual navigation | Raw samples, version identifiers, full compatibility matrix |
| Inspect | Attributed structure, aligned evidence, limitations that affect the answer, exact-value entry points | Unrelated diagnostics and configuration |
| Control | Criteria, classification, report composition, privacy choices, provenance, export and maintenance evidence | Nothing supported; the person can inspect every transformation and portable result |

Advancing a level never removes the prior explanation. Exact detail supports meaning; it does not replace it with a second disconnected interface.

### Evidence and validation register

| Hypothesis | Current evidence | Validation route |
|---|---|---|
| Personal meaning must arrive before inventory or controls | Product-owner review, PX-01, PX-05, and the product utility contract | Five-second populated-Home comprehension and time to first evidence action |
| One person moves between simple consultation and advanced control | Product-owner requirement for different engagement levels; current journeys expose both behaviors | Scenario sessions that begin with recognition and later require exact evidence or authorship without switching product mode |
| Training and sports are the primary recognition hierarchy | Confirmed product contract, multi-sport reference evidence, and owner review | Find-a-remembered-session tasks using sport, approximate time, and one distinctive attribute |
| A composed visual story reduces session interpretation burden | PX-07, PX-08, and owner request for a radical increase in visual information | Explain-back testing: identify structure, meaningful change, missing evidence, and exact-value path from one session |
| Route-bearing sessions require a map-dominant workbench | Product-owner rejection of the X3 card composition; the map occupied less space than a generic signal chart and made route inspection secondary | Five-second hierarchy check, route-shape explain-back, start/finish and selected-position location, synchronized map/signal task, wide/compact/200% review |
| Most visits to a saved report begin with reading, not editing | Product-owner report observation and PX-09 | Reopen, identify the finding, refresh, export, then deliberately edit without instruction |
| Concentrating source coverage improves trust more than repeating warnings | Product-owner review and PX-04 | Successful-partial and rejected-import consequence comprehension before opening diagnostics |
| Recognizable labels and visual identifiers are ownership behavior | Product-owner review and PX-06 | Scan mixed-sport history, classify an unknown reference in context, and find the updated sessions |
| Visible data exit increases perceived control | Product thesis, ownership contract, and product-owner review | Locate the available report export, explain its scope and privacy choices, and distinguish it from future full-library exit |
| Restrained factual copy creates more trust than promotional enthusiasm | Product-owner review of the current application and the serious local-data context | Compare comprehension, perceived credibility, and expected capability using the same task hierarchy with restrained and promotional variants |

No hypothesis becomes accepted merely because a mockup looks plausible. Results update this register and the applicable requirement before implementation direction changes.

## Critical journeys and task success

### J1 — From legal access to first personal value

**Trigger:** the person has heard that an export exists, or already has an archive, but does not know whether FitFreed is useful.

**Task:** understand the promise → obtain or choose the archive → remain oriented during processing → understand what entered the library → encounter one supported personal answer or recognizable record → choose a relevant next exploration.

**Success:** no provider-format knowledge is required; the active operation owns the viewport; prior-library safety and current consequence are plain; diagnostics are optional; the completed import leads to history rather than file counts.

### J2 — Find a remembered workout

**Trigger:** the person remembers a sport, approximate date, route, duration, or distinctive measurement.

**Task:** open Training → recognize the overall sports history → scan chronology or calendar → refine only when useful → open the session → return to the exact origin.

**Success:** visible sessions precede filter setup; sport labels and identifiers are recognizable; applied filters are unmistakable; the return action restores view, query, selection, position, and focus.

### J3 — Understand one workout

**Trigger:** a session is interesting because of performance, memory, route, structure, or comparison.

**Task:** grasp the session at a glance → for a routed session, enter a map-dominant workbench and understand the complete route before inspecting a point or section → correlate the selected geography with elapsed or distance-aligned signals → inspect relevant structure, zones, or signals → select or author segmentation when useful → reach exact evidence or provenance deliberately.

**Success:** the person does not assemble a story from unrelated long sections; the map is unmistakably the primary evidence for a routed session and its shape, direction, endpoints, current selection, orientation, scale, and local coordinate context are legible without opening a secondary view; missing laps, routes, or samples alter the composition honestly; structure and signals share an understandable time context only where their recorded relationship supports it; exact values remain accessible.

### J4 — Make an anonymous sport recognizable

**Trigger:** a repeated source sport cannot be named safely from imported evidence.

**Task:** see affected sessions in context → understand why classification is unresolved → assign a family, display label, and visual identifier → see every relevant history view update → revise or defer without losing access.

**Success:** FitFreed never guesses; classification is not a detached maintenance chore; one action resolves the repeated reference consistently and preserves authorship through restart and reimport.

### J5 — Ask, compare, and preserve

**Trigger:** the person wants to understand change across periods or preserve a session interpretation.

**Task:** begin from a question, completed exploration, or session → review a prepared result → inspect supporting evidence → save if not already durable → reopen on the result → refresh deliberately when stale → export after a focused privacy review.

**Success:** the editor is not the default destination; a useful result exists before advanced composition; report state and source state remain connected; exported output is understandable without FitFreed.

### J6 — Recover from an import problem

**Trigger:** an archive is invalid, partly understood, incompatible, interrupted, repeated, or fails unexpectedly.

**Task:** learn whether existing history changed → understand whether any new history is usable → take one safe next action → inspect family or technical detail only if needed → retry or leave without corruption.

**Success:** red severity reflects consequence rather than parser vocabulary; repeated imports are reassuring rather than suspicious; detailed coverage has one canonical home; no unsupported content is silently discarded.

### J7 — Reuse or leave

**Trigger:** the person wants to use a result in another context, preserve the library independently, or stop using FitFreed.

**Task:** choose the intended output → understand scope, privacy, format, provenance, and known loss → create a documented reusable artifact → verify where it was saved.

**Success:** the current MVP provides deterministic report HTML. Portable library backup and normalized-data export remain confirmed obligations but have no implemented application port; they must not appear as available actions during this redesign. Their future conceptual home and discoverability are reserved without breaching the functional-growth freeze.

## Lower-layer feasibility map

| Journey need | Current support | Design consequence |
|---|---|---|
| Import phase, progress, cancellation, terminal safety | `ImportProgress`, `ImportOutcome`, transactional import coordinator, coverage and recovery state | Primarily hierarchy and consequence-language work; a presentation-specific consequence projection may be needed so React does not interpret technical codes |
| First personal answer | Home exposes ranges, domain and measurement coverage, question destinations, import counts, and resume state | Insufficient: a bounded application read model must provide a conclusion or recognizable-record fallback before Home can claim an answer |
| Complete-history recognition and finding | Indexed session search, summaries, calendar, sports, classifications, selection snapshots, durable discovery workspace | Sufficient foundation; default ordering, recognition, refinement disclosure, and in-context classification require redesign |
| Human-readable sport identity | Canonical family, optional user label, authorship, revision, affected-session coverage | Data support exists; provider-neutral icon semantics and presentation mapping remain to be specified |
| Coherent workout story | Independent validated structure, route, signal, aligned-signal, zone, segmentation, exact pagination, and provenance queries | Insufficient composition: define an application-level session-story contract rather than joining independent commands in presentation |
| Source and user-authored route ranges | Manual and automatic source laps expose ordered split time, duration, distance, provenance, and opaque identity; reusable user segmentation persists elapsed boundaries and attribution | Insufficient as one concept: source lap names and other provider phases are not retained uniformly, and no session-scoped named-range aggregate, persistence, mutation port, or composed route-and-signal summary exists |
| Period questions and exact evidence | Activity, training, sleep, recovery, and longitudinal overview/comparison use cases | Supported calculations exist, but question selection and explanation need a bounded result contract rather than a dashboard assembled from unrelated summaries |
| Result-first saved reports | List, resolve, stale detection, refresh, source navigation, privacy authorization, deterministic HTML export | Lower layers are sufficient for reading and export; presentation hierarchy currently exposes composition too early |
| Report composition and authorship | Versioned definitions, typed ordered blocks, optimistic revision, multi-origin starts, persistence | Preserve behind deliberate editing; do not simplify by weakening reproducibility or block behavior |
| Context-preserving navigation | Canonical destinations, presentation origin descriptors, discovery persistence, focus and restart restoration | Preserve and extend to redesigned detail states; no new business persistence is implied |
| Human-scale formatting | Raw typed values and existing domain-specific presentation formatters | Consolidate scale-aware locale rules and acceptance examples; preserve exact DTO values and evidence paths |
| Source coverage detail | Exact artifact classification, family reason codes, counts, mapping and adapter versions, source history | Keep in import result and Sources; surface elsewhere only through answer-specific consequence supplied by an application contract |
| Current data exit | Deterministic self-contained report HTML only | Make existing export prominent and honest. Backup and normalized export remain unimplemented requirements and cannot be simulated by UI |

This map is a design constraint, not implementation authorization. Before a later production control is specified, its command, DTO, use case, persistence behavior, and failure semantics must be verified at the exact lower-layer boundary.

## Information and state architecture

### Canonical object hierarchy

The library is the root product object. Provider archives establish and update it, but they do not define how a person navigates it.

```text
Owned library
├── Sports history
│   ├── Sport
│   │   └── Session
│   │       ├── Workout story
│   │       ├── Source structure
│   │       ├── Signals and zones
│   │       ├── Route evidence
│   │       ├── Personal criteria
│   │       └── Exact evidence and provenance
│   ├── Chronology and calendar
│   └── Period questions and comparisons
├── Context
│   ├── Daily activity
│   ├── Sleep
│   └── Recovery
├── Authored results
│   ├── Saved report result
│   └── Report definition and export
└── Ownership operations
    ├── Sources, imports, and coverage
    ├── Preferences and privacy
    └── Portable outputs
```

Activity, sleep, and recovery can explain or contextualize a training question, but they do not replace Sports history as the default recognition path. Reports reference canonical evidence without becoming a second copy of the library. Sources explain origin and incorporation without becoming the ordinary exploration hierarchy.

### Conceptual homes

Labels and exact navigation composition remain candidates for X2, but each responsibility has one owner:

| Home | Primary outcome | Default content | Secondary depth |
|---|---|---|---|
| Home | Understand what is worth seeing now | One personal answer or recognizable fallback, period, visual evidence, resume path | Question catalogue and library orientation |
| History | Recognize and explore the owned record | Sports and recent sessions, chronology or calendar, direct browsing | Filters, comparisons, contextual activity/sleep/recovery, exact evidence |
| Reports | Read and reuse durable interpretations | Saved result or guided result starts | Refresh, export, then deliberate editing and advanced composition |
| Sources | Establish and maintain the library | Obtain/select source, active operation, consequence-led result | Full family coverage, provenance, compatibility, reimport history |
| Settings | Control lasting application behavior | Appearance and language | Accessibility, data/privacy policy, updates, application information |

Portable backup and normalized export ultimately belong to ownership operations, not report composition or general preferences. Until their application contracts exist, no available control or false empty panel will imply that they are implemented.

### Result, detail, and control states

Each workspace uses mutually understandable states instead of appending every capability to one document:

1. **Orient:** identify the current object, question, period, and one useful next action.
2. **Browse or read:** show the history or result as the primary content, with refinements available but not preceding it.
3. **Inspect:** replace the primary content region with focused detail while persistent navigation and an explicit origin-aware return remain visible.
4. **Control:** enter editing, classification, criterion, privacy, export, or maintenance as a deliberate task with save/cancel and a named return destination.
5. **Recover:** when the primary task cannot continue, replace it with consequence, preserved state, and one next action; diagnostics disclose beneath or beyond that recovery path.

List and selected detail, report result and editor, active import and disabled source choices, or error recovery and the failed form must not compete as equally prominent content. A side sheet, modal, inline expansion, or full destination is chosen according to task interruption and evidence depth during X2; all must implement the same state ownership.

### Disclosure grammar

Every answer-bearing surface follows one semantic sequence even when its visual composition differs:

1. **Meaning:** one conclusion, recognizable record, or plain-language consequence.
2. **Visual explanation:** the relationship, structure, time, route, or change that makes the meaning intelligible.
3. **Supporting evidence:** only the dates, units, comparison boundary, coverage, and attribution needed to trust that meaning.
4. **Next questions:** a small number of relevant routes that continue the same line of inquiry.
5. **Exact detail and control:** tables, raw precision, provenance history, criteria, editor mechanics, diagnostics, and export choices on deliberate request.

Missing or unsupported evidence enters step three only when it changes the meaning. General importer capability belongs to Sources. This grammar does not hide evidence: it gives every layer a predictable route and prevents exhaustive values from becoming the default explanation.

### State lifetime

| Lifetime | Examples | Owner |
|---|---|---|
| Canonical and durable | Imported facts, source provenance, sport classifications, segment criteria, report definitions | Domain and persistence through application use cases |
| Durable preference | Locale, appearance, content zoom | Preferences application port and persistence |
| Restorable exploration | Applied query, chronology/calendar mode, comparison basket, open subject, origin, focus and meaningful position | Versioned workspace contract plus presentation navigation |
| Current-task draft | Unsaved report edits, classification edit, criterion edit, export privacy choices | Mounted presentation state until save, cancel, or explicit leave |
| Ephemeral inspection | Hover/focus value, selected chart interval, disclosure expansion | Presentation only; never silently promoted to business state |

A task transition must state whether draft or selection is preserved, discarded, or saved. Restart restores only behavior promised by a versioned contract; apparent persistence is not inferred from a mounted React component.

### Formatting and visual evidence grammar

- Summary duration uses the largest useful human units; elapsed session positions may use minute/second precision; milliseconds appear only when exact evidence makes them meaningful.
- Dates use locale-aware human labels in summaries and an unambiguous localized full form in detail; machine timestamps remain confined to provenance or export contracts.
- Values keep their unit adjacent, apply scale-appropriate precision, and never imply accuracy beyond the source.
- Sport visual identifiers combine icon and text; color alone never carries identity.
- Time-aligned session visuals share an elapsed axis and selection when evidence can be related. Each lane retains its own unit and scale; no hidden normalization or causal claim is introduced.
- Gaps interrupt marks rather than becoming zeros or interpolated continuity. A concise explanation accompanies the affected answer, with exact coverage available on request.
- Dense tables are exact-evidence views with stable headings, units, pagination, and export paths; they are not default dashboards.
- Headings name the current object, question, result, or state. Supporting copy adds information that is not already visible; it does not praise FitFreed, dramatize a routine operation, or restate the product proposition on every workspace.

### Coverage ownership

| Surface | Coverage shown by default |
|---|---|
| Import result | What became usable, what did not, consequence for the library, and one next action |
| Sources detail | Complete classification by family, reason, compatibility evidence, mapping version, and provenance |
| Home or comparison | Only the period and measurement coverage required to qualify the displayed answer |
| History | Only gaps that change recognition, filtering, or comparison; unknown sports become contextual actions |
| Session | Only missing structure or signals that alter the current workout story or selected inspection layer |
| Report result and export | Coverage and limitations attached to the affected finding or block, plus privacy scope at export |
| Settings | No source coverage; it is not a preference |

This routing makes source transparency explicit without turning FitFreed's current importer boundary into the dominant message on every screen.

## First-run promise

The initial experience has very little time to establish relevance and trust. It must:

- communicate the concrete outcome before explaining the import mechanism;
- show representative questions and visual value without pretending that synthetic examples belong to the person;
- make the first action unambiguous;
- explain local processing and the absence of an account without a legal or technical wall of text;
- set honest expectations about supported information and processing time; and
- turn successful import into a useful personal result rather than an ingestion report.

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

The comparison covers first run, active import, import result, populated Home, training history, sport recognition, session story, report result and editing, export, return navigation, partial data, and recovery. It uses independently constructed multi-sport data at realistic density and evaluates restrained factual copy as part of credibility rather than treating content as decoration added after layout selection.

**Gate:** one coherent direction demonstrates a materially faster route to meaning, makes the product's functional depth discoverable, and satisfies the non-negotiable mandate. The product owner reviews the direction before production presentation code changes.

### X3 — Specify the accepted experience

Record the selected information architecture, task flows, interaction and state contracts, visual-explanation grammar, content hierarchy, responsive behavior, localization behavior, accessibility alternatives, and component responsibilities. Produce reviewable high-fidelity views for every critical state rather than only an ideal populated dashboard.

The [MVP experience specification](../design/experience-specification.md) is the accepted canonical X3 contract. This plan retains the method and gate; amendments to screen or interaction behavior belong in that specification rather than in a second description here.

Begin by resolving the identity of saved views, saved answers, and reports. Revisit the behavioral modes, jobs, and journeys with report-specific tasks before retaining labels or controls from the X2 study. No action such as “Keep as report” may enter the production specification until its resulting object, later destination, lifecycle, evidence semantics, and export behavior are predictable.

Review at realistic macOS desktop and compact sizes, 100% and 200% content zoom, reduced motion, light and dark appearance, and both initial locales. Evaluate five-second promise comprehension, thirty-second first-action comprehension, time to first useful result, session findability, report-result recognition, and recovery from realistic failure.

**Gate:** the direction is coherent, lower-layer feasibility is traced, all critical states are represented, and acceptance observations are recorded. A visually attractive screen set without task evidence does not pass.

### X4 — Plan the production migration

Derive vertical increments from the accepted journeys. Each increment begins with required application and persistence contracts, proceeds through TDD, replaces the ordinary product surface without creating a second executable, and preserves existing safety, exact evidence, provenance, localization, accessibility, navigation, and report reproducibility.

The [MVP redesign production migration plan](mvp-redesign-production-migration.md) is the canonical
implementation-facing X4/X5 sequence. It maps the retained D0–E6 engineering baseline into functional
increments and owns their current status, dependencies, verification, documentation, and intervention
gates.

The published product site is an early delivery surface once X3 has fixed the product identity, information hierarchy, and factual language. Update it before or alongside the first production-application increment so the public explanation reflects the accepted direction. The site must clearly distinguish the current released experience from work in progress and later scope; design acceptance alone must never make an unimplemented application capability appear available.

**Gate:** every increment delivers an evaluable user outcome, has explicit regression and usability evidence, and leaves the application coherent if later increments have not yet landed.

### X5 — Implement and validate

Implement in order of time to personal value: import confidence and result, first populated answer, recognizable training history, coherent session story, result-first reporting and export, then cross-journey density and consistency. Run exhaustive interface behavior tests, the complete packaged journey, performance gates, and privacy-safe usability evaluation against the accepted design contract.

**Gate:** the independent product-experience audit is repeated against the ordinary release-shaped application. Functional implementation, attractive presentation, or green automation alone cannot close this phase.

## X2 direction decision

The interactive comparison considered three materially different hierarchies:

- **History Desk** makes the owned sports history the stable desktop object and keeps direct browsing, recognition, and origin-aware detail primary.
- **Answer Canvas** leads with one bounded supported conclusion and presents its included sessions as inspectable evidence.
- **Living Chronicle** organizes the library as an editorial time narrative; it is emotionally legible but makes exact retrieval, report work, keyboard interaction, and existing application-contract reuse less direct.

The product-owner review accepted **History Desk** as the stable architecture—Home, History, Reports, Sources, and Settings—and found it the more immediately engaging direction. **Answer Canvas** is retained as a bounded interaction pattern for supported questions and evidence, including Home and the post-import experience; it is not a competing shell. Living Chronicle remains a possible History lens rather than a competing application shell.

The acceptance is conditional on preserving functional depth. Lower initial density must not become reduced capability: recognizable summaries and visual explanations lead, while exploration, exact data, criteria, provenance, and advanced control remain available at the progressive-engagement level where the person asks for them. The redesign succeeds only if it reduces intimidation without making FitFreed shallow.

The candidate also establishes these state choices:

- session selection opens a composed story or focused detail while preserving the exact filtered origin;
- a saved report opens on its result and evidence; its ordered definition appears only in a deliberate editing state;
- import progress dominates its active operation, cancellation states what remained unchanged, and completion leads with the usable history while keeping exact source incorporation available on request;
- first run explains local processing and demonstrates only illustrative capability before asking for an archive; and
- application copy identifies facts, evidence, consequence, limitation, and action without promotional claims or manufactured excitement.

The executable study uses independently invented multi-sport data. Interaction checks cover meaningful filter input and return-state persistence; exact session evidence; report validation, multiple blocks, ordering, removal, save, reopen, and export intent; import guidance, cancellation, retry, completion, coverage, and source detail; settings; all primary navigation; and structural accessibility across initial and dynamic states. Visual review covers wide desktop and compact reflow. This evidence validates the candidate's task and state model, not production data correctness or unimplemented capability.

Production implementation still requires an application-level bounded Home result and a composed session-story contract. Portable library backup and normalized-data export also remain confirmed MVP obligations without current application ports. Presentation code must not assemble these business read models itself or imply that the missing contracts already exist.

The stable direction is accepted for X3 specification. The report concept demonstrated in X2 is explicitly **not** accepted as a finished product model: the study proves useful result-first interactions, but not what a report is, when it should be created, or how it differs from preserving an exploration or answer. Production presentation code remains deferred until X3 resolves that identity and passes its complete review gate.

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

## X3 tracking-workbench amendment

This amendment is an open design investigation, not a request to preserve the
current composition with incremental improvements. Candidate experiences are
evaluated against the outdoor athlete's real investigation tasks and the best
experience FitFreed can credibly provide; implementation convenience, existing
component boundaries, and short-term MVP effort do not constrain the design
direction. The implementation plan is derived only after the experience has
earned acceptance.

The first X3 route-bearing session candidate is rejected. Although it linked a selected instant across
map, signal chart, structured values, and exact rows, it placed the map in a narrow card beside a
larger generic chart. The route therefore read as supporting decoration rather than as the primary
object a runner, paddler, cyclist, or hiker wants to investigate. Increasing that card by a small
fraction would preserve the same failed hierarchy and is not an acceptable correction.

This amendment is destination-led rather than implementation-led. It will not constrain exploration
to the current component library, the first provider's easiest fields, or the cheapest MVP layout.
The study may develop route playback, track overlays, attributed and user-authored range libraries,
range comparison, repeated-route context, direction and pause evidence, annotations, focused-map
workspaces, privacy transformations, and portable results far enough to understand one coherent
outdoor experience. X4 will then select the smallest vertical sequence that preserves that direction;
it may defer capability, but it may not replace the accepted destination with an unrelated shortcut.

### Comparable-product evidence

Comparable products supply useful interaction evidence, not a layout to copy:

- [Garmin Connect GPS track overlays](https://support.garmin.com/en-US/?faq=TldUa5u9Mj67FFw4usMcX7&productID=73207&tab=topics)
  place pace or speed, heart rate, elevation, and power directly against route geometry when an exact recorded relationship exists and choose a
  sport-appropriate default overlay.
- [Strava activity analysis](https://support.strava.com/en-us/articles/15401886-ride-activity-pages)
  links cursor and range selections across performance charts, instantaneous values, route
  highlighting, segments, and laps; its activity map can also become full screen.
- [COROS activity summaries](https://support.coros.com/hc/en-us/articles/15284799576980-Activities-Page-Activity-Summary)
  lead outdoor activity detail with the route, then let graphs expand and expose several aligned
  values through direct manipulation.
- [TrainingPeaks expanded analysis](https://help.trainingpeaks.com/hc/en-us/articles/115004910668-When-I-click-Analyze-I-can-no-longer-see-the-map-graph-other-charts)
  allows advanced users to arrange maps and graphs. That flexibility is relevant to later expert
  control, but an empty or configuration-led canvas would make the MVP's first interpretation harder.

The recurring useful patterns are a large or full-screen-capable map, direct metric overlays on the
track, linked brushing between geography and time or distance, range selection, sport-specific
measurements, and deeper charts after the route is recognizable. FitFreed must provide those outcomes
locally and accessibly without inheriting social, subscription, third-party tile, or configuration
assumptions.

### Structural alternatives

| Direction | Structure | Strength | Material risk |
|---|---|---|---|
| Map-led canvas | Compact session identity, full-width dominant map, attached selection strip, then conditionally related lanes or an independent signal destination and structure | Best route recognition, strongest geographic hierarchy, natural full-screen path, and clean progressive depth | Requires disciplined compact summary and explicit relationship authority so nearby signals do not imply unsupported synchronization |
| Dominant split workbench | Map receives roughly two thirds of a wide workspace; a persistent signal inspector receives the remainder | Keeps geography and several signals simultaneously visible for advanced inspection | Still sacrifices route area, becomes fragile at content zoom, and can turn the first view into an analysis console |
| Signal-led analysis | Large stacked plots lead; the map follows or appears as a synchronized secondary region | Strong temporal and range analysis when performance is the only question | Repeats the rejected hierarchy for route-motivated users and makes place, shape, direction, and repeated geography harder to understand |

The selected X3 direction is the **map-led canvas**. It is the only candidate that satisfies the
route-recognition task before adding analytical density. This is a structural decision, not a request
to enlarge the existing map card.

### Candidate anatomy and evaluation

On a wide route-bearing session, a compact identity and summary band gives way immediately to one
full-width map workbench. The map is the largest region on the screen and occupies the majority of the
primary exploration viewport. Its route, endpoints, direction, selected point, orientation, scale, and gaps
remain legible. A full-screen or focused-map action is part of the ordinary route task,
not an expert setting.

The workbench provides a recorded-track view and, only when an importer supplies an exact recorded
relationship, supported metric overlays such as pace or speed, heart rate, elevation, cadence, stroke rate,
temperature, or power. Overlay color always has a legend and a non-color encoding or structured alternative.
A compact strip attached to the map reports the selected elapsed time or distance and the available related
sport-specific values without covering important geometry. Exactly related signals may follow as full-width
lanes with the same cursor and range. Regular signals without that authority remain independently explorable
in a deliberate full-width destination; visual proximity never presents them as synchronized. Structure,
exact points, and provenance remain deliberate disclosures.

Range creation and editing keeps the route visible. On a wide screen, an inspector occupies roughly
one quarter of the workbench while the map retains the remaining area and updates both boundaries in
place. The inspector is a temporary task mode, not a permanent dashboard column; closing it restores
the full-width map without losing the saved selection.

At compact width or high content zoom, supporting lanes stack after the map and controls reflow before
the map loses useful area. A routed session never falls back to a narrow map beside a plot. A
non-routed session changes composition and does not reserve an empty map canvas.

The next X3 review fails unless a person can, without instruction:

1. identify the route as the page's primary evidence within five seconds;
2. describe its overall shape, direction, endpoints, and selected position;
3. select a point and a range from map, lane, section, and exact evidence while every representation
   remains synchronized;
4. switch to at least one meaningful sport-specific track overlay and understand its legend;
5. focus the map, restore the complete track, and return without losing the selected context; and
6. complete the same tasks with keyboard controls, in both locales and themes, at compact width and
   200% content zoom.

Human review on 2026-08-21 accepted deferring a deeper range-definition interaction review. The
current candidate is sufficient to evaluate the map-led direction, but it does not close the design
of range boundary selection, adjustment, naming, or presentation density. A later review must test
those tasks explicitly at ordinary 100% content zoom as well as at the required 200% accessibility
state. Oversized range controls at 100% are a design finding, not something that may be dismissed as
an artifact of the prototype.

The report experience and the range-definition experience are **Alpha UX candidates**. Alpha means
that each candidate demonstrates a valuable end-to-end purpose and is suitable for structured use
and learning, while its interaction model, hierarchy, density, and presentation remain deliberately
open to substantial revision. Neither experience is a stabilized UX contract, and future refinement
does not require preserving the current screen composition. Their underlying product requirements,
authorship, provenance, data integrity, and export guarantees remain mandatory.

The subsequent human review reopens the X3 gate: at ordinary 100% content zoom, the complete map does
not fit within an ordinary laptop viewport. Map dominance does not justify making the
primary object impossible to see as a whole. The candidate must balance horizontal and vertical
space against the actual application viewport, keep the complete route visible without initial
scrolling, and preserve usable map detail. This failure must be reproduced and corrected across the
ordinary laptop viewport, compact width, and 200% accessibility state before X3 can pass again.

### Mandatory pre-human design audit

No design candidate may be presented for human review or pass an experience gate merely because its
interaction checks, DOM assertions, localization checks, or automated accessibility audit succeed.
Those checks are necessary evidence, not a substitute for critical UX review.

Before every human design review, a separate falsification pass must try to disprove the candidate's
quality. It must, at minimum:

1. inspect the complete first viewport and the full scrolled journey at each named target viewport,
   including wide and short laptop profiles, compact width, and the 200% accessibility state;
2. repeat the inspection in both locales and themes with realistic longest content, empty, partial,
   error, loading, and populated states where applicable;
3. verify hierarchy, balance, density, legibility, control scale, complete visibility of the primary
   object, scroll continuity, focus movement, overlays, and absence of clipping or obstruction;
4. complete every principal task using realistic input, save, cancel, edit, remove, reload, keyboard,
   pointer, and recovery paths rather than checking only that controls exist;
5. apply established usability heuristics for system status, real-world match, user control,
   consistency, error prevention and recovery, recognition, progressive disclosure, and help; and
6. record every discovered defect, its severity, affected tasks and states, root cause, and explicit
   disposition before the gate can pass.

The pass fails if ordinary visual inspection exposes a material defect that the checklist should
have found. A candidate with unresolved critical or major defects is not review-ready. The human gate
evaluates a rigorously challenged proposal; it is not the mechanism used to discover basic layout or
interaction failures.

### Reopened X3 audit record

The audit records failures rather than treating the corrected screenshot as sufficient evidence:

| ID | Severity | Failure and root cause | Disposition |
|---|---|---|---|
| X3-UX-01 | Critical | The complete route map extended below an ordinary laptop viewport. A later generic SVG rule overrode the intended aspect ratio, while width-derived height and duplicated vertical context ignored useful viewport height. | Corrected with one compact session context, a viewport-aware map height, and a workbench-specific SVG rule. At 100% the complete prototype map now fits within the first viewport across the wide laptop, short laptop, and compact desktop target profiles. |
| X3-UX-02 | Major | The floating overlay legend covered geographic labels and could obstruct route evidence. | Legend moved into an attached region outside map geometry in wide, compact, and high-zoom layouts. |
| X3-UX-03 | Major | The primary navigation rail scrolled away during long session, report, and import journeys. | Rail now remains within the useful viewport while document content scrolls; the narrow horizontal navigation uses its own non-overlapping sticky position. |
| X3-UX-04 | Major | First run vertically centred a short composition, leaving a large empty region before the purpose and first action. | The first-run composition now starts near the top of the useful viewport and retains balanced whitespace below. |
| X3-UX-05 | Major | History and report headers exposed design rationale as application copy, and Settings appeared in both primary navigation and the workspace header. | Copy now answers the person's task; the redundant workspace action was removed while Settings remains in primary navigation. |
| X3-UX-06 | Major | A partial session repeated its title and gave an absent map the same visual area as recorded pace, amplifying a limitation instead of the usable evidence. | One session title remains; available evidence and gaps are summarized compactly; recorded pace receives the visual region; source structure remains an optional action. |
| X3-UX-07 | Alpha finding | Report composition at compact width places document structure before the result, and range definition still needs a dedicated density and boundary-selection review. | Deliberately deferred under the accepted Alpha classification; neither composition is a stabilized UX contract. Integrity, provenance, save/cancel, recovery, and export behavior remain tested. |
| X3-UX-08 | Major | Route and signal point targets shrank below 24 CSS pixels at compact width, even though their visible marks remained legible. | Invisible hit geometry is now independent from the visible marks and measures at least 25 CSS pixels at the compact audit viewport. Native range controls and report block actions also retain at least 32 CSS pixels of interaction height. |
| X3-UX-09 | Major | At an intermediate compact width, the sticky navigation assumed a one-line evaluator bar and overlapped its second line while scrolling. | A shared responsive evaluator-height token now positions both shell and navigation; evaluator actions no longer wrap internally, and long-page scroll checks cover wide, compact, and narrow layouts. |
| X3-UX-10 | Minor | The partial-session page heading repeated a catalogue of missing evidence immediately before the evidence summary, increasing warning density without helping the task. | The redundant heading copy was removed; the compact evidence summary remains the single explicit account of available data and source gaps. |
| X3-UX-11 | Major | Collapsed navigation retained accessible names but hid text labels, contradicting the canonical X3 prohibition on icon-only primary navigation. | Compact navigation keeps every icon and text label visible. Intermediate widths use a labelled compact rail; high zoom and narrow widths use labelled horizontal navigation. |

The corrected candidate has no horizontal overflow, clipped interactive control, or interaction
target below 24 CSS pixels in a 66-case matrix across the three named 100% viewport profiles. The
complete route map fits the first viewport in each profile. A separate
44-case matrix covers all 22 representative states in English/light and Spanish/dark at 200%; it has
no horizontal overflow or clipped interactive control, and the route map itself remains shorter than
the viewport once reached.

Long-page scroll checks keep navigation visible without evaluator overlap in session, report-editor,
and import-result journeys at wide, compact, and narrow widths. Real-browser task passes cover sport
classification validation/save/cancel/navigation, range validation and pointer/keyboard boundary
selection/save/navigation/reload/remove, and report validation/add/reorder/save/export/cancel/reopen.
Lighthouse snapshots of the complete session, partial session, and report editor score 100 for both
accessibility and best practices, and the final browser console contains no warning, error, or issue.

### X3 acceptance record

The product owner accepted the redesign plan and X3 direction on 2026-08-21. Acceptance preserves
the report and personal-range experiences as Alpha candidates rather than treating their current
composition as stabilized. It also incorporates X3-UX-11 as a mandatory conformance correction:
compact primary navigation always presents both the provider-neutral icon and visible workspace text.
X4 may now plan the production migration; acceptance does not claim that the ordinary application
already implements this specification.

### Range concept model

A **session range** is one contiguous chronological interval inside one exercise. Its canonical
boundaries are ordered elapsed offsets, not a rectangular geographic selection and not transient
screen coordinates. Route points, distance offsets, pauses, source structure, and signals are
resolved against those boundaries for one coherent evidence revision. This remains deterministic on
loops, self-crossings, retraced paths, pauses, and different sampling intervals.

Range identity and authorship are explicit:

- a source range references the imported manual lap, automatic lap, phase, or other supported source
  structure, retains its provider provenance and original title when present, and is immutable;
- a user range has its own stable identity, non-blank but deliberately non-unique authored title, exact start
  and end offsets, revision, and session/exercise ownership; it can overlap or nest another range because it
  expresses an observation rather than a partition, and choices with equal titles expose their exact boundaries
  rather than imposing a naming rule; and
- a temporary range selection has no durable identity and is discarded unless deliberately saved.

If a source structure has no title, presentation supplies a localized descriptive label such as
“Manual lap 2” without claiming that the provider supplied that name. A later authored alias can be a
separate user fact; it must never rewrite provenance. Source and user ranges can be displayed,
filtered, and compared together while retaining authorship independent of color.

A range summary is an application result, not a presentation calculation. It includes elapsed,
moving, and paused time when supported; distance and direction; available sport-specific aggregate
and boundary values; route and signal coverage; missing-sample intervals; source or user authorship;
and exact-evidence references. A range may span missing geometry or signals, but the resulting gaps
remain visible and its summary never fills them silently.

Map selection follows route order. On a loop or retraced line, spatially coincident candidate points
must expose elapsed or distance context so the person can choose the intended occurrence. The second
boundary must be later than the first; dragging either handle updates the map, structure, summary, exact
evidence, and only those signal lanes whose shared coordinate is explicitly established. Independent signal
views retain their own clocks and may offer a range starting point only through an application-owned coordinate.
Selecting a source lap or saved user range fits and highlights that route extent while leaving the complete
route visible as context. Whole-route reset restores the prior point or range selection rather than erasing it.

This model is deliberately distinct from a segment criterion. A criterion is a reusable rule and may
derive a partition or several disjoint sections from compatible evidence. A session range is one
named contiguous observation in one exercise. Criteria can offer their derived sections as starting
points for user ranges, but the two aggregates, commands, persistence, and authorship remain separate.

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

The existing report engine proves composition, persistence, deliberate refresh, privacy review, and deterministic export, but its interaction begins with authoring mechanics. The X2 prototype also used “report” too broadly: preserving an answer, reopening an exploration, authoring a durable analytical artifact, and exporting a document are related actions but not necessarily the same product object. Treating every FitFreed screen as a report would remove the term's meaning and make consequences such as “Keep as report” unpredictable. X3 therefore compared these structural identities:

- a **saved view** preserves navigation, filters, selection, and presentation for continued exploration;
- a **saved answer** preserves a question, criteria, reproducible result, evidence, and refresh semantics; and
- a **report** is an intentionally authored, durable, readable, and exportable artifact assembled from supported answers, sessions, visual explanations, exact evidence, and authored context.

Making all three first-class MVP objects would add separate persistence, management, compatibility, and lifecycle models without evidence that each is needed. Making every screen a report would remove the term's meaning. The X3 candidate keeps exploration resumable through its existing workspace contract and reserves **report** for a named, deliberately authored analytical document about one supported subject or question. Selected canonical evidence, block choice and order, criteria, privacy choices, and optional attributed interpretation constitute authorship. A generic blank report is excluded because it weakens this bounded identity.

The ambiguous “Keep as report” action is rejected. Contextual creation names its source and consequence, creates nothing before explicit save, and always returns to that source on cancel. Reports opens on readable results; editing, evidence refresh, export, and deletion are separate deliberate tasks. The complete proposed lifecycle and state contract live only in the [MVP experience specification](../design/experience-specification.md).

This resolution exposes three lower-layer gaps that production presentation must not conceal: `ReportSummary` lacks the subject, meaningful result, evidence state, and sensitivity projection needed for the library; report deletion does not cross domain, application, and persistence boundaries; and the current definition invariant requires narrative even though supported evidence plus a title can form a factual document. These contracts must change before their dependent UI is implemented.

Reviewers must be able to predict creation and cancellation consequences; create, reopen, read, edit, reorder, remove, save, refresh, export, and delete; navigate to the exact source and back; and distinguish report export from data exit. Preference alone does not validate the model. Reporting remains a product-design problem before it becomes a charting or document-generation library choice.

Implementation selection includes a focused evaluation of maintained open-source libraries for composable layouts, accessible visualisation, paginated document rendering, and export. Reuse is preferred when it preserves local-first operation, licence compatibility, portability, accessibility, deterministic output, and the Clean Architecture boundary. No library choice is mandatory if it compromises those outcomes.

The design must also define empty, partial-coverage, stale-definition, missing-measurement, incompatible-segmentation, export-failure, and reimport-change states. Exported reports must distinguish source facts, FitFreed calculations, user-authored text, and unavailable conclusions just as clearly as the application does.

## Working-material policy

Exploratory screenshots, external visual references, discarded directions, and temporary prototypes remain under the ignored local research area. Only the accepted direction, original project-owned assets, durable rationale, and implementation-facing specifications enter the repository.

## Acceptance boundary

A visually attractive dashboard is not sufficient. The accepted direction must make consultation and discovery easier than the current document-like sequence, preserve exact accessible alternatives, expose uncertainty and coverage, work without an account or network connection, and remain feasible through the Clean Architecture and DDD boundaries.
