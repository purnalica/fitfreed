# Create and Export a Session Report

## Availability

This guide describes the implemented report vertical in development builds. It does not announce a supported public release. Follow the [development preview boundary](development-preview.md) and use synthetic data until an exact public version activates real-export guidance.

## Create a report from a session

1. Open **Explore**, choose **Explore my training sessions**, and find a session through chronology, calendar, or the available filters.
2. Open **Session summary** and select **Build a report from this session**. FitFreed carries the exact session and training-library snapshot into Reports; it does not copy a value from the visible page.
3. Give the report a title and write your interpretation. This narrative is attributed to you and remains visibly separate from measurements recorded in the fitness library.
4. Decide whether the saved session block may include recorded average and maximum heart rate. The choice is unavailable when the session has no such evidence.
5. When routes are available, add any route you want to use. The initial endpoint protection removes 200 metres independently from the start and finish. A zero value removes no distance from either recorded endpoint and therefore requires an explicit choice; preview and export still use bounded normalized shapes rather than exact route samples.
6. Under **Add an answer from your training history**, add any combination of **Key finding**, **Period comparison**, **Comparison chart**, **Exact values**, and **Coverage and missing data**. Each view can occur once.
7. Set the baseline and comparison dates. Both periods are inclusive, may overlap, and may contain at most 366 days. Every selected analytical view uses these same periods. Choose the measurement for the finding and chart independently.
8. Move any block up or down to define the report order. The session summary and narrative are required; route and analytical blocks can be added and removed.
9. Select **Save report**. FitFreed validates the session, routes, and analytical periods against the exact current training snapshot before storing the definition under **Saved reports**. It survives restart and reimport independently from the provider ZIP.

New reports use definition version 3: exactly one session-evidence block, exactly one plain-text narrative,
zero or more distinct routes, and at most one of each analytical view in any order. Version-1 and version-2
reports remain readable and become version 3 only when edited. The current composer does not yet support a
question, exploration, or blank starting point, deliberate source refresh, lap or exact-sample blocks, PDF,
or spreadsheet output.

## Reopen and edit

Open **Reports** from the application navigation and select a saved report. FitFreed resolves its session through the current authoritative library and shows the saved revision, recorded summary, your narrative, coverage limitations, and provenance.

Edit the title, narrative, heart-rate choice, route selection, endpoint protection, analytical views, periods,
measurements, or block order and select **Save changes**. FitFreed reruns the shared comparison before saving.
Concurrent edits are rejected instead of overwriting a newer revision. Import and reimport never rewrite
authored report rows.

If the training snapshot changed after the report was saved, the report is marked **Source changed**. Its authorship remains available, but export is blocked. The current version has no deliberate refresh action; do not recreate or silently retarget the report as a workaround.

## Review and export

1. Open a current saved report and select **Review and export**.
2. Read the complete content boundary. It includes the recorded session summary, selected comparison totals,
findings, chart shapes, exact tables, coverage notices, your title and narrative, source attribution,
definition metadata, and only the selected route shapes. Exact training samples remain excluded.
3. If the saved definition permits heart-rate context, decide whether this individual export should retain it. Review may remove sensitive content but cannot add content excluded by the saved definition.
4. Review every route independently. You may omit its geometry or increase endpoint protection for this export; you cannot reduce the protection saved in the definition.
5. Select **Choose destination and export**, then choose a local HTML file through the operating-system dialog.

The result is one deterministic, self-contained HTML file with embedded styling and no script, external
image, font, stylesheet, telemetry, or network request. Analytical charts use CSS-only shapes with a visible
exact table; values from different imported sources remain separate, missing measurements stay explicit, and
descriptive findings do not claim causation or advice. Route blocks contain only a normalized local SVG shape
and declared privacy metadata: recorded latitude, longitude, altitude, and elapsed point values are not
written to the HTML. The file can be opened independently in an ordinary browser, printed, or shared at the
user's discretion. The destination path is never stored in the report or returned in export metadata.

Cancellation or a failure before completion leaves no partial file that looks complete and preserves an existing destination. Keep the original provider export and the FitFreed library backup separately; an exported report is not a fitness-library backup.

## Privacy boundary

- HTML export is an explicit local action. FitFreed does not upload the file.
- A report may contain personal fitness and physiological information. Inspect it before sharing and treat it as sensitive personal data.
- Route inclusion is explicit, uses endpoint redaction, and receives a second independent review before each export. Omitting geometry does not remove the saved route block.
- Period-comparison totals may reveal habits and changes even without exact samples. Review their ranges,
  values, and coverage before sharing.
- The report identifies Polar Flow only as the recorded source attribution where applicable; its data model and report identity remain provider-neutral.
- Never attach a real report or screenshot containing personal values to a public issue.
