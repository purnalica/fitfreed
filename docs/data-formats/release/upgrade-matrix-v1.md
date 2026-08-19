# FitFreed Upgrade Matrix Version 1

## Purpose and authority

The FitFreed upgrade matrix is the release-bound compatibility statement for one application candidate. It keeps supported application-package upgrades separate from direct SQLite library compatibility while binding both to the same target application and schema. This document is the normative human-readable contract. [`upgrade-matrix-v1.schema.json`](../../../schemas/upgrade-matrix-v1.schema.json) is its structural JSON Schema, and [`release/upgrade-matrix.json`](../../../release/upgrade-matrix.json) is the current candidate instance.

The matrix is not update metadata, an updater signature, a database backup, or proof that a declared path passed. Release gates supply the evidence and bind the exact matrix bytes into the release manifest.

## Encoding and compatibility

- Release filename: `supported-upgrades.json`.
- Source filename: `release/upgrade-matrix.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.upgrade-matrix`.
- Schema selector: integer `schemaVersion`; the only current value is `1`.
- Unknown top-level or nested properties are invalid under version 1.
- Collections are ordered ascending by version and contain no duplicates.

A consumer must reject an unsupported schema version. A future incompatible shape requires a new versioned schema and normative document. An old matrix remains an immutable statement about its own target release.

## Target release

`release.version` is the exact FitFreed SemVer shared by npm, Tauri, and Cargo. `release.librarySchemaVersion` is the exact SQLite `PRAGMA user_version` compiled into that application. Both values describe the target, never the source of an upgrade.

## Supported application baselines

`supportedApplicationBaselines` contains actual prior FitFreed releases accepted for in-application update to the target.

| Field | Contract |
|---|---|
| `version` | Exact prior FitFreed release SemVer. It must be older than the target and occur once. |
| `targets` | Sorted package targets whose preserved source package has passed the release update matrix. Version 1 permits `darwin-aarch64` and `darwin-x86_64`. |
| `librarySchemaVersions` | Sorted source-library schemas verified with that exact prior application and every declared target. |

A baseline requires its real release-shaped package plus clean update, migration, replacement-failure recovery, retained-library, and restart evidence. A development build, Git revision, schema number, SemVer range, or synthetic package whose version was overridden from the target source does not create an application baseline.

The current 0.1.0 list is empty because it is the first intended private alpha and there is no prior FitFreed release. Empty is the only truthful first-release value.

## Supported library schemas

`supportedLibrarySchemaVersions` contains schemas the target application can open directly, independent of which application last wrote the library. Every value is positive, sorted, unique, no newer than the target schema, and backed by an immutable migration file and executable storage evidence.

For a value below the target, opening the library applies every later immutable migration atomically, retains valid existing information, advances `PRAGMA user_version` to the target, and passes SQLite integrity checking. The target value is the no-op compatibility case. Schema 0 means creation of a new library and is not a retained compatibility baseline. A schema newer than the target is rejected without downgrade or mutation.

The current target supports schemas 1 through 18. This does not assert that eighteen application releases existed.

## Release and test obligations

Repository checks reject disagreement among the matrix, package versions, compiled schema constant, and contiguous migration files. Storage integration tests derive their cases from the declared library list and verify success, integrity, atomic interruption rollback, and retry. Release staging copies the exact source document as `supported-upgrades.json`; the release manifest records its size and SHA-256 digest. Integrity verification rejects alteration or an undeclared matrix.

When `supportedApplicationBaselines` becomes non-empty, packaged update E2E must derive every source-version, target, package-target, and library-schema combination from this document. A declaration without its complete evidence blocks the release.
