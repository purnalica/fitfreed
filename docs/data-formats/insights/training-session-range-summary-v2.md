# Training-Session Range Summary Read Model Version 2

Version 2 retains every coordinate, ownership, timing, distance, direction, measurement, boundary, coverage,
source-range, independent-evidence, limitation, revision, and failure rule from
[version 1](training-session-range-summary-v1.md). It changes only nullable `exercise.sport` to
[training sport identity version 1](training-sport-identity-v1.md).

`query_training_session_range_summary` keeps its version-1 request and now returns
[`training-session-range-summary-v2.schema.json`](../../../schemas/training-session-range-summary-v2.schema.json).
The response retains `range` and nullable `exercise`; its embedded `sport` adds
`recognitionCandidateCount` through the shared identity contract. Identity is resolved under the exact
`snapshotRef`; provider identifiers and ambiguous candidate names do not
cross the boundary. A recognition or personal-classification change invalidates the old snapshot without
changing the personal range.

Changing retained range-result behavior or sport-identity embedding requires a new response version.
