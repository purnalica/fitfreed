# Training-Session Search Read Model Version 4

## Status and boundary

Normative provider-neutral session discovery contract. Version 4 retains every query, pagination, sorting, calendar,
selection, snapshot, numeric, and error rule from [version 3](training-session-search-v3.md). It adopts
[training sport identity version 3](training-sport-identity-v3.md) and the exact collections published by
[training sports version 4](training-sports-v4.md).

`query_training_sessions` retains the version-2 query and returns
[`training-session-search-v4.schema.json`](../../../schemas/training-session-search-v4.schema.json).
`query_training_session_selection` returns
[`training-session-selection-v4.schema.json`](../../../schemas/training-session-selection-v4.schema.json).
Calendar query and response versions remain unchanged because the current calendar projection embeds no sport
identity.

Each `sportRefs` value is an opaque `sessionFilterRef` selecting one exact represented collection. Personal
classification capabilities are rejected as filters. Exact recognized or ambiguous sessions have no fallback
classification capability; sessions in the independently represented source-profile remainder carry the explicit
`unresolved-source-profile` scope. Saving that fallback never moves exact sessions into its filter.

Changing filter identity, represented-session scope, embedded identity, or retained discovery behavior requires a
new contract version.
