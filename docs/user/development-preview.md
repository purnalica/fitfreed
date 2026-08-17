# Development Preview Guide

## Important boundary

The current application is a development preview, not an alpha release. It proves source-subject-safe daily-activity, training-summary, and primary-sleep import; explainable outcomes; reimport; range exploration; exact detail; and two-period comparison. Routes and full-resolution training detail remain deliberately excluded. Sleep keeps activity-family summaries separate and exposes missing nights and optional-measurement coverage instead of inventing values. One supplied reference export has passed private, privacy-minimized activity, training-summary, sleep, origin-correlation, coverage, and exact-repeat predicates, but that does not establish broad historical compatibility. Do not use a real personal export yet: recovery mapping, user-controlled backup recovery, and the complete MVP privacy and installation contracts are still under implementation. Read the project-wide [disclaimer](../../DISCLAIMER.md) before running any build.

## Run the synthetic journey

1. Follow the [contributor setup](../development/getting-started.md).
2. Run `npm run fixture:e2e`.
3. Start the desktop application with `npm run tauri -- dev`.
4. Choose `.artifacts/e2e/fixtures/valid.zip`.
5. Import the package and inspect its completed status, source, history effect, five coverage categories, family-level reasons and next actions, and the daily-activity overview. Confirm that Training sessions is supported only as a mapped summary and that the coverage guidance tells you to retain the ZIP for excluded detail.
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
17. Import the same package again and confirm that the application reports an exact repeat, reuses complete activity, training, and sleep coverage evidence, and does not duplicate any history.
18. Import `.artifacts/e2e/fixtures/invalid.zip` and confirm that the package is rejected with localized recovery guidance, one invalid daily-activity artifact, its family-level explanation, and no history change.
19. Import `.artifacts/e2e/fixtures/overlap.zip` and confirm that the existing history remains, the new day is added, activity aggregates change accordingly, the training detail reflects the later amended summary without a duplicate session, and sleep remains unchanged.
20. Change between English (US) and Spanish (Spain) and verify the outcome, guidance, family names, reasons, next actions, all three domains' filters, ranges, detail, comparisons, availability, dates, durations, and exact integer formatting.
21. At 200% text size, verify that the page does not overflow horizontally and that wide exact tables scroll inside their labeled containers. Check both visual and table alternatives without relying on color alone.
22. Close and reopen the application and confirm that the selected language and all three localized default overviews are restored; detail and comparison results are intentionally not persisted.

The generated fixtures contain only independently constructed fictional values. The local SQLite library remains in the operating system's FitFreed application-data directory. Development E2E runs use an isolated generated library under `.artifacts` instead.

## Troubleshooting this preview

- If the import action is unavailable, select a ZIP package first. Canceling the file picker intentionally keeps the action unavailable.
- The generated `invalid.zip` package is expected to be rejected. Use `valid.zip` for the successful journey and preserve the visible rejection evidence when diagnosing a regression.
- If FitFreed reports that the local library is unavailable, stop importing and preserve the application-data directory. Do not delete or edit the SQLite file as a recovery attempt.
- If a selected language cannot be saved, the application keeps the operating-system language for first-run initialization or restores the previous explicit language. Restart before trying the selection again.
- Use the [contributor troubleshooting guide](../development/troubleshooting.md) for build, test, package, or E2E failures.

## Expected limitations

- Only the documented daily-activity, training-summary, and split sleep-result compatibility matrices are supported; one evaluated package is evidence, not a universal provider guarantee.
- All three overviews select at most the latest 30 provider-local dates by default; overview and comparison ranges accept at most 366 inclusive dates each. Training sport references remain unresolved and appear only as neutral availability, never as invented names. Sleep scores remain source-derived facts rather than medical interpretation. Recovery, user-controlled backup, portable export, and updates are not implemented yet.
- The visible coverage is exact for the current recognition boundary and does not expose archive filenames. A recognized or classified family is not necessarily imported, and the view is not a claim that all historical Polar Flow takeouts are fully supported.
- The package is unsigned and must not be published as a public release.

These are open product gates, not accepted permanent behavior.
