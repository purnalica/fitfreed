# Public macOS Release

## Current boundary

Public release automation is deliberately inactive. The checked-in update configuration contains no production trust key, GitHub Pages and the `public-macos-release` environment are not configured, repository release immutability is disabled, and no Apple or updater signing credential is available. The documented command currently prepares the verified two-file update snapshot; ADR 0020 additionally requires the exact product site to be composed before Pages upload, and that implementation gate remains open. These are release gates, not reasons to weaken or bypass the workflow.

No command in normal continuous integration creates a tag, GitHub Release, Pages deployment, or public binary. The standing authorization for ordinary commits and pushes does not authorize any of those operations.

## Secret-free preflight

The public workflow accepts only a manual dispatch whose selected ref is the exact `v<version>` tag. Before a secret-bearing runner can start, preflight verifies:

- one version across the dispatch input, tag, npm, Tauri, Cargo, release notes, and upgrade matrix;
- a clean tagged commit reachable from `origin/main` in the canonical public repository;
- an active `stable-v2` configuration containing the selected updater key;
- the `public-macos-release` environment through GitHub's API;
- at least one required environment reviewer, prevented self-review, disabled administrator bypass, custom deployment policies, and the single `v*` tag policy;
- Actions-backed GitHub Pages at the canonical project URL with HTTPS enforced;
- successful `push` executions of `ci.yml` and `repository-safety.yml` for the exact release revision;
- the local and remote `v<version>` tag resolving to that exact revision; and
- public repository visibility.

The environment query returns only a sanitized reviewer count in preflight output. Reviewer identities and raw environment configuration are not retained as release evidence.

GitHub does not expose environment secrets to a job until its protection rules pass. Merely naming an environment in a workflow is insufficient because GitHub can create a missing environment without the intended protection. The independent API preflight therefore fails before the protected job when the environment is missing or weaker than the required policy. See GitHub's [deployment environment reference](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) and [deployment branch policy API](https://docs.github.com/en/rest/deployments/branch-policies).

## Protected inputs

The protected environment owns the Apple signing-certificate import material, Apple notarization credential, Tauri updater private key and password, expected Apple team identifier, non-personal signing-certificate hash, and one fine-grained GitHub token limited to repository Administration read. That token verifies release immutability; the short-lived job token separately publishes the release. These values must never be repository, workflow-dispatch, command-line, cache, artifact, Pages, Release, or diagnostic-log content.

The workflow uses App Store Connect API-key notarization, so it does not need an interactive Apple ID or application-specific password during execution. It still requires an authorized Developer ID Application certificate and the App Store Connect issuer, key identifier, and private key created under the project's Apple developer authority.

The protected environment defines these secrets:

- `FITFREED_GITHUB_ADMIN_READ_TOKEN`;
- `FITFREED_APPLE_CERTIFICATE_BASE64` and `FITFREED_APPLE_CERTIFICATE_PASSWORD`;
- `FITFREED_APPLE_API_PRIVATE_KEY`;
- `FITFREED_UPDATER_PRIVATE_KEY`; and
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

It defines these non-secret variables:

- `FITFREED_APPLE_SIGNING_IDENTITY_SHA1`;
- `FITFREED_APPLE_TEAM_ID`;
- `FITFREED_APPLE_API_ISSUER`; and
- `FITFREED_APPLE_API_KEY_ID`.

The public update key identifier and public key are not secrets. They become active only through a reviewed change to the versioned public update configuration. The [public release operations runbook](public-release-operations.md) owns key custody, activation, rotation, compromise, withdrawal, and partial-publication recovery.

## Objective trust gate

After the protected build, `npm run check:public-macos-trust -- <application> <disk-image> <version> <team-id>` verifies Developer ID, hardened runtime, secure timestamp, matching leaf certificate, application identity, Apple Silicon and macOS 15.0 boundaries, stapled tickets, and Gatekeeper acceptance. It emits only the public fingerprint, team identifier, and Boolean trust results needed by the [public release manifest](../data-formats/release/release-manifest-v3.md).

Synthetic tests prove orchestration and failure behavior but cannot claim Apple trust. A public candidate remains blocked until the same inspector succeeds against the exact final Developer ID-signed and Apple-notarized bytes.

## Protected preparation

After preflight and environment approval, `npm run prepare:public-release -- <version> <update-key-id> <issued-at>` repeats preflight inside the protected job, requires Apple Silicon macOS, and accepts exactly one complete Apple notarization credential mode. The Developer ID identity is supplied as a certificate SHA-1 fingerprint rather than a subject name. The updater private key and App Store Connect private key must be absolute regular files outside the repository with no group or other permissions; an inline updater private key is rejected. The updater password remains an environment secret and is never passed as a command-line argument.

