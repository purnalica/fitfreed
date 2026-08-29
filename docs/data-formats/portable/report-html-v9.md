# Self-Contained Report HTML Version 9

Version 9 retains the deterministic, local, self-contained, accessible, privacy-reviewed output behavior from
[version 8](report-html-v8.md). It adopts [report workflow version 12](../insights/report-v12.md) and records the exact
effective parameters used for a comparison export.

The output MIME type remains `text/html`.

The root `<main>` carries `data-fitfreed-output-version="9"`; the authored definition version remains independently
recorded in `data-fitfreed-report-version`. When the report contains a training comparison, its header identifies the
effective baseline and comparison dates. The containing value uses `data-fitfreed-run-parameter-origin` with
`data-fitfreed-run-parameter-origin="saved-default"` or
`data-fitfreed-run-parameter-origin="transient-override"`. The semantic origin values are `saved-default` and
`transient-override`. Localized text states whether those dates are saved defaults or temporary values that did not
change the saved report.

Export authorization rejects missing or inconsistent run-parameter evidence. The saved default must equal the query
in the durable definition, comparison evidence ranges must equal the effective query, and a `saved-default` origin
must have identical saved and effective values. Reports without comparison evidence carry no run-parameter metadata.

Changing deterministic structure, run-parameter meaning or provenance, privacy review, numeric evidence, or output
metadata requires a new output version.
