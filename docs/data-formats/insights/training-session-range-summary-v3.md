# Training-Session Range Summary Read Model Version 3

Version 3 retains every coordinate, coverage, measurement, omission, ordering, revision, and error rule from
[version 2](training-session-range-summary-v2.md). It adopts
[training sport identity version 3](training-sport-identity-v3.md) for the owning exercise.

`query_training_session_range_summary` retains its version-1 query and returns
[`training-session-range-summary-v3.schema.json`](../../../schemas/training-session-range-summary-v3.schema.json).
Exact sport evidence and source-profile fallback classification remain separate in the embedded identity.

Changing range-summary behavior, embedded sport identity, or revision coherence requires a new response version.
