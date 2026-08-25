# Training-Session Search Read Model Version 2

## Status and boundary

Normative provider-neutral session discovery contract. Version 2 retains query, sorting, calendar,
pagination, source-separated summaries, ordered selection, numeric encoding, error, and opaque capability
rules from [version 1](training-session-search-v1.md). It changes only sport identity and the corresponding
text-search scope.

`query_training_sessions` continues to accept
[`training-session-search-query-v1.schema.json`](../../../schemas/training-session-search-query-v1.schema.json)
and returns
[`training-session-search-v2.schema.json`](../../../schemas/training-session-search-v2.schema.json).
`query_training_session_selection` continues to accept its version-1 query and returns
[`training-session-selection-v2.schema.json`](../../../schemas/training-session-selection-v2.schema.json).
Calendar request and response contracts remain version 1 because they contain no sport identity.

## Sport identity and filtering

Every session embeds one `sport` value conforming to
[training sport identity version 1](training-sport-identity-v1.md): `sportRef`, `state`,
`classification`, `recognition`, and `recognitionCandidateCount`. Identity is captured in the same
`snapshotRef` as the page or ordered selection. Catalogue activation, mapping enrichment, or personal
classification invalidates that snapshot; a stale request returns `training-session-search-changed` rather
than mixing old filters with new labels.

The exact `state` values are `recognized`, `ambiguous`, `unknown`, `personally-overridden`, and
`unavailable`; their shapes and precedence are owned by the shared identity contract.

Optional `text` remains trimmed user input of one through 80 Unicode scalar values and combines with every
other filter through logical AND. Version 2 matches Unicode-lowercased personal display labels, recognized
localized names, and recognized provider-neutral family codes. It never searches raw provider identifiers,
provider name keys, opaque capabilities, provenance references, inferred vocabulary, or ambiguous
candidates. A match does not alter presentation locale or translate user-authored text.

All other session fields retain version-1 meaning: `sessionRef`, `sourceIndex`, `startedAtLocal`,
`stoppedAtLocal`, `utcOffsetMinutes`, `durationMilliseconds`, `distanceMeters`, `energyKilocalories`,
`averageHeartRateBpm`, `maximumHeartRateBpm`, and `exerciseCount`. `availableRange`, `totalCount`, `offset`,
`limit`, `nextOffset`, `summaries`, `trainingDays`, `sessionCount`, `totalDurationMilliseconds`,
`distanceSessionCount`, `totalDistanceMeters`, `energySessionCount`, `totalEnergyKilocalories`, and
`heartRateSessionCount` are unchanged.

Malformed or absent values return `invalid-training-session-search`; storage and invariant failures return
`training-session-search-failed`; neither changes canonical history. Changing any retained behavior,
identity embedding, or text-search scope requires a new contract version.
