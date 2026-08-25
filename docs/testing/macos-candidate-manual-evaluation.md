# macOS Candidate Manual Evaluation

## Status and boundary

This is the shared privacy-safe manual acceptance procedure for an exact FitFreed 0.1.0 macOS candidate. It complements automated component, packaged E2E, accessibility, installation, update, recovery, and performance gates; it does not replace them.

Execution requires an authorized candidate, controlled participant, and one explicit distribution profile: the [private alpha candidate guide](../user/private-alpha-candidate.md) or the [public macOS guide](../user/public-macos-0.1.0.md). The evaluated bytes and installation trust behavior must match that profile. Until its gates close, the interaction procedure may be rehearsed only with independently generated synthetic packages and cannot be recorded as candidate acceptance.

### X6 product-experience profile

The interaction sections of this procedure are also the canonical human gate for the systemic MVP
redesign. That gate occurs before Apple authority or a sealed public candidate exists and has a deliberately
narrower claim:

- it may accept or reopen the X6 product experience only;
- it does not accept installation trust, update recovery, signing, notarization, a release candidate, or
  public distribution; and
- it does not remove or defer the later exact-candidate execution of this complete procedure.

The X6 profile starts only after repository safety and the complete hosted campaign pass for the exact
executable inputs handed to review. Build, inspect, and launch the revision-isolated native review application
from that clean source:

```sh
npm run review:x6
```

This profile derives a distinct bundle identifier from the exact source revision, which gives the review its own
application-data location without substituting the user home or enabling a database-path override. Its build has
no E2E feature, frontend test routing, WebDriver capability, dialog mock, or opener mock. The mandatory bundle
inspection scans the complete application for those markers before launch. Archive selection and external links
therefore use the production native adapters. **Never use `build:e2e`, its generated application, or an E2E
database override for human review.**

The revision-isolated library may receive the independently generated fixtures or an explicitly authorized
personal export. A personal export never changes the privacy-safe recording boundary below. After closing the
application, `npm run launch:x6-review` reopens the already inspected build and its same isolated library while the
source remains unchanged.

For X6, execute the first-run interaction from step 3 onward without the installation/removal claims, then
complete the Keyboard, VoiceOver, Scaling/appearance/contrast, and Realistic usability sessions. Skip the
Installation trust, application-removal/reinstallation, and Update/recovery claims; they remain exact-candidate
gates. Record the outcome explicitly as **X6 product experience**, never as candidate or release acceptance.
Any critical or major product-experience or accessibility finding reopens its owning redesign increment.

## Evaluation record

Record only:

- candidate version, source revision, manifest digest, and evaluated package architecture;
- whether the environment satisfies the candidate's platform boundary, whether it is hosted macOS or local Apple Silicon, plus the input and assistive technologies used;
- scenario identifier, pass, fail, blocked, or not-applicable result, and elapsed task time where requested;
- stable interface text or privacy-safe error code needed to identify a failure;
- accessibility impact, reproducibility, and the issue reference created after sanitization; and
- whether the participant completed each task without intervention and where guidance was needed.

Exact participant hardware and operating-system details may be retained only in a controlled local evaluation record when needed to reproduce a finding. Never copy them into versioned documentation or a public issue. Do not record or attach names, account claims, archive names or paths, dates, fitness or health values, routes, identifiers, library content, package fingerprints, private endpoints, screenshots of imported history, screen recordings, VoiceOver transcripts containing personal values, or raw logs. The participant owns the real export and may stop the session or decline any observation.

## Preconditions

1. Verify the complete candidate evidence, distribution profile, and controlled handoff before mounting the DMG. A public candidate must be the sealed Actions artifact awaiting promotion from the same workflow run.
2. Preserve the original provider ZIP independently.
3. Confirm that no production or personally important FitFreed library already occupies the candidate's application-data location.
4. Disable unrelated screen sharing, recording, cloud clipboard, and public diagnostic capture for the session.
5. Confirm the evaluator knows the privacy-safe reporting boundary and the recovery contact.
6. Record the default language, display scaling, appearance, keyboard settings, VoiceOver state, and network state before changing them for a scenario.

## Installation and first-run session

1. Complete the profile-matched DMG drag-copy installation without a development toolchain, terminal, global security change, or unverified replacement. A public candidate must open through the ordinary Developer ID and Gatekeeper path with no launch exception.
2. Launch the exact installed application and confirm version 0.1.0.
3. Verify that the initial locale follows a supported operating-system preference or falls back to English, then switch between English (United States) and Spanish (Spain).
4. Quit and reopen FitFreed. Confirm the explicit locale persists and the empty-library Home returns with
   both direct starts: choosing an existing ZIP and learning how to obtain one. Confirm that Sources becomes
   current only after either acquisition action is selected and that returning to Home preserves no false
   import result.
