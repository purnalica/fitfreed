# FitFreed Public Update Build Configuration Version 2

## Purpose and compatibility

[`public-update-configuration-v2.schema.json`](../../../schemas/public-update-configuration-v2.schema.json) defines the
public, non-secret inputs that select the recovery-capable stable update channel. It preserves the status, endpoint,
key rotation, build mapping, privacy, and failure behavior of closed [version 1](public-update-configuration-v1.md),
changes `schemaVersion` to `2`, and changes `contract` to `stable-v3`.

This contract does not activate update trust, create signing authority, or publish an application. The checked-in
instance remains on version 1 until the complete public release pipeline consumes stable channel version 3.

## Fields

| Field | Type | Meaning |
|---|---|---|
| `format` | fixed string | `org.fitfreed.public-update-configuration`. |
| `schemaVersion` | integer | Configuration version; exactly `2`. |
| `status` | enumeration | `inactive` or `active`. |
| `contract` | fixed string | `stable-v3`, selecting [update channel version 3](update-channel-v3.md). |
| `metadataEndpoint` | HTTPS URL | Exact direct endpoint `https://fitfreed.org/updates/stable.json`. |
| `keys` | array | Zero to eight public Minisign trust entries. |
| `keys.*.id` | string | Unique signed-envelope key identifier. |
| `keys.*.publicKey` | Base64 string | Public Minisign key text encoded as Base64. |

An `inactive` configuration has no keys and maps to no build inputs. An `active` configuration has at least one key;
multiple entries support deliberate public-key rotation overlap. Private keys, credentials, packages, signatures,
publication authority, and machine-local values are forbidden.

## Build mapping and failure behavior

An active version 2 document maps `FITFREED_PUBLIC_UPDATE_CONTRACT` to `stable-v3` and also supplies
`FITFREED_PUBLIC_UPDATE_ENDPOINT` and `FITFREED_PUBLIC_UPDATE_TRUST`. The endpoint and trust object retain their exact
version 1 meanings. The application selects one complete versioned verifier from the contract value and never infers a
contract from the response.

Missing or mixed fields, a schema and contract mismatch, an unexpected endpoint, duplicate or malformed keys, an
unsupported host target, or coexistence with instrumented E2E configuration fails closed before network access. An
ordinary build still receives no public-update values and remains unconfigured.

Changing status, endpoint, contract, or keys changes executable trust evidence. Activation or rotation still requires
the release authority, exact candidate, packaged-update, repository-safety, and key-custody gates defined by version 1.
