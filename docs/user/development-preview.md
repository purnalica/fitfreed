# Development Preview Guide

## Important boundary

The current application is a development foundation, not an alpha release. It proves source-subject-safe synthetic daily-activity import, explainable outcomes, reimport, and history exploration. Do not use a real personal export yet: historical format compatibility, broader mappings, reference-export acceptance, backup recovery, and the full MVP privacy contract are still under implementation. Read the project-wide [disclaimer](../../DISCLAIMER.md) before running any build.

## Run the synthetic journey

1. Follow the [contributor setup](../development/getting-started.md).
2. Run `npm run fixture:e2e`.
3. Start the desktop application with `npm run tauri -- dev`.
4. Choose `.artifacts/e2e/fixtures/valid.zip`.
5. Import the package and inspect its completed status, source, history effect, five coverage categories, and three-day daily-activity history.
6. Import the same package again and confirm that the application reports an exact repeat, reuses complete coverage evidence, and does not duplicate history.
7. Import `.artifacts/e2e/fixtures/invalid.zip` and confirm that the package is rejected with localized recovery guidance, one invalid artifact, and no history change.
8. Import `.artifacts/e2e/fixtures/overlap.zip` and confirm that the existing history remains and the new day is added.
9. Change between English (US) and Spanish (Spain) and verify the outcome, guidance, coverage labels, localized dates, and step formatting.
10. Close and reopen the application and confirm that the selected language and localized history presentation are restored.

The generated fixtures contain only independently constructed fictional values. The local SQLite library remains in the operating system's FitFreed application-data directory. Development E2E runs use an isolated generated library under `.artifacts` instead.

## Troubleshooting this preview

- If the import action is unavailable, select a ZIP package first. Canceling the file picker intentionally keeps the action unavailable.
- The generated `invalid.zip` package is expected to be rejected. Use `valid.zip` for the successful journey and preserve the visible rejection evidence when diagnosing a regression.
- If FitFreed reports that the local library is unavailable, stop importing and preserve the application-data directory. Do not delete or edit the SQLite file as a recovery attempt.
- If a selected language cannot be saved, the application keeps the operating-system language for first-run initialization or restores the previous explicit language. Restart before trying the selection again.
- Use the [contributor troubleshooting guide](../development/troubleshooting.md) for build, test, package, or E2E failures.

## Expected limitations

- Only the synthetic daily summary shape exercised by the first vertical slice is supported.
- Historical real-export compatibility, training, sleep, recovery, filtering, comparisons, user-controlled backup, portable export, and updates are not implemented yet.
- The visible coverage is exact for the current synthetic daily-activity recognition boundary; it is not a claim that real Polar Flow takeouts are fully supported.
- The package is unsigned and must not be published as a public release.

These are open product gates, not accepted permanent behavior.
