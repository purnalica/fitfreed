# Session Report Read Models Version 5

Version 5 retains the complete compatibility resolver, route, sensitivity, limitation, provenance,
revision, staleness, and failure behavior from [version 4](session-report-v4.md). It adopts
[training-session search version 3](training-session-search-v3.md) and training sport identity version 2.

The retained resolver returns
[`session-report-resolution-v5.schema.json`](../../../schemas/session-report-resolution-v5.schema.json).
Its request and definition schemas remain unchanged. The resolved `sport` can represent exact recognized or
ambiguous evidence without a source-profile classification capability. Recognition remains bound to
`resolvedSnapshotRef`; personal meaning wins and provider identifiers never cross the boundary.

Current result-first reports use [report workflow version 6](report-v6.md). Changing retained behavior or
identity embedding requires a new session-report response version.
