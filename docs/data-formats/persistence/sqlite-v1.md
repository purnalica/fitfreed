# SQLite Persistence Schema Version 1

## Status and boundary

Exact implementation specification for local-library schema version 1. The SQLite file is authoritative application state but is not the stable FitFreed portable export contract. External tools may inspect it, but compatibility guarantees apply only through documented FitFreed migrations and application behavior.

SQLite `PRAGMA user_version` stores the schema version. Version 1 is created by the immutable migration asset [`0001_initial.sql`](../../../src-tauri/migrations/0001_initial.sql).

## File and transaction model

- Container: one SQLite 3 database file managed in the application data directory.
- Encoding and low-level page format: SQLite-managed; no FitFreed-specific binary envelope.
- Initial migration: `BEGIN IMMEDIATE`, execute the ordered migration asset, set `user_version` to 1, then commit.
- Failure behavior: any migration error rolls back every object created by that attempt.
- Compatibility: version 0 is accepted only when the migration DDL can create every owned object. Version 1 is current. Any other version, including a future version, is rejected without migration or downgrade.
- Import visibility: canonical observations, conflicts, and the completed operation are committed in one transaction.

## `daily_activity`

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id` | TEXT | no | Canonical `originId`; first part of the composite primary key. |
| `local_date` | TEXT | no | Canonical `localDate`; second part of the composite primary key. |
| `step_count` | INTEGER | yes | Canonical `stepCount`; database constraint rejects negative values. |
| `provenance_sha256` | TEXT | no | Lowercase hexadecimal package SHA-256 written by the importer; exactly 64 characters. |

The composite primary key is (`origin_id`, `local_date`). Enrichment updates `step_count` and `provenance_sha256`; equivalent and preserved decisions leave the row unchanged.

## `activity_conflict`

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `id` | INTEGER | no | SQLite row identifier and primary key. |
| `origin_id` | TEXT | no | Conflicting canonical origin. |
| `local_date` | TEXT | no | Conflicting canonical local date. |
| `existing_step_count` | INTEGER | yes | Value retained in canonical state; negative values are rejected. |
| `incoming_step_count` | INTEGER | yes | Competing incoming value; negative values are rejected. |
| `package_sha256` | TEXT | no | SHA-256 of the package carrying the competing value; exactly 64 characters. |

Version 1 records conflicts append-only during import. It does not yet expose conflict resolution or attach a foreign key to an import-operation row.

## `import_operation`

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `id` | INTEGER | no | SQLite row identifier and primary key. |
| `package_sha256` | TEXT | no | Package fingerprint; exactly 64 characters. |
| `completed` | INTEGER | no | Boolean constrained to 0 or 1. Version 1 persists only value 1. |
| `exact_repeat` | INTEGER | no | Boolean constrained to 0 or 1. |
| `recognized_artifacts` | INTEGER | no | Non-negative recognized daily activity artifact count. |
| `new_observations` | INTEGER | no | Non-negative new-decision count. |
| `equivalent_observations` | INTEGER | no | Non-negative equivalent-decision count. |
| `enriched_observations` | INTEGER | no | Non-negative enrichment-decision count. |
| `preserved_observations` | INTEGER | no | Non-negative preservation-decision count. |
| `conflicts` | INTEGER | no | Non-negative conflict-decision count. |

The `import_operation_package_sha256` index supports completed-package lookup by (`package_sha256`, `completed`). Every successful import attempt creates a row, including exact byte repeats.

## Backup and integrity evidence

Backups use SQLite's online backup API and are reopened through the normal query adapter. Migration rollback, import rollback, cancellation, restart-shaped reopen, reconciliation, exact repeat, and backup queryability are covered by adapter integration tests in [`../../../src-tauri/src/infrastructure.rs`](../../../src-tauri/src/infrastructure.rs).

## Known version 1 limitations

Version 1 does not yet persist operation timestamps, non-terminal or failed outcomes, provider and adapter versions, mapping versions, per-artifact provenance locators, complete artifact coverage, warnings, recovery annotations, original-artifact retention, or source-subject metadata. These are open requirements, not undocumented implicit fields. A schema change that adds them requires a new numbered migration and an updated specification in the same increment.

The database is not the user's only planned exit path. The portable FitFreed export will have a separate normative specification and compatibility lifecycle before implementation.
