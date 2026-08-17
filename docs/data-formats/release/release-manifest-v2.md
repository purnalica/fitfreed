# FitFreed Release Manifest Version 2

## Purpose and authority

The FitFreed release manifest binds one staged application package to its source revision, target, storage compatibility, upgrade support, dependency inventories, and artifact digests. This document is the normative human-readable contract. [`release-manifest-v2.schema.json`](../../../schemas/release-manifest-v2.schema.json) is its machine-readable JSON Schema.

Version 2 is the current unsigned private-development manifest. It extends [version 1](release-manifest-v1.md) by requiring one digest-bound [upgrade matrix version 1](upgrade-matrix-v1.md). It remains release evidence, not a signature, legal-compliance statement, fitness-data interchange format, or publication authorization.

## Encoding and compatibility

- File name: `release-manifest.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.release-manifest`.
- Schema selector: integer `schemaVersion`; this contract requires `2`.
- Unknown top-level or nested properties are invalid.

A consumer must reject an unsupported schema version. Version 1 remains available for historical evidence, but current preparation emits only version 2.

## Release, target, application, and generator fields

Version 2 retains the version 1 meanings and closed values:

| Path | Type | Meaning |
|---|---|---|
| `release.version` | SemVer string | Version shared by npm, Tauri, Cargo, and the upgrade matrix. |
| `release.revision` | 40- or 64-character lowercase hexadecimal string | Clean Git commit used for preparation. |
| `release.generatedAt` | RFC 3339 date-time string | Source commit time, not wall-clock preparation time. |
| `release.channel` | `private-development` | Non-public evaluation boundary. |
| `release.signed` | `false` | No code-signing claim exists. |
| `release.notarized` | `false` | No Apple notarization claim exists. |
| `target.os` | `macos` | Operating-system target. |
| `target.architecture` | `aarch64` or `x86_64` | Native package architecture. |
| `application.productName` | `FitFreed` | Display and bundle name. |
| `application.bundleIdentifier` | `org.fitfreed.desktop` | macOS bundle identity. |
| `application.executable` | `fitfreed` | Expected executable inside the bundle. |
| `application.storageSchemaVersion` | Positive integer | Exact SQLite schema compiled into this application and declared by the matrix. |
| `generators` | Object of version strings | Exact Tauri and CycloneDX generator versions used. |

## Artifacts

Each artifact has a top-level relative `path` without directory separators, enumerated `kind`, byte `size`, and lowercase SHA-256 digest. Version 2 requires:

- at least one `macos-application-bundle`;
- exactly one `macos-disk-image` under release verification;
- at least one `cyclonedx-sbom`; and
- exactly one `upgrade-matrix` named `supported-upgrades.json`.

The matrix target version and storage schema must equal the manifest. Its digest covers the exact compatibility statement distributed with the package. A digest-consistent matrix for another target is invalid.

File digests cover exact bytes. The application-bundle digest covers a sorted traversal of regular-file paths, permission modes, lengths, contents, and symbolic-link paths and targets; directory timestamps and machine-local absolute paths are excluded. Verification rejects any top-level entry not named by the manifest or the fixed manifest, release-notes, and checksum files.

`SHA256SUMS` covers every staged regular evidence file other than itself. The manifest does not include its own digest, avoiding a cyclic representation.

## Dependency inventories

CycloneDX 1.5 JSON documents describe the production npm graph and each production Cargo workspace package. Every manifest-declared production dependency must be a direct edge from the matching Cargo SBOM root, and every component must declare a license. A development-only dependency is invalid as a direct root edge. Legitimate transitive production components remain in the inventory.

Preparation replaces machine-local Cargo file URLs and matching dependency edges with stable `pkg:cargo` references, then rejects any remaining `file://` value or repository path.

## Privacy and failure behavior

The manifest, matrix, and related evidence must not contain personal exports, application-library content, credentials, signing material, private email addresses, or machine-local paths. Preparation occurs in a temporary ignored directory and replaces the version directory only after every artifact, compatibility statement, inventory, checksum, and content scan passes. Failure removes the temporary directory and preserves the last complete staged result.
