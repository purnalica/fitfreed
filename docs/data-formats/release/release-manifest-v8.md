# Complete Stable Platforms and Public Unsigned Windows Preview Manifest Version 8

## Purpose and authority

Release manifest version 8 describes one immutable release containing stable signed-and-notarized macOS, stable
Ubuntu packages, and a public unsigned Windows preview built from the same source revision. It preserves the complete
artifact, updater-signature, checksum, provenance, and update-set semantics of
[version 7](release-manifest-v7.md) while replacing its Windows Authenticode claim with an explicit preview boundary.
The structural authority is
[`release-manifest-v8.schema.json`](../../../schemas/release-manifest-v8.schema.json).

## Platform set

The ordered targets remain `darwin-aarch64`, `linux-x86_64-deb`, and `windows-x86_64-nsis`. The release channel remains
`public-stable` because it contains the stable macOS and Linux products; platform availability is stated separately.

The Windows entry fixes x86-64, NSIS, current-user installation, bundled WebView2, and the Windows 11 product target.
Its `availability` tier is `preview` and `exactWindows11Admission` is `false`. Its support policy is
`preview-feedback`, not the version 7 stable support policy.

## Windows trust

Windows `trust.authenticode` records `status` `not-provided`, `publisherIdentity` `unknown`, and reason
`unsigned-preview`. It contains no certificate fingerprint, digest algorithm, or timestamp claim. The Windows package
inventory and public build evidence generators are both version `2`; signed version 1 evidence is invalid in this
manifest.

The Windows NSIS bytes still have a target-specific `minisign-ed25519` updater signature. Every regular artifact is
covered by `SHA256SUMS`, the independent release signature, and GitHub artifact provenance. The authenticated
`stable-v3` envelope contains the exact package digest, signature, immutable URL, version, sequence, storage schema,
and recovery requirements. Missing Authenticode identity must never be confused with unauthenticated release bytes.

## Presentation and compatibility

Every download surface derived from version 8 must label Windows as `Windows preview — unsigned`, explain the unknown
publisher and possible SmartScreen, managed-policy, or Smart App Control block, and expose a direct account-free
feedback route. It must not claim exact Windows 11 admission or advise disabling system-wide protections.

Version 8 accepts only this mixed stable-plus-preview set. A signed Windows promotion, different trust model, target,
architecture, package format, or platform set requires a later schema. Version 7 remains the immutable signed-Windows
contract.
