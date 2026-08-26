# Report Workflow Version 6

Version 6 retains report definition version 4, creation, update, refresh, removal, export authorization,
result-first library behavior, analytical evidence, privacy, staleness, concurrency, and errors from
[version 5](report-v5.md). It updates only disposable projections that embed session sport identity.

`list_report_library` returns
[`report-library-v3.schema.json`](../../../schemas/report-library-v3.schema.json), and `resolve_report`
returns [`report-resolution-v6.schema.json`](../../../schemas/report-resolution-v6.schema.json). Session
subjects and resolved sessions use [training-session search version 3](training-session-search-v3.md) and
training sport identity version 2, including exact recognition without an invented classification
capability.

Recognition is still resolved at the reviewed `resolvedSnapshotRef`. Personal identity wins, ambiguous
evidence is not selected, and raw provider identifiers or opaque capabilities are not rendered. HTML output
uses [self-contained report HTML version 6](../portable/report-html-v6.md); its independent output version
adds bounded static analytical SVG without changing workflow or definition semantics.

Changing workflow behavior, identity projection, refresh authority, or privacy requires a new report
workflow version.
