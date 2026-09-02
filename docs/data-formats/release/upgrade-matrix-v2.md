# FitFreed Upgrade Matrix Version 2

## Purpose and compatibility

Version 2 extends the release-bound application baseline vocabulary to the native package targets supported by the
multiplatform MVP. It preserves the meaning, ordering, source-schema dimension, target release, direct library
compatibility, evidence threshold, filename, media type, and failure behavior of closed
[version 1](upgrade-matrix-v1.md). [`upgrade-matrix-v2.schema.json`](../../../schemas/upgrade-matrix-v2.schema.json) is
the normative structural schema.

The format remains `org.fitfreed.upgrade-matrix`; `schemaVersion` is exactly `2`. Unknown fields and unsupported schema
versions are invalid. An existing version 1 matrix remains an immutable statement about its own target release.

## Application baselines

Each entry in `supportedApplicationBaselines` retains these fields:

| Field | Contract |
|---|---|
| `version` | Exact prior FitFreed SemVer, unique by SemVer precedence and older than `release.version`. |
| `targets` | Strictly sorted, unique package targets that passed the complete update and recovery matrix. |
| `librarySchemaVersions` | Strictly sorted, unique source schemas verified for the exact application and every named target. |

Version 2 permits `darwin-aarch64`, `darwin-x86_64`, `linux-x86_64-deb`, and `windows-x86_64-nsis`. A target appears
only after its real release-shaped predecessor and candidate have passed clean installation, update, migration,
failure recovery, restart resumption, retained-library, and package-identity evidence. Compiling or emitting a package
does not create a baseline.

For stable update channel version 3, each Debian or NSIS target produces one exact recovery declaration for the same
baseline `version` and `librarySchemaVersions`. macOS does not produce a predecessor-package declaration because its
closed recovery version 1 preserves the running application locally. An omitted, additional, or changed relationship
blocks channel generation.

## Library schemas and release evidence

`release.version`, `release.librarySchemaVersion`, and `supportedLibrarySchemaVersions` retain their version 1
contracts. Every supported source schema is positive, migration-backed, no newer than the target, and verified for
atomic opening, integrity, interruption recovery, and retry.

Release staging copies the exact source matrix as `supported-upgrades.json` and binds its bytes into the release
manifest. Package-shaped E2E and recovery-package discovery derive their complete application/version/target/schema
campaign from this document. A declaration without every required package and verification result blocks release.
