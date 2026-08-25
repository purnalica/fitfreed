# Report Workflow Version 5

## Status and boundary

Version 5 retains the version-4 report definition, creation, update, refresh, removal, export authorization,
result-first library, multi-origin analytical evidence, privacy, staleness, concurrency, and error semantics
from [version 4](report-v4.md). Report definitions remain version 4 because their authored meaning and block
grammar did not change. Version 5 updates the disposable result projections that embed sport identity.

`list_report_library` now returns
[`report-library-v2.schema.json`](../../../schemas/report-library-v2.schema.json). `resolve_report` now
returns [`report-resolution-v5.schema.json`](../../../schemas/report-resolution-v5.schema.json). Every
session subject and resolved session conforms to
[training sport identity version 1](training-sport-identity-v1.md). Existing request, definition, create,
update, refresh, remove, and export schemas remain version 4 or version 1 as documented by the preceding
workflow.
The bounded library places that identity at `subject.sport`; resolved sessions expose the same
`recognitionCandidateCount` contract.

Recognition is resolved at the report's reviewed `resolvedSnapshotRef`. A personal identity wins without
deleting source recognition. Ambiguous evidence is reported as unresolved rather than selecting a candidate.
Raw provider identifiers, name keys, catalogue hierarchy, and opaque capability values are not visible
output. Catalogue activation can make a saved report stale; it never refreshes accepted evidence without the
existing deliberate review action.

HTML output follows [self-contained report HTML version 5](../portable/report-html-v5.md). Changing any
retained workflow rule, identity projection, refresh authority, or privacy behavior requires a new report
workflow version.
