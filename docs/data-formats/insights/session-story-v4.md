# Composed Session Story Version 4

## Status and boundary

Version 4 retains the complete revision-coherent session, structure, route, signal, zone, composition,
role, exact-evidence, provenance, absence, ordering, performance, and failure semantics from
[version 3](session-story-v3.md). It changes only the sport identity embedded in the session, exercises, and
source structure.

`query_session_story` keeps
[`session-story-query-v1.schema.json`](../../../schemas/session-story-query-v1.schema.json) and returns
[`session-story-v4.schema.json`](../../../schemas/session-story-v4.schema.json) with `schemaVersion` 4.
Every embedded sport conforms to [training sport identity version 1](training-sport-identity-v1.md) and is
resolved under the story's exact `snapshotRef`.
The top-level `session`, optional source `structure`, and composed `exercises` each embed the same-version
`sport`, including `recognitionCandidateCount`.

Catalogue activation, mapping enrichment, and personal classification change training discovery revision.
An older story therefore fails as stale instead of combining a route, signals, ranges, or source structure
with another identity revision. Provider identifiers, ambiguous candidate labels, and inferred names never
cross the story boundary. Personal labels remain untranslated and source recognition remains independently
available.

Changing any retained version-3 composition behavior, `schemaVersion`, identity embedding, or snapshot rule
requires a new story version.
