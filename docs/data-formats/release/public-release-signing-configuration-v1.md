# Public Release-Signing Configuration Version 1

## Purpose

This contract defines the public trust set used to authenticate the complete checksum inventory of a FitFreed Linux
release. The canonical instance is `release/public-release-signing.json`, and the machine-readable contract is
[`public-release-signing-configuration-v1.schema.json`](../../../schemas/public-release-signing-configuration-v1.schema.json).
It contains public verification material only. Private keys, passwords, signing operations, and publication authority
never enter this document or Git.

This trust purpose is separate from the public update-channel keys. An updater signature authenticates one package for
native replacement; a release signature authenticates `SHA256SUMS`, which binds the complete public Linux evidence
set. Using the same key identifier for both purposes does not merge their signed subjects or verification steps.

## Fields

| Field | Contract |
|---|---|
| `format` | Fixed `org.fitfreed.release-signing-configuration`. |
| `schemaVersion` | Integer `1`. |
| `status` | `inactive` or `active`. |
| `purpose` | Fixed `linux-release-checksums`. |
| `algorithm` | Fixed `minisign-ed25519`. |
| `keys` | Ordered set of zero to eight public verification keys. |
| `keys.*.id` | Stable lowercase key identifier used by the release manifest. |
| `keys.*.publicKey` | Complete public Minisign key text encoded as Base64. |

Unknown properties and duplicate key identifiers are invalid. `inactive` requires an empty key set; `active` requires
at least one key. A Linux public candidate names exactly one configured key, signs the final `SHA256SUMS` bytes, and
writes the detached signature as `SHA256SUMS.minisig`.

## Lifecycle and failure behavior

The initial canonical instance is deliberately `inactive`. Activating it is a reviewed human authority gate after an
accountable key ceremony and custody decision. Rotation overlaps public keys long enough for supported verification
paths to accept the successor; compromise handling may remove trust only through an explicit release-security action.

An inactive, missing, malformed, duplicate, unknown, or wrong-purpose key configuration cannot create, verify, or
promote a Linux public candidate. It does not affect ordinary local builds, unsigned Linux packaging evidence, or the
private user library.
