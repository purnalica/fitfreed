# FitFreed Linux Package Inventory Version 1

## Purpose and authority

The Linux package inventory binds one x86-64 Debian artifact to its complete extracted filesystem layout and Debian
control metadata. It is exact release evidence used to detect package drift before installation, signing, or
publication. This document is the normative human-readable contract.
[`linux-package-inventory-v1.schema.json`](../../../schemas/linux-package-inventory-v1.schema.json) is its structural
JSON Schema.

The inventory describes package bytes; it is not a software bill of materials, an installer signature, update
metadata, proof of installation, or publication authority. CycloneDX evidence remains authoritative for production
software dependencies, while this contract preserves the package manager's complete dependency expression and every
installed entry.

## Encoding and compatibility

- File name: `<Debian artifact name>.inventory.json`; for release `0.1.0` this is
  `FitFreed_0.1.0_amd64.deb.inventory.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.linux-package-inventory`.
- Schema selector: integer `schemaVersion`; version 1 is the only current value.
- Unknown top-level or nested properties are invalid.

A consumer must reject an unsupported schema version. Any incompatible field, target, or entry representation requires
a new schema and normative document; version 1 remains an immutable description of the initial Debian package
boundary.

## Target and artifact

`target.distributionFamily` is `debian`, `target.architecture` is `amd64`, and `target.packageFormat` is `deb`. These
closed values describe the first Linux package contract, not every future FitFreed Linux target.

`artifact.path` is the exact top-level Debian filename derived from `control.version`. `artifact.size` is its positive
byte length and `artifact.sha256` is the lowercase SHA-256 digest of the complete `.deb` bytes. Paths are relative and
never contain a build-host directory.

## Debian control metadata

The `control` object is read from the exact package with `dpkg-deb --field` before extraction.

| Field | Contract |
|---|---|
| `packageName` | Fixed value `fitfreed`. |
| `version` | FitFreed semantic version shared by the artifact name. |
| `architecture` | Fixed Debian architecture `amd64`. |
| `maintainer` | Public non-email value `FitFreed contributors`. |
| `section` | Debian section `utils`. |
| `priority` | Debian priority `optional`. |
| `homepage` | Canonical public origin `https://fitfreed.org/`. |
| `description` | Complete package-manager description, preserving embedded line feeds. |
| `dependencyExpression` | Complete raw `Depends` value, including versions and alternatives. |
| `dependencyNames` | Unique package names parsed from every alternative and sorted in English byte-independent order. |

`dependencyNames` is a searchable projection and must exactly equal the names parsed from `dependencyExpression`; it
does not replace the raw package-manager semantics.

## Extracted entries

`entries` contains every extracted directory, regular file, and symbolic link exactly once, sorted by UTF-8 path bytes.
Every path is relative, uses `/`, excludes `.` and `..` components, contains no backslash or NUL, and remains inside the
package root.

| Type | Required fields | Meaning |
|---|---|---|
| `directory` | `path`, `type`, `mode` | Extracted directory and four-digit octal permission mode. |
| `file` | `path`, `type`, `mode`, `size`, `sha256` | Regular-file bytes, length, and lowercase SHA-256 digest. |
| `symbolic-link` | `path`, `type`, `mode`, `target` | Relative non-escaping target; `mode` is canonically `0777` because symbolic-link permissions are not independently mutable on supported Unix filesystems. |

The inventory must contain an executable `usr/bin/fitfreed`, the desktop entry, installed GPL text, and required 32- and
128-pixel application icons. Unsupported entry types, duplicate paths, escaping links, a non-executable application,
or any missing required path invalidate the inventory.

## Determinism, privacy, and failure behavior

Generation selects exactly one version-named Debian artifact, extracts it into a private temporary directory, validates
the complete in-memory document, and atomically replaces the adjacent inventory only after success. A failed selection,
control read, extraction, validation, or write preserves prior valid evidence and removes temporary state. Repeated
generation from identical package bytes produces identical inventory bytes.

The document contains no absolute path, host identifier, timestamp, user data, provider export, credential, signing
material, or private email address. Command output reports only package identity, artifact and inventory digests, entry
count, and the top-level inventory filename. The generated inventory remains private engineering evidence until the
release-manifest, checksum, signing, provenance, and publication gates explicitly admit those exact bytes.
