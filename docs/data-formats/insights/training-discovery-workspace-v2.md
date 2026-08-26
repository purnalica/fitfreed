# Training-Discovery Workspace Version 2

## Status and purpose

Normative disposable presentation-state contract used by `load_training_discovery_workspace`,
`save_training_discovery_workspace`, and `clear_training_discovery_workspace`. Version 2 retains every
field, restoration rule, stale-snapshot rule, selection limit, and error from
[version 1](training-discovery-workspace-v1.md). JSON conforms to
[`training-discovery-workspace-v2.schema.json`](../../../schemas/training-discovery-workspace-v2.schema.json).

`version` is two. `sportRefs` now stores exact `sessionFilterRef` values with the meaning defined by
[training-session search version 3](training-session-search-v3.md). All other fields retain their preceding
meaning. A workspace remains local convenience state, never canonical fitness data or portable evidence.

SQLite schema 30 lazily converts a stored version-1 workspace. Each former profile capability expands to
all current represented collections backed by that profile; an already current filter is retained; a value
with no current collection is removed. Ordering is deterministic and duplicates are removed. Date, text,
measurement, sort, page, calendar, selection, open-session, and snapshot state are preserved, after which
normal stale-snapshot validation applies.

Changing filter capability meaning, migration behavior, restoration order, selection limits, or errors
requires another workspace version and persistence migration.
