# Create and Export a Session Report

## Availability

This guide describes the implemented report vertical in development builds. It does not announce a supported public release. Follow the [development preview boundary](development-preview.md) and use synthetic data until an exact public version activates real-export guidance.

## Create a report from a session

1. Open **Explore**, choose **Explore my training sessions**, and find a session through chronology, calendar, or the available filters.
2. Open **Session summary** and select **Build a report from this session**. FitFreed carries the exact session and training-library snapshot into Reports; it does not copy a value from the visible page.
3. Give the report a title and write your interpretation. This narrative is attributed to you and remains visibly separate from measurements recorded in the fitness library.
4. Decide whether the saved definition may include the recorded average and maximum heart-rate summary. The choice is unavailable when the session has no such evidence.
5. Select **Save report**. The definition is stored in the local FitFreed library and appears under **Saved reports**. It survives restart and reimport independently from the provider ZIP.

Reports version 1 always contains exactly one session-evidence block followed by one plain-text narrative block. It does not support arbitrary layouts, charts, routes, laps, exact signal samples, PDF, or spreadsheet output.

## Reopen and edit

Open **Reports** from the application navigation and select a saved report. FitFreed resolves its session through the current authoritative library and shows the saved revision, recorded summary, your narrative, coverage limitations, and provenance.

Edit the title, narrative, or saved heart-rate choice and select **Save changes**. Concurrent edits are rejected instead of overwriting a newer revision. Import and reimport never rewrite authored report rows.

If the training snapshot changed after the report was saved, the report is marked **Source changed**. Its authorship remains available, but export is blocked. The current version has no deliberate refresh action; do not recreate or silently retarget the report as a workaround.

## Review and export

1. Open a current saved report and select **Review and export**.
2. Read the complete content boundary. Version 1 includes the recorded session summary, explicit missing-data notices, your title and narrative, source attribution, and definition metadata. Routes, coordinates, and exact samples are excluded.
3. If the saved definition permits heart-rate context, decide whether this individual export should retain it. Review may remove sensitive content but cannot add content excluded by the saved definition.
4. Select **Choose destination and export**, then choose a local HTML file through the operating-system dialog.

The result is one deterministic, self-contained HTML file with embedded styling and no script, external image, font, stylesheet, telemetry, or network request. It can be opened independently in an ordinary browser, printed, or shared at the user's discretion. The destination path is never stored in the report or returned in export metadata.

Cancellation or a failure before completion leaves no partial file that looks complete and preserves an existing destination. Keep the original provider export and the FitFreed library backup separately; an exported report is not a fitness-library backup.

## Privacy boundary

- HTML export is an explicit local action. FitFreed does not upload the file.
- A report may contain personal fitness and physiological information. Inspect it before sharing and treat it as sensitive personal data.
- Version 1 excludes location evidence even when the source session has a route.
- The report identifies Polar Flow only as the recorded source attribution where applicable; its data model and report identity remain provider-neutral.
- Never attach a real report or screenshot containing personal values to a public issue.
