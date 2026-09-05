# Complete macOS, Linux, and Windows Public Release Manifest Version 7

## Purpose and authority

Release manifest version 7 is the immutable evidence contract for the Windows platform-expansion Release. It
describes one exact public version containing newly built macOS, Linux, and Windows targets from the same source
revision. It supersedes the macOS-plus-Linux composition of [version 6](release-manifest-v6.md) for this expansion
without reinterpreting that closed contract. [ADR 0044](../../architecture/decisions/0044-publish-expanding-complete-platform-sets.md)
owns the release-composition decision.

[`release-manifest-v7.schema.json`](../../../schemas/release-manifest-v7.schema.json) is the normative machine-readable
JSON Schema. It reuses only immutable primitive and platform definitions from the version 6 schema, and closes its own
Windows, artifact, trust, and target definitions. Consumers load both schemas and reject unknown properties,
unsupported schema versions, invalid identifiers, unsafe paths, duplicate artifacts, missing evidence, and any
platform or update target set other than `darwin-aarch64`, `linux-x86_64-deb`, and `windows-x86_64-nsis` in that
order.

## Release and application identity

`release.version`, `release.revision`, `release.generatedAt`, and `release.channel` identify one `public-stable`
candidate. Every package and piece of generated evidence belongs to that version and revision. `application` fixes the
public product, bundle identifier, executable, and current storage schema. An artifact from either earlier immutable
Release cannot be copied, renamed, or represented as the new version.

## Complete platform set

`platforms` has exactly three ordered entries:

1. `darwin-aarch64` retains the version 6 Apple Silicon, macOS 15.0, Developer ID, hardened-runtime, notarization,
   stapling, and Gatekeeper contract.
2. `linux-x86_64-deb` retains the version 6 x86-64 Debian package contract for Ubuntu Desktop 24.04 and 26.04 LTS,
   including the explicit absence of a selected Linux platform-native signature.
3. `windows-x86_64-nsis` requires x86-64 Windows 11 editions still supported at candidate issuance, an NSIS
   `currentUser` installer, the bundled `offlineInstaller` WebView2 mode, and valid SHA-256 Authenticode signatures
   carrying an RFC 3161 timestamp under one admitted certificate fingerprint.

The Windows support declaration is a time-bounded family policy rather than a claim that every historical or future
Windows 11 edition is supported. Windows 10, Windows on ARM, MSI, managed installation, and per-machine installation
remain outside this contract.

## Artifact set

The regular artifact set contains the macOS disk image and updater archive, the Debian package, the Windows NSIS
setup, their target-specific inventories and native build evidence, all three updater signatures, the authenticated
stable envelope, the upgrade matrix, release notes, and every CycloneDX SBOM. The candidate-only `FitFreed.app`
directory is represented as `macos-application-bundle` for native trust verification but is not a GitHub Release asset
or checksum subject.

Windows introduces four closed artifact kinds:

- `windows-x86_64-nsis` is `FitFreed_<version>_x64-setup.exe`;
- `windows-package-inventory` appends `.inventory.json` to that package name;
- `windows-build-evidence` appends `.build.json`; and
- `windows-updater-signature` appends `.sig` and authenticates the exact Authenticode-signed setup bytes.

Every artifact declares its owner as `darwin-aarch64`, `linux-x86_64-deb`, `windows-x86_64-nsis`, or `release`.
Platform evidence cannot be hidden in the shared release scope. Each non-SBOM kind occurs exactly once, and at least
one release-scoped CycloneDX SBOM is required. Cargo SBOMs cover the direct production graph for every possible target
rather than the host used for composition, so all three platform-specific branches remain represented in shared
release evidence.

## Independent trust binding

The Windows platform's `trust.authenticode` object records `status` `valid`, `digestAlgorithm` `sha256`, the lowercase
`certificateSha256` admitted by the protected native builder, and `rfc3161Timestamp` `true`. The exact package,
installed executable, and uninstaller evidence must all bind that same certificate through the Windows package
inventory and build-evidence contracts. This declarative object is not sufficient without independent Windows policy,
chain, timestamp, identity, and unchanged-digest verification.

`trust.releaseSignature` fixes `minisign-ed25519`, the approved public release key, `SHA256SUMS`, and
`SHA256SUMS.minisig`. `trust.updaterSignatures` contains exactly one ordered entry per platform. All three use the same
active updater key named by `update.keyId`, but each signature authenticates its target-specific package. Authenticode,
updater signing, signed checksums, and provenance are independent mandatory controls.

## Update, checksums, provenance, and publication

`update.contract` is exactly `stable-v3`; `update.targets` repeats the exact three-platform set. The authenticated
`stable-update-envelope` contains every current package with its exact size, SHA-256 digest, updater signature,
canonical `fitfreed.org` URL, application version, sequence, storage schema, and recovery requirements. A package
present only in Pages, the release assets, or update metadata fails admission.

Artifacts are sorted by path and use flat, version-derived names. `provenanceRequirements.digestBoundSubjects` equals
every regular artifact in the same order. `generatedSubjects` is exactly `release-manifest.json`, `SHA256SUMS`, and
`SHA256SUMS.minisig`. GitHub artifact attestations use `github-artifact-attestations` and bind every published asset to
the exact tag and source revision. The immutable GitHub Release, Pages snapshot, stable envelope, notes, support state,
checksums, signatures, and provenance all derive from this manifest.

## Privacy, failure, and compatibility

The manifest contains only public build, compatibility, integrity, and release evidence. It contains no user data,
provider export, account identifier, credential, private signing material, certificate selector, workstation path, or
host identifier. Unknown fields, an unexpected platform, mixed source identity, an invalid path, missing or duplicate
evidence, or divergence among trust and provenance subjects rejects the candidate rather than producing a warning.

Version 7 supports only the complete macOS-plus-Linux-plus-Windows expansion. A new package type, architecture,
platform, target trust representation, or incompatible evidence boundary requires another schema version.
