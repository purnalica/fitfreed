# Development Preview Guide

## Important boundary

The current application is a development foundation, not an alpha release. It proves a synthetic daily-activity import, explainable outcome, and history journey. Do not use a real personal export yet: source-subject identity, complete real-export family coverage and mappings, and the full MVP privacy contract are still under implementation. Read the project-wide [disclaimer](../../DISCLAIMER.md) before running any build.

## Run the synthetic journey

1. Follow the [contributor setup](../development/getting-started.md).
2. Run `npm run fixture:e2e`.
3. Start the desktop application with `npm run tauri -- dev`.
4. Choose `.artifacts/e2e/fixtures/valid.zip`.
5. Import the package and inspect its completed status, source, history effect, five coverage categories, and three-day daily-activity history.
6. Import the same package again and confirm that the application reports an exact repeat, reuses complete coverage evidence, and does not duplicate history.
7. Import `.artifacts/e2e/fixtures/invalid.zip` and confirm that the package is rejected with localized recovery guidance, one invalid artifact, and no history change.
8. Import `.artifacts/e2e/fixtures/overlap.zip` and confirm that the existing history remains and the new day is added.
9. Change between English (US) and Spanish (Spain) and verify the outcome, guidance, coverage labels, and step formatting.

The generated fixtures contain only independently constructed fictional values. The local SQLite library remains in the operating system's FitFreed application-data directory. Development E2E runs use an isolated generated library under `.artifacts` instead.

## Expected limitations

- Only the synthetic daily summary shape exercised by the first vertical slice is supported.
- Complete real-export provider-family coverage, source identity, training, sleep, recovery, filtering, comparisons, user-controlled backup, portable export, and updates are not implemented yet.
- The visible coverage is exact for the current synthetic daily-activity recognition boundary; it is not a claim that real Polar Flow takeouts are fully supported.
- The package is unsigned and must not be published as a public release.

These are open product gates, not accepted permanent behavior.