Preparation deletes only the generated Tauri bundle directory before building, preventing stale private or test artifacts from satisfying a public check. Tauri creates the signed, notarized application, DMG, updater archive, and updater signature. The objective Apple trust inspector runs before evidence is assembled.

The command creates one ignored atomic directory at `.artifacts/public-releases/<version>/` with two children:

- `release/` contains the final application, DMG, updater archive and detached signature, stable envelope, CycloneDX inventories, upgrade matrix, reviewed release notes, public manifest version 3, and checksums; and
- `pages/` contains only `updates/stable.json` and `updates/<version>/<updater-archive>` for a future Pages deployment.

The stable envelope is signed over exact payload bytes with the same protected Tauri signing authority used for the updater archive. A seven-day validity window is derived from the explicit issuance time. All digests and checksums are generated from final signed and notarized bytes, then the complete staging tree passes local-path and secret scanning before atomic promotion. Preparation does not upload, attest, tag, release, or deploy anything.

`npm run verify:public-release -- .artifacts/public-releases/<version>` independently reopens the closed manifest, every artifact, the compatibility matrix, checksum set, stable payload and envelope, configured key, updater signature binding, and the exact two-file Pages tree. It compares the Release and Pages copies byte for byte and rejects any missing, additional, renamed, or mutated subject. Preparation invokes this verifier before promotion; publication invokes it again after artifact transport.

## Sealed evaluation and protected publication

`.github/workflows/public-release.yml` is the only versioned publication entry point. It is manually dispatched while selecting the exact `v<version>` ref and supplying only `version` and the public `update_key_id`. Its concurrency group never cancels an active release.

The first protected job has read-only repository permission. After local verification it seals only `release/` and `pages/` into one transport archive, records its SHA-256 digest, retains it for seven days as a private Actions artifact, and unconditionally removes Apple and updater authority. `npm run pack:public-release -- <candidate> <archive>` and `npm run unpack:public-release -- <archive> <sha256> <candidate>` verify the complete candidate on both sides of this boundary and reject mutation, additional roots, unsafe paths, partial extraction, or evidence drift.

The publication job waits at the same environment for a second approval. While it waits, an independent evaluator follows the [macOS candidate procedure](../testing/macos-candidate-manual-evaluation.md) on that sealed artifact. Promotion is rejected when the exact bytes did not pass, a serious finding remains open, or the seven-day signed metadata window expires. The second job receives no Apple or updater secret, downloads only the same run's named artifact, verifies its job-bound digest, and reopens the entire candidate before it can create a public effect.

After that acceptance, GitHub creates provenance attestations for every file in `SHA256SUMS` and for the checksum file itself. The two-file Pages artifact is uploaded but remains private. `npm run publish:public-release -- <candidate>` then creates an exact draft without asset replacement, verifies its names, sizes, digests, notes, source-bound provenance, and tag, publishes it, and requires GitHub to report it as immutable. An existing public release is reusable only when every field and byte already agrees; drift fails rather than overwriting evidence.

The Pages job runs only after immutable Release publication. This ordering preserves the previous complete application update snapshot when Release publication or Pages artifact upload fails. A subsequent secret-free job runs:

```bash
npm run verify:remote-public-release -- <version> <revision>
```

It downloads the exact Release assets, verifies their GitHub-linked attestations against this workflow, tag, and source revision, reopens the distributed manifest, checksums, inventories, matrix, notes, and signed channel, then fetches the direct stable envelope and updater archive with redirects disabled. Bounded polling tolerates Pages propagation only when both objects converge to the exact release sizes and SHA-256 digests. No Apple or updater authority reaches deployment or remote verification.

The [operations runbook](public-release-operations.md) defines normal promotion, the exact-candidate handoff, draft cleanup authority, Release-before-Pages recovery, Pages containment, higher-sequence correction, withdrawal, key rotation, compromise, and incident communication. Rebuilding after immutable publication is never used as a substitute for the sealed bytes.

## One-time platform prerequisites

Before the first dispatch, maintainers must explicitly:

1. activate the reviewed public update configuration and production public key;
2. enable immutable releases for future releases;
3. configure GitHub Pages to deploy through Actions with HTTPS;
4. create `public-macos-release`, require at least one reviewer, prevent self-review, disable administrator bypass, and admit only `v*` tags;
5. install the protected variables and secrets listed above; and
6. create and push the reviewed exact version tag only after its CI and repository-safety runs pass.

These are accountable setting, credential, trust-root, tag, and publication actions. They are not performed by normal CI or inferred from the existence of the workflow.
