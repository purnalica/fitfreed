# Report Workflow Version 9

## Scope

Version 9 retains every definition, example, duplication, resolution, refresh, removal, privacy, and export rule from
[version 8](report-v8.md). It adopts [training sport identity version 3](training-sport-identity-v3.md) without
changing report definition version 5 or its mutations.

`list_report_library` returns
[`report-library-v5.schema.json`](../../../schemas/report-library-v5.schema.json), and `resolve_report` returns
[`report-resolution-v8.schema.json`](../../../schemas/report-resolution-v8.schema.json). Session compatibility
resolution uses [`session-report-resolution-v6.schema.json`](../../../schemas/session-report-resolution-v6.schema.json).
All requests retain the schemas listed by version 8. HTML export uses
[self-contained output version 8](../portable/report-html-v8.md).

A report subject or resolved session with exact recognition has no source-profile classification capability. A
source-profile remainder classification carries its explicit scope. Classification changes can stale evidence but do
not merge the report subject with another represented collection, alter the saved definition, or rewrite a prior
export. Duplication preserves the saved subject and source revision without inventing a unification relationship.

Changing embedded identity, report subject meaning, resolution coherence, or output semantics requires a new
workflow version.
