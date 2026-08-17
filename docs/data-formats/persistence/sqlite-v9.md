# SQLite Persistence Schema Version 9

## Status and boundary

Version 9 extends the immutable [version 8 schema](sqlite-v8.md) with the provider-neutral local state required to reject authenticated update replay and retain update-notification choices across restarts. It stores no provider export, fitness observation, endpoint, public or private key, package URL, package signature, package bytes, signed payload, response body, installation identifier, or usage event.

SQLite `PRAGMA user_version` stores value 9 after migration. New libraries apply every immutable migration through [`0009_update_state.sql`](../../../src-tauri/migrations/0009_update_state.sql) in one transaction. Existing version 8 libraries apply only version 9. An error or injected interruption rolls back the `update_state` table and version marker together while preserving all version 8 library content.

The update state is implementation data rather than canonical fitness data or a portable-export contract. It is included in a complete SQLite library backup. Restoring an older whole-library copy can therefore restore an older replay high-water mark; the bounded signed validity interval remains the private-alpha mitigation documented by [ADR 0008](../../architecture/decisions/0008-authenticate-update-policy-above-tauri.md).

## `update_state`

The table contains at most one row. `id` is fixed to 1. Absence of the row represents the default state: no authenticated snapshot has been accepted and no candidate has been dismissed or postponed.

| Column | Type and optionality | Contract |
|---|---|---|
| `id` | Required integer | Singleton identity fixed to 1. |
| `trusted_sequence` | Optional integer | Last accepted signed sequence, from 1 through JavaScript's exact-integer maximum 9,007,199,254,740,991. |
| `trusted_payload_sha256` | Optional text | Lowercase 64-character SHA-256 digest of the exact verified payload bytes. |
| `trusted_release_version` | Optional text | SemVer candidate bound to the accepted sequence and digest, limited to 255 characters. |
| `dismissed_version` | Optional text | SemVer candidate hidden from scheduled notification; it must equal `trusted_release_version`. |
| `postponed_version` | Optional text | SemVer candidate whose scheduled notification is delayed; it must equal `trusted_release_version`. |
| `postponed_until` | Optional text | Bounded RFC 3339 instant after which scheduled notification resumes. It exists exactly when `postponed_version` exists. |
| `updated_at_utc` | Required text | SQLite-generated UTC timestamp for the most recent atomic write. It is operational metadata and never controls signed policy. |

`trusted_sequence`, `trusted_payload_sha256`, and `trusted_release_version` are either all null or all present. Dismissal and postponement are mutually exclusive and cannot exist without the matching trusted release. The Rust storage boundary additionally validates SemVer, RFC 3339, exact lowercase digest syntax, and the safe sequence range both before writing and after reading.

## State transitions

A newly authenticated higher sequence atomically replaces the trusted tuple and clears the prior dismissal or postponement. Re-reading the same sequence and digest is idempotent. Replay, equivocation, malformed persisted state, or an untrusted channel response does not advance or clear the row.

An explicit dismissal writes only `dismissed_version`. An explicit postponement writes only the matching `postponed_version` and `postponed_until`. Manual checks continue to expose an authenticated candidate without deleting either choice; the application policy, not SQLite, decides whether a scheduled notification or install action is available.

Pending installation, preserved application and library paths, watchdog ownership, success confirmation, and emergency restoration are not represented by SQLite version 9. They live in the separate filesystem-backed [update recovery version 1 contract](../release/update-recovery-v1.md), outside the portable fitness model and SQLite migration sequence.

## Verification obligations

Migration tests protect clean creation, version 8 preservation, interruption rollback, recovery, and the exact version marker. Persistence and application-integration tests protect default state, full-state restart and backup, SemVer and digest rejection, mutual exclusion, application-driven postponement and dismissal, idempotent accepted state, and lower-sequence replay without high-water or preference loss.
