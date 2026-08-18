# FitFreed Public Update Build Configuration Version 1

## Purpose

[`public-update-configuration-v1.schema.json`](../../../schemas/public-update-configuration-v1.schema.json) defines the versioned, public, non-secret inputs that distinguish an ordinary build from a public stable-channel build. The current instance is [`release/public-update-channel.json`](../../../release/public-update-channel.json).

This configuration does not contain or name environment secrets, private keys, Apple credentials, generated signatures, packages, or publication authority. Its initial `inactive` state is intentional until an accountable production Minisign key ceremony provides the public trust material.

## Fields

| Field | Type | Meaning |
|---|---|---|
| `format` | fixed string | `org.fitfreed.public-update-configuration`. |
| `schemaVersion` | integer | Configuration version; exactly `1`. |
| `status` | enumeration | `inactive` or `active`. |
| `contract` | fixed string | `stable-v2`, selecting the public [update contract](update-channel-v2.md). |
| `metadataEndpoint` | HTTPS URL | Exact direct endpoint derived from the canonical [public-origin contract](public-origin-v1.md): `https://fitfreed.org/updates/stable.json`. |
| `keys` | array | Zero to eight public Minisign trust entries. |
| `keys.*.id` | string | Signed-envelope key identifier. Values are unique. |
| `keys.*.publicKey` | Base64 string | Public Minisign key text encoded as Base64. |

An `inactive` configuration has no keys and produces no build inputs. An `active` configuration has at least one key. Multiple entries permit an intentional public-key rotation overlap; unknown keys remain untrusted.

## Build mapping and failure behavior

Public candidate preparation validates the complete document and maps an active configuration to the compile-time `FITFREED_PUBLIC_UPDATE_CONTRACT`, `FITFREED_PUBLIC_UPDATE_ENDPOINT`, and `FITFREED_PUBLIC_UPDATE_TRUST` values. Trust is a closed JSON object from key identifier to public key. These values are public even though they are provided through the build environment.

An ordinary production build supplies none of them and remains unconfigured. If any compile-time value is present without all others, the contract is not `stable-v2`, the endpoint differs, the trust JSON is malformed, a key is invalid, or the host target is unsupported, the application fails closed before making a request. E2E transport configuration and public configuration cannot coexist.

Changing status, endpoint, contract, or keys changes the application trust root and invalidates prior executable evidence. Activating or rotating trust requires review, a clean exact candidate, complete packaged-update verification, repository safety checks, and an accountable key-custody record outside Git.
