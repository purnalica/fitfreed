# Development Preview Guide

## Important boundary

The current application is a development preview, not an alpha release. It proves source-subject-safe daily-activity import, explainable outcomes, reimport, and the first gap-aware history overview. One supplied reference export has passed a private, privacy-safe compatibility predicate, but that does not establish broad historical compatibility. Do not use a real personal export yet: broader mappings, user-controlled backup recovery, and the complete MVP privacy and installation contracts are still under implementation. Read the project-wide [disclaimer](../../DISCLAIMER.md) before running any build.

## Run the synthetic journey

1. Follow the [contributor setup](../development/getting-started.md).
2. Run `npm run fixture:e2e`.
3. Start the desktop application with `npm run tauri -- dev`.
4. Choose `.artifacts/e2e/fixtures/valid.zip`.
5. Import the package and inspect its completed status, source, history effect, five coverage categories, family-level reasons and next actions, and the daily-activity overview.
6. Confirm that the overview states its selected and available ranges; shows total steps, average steps per available day, available days, unavailable-value days, and missing days; and provides the same daily values and availability in both the visual and exact table.
7. Import the same package again and confirm that the application reports an exact repeat, reuses complete coverage evidence, and does not duplicate history.
8. Import `.artifacts/e2e/fixtures/invalid.zip` and confirm that the package is rejected with localized recovery guidance, one invalid daily-activity artifact, its family-level explanation, and no history change.
9. Import `.artifacts/e2e/fixtures/overlap.zip` and confirm that the existing history remains, the new day is added, and overview aggregates change accordingly.
10. Change between English (US) and Spanish (Spain) and verify the outcome, guidance, family names, reasons, next actions, ranges, availability, dates, and exact step formatting.
11. Close and reopen the application and confirm that the selected language and localized overview are restored.

The generated fixtures contain only independently constructed fictional values. The local SQLite library remains in the operating system's FitFreed application-data directory. Development E2E runs use an isolated generated library under `.artifacts` instead.

## Troubleshooting this preview

- If the import action is unavailable, select a ZIP package first. Canceling the file picker intentionally keeps the action unavailable.
- The generated `invalid.zip` package is expected to be rejected. Use `valid.zip` for the successful journey and preserve the visible rejection evidence when diagnosing a regression.
- If FitFreed reports that the local library is unavailable, stop importing and preserve the application-data directory. Do not delete or edit the SQLite file as a recovery attempt.
- If a selected language cannot be saved, the application keeps the operating-system language for first-run initialization or restores the previous explicit language. Restart before trying the selection again.
- Use the [contributor troubleshooting guide](../development/troubleshooting.md) for build, test, package, or E2E failures.

## Expected limitations

- Only the documented daily summary compatibility matrix is supported; one evaluated package is evidence, not a universal provider guarantee.
- The overview selects at most the latest 30 local dates. Interactive filtering, daily detail, period comparison, training, sleep, recovery, user-controlled backup, portable export, and updates are not implemented yet.
- The visible coverage is exact for the current recognition boundary and does not expose archive filenames. A recognized or classified family is not necessarily imported, and the view is not a claim that all historical Polar Flow takeouts are fully supported.
- The package is unsigned and must not be published as a public release.

These are open product gates, not accepted permanent behavior.
