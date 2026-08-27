# X6 Product-Experience Human Evaluation

## Status and boundary

**Rejected again on 2026-08-26 for review source `de0ba3dd149a95ee96e8a48ea7aaf1cb74453d6d`. The valid native session may
continue for diagnostic coverage, but the current experience cannot pass X6.**

**A new X7 repeated profile started on 2026-08-27. Native archive selection and both official browser destinations
pass, but an authorized Polar Flow export that the participant previously imported successfully is now rejected as
recognized but incomplete or malformed. The populated-library evaluation cannot continue through that archive, and
X7 remains unaccepted.**

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

Corrective source `31751b2ef9291fc23d7aa50e14a2ecfe46280c21` now passes exact
[repository safety](https://github.com/purnalica/fitfreed/actions/runs/32904901418) and the complete
[hosted campaign](https://github.com/purnalica/fitfreed/actions/runs/32904901151), including the native review package,
cold launch, import, dense History, Insights, functional, restart, adaptive-session, installation, and update-recovery
boundaries. The current [readiness ledger](../testing/public-release-readiness.md) owns the exact marker. This evidence
makes the corrected native package eligible to restart the profile; it does not replace, reinterpret, or pass the
rejected human session.

The later X7 corrective sequence is machine-complete. Exact source `a130343607016e40bb833f5b63246cb6adccd5e5`
passes [repository safety](https://github.com/purnalica/fitfreed/actions/runs/33057603547), the complete [hosted
campaign](https://github.com/purnalica/fitfreed/actions/runs/33057603540), its immutable evidence marker, and the
revision-isolated production-native full-bundle scan for executable-input fingerprint
`dc0b344b9f363b5ba810f766820ba0d5270a2c238cb0444242ad96c5f04e96d2`. This evidence makes the X7-corrected product
eligible for a new complete profile after the final clean handoff revision is rebuilt and scanned. It does not alter
the rejected X6 observations or constitute human acceptance.

This evaluation can accept or reopen the X6 product experience only. It cannot accept signing,
notarization, installation trust, update recovery, a release candidate, or public distribution.

### Repeated-session collection protocol

During the active participant review, observations are recorded in the order reported without concurrent diagnosis,
implementation, testing, prioritization, or solution design. This preserves the participant's review flow and avoids
changing the evaluated product between observations. Consolidation, root-cause analysis, planning, correction, and
verification begin only after the participant explicitly ends the review session.

The participant ended the earlier observation collection on 2026-08-26. The X7 repeated collection started on
2026-08-27 and ended when XH-24 blocked the first import. The product owner then established that future participation
is limited to bounded experience judgment; deterministic functional correctness belongs to automated E2E and lower
test levels. The canonical [manual-evaluation procedure](../testing/macos-candidate-manual-evaluation.md#product-owner-experience-review)
owns that responsibility boundary. Diagnosis, correction, and regression work may proceed without asking the product
owner to execute the functional checklist or characterize the rejected archive further.

## Findings

### XH-01 — Acquisition actions do not complete in the default browser

- **Status:** passed in the X7 repeated profile on 2026-08-27; the rejection of the earlier reviewed sources remains
  part of their evaluation history.
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
- **Corrected-build re-evaluation:** review source `de0ba3dd149a95ee96e8a48ea7aaf1cb74453d6d` displays an
  in-application outcome after each Polar action, but neither destination appears in the default browser. This
  contradicts the user outcome while preserving evidence that the presentation now exposes the attempted action.
  Diagnose the native launch chain to its operating-system boundary before changing behavior or tests.
- **X7 repeated-profile observation:** both official actions open the default browser at the expected destination.
  The participant considers their behavior and destinations correct.

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

- **Status:** reopened in the X7 repeated profile; the exact resource limit is now named, but it still does not make
  an ordinary unrelated-archive selection understandable.
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
- **Corrected-build re-evaluation:** review source `de0ba3dd149a95ee96e8a48ea7aaf1cb74453d6d` reports that
  FitFreed stopped because the ZIP exceeds a “processing safety limit.” The participant cannot determine which limit
  was reached, what that says about the selected archive, or what practical recovery is available. Separating the
  internal category and making it primary did not make the result understandable; the user-facing reason must be
  traced from the exact validation outcome rather than collapsed into a generic resource-limit label.
- **X7 repeated-profile observation:** an archive unrelated to a Polar Flow export is rejected because at least one
  member would exceed the 64 MB expanded-file limit. The participant finds that explanation surprising in the
  context of an ordinary wrong-package selection. The observation does not establish whether the limit result is
  technically incorrect; it establishes that the result does not help the person understand package identity or the
  likely recovery action.

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

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending.
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
- **Correction evidence:** X6-C5 classifies live measures by content role, gives reading prose one shared bounded
  measure, and lets task, status, result, help, and exact-evidence copy use its allocated composition. Static contracts
  prevent the removed arbitrary constraints from returning. Packaged WebKit exercises wide and compact allocation,
  both locales and appearances, and every supported zoom through 200% without page-level horizontal overflow. Human
  reading rhythm and scanning confirmation remain pending.

### XH-06 — Finalization provides no perceptible evidence of continuing work

- **Status:** reopened by the repeated production-native profile. Runtime completion was observed in both reviewed
  sources, so the finding is not evidence of a deadlock.
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
- **Corrected-build re-evaluation:** during reconciliation, the participant selected Reports. Perceptible progress
  stopped, the requested change took a long time to appear, and the application seemed inoperative until it eventually
  changed. The observation is recorded without diagnosis while the participant review remains active.

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

- **Status:** open; critical functional and product-experience defect now requires provider-catalogue authority.
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
- **Root-cause and correction state:** Polar training records preserve opaque numeric sport references, while the
  evaluated takeout's separate sport-profile artifact supplies names without an authoritative join to those references.
  FitFreed now has a provider-neutral, versioned
  [catalogue-evidence boundary](../data-formats/providers/provider-sport-catalogue-v1.md) and complete synthetic
  regression coverage through import enrichment, precedence, persistence, Home, History, session, reports, export,
  restart, and reimport.
  Polar's official complete catalogue requires authenticated `sports:read` access, and no GPL-compatible redistribution
  grant has been established. No real catalogue is therefore bundled and sport identity is not inferred from route or
  measurement patterns. The finding remains open until authorized catalogue evidence or an explicitly reviewed
  local-only acquisition path supplies trustworthy names to the implemented boundary.
- **Repeated-build observation:** after an authorized real export was imported in the production-native review on
  2026-08-26, every imported sport type remained unknown. No personal sport, count, source value, or archive detail is
  retained in this record. The observation is preserved for the post-session evaluation without concurrent diagnosis
  or correction.
- **Additional repeated-build observation:** at least one imported session is labelled `Unrecorded sport` in the
  participant's locale. The participant cannot understand how that state differs from an unknown sport or whether it
  means absent source evidence, unsupported interpretation, or a product failure. No session detail is retained.
- **Product-owner direction:** do not exclude a maintained identifier-correlation catalogue as a structural solution.
  The post-session evaluation must assess independently established mappings from user-owned exports alongside an
  authenticated local-only catalogue path. For every correlation it must distinguish interpretation of a person's
  exported evidence from redistribution of provider-owned catalogue material, and establish provenance, confidence,
  licence basis, update policy, ambiguity handling, and correction governance before product use.

### XH-09 — Home aggregates look actionable but do not lead to exploration

- **Status:** reopened by the repeated production-native profile on 2026-08-26.
- **Observed task:** use the prominent Home summaries for imported training sessions and recorded sport types to begin
  exploring the library.
- **Observed behavior:** the aggregate badges invite a click through their prominence and compact control-like shape,
  but clicking them has no effect.
- **Expected behavior:** a prominent summary either acts as a clear route to the corresponding filtered evidence or is
  styled and worded unambiguously as non-interactive context. Home prioritizes the next useful question rather than
  presenting dead-end quantities.
- **Participant impact:** the first obvious exploration attempt fails silently and reinforces the impression that Home
  reports data without providing access to it.
- **Repeated-build observation:** each sport summary on Home must open the sessions represented by that exact sport.
  The current surface offers classification but does not make the sport itself an exploration route. No displayed
  sport, session count, or personal value from the participant's screenshot is retained.
- **Additional repeated-build observation:** the same missing route affects History's Sports workspace. Each sport
  card summarizes a session collection and supports classification, but it does not open the represented sessions.
  Home and History therefore fail the same sport-to-session exploration expectation. No displayed date, duration,
  count, or other personal value is retained.
- **Product-owner direction:** treat this as a transversal navigation requirement, not a sport-card exception. Every
  summary that states a bounded count or represented collection must offer the natural route to those records or exact
  supporting evidence; non-interactive information must not imply an unavailable drill-down.
- **Disposition:** positive session and sport totals are now explicit controls. The session total clears disposable
  training refinements before opening the complete newest-first session history; the sport total opens the complete
  sport-management view. Both use the existing durable training destination, preserve their exact Home origin, and
  restore focus on return. Zero totals remain non-interactive facts. Component, application integration, and complete
  packaged tests cover pointer and keyboard semantics, exact destinations, unfiltered-session state, and return focus.
  Activation value remains pending in the repeated production-native profile.

### XH-10 — The displayed history start boundary appears factually implausible

- **Status:** correction implemented and fully automated; production-native participant validation pending.
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
- **Correction evidence:** [Library Home version 4](../data-formats/insights/library-home-v4.md) separates retained
  `recordedRange`, measurement-backed `usableRange`, and visibly scoped `primaryRange`. An activity day contributes
  to usable history only when its step measurement is present, including a recorded zero; missing measurements remain
  source evidence without defining the leading range. Training sessions use their complete training range when training
  is the primary Home evidence. A recorded-but-unusable library opens source review instead of first run. Application,
  SQLite, transport, presentation,
  localization, and packaged regressions cover unavailable-only boundaries and the visible range scope. The participant
  still has to confirm that the corrected boundary and its meaning are credible without adding personal dates or values
  to this record.

### XH-11 — Sport-classification controls are visibly misaligned

- **Status:** correction implemented and fully automated; production-native human re-evaluation pending.
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
- **Correction evidence:** X6-C5 aligns semantic label, control, help, validation, and action regions on shared rows,
  gives the native selector and text input equal scaled height, and stacks the form from 150% through 200% zoom.
  Component and integration tests retain validation, keyboard activation, conflict, save, reset, cancel, multi-item,
  persistence, reimport, and reload behavior. Packaged WebKit checks 40 locale, appearance, zoom, and allocation
  combinations; self-review found and corrected a compact persistent-navigation overlap before closure. Human form
  comprehension and Full Keyboard Access confirmation remain pending.

### XH-12 — Settings actions obscure their relationship and outcome

- **Status:** remains a minor usability concern in the X7 repeated profile.
- **Observed task:** change appearance or language preferences and decide whether to keep, revert, or reset them.
- **Observed behavior:** the three actions occupy a visually unbalanced wrapped region, with `Restore defaults`
  separated from `Discard preview` and `Save changes` and the primary action on a second row. The participant could
  not determine what `Discard preview` would discard.
- **Verified behavior:** `Discard preview` restores the entire unsaved preference draft to the currently persisted
  language, appearance, and content-zoom values and immediately reapplies those persisted values to the interface. It
  does not discard only the example card, and it does not write to persistence. `Restore defaults` is a separate
  persisted reset operation.
- **Expected behavior:** the action composition and labels make the scope, persistence effect, and relationship of
  keep, revert, and reset choices understandable before activation at every supported locale, zoom, and viewport.
- **Participant impact:** uncertainty over whether an action affects the example, the whole interface, or persisted
  settings makes an ordinary preference change feel risky and makes the primary save path harder to scan.
- **Disposition:** evaluate the complete action hierarchy and responsive composition as one settings workflow. Retain
  the existing application and persistence contracts, and require comprehension, pointer, keyboard, unsaved-change,
  save, revert, defaults, restart, both-locale, and supported-zoom evidence before closure.
- **X7 repeated-profile observation:** the three transaction actions remain permanently visible, including when they
  are disabled. Their behavior does not block the task, but the participant considers the persistent disabled action
  cluster a poor use of attention and space.

### XH-13 — Empty-library privacy copy describes data that does not yet exist

- **Status:** open; observed in the repeated production-native profile on 2026-08-26.
- **Observed task:** understand the product and its privacy boundary before the first import.
- **Observed behavior:** the empty Home states, “No account. No upload. The archive and library stay on this device.”
  In Spanish it likewise says that the archive and library remain on the device, although neither exists yet.
- **Expected behavior:** first-run privacy copy distinguishes current facts from the future processing guarantee and
  states plainly what will happen if the person chooses an archive.
- **Participant impact:** the person has to infer which data the product is referring to at the moment when purpose,
  trust, and the local boundary should be easiest to understand.
- **Disposition:** correct the shared message contract in both locales and test it in the empty state, populated state,
  acquisition journey, supported zoom range, and localized product guidance. Preserve the factual account-free,
  no-upload, local-processing guarantee without implying that an archive has already been selected or imported.

### XH-14 — One progress ratio uses visibly inconsistent grouping

- **Status:** open; observed in the repeated production-native profile on 2026-08-26.
- **Observed task:** monitor reconciliation during a real import.
- **Observed behavior:** the Spanish progress sentence renders its four-digit completed count without grouping and its
  five-digit total with grouping, so two values representing the same unit use visibly different formatting.
- **Root cause:** both placeholders use the same `Intl.NumberFormat("es-ES")`. WebKit applies the locale's minimum
  grouping behavior, leaving this four-digit value ungrouped while grouping the five-digit value. The implementation
  is internally consistent but the resulting comparative display is not.
- **Expected behavior:** completed and total counts in one progress ratio use the same explicit grouping policy and
  remain immediately comparable in every supported locale.
- **Participant impact:** a long-running operation already demands attention; inconsistent number shapes add needless
  parsing effort and make the progress feedback look unfinished.
- **Disposition:** define one progress-counter formatting contract instead of relying on the locale's implicit minimum
  grouping threshold. Verify boundary values around three, four, and five digits in both locales, packaged WebKit,
  progress announcements, and exact terminal outcomes.

### XH-15 — Accumulated values expose meaningless precision

- **Status:** open; observed in the repeated production-native profile on 2026-08-26.
- **Observed task:** scan accumulated duration and similar summary values.
- **Observed behavior:** an accumulated duration spanning hours is presented through milliseconds. The participant
  considers seconds potentially acceptable in context, but milliseconds plainly meaningless at that scale.
- **Expected behavior:** summary precision follows the magnitude, measurement semantics, and decision the value
  supports. Exact source evidence may remain available on deliberate request without dominating the summary.
- **Participant impact:** excessive precision creates visual noise, implies false significance, and makes important
  accumulated results harder to compare quickly.
- **Disposition:** retain the observation for the post-session evaluation across all accumulated durations and
  measurements. Do not retain the participant's displayed value in this record.

### XH-16 — Recorded tracks lack cartographic context

- **Status:** open; observed in the repeated production-native profile on 2026-08-26.
- **Observed task:** understand where an outdoor session took place by inspecting its recorded track.
- **Observed behavior:** FitFreed presents the recorded route geometry without an actual geographic basemap. The
  participant cannot relate the shape to paths, water, streets, terrain, or recognizable places.
- **Expected behavior:** outdoor tracking provides meaningful spatial context while preserving explicit privacy,
  provenance, attribution, licensing, offline, and exact-evidence boundaries.
- **Participant impact:** the route loses much of its investigative value, undermining a primary reason for an outdoor
  athlete to use the product.
- **Additional repeated-build observation:** the route workbench permits zooming out to a scale spanning thousands of
  kilometres, which has no useful relationship to one recorded session. Map zoom must remain within reasonable bounds
  for the route's extent and the investigation task while retaining a predictable full-route reset.
- **Product-owner direction:** after the review, evaluate OSS renderers and openly licensed cartographic data or
  services as structural options. Do not treat an open-source rendering library as proof that its map tiles, hosting,
  caching, attribution, or location-disclosure model are unrestricted.
- **Disposition:** retain the observation without selecting or integrating a map source during the active review.

### XH-17 — Comparison starts without a meaningful contrast

- **Status:** open; observed in the repeated production-native profile on 2026-08-26.
- **Observed task:** begin a period comparison from the available comparison option.
- **Observed behavior:** both comparison sides can begin with the same date range, producing no useful contrast.
- **Visual confirmation:** the participant supplied a screenshot showing identical initial reference and comparison
  ranges. The image and its displayed dates are not retained.
- **Expected behavior:** the product proposes distinct contextual pairs such as current and preceding week, month, or
  year, while keeping manual selection of both ranges available at all times.
- **Participant impact:** the person must repair a meaningless initial state before learning anything, and the product
  fails to demonstrate what comparison is for.
- **Disposition:** retain the observation and product direction for joint post-session evaluation without changing
  comparison behavior during the active review.

### XH-18 — Rich provider workout structure is not visibly accounted for

- **Status:** open; raised in the repeated production-native profile on 2026-08-26.
- **Observed task:** inspect the ranges and blocks expected from structured Polar workouts.
- **Observed behavior:** the participant cannot establish whether the expected structure was absent from the export,
  imported but undiscoverable, or deliberately unsupported.
- **Current declared boundary:** FitFreed imports supported nested exercises, source/manual laps, automatic laps, and
  pauses when they occur in a mapped training-session artifact. Polar planning artifacts and training targets are
  recognized but unsupported, and the current mapping does not claim their phases or blocks.
- **Expected behavior:** the product and import coverage make every supported, unavailable, and deliberately unmapped
  structure explicit, while session exploration exposes all successfully imported structure naturally.
- **Disposition:** retain the question for post-session evaluation without inspecting or recording the participant's
  source files, workout structure, or personal values during the active review.
- **Product-owner direction:** importing objectives, phases, blocks, and related provider-authored training structure
  is a fundamental high-priority requirement. The post-session plan must treat it as end-to-end source, canonical,
  reconciliation, exploration, and documentation work rather than a display-only refinement.

### XH-19 — Segment tables hinder comparison and repeat set-level attribution

- **Status:** open; observed in the repeated production-native profile on 2026-08-26.
- **Observed task:** scan and compare the calculated segments of one exercise.
- **Observed behavior:** elapsed boundaries and durations are not aligned for rapid numeric comparison. A complete
  attribution column repeats the same FitFreed authorship on every row even though it describes the shared segment
  definition rather than a row-specific difference.
- **Expected behavior:** numeric and temporal columns use alignment appropriate to their value structure. Attribution
  shared by the full result appears once in the definition or explanation; a column is retained only when authorship
  can differ meaningfully by row.
- **Participant impact:** the table spends substantial width on repeated text while making the values that actually
  differ harder to scan.
- **Disposition:** retain the observation for the joint post-session table and information-density evaluation. The
  participant's screenshot and displayed values are not retained.
- **Additional visual confirmation:** another segment-table state shows the same severe alignment failure. The
  participant identifies exacting data presentation as core product behavior because the application's purpose is to
  make data understandable; technical presence of the values cannot compensate for poor visual comparison. The image
  and its values are not retained.

### XH-20 — Detail evidence overwhelms the primary experience

- **Status:** open and transversal; observed in the repeated production-native profile on 2026-08-26.
- **Observed scope:** the participant identifies an excessive amount of directly visible detail in the segment result
  as one example of a broader application-wide problem.
- **Observed behavior:** complete rows, exact boundaries, duration precision, and repeated metadata dominate the
  ordinary surface even when they are useful only for deliberate inspection.
- **Expected behavior:** each screen first supports comprehension, visual interpretation, and the next useful action.
  Exhaustive tables and exact evidence remain available through explicit progressive disclosure.
- **Participant impact:** more data becomes more noise rather than more information, making the product harder to scan
  and obscuring the value of the underlying history.
- **Product-owner direction:** exceptional UX requires a global information-density and progressive-disclosure review
  across the complete application, not isolated removal of one table or field.
- **Disposition:** retain the observation for systemic post-session evaluation. The participant's screenshot and
  displayed values are not retained.

### XH-21 — Appearance lacks personal expression

- **Status:** confirmed product direction during the repeated production-native profile on 2026-08-26.
- **Positive observation:** the participant considers the current visual character sober and elegant.
- **Requested evolution:** provide several curated preset themes whose change is clearly perceptible while retaining
  that visual quality. A complex arbitrary-theme editor is not required.
- **Future boundary:** broader personalization capabilities may follow later; preset themes are the deliberately
  bounded first level rather than the final customization ceiling.
- **Boundary:** themes remain separate from system, light, and dark appearance and must preserve readability,
  accessibility, localization, hierarchy, and cross-platform coherence.
- **Disposition:** retain the confirmed direction for post-session planning without changing appearance during the
  active review.

### XH-22 — Ad hoc charts do not provide a viable analytical foundation

- **Status:** open and transversal; observed in the repeated production-native profile on 2026-08-26.
- **Observed scope:** charts throughout the application, with exercise signals as one important example.
- **Observed behavior:** charts appear visually unfinished and omit interpretive foundations such as useful axes and
  complete analytical interaction. The participant considers the first approximation understandable as a development
  step but not a viable production direction.
- **Expected behavior:** mature charts make scale, units, gaps, series identity, selection, exact values, and accessible
  alternatives clear. Several exercise signals can be compared or overlaid when an exact shared coordinate supports
  that relationship, for example to inspect co-variation without claiming causation.
- **Product-owner direction:** evaluate a maintained specialized OSS charting library rather than continuing to build
  a general chart engine inside FitFreed. Keep product-specific evidence composition and interaction under FitFreed's
  control, and retain the existing prohibition against invented signal alignment.
- **Disposition:** library selection and migration planning begin only after the active participant review ends. The
  evaluation must cover licence, accessibility, offline behavior, WebView compatibility, performance, localization,
  deterministic output, maintenance, and replaceability.

### XH-23 — Reports provide no reusable examples or duplication path

- **Status:** confirmed missing capability at the end of the repeated production-native review on 2026-08-26.
- **Observed task:** understand report capabilities and use an existing result as the basis for a personal report.
- **Observed behavior:** Reports provides no curated pre-existing examples, and the current product has no operation to
  duplicate a saved report.
- **Expected behavior:** relevant built-in examples demonstrate useful capabilities against supported local evidence
  and can create a new independently owned report. A saved report can likewise be duplicated without changing its
  source definition.
- **Boundary:** unmet example prerequisites remain explicit; built-in examples never fabricate personal results.
  Community template exchange remains outside the first MVP.
- **Disposition:** retain the confirmed requirement for post-session domain, application, persistence, presentation,
  export, documentation, and lifecycle planning before either control is exposed.

### XH-24 — A previously accepted provider export is rejected before import

- **Status:** machine-corrected on 2026-08-27; the reviewed candidate remains rejected and requires a later bounded
  experience-only review of new exact bytes.
- **Observed task:** import an authorized Polar Flow export after completing the empty-library acquisition checks.
- **Observed behavior:** FitFreed recognizes the provider export but rejects it because a required file is incomplete
  or malformed. The participant reports that the same archive imported successfully during the preceding human
  evaluation.
- **Expected behavior:** an unchanged export inside the supported compatibility boundary remains importable across a
  corrective presentation release. If newly enforced evidence establishes a real incompatibility, the result must
  identify the affected documented contract and a practical privacy-safe recovery path without exposing personal
  content.
- **Participant impact:** the primary value journey stops before any history becomes available, so recognizable
  sports, natural navigation, session exploration, reports, and the remaining populated-library evaluation cannot be
  assessed.
- **Evidence boundary:** this record retains no archive name, path, fingerprint, member name, source value, date,
  count, or personal history. Prior successful import is participant-reported evidence and does not by itself identify
  the regressing component.
- **Root cause:** planned-training support introduced after the earlier successful import promoted every provider
  phase name into a required non-empty canonical string. The authorized export contains legitimate empty phase names,
  so the newly supported artifact decoder rejected the package before atomic publication.
- **Correction evidence:** canonical, persistence, query, report, and portable contracts now retain an absent phase
  name as null; presentation derives only a localized ordinal label. Adapter `polar-flow-archive@14`, operation
  mapping set `polar-flow-mapping-set@9`, and planned-training mapping `polar-planned-training@2` force exact ZIPs to
  be reassessed. Synthetic unit, integration, migration, export, localization, and contract tests pass. The
  privacy-minimized real-reference predicate completed with full coverage, one opaque origin, every required history
  domain available, and exact reimport, without recording private archive metadata or content.
- **Disposition:** functional correction is complete locally. The collection remains closed; a new candidate may
  reach the product owner only after the remaining automated gates pass.

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

### XH-P03 — Official provider destinations open in the default browser

- **Observed task:** use both official acquisition destinations from the empty-library journey.
- **Observed behavior:** each action opens the default browser at the expected official destination.
- **Boundary:** native external opening and destination selection pass for the current X7 review source. This does not
  accept the complete acquisition or import journey.

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
The repeated profile on 2026-08-26 uses review source `de0ba3dd149a95ee96e8a48ea7aaf1cb74453d6d`, whose
executable inputs are the corrected source `31751b2ef9291fc23d7aa50e14a2ecfe46280c21`. XH-01 reproduced at the
real default-browser boundary: FitFreed displayed local action outcomes, but neither Polar destination appeared.

X7 now owns the corrected-product continuation. The repeated profile ran on 2026-08-27 from exact source
`bd79b95c41a075a8e9383875c7dd898a4f5517d7` with revision-isolated bundle identifier
`org.fitfreed.desktop.x6-review.rbd79b95c41a0`. [Repository safety
`33064152469`](https://github.com/purnalica/fitfreed/actions/runs/33064152469), the complete [hosted campaign
`33064152396`](https://github.com/purnalica/fitfreed/actions/runs/33064152396), its immutable evidence marker, and the
production-native full-bundle scan pass for that exact source. Human evidence passes the visible native selector and
official browser experience, retains a minor Settings-action concern, and blocks at XH-24 before populated-library
review. Functional diagnosis and regression now return to automation. This record remains rejected until a later
bounded product-owner experience result explicitly replaces that disposition.
