# Composed Session Story Version 6

Version 6 retains all composition, structure, route, signal, zone, provenance, bounded-evidence, absence, ordering,
performance, and failure behavior from [version 5](session-story-v5.md). It adopts
[training-session search version 4](training-session-search-v4.md),
[training-session structure version 3](training-session-structure-v3.md), and
[training sport identity version 3](training-sport-identity-v3.md).

`query_session_story` still accepts the version-1 query and returns
[`session-story-v6.schema.json`](../../../schemas/session-story-v6.schema.json) with `schemaVersion` 6. Exact sport
recognition in the session or an exercise remains independent from any fallback classification of the corresponding
source-profile remainder.

Changing composition behavior, embedded identity, or snapshot coherence requires a new story version.
