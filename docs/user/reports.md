# Create, Revisit, and Export a Report

## Availability

This guide describes the implemented report vertical in development builds. It does not announce a supported public release. Follow the [development preview boundary](development-preview.md) and use synthetic data until an exact public version activates real-export guidance.

## Choose how to start

Open **Reports** to see saved results. When the Library already contains reports, **New comparison** remains
a compact secondary action beside **Reload** so the first useful result stays in view. An empty Library
expands the same start with enough guidance to create the first report:

- **Compare recent training periods** prepares two bounded adjacent periods from the current local library,
  selects the five analytical views, and lets the calculated evidence stand on its own. Add commentary only
  when your own words improve the report.

Reports can also begin from a completed training-period comparison or a specific training session. These
contextual starts retain the exact evidence that prompted the report instead of asking you to recreate it.
The ordinary interface does not offer a generic blank start. Existing blank-origin reports remain readable
and editable so an application update never discards authored work.

The report workspace has three explicit locations. **Library** contains saved results and the contextual start,
**Compose** contains the ordered editor, and **Preview** shows the resolved saved output. Temporarily moving
between available locations preserves the current draft. A successful save opens Preview; use **Edit
composition** or **Compose** to continue editing, and return to Library to choose another saved report.
Stage navigation deliberately preserves a draft. Use **Cancel composition** when the draft must be discarded:
a new report returns to the session or comparison that started it, or to Library when it began there, and
creates nothing.

Each Library card leads with a recognizable current result rather than implementation metadata. Depending
on its subject, it shows the recorded sport and date or the comparison periods, one human-scale metric, the
evidence state, and a concise sensitivity summary. Results from different imported sources remain visibly
separate. **Show more reports** requests the next bounded page without resolving complete routes, signals,
provenance, or export output merely to draw the Library. Selecting a card opens Preview, never Compose.

A completed **Training period comparison** leads with its plain answer and keeps exact values behind an
explicit review action. **Turn this comparison into a report** retains the exact periods that produced that
answer; it never copies rounded presentation text as evidence. **Back to the comparison** restores the
mounted answer and its focus.

The fourth start is a specific training session:

1. Open **Explore**, choose **Explore my training sessions**, and find a session through chronology, calendar, or the available filters.
2. Open **Session summary** and select **Build a report from this session**. FitFreed carries the exact session and training-library snapshot into Reports; it does not copy a value from the visible page.
3. Give the report a title. The selected recorded or calculated evidence is sufficient for a factual report.
   Use **Add commentary** only when your own explanation adds useful context. Commentary is attributed to you
   and remains visibly separate from evidence.
4. Decide whether the saved session block may include recorded average and maximum heart rate. The choice is unavailable when the session has no such evidence.
5. When routes are available, add any route you want to use. The initial endpoint protection removes 200 metres independently from the start and finish. A zero value removes no distance from either recorded endpoint and therefore requires an explicit choice; preview and export still use bounded normalized shapes rather than exact route samples.
6. Under **Add an answer from your training history**, add any combination of **Key finding**, **Period comparison**, **Comparison chart**, **Exact values**, and **Coverage and missing data**. Each view can occur once.
7. Set the baseline and comparison dates. Both periods are inclusive, may overlap, and may contain at most 366 days. Every selected analytical view uses these same periods. Choose the measurement for the finding and chart independently.
8. Move any block up or down to define the report order. The session summary is required for a session report;
   route, analytical, and commentary blocks can be added or removed when the remaining composition still has
   supported evidence. An older authored-only report keeps its commentary until evidence is added.
9. Select **Save report**. Empty commentary is omitted rather than stored as authored content. The action keeps
   its name and the editor remains visible but busy while localized progress is announced. FitFreed validates
   the session, routes, and analytical periods against the exact current training snapshot before storing the
   definition under **Saved reports**, then opens the independent Preview. It survives restart and reimport
   independently from the provider ZIP.

New reports use definition version 4. Every report may have zero or one plain-text commentary block and may
contain at most one of each analytical view. Session-origin reports additionally require one session-evidence block and
may contain distinct routes. Question and exploration origins require analytical evidence. Blank reports may
remain narrative-only or gain analytical evidence later without changing how they began. Versions 1–3 remain
readable and become version 4 only when edited. Lap or exact-sample blocks, native
PDF, spreadsheet output, and free-form layout are not yet available.

## Reopen and edit

