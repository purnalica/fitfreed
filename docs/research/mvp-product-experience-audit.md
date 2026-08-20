# MVP Product-Experience Audit

## Status and verdict

Audited on 2026-08-20 against the already-built release-shaped macOS desktop executable from source
`c8c8774ed4e175cead21d710db4cd97f96b242e1`.

The current MVP is **not accepted as a product experience**. Its functional depth, data-safety
behavior, navigation shell, and evidence access are substantial, but three release-blocking outcomes
remain unresolved:

1. a long first import does not keep meaningful progress and reassurance in the person's immediate
   field of view;
2. the first populated Home presents inventory and entry points, not the evidence-backed personal
   revelation required by the product contract; and
3. dense multi-session signal persistence has neither a representative synthetic acceptance gate
   nor a storage-efficient schema shape.

Six additional material findings and one advisory make the training and reporting capability harder
to recognize, interpret, and use than their implementation depth warrants. These are conformance
gaps against the existing [requirements](../requirements.md), not a request to expand MVP scope.
Exact-source engineering evidence remains valid for its tested boundaries; product-experience
acceptance is reopened.

## Remediation tracking

This audit remains the evidence baseline for subsequent product-owner review. Findings and required outcomes
are not rewritten when corrective work starts; independently verifiable remediation evidence is appended
here until the complete journey is audited again.

PX-03 has an implementation candidate under [ADR 0025](../architecture/decisions/0025-normalize-dense-signal-storage.md):
SQLite schema 24 gives samples a compact private series identity, preserves exact logical evidence through a
recoverable migration, and adds the required ten-year dense-history gate to local and hosted complete
verification. A working-tree diagnostic passed every new budget and exact-count assertion, but it is not
candidate evidence because the source was not clean. The same campaign subsequently passed for exact clean
source `7e847a149bfb768c9b32133d17665d0b9edd3ee4`, including 7,490,080 exact persisted samples,
a 134,008,832-byte current-schema library, and every accepted import, repeat, memory, discovery, overview,
and pagination budget. PX-03 therefore has accepted local evidence and remains open only until the same
source passes in the maintained hosted performance environment. The other findings remain unchanged pending
product-owner disposition.

## Audit question

The audit asks whether a person can move from curiosity to personal value through the current
desktop application without already understanding FitFreed's architecture or data model:

> understand the promise → import with confidence → discover something personal → inspect the
> evidence → remain oriented → preserve a useful interpretation

The evaluation applies the product's existing bar: excellence in the result, meaningful control for
the person, and progressive disclosure for different levels of engagement. Technical completeness
is necessary evidence, but it is not a substitute for that outcome.

## Method and evidence boundary

The audit used the current release-shaped application through its real Tauri desktop boundary. It
covered:

- a clean first run and provider-export guidance;
- selection, import, post-import handoff, and coverage communication;
- Home questions and domain coverage;
- training discovery by list, calendar, and sport;
- session overview, recorded structure, routes, signals, zones, user criteria, and provenance;
- report library, starts, composition, preview, persistence, and export behavior;
- Settings and constrained-width layout; and
- origin-aware return paths across Home, exploration, session detail, sources, and reports.

An independently constructed synthetic history supplied reproducible visual and interaction states.
The explicitly supplied private reference archive was used only for a privacy-bounded qualitative
check of realistic import and populated-history behavior. Private paths, values, dates, counts,
identifiers, screenshots, databases, durations, and derived fingerprints are not retained in this
document or any versioned artifact.

The exact packaged functional, performance, installation, update-recovery, accessibility, and
compact-layout campaigns already recorded in the
[readiness ledger](../testing/public-release-readiness.md) remain supporting evidence. The audit does
not repeat their claim. It evaluates whether their working controls compose into a convincing and
understandable product journey.

This is a structured independent product inspection, not a substitute for the later privacy-safe
human usability, VoiceOver, contrast, or realistic-candidate evaluation. A finding is retained when
it follows from observable current behavior and an existing accepted requirement, not from a taste
preference alone.

## Severity model

- **Release-blocking:** the primary ownership journey fails an existing acceptance outcome; the MVP
  cannot pass product-experience acceptance while it remains.
- **Material:** a central capability exists but its current interaction materially impairs discovery,
  comprehension, trust, or control.
- **Advisory:** the journey works, but a bounded improvement would increase clarity or efficiency.

## Strengths that remediation must preserve

