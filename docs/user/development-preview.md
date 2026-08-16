# Development Preview Guide

## Important boundary

The current application is a development preview, not an alpha release. It proves source-subject-safe daily-activity and training-summary import, explainable outcomes, reimport, range exploration, detail, and two-period comparison. Routes and full-resolution training detail remain deliberately excluded. One supplied reference export has passed private, privacy-minimized activity, training-summary, origin-correlation, coverage, and exact-repeat predicates, but that does not establish broad historical compatibility. Do not use a real personal export yet: sleep and recovery mappings, user-controlled backup recovery, and the complete MVP privacy and installation contracts are still under implementation. Read the project-wide [disclaimer](../../DISCLAIMER.md) before running any build.

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
13. Import the same package again and confirm that the application reports an exact repeat, reuses complete daily-activity and training-summary coverage evidence, and does not duplicate either history.
14. Import `.artifacts/e2e/fixtures/invalid.zip` and confirm that the package is rejected with localized recovery guidance, one invalid daily-activity artifact, its family-level explanation, and no history change.
15. Import `.artifacts/e2e/fixtures/overlap.zip` and confirm that the existing history remains, the new day is added, activity aggregates change accordingly, and the training detail reflects the later amended summary without a duplicate session.
16. Change between English (US) and Spanish (Spain) and verify the outcome, guidance, family names, reasons, next actions, both domains' filters, ranges, detail, comparisons, availability, dates, durations, and exact integer formatting.
17. Close and reopen the application and confirm that the selected language and both localized default overviews are restored; comparison results are intentionally not persisted.

The generated fixtures contain only independently constructed fictional values. The local SQLite library remains in the operating system's FitFreed application-data directory. Development E2E runs use an isolated generated library under `.artifacts` instead.

## Troubleshooting this preview

- If the import action is unavailable, select a ZIP package first. Canceling the file picker intentionally keeps the action unavailable.
- The generated `invalid.zip` package is expected to be rejected. Use `valid.zip` for the successful journey and preserve the visible rejection evidence when diagnosing a regression.
- If FitFreed reports that the local library is unavailable, stop importing and preserve the application-data directory. Do not delete or edit the SQLite file as a recovery attempt.
- If a selected language cannot be saved, the application keeps the operating-system language for first-run initialization or restores the previous explicit language. Restart before trying the selection again.
- Use the [contributor troubleshooting guide](../development/troubleshooting.md) for build, test, package, or E2E failures.

## Expected limitations

- Only the documented daily-activity and training-summary compatibility matrices are supported; one evaluated package is evidence, not a universal provider guarantee.
- Both overviews select at most the latest 30 local dates by default; overview and comparison ranges accept at most 366 inclusive dates each. Training sport references remain unresolved and appear only as neutral availability, never as invented names. Sleep, recovery, user-controlled backup, portable export, and updates are not implemented yet.
- The visible coverage is exact for the current recognition boundary and does not expose archive filenames. A recognized or classified family is not necessarily imported, and the view is not a claim that all historical Polar Flow takeouts are fully supported.
- The package is unsigned and must not be published as a public release.

These are open product gates, not accepted permanent behavior.
