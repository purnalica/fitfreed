# Training Sports Read Model Version 4

## Status and boundary

Normative provider-neutral complete-library sport discovery contract. Version 4 retains coverage, ordering,
concurrency, privacy, and exact represented-session filter behavior from
[version 3](training-sports-v3.md), and adopts
[training sport identity version 3](training-sport-identity-v3.md).

`query_training_sports` returns
[`training-sports-v4.schema.json`](../../../schemas/training-sports-v4.schema.json).
`save_training_sport_classification` still accepts the version-1 command and returns
[`saved-sport-classification-v4.schema.json`](../../../schemas/saved-sport-classification-v4.schema.json).

## Stable represented collections

Every item keeps a required opaque `sessionFilterRef` that selects exactly its summarized sessions. Exact recognized
and ambiguous evidence remains separate from the source-profile remainder before and after personal classification.
An exact collection therefore carries null `sportRef` and null `classification`; only the remainder exposes the
`unresolved-source-profile` capability.

Saving a personal family or label changes only that remainder to `personally-overridden`. Its existing
`sessionFilterRef`, coverage, and represented sessions stay stable. Exact collections keep their recognition,
coverage, and filter identities. Equal names or families do not merge collections. This contract has no implicit or
explicit unify operation.

Reimporting identical evidence preserves every collection identity. Evidence or mapping changes advance discovery
coherence and may add or revise exact collections without deleting personal meaning. Changing grouping,
classification scope, filter meaning, coverage, ordering, state resolution, or privacy requires a new response
version.
