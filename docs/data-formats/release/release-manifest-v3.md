# FitFreed Public Release Manifest Version 3

## Purpose and authority

The public release manifest binds one stable macOS release to its exact source, platform boundary, application identity, Apple trust evidence, update-channel state, compatibility statement, dependency inventories, artifact digests, and required provenance subjects. This document is the normative human-readable contract. [`release-manifest-v3.schema.json`](../../../schemas/release-manifest-v3.schema.json) is its machine-readable JSON Schema.

Version 3 is deliberately separate from the closed unsigned [version 2](release-manifest-v2.md) contract. Private development evidence cannot be relabeled or promoted into a public manifest: version 3 can be created only after the final application and disk-image bytes have passed Developer ID signing, Apple notarization, stapling, and Gatekeeper verification.

The manifest records verifiable technical evidence. It does not grant publication authority, prove that a GitHub attestation exists by itself, provide a warranty, or make a legal-compliance claim.

## Encoding and compatibility

- File name: `release-manifest.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.release-manifest`.
- Schema selector: integer `schemaVersion`; this contract requires `3`.
- Unknown top-level or nested properties are invalid.

Consumers must select the schema by version and reject an unsupported value. Version 3 does not change the meaning of a historical version 1 or version 2 document.

## Release and target

| Path | Required value or type | Meaning |
|---|---|---|
| `release.version` | SemVer string | Version shared by npm, Tauri, Cargo, the update envelope, and the upgrade matrix. |
| `release.revision` | Lowercase 40- or 64-character hexadecimal string | Exact clean Git commit referenced by the public tag. |
| `release.generatedAt` | RFC 3339 date-time | Source commit time used for deterministic evidence. |
| `release.channel` | `public-stable` | Public stable distribution boundary. |
| `release.signed` | `true` | Developer ID signing was objectively verified. |
| `release.notarized` | `true` | Apple notarization and stapling were objectively verified. |
| `target.os` | `macos` | Operating-system target. |
| `target.architecture` | `aarch64` | Apple Silicon target. |
| `target.minimumSystemVersion` | `15.0` | Lowest supported macOS version. |

The `application` object fixes the product name, bundle identifier, executable, and positive storage schema version. It has the same field meanings as version 2.

## Apple trust evidence

`trust.codeSigning` identifies the verified trust class without storing a certificate subject name or account address. `identity` is `developer-id-application`; `certificateSha256` binds the leaf certificate bytes; `teamIdentifier` is the ten-character Apple team identifier; and `hardenedRuntime` plus `secureTimestamp` must both be `true`.

`trust.notarization.service` is `apple-notary-service`. The application and disk image must each carry a validated stapled ticket, and Gatekeeper must accept the final distributed form. Every Boolean is fixed to `true`; absence or failure blocks manifest creation rather than producing weaker public evidence.

## Stable update state

The `update` object binds the release to `stable-v2`, the exact direct HTTPS metadata endpoint, the active metadata key identifier, and a positive monotonically increasing sequence. The manifest artifact set binds the updater archive, its Tauri signature, and the complete stable envelope by byte length and SHA-256 digest. Update signing remains independent of Apple code signing and both are mandatory.

## Artifacts

Every artifact has a unique top-level relative `path`, enumerated `kind`, positive byte `size`, and lowercase SHA-256 digest. Exactly one of each of these kinds is required:

- `macos-application-bundle`;
- `macos-disk-image`;
- `macos-updater-archive`;
- `updater-signature`;
- `stable-update-envelope`;
- `upgrade-matrix`, named `supported-upgrades.json`; and
- `release-notes`, named `RELEASE_NOTES.md`.

One or more `cyclonedx-sbom` artifacts are also required. The application-bundle digest uses the deterministic tree representation defined by version 2; every other digest covers exact file bytes. `SHA256SUMS` covers all regular evidence files other than itself and is omitted from the manifest artifact array to avoid a digest cycle.

## Provenance requirements

`provenanceRequirements` declares release acceptance criteria rather than claiming that hosted evidence already exists. `provider` is `github-artifact-attestations`. `digestBoundSubjects` must reproduce, in path order, the exact path and digest of every regular manifest artifact. The application directory is excluded because its distributed DMG and updater archive are the attested file subjects. `generatedSubjects` is the closed ordered list `release-manifest.json`, `SHA256SUMS`; these files are generated after the digest-bound artifact list and must also receive hosted attestations.

Publication verification must resolve an attestation for every declared or generated subject and compare its subject digest with the final remotely downloaded bytes. A manifest alone is not provenance evidence.

## Privacy and failure behavior

The manifest and its related evidence must not contain personal exports, application libraries, credentials, signing material, private email addresses, certificate subject names, account identifiers, or machine-local paths. A failed Apple inspection, update-envelope validation, inventory check, content scan, checksum, attestation, upload, or remote-byte comparison leaves the candidate unpublished and preserves the previous complete stable Pages snapshot.
