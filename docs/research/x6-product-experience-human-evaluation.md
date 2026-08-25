# X6 Product-Experience Human Evaluation

## Status and boundary

**Rejected on 2026-08-25 for source `41ffad2eaec1862049c54c8a285277ac3f465abb`. The valid native session may
continue for diagnostic coverage, but the current experience cannot pass X6.**

This document is the canonical privacy-safe record of the human product-experience evaluation required by
the [X6 profile](../testing/macos-candidate-manual-evaluation.md#x6-product-experience-profile). It records
observable behavior and bounded participant impact without retaining personal fitness data, source paths,
screenshots, raw logs, routes, dates, values, participant identity, or exact workstation details.

The initial application was a clean, manually launched instrumented macOS build from source
`52fa9e949f5aaf5b4e4fccab995bfa646f0bc497`. Its executable inputs match hosted fingerprint
`3e0c2eb1dddc33cd295c8b6b504650b32e392589d396b7f835f53dec4f68e9d8`, which passed [repository
safety](https://github.com/purnalica/fitfreed/actions/runs/32743509862) and the [complete hosted
campaign](https://github.com/purnalica/fitfreed/actions/runs/32743509696). The application uses an isolated,
ignored library on local Apple Silicon. A participant-authorized personal export may be imported, but no
personal observation enters this record. That build was later proven unsuitable for this human session
because its instrumented native-boundary commands do not provide the production dialogs and external-opening
behavior. No observation from this invalid session is accepted as production-product evidence.

This evaluation can accept or reopen the X6 product experience only. It cannot accept signing,
notarization, installation trust, update recovery, a release candidate, or public distribution.

## Findings

### XH-01 — Acquisition actions produce no observable result

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending.
- **Observed task:** obtain guidance from the empty-library `Import your fitness history` journey using a
  pointer.
- **Observed behavior:** `Show me how` produced no visible transition. `Open official account page` and
  `Open official instructions` produced no visible application response and did not open the default browser.
- **Expected behavior:** the in-application guidance action reaches the promised acquisition guidance, and
  each explicitly external action opens its stated official destination or presents an actionable failure.
- **Participant impact:** a new person cannot complete the promised provider-export acquisition journey and
  receives no explanation that the action failed. This breaks a primary empty-library route before personal
  value can be reached.
- **Valid-build reproduction:** source `41ffad2eaec1862049c54c8a285277ac3f465abb` reproduces all three failures
  while its native archive selector opens successfully. `Show me how` was repeated later in the same valid session
  and again produced no visible navigation, expansion, or other result. The observation is therefore
  production-product evidence rather than an artifact of E2E routing.
- **Disposition:** reopen X5-R2.2. Diagnose the in-application action and external actions independently before
  designing a correction; their shared failure surface does not establish a shared technical cause. Add regression
  evidence for navigation, native browser opening, and actionable failure behavior before repeating this journey.
- **Correction evidence:** X6-C2 now reveals and focuses guidance, makes each official destination explicit and
  copyable, and retains either a factual operating-system acceptance or a focused failure beside the initiating
  action. [ADR 0028](../architecture/decisions/0028-own-official-destination-opening-in-the-application.md) replaces
  arbitrary frontend URL opening with application-owned destination selection and a categorized native launcher
  port. Component, contract, Rust, and packaged tests pass in both locales. Browser appearance remains unaccepted
  until the revision-isolated production package is reviewed with the actual default browser.

### XH-02 — Instrumented application invalidated the native-boundary evaluation

- **Status:** review-profile correction verified locally and by the exact hosted campaign.
- **Observed task:** select a personal ZIP from the empty-library import journey.
- **Observed behavior:** no native macOS file-selection sheet appeared. The participant recognized the same
  instrumented-build limitation encountered during earlier E2E work and closed the application.
- **Expected behavior:** the X6 human profile launches production native-boundary commands against an isolated
  library so archive selection, cancellation, external guidance, and browser opening can be evaluated directly.
- **Impact:** archive import could not begin, the acquisition observations cannot be attributed to production,
  and continuing would create false human evidence.
- **Valid-build reproduction:** the revision-isolated native application opens the macOS archive-selection sheet.
  The participant can select a ZIP, so the corrected profile exposes the production archive-picker boundary.
- **Disposition:** the invalid session remains discarded. Retain the revision-isolated profile, its full-bundle
  scanner, and complete hosted campaign [`32827945185`](https://github.com/purnalica/fitfreed/actions/runs/32827945185).
  The restarted valid session remains the only accepted source of production-product observations.

### XH-03 — Wrong archive produces a hidden, alarming, and unactionable explanation

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending.
- **Observed task:** recover after selecting a ZIP that is not the intended fitness-history export.
- **Observed behavior:** the result gives visual priority to `This archive was not imported` without an immediately
  visible explanation. Expanding `Why the import stopped` reveals `The package contains an unsafe file layout. Keep
  the original ZIP and report the compatibility problem; FitFreed did not extract it.`
- **Expected behavior:** the primary result explains in calm, specific language what FitFreed could establish, gives
  the safest likely recovery action, and reserves security or compatibility escalation for evidence that supports
  that classification. Essential recovery information is visible without discovery of a secondary disclosure.
- **Participant impact:** an ordinary selection mistake is presented as a potentially unsafe package, while the
  useful next action is unclear. The hierarchy and wording can create fear, imply a product or provider defect without
  sufficient evidence, and obstruct immediate recovery.
- **Disposition:** [ADR 0029](../architecture/decisions/0029-separate-package-identity-compatibility-and-safety.md)
  now separates package identity, current-content validity, provider compatibility, safety, and resource limits. The
  primary result contains the exact localized reason and safe next action; coverage remains secondary. Rust, transport,
  React, and packaged tests distinguish ordinary unrelated, malformed current, nested provider-shaped, traversal,
  duplicate, and resource-limit packages without exposing source locators or changing canonical history. Human tone,
  hierarchy, and recovery comprehension remain pending in the repeated production-native profile.

### XH-04 — Archive reselection updates content outside the visible viewport

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending.
- **Observed task:** choose another ZIP while remaining in the import workspace after a prior result.
- **Observed behavior:** native selection succeeds, but the selected archive appears in the upper `I have the ZIP`
  card while the viewport remains elsewhere. The participant discovered the changed state only by chance after
  scrolling.
- **Expected behavior:** completing native selection returns to a visibly updated archive choice with an obvious next
  action, while preserving accessible focus and a comprehensible spatial transition.
- **Participant impact:** a successful primary action appears to do nothing, recovery is interrupted, and the person
  may repeat selection or abandon the import.
- **Disposition:** reopen the owning X5-R2.1/X5-R3 transition. Investigate focus, scroll, and result-placement behavior
  together with XH-01 without assuming one implementation fix. Add browser-level regression evidence for selection
  from both the initial and post-result viewport positions.
- **Correction evidence:** X6-C2 applies one maintained-navigation-aware focus-and-scroll transition after initial
  and post-result selection, returns focus after cancellation, and recomposes Sources at 175% and 200% content zoom.
  Packaged WebKit asserts that the selected archive and enabled import action are visible together after every
  selection. The first complete run found a genuine 200%-zoom failure; the composition was corrected and the entire
  packaged journey then passed. Human spatial-comprehension confirmation remains pending.

### XH-05 — Text wraps prematurely across otherwise wider content regions

- **Status:** open; major systemic presentation finding in the valid native review build.
- **Observed scope:** multiple screens and content types throughout the application.
- **Observed behavior:** text frequently occupies several short lines even when its containing region has materially
  more horizontal space available.
- **Expected behavior:** line measure follows the reading purpose and responsive composition of each content type.
  Deliberate readability limits remain possible, but they do not create unexplained empty space, excessive vertical
  growth, or a visibly disconnected relationship between copy and container.
- **Participant impact:** screens feel unnecessarily long and fragmented, scanning becomes slower, and the broad
  desktop workspace appears underused.
- **Disposition:** audit the complete typography and layout constraint system by content role and maintained viewport,
  including nested maximum widths and grid tracks. Correct the shared rules and add visual assertions at representative
  widths; do not remove every readable-line-length boundary indiscriminately.

### XH-06 — Finalization provides no perceptible evidence of continuing work

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending. Runtime
  completion was observed in the rejected source, so the original finding was never evidence of a deadlock.
- **Observed task:** wait for an import after it reaches `Finalizing the updated library`.
- **Observed behavior:** the screen remains fixed on that phase without changing progress or other perceptible
  feedback, leaving the participant unable to tell whether FitFreed is working or blocked.
- **Expected behavior:** every potentially long finalization operation communicates continuing activity, bounded
  expectations where evidence permits them, safe cancellation semantics where supported, and a terminal result or
  actionable failure.
- **Participant impact:** confidence in data safety and application reliability drops during the most sensitive part
  of import, and closing the application becomes an unsafe-looking but tempting response.
- **Observed completion:** finalization eventually completed without restart and the previously unavailable History
  destination became active. This confirms functional progress but does not provide the person with perceptible
  evidence while waiting.
- **Disposition:** source-file mapping and canonical-item reconciliation now use separate monotonic bounded units;
  reconciliation remains rollback-cancellable, and the indeterminate commit phase begins only after that work
  completes. A delayed-progress watchdog explains continuing local work without terminating it, inventing a
  percentage, or promising a duration. Unit, integration, transport, React, and packaged tests cover progress,
  cancellation, retry, completion, failure, repeat, extension, and restart. Perceptibility and confidence remain
  pending in the repeated production-native profile.

### XH-07 — History is unavailable during opaque finalization without an explanation

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending.
- **Observed task:** leave the apparently stationary finalization screen through the application navigation.
- **Observed behavior:** `Home` can be selected, but `History` is not active while the import remains in
  `Finalizing the updated library`; the interface does not explain the disabled destination or provide a recovery
  path.
- **Expected behavior:** navigation availability reflects the data-safety boundary and communicates it where the
  person encounters the restriction. A long-running operation does not leave unrelated destinations appearing
  broken, and the safe post-operation route becomes available promptly.
- **Participant impact:** the person cannot inspect the library to determine whether import succeeded and receives no
  indication of whether to wait, cancel, retry, or close the application.
- **Disposition:** the application shell now owns the active-operation projection outside Sources and links back to
  the active Sources surface from its beginning. History explains initial loading, first import, post-commit
  projection, empty-library, and projection-failure states at the navigation control. A failed projection offers a
  local retry without reimporting; success enables History immediately, while completion, failure, and cancellation
  cannot leave stale busy state. Component, application integration, and complete packaged tests cover route-away,
  route-back, active, completed, failed, cancelled, delayed, retry, and restart behavior. Perceptibility and confidence
  remain pending in the repeated production-native profile.

### XH-08 — Imported sport types remain entirely unrecognized

- **Status:** open; critical functional and product-experience defect reproduced in the valid native review build.
- **Observed task:** reach Home after importing a long, multi-sport history.
- **Observed behavior:** Home reports no recognized sports even though the same screen reports multiple recorded sport
  types and the imported history is known to contain several distinct activities.
- **Expected behavior:** FitFreed translates supported provider sport evidence into recognizable provider-neutral
  identities wherever the evidence is sufficient, distinguishes genuinely unknown values, and makes optional personal
  naming an enhancement rather than a prerequisite for basic recognition.
- **Participant impact:** the primary organizing vocabulary of training history disappears, outdoor and indoor
  activities are indistinguishable at first use, and the product fails a central reason for importing the data.
- **Disposition:** reopen the owning sport-discovery and Home slices. Trace provider evidence through importer,
  canonical identity, classification, persistence, and Home projection before changing presentation. Establish the
  affected vocabulary with privacy-safe fixtures and add end-to-end regression evidence for recognized, ambiguous,
  unknown, and personally renamed sports.

### XH-09 — Home aggregates look actionable but do not lead to exploration

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending.
- **Observed task:** use the prominent Home summaries for imported training sessions and recorded sport types to begin
  exploring the library.
- **Observed behavior:** the aggregate badges invite a click through their prominence and compact control-like shape,
  but clicking them has no effect.
- **Expected behavior:** a prominent summary either acts as a clear route to the corresponding filtered evidence or is
  styled and worded unambiguously as non-interactive context. Home prioritizes the next useful question rather than
  presenting dead-end quantities.
- **Participant impact:** the first obvious exploration attempt fails silently and reinforces the impression that Home
  reports data without providing access to it.
- **Disposition:** positive session and sport totals are now explicit controls. The session total clears disposable
  training refinements before opening the complete newest-first session history; the sport total opens the complete
  sport-management view. Both use the existing durable training destination, preserve their exact Home origin, and
  restore focus on return. Zero totals remain non-interactive facts. Component, application integration, and complete
  packaged tests cover pointer and keyboard semantics, exact destinations, unfiltered-session state, and return focus.
  Activation value remains pending in the repeated production-native profile.

### XH-10 — The displayed history start boundary appears factually implausible

- **Status:** open; potentially critical data-integrity finding requiring provenance diagnosis.
- **Observed task:** assess the overall imported-history date range on Home.
- **Observed behavior:** the earliest displayed boundary falls exactly on the first day of a year and is strongly
  inconsistent with the participant's recollection of the fitness history.
- **Expected behavior:** every library boundary is derived from documented canonical evidence, formatted for the
  locale, and traceable to its included domains without substituting a coarse or default date for missing precision.
- **Participant impact:** a visibly questionable top-level fact undermines trust in every later chart, comparison, and
  report.
- **Disposition:** do not inspect or retain the participant's source data. Trace all synthetic date-boundary paths from
  provider mapping through canonical persistence and Home composition, verify whether year-only or profile evidence
  can enter the range, and add provenance-focused regression fixtures. Keep the finding open until the participant can
  validate a corrected privacy-safe explanation in the product.

### XH-11 — Sport-classification controls are visibly misaligned

- **Status:** open; major systemic form-composition finding in the valid native review build.
- **Observed task:** classify and personally name an unknown sport.
- **Observed behavior:** the broad-family selector and personal-name field start at different vertical positions, have
  inconsistent control geometry, and leave the action row visually detached. The imbalance remains obvious in the
  maintained desktop viewport shown during review.
- **Expected behavior:** related labels, controls, help, validation, and actions follow one aligned responsive form
  rhythm at every supported zoom and viewport, without sacrificing readable instructions.
- **Participant impact:** a task already made repetitive by missing recognition feels unfinished and harder to scan,
  reducing confidence that the saved classification will apply predictably.
- **Disposition:** include the editor in the systemic layout and typography audit from XH-05. Verify backend-supported
  save and reload behavior before changing UI, then add visual, keyboard, validation, multi-item, persistence, and
  supported-zoom evidence for the complete form.

## Passing observations

### XH-P01 — Import cancellation permits an immediate retry

- **Observed task:** start an import, cancel it deliberately, and start import again without restarting the
  application.
- **Observed behavior:** cancellation completes and the next import starts normally in the same session.
- **Boundary:** the cancellation-to-retry transition passes. Import completion is not claimed by this observation and
  remains part of the continuing session.

### XH-P02 — Finalization completes and restores History without restart

- **Observed task:** remain in the application after the apparently stationary finalization phase and observe
  navigation recovery.
- **Observed behavior:** finalization completes and History becomes active without restarting the application.
- **Boundary:** the runtime transition and navigation recovery pass. X6-C3 and X6-C4 now supply the missing-progress,
  continuing-operation, disabled-state explanation, and recovery behavior in automation; the repeated native profile
  must establish that they are perceptible and trustworthy to a person.

## Interim human disposition

The current build is rejected for X6 before completing the broader History, session, report, settings, keyboard,
VoiceOver, scaling, appearance, and reduced-motion coverage. The valid first-use journey repeatedly fails to make
successful actions, state changes, errors, continuing work, and temporary navigation restrictions perceptible and
understandable. These failures compound rather than remain isolated: the participant stated that an unknown
application would already have been closed. That is a direct failure of the accepted activation and trust objective,
not a cosmetic shortfall.

Continuing the session can add diagnostic breadth but cannot reverse this disposition for the reviewed source. A new
source must correct and independently verify the systemic interaction-feedback, spatial-continuity, error-recovery,
and information-measure contracts before X6 restarts.

## Evaluation state

The invalid instrumented session is closed. A valid session was started from clean source
`41ffad2eaec1862049c54c8a285277ac3f465abb` with bundle identifier
`org.fitfreed.desktop.x6-review.r41ffad2eaec1`. The complete local verification lane and full-bundle native-adapter
inspection pass. Repository-safety run
[`32827945310`](https://github.com/purnalica/fitfreed/actions/runs/32827945310) and the complete hosted campaign
[`32827945185`](https://github.com/purnalica/fitfreed/actions/runs/32827945185) pass for that exact source. The
hosted campaign covers the portable lane, native X6 package construction and scanning, performance boundaries,
the complete packaged journey, real-process restart, update replacement, deliberate rejection, and recovery.
Valid human findings nevertheless reject the source: successful automation proves the behavior it exercises but
does not override observed incomprehension, invisible transitions, missing identity, or misleading affordances.

X6 remains failed until every valid critical or major product finding receives regression evidence and applicable
exact hosted verification, and the human evaluation is completed successfully from the valid native review build.
