# Development Preview Guide

## Important boundary

The current application is a development preview, not an alpha release. It proves source-subject-safe daily-activity, training-summary, primary-sleep, and dated nightly-recovery import; explainable outcomes; reimport; detailed domain exploration; and an integrated longitudinal range, day synopsis, navigation, and comparison journey. Routes, full-resolution training detail, and undated recovery samples remain deliberately excluded. Sleep exposes missing nights and optional-measurement coverage instead of inventing values. Recovery keeps shared intervals distinct from source-specific assessment, baseline, and guidance, and makes no medical interpretation. The longitudinal view aligns recorded co-occurrence without merging sources or asserting causation. One supplied reference export has passed private, privacy-minimized activity, training-summary, sleep, origin-correlation, coverage, and exact-repeat predicates, but that does not establish broad historical compatibility. Do not use a real personal export yet: user-controlled backup recovery and the complete MVP privacy and installation contracts are still under implementation. Read the project-wide [disclaimer](../../DISCLAIMER.md) before running any build.

## Run the synthetic journey

1. Follow the [contributor setup](../development/getting-started.md).
2. Run `npm run fixture:e2e`.
3. Start the desktop application with `npm run tauri -- dev`.
4. Choose `.artifacts/e2e/fixtures/valid.zip`.
5. Import the package and inspect its completed status, source, history effect, five coverage categories, family-level reasons and next actions, and the daily-activity overview. Confirm that Training sessions is supported only as a mapped summary, dated Nightly recovery is supported, and Nightly recovery details is deliberately ignored because its samples have no safe identity or date relationship.
6. Confirm that the overview states its selected and available ranges; shows total steps, average steps per available day, available days, unavailable-value days, and missing days; and provides the same daily values and availability in both the visual and exact table.
7. Enter an inclusive `From` and `Through` range inside the available history, apply it, and confirm that the summaries, visual, and table contain exactly those calendar dates. Reverse the dates and confirm that the application rejects the input without changing the visible history; then restore the latest 30-day window.
8. Open daily detail from a visual or table date, confirm the exact value and explicit availability for every activity origin, and close it.
9. Enter baseline and comparison periods, compare them, and verify the visual totals and exact table. Confirm that total and average changes use comparison minus baseline and that both periods' available, unavailable, and missing-day counts remain visible. Clear the disposable comparison result.
10. In Training history, confirm the summary reports sessions, distinct training days, duration, optional distance and energy totals, and measurement coverage. The neutral interface must not display source session, origin, or sport references.
11. Enter a training range, apply and reset it, and confirm that summaries, the duration visual, and the exact session table agree. Open every session detail and verify local start and end, UTC offset availability, duration, distance, energy, heart rates, neutral training-type availability, and exercise count; then close each detail.
12. Compare two training periods and verify session, training-day, duration, distance, energy, and measurement-coverage rows. Optional changes remain unavailable unless both periods have the measurement. Clear the result and confirm that no canonical history changes.
13. In Sleep history, verify observed and missing nights, time asleep, efficiency, score, goal, phase, stage-timeline, and recording-status coverage. Missing means no canonical primary period for that origin and date; it never means zero sleep.
14. Apply and reset a sleep range. Confirm that the visual composition and exact table agree, optional measurements remain explicitly unavailable, and opaque origin references never appear.
15. Open each available night. Verify offset-bearing local boundaries, declared durations and interruption counts, efficiency, continuity, goal, rating, cycles, recording status, phase composition, exact stage-transition table, and every available score component. Close the detail and confirm it is disposable.
16. Compare two sleep periods. Verify observed and missing nights, average durations, efficiency, score, goal attainment, measurement coverage guidance, and comparison-minus-baseline changes. Invalid input must preserve the previous valid result; clear the result afterward.
17. In Nightly recovery, verify observed and missing nights; average beat-to-beat, HRV RMSSD, and breathing intervals; and separate assessment, baseline, and guidance coverage. Missing means no canonical recovery summary for that origin and date; it never means zero recovery.
18. Apply and reset a recovery range. Confirm that the interval visual and exact table agree, missing measurements remain explicitly unavailable, and opaque origin references never appear.
19. Open each available recovery night. Verify the exact shared measurements and the complete source scheme, assessment values, baseline values, and guidance. Confirm that the interface identifies this context as source-specific and does not present it as FitFreed medical advice; close the detail afterward.
20. Compare two recovery periods. Verify observed and missing nights, all three interval averages, source-component coverage, comparison-minus-baseline changes, and the explicit missing-data caution. Invalid input must preserve the previous valid result; clear the result afterward.
21. In Longitudinal dashboard, confirm that one global range spans every canonical date represented by activity, local training starts, sleep, or recovery. Verify the four summary cards, coverage denominators, aligned visual lanes, and exact table. A missing activity, sleep, or recovery observation must not appear as zero, while a date with no training session must show an exact zero count and duration.
22. Apply and reset the shared range. Reverse the dates and confirm that the application preserves the current result while reporting an error. If more than one source exists, confirm that each appears as a separate ordinal history and that no opaque source reference is visible.
23. Open aligned day detail for dates with different coverage. Verify every exact activity, training, sleep, and recovery value and follow each available link. Confirm that the authoritative explorer selects the same date, that sleep and recovery open their exact available detail, and that returning to the latest window restores the complete domain view. Confirm the notice states that co-occurrence does not establish cause, diagnosis, readiness, or advice; then close the detail.
24. Compare two shared periods and verify total steps, training duration, average asleep duration, and average beat-to-beat interval. Changes use comparison minus baseline, unequal periods remain explicit, and an unavailable aggregate does not become zero. Invalid input must preserve the previous valid result; clear the result afterward.
25. Import the same package again and confirm that the application reports an exact repeat, reuses complete activity, training, sleep, and recovery coverage evidence, and does not duplicate any detailed or longitudinal history.
26. Import `.artifacts/e2e/fixtures/invalid.zip` and confirm that the package is rejected with localized recovery guidance, one invalid daily-activity artifact, its family-level explanation, and no history change.
27. Import `.artifacts/e2e/fixtures/overlap.zip` and confirm that the existing history remains, the new day is added, activity aggregates change accordingly, the training detail reflects the later amended summary without a duplicate session, sleep and recovery remain unchanged, and the longitudinal view refreshes automatically.
28. Change between English (US) and Spanish (Spain) and verify the outcome, guidance, family names, reasons, next actions, all four detailed domains and the longitudinal view, including filters, ranges, detail, comparisons, availability, dates, durations, and exact integer formatting.
29. At 200% text size, verify that the page does not overflow horizontally and that wide exact tables scroll inside their labeled containers. Check both visual and table alternatives without relying on color alone.
30. Close and reopen the application and confirm that the selected language, all four localized default overviews, and the default longitudinal overview are restored; detail and comparison results are intentionally not persisted.