5. Import the authorized synthetic package, choose one Home question, quit, and reopen. Confirm that the populated library restores only that valid exploration destination. Return explicitly to Home, restart, and confirm that no explorer is resumed.
6. Remove only the application and confirm the separate library remains. Reinstall the same candidate and confirm it reopens that library through Home or its valid saved destination.

Any checksum, mount, copy, launch, version, locale-persistence, application-removal, or library-retention failure blocks the candidate.

## Keyboard session

Enable the macOS setting that permits keyboard focus on all controls. Starting from a fresh launch:

1. Traverse the five persistent workspace destinations and every Home question, source-coverage link,
   return-to-Home action, language, package-selection, import, update, filter, reset, comparison, session-section,
   route, range, report-authoring, privacy-review, export, close, table-scroll, and acknowledgement control in
   both forward and reverse order.
2. Confirm a visible focus indicator, logical focus order, localized accessible name, and expected enabled or disabled state at each stop.
3. Operate every included action using the keyboard. Native file selection must support selection and cancellation without trapping focus.
4. Enter valid and invalid values in every date field. Confirm errors are associated with the relevant control and that invalid input preserves the last valid result.
5. Open every offered Home question and confirm only its explorer enters the navigation order. Open and close
   every detail view, follow each longitudinal navigation target, return to its source workspace, scroll every
   wide exact table, and clear every disposable comparison result. In a routed session, operate map pan, zoom,
   complete-track reset, focus mode, recorded-position traversal, exact-point entry, every available session
   section, and personal-range boundaries without a pointer. Confirm that route and regular signal selection
   stay independent when the source provides no exact relationship.
6. Start and cancel an import before the visibility boundary. Confirm focus remains usable while progress changes and returns to a meaningful control after the terminal outcome.
7. Start a report from a session and operate every title, optional commentary, block, period, metric, add,
   remove, reorder, save, preview, privacy review, destination, cancel, export, source-return, and report-return
   control. Reopen the saved report into its result rather than its editor, enter composition deliberately,
   cancel back to the unchanged result, and exercise deletion and its cancellation. Confirm revealed review
   and result headings receive focus and each close, cancellation, or contextual return restores the correct
   initiating control.
8. Confirm no component creates a keyboard trap, requires pointer-only operation, loses focus into hidden content, or changes history from a navigation-only action.

## VoiceOver session

Run VoiceOver against English and Spanish at least once each:

1. Navigate by window, landmark, heading, form control, table, and link. Confirm the hierarchy identifies Home, its available period, questions and domain coverage, import, updates, each detailed explorer, longitudinal dashboard, comparisons, and details without relying on visual position.
2. Confirm controls expose their name, role, state, current value, invalid state, and busy state. Repeated detail actions must include the date or session context.
3. Start a valid import and confirm phase progress and the terminal result are announced without continuously repeating unchanged content.
4. Trigger invalid input and an invalid synthetic archive. Confirm the failure and recovery action are announced without exposing a source locator or personal value.
5. Inspect every summary, sport icon label, local route map, chart, range, and exact table. Decorative geometry
   must not duplicate noisy content; the structured or tabular alternative must preserve every value, unit,
   missing state, route-point identity, and origin separation. No announcement may imply route-to-signal
   synchronization when the source supplies no exact relationship.
6. Change locale and confirm new interface text, dates, durations, numbers, coverage reasons, and update messages are announced in the selected language.
7. Reopen the application and confirm that only the valid saved explorer, or Home after an explicit return, and any update-recovery notice enter the navigation order predictably.
8. Create and reopen a report. Confirm the ordered composer, authored content, source context, stale state, privacy review, export progress, cancellation, completion, and contextual navigation are announced once and that each report visual has an equivalent exact table.

Missing names, incorrect roles or states, unannounced errors, inaccessible exact values, focus loss, or personal-data leakage blocks the candidate.

## Scaling, appearance, and contrast session

1. Test the minimum supported window and the evaluator's normal full-screen size at default text and 200% root text size.
2. Complete Home, both first-run acquisition paths, import, every question entry and return, every explorer,
   filter, session section, route workbench, personal range, comparison, longitudinal navigation, Reports
   Library, deliberate composition, result Preview, privacy and stale-evidence review, local export, the
   Settings update panel, and every terminal outcome at 200%.
3. Confirm there is no page-level horizontal overflow, clipped control, overlapping text, hidden error, or unreachable action. Labeled exact-table containers may scroll horizontally.
4. Repeat the primary journey in light and dark operating-system appearance and with increased contrast where available.
5. Confirm text, focus, controls, states, charts, and table values remain perceivable. Supported, ignored, unavailable, missing, invalid, comparison direction, and selected state must never depend on color alone.
6. Enable reduced motion and confirm optional width transitions are removed without changing information or interaction.

