# Public macOS Release

## Current boundary

Public release automation is deliberately inactive. The checked-in update configuration contains no production trust key, the `public-macos-release` GitHub environment does not yet exist, and no Apple or updater signing credential is available. These are release gates, not reasons to weaken or bypass the workflow.

No command in normal continuous integration creates a tag, GitHub Release, Pages deployment, or public binary. The standing authorization for ordinary commits and pushes does not authorize any of those operations.

## Secret-free preflight

The public workflow accepts only a manual dispatch whose selected ref is the exact `v<version>` tag. Before a secret-bearing runner can start, preflight verifies:

- one version across the dispatch input, tag, npm, Tauri, Cargo, release notes, and upgrade matrix;
- a clean tagged commit reachable from `origin/main` in the canonical public repository;
- an active `stable-v2` configuration containing the selected updater key;
- the `public-macos-release` environment through GitHub's API;
- at least one required environment reviewer, disabled administrator bypass, custom deployment policies, and a `v*` tag policy; and
- public repository visibility.

The environment query returns only a sanitized reviewer count in preflight output. Reviewer identities and raw environment configuration are not retained as release evidence.

GitHub does not expose environment secrets to a job until its protection rules pass. Merely naming an environment in a workflow is insufficient because GitHub can create a missing environment without the intended protection. The independent API preflight therefore fails before the protected job when the environment is missing or weaker than the required policy. See GitHub's [deployment environment reference](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) and [deployment branch policy API](https://docs.github.com/en/rest/deployments/branch-policies).

## Future protected inputs

The protected environment will own the Apple signing-certificate import material, Apple notarization credential, Tauri updater private key and password, expected Apple team identifier, and non-personal signing-certificate hash. These values must never be repository, workflow-dispatch, command-line, cache, artifact, Pages, Release, or diagnostic-log content.

The public update key identifier and public key are not secrets. They become active only through a reviewed change to the versioned public update configuration. Key custody, activation, rotation, compromise, and withdrawal procedures are completed in M3.4 before publication.

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
