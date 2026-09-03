# FitFreed Windows Public Build Evidence Version 1

## Purpose and authority

Windows public build evidence transfers one accepted native builder result into later complete-platform release
composition without transferring protected authority or machine identity. It binds the Authenticode-signed x86-64 NSIS
setup, its complete public package inventory, source revision, application version,
storage schema, admitted Authenticode certificate fingerprint, and public update contract.

[`windows-public-build-evidence-v1.schema.json`](../../../schemas/windows-public-build-evidence-v1.schema.json) is the
normative machine-readable schema. This document is its human-readable contract. The evidence does not authorize a
tag, release, publication, or update-channel change, and it does not replace exact Windows 11 candidate acceptance.

## Encoding and identity

- File name: `FitFreed_<version>_x64-setup.exe.build.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format: `org.fitfreed.windows-public-build-evidence`.
- Schema selector: `schemaVersion`; version 1 is the only accepted value.

Unknown fields, unsupported versions, unsafe top-level paths, missing values, and values outside their closed
enumerations are invalid.

`release` records one semantic `version`, lowercase 40-to-64-character source `revision`, and reproducible
`generatedAt` timestamp derived from the source revision. `application` closes identity to `FitFreed`,
`org.fitfreed.desktop`, `fitfreed.exe`, and the positive target storage-schema version.

## Native target and artifacts

`target` is exactly `windows-x86_64-nsis`: Windows, x86-64, NSIS, and current-user installation. The artifact object
contains exactly:

- `package`: `FitFreed_<version>_x64-setup.exe`, kind `windows-x86_64-nsis`; and
- `inventory`: the same package name followed by `.inventory.json`, kind `windows-package-inventory`.

Each artifact has a positive byte size and lowercase SHA-256 digest. The inventory's own package identity and digest
must equal `artifacts.package`; its public Authenticode signature claims must use the fingerprint in `trust`.

## Independent trust bindings

`trust.authenticodeCertificateSha256` is the independently admitted lowercase SHA-256 fingerprint of the leaf
certificate observed on the setup, installed executable, and installed uninstaller. Certificate subject, SHA-1 store
selector, certificate-store path, SignTool path, timestamp authority, private key, password, and account identity are
not evidence fields.

`update` is exactly the recoverable `stable-v3` contract at
`https://fitfreed.org/updates/stable.json`, plus the byte-sorted closed `trustedKeyIds` embedded in the executable from
the source-controlled public configuration. This records the package's embedded channel trust without redundantly
copying public-key material. The later complete-platform composer still owns updater signing, the authenticated stable
envelope, selected key, sequence, cross-platform target set, predecessors, checksums, release signing, provenance, and
publication snapshot.

## Verification set

`verification` is an ordered closed list of passed gates:

1. `windows-package-contract` — target, package, resources, dependency mode, and product identity;
2. `windows-public-setup-trust` — final setup policy, identity, certificate, timestamp, and digest;
3. `windows-current-user-installation` — clean native installation and registered identity;
4. `windows-installed-authenticode` — installed executable and uninstaller trust and digest binding;
5. `windows-package-inventory` — complete public-profile package inventory; and
6. `windows-clean-removal` — package state removed and application data preserved.

Omission, reordering, renaming, or a result other than `passed` rejects the document.

## Privacy, determinism, and compatibility

The evidence contains no user data, provider export, hostname, runner name, workflow identifier, user directory,
temporary path, credential, private key, account identity, certificate subject, protected tool path, or signing-service
detail. Artifact paths are flat public names. Repeating preparation for identical accepted bytes and source identity
produces identical JSON bytes.

The input directory that carries this evidence is closed to the setup, inventory, and build-evidence files. Every file
is regular, singly linked, digest-verified, and copied atomically. A new artifact, platform, package
format, installation mode, trust representation, or verification boundary requires a new schema version rather than
reinterpreting version 1.

The input is carried between protected jobs only through the digest-bound pack and unpack commands documented in the
[release delivery architecture](../../architecture/release-delivery.md). The archive is transport, not another
evidence format: its accepted identity is its SHA-256 digest plus the complete verification of these three extracted
files.