The audit found a product with a strong underlying spine, not an empty visual prototype:

- The clean first run states the ownership promise, local boundary, first action, and representative
  outcomes clearly.
- Export acquisition guidance is concrete, available offline, provider-attributed, and explicit
  about the external boundary.
- Persistent sidebar navigation and named return actions keep the main conceptual homes coherent.
- Training detail exposes genuine recorded structure, routes, supported signals, exact values,
  zones, user-authored segmentation, provenance, and limitations.
- Missing source data is not invented; source facts, FitFreed calculations, and user authorship have
  distinct paths.
- Reports are durable evidence definitions with real composition, review, refresh, persistence, and
  deterministic self-contained export behavior.
- Language, appearance, content zoom, accessibility semantics, compact layout, and transactional
  import safety are implemented behavior rather than mock controls.

The corrective work must improve selection and explanation, not hide evidence, remove control, or
replace honest uncertainty with confident guesses.

## Findings

| ID | Severity | Finding | Acceptance consequence |
|---|---|---|---|
| PX-01 | Release-blocking | The first populated Home leads with inventory, not a personal answer. | The required immediate evidence-backed revelation is absent. |
| PX-02 | Release-blocking | Meaningful import progress is displaced below the initial viewport during a long operation. | The first import does not maintain trust or orientation. |
| PX-03 | Release-blocking | Dense signal persistence has a benchmark blind spot and storage-amplifying schema shape. | Realistic histories can impose unqualified import-time and local-storage costs. |
| PX-04 | Material | Compatibility and coverage language exposes technical urgency before user consequence. | A safe or partially useful outcome can feel like damage or rejection. |
| PX-05 | Material | Training discovery is filter-first and places the owned history below setup controls. | Sessions are harder to recognize and browse than necessary. |
| PX-06 | Material | Honest unknown sport references remain anonymous until a separate manual task is completed. | The person's own history does not initially feel recognizable. |
| PX-07 | Material | Session detail is a collection of long evidence sections rather than one workout story. | The person must assemble meaning across structure, signals, routes, and limitations. |
| PX-08 | Material | Current charts prove availability but provide too little explanatory context. | Visuals do not yet help a person interpret change, intervals, relationships, or route meaning. |
| PX-09 | Material | Report starts converge on advanced composition mechanics too early. | Lower-engagement users face authoring complexity before reviewing a guided useful result. |
| PX-10 | Advisory | Oversized repeated introductions consume the most valuable viewport space. | Compact and zoomed layouts conform technically but reveal less useful information initially. |

### PX-01 — Inventory is not a personal revelation

After import, Home's leading answer reports the number of recent training sessions and the library's
date span. The post-import panel reports new, enriched, and amended observation counts. The question
catalogue then offers routes into other workspaces. All of this is accurate, but none of it answers a
question about the person's history.

The underlying cause is not missing copy. The Home contract currently selects a leading destination
and formats domain counts; it does not receive a bounded answer read model with a conclusion and its
supporting evidence. Presentation therefore cannot produce the comparison or observation promised
by the accepted first-viewport target.

**Required outcome:** the first populated viewport must lead with one conservative, reproducible
observation or comparison supported by visible dates, coverage, and a direct path to its evidence.
Counts and library growth remain secondary evidence. When no analytical answer is supportable, the
fallback must be an honest recognizable-record outcome rather than a synthetic insight.

### PX-02 — Long import progress is outside the primary task surface

The selected-source card shows a generic “Importing and reconciling” status and cancellation action.
Detailed phase or percentage progress is rendered after both large source-choice cards. At ordinary
desktop geometry it is outside the initial viewport. A realistic reference import remained active
long enough for progress, expectation setting, continued local-processing reassurance, and safe
cancellation to become primary content rather than supporting detail.

The application remains responsive and transactional cancellation protects the library. The gap is
the information hierarchy: the operation that owns the screen is visually subordinate to choices
that can no longer be used while it runs.

**Required outcome:** while import is active, its current phase, determinate progress when available,
elapsed-work reassurance without a false completion estimate, local-processing boundary,
cancellation state, and safe recovery expectations must replace or precede inactive source choices
in the first viewport. Completion must hand off directly to personal value.

### PX-03 — Dense signal persistence is outside the performance gate