The generated fixtures contain only independently constructed fictional values. The local SQLite library remains in the operating system's FitFreed application-data directory. Development E2E runs use an isolated generated library under `.artifacts` instead.

## Troubleshooting this preview

- If the import action is unavailable, select a ZIP package first. Canceling the file picker intentionally keeps the action unavailable.
- The generated `invalid.zip` package is expected to be rejected. Use `valid.zip` for the successful journey and preserve the visible rejection evidence when diagnosing a regression.
- If FitFreed reports that the local library is unavailable, stop importing and preserve the application-data directory. Do not delete or edit the SQLite file as a recovery attempt.
- If a selected language cannot be saved, the application keeps the operating-system language for first-run initialization or restores the previous explicit language. Restart before trying the selection again.
- Use the [contributor troubleshooting guide](../development/troubleshooting.md) for build, test, package, or E2E failures.

## Expected limitations

- Only the documented daily-activity, training-summary, split sleep-result, and dated nightly-recovery compatibility matrices are supported; one evaluated package is evidence, not a universal provider guarantee.
- All four detailed overviews and the longitudinal overview select at most the latest 30 dates by default; overview and comparison ranges accept at most 366 inclusive dates each. The longitudinal range is the global union, while each detailed explorer retains its own date semantics. Training sport references remain unresolved and appear only as neutral availability, never as invented names. Sleep scores and recovery assessments remain source-derived facts rather than medical interpretation. Undated recovery samples, user-controlled backup, portable export, and updates are not implemented yet.
- The visible coverage is exact for the current recognition boundary and does not expose archive filenames. A recognized or classified family is not necessarily imported, and the view is not a claim that all historical Polar Flow takeouts are fully supported.
- The package is unsigned and must not be published as a public release.

These are open product gates, not accepted permanent behavior.
