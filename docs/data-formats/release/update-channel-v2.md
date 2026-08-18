# FitFreed Public Stable Update Channel Version 2

## Purpose and authority

This contract authenticates the public stable release statement that FitFreed evaluates before downloading or installing an application update. [`update-channel-envelope-v2.schema.json`](../../../schemas/update-channel-envelope-v2.schema.json) specifies the endpoint response. [`update-channel-payload-v2.schema.json`](../../../schemas/update-channel-payload-v2.schema.json) specifies the exact UTF-8 JSON bytes carried and signed by that envelope.

Version 2 preserves the fields, bounds, exact-byte signature model, semantic checks, failure behavior, and privacy boundary of the closed [private-alpha version 1](update-channel-v1.md). It changes both schema selectors to `2` and the signed channel from `private-alpha` to `stable`; this explicit separation prevents either trust configuration from accepting the other channel. It does not authorize a key, signing operation, Pages deployment, GitHub Release, or public binary.

## Encoding and limits

- Endpoint media type: `application/json`; character encoding: UTF-8.
- Envelope format: `org.fitfreed.update-envelope` with `schemaVersion` `2`.
- Signed payload format: `org.fitfreed.update-channel` with `schemaVersion` `2`.
- Channel: `stable`; signature algorithm identifier: `minisign-ed25519`.
- `payloadBase64` decodes to the exact signed UTF-8 JSON bytes; verification occurs before JSON parsing.
- The complete response is limited to 1.5 MiB, the decoded payload to 1 MiB, a package to 1 GiB, an encoded signature to 16 KiB, and a URL to 2,048 characters.
- Unknown fields are invalid except additional locale keys and valid target keys admitted by the schemas.

The public metadata endpoint is the static direct HTTPS URL `https://purnalica.github.io/fitfreed/updates/stable.json`, without credentials, user information, query, or fragment. Metadata and package redirects are not followed. Connection establishment is limited to five seconds; the metadata request is limited to ten seconds and a bounded package request to fifteen minutes.

## Envelope fields

| Path | Type | Meaning |
|---|---|---|
| `version` | SemVer string | Untrusted Tauri mirror of signed `release.version`. |
| `platforms.*.url` | HTTPS URL | Untrusted mirror that must equal the signed target URL. |
| `platforms.*.signature` | Base64 string | Untrusted mirror that must equal the signed Tauri package signature. |
| `fitfreed.format` | fixed string | `org.fitfreed.update-envelope`. |
| `fitfreed.schemaVersion` | integer | Public stable envelope selector; exactly `2`. |
| `fitfreed.algorithm` | fixed string | `minisign-ed25519`. |
| `fitfreed.keyId` | string | Selects one embedded active metadata and package public key. |
| `fitfreed.payloadBase64` | Base64 string | Exact signed payload bytes. |
| `fitfreed.signatureBase64` | Base64 string | Minisign document for the exact payload, encoded in Base64. |

Unsigned `notes` and `pub_date` are forbidden. Presentation uses only authenticated payload values.

## Signed payload fields

| Path | Type | Meaning |
|---|---|---|
| `format` | fixed string | `org.fitfreed.update-channel`. |
| `schemaVersion` | integer | Public stable payload selector; exactly `2`. |
| `channel` | fixed string | `stable`. |
| `sequence` | positive safe integer | Monotonic snapshot number for replay and equivocation detection. |
| `issuedAt` | RFC 3339 date-time | Inclusive start of validity. |
| `expiresAt` | RFC 3339 date-time | Exclusive end of validity, no more than 14 days after issue. |
| `release.version` | SemVer string | Latest stable release in this snapshot. |
| `release.publishedAt` | RFC 3339 date-time | Release publication time. |
| `release.minimumSupportedVersion` | SemVer string | Oldest installed version permitted to use this update. |
| `release.librarySchema.minimumReadableVersion` | positive integer | Oldest current library schema the release can open. |
| `release.librarySchema.maximumReadableVersion` | positive integer | Newest current library schema the release can open. |
| `release.librarySchema.targetVersion` | positive integer | Library schema after successful migration. |
| `release.releaseNotes.*` | localized string | Authenticated notes; `en-US` and `es-ES` are mandatory. |
| `release.platforms.*.url` | direct HTTPS URL | Exact package location. |
| `release.platforms.*.size` | integer | Exact package length from 1 through 1,073,741,824 bytes. |
| `release.platforms.*.sha256` | lowercase hexadecimal | SHA-256 of the exact package bytes. |
| `release.platforms.*.tauriSignature` | Base64 string | Tauri's mandatory Minisign package signature. |
| `withdrawnVersions.*.version` | SemVer string | Withdrawn application version. |
| `withdrawnVersions.*.reason` | enumeration | `security`, `data-integrity`, `stability`, or `compatibility`. |
| `withdrawnVersions.*.guidance.*` | localized string | Authenticated guidance; `en-US` and `es-ES` are mandatory. |
| `withdrawnVersions.*.replacementVersion` | SemVer or null | Recommended safe version when one exists. |

Locale keys use the restricted BCP 47 shape in the schema. New locale keys are additive. A changed field meaning or another release channel requires a later schema version.

## Semantic invariants

1. The issue time is not unreasonably in the future; expiry follows issue and the validity interval is no longer than 14 days.
2. Lower sequence is replay. Equal sequence is valid only for the same signed-payload SHA-256; another digest is equivocation.
3. Envelope version, current-target URL, and signature exactly equal the signed payload, and the target exists in both objects.
4. Withdrawals are unique. A replacement differs from the withdrawn version.
5. Library schema bounds are ordered and the target is not below the minimum or current schema.
6. A candidate is installable only when newer, not withdrawn, application-compatible, and library-compatible.
7. Normal stable policy never accepts a SemVer downgrade. A functional rollback uses a newer fixed version.
8. Installation reruns the complete authenticated check and binds authorization to the fresh sequence, payload digest, key identifier, target schema, and exact package expectations.
9. The package passes Tauri's signature plus exact signed size and SHA-256 checks before installation.

## Failure, compatibility, and privacy

Unsupported versions, cross-channel metadata, unknown keys, malformed encoding, invalid signatures, oversize content, mirror mismatch, invalid time windows, replay, equivocation, downgrade, withdrawal, and invalid policy are untrusted. They cannot advance local trust state, change preferences, download a package, modify the application, or touch the library. Offline, timeout, read, non-success, and redirect outcomes leave the application usable and report update service unavailability.

The request carries no current version, locale, library schema, account, installation identifier, fitness data, health data, location, or usage value. Persisted update state contains only sequence, payload digest, version-scoped notification preferences, and recovery coordination. Diagnostics use stable reason codes and never reveal endpoints, payloads, keys, package paths, or library content.

## Signing, hosting, and release relationship

The protected release authority signs the exact payload and updater package independently with the key named by `fitfreed.keyId`. The signed payload binds that package to stable policy, compatibility, localized notes, withdrawal state, direct Pages URL, byte size, digest, and Tauri signature. Both files are promoted with the complete product site in one Pages deployment artifact; the human-facing DMG and complete evidence set remain in the corresponding GitHub Release under [ADR 0020](../../architecture/decisions/0020-compose-product-and-update-pages.md).

Public keys and endpoint configuration are build inputs. Production private keys, passwords, Apple credentials, generated signatures, payloads, packages, and deployment credentials never enter Git. Synthetic contract examples and test keys never become production trust.
