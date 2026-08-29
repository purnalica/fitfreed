# Session Report Read Models Version 6

Version 6 retains the resolver, route, sensitivity, limitation, provenance, revision, staleness, and failure behavior
from [version 5](session-report-v5.md). It adopts
[training-session search version 4](training-session-search-v4.md) and
[training sport identity version 3](training-sport-identity-v3.md).

The retained resolver returns
[`session-report-resolution-v6.schema.json`](../../../schemas/session-report-resolution-v6.schema.json). Exact sport
recognition remains independent of a fallback classification, and a non-null classification declares
`scope = unresolved-source-profile`. Provider identifiers do not cross the boundary.

Current result-first reports use [report workflow version 10](report-v10.md). Changing retained behavior or identity
embedding requires a new session-report response version.
