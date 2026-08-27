# X7 Product-Experience Reaudit

## Status

In progress on 2026-08-27. This audit challenges the corrected X7 product before the revision-isolated
production-native handoff. It does not inherit the accepted X6 machine verdict: the later production-native human
evaluation rejected that experience and is the regression baseline for this independent repeat.

The current machine audit uses the packaged macOS E2E application built from clean executable source `6170f75`.
Later documentation-only commits retain executable-input fingerprint
`a67fad4667ab253dfded6c3906fa5f4adc8994be57b0dc84ee5f6eedd00870cc`. All archives, databases, screenshots, and
exports are synthetic, local, and ignored. No personal history or machine-local locator is versioned.

No verdict has been reached. A material finding remains open, so X7-R7 and its production-native review package
remain blocked by the product gate rather than by an external dependency.

## Method and evidence boundary

The audit starts by replaying the three independent X6 packaged journeys against the corrected executable before
adding X7-specific paths. Existing component, integration, and maintained E2E tests are evidence only after their
covered behavior has been traced to a real production surface. The independent pass observes the packaged product,
captures visible state and geometry, runs Axe against the main surface, and treats every prior human finding as a
regression prompt without limiting discovery to that list.

Automation cannot establish that the default browser became visible, that VoiceOver communication is useful, or that
the product is compelling with recognizable personal history. Those claims remain reserved for the final
revision-isolated production-native human gate.

## Findings

| ID | Severity | State | Observable finding | Root cause | Required correction and evidence |
|---|---|---|---|---|---|
| X7A-01 | Major accessibility and interaction defect | Corrected; exact clean-revision repeat pending | Cancelling the native archive chooser from the already-open Sources workspace did not restore focus to `Choose ZIP package`. The independent packaged journey timed out after the chooser returned without a selection. | `SourcesPanel.chooseArchive` called `focus()` while `archiveChoosing` still disabled the referenced button, then re-enabled it in `finally`. The immediate component test retained focus from its synthetic click and therefore missed the real WebView sequence. The Home shortcut followed a different remount path, so the maintained E2E journey did not exercise this Sources-local cancellation. | The component now records pending restoration and focuses only after React commits the enabled state. Its test holds the chooser pending, proves the disabled state, displaces focus, resolves cancellation, and requires enabled focus. The previously failing independent packaged first-use journey now passes. The maintained packaged journey contains the Sources-local regression and passed its complete 2-minute-35-second acquisition-through-restart-preparation run. |

## Audit trail

1. The clean first-use X6 regression journey reached acquisition guidance in the current packaged application.
2. Its first Sources-local chooser cancellation invoked the instrumented native boundary with the exact ZIP-only
   options, then failed solely at focus restoration.
3. Investigation traced the behavior through the current helper, the introducing commit and test history, the live
   component, and the distinct Home cancellation test before accepting X7A-01. No assertion was removed or weakened.
4. After the candidate correction, the clean-first-use regression passed all 27 captured states. The import-outcome
   regression retained the visible exact rejection reason while adapting its obsolete disclosure selector, then
   passed cancellation, rejection, repeat, extension, and preservation. The adaptive regression passed route
   relationships, partial evidence, stale-report review, and explicit refresh.
5. The complete maintained packaged journey then passed in 2 minutes and 35 seconds. It exercised the new
   Sources-local cancellation before continuing through import, global progress, sports, comparisons, route and
   signal workbenches, personal ranges, report examples, independent duplication, localization at 200%, reimport,
   refresh, structured training intent, export, and restart preparation.
