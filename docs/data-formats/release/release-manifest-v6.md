# Expanding macOS and Linux Public Release Manifest Version 6

## Purpose and authority

Release manifest version 6 is the immutable evidence contract for the first platform-expansion Release. It describes
one exact public version that contains newly built macOS and Linux targets from the same source revision. It supersedes
the Linux-only composition of [version 5](release-manifest-v5.md) for expansion releases without reinterpreting that
closed contract. [ADR 0044](../../architecture/decisions/0044-publish-expanding-complete-platform-sets.md) owns the
release-composition decision.

[`release-manifest-v6.schema.json`](../../../schemas/release-manifest-v6.schema.json) is the normative machine-readable
JSON Schema. Consumers reject unknown properties, unsupported schema versions, invalid identifiers, unsafe paths,
duplicate artifacts, missing evidence, and any platform or update target set other than `darwin-aarch64` followed by
`linux-x86_64-deb`.

## Release and application identity

`release.version`, `release.revision`, `release.generatedAt`, and `release.channel` identify one `public-stable`
candidate. Every package and piece of generated evidence belongs to that version and revision. `application` fixes the
public product, bundle identifier, executable, and current storage schema. A package from an earlier immutable Release
cannot be copied or renamed into this set.

## Complete platform set

`platforms` has exactly two ordered entries:

1. `darwin-aarch64` requires Apple Silicon, macOS 15.0 or later, Developer ID Application signing, hardened runtime,
   secure timestamp, Apple notarization, stapled application and disk image tickets, and Gatekeeper acceptance.
2. `linux-x86_64-deb` requires the x86-64 Debian package contract for Ubuntu Desktop 24.04 and 26.04 LTS. The manifest
   states explicitly that no selected Linux platform-native signature is provided; the independent updater signature,
   signed checksum inventory, GitHub provenance, and package inventory remain mandatory.

The regular artifact set contains the macOS disk image and updater archive, the Debian package, its complete package
inventory, one `linux-build-evidence` statement, both target-specific updater signatures, the authenticated stable
envelope, the upgrade matrix, release notes, and every CycloneDX SBOM. The candidate-only `FitFreed.app` directory is
also represented as `macos-application-bundle` for native trust verification but is not a GitHub Release asset or a
checksum subject.

Artifact kinds that otherwise shared a name are target-specific in version 6:

- `macos-updater-signature` authenticates the `macos-updater-archive`;
- `linux-updater-signature` authenticates `linux-x86_64-deb`; and
- `linux-build-evidence` binds the package and inventory produced and admitted on the Linux builder before composition.

Every artifact declares its owner as `darwin-aarch64`, `linux-x86_64-deb`, or `release`. Shared artifacts cannot be
used to hide a missing platform artifact, and a platform artifact cannot be assigned to the shared scope.

## Trust and update binding

`trust.releaseSignature` fixes `minisign-ed25519`, the approved public release key, `SHA256SUMS`, and
`SHA256SUMS.minisig`. `trust.updaterSignatures` contains exactly one ordered entry per platform. Both entries use the
same active updater key named by `update.keyId`, and their subject and signature paths are derived from the manifest
version.

`update.contract` is exactly `stable-v3`. `update.targets` repeats the exact platform set, and the authenticated
`stable-update-envelope` must contain those two current packages with their exact sizes, SHA-256 digests, signatures,
canonical `fitfreed.org` URLs, application version, update sequence, storage schema, and recovery requirements. A
package present only in Pages or the update envelope fails candidate admission.

## Checksums, provenance, and publication

Artifacts are sorted by path and use flat, safe, version-derived names. `provenanceRequirements.digestBoundSubjects`
equals every regular artifact in that same order. `generatedSubjects` is exactly `release-manifest.json`,
`SHA256SUMS`, and `SHA256SUMS.minisig`. The signed checksum inventory contains every regular artifact plus the manifest;
the detached release signature authenticates those bytes.

GitHub artifact attestations use `github-artifact-attestations` and bind every published asset to the exact tag and
source revision. The immutable GitHub Release, release asset set, Pages snapshot, stable envelope, release notes,
support links, and remote verification must all derive from this one manifest. A missing, extra, renamed, mixed-version,
mixed-revision, unsigned, unprovenanced, or Pages-only target blocks publication rather than producing a warning.

## Privacy and compatibility

The manifest contains only public build, compatibility, integrity, and release evidence. It contains no user data,
provider export, account identifier, credential, signing secret, workstation path, or host identifier. Version 6
supports only the macOS-plus-Linux expansion; adding Windows requires a new immutable manifest version and does not
broaden this contract.
