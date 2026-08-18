# macOS Candidate Manual Evaluation

## Status and boundary

This is the shared privacy-safe manual acceptance procedure for an exact FitFreed 0.1.0 macOS candidate. It complements automated component, packaged E2E, accessibility, installation, update, recovery, and performance gates; it does not replace them.

Execution requires an authorized candidate, controlled participant, and one explicit distribution profile: the [private alpha candidate guide](../user/private-alpha-candidate.md) or the [public macOS guide](../user/public-macos-0.1.0.md). The evaluated bytes and installation trust behavior must match that profile. Until its gates close, the interaction procedure may be rehearsed only with independently generated synthetic packages and cannot be recorded as candidate acceptance.

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
4. Quit and reopen FitFreed. Confirm the explicit locale persists and the empty library returns to the understandable Sources start.
5. Import the authorized synthetic package, choose one Home question, quit, and reopen. Confirm that the populated library restores only that valid exploration destination. Return explicitly to Home, restart, and confirm that no explorer is resumed.
6. Remove only the application and confirm the separate library remains. Reinstall the same candidate and confirm it reopens that library through Home or its valid saved destination.

Any checksum, mount, copy, launch, version, locale-persistence, application-removal, or library-retention failure blocks the candidate.

## Keyboard session

Enable the macOS setting that permits keyboard focus on all controls. Starting from a fresh launch:

1. Traverse every header, Home question, source-coverage link, return-to-Home action, language, package-selection, import, update, filter, reset, comparison, detail, close, table-scroll, and acknowledgement control in both forward and reverse order.
2. Confirm a visible focus indicator, logical focus order, localized accessible name, and expected enabled or disabled state at each stop.
3. Operate every included action using the keyboard. Native file selection must support selection and cancellation without trapping focus.
4. Enter valid and invalid values in every date field. Confirm errors are associated with the relevant control and that invalid input preserves the last valid result.
5. Open every offered Home question and confirm only its explorer enters the navigation order. Open and close every detail view, follow each longitudinal navigation target, return to its source workspace, scroll every wide exact table, and clear every disposable comparison result.
6. Start and cancel an import before the visibility boundary. Confirm focus remains usable while progress changes and returns to a meaningful control after the terminal outcome.
7. Confirm no component creates a keyboard trap, requires pointer-only operation, loses focus into hidden content, or changes history from a navigation-only action.

## VoiceOver session

Run VoiceOver against English and Spanish at least once each:

1. Navigate by window, landmark, heading, form control, table, and link. Confirm the hierarchy identifies Home, its available period, questions and domain coverage, import, updates, each detailed explorer, longitudinal dashboard, comparisons, and details without relying on visual position.
2. Confirm controls expose their name, role, state, current value, invalid state, and busy state. Repeated detail actions must include the date or session context.
3. Start a valid import and confirm phase progress and the terminal result are announced without continuously repeating unchanged content.
4. Trigger invalid input and an invalid synthetic archive. Confirm the failure and recovery action are announced without exposing a source locator or personal value.
5. Inspect every summary and exact table. Decorative bars, timelines, and aligned lanes must not duplicate noisy content; the exact alternative must preserve every value, unit, missing state, and origin separation.
6. Change locale and confirm new interface text, dates, durations, numbers, coverage reasons, and update messages are announced in the selected language.
7. Reopen the application and confirm that only the valid saved explorer, or Home after an explicit return, and any update-recovery notice enter the navigation order predictably.

Missing names, incorrect roles or states, unannounced errors, inaccessible exact values, focus loss, or personal-data leakage blocks the candidate.

## Scaling, appearance, and contrast session

1. Test the minimum supported window and the evaluator's normal full-screen size at default text and 200% root text size.
2. Complete Home, import, every question entry and return, every explorer, filter, detail, comparison, longitudinal navigation, the Settings update panel, and terminal outcome at 200%.
3. Confirm there is no page-level horizontal overflow, clipped control, overlapping text, hidden error, or unreachable action. Labeled exact-table containers may scroll horizontally.
4. Repeat the primary journey in light and dark operating-system appearance and with increased contrast where available.
5. Confirm text, focus, controls, states, charts, and table values remain perceivable. Supported, ignored, unavailable, missing, invalid, comparison direction, and selected state must never depend on color alone.
6. Enable reduced motion and confirm optional width transitions are removed without changing information or interaction.

Record a contrast failure only after identifying the exact foreground, background, state, appearance, and control. Do not capture personal screen content.

## Realistic usability session

The participant performs the complete journey without coaching; the evaluator may ask the participant to describe expectations but does not explain controls before first use.

1. Install and launch FitFreed, choose a language, and identify what data stays local.
2. Select a compatible real ZIP, understand the progress phases, and explain whether cancellation is currently safe.
3. From the post-import Home reveal, interpret the usable period, available domains, one safe next question, and the terminal canonical effect without first reviewing source diagnostics. Then find all five source-coverage totals, at least one family reason, and its next action.
4. Use the Home questions to find an exact daily activity value, training session, sleep period, and recovery night; distinguish missing, unavailable, and zero.
5. Apply and reset a range in each explorer, open and close detail, and complete a two-period comparison.
6. Use the longitudinal view to inspect one aligned day, navigate to an authoritative explorer, return to the shared range, and explain the non-causality notice.
7. Reimport the same ZIP and explain why history did not duplicate. Import a later authorized export when available and explain the cumulative outcome.
8. Leave one explorer active, quit and reopen FitFreed, and confirm that exact explorer and the locale return without loading unrelated explorers. Return to Home, restart, confirm the exploration is no longer resumed, and find the application version and explicit update check in Settings.
9. Explain the difference between removing the application and deleting the library, where the library lives, why the original ZIP must be preserved, and what backup capability is absent.
10. Encounter one controlled invalid package or recoverable failure and identify the safe next action without editing the library or exposing diagnostics.

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