Open **Reports** from the application navigation and select a saved report in **Library**. FitFreed resolves
only the evidence selected by its definition through the current authoritative library and opens **Preview**
with any optional commentary, applicable recorded or calculated evidence, coverage limitations, and provenance.
The title and first ordered result appear before the secondary report actions. Use **Edit composition** to
inspect the saved revision and change the definition.

Edit the title, optional commentary, applicable heart-rate choice, route selection, endpoint protection, analytical
views, periods, measurements, or block order and select **Save changes**. FitFreed reruns the shared
comparison before saving. Concurrent edits are rejected instead of overwriting a newer revision. Import and
reimport never rewrite authored report rows. Select **Cancel composition** to discard every unsaved edit,
restore the exact reviewed definition, and return to its result without writing a new revision.

To remove a saved report, open it in Preview and select **Delete report**. The confirmation replaces Preview,
names the exact report, and offers an explicit cancel action. Confirming removes only the reviewed report
revision and its owned composition; imported fitness history and every other report remain unchanged. If the
report changed after it was opened, FitFreed keeps the newest revision, reloads it, and asks you to review it
instead of claiming that anything was removed.

If the training snapshot changed after the report was saved, the report is marked **Source changed**. The
complete preview shows the current compatible candidate, while **Edit composition**, **Compose**, and export
remain locked. Import and reimport never retarget the report automatically.

To decide whether the report should use that candidate:

1. Select **Review evidence refresh**.
2. Inspect the complete candidate preview and the disclosed boundary. FitFreed does not retain historical
   canonical snapshots, so it cannot reconstruct or invent old numeric values for a before-and-after view.
3. Verify what remains unchanged: title, optional commentary, language, origin, periods, block identities and
   order, selected measurements, and privacy choices.
4. Select **Keep saved version** to make no change, or **Use this evidence revision** to confirm the exact
   candidate you reviewed.

Confirmation recalculates the candidate immediately before an optimistic write. If the library or report
changed in the meantime, FitFreed rejects the operation and leaves the saved definition untouched so the
newest candidate can be reviewed. A successful refresh advances the report revision and evidence reference,
survives restart, unlocks editing and export, and never rewrites authored text or composition.
The confirmation action keeps its name while the review is busy and announces refresh progress beside the
controls, so a screen reader and a sighted user receive the same operation state.

## Move between a report and its source

A saved session report offers **View source session** when its exact current session is available. A saved
question or exploration report offers **View source comparison** when its exact comparison query remains
coherent. FitFreed opens that specific session or reruns those specific periods directly into the result-first
answer, including a bounded period with no sessions; it does not send you to a generic training page or make
you resubmit an editing form. Use **Back to report** to reopen the same saved report. Keyboard focus moves to the
opened session, comparison result, or report heading so the location change is explicit without requiring a
pointer.

An existing narrative-only blank-origin report has no source action because it began from authored content.
If referenced evidence is unavailable, FitFreed also omits the action instead of substituting a different
session or query.
When a report is being created directly from a session or comparison, **Back to the session** or **Back to
the comparison** returns to the already-mounted workspace and its initiating control; that temporary return
path is not persisted in the report.

## Review and export

1. Open a current saved report in **Preview** and select **Review and export**. The review temporarily
   replaces the preview rather than appearing beneath the editor.
2. Read the complete content boundary. It includes only the applicable recorded session summary, selected
comparison totals, findings, chart shapes, exact tables, coverage notices, your title, any optional commentary,
source attribution, definition metadata, and reviewed route shapes. Exact training samples remain excluded.
3. For a session report whose definition permits heart-rate context, decide whether this individual export
should retain it. Review may remove sensitive content but cannot add content excluded by the definition.
4. Review every available route independently. You may omit its geometry or increase endpoint protection for
this export; you cannot reduce the protection saved in the definition.
5. Select **Choose destination and export**, then choose a local HTML file through the operating-system dialog. After a destination is accepted, that action keeps its name and the review announces export progress while **Cancel export** remains available.

The result is one deterministic, self-contained HTML file with embedded styling and no script, external
image, font, stylesheet, telemetry, or network request. Analytical charts use CSS-only shapes with a visible
exact table; values from different imported sources remain separate, missing measurements stay explicit, and
descriptive findings do not claim causation or advice. Route blocks contain only a normalized local SVG shape
and declared privacy metadata: recorded latitude, longitude, altitude, and elapsed point values are not
written to the HTML. Session sport identity keeps the same provider-neutral symbol and visible personal or
recognized localized label shown in FitFreed; ambiguous candidates are never selected and no technical family
code or opaque provider identifier replaces a trustworthy label. The file can be opened
independently in an ordinary browser, printed, or shared at the
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
