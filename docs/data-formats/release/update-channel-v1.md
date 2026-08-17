# FitFreed Update Channel Version 1

## Purpose and authority

This contract authenticates the private-alpha release statement that FitFreed evaluates before downloading or installing an application update. [`update-channel-envelope-v1.schema.json`](../../../schemas/update-channel-envelope-v1.schema.json) specifies the endpoint response. [`update-channel-payload-v1.schema.json`](../../../schemas/update-channel-payload-v1.schema.json) specifies the exact UTF-8 JSON bytes carried and signed by that envelope.

The outer object is compatible with Tauri's static updater feed, but its fields are untrusted mirrors. Only the decoded payload is authoritative after its signature, structure, time, sequence, and local policy checks pass. This contract does not authorize an endpoint, release, package upload, signing operation, or participant distribution.

## Encoding and limits

- Endpoint media type: `application/json`.
- Character encoding: UTF-8.
- Envelope format: `org.fitfreed.update-envelope` with `schemaVersion` `1`.
- Signed payload format: `org.fitfreed.update-channel` with `schemaVersion` `1`.
- Channel: `private-alpha`.
- Signature algorithm identifier: `minisign-ed25519`.
- `payloadBase64` decodes to the exact signed UTF-8 JSON bytes; verification occurs before JSON parsing.
- The decoded payload is limited to 1 MiB. Encoded signatures are limited to 16 KiB. URLs are limited to 2,048 characters.
- Unknown fields are invalid except additional locale keys in localized text objects and additional valid platform target keys.

The endpoint and every artifact URL use HTTPS in a production build. Test-only transport exceptions remain outside this production contract.

## Envelope fields

| Path | Type | Meaning |
|---|---|---|
| `version` | SemVer string | Untrusted Tauri mirror of signed `release.version`. |
| `platforms` | target-keyed object | Untrusted Tauri mirrors used to construct its update object. |
| `platforms.*.url` | HTTPS URL | Must exactly equal signed `release.platforms.*.url`. |
| `platforms.*.signature` | Base64 string | Must exactly equal signed `release.platforms.*.tauriSignature`. |
| `fitfreed.format` | fixed string | `org.fitfreed.update-envelope`. |
| `fitfreed.schemaVersion` | integer | Envelope schema selector; version 1 only. |
| `fitfreed.algorithm` | fixed string | `minisign-ed25519`. |
| `fitfreed.keyId` | string | Selects one embedded active metadata public key. |
| `fitfreed.payloadBase64` | Base64 string | Exact signed payload bytes. |
| `fitfreed.signatureBase64` | Base64 string | Minisign document for the decoded payload, encoded as required by the Tauri signing representation. |

The envelope deliberately omits unsigned `notes` and `pub_date`. Presentation uses only `releaseNotes` and `publishedAt` from the verified payload.

## Signed payload fields

