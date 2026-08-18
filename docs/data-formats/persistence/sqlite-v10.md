# SQLite Persistence Schema Version 10

## Status and boundary

Version 10 extends the immutable [version 9 schema](sqlite-v9.md) by replacing the locale-only preference row with one versioned application-preference set. The set owns presentation choices that must be read, validated, saved, reset, backed up, and restored atomically. It remains local implementation state: it is not canonical fitness information and is excluded from the portable fitness contract.

SQLite `PRAGMA user_version` stores value 10 after migration. New libraries apply every immutable migration through [`0010_application_preferences.sql`](../../../src-tauri/migrations/0010_application_preferences.sql) in one transaction. Existing version 9 libraries apply only version 10. An error or injected interruption rolls back the rename, added columns, and version marker together while preserving the version 9 locale row.

## `application_preference`

The migration renames `locale_preference` to `application_preference`, preserving the singleton identity, locale, and update timestamp. It then adds the preference-contract version, appearance, and content zoom with safe defaults. The table contains at most one row; `id` is fixed to 1. Absence of the row means the application must create and persist one complete default set before revealing the ordinary interface.

| Column | Type and optionality | Contract |
|---|---|---|
| `id` | Required integer | Singleton identity fixed to 1. |
| `preference_version` | Required integer | Application preference contract version, currently fixed to 1. |
| `locale` | Required text | Complete supported locale tag: `en-US` or `es-ES`. |
| `appearance` | Required text | One of `system`, `light`, or `dark`. |
| `content_zoom_percent` | Required integer | Inclusive percentage from 100 through 200. The current interface offers 100, 125, 150, 175, and 200. |
| `updated_at_utc` | Required text | SQLite-generated UTC timestamp for the latest atomic save. It is operational metadata and does not affect preference meaning. |

The database constraints reject invalid persisted values. The Rust application boundary independently validates the complete record, including its version and exact locale. A missing record initializes safe defaults using the first supported operating-system language, with `en-US` fallback. An obsolete or otherwise invalid complete record is replaced atomically with safe defaults and returned with a `recovered` status so the interface can disclose the recovery. An explicit reset uses the same defaulting rule.

Saving one field never preserves an unvalidated value from another field. The application submits and persists the complete set in one operation. Previewing a setting does not write it; leaving Settings discards the preview. A failed save or reset restores the previously persisted set in the visible interface.

## Ownership and privacy

Preferences stay in the local FitFreed library and are included in whole-library backup and update recovery. They are never added to a provider export, canonical observation, portable fitness export, update request, release diagnostic, or usage event. Locale is read locally when selecting authenticated release text; it is not disclosed to the update endpoint.

## Verification obligations

Migration tests protect version 9 preservation, interruption rollback, retry, the exact version marker, and constraints. Persistence and application tests protect first-run initialization, complete-set validation, atomic save, restart, obsolete-value recovery, reset, update-check locale selection, and update-recovery backup preservation. Presentation and packaged tests protect pre-shell application, preview, discard, save, failure restoration, restart, light/dark/system behavior, 100% and 200% zoom, both locales, and accessibility.
