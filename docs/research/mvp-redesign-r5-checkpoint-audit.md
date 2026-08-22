# MVP Redesign R5 Checkpoint Audit

## Status and verdict

Audited on 2026-08-22 against the packaged macOS application built from source
`8a08ef0e2bc04ba1b133cd95e558bb7c66748522`.

The redesign has materially improved first-run comprehension, source acquisition, import safety,
navigation, settings, and contextual analytical answers. It has not yet earned the intended first-use
recognition after import. X5-R3 and X5-R5 are therefore **reopened** before outdoor-session work begins:

1. post-import Home gives the import receipt and source coverage more prominence than the personal
   history that became useful;
2. distinct unresolved sport profiles collapse into one Home identity, so a representative multi-sport
   history does not yet feel like the person's own; and
3. History still presents exact machine-scale quantities and repeated unavailable values before a concise
   session summary.

One additional material discovery defect and one copy advisory belong to the same correction. A separate
test-evidence blocker means that a WebDriver session replacement must no longer be cited as proof of an
application-process restart.

This audit does not reopen X5-R1, X5-R2, or X5-R4. It also does not classify the not-yet-delivered session
workbench, adaptive session story, personal ranges, or result-first reports as regressions. Their accepted
work remains in X5-R6 through X5-R9.

## Audit question

The checkpoint asks whether the implemented R1–R5 journey lets a new person move from a credible first
impression to a recognizable owned history without understanding FitFreed's import model:

> understand the local product → obtain or choose an export → import safely → recognize what became useful
> → find a remembered session → remain oriented while investigating it

The result is judged against the accepted presentation grammar: recognizable meaning first, a useful visual
relationship, only the evidence needed to trust it, one relevant next action, and exact facts on deliberate
request.

## Method and evidence boundary

The inspection used the packaged desktop application through its production Tauri boundary. It covered:

- clean first run at ordinary and constrained presentation settings;
- provider acquisition guidance, archive readiness, active import, cancellation, completion, and exact
  coverage disclosure;
- immediate post-import Home and a later launch in a genuinely new application process;
- Home, History, Sports, session overview, recorded signals, route, Reports, and Settings;
- a small valid fixture and a reproducible two-year synthetic history containing 731 sessions and four
  distinct source sport profiles; and
- keyboard-reachable actions, page-level overflow, and automated accessibility checks on the principal
  first-run and populated surfaces.

The checkpoint complements rather than restates the exhaustive locale, appearance, zoom, functional,
performance, persistence, and privacy gates already recorded by each increment. No private export, local
path, machine-specific value, or screenshot is part of this evidence.

## Strengths that must be preserved

- First run explains the ownership purpose, local boundary, absence of an account, and two useful next
  actions without requiring prior product knowledge.
- Sources makes acquisition guidance, a protected active import, cancellation, a calm outcome, and exact
  incorporation coverage available in one coherent workspace.
- Settings gives language, appearance, and zoom a clear task model with preview and durable behavior.
- Home questions open result-first analytical canvases with progressive access to exact evidence.
- History opens on sessions and sport identity; structured refinements remain available without occupying
  the initial result position.
- Sport classification is honest, persistent, shared between contextual and management entry points, and
  never guesses provider meaning.
- The labelled five-workspace shell, exact return actions, local processing, and transactional import safety
  remain coherent throughout the inspected journey.

## Findings

| ID | Severity | Finding | Owning increment |
|---|---|---|---|
| RC-01 | Major | Post-import Home prioritizes a growth receipt and source-coverage action over personally recognizable value. | X5-R3 |
| RC-02 | Major | Distinct unresolved sport profiles collapse into one Home sport identity and lose their individual recognition path. | X5-R3 and X5-R5 |
| RC-03 | Major | History cards lead with exact timestamps, metre-scale distance, fixed metric slots, and repeated unavailable values. | X5-R5 |
| RC-04 | Material | The sport rail hides additional identities behind unannounced horizontal scrolling. | X5-R5 |
| RC-05 | Advisory | Some task copy exposes implementation or design language instead of the person's immediate consequence. | X5-R2 and X5-R5 |
| EV-01 | Evidence blocker | WebDriver `reloadSession()` replaces the automation session but does not prove a new packaged application process. | Cross-cutting test evidence |

### RC-01 — Import completion leads back to import accounting