| Path | Type | Meaning |
|---|---|---|
| `format` | fixed string | `org.fitfreed.update-channel`. |
| `schemaVersion` | integer | Payload schema selector; version 1 only. |
| `channel` | fixed string | `private-alpha`. Cross-channel metadata is invalid. |
| `sequence` | positive safe integer | Monotonic channel snapshot number used for replay and equivocation detection. |
| `issuedAt` | RFC 3339 date-time | Start of the signed statement's validity interval. |
| `expiresAt` | RFC 3339 date-time | Exclusive end of validity; no more than 14 days after `issuedAt`. |
| `release.version` | SemVer string | Latest release announced by this snapshot. |
| `release.publishedAt` | RFC 3339 date-time | Release publication time, not the check time. |
| `release.minimumSupportedVersion` | SemVer string | Oldest installed version permitted to use this in-application upgrade. |
| `release.librarySchema.minimumReadableVersion` | positive integer | Oldest current library schema the new release can open and migrate. |
| `release.librarySchema.maximumReadableVersion` | positive integer | Newest current library schema the new release can open and migrate. |
| `release.librarySchema.targetVersion` | positive integer | Library schema after successful first-launch migration. |
| `release.releaseNotes.*` | localized string | Authenticated release notes; `en-US` and `es-ES` are mandatory. |
| `release.platforms.*` | target-keyed object | Authenticated package expectations for each distributed target. |
| `release.platforms.*.url` | HTTPS URL | Exact updater-package location. Redirects may not cross to an unsigned location or unsupported scheme. |
| `release.platforms.*.size` | positive integer | Exact downloaded byte length. |
| `release.platforms.*.sha256` | lowercase hexadecimal | SHA-256 of the exact updater-package bytes. |
| `release.platforms.*.tauriSignature` | Base64 string | Tauri's mandatory Minisign package signature. |
| `withdrawnVersions` | array | Signed withdrawal policy, unique by exact SemVer. |
| `withdrawnVersions.*.version` | SemVer string | Withdrawn application version. |
| `withdrawnVersions.*.reason` | enumeration | `security`, `data-integrity`, `stability`, or `compatibility`. |
| `withdrawnVersions.*.guidance.*` | localized string | Authenticated user guidance; `en-US` and `es-ES` are mandatory. |
| `withdrawnVersions.*.replacementVersion` | SemVer or null | Recommended safe version when one exists. |

Locale keys follow the restricted BCP 47 shape in the schema. A new locale is an additive property; changing field meaning or accepting a new channel requires a new payload schema version.

## Semantic invariants

JSON Schema validates shape; the verifier additionally enforces all of these invariants:

1. `issuedAt` is not unreasonably in the future, `expiresAt` is later, and the validity interval is no longer than 14 days.
2. A lower `sequence` than the locally accepted high-water mark is replay. The same sequence is valid only when the signed payload SHA-256 is identical. A different digest at the same sequence is equivocation.
3. Envelope `version`, current-target URL, and current-target Tauri signature exactly equal their signed counterparts. A target must exist in both objects.
4. Every withdrawal version is unique. A non-null `replacementVersion` is different from the withdrawn version.
5. `minimumReadableVersion` is no greater than `maximumReadableVersion`; `targetVersion` is at least `minimumReadableVersion` and never lower than the current library schema selected for update.
6. A candidate is installable only when it is newer than the installed version, is not withdrawn, the installed version is at least `minimumSupportedVersion`, and the current library schema is inside the declared readable interval.
7. Normal channel policy never accepts a SemVer downgrade, including when an endpoint or updater comparator presents one.
8. A downloaded package must pass Tauri signature verification and exact signed `size` and `sha256` comparison before native installation.

## Failure and compatibility behavior

Unsupported envelope or payload versions, unknown keys, malformed Base64, invalid UTF-8, invalid signatures, oversize content, unknown channels, mirror mismatch, invalid time windows, replay, equivocation, and semantic invariant failures are untrusted metadata. None may update the local high-water mark, notification preferences, package cache, application, or library.

An unreachable endpoint is an offline update outcome, not untrusted metadata and not an application failure. An expired otherwise valid payload cannot authorize installation. A lower application baseline, incompatible library schema, installed withdrawal without a safe candidate, or missing current platform produces authenticated manual-recovery guidance rather than a download.

The accepted sequence, payload digest, dismissal, and postponement are local application state. They contain no fitness, health, location, account, provider, or usage values. Diagnostics expose stable reason codes, not endpoint URLs, response bodies, package paths, signed payloads, or key material.

## Signing and release relationship

The protected release authority signs the exact payload bytes and each platform package independently. The package signature proves the bytes accepted by Tauri; the signed payload binds those bytes to FitFreed version, channel, compatibility, notes, withdrawal state, URL, size, and digest. A release is incomplete if either signature or their binding checks are absent.

Production private keys, passwords, live endpoint configuration, signed generated payloads, and packages are release inputs outside Git. Synthetic contract examples and cryptographic test material never become a trusted production key.
