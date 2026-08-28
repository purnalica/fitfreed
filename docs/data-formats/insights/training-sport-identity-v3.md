# Training Sport Identity Version 3

## Status and boundary

Normative provider-neutral identity fragment for current Home, History, structure, session story, and report
read models. Version 3 retains the states, evidence precedence, locale behavior, provenance, and privacy rules
from [version 2](training-sport-identity-v2.md). JSON conforms to
[`training-sport-identity-v3.schema.json`](../../../schemas/training-sport-identity-v3.schema.json).

Every non-null `classification` now contains `scope = unresolved-source-profile`. That scope means the
classification applies only to sessions represented by the source profile that have no stronger exact-session
sport evidence. The paired opaque `sportRef` authors that fallback interpretation; it is not a collection identity,
provider identifier, or command to merge evidence.

Exact recognized or ambiguous session evidence has null `sportRef` and null `classification`, including when the
source session also refers to a classifiable profile. The independently represented source-profile remainder keeps
its classification capability. Saving or resetting that classification cannot change the exact collection's
identity, state, name, filter, or coverage.

A future deliberate relationship that unifies sport identities is a separate user-authored aggregate and operation.
It is not represented by `scope`, `sportRef`, a shared family, or an equal display label in this version.

Changing classification scope, exact-evidence precedence, nullable pairing, identity state, locale fallback,
provenance, or privacy requires a new identity version and new versions of every embedding response.
