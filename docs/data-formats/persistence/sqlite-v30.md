# SQLite Persistence Schema Version 30

## Status and migration

Schema version 30 applies `0030_training_discovery_workspace_v2.sql` atomically after version 29. It changes
only the disposable training-discovery workspace table so the application can distinguish legacy sport
classification capabilities from the represented-session filter capabilities introduced by History version 3.
Canonical fitness observations, source evidence, personal classifications, reports, and import provenance do
not change.

The migration rebuilds `training_discovery_workspace`, preserves every existing row byte-for-byte, and accepts
workspace versions 1 and 2. An interruption rolls back to the complete version-29 table. Versions 1 through 30
remain direct supported baselines.

The rebuilt table retains the preceding columns and constraints: singleton `id`, `workspace_version`,
`snapshot_ref`, nullable `from_date` and `through_date`, `sport_refs_json`,
`required_measurements_json`, nullable `text_filter`, `sort_code`, `page_offset`, `page_limit`, `view_code`,
nullable `calendar_month` and `calendar_day`, `selected_session_refs_json`, nullable `open_session_ref`, and
`updated_at_utc`. Only the workspace-version constraint changes, from exactly one to either one or two.

## Lazy version-1 workspace conversion

A version-1 workspace stores `sportRefs` using the former source-profile classification identity. On first
load, each still-current value is mapped to every represented session collection backed by that profile. A
value already equal to a current session-filter capability is retained. Values with no current collection are
dropped because a workspace is disposable navigation state, not user data. All other filters, page intent,
calendar state, ordered selection, open session, and snapshot reference are preserved.

The converted row is written back as version 2 before it crosses the application boundary. The existing
snapshot validation then handles stale evidence normally. New writes always use version 2; a corrupt or
unsupported row still fails closed.

## Privacy and integrity

Both capability kinds remain opaque `sport-` digests. Migration does not expose provider identifiers or infer
sport meaning. The rebuilt table retains its singleton identity, date, pagination, view, selection, and text
constraints and participates in normal backup, integrity checking, rollback, and library replacement.
