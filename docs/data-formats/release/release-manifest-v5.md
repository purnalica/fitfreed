# FitFreed Recoverable Public Linux Release Manifest Version 5

## Purpose and authority

Release manifest version 5 binds a public stable Linux release to the recovery-capable `stable-v3` update contract.
It retains the exact Linux target, package identity, signature purposes, artifact inventory, checksums, provenance,
privacy, and publication boundaries of [version 4](release-manifest-v4.md). It changes only the schema selector to `5`
and the update contract selector to `stable-v3`; version 4 remains closed and continues to mean `stable-v2`.

[`release-manifest-v5.schema.json`](../../../schemas/release-manifest-v5.schema.json) is the machine-readable JSON
Schema. It reuses the closed structural definitions from version 4 by canonical schema reference while fixing its own
selectors. Consumers must resolve and validate both schemas and reject unknown fields or unsupported versions.

## Recovery binding

`update.contract` is exactly `stable-v3`. The manifest's `stable-update-envelope` artifact therefore carries an
authenticated [update channel version 3](update-channel-v3.md). The release verifier must reopen that envelope, verify
its metadata signature, and prove that its complete predecessor declaration equals the native Linux and Windows
baselines derived from the manifest's `supported-upgrades.json` artifact.

The current Debian package remains the single `linux-x86_64-deb` manifest artifact and is independently bound by its
package inventory, SHA-256, updater signature, signed checksum inventory, and provenance requirements. Predecessor
packages are not duplicated into this release manifest: they remain artifacts of their immutable original releases.
The staged Pages snapshot reopens those exact prior bytes, verifies their original release evidence and updater
signature, and includes them only at their canonical immutable version paths while the upgrade matrix declares them.

An initial Linux release with no prior application baseline uses version 5 with an empty authenticated recovery list.
It does not manufacture a predecessor. Any later Debian baseline makes the corresponding predecessor package and its
complete verification evidence mandatory before the candidate can pass.

## Failure and privacy

A version mismatch, `stable-v2` envelope, matrix version other than 2, missing or extra predecessor, changed package,
invalid original release evidence, signature failure, target mismatch, or non-canonical URL blocks candidate
admission and Pages publication. It cannot be reduced to a warning.

The contract contains only public product, compatibility, integrity, and release evidence. It contains no personal
fitness data, local library content, account information, credential, signing key, machine path, or host identifier.
Publication authority and the ordered macOS-before-Linux promotion gate remain outside this manifest.
