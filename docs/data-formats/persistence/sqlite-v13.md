# SQLite Persistence Schema Version 13

## Status and migration

Schema version 13 applies `0013_training_session_discovery.sql` atomically after version 12. It adds
revision evidence and query indexes for coherent, paginated discovery over the complete training history.
Canonical sessions, classifications, provenance, and import reconciliation keep their version-12 meaning.

## Discovery revision

`training_discovery_revision` is a single-row internal sequence. Its constrained `id` is always one, and its
positive `revision` is advanced by database triggers after every
insert, update, or delete of a canonical training session or authored sport classification. A search page
derives an opaque `snapshotRef` from the current revision. Later pages present that reference; a changed
revision rejects the request instead of combining offsets from different library states.

The revision is synchronization evidence, not a canonical fact, portable identifier, event log, or user
visible count. Migration initializes it once for the complete pre-existing library. Equivalent reimports do
not touch canonical sessions and therefore do not advance it.

## Query indexes

`training_session_duration_start_identity` supports longest-first traversal with deterministic start and
identity tie-breakers. `training_session_distance_start_identity` does the same for farthest-first traversal,
with absent distance ordered after available distance. The existing start and origin/sport indexes remain the
paths for newest, oldest, date, and sport filtering.

## Lifecycle and compatibility

Migration interruption rolls back the sequence, triggers, indexes, and schema marker together. Version 12
remains a supported direct migration baseline under the release upgrade matrix. Backup and restore preserve
the revision, while presentation receives only its one-way opaque derivative.
