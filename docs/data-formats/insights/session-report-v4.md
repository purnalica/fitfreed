# Session Report Read Models Version 4

Version 4 retains the complete definition-version-3 compatibility resolution, route, sensitivity,
limitation, provenance, revision, staleness, and failure behavior from
[version 3](session-report-v3.md). It changes only the resolved session's sport to
[training sport identity version 1](training-sport-identity-v1.md).

The retained session-report resolver now returns
[`session-report-resolution-v4.schema.json`](../../../schemas/session-report-resolution-v4.schema.json).
Its request and definition schemas remain unchanged. Recognition is resolved under
`resolvedSnapshotRef`; personal meaning wins, ambiguous candidates are not selected, and raw provider
identifiers never appear.
The resolved `sport` shape is shared with
[`training-session-search-v2.schema.json`](../../../schemas/training-session-search-v2.schema.json) and
includes `recognitionCandidateCount`.

This compatibility surface does not define new report composition. Current result-first reports use
[report workflow version 5](report-v5.md). Changing retained behavior or identity embedding requires a new
session-report response version.
