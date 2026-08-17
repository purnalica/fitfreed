# FitFreed Public Release Policy Version 1

## Purpose

The public release policy is the reviewed, version-specific source for stable update sequence, minimum supported application version, localized update notes, and withdrawals. [`public-release-policy-v1.schema.json`](../../../schemas/public-release-policy-v1.schema.json) is its machine-readable JSON Schema.

Time-sensitive issuance and expiry values and the selected active signing key are intentionally absent. Protected release automation supplies those values when it signs the exact channel payload. Apple credentials, updater private keys, passwords, and publication authority never belong in this contract.

## Location and encoding

- Path: `release/publication/<releaseVersion>.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.public-release-policy`.
- Schema selector: integer `schemaVersion`; this contract requires `1`.
- Unknown properties are invalid.

The filename, `releaseVersion`, package version, release notes, upgrade matrix, tag, and generated stable envelope must identify the same release.

## Update policy

| Field | Type | Meaning |
|---|---|---|
| `update.sequence` | Positive safe integer | Monotonically increasing stable-channel sequence used for replay resistance. |
| `update.minimumSupportedVersion` | SemVer string | Oldest application version offered this update. It must be the oldest version in the tested application upgrade matrix, or the current version when no earlier public baseline exists. |
| `update.releaseNotes` | Localized text object | Concise update-notification text. `en-US` and `es-ES` are mandatory; additive valid locale tags are allowed. |
| `update.withdrawnVersions` | Array | Versions that the new signed channel statement withdraws. |

Each withdrawal contains a SemVer `version`, a reason from `security`, `data-integrity`, `stability`, or `compatibility`, localized `guidance`, and a nullable SemVer `replacementVersion`. Versions are unique. A release cannot withdraw itself.

## Evolution and failure behavior

Sequence and withdrawal changes are public update-policy changes and require review even when application bytes do not change. A release policy is immutable after publication; a later channel statement uses a new reviewed policy and higher sequence. Missing locales, divergence from the compatibility matrix, duplicates, unknown fields, or invalid versions block preparation before signing credentials are used.
