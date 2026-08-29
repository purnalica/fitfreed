# Session Report Read Models Version 7

Version 7 retains the resolver, route, sensitivity, limitation, provenance, revision, staleness, and failure behavior
from [version 6](session-report-v6.md). It adds the resolved run-parameter evidence defined by
[report workflow version 12](report-v12.md).

The retained resolver returns
[`session-report-resolution-v7.schema.json`](../../../schemas/session-report-resolution-v7.schema.json). Its
`runParameters` contains a null `trainingComparison` when no comparison evidence was requested. Otherwise it exposes
the `savedDefault`, the `effectiveValue` used for this resolution, and either `saved-default` or
`transient-override`. Comparison ranges in the response describe the effective query, not necessarily the
definition's saved query.

Current result-first reports use report workflow version 12. Changing retained behavior, run-parameter meaning, or
identity embedding requires a new session-report response version.
