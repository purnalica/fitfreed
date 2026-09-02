# FitFreed Public Linux Release Manifest Version 4

## Purpose and authority

Release manifest version 4 binds one public stable Linux release to its exact source, supported Ubuntu desktop
boundary, Debian package identity, storage compatibility, package inventory, dependency inventories, update channel,
two detached signature purposes, artifact digests, and required provenance subjects. This document is the normative
human-readable contract. [`release-manifest-v4.schema.json`](../../../schemas/release-manifest-v4.schema.json) is its
machine-readable JSON Schema.

Version 4 is separate from the macOS-only public [version 3](release-manifest-v3.md). Neither platform may reinterpret
the other's target, trust, package, or artifact fields. A manifest records verifiable evidence and requirements; it
does not grant publication authority, assert that an external attestation exists, or provide a warranty.

## Encoding and compatibility

- File name: `release-manifest.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.release-manifest`.
- Schema selector: integer `schemaVersion`; this contract requires `4`.
- Unknown top-level or nested properties are invalid.

Consumers must reject unsupported versions. Versions 1 through 3 retain their historical meanings and remain closed.

## Release, target, and application

`release.version` is the FitFreed semantic version, `release.revision` is the exact lowercase Git revision,
`release.generatedAt` is the source commit time, and `release.channel` is `public-stable`.

The target is exactly `linux-x86_64-deb`: Linux on x86-64, distributed as a Debian package. The only declared supported
environments are Ubuntu Desktop 24.04 and 26.04. These values are a bounded support claim rather than aliases for all
Debian-derived systems, Linux distributions, processor architectures, or package families.

The application identity is `FitFreed`, identifier `org.fitfreed.desktop`, and executable `fitfreed`.
`application.storageSchemaVersion` is the positive SQLite schema compiled into the release.

## Trust boundaries

`trust.nativePackageIdentity` explicitly records `not-provided` with reason
`no-selected-linux-platform-signature`. The direct Debian package has no selected Apple- or Authenticode-equivalent
native identity. Documentation and presentation must state this boundary rather than implying operating-system trust.

Two Minisign Ed25519 signatures have separate subjects and acceptance purposes:

- `trust.releaseSignature` identifies the FitFreed release key and signs the exact `SHA256SUMS` bytes as
  `SHA256SUMS.minisig`. This authenticates the complete checksum inventory.
- `trust.updaterSignature` identifies the update key and signs the exact
  `FitFreed_<version>_amd64.deb` bytes as `FitFreed_<version>_amd64.deb.sig`. Tauri requires and verifies this signature
  before native replacement.

The release-signature file is not included in the manifest artifact array or in its signed checksum subject, avoiding
a digest cycle. It is nevertheless a mandatory closed release file and a required provenance subject. Release and
updater keys may be operated independently; matching key identifiers do not collapse the two subjects or verification
steps.

## Update binding

`update.contract` is `stable-v2`; `metadataEndpoint` is the canonical direct HTTPS update endpoint; `keyId` is the same
identifier used by `trust.updaterSignature`; `sequence` is positive and monotonic; and `target` is
`linux-x86_64-deb`. The manifest binds the complete stable update envelope as an artifact. That signed envelope binds
the Debian package URL, byte length, SHA-256 digest, Tauri signature, compatibility, release notes, and withdrawal
policy under the [stable channel contract](update-channel-v2.md).

## Generators and artifacts

`generators` records the exact Cargo CycloneDX, npm CycloneDX, Tauri, and Linux package-inventory contract versions.
The artifact array is path-sorted, contains unique top-level paths, and records positive byte size plus lowercase
SHA-256 for every entry. Exactly one of each non-SBOM kind and at least one `cyclonedx-sbom` are required:

| Kind | Exact path or rule |
|---|---|
| `linux-x86_64-deb` | `FitFreed_<version>_amd64.deb` |
| `linux-package-inventory` | `FitFreed_<version>_amd64.deb.inventory.json` |
| `updater-signature` | `FitFreed_<version>_amd64.deb.sig` |
| `stable-update-envelope` | `stable.json` |
| `cyclonedx-sbom` | One or more top-level CycloneDX JSON documents. |
| `upgrade-matrix` | `supported-upgrades.json` |
| `release-notes` | `RELEASE_NOTES.md` |

The [Linux package inventory](linux-package-inventory-v1.md) digest must bind the same `.deb` artifact digest and its
control version, architecture, package name, dependencies, and installed layout. CycloneDX remains the software
dependency authority; the package inventory remains the native layout authority.

## Checksums, provenance, privacy, and failure

`SHA256SUMS` covers every regular manifest artifact plus `release-manifest.json`, but neither itself nor
`SHA256SUMS.minisig`. The detached release signature is created only after the checksum bytes are final.

`provenanceRequirements.provider` is `github-artifact-attestations`. `digestBoundSubjects` exactly reproduces every
manifest artifact path and digest in path order. `generatedSubjects` is the closed ordered list
`release-manifest.json`, `SHA256SUMS`, and `SHA256SUMS.minisig`; hosted release automation must attest those final files
after generation.

The evidence set contains no personal export, library content, credential, signing material, private email address,
machine-local path, or host identifier. Preparation writes to an ignored temporary directory, validates and reopens
every relation before promotion, and preserves the previous complete evidence when any build, inventory, signature,
checksum, manifest, provenance, or content gate fails. Public promotion remains separately authorized and ordered after
the accepted public macOS release.
