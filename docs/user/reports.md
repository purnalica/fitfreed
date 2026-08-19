# Create, Revisit, and Export a Report

## Availability

This guide describes the implemented report vertical in development builds. It does not announce a supported public release. Follow the [development preview boundary](development-preview.md) and use synthetic data until an exact public version activates real-export guidance.

## Choose how to start

Open **Reports** to see saved reports and two direct starts:

- **Compare recent training periods** prepares two bounded adjacent periods from the current local library,
  selects the five analytical views, and asks for your interpretation.
- **Start a blank report** begins with only a title and your interpretation. You can add comparison evidence
  before saving or after reopening it.

A completed **Training period comparison** also offers **Turn this comparison into a report**. The report
retains the exact periods that produced the visible result. **Back to the comparison** restores that mounted
exploration and its result.

The fourth start is a specific training session:

1. Open **Explore**, choose **Explore my training sessions**, and find a session through chronology, calendar, or the available filters.
2. Open **Session summary** and select **Build a report from this session**. FitFreed carries the exact session and training-library snapshot into Reports; it does not copy a value from the visible page.
3. Give the report a title and write your interpretation. This narrative is attributed to you and remains visibly separate from measurements recorded in the fitness library.
4. Decide whether the saved session block may include recorded average and maximum heart rate. The choice is unavailable when the session has no such evidence.
5. When routes are available, add any route you want to use. The initial endpoint protection removes 200 metres independently from the start and finish. A zero value removes no distance from either recorded endpoint and therefore requires an explicit choice; preview and export still use bounded normalized shapes rather than exact route samples.
6. Under **Add an answer from your training history**, add any combination of **Key finding**, **Period comparison**, **Comparison chart**, **Exact values**, and **Coverage and missing data**. Each view can occur once.
7. Set the baseline and comparison dates. Both periods are inclusive, may overlap, and may contain at most 366 days. Every selected analytical view uses these same periods. Choose the measurement for the finding and chart independently.
8. Move any block up or down to define the report order. The session summary and narrative are required; route and analytical blocks can be added and removed.
9. Select **Save report**. FitFreed validates the session, routes, and analytical periods against the exact current training snapshot before storing the definition under **Saved reports**. It survives restart and reimport independently from the provider ZIP.

New reports use definition version 4. Every report has exactly one plain-text narrative and may contain at
most one of each analytical view. Session-origin reports additionally require one session-evidence block and
may contain distinct routes. Question and exploration origins require analytical evidence. Blank reports may
remain narrative-only or gain analytical evidence later without changing how they began. Versions 1–3 remain
readable and become version 4 only when edited. Lap or exact-sample blocks, native
PDF, spreadsheet output, and free-form layout are not yet available.

## Reopen and edit

Open **Reports** from the application navigation and select a saved report. FitFreed resolves only the
evidence selected by its definition through the current authoritative library and shows the saved revision,
your narrative, applicable recorded or calculated evidence, coverage limitations, and provenance.

Edit the title, narrative, applicable heart-rate choice, route selection, endpoint protection, analytical
views, periods, measurements, or block order and select **Save changes**. FitFreed reruns the shared
comparison before saving. Concurrent edits are rejected instead of overwriting a newer revision. Import and
reimport never rewrite authored report rows.

If the training snapshot changed after the report was saved, the report is marked **Source changed**. The
complete preview shows the current compatible candidate, while editing and export remain locked. Import and
reimport never retarget the report automatically.

To decide whether the report should use that candidate:

1. Select **Review evidence refresh**.
2. Inspect the complete candidate preview and the disclosed boundary. FitFreed does not retain historical
   canonical snapshots, so it cannot reconstruct or invent old numeric values for a before-and-after view.
3. Verify what remains unchanged: title, interpretation, language, origin, periods, block identities and
   order, selected measurements, and privacy choices.
4. Select **Keep saved version** to make no change, or **Use this evidence revision** to confirm the exact
   candidate you reviewed.

Confirmation recalculates the candidate immediately before an optimistic write. If the library or report
changed in the meantime, FitFreed rejects the operation and leaves the saved definition untouched so the
newest candidate can be reviewed. A successful refresh advances the report revision and evidence reference,
survives restart, unlocks editing and export, and never rewrites authored text or composition.

## Review and export

1. Open a current saved report and select **Review and export**.
2. Read the complete content boundary. It includes only the applicable recorded session summary, selected
comparison totals, findings, chart shapes, exact tables, coverage notices, your title and narrative, source
attribution, definition metadata, and reviewed route shapes. Exact training samples remain excluded.
3. For a session report whose definition permits heart-rate context, decide whether this individual export
should retain it. Review may remove sensitive content but cannot add content excluded by the definition.
4. Review every available route independently. You may omit its geometry or increase endpoint protection for
this export; you cannot reduce the protection saved in the definition.
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
- A session report identifies Polar Flow only as recorded source attribution where applicable. Analytical
  non-session reports identify the local-library revision, while narrative-only reports explicitly claim no
  imported evidence. The data model and report identity remain provider-neutral.
- Never attach a real report or screenshot containing personal values to a public issue.
