# Training-Discovery Workspace Version 3

## Status and purpose

Normative disposable presentation-state contract used by `load_training_discovery_workspace`,
`save_training_discovery_workspace`, and `clear_training_discovery_workspace`. Version 3 retains every
field, restoration rule, stale-snapshot rule, selection limit, and error from
[version 2](training-discovery-workspace-v2.md). JSON conforms to
[`training-discovery-workspace-v3.schema.json`](../../../schemas/training-discovery-workspace-v3.schema.json).

`version` is three. `sportRefs` stores exact `sessionFilterRef` values with the meaning defined by
[training-session search version 4](training-session-search-v4.md). A filter represents either one exact
recognized collection or the unresolved remainder of one source profile. Personal classification does not
change either filter identity or combine those collections. All other fields retain their preceding meaning.
A workspace remains local convenience state, never canonical fitness data or portable evidence.

SQLite schema 35 lazily converts stored version-1 and version-2 workspaces. A version-1 source-profile
capability and a version-2 combined source-profile filter each expand to every current collection represented
by that source profile. An already current exact or remainder filter is retained, and a value with no current
collection is removed. Ordering is deterministic and duplicates are removed. Date, text, measurement, sort,
page, calendar, selection, open-session, and snapshot state are preserved, after which normal stale-snapshot
validation applies.

Changing filter capability meaning, migration behavior, restoration order, selection limits, or errors
requires another workspace version and persistence migration.
