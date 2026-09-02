# FitFreed Public Stable Update Channel Version 3

## Purpose and authority

Version 3 authenticates both the current public release and every native predecessor package required to update from a
declared Linux or Windows application baseline. It prevents recovery from depending on an unauthenticated, mutable, or
unavailable package after replacement has begun.

[`update-channel-envelope-v3.schema.json`](../../../schemas/update-channel-envelope-v3.schema.json) specifies the
endpoint response. [`update-channel-payload-v3.schema.json`](../../../schemas/update-channel-payload-v3.schema.json)
specifies the exact UTF-8 JSON bytes carried and signed by that envelope. The closed [version 2](update-channel-v2.md)
remains unchanged. Version 3 adds `release.recoveryArtifacts` and changes both `schemaVersion` selectors to `3`; all
other version 2 encoding, trust, replay, withdrawal, privacy, and failure guarantees remain in force.

This contract does not activate production trust, authorize signing or publication, or imply that a platform is
released. Production keys and generated payloads remain outside Git.

## Encoding and bounds

- Endpoint media type: `application/json`; encoding: UTF-8.
- Envelope format: `org.fitfreed.update-envelope` with `schemaVersion` `3`.
- Signed payload format: `org.fitfreed.update-channel` with `schemaVersion` `3` and channel `stable`.
- Signature algorithm identifier: `minisign-ed25519`.
- `payloadBase64` carries the exact signed bytes and is verified before JSON parsing.
- The response, payload, URL, locale, target, withdrawal, package, and signature bounds remain those of version 2.
- `release.recoveryArtifacts` contains at most 256 entries. Each `librarySchemaVersions` list contains at most 1,024
  positive versions.
- Unknown fields, targets, package kinds, and recovery relations are invalid.

The endpoint remains the direct, credential-free, query-free, fragment-free HTTPS URL
`https://fitfreed.org/updates/stable.json`. Metadata and package redirects are not followed.

## Envelope

The envelope retains the version 2 fields and meanings:

| Path | Meaning |
|---|---|
| `version` | Untrusted Tauri mirror of signed `release.version`. |
| `platforms.*.url` | Untrusted mirror of the signed current-package URL. |
| `platforms.*.signature` | Untrusted mirror of the signed current-package updater signature. |
| `fitfreed.format` | Constant `org.fitfreed.update-envelope`. |
| `fitfreed.schemaVersion` | Exact selector `3`. |
| `fitfreed.algorithm` | Constant `minisign-ed25519`. |
| `fitfreed.keyId` | Selects one active embedded metadata and updater-package key. |
| `fitfreed.payloadBase64` | Exact signed payload bytes encoded as canonical Base64. |
| `fitfreed.signatureBase64` | Base64-encoded Minisign document for those exact bytes. |

Every compatibility mirror target, URL, and signature must exactly equal the signed current-platform map. Recovery
artifacts are application-owned policy and are deliberately absent from Tauri's compatibility mirror.

## Signed release and recovery artifacts

Version 3 retains `format`, `channel`, `sequence`, `issuedAt`, `expiresAt`, `release.version`, `release.publishedAt`,
`release.minimumSupportedVersion`, `release.librarySchema`, `release.releaseNotes`, `release.platforms`, and
`withdrawnVersions` exactly as version 2 defines them.

`release.recoveryArtifacts` is a canonical list ordered first by SemVer precedence and then by `target`. One entry
binds one declared source application version and one natively reinstallable target:

| Path | Meaning |
|---|---|
| `release.recoveryArtifacts.*.version` | Exact prior application version. It is older than `release.version`. |
| `release.recoveryArtifacts.*.target` | Exact `linux-x86_64-deb` or `windows-x86_64-nsis` source target. The same target exists in `release.platforms`. |
| `release.recoveryArtifacts.*.packageKind` | Exact `deb` or `nsis` kind implied by `target`. |
| `release.recoveryArtifacts.*.librarySchemaVersions` | Sorted unique source schemas qualified with that application and target. |
| `release.recoveryArtifacts.*.url` | Direct immutable HTTPS URL for the exact predecessor package. |
| `release.recoveryArtifacts.*.size` | Exact predecessor package length from 1 through 1 GiB. |
| `release.recoveryArtifacts.*.sha256` | Lowercase SHA-256 of the predecessor bytes. |
| `release.recoveryArtifacts.*.tauriSignature` | Mandatory updater Minisign signature for the predecessor bytes. |

The recovery list is empty for a first release with no application baseline. macOS does not receive an entry because
its closed recovery version 1 preserves the exact running application locally rather than reacquiring a native
package. A future natively reinstallable target requires a later contract unless this version already names its exact
target and package kind.

## Cross-contract invariants

1. The release process derives the required recovery triples—source version, target, and library schemas—from the
   release-bound upgrade matrix. The signed list contains exactly those triples for Debian and NSIS targets: no
   omission, addition, duplicate, or substitution is accepted.
2. Every recovery target also exists in the current release's `platforms` map. A platform cannot advertise an update
   without shipping its current package.
3. `packageKind` is `deb` only for `linux-x86_64-deb` and `nsis` only for `windows-x86_64-nsis`.
4. Every recovery version precedes the current release by SemVer. Each source schema is within the current release's
   readable source range and the list is strictly increasing.
5. Current and recovery package URLs are direct, credential-free, query-free, fragment-free HTTPS locations.
6. Size, SHA-256, updater signature, version, target, package kind, and source schemas are authenticated by the metadata
   signature. Recovery preparation then verifies the package's native identity and complete contents.
7. A missing or invalid recovery entry makes that installed-version and target combination ineligible for in-app
   replacement. It is never downgraded to a warning or a network-time recovery attempt.

The version 2 time, replay, equivocation, mirror, localization, library, withdrawal, downgrade, fresh-authorization,
and current-package validation invariants continue unchanged.

## Staging, retention, and privacy

Atomic Pages staging includes the current packages, `stable.json`, and every predecessor package named by the signed
recovery list. A later deployment cannot remove a predecessor while an advertised baseline still refers to it. Each
predecessor is byte-identical to the immutable package already admitted for its own release; staging never rebuilds or
resigns it.

Recovery entries contain only public release compatibility and integrity evidence. They contain no installation,
account, locale, fitness, health, route, provider, library, device, interaction, credential, or machine-local value.
The update request remains static and reveals no installed version or library schema. Selecting a package URL
necessarily reveals the requested public artifact to the server and network path.

Malformed encoding, unsupported schema, missing target, invalid signature, unsafe URL, baseline disagreement, package
mutation, expiry, replay, equivocation, or any version 2 trust failure is untrusted. It cannot change persisted trust,
download an application or predecessor, start replacement, touch the library, or delete retained recovery evidence.
