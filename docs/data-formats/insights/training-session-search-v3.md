# Training-Session Search Read Model Version 3

## Status and boundary

Normative provider-neutral session discovery contract. Version 3 retains pagination, sorting, measurement
filters, text search, source-separated summaries, calendar projection, ordered selection, numeric encoding,
snapshot coherence, and errors from [version 2](training-session-search-v2.md). It adopts
[training sport identity version 2](training-sport-identity-v2.md) and exact represented-session filters.

`query_training_sessions` accepts
[`training-session-search-query-v2.schema.json`](../../../schemas/training-session-search-query-v2.schema.json)
and returns
[`training-session-search-v3.schema.json`](../../../schemas/training-session-search-v3.schema.json).
`query_training_session_selection` returns
[`training-session-selection-v3.schema.json`](../../../schemas/training-session-selection-v3.schema.json).
Calendar requests use
[`training-session-calendar-query-v2.schema.json`](../../../schemas/training-session-calendar-query-v2.schema.json);
the response remains version 1 because it contains no embedded sport identity.

## `sportRefs` filter meaning

Each `sportRefs` value is a `sessionFilterRef` published by training-sports version 3 or Library Home version
6. It selects the exact represented collection, including exact recognized, exact ambiguous, unresolved
remainder, unavailable, or personally overridden groups. Values are opaque, combine through logical OR,
and still combine with all other filter families through logical AND. A personal-classification `sportRef`
is not a session filter and fails as unknown.

Embedded sessions use identity version 2, so exact recognition can coexist with null `sportRef` and null
`classification` when the source session has no classifiable profile. Text search continues to match only
personal labels and resolved provider-neutral names or families. Raw identifiers, provenance capabilities,
and ambiguous candidates are never searched or exposed.

Changing filter identity, selection scope, embedded identity, or any retained discovery behavior requires a
new contract version.
