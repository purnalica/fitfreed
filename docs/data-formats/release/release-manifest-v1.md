# FitFreed Release Manifest Version 1

## Purpose and authority

The FitFreed release manifest binds one staged application package to its source revision, target, storage compatibility, dependency inventories, and digests. This document is the normative human-readable contract. [`release-manifest-v1.schema.json`](../../../schemas/release-manifest-v1.schema.json) is its machine-readable JSON Schema.

The manifest is release evidence, not a fitness-data interchange format, signature, legal-compliance statement, or publication authorization. Schema version 1 describes unsigned, non-notarized private macOS development packages only.

## Encoding and compatibility

- File name: `release-manifest.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.release-manifest`.
- Schema selector: integer `schemaVersion`; the only current value is `1`.
- Unknown top-level or nested properties are invalid under version 1.

A consumer must reject an unsupported schema version. A future compatible addition requires a new schema version when it changes any closed object or accepted value. Existing versioned schemas and documentation remain available.

## Fields

| Path | Type | Meaning |
|---|---|---|
| `release.version` | SemVer string | Version shared by npm, Tauri, and every FitFreed Cargo package. |
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
| `application.storageSchemaVersion` | Positive integer | Highest SQLite schema understood by this application. |
| `generators` | Object of version strings | Exact Tauri and CycloneDX generator versions used. |
| `artifacts` | Non-empty array | Sorted application, disk-image, and SBOM evidence records. |

Each artifact has a top-level relative `path` without directory separators, enumerated `kind`, byte `size`, and lowercase SHA-256 digest. File digests cover the exact bytes. The application-bundle digest covers a sorted traversal of regular-file paths, permission modes, lengths, contents, and symbolic-link paths and targets; directory timestamps and machine-local absolute paths are excluded. Verification rejects any top-level entry not named by the manifest or the three fixed evidence files.

`SHA256SUMS` covers every staged regular evidence file other than itself. The manifest does not include its own digest, avoiding a cyclic representation.

## Dependency inventories

CycloneDX 1.5 JSON documents describe the production npm graph and each production Cargo workspace package. Direct production dependencies and a declared license for every component are required. Development and E2E dependencies are invalid.

The Cargo generator represents local workspace packages with machine-local file URLs. Preparation replaces those URLs and all matching dependency edges with stable `pkg:cargo` references before validation. Any remaining `file://` value or repository path blocks staging.

## Privacy and failure behavior

The manifest and related evidence must not contain personal exports, application-library content, credentials, signing material, private email addresses, or machine-local paths. Preparation occurs in a temporary ignored directory and replaces the version directory only after every artifact and inventory passes validation. Failure removes the temporary directory and preserves the last complete staged result.