The realistic reference import exposed a substantial local-library growth and processing cost. No
private measurement is needed to establish the underlying evidence gap. The
[full-scale synthetic import fixture](../../scripts/generate-large-fixture.mjs) deliberately treats
its two million old-shape time-series samples as excluded input. The separate
[Insights fixture](../../scripts/generate-insights-performance-fixture.mjs) persists four bounded
signal series for only one session. Neither campaign qualifies dense supported signals distributed
across a long multi-session history, and no gate constrains resulting database size.

The [persistence shape](../../src-tauri/migrations/0017_training_session_signals.sql) compounds that
gap. Every signal-sample row repeats the textual origin, session, exercise, and role identity. SQLite
then maintains the non-integer composite primary-key index and a second explicit series-order index
with the same ordered columns. Dense histories therefore repeat long identities and equivalent
ordering structures for every exact sample.

**Required outcome:** introduce a provider-independent synthetic workload that represents supported
dense signals across a long session history and gates initial import, exact reimport, peak memory,
database size, session queries, bounded charts, and exact pagination. Redesign sample identity and
indexing where the measured cost requires it, without losing deterministic identity, exact values,
reconciliation, or migration recovery. Product acceptance requires this evidence on both maintained
performance environments.

### PX-04 — Compatibility consequence is not triaged before diagnostics

Rejected imports correctly preserve the existing library and expose detailed per-family reasons and
next actions. The prominent alert, however, begins with an inability to validate recognized data and
asks the person to report a compatibility problem. Detailed consequence and coverage live elsewhere
on the Sources surface. Successful imports can also elevate the undifferentiated statement that
source coverage “needs attention” before the person has seen what is usable.

This language is technically honest but asks a first-time user to interpret severity. It does not
first distinguish “nothing changed and your existing library is safe”, “useful history was imported
with bounded omissions”, and “optional technical detail is available”.

**Required outcome:** every import result must lead with its effect on the person's usable history
and the safety of prior data, then one concrete next action. Compatibility terminology and family
diagnostics remain available through progressive disclosure and retain their exact evidence.

### PX-05 — Training discovery starts with form setup

The Training workspace provides complete-history search, sorting, sport and measurement filters,
list and calendar views, pagination, and persisted exploration state. Its initial session surface
nevertheless places a large filter form before summary and results. Empty native date controls can
also display operating-system date affordances that resemble an applied current-date filter even
when no filter exists.

This makes the primary history feel like the output of a database query rather than something ready
to browse. The calendar is clearer once deliberately selected, but neither recent sessions nor a
recognizable history summary owns the first viewport.

**Required outcome:** Training must open on the owned session history and its useful browsing modes.
Search and filters must remain immediately reachable but become a refinement of visible results,
with unmistakable applied, unapplied, and cleared states.

### PX-06 — Sport ownership requires context before recognition

Unknown sport names correctly avoid guessing from opaque provider values, and the user-authored
classification workflow is persistent and traceable. Until classification is performed, however,
labels such as “Unknown sport 1” and “Sport not recorded” organize a personal history around source
ambiguity. Classification is a separate workspace rather than a guided continuation of the first
reveal or training entry.

**Required outcome:** unresolved sports must remain honest while becoming classifiable in context.
The person should see the affected sessions and available evidence, understand why the name is
unknown, classify repeated references efficiently, defer without losing access, and immediately see
the resulting history become recognizable. Provider-neutral authorship remains unchanged.

### PX-07 — Deep evidence does not yet form a workout story

The session workspace is the strongest proof of product depth, but it is split into tall Overview,
Structure, Signals, Routes, and Provenance sections. Structure, derived segmentation, signal
coverage, recorded zones, exact samples, route evidence, and repeated limitations each have valid
local explanations. The person must still integrate them mentally to answer what happened during
the workout.

The root cause is compositional: the sections mirror evidence families and their controls, while no
session-level narrative view aligns the most useful moments across elapsed time. Provenance and
limitations are repeated as primary prose because the visual explanation does not yet carry enough
meaning on its own.

**Required outcome:** the session should lead with one coherent, evidence-attributed workout story,
then disclose structure, aligned signals, route, exact values, provenance, and user criteria as
inspectable layers. Missing laps or routes must change the story honestly rather than leave an empty
template.

### PX-08 — Visual presence does not yet provide visual explanation

Route and signal views are local, bounded, accessible, and backed by exact alternatives. The route
is a normalized trace without cartographic context, which is an accepted MVP privacy boundary. The
individual signal plots, however, provide little temporal or scale context, and separate charts do
not make laps, pauses, user segments, zones, route progress, or important transitions legible as one
relationship. Cross-signal alignment is more truthful but still asks the person to infer most of the
meaning.