Record a contrast failure only after identifying the exact foreground, background, state, appearance, and control. Do not capture personal screen content.

## Realistic usability session

The participant performs the complete journey without coaching; the evaluator may ask the participant to describe expectations but does not explain controls before first use.

1. Install and launch FitFreed, choose a language, and identify what data stays local.
2. From empty-library Home, identify both direct starts and choose the bundled source guide. Explain how to
   obtain a provider export, what leaves FitFreed for the default browser, and why provider credentials never
   enter the application. Return to Home, use the direct ZIP action, select an authorized compatible archive,
   understand the progress phases, and explain whether cancellation is currently safe.
3. From the post-import Home reveal, interpret the usable period, available domains, one safe next question, and the terminal canonical effect without first reviewing source diagnostics. Then find all five source-coverage totals, at least one family reason, and its next action.
4. Use the Home questions to find an exact daily activity value, training session, sleep period, and recovery
   night; distinguish missing, unavailable, and zero. In Training, classify an unknown sport, combine meaningful
   history filters, use chronology and calendar, compare multiple sessions, and open one routed and one partial
   session as focused stories. Investigate the dominant local map through pan, zoom, fit, focus mode,
   recorded-position traversal, range selection, and exact route points; inspect independent signals, recorded
   structure, zones, and provenance without inferring unsupported alignment. Create, reopen, rename, adjust,
   review, and remove a personal range on an explicit timeline. Where source phases are absent, create, edit,
   reorder, reuse, and remove user-authored segment criteria without mistaking either authored construct for
   provider facts.
5. Apply and reset a range in each explorer, open and close detail, and complete a two-period comparison.
6. Use the longitudinal view to inspect one aligned day, navigate to an authoritative explorer, return to the shared range, and explain the non-causality notice.
7. Reimport the same ZIP and explain why history did not duplicate. Import a later authorized export when available and explain the cumulative outcome.
8. From a training session, create a report with an authored title and optional commentary; add, remove, and
   reorder analytical and route views; choose valid periods and metrics; and explain the Preview result's
   source separation, exact alternatives, missing evidence, and limitations. Save it, return to the Reports
   Library, recognize its subject and primary result without opening an editor, then reopen it directly into
   Preview. Enter composition deliberately, cancel once without changing the result, edit and save once, review
   included and excluded sensitive content, export a local self-contained HTML file, cancel a second export
   without replacing the first, and navigate to the exact source and back. After a source-changing reimport,
   explain why export is blocked, review the candidate evidence, refresh explicitly, and confirm authorship
   remains unchanged. Delete a disposable synthetic report only after verifying that cancellation preserves it
   and that successful removal changes no imported history.
9. Leave one explorer active, quit and reopen FitFreed, and confirm that exact explorer and the locale return without loading unrelated explorers. Return to Home, restart, confirm the exploration is no longer resumed, and find the application version and explicit update check in Settings.
10. Explain the difference between removing the application and deleting the library, where the library lives, why the original ZIP must be preserved, and what backup capability is absent.
11. Encounter one controlled invalid package or recoverable failure and identify the safe next action without editing the library or exposing diagnostics.

Record task completion, intervention, misunderstanding, abandonment, and privacy or trust concerns. Do not reinterpret participant confusion as success because the underlying command completed.

## Update and recovery session

Run only after the profile's real channel and protected signing authority exist for distinct authorized versions:

1. Verify offline startup remains usable and a manual offline check is non-disruptive.
2. Confirm a newer compatible candidate shows installed and available versions plus localized notes; exercise postponement and explicit rediscovery.
3. Accept installation and confirm imports, locale changes, and competing update actions are disabled while replacement owns the operation.
4. Confirm successful replacement reopens the exact library and presents an acknowledgement-retained result.
5. Execute the controlled rejected-candidate scenario and confirm bounded automatic restoration reopens the previous application and same valid library with recovery guidance.
6. Confirm acknowledgement removes only the terminal notice and that application removal leaves the library intact.

No real participant library may be used for deliberate update failure until the exact candidate and recovery pair have already passed synthetic release-shaped evidence and an independent protected backup exists under the controlled evaluation plan.

## Acceptance rule

The candidate is not accepted while any scenario is blocked, any installation/update matrix case fails, any automated gate is red, any critical or serious accessibility defect remains, any participant cannot recover safely from the prescribed failure, or any evidence collection crosses the privacy boundary.

Minor findings still require an issue, owner, severity rationale, and explicit disposition before the candidate decision. Passing one participant session does not establish universal usability or provider compatibility; it supplies bounded evidence for the named candidate, distribution profile, and participant audience.
