# Training-Session Structure Read Model Version 3

Version 3 retains every structure, ordering, absence, validation, pagination-independent, snapshot, and privacy rule
from [version 2](training-session-structure-v2.md). It adopts
[training sport identity version 3](training-sport-identity-v3.md) for each exercise.

`query_training_session_structure` still accepts the version-1 query and returns
[`training-session-structure-v3.schema.json`](../../../schemas/training-session-structure-v3.schema.json).
Exact exercise recognition has null fallback classification capability. A source-profile remainder classification is
explicitly scoped and cannot absorb exact exercise evidence.

Changing structure behavior, embedded sport identity, or snapshot coherence requires a new response version.