**Required outcome:** within the accepted local-SVG boundary, visuals must explain elapsed position,
units, scale, gaps, coverage, and attributed structure. Shared time selection and overlays or aligned
annotations should connect source laps, pauses, user segments, zones, and supported signals without
inventing causation. Exact accessible alternatives remain mandatory.

### PX-09 — Report power is disclosed before guidance

Report starts from questions, explorations, sessions, and blank definitions are real. The composer
supports typed blocks, ordering, narrative, evidence settings, save, preview, refresh, and export.
The prepared question correctly supplies a title, comparison boundary, and five evidence blocks,
while the blank path begins with authored narrative. Both paths nevertheless converge immediately
on the same dense editor. Product concepts such as finding blocks, exact tables, coverage blocks,
source revision, and sensitive content are exposed before a lower-engagement person can review a
first useful result.

**Required outcome:** question-, exploration-, and session-led starts must be the dominant paths and
produce a useful initial structure that can be reviewed before editing. Blank and advanced block
composition remain available as an explicit deeper level. The same reproducibility, authorship,
privacy review, exact evidence, and deterministic export contracts must survive the simplification.

### PX-10 — Repeated hero scale reduces information efficiency

The editorial visual language creates a distinctive first impression, and constrained layouts do
not overflow. Large headings and introductory copy are repeated across Home, Training, Reports, and
Settings, consuming enough vertical space that the page-specific result or controls often begin
below the fold. At compact widths and increased content zoom this cost grows.

**Required outcome:** preserve brand character on first run and major transitions, while established
workspaces prioritize current context, result, and next action. Layout acceptance must measure what
useful content is visible, not only the absence of clipping or horizontal overflow.

## Journey assessment

| Journey moment | Current result | Audit disposition |
|---|---|---|
| Five-second first run | Clear ownership promise and primary action | Preserve |
| Obtain an export | Complete, bounded, provider-attributed guidance | Preserve; reduce density only if evidence remains reachable |
| Choose a ZIP | Clear when the native picker succeeds | Preserve |
| Wait for a realistic import | Safe operation, weak foreground progress and unqualified dense-signal cost | Reopen under PX-02 and PX-03 |
| Understand an import result | Exact diagnostics, insufficient consequence-first triage | Reopen under PX-04 |
| Receive first personal value | Inventory and navigation, no actual answer | Reopen under PX-01 |
| Find a remembered session | Complete controls, filter-first entrance | Reopen under PX-05 and PX-06 |
| Understand one session | Deep evidence, fragmented interpretation | Reopen under PX-07 and PX-08 |
| Return to the origin | Coherent sidebar and named return paths | Preserve |
| Create a durable result | Complete capability, expert-first composition | Reopen under PX-09 |
| Configure the application | Clear conceptual home and durable controls | Preserve |

## Acceptance sequence reopened by this audit

Remediation should follow perceived value, not component convenience:

1. Make the realistic import wait trustworthy and consequence-led.
2. Qualify and correct dense-history import and storage behavior with representative synthetic data.
3. Deliver one genuine post-import personal answer with inspectable evidence.
4. Make the training history and unresolved sports immediately recognizable.
5. Compose session evidence into one visual workout story while retaining exact drill-down.
6. Lead report creation through a useful prepared result and progressively disclose expert controls.
7. Reassess information density at desktop, constrained width, both locales, and 200% content zoom.

Each step requires behavior-first application and persistence support before presentation claims it.
The exact executable-input fingerprint and its expensive hosted evidence need to be regenerated only
when an executable-affecting remediation enters the accepted source. Documentation-only disposition
changes do not invalidate the existing engineering campaign.

## Exit rule

The product-experience gate may return to **Passed** only when:

- PX-01 through PX-03 have release-shaped end-to-end evidence;
- PX-04 through PX-09 have either passed their stated outcome or received an explicit product-owner
  disposition recorded in the canonical plan;
- no correction weakens data safety, honest uncertainty, accessible exact evidence, provenance,
  navigation restoration, localization, or report reproducibility;
- the complete corrected journey is audited again from a clean library and a realistic populated
  history; and
- the later privacy-safe human evaluation finds no blocking or undisposed serious issue.

PX-10 may be accepted with a bounded residual if useful first-viewport content is demonstrably clear
at the supported geometries.
