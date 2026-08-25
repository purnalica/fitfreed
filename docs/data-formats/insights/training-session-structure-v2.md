# Training-Session Structure Read Model Version 2

Version 2 retains every request, snapshot, exercise, lap, pause, ordering, missing-value, error, and
provider-neutral structure rule from [version 1](training-session-structure-v1.md). It changes only each
exercise's embedded sport to [training sport identity version 1](training-sport-identity-v1.md).

`query_training_session_structure` keeps its version-1 request and now returns
[`training-session-structure-v2.schema.json`](../../../schemas/training-session-structure-v2.schema.json).
The response retains `snapshotRef`, `sessionRef`, nullable `structure`, and nullable `exercises` with their
version-1 meaning. Every `sport` contains `sportRef`, exact `state`, `classification`, `recognition`, and
`recognitionCandidateCount` from the same accepted `snapshotRef`. Catalogue or personal identity changes
make an earlier snapshot stale; the response never combines versions and never displays provider identifiers.

Changing retained structure behavior or sport-identity embedding requires a new response version.
