# SQLite Persistence Schema Version 11

## Status and boundary

Version 11 extends the immutable [version 10 schema](sqlite-v10.md) with one optional,
provider-neutral exploration destination. It lets a returning person resume an answerable explorer
without persisting transient filters, source identifiers, measurements, coordinates, free text,
focus targets, or scroll positions. It is local presentation-supporting state, not canonical fitness
history, a public navigation link, a report definition, or a portable fitness contract.

SQLite `PRAGMA user_version` stores value 11 after migration. New libraries apply every immutable
migration through [`0011_exploration_workspace.sql`](../../../src-tauri/migrations/0011_exploration_workspace.sql)
in one transaction. Existing version 10 libraries apply only version 11. An error or injected
interruption rolls back the table and version marker together while preserving the complete version
10 library.

## `exploration_workspace`

The table contains at most one row. Absence means that Home has no resumable exploration and remains
the returning entry point.

| Column | Type and optionality | Contract |
|---|---|---|
| `id` | Required integer | Singleton identity fixed to 1. |
| `workspace_version` | Required integer | Persisted workspace contract version, currently fixed to 1. |
| `destination` | Required text | One of `activity`, `training`, `sleep`, `recovery`, or `longitudinal`. |
| `updated_at_utc` | Required text | SQLite-generated UTC timestamp for the latest atomic save; it is not exposed as fitness history. |

The application saves a destination only after the current provider-neutral Library Home exposes an
answerable question for it. Home restores only version 1 values whose destination remains answerable
after current canonical history is queried. An obsolete, unknown, or stale row is ignored safely and
cannot hide Home. An explicit return to Home deletes the row. Future detailed workspace snapshots
require their own version and migration rather than overloading `destination`.

Database constraints reject unsupported versions, provider-specific destinations, and additional
singleton rows. The application boundary independently owns question availability and never treats a
persisted destination as authority to query unavailable data.

## Ownership, privacy, and recovery

The row stays in the local FitFreed library and is included in whole-library backup and update
recovery. It is never added to provider exports, canonical observations, portable exports, update
requests, release diagnostics, public links, or usage events. No observation-origin identifier or
provider vocabulary crosses this boundary.

## Verification obligations

Migration tests protect version 10 preservation, interruption rollback, retry, the exact version
marker, and constraints. Application and SQLite integration tests protect answerability validation,
save, restart, stale-state fallback, explicit clearing, and source-neutral values. Presentation and
packaged E2E tests protect question navigation, returning Home, and restart restoration in both
locales.
