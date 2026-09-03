# Public release-signing configuration version 2

## Purpose

`release/public-release-signing.json` is the canonical public trust set used to authenticate the checksum inventory
of a complete FitFreed public Release. Version 2 replaces the Linux-specific purpose of version 1 before activation so
the same independently verifiable authority covers every artifact in an expanding macOS, Linux, and later Windows
platform set. This configuration contains public keys only.

The normative machine-readable contract is
[`schemas/public-release-signing-configuration-v2.schema.json`](../../../schemas/public-release-signing-configuration-v2.schema.json).

## Fields

- `format` is `org.fitfreed.release-signing-configuration`.
- `schemaVersion` is `2`.
- `status` is `inactive` until an accountable release owner admits the production trust root; `active` requires at
  least one trusted key.
- `purpose` is `public-release-checksums`.
- `algorithm` is `minisign-ed25519`.
- `keys.*.id` is a stable, non-secret identifier used by a release manifest.
- `keys.*.publicKey` is the canonical Minisign public-key document wrapped once in Base64.

## Invariants

- Key identifiers are unique and permit an overlap interval during rotation.
- An inactive configuration contains no keys.
- A public release manifest selects exactly one configured key and binds `SHA256SUMS` to `SHA256SUMS.minisig`.
- Updater-package signing remains a separate trust purpose and key set.
- Private signing material never enters this file, the repository, retained build evidence, command arguments, or
  logs.

## Compatibility

Version 1 remains readable solely to verify previously generated Linux-only evidence. New public platform sets use
version 2. Activating either contract is a release-authority decision and is outside normal development authority.
