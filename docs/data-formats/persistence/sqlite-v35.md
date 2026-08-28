# SQLite Schema Version 35

## Migration

Schema version 35 applies `0035_training_discovery_workspace_v3.sql` atomically after version 34. It rebuilds
only `training_discovery_workspace` so its closed `workspace_version` constraint accepts versions 1, 2, and 3.
The row shape, column constraints, indexes, foreign-key behavior, and every canonical fitness-data table remain
unchanged. An interruption rolls back the complete rebuild and retains a valid version-34 library.

The rebuilt `training_discovery_workspace` retains the singleton `id`, `workspace_version`, `snapshot_ref`,
`from_date`, `through_date`, `sport_refs_json`, `required_measurements_json`, `text_filter`, `sort_code`,
`page_offset`, `page_limit`, `view_code`, `calendar_month`, `calendar_day`, `selected_session_refs_json`,
`open_session_ref`, and `updated_at_utc` columns. Their version-30 nullability, syntax, bounds, and cross-field
constraints remain unchanged; only the accepted workspace-version set grows to include three.

## Lazy workspace conversion

Opening a stored version-1 or version-2 training-discovery workspace converts its sport filters to the
[version-3 workspace contract](../insights/training-discovery-workspace-v3.md) in one local write. A legacy
source-profile capability or combined source-profile filter expands to every current exact or unresolved
collection represented by that profile. A current collection filter is retained. Unknown filters are removed,
duplicates are removed deterministically, and the remaining workspace state is preserved.

This conversion changes disposable restoration state only. It does not rewrite imported sessions,
provider evidence, personal sport classifications, reports, provenance, or portable exports.

## Compatibility

Versions 1 through 35 form the supported migration chain. A higher `PRAGMA user_version` remains unsupported
and is never opened as though it were an older library.
