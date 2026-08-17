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