After a successful import, Home gives a large “library grew” receipt and its source-coverage action the most
prominent next position. Personal sessions, sports, time span, and the supported historical observation sit
below it. The receipt is accurate, but it answers what FitFreed processed rather than what the person can now
do or recognize.

**Required outcome:** import completion may acknowledge the protected result once, but Home's initial
viewport must lead with the useful personal consequence and one action into the history. Exact source
coverage remains one deliberate action away in Sources and must not become the primary Home continuation.

### RC-02 — Multiple unresolved sports become one anonymous category

With four distinct source sport profiles, Home renders one “unclassified sport” summary containing every
session and reports the number of source profiles only as supporting text. History and Sports retain four
separate unknown identities, proving that the distinction exists below Home, but the principal reveal loses
it and offers no direct continuation to name those sports.

FitFreed must not infer a provider sport from an opaque source value. The solution is therefore not a guess;
it is to preserve stable unresolved identities and make the existing authored-classification task available
at the moment recognition is needed.

**Required outcome:** Home keeps distinct unresolved sport profiles distinguishable, states the bounded
classification need without alarm, and offers one contextual path to name them. A saved classification must
continue to propagate through Home, History, session detail, reports, restart, and reimport through the
existing authoritative contract.

### RC-03 — Exact evidence overwhelms session recognition

Chronological results currently include seconds in ordinary timestamps, express kilometre-scale routes in
metres, reserve the same set of metric cells whether evidence exists or not, and repeat “not recorded” across
many cards. The facts are correct, but their precision and fixed inventory obscure sport, date, duration,
distance, and the few recorded signals that help a person recognize a session.

**Required outcome:** each result card composes itself from available evidence, formats date, time, duration,
distance, and precision at a human scale for the active locale, and keeps exact source values available only
where deliberate evidence inspection requires them. Missing evidence changes the composition instead of
creating repeated empty metric slots.

### RC-04 — Sport discovery has an invisible continuation

At ordinary desktop width, a representative four-sport rail exposes only part of the available identities.
The region can scroll horizontally, but no visible cue, control, or layout change communicates that more
sports exist. A person can therefore miss a valid refinement and its classification action.

**Required outcome:** every available sport identity is visibly discoverable at supported geometry. Wrapping,
an explicit bounded scroller, or another accessible composition may satisfy the outcome; an unannounced
overflow region may not.

### RC-05 — Internal language leaks into ordinary tasks

Examples include “artifacts” during import, rationale about not “flattening” evidence in the History
introduction, and opaque ordinal source labels in session results. These phrases are not inaccurate, but they
ask the person to interpret implementation concepts or product-design intent before completing the task.

**Required outcome:** ordinary copy names the current action, consequence, origin, or limitation in factual
language. Architecture rationale and exact provenance vocabulary remain in their deliberate evidence and
technical-documentation homes.

### EV-01 — Session replacement is not process-restart evidence

The packaged journey uses WebdriverIO `reloadSession()` in paths described as restart coverage. Direct
inspection showed that transient in-process Home state survives that call. Running two separate packaged
WebdriverIO invocations against the same temporary library removed the transient state through the real
startup path, demonstrating the semantic difference.

This is not evidence of a product persistence defect. It is evidence that the existing automation proves a
new WebDriver session against the same process, not application shutdown and relaunch.

**Required outcome:** any acceptance row that promises restart behavior uses a harness that terminates the
packaged process, launches a new one against the same controlled library and preference state, and then
asserts the recovered user-visible behavior. Existing assertions must be adapted to preserve their intended
behavioral contract; they must not be removed or relabelled as restart evidence.

## Planned work that this checkpoint does not assess as complete

The current session overview remains a numeric inventory, signals are long independent sections, and route
evidence is a small coordinate-neutral preview rather than the accepted dominant synchronized investigation
surface. These are the starting state for X5-R6 and X5-R7, not reopened R5 findings. Likewise, user-authored
ranges remain X5-R8 and the result-first report lifecycle remains X5-R9.

Those increments must not reuse the current composition as their target. They remain bound to the accepted
map-led, evidence-adaptive, result-first contracts and their own independent visual gates.

## Disposition

The active [production migration plan](../plans/mvp-redesign-production-migration.md) owns correction order
and current status. R3 and R5 regain acceptance only after their corrected ordinary application journey,
focused behavior tests, complete affected gates, and a fresh packaged visual inspection all pass. R6 begins
only from that corrected discovery foundation.
