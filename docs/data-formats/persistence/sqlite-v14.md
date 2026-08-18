# SQLite Persistence Schema Version 14

## Status and migration

Schema version 14 applies `0014_training_discovery_workspace.sql` atomically after version 13. It adds one
optional, replaceable presentation workspace. Canonical fitness facts, import provenance, reconciliation,
sport classification, and discovery revision retain their version-13 meaning.

## `training_discovery_workspace`

The table has at most one row. Its constrained `id` is one and `workspace_version` is one. `snapshot_ref`
records the opaque discovery snapshot used by the last coherent UI state. Optional `from_date` and
`through_date`, `sport_refs_json`, `required_measurements_json`, optional `text_filter`, and `sort_code`
preserve applied search criteria. `page_offset` is constrained to a non-negative multiple of 25 and
`page_limit` is constrained to the presentation contract's fixed value of 25.

`view_code` distinguishes `chronology` and `calendar`. Optional `calendar_month` and `calendar_day` are absent
for chronology; a calendar always has a month and may have a selected day. `selected_session_refs_json`
preserves ordered comparison capabilities, while optional `open_session_ref` identifies the open detail.
`updated_at_utc` is operational replacement evidence, not user fitness data or a canonical event timestamp.

Arrays use JSON only inside this private implementation schema. They are decoded into typed values and
validated against the versioned workspace contract before use. The row contains opaque,
domain-separated SHA-256-derived capabilities, never canonical `origin_id`, provider identity, source sport
value, or source session identity.

## Lifecycle and compatibility

Saving replaces the single row atomically. Loading validates JSON, codes, bounds, opaque references, view
consistency, and workspace version before presentation receives it. Clearing deletes only this row. Import,
reimport, backup, restore, and canonical reconciliation do not mutate it; a stale `snapshot_ref` is handled by
the application restoration contract.

Migration interruption rolls back the table and schema marker together. Version 13 remains a supported
direct baseline in the release upgrade matrix. Backup and restore include the workspace, but portable export
does not: it remains safely disposable presentation state.
