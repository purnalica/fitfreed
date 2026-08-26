# Composed Session Story Version 5

Version 5 retains all structure, route, signal, zone, composition, exact-evidence, provenance, absence,
ordering, performance, and failure behavior from [version 4](session-story-v4.md). It adopts the version-3
session projection and [training sport identity version 2](training-sport-identity-v2.md).

`query_session_story` still accepts the version-1 query and returns
[`session-story-v5.schema.json`](../../../schemas/session-story-v5.schema.json) with `schemaVersion` 5. The
top-level `session` can therefore carry exact recognized or ambiguous evidence with null `sportRef` and null
`classification`. Source exercise structure retains its existing independently resolved identity contract.

Snapshot coherence, personal precedence, provider privacy, and stale-result behavior are unchanged. Changing
composition behavior, embedded session identity, or snapshot rules requires a new story version.
