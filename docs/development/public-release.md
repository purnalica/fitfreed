# Public Release Architecture

## Current boundary

Public binary release automation is deliberately inactive. The checked-in update and release-checksum configurations contain no production trust keys, the `public-macos-release` environment is not configured, and no Apple, updater, release-checksum, or Windows Authenticode authority is available. Repository-level immutable Releases are enabled, and Actions-backed Pages is live at the canonical origin for the product site without an application download. The initial macOS and first Linux-expansion workflows exist but remain inactive; the public Windows expansion workflow is not yet implemented. These are release gates, not reasons to weaken or bypass an implemented or planned publication workflow.

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

The first platform-expansion release additionally defines the distinct
`FITFREED_RELEASE_PRIVATE_KEY` and `FITFREED_RELEASE_PRIVATE_KEY_PASSWORD` pair. That authority signs the complete
platform-neutral `SHA256SUMS` set; it is not the updater key and cannot be supplied to the secret-free Linux build or
the promotion job.

The future protected Windows native-builder environment additionally defines
`FITFREED_WINDOWS_CERTIFICATE_BASE64` and `FITFREED_WINDOWS_CERTIFICATE_PASSWORD` as secrets, plus
`FITFREED_WINDOWS_CERTIFICATE_SHA256` and `FITFREED_WINDOWS_TIMESTAMP_URL` as non-secret protected variables. The
authority installer derives the certificate-store selector and absolute Windows SDK SignTool path at runtime, exports
only the five signing-adapter values, and removes the PFX immediately. Its unconditional cleanup removes the exact
current-user certificate and private key and clears those values. Neither the native input nor any retained evidence
contains the certificate bundle, password, selector, or machine-local SignTool path.

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
- `pages/` contains the exact localized product site plus `updates/stable.json` and
  `updates/<version>/<updater-archive>` as one indivisible future Pages deployment.

The stable envelope is signed over exact payload bytes with the same protected Tauri signing authority used for the updater archive. A seven-day validity window is derived from the explicit issuance time. All digests and checksums are generated from final signed and notarized bytes, then the complete staging tree passes local-path and secret scanning before atomic promotion. Preparation does not upload, attest, tag, release, or deploy anything.

`npm run verify:public-release -- .artifacts/public-releases/<version>` independently selects the immutable manifest
contract and reopens the closed target set, every artifact, compatibility matrix, checksum set, stable payload and
envelope, configured trust keys, updater-signature bindings, and exact Pages tree. Manifest version 3 admits only the
initial macOS set; manifest version 6 admits exactly `darwin-aarch64` plus `linux-x86_64-deb`; manifest version 7
admits exactly those two targets plus `windows-x86_64-nsis`. It compares Release and Pages copies byte for byte and
rejects any missing, additional, renamed, cross-version, cross-target, or mutated subject. Preparation invokes this
verifier before promotion; transport, publication, and remote acceptance invoke it again without reinterpreting an
older manifest.

Those same target sets drive the localized product-page download surface. Version 3 exposes only the DMG, version 6
adds the Debian package, and version 7 adds the NSIS setup. These are direct human installer links to immutable,
versioned GitHub Release assets; updater archives and signatures remain confined to the authenticated `/updates/`
contract. Ordinary `npm run build:pages` output remains inactive. Candidate verification reconstructs both locale
surfaces from the manifest, so hand-edited, stale, missing, or additional release links fail before promotion.

## Platform-expansion preparation

The first Linux publication is a new complete-platform release after an immutable public macOS predecessor, never a
Linux asset appended to that predecessor. Its exact version is assigned only after the preceding Release exists.
`release/upgrade-matrix.json` must then use the target-aware version 2 contract and identify that real predecessor and
its `darwin-aarch64` target. The update configuration must activate recoverable `stable-v3`, while the separate
release-signing configuration must activate the platform-neutral checksum key selected by the dispatch.

`.github/workflows/public-linux-expansion.yml` first runs the same exact-tag, exact-CI, Pages, and protected-environment
preflight and additionally queries the immutable predecessor Release and both active trust sets. A secret-free
`ubuntu-24.04` job runs `npm run prepare:linux-expansion-input -- <version> <directory>`, producing only the unsigned
Debian package, its complete package inventory, and source/schema-bound Linux build evidence after clean-container
installation and removal. The package executable embeds the active public `stable-v3` endpoint and updater trust, but
the build neither receives updater private-key material nor generates a signature. `npm run pack:linux-expansion-input`
verifies those three files, seals them, and exposes the archive digest. No Apple, updater, checksum, environment, or
publication authority reaches this job.

After the first approval, the Apple Silicon job downloads only that run's named Linux artifact and runs
`npm run unpack:linux-expansion-input -- <archive> <sha256> <directory> <version> <revision> <schema>`. Digest,
archive layout, package, inventory, version, source revision, and storage schema must all agree before release
authority is installed. `npm run prepare:linux-expansion-release` then builds fresh same-version signed and notarized
macOS artifacts, copies the application with macOS metadata preservation, signs the exact Debian bytes with the
updater key, signs the complete checksum inventory with the distinct release key, and composes one atomic manifest
version 6 candidate and one complete stable-v3 Pages snapshot. A target present only in release evidence, Pages, or
signed metadata is rejected.

The composer then seals that complete candidate before independent Linux admission. The secret-free
`admit-linux-candidate` matrix downloads only that run's digest-bound archive on x86-64 Ubuntu 24.04 and 26.04,
reopens the generic manifest version 6 candidate, and installs the exact Debian path returned by that verifier. Each
row verifies installed identity, executable and resource paths, dynamic linking, graphical first launch into an
isolated private library, the production cold-launch budget, native purge, and retained-library integrity. A finalizer
removes residual package state after any result. `publish-candidate` cannot enter its second protected approval until
both rows pass; rebuilding or substituting a package is not an admission path.

The later Windows publication is another new complete-platform release after an immutable macOS-plus-Linux
predecessor. It does not append a Windows file to that Release. The implemented Windows native input boundary runs
from native x86-64 Windows under separate protected Windows Authenticode authority. It builds and independently
inspects the timestamped current-user NSIS setup, performs its installation and data-preserving removal cycle, and
seals exactly that setup, its package inventory, and source-bound build evidence. It rejects updater private-key and
release-checksum authority.

The implemented complete-platform composition kernel reopens the digest-bound Linux and Windows inputs for one
version, revision, and storage schema. Under separate Apple, updater, and release-checksum authority, it builds fresh
macOS artifacts, adds updater signatures to the unchanged Linux and Windows packages, and creates one complete-platform
manifest version 7 candidate plus one complete stable-v3 Pages snapshot. Its independent verifier binds the Windows
package, Authenticode fingerprint, native inventory, build evidence, updater signature, checksums, release signature,
recovery set, and manifest-derived localized download links in the Pages bytes.

The shared `pack:public-release`, `unpack:public-release`, `publish:public-release`, and
`verify:remote-public-release` boundaries now accept that closed version 7 contract directly. Transport preserves its
ordered three-target result. Publication derives the exact asset set and attributes provenance to
`.github/workflows/public-windows-expansion.yml`; remote acceptance downloads every current and recovery package,
reconstructs the manifest-derived localized Pages snapshot, and reopens the distributed evidence. The named workflow
does not yet exist, so these generic mechanics do not make Windows publication runnable.

The protected Apple Silicon composition entry point is:

```bash
npm run prepare:complete-platform-release -- \
  <version> <update-key-id> <release-key-id> <issued-at> \
  <linux-input-directory> <windows-input-directory> \
  <windows-certificate-sha256> <predecessor-evidence-directory>
```

Both native input directories must already have passed their digest-bound transport reopening. The final public
Windows certificate SHA-256 fingerprint is a public lowercase value and must match the sealed Windows input; no
certificate selector or Authenticode private authority reaches this process. The predecessor evidence root contains
exactly one directory for every package-bearing application baseline declared by the upgrade matrix. Each version
directory contains its immutable distributed `release/` tree. Preparation reopens the complete signed manifest
version 6 or manifest version 7 Release evidence before admitting any Linux or Windows recovery package from it. The
mutable product-site presentation is deliberately not an authority for predecessor bytes; the release checksum,
detached checksum signature, updater signatures, stable envelope, and immutable manifest provide that authority.
Loose package paths, stale versions, changed bytes, partial evidence, and unsupported predecessor contracts fail before
the dependency audit or macOS build.

The command requires the same protected Apple, updater, and independent release-checksum environment as the Linux
composer. It produces only `.artifacts/public-releases/<version>/{release,pages}`, invokes the independent complete
verifier before atomic promotion, removes incomplete output after failure, and does not publish, attest, tag, upload,
or deploy anything. Reopen the result independently with:

```bash
npm run verify:complete-platform-release -- .artifacts/public-releases/<version>
```

The public Windows expansion workflow is not yet implemented, so this production preparation command and the generic
version 7 publication mechanics are not a runnable public release path and no existing workflow may be represented as
one.

A future Windows workflow must preserve the native-builder/composer separation, add exact supported-Windows-11
candidate admission, and reuse the second-approval publication boundary. A native input or complete candidate is never
rebuilt as a substitute for the sealed bytes after a downstream failure; recovery reopens the retained transport and
repeats only the failed authority-free admission or publication work.

## Sealed evaluation and protected publication

`.github/workflows/public-release.yml` is the initial macOS publication entry point. It is manually dispatched while selecting the exact `v<version>` ref and supplying only `version` and the public `update_key_id`. The later `.github/workflows/public-linux-expansion.yml` entry point additionally accepts the public release-checksum key identifier and constructs the complete macOS-plus-Linux set described above. Both share one non-cancelling publication concurrency group.

The first protected job has read-only repository permission. After local verification it seals only `release/` and `pages/` into one transport archive, records its SHA-256 digest, retains it for seven days as a private Actions artifact, and unconditionally removes Apple and updater authority. `npm run pack:public-release -- <candidate> <archive>` and `npm run unpack:public-release -- <archive> <sha256> <candidate>` verify the complete candidate on both sides of this boundary and reject mutation, additional roots, unsafe paths, partial extraction, or evidence drift.

Both exact Linux candidate matrix rows must pass before the publication job can wait at the same environment for a
second approval. While it waits, automation verifies the sealed candidate's functional and distribution behavior, and
the product owner follows the bounded [macOS product-experience procedure](../testing/macos-candidate-manual-evaluation.md)
on that same artifact. Promotion is rejected when the exact bytes did not pass, a serious finding remains open, or the
seven-day signed metadata window expires. The second job receives no Apple or updater secret, downloads only the same
run's named artifact, verifies its job-bound digest, and reopens the entire candidate before it can create a public
effect.

After that acceptance, GitHub creates provenance attestations for every file in `SHA256SUMS`, for the checksum file itself, and, on a platform expansion, for its detached checksum signature. The complete localized product-and-update Pages artifact is uploaded but remains private. `npm run publish:public-release -- <candidate>` then creates an exact draft without asset replacement, verifies its names, sizes, digests, notes, source-bound provenance, and tag, publishes it, and requires GitHub to report it as immutable. An existing public release is reusable only when every field and byte already agrees; drift fails rather than overwriting evidence.

The Pages job runs only after immutable Release publication. This ordering preserves the previous complete application update snapshot when Release publication or Pages artifact upload fails. A subsequent secret-free job runs:

```bash
npm run verify:remote-public-release -- <version> <revision>
```

It downloads the exact Release assets, verifies their GitHub-linked attestations against this workflow, tag, and source revision, reopens the distributed manifest, checksums, inventories, matrix, notes, and signed channel, then fetches every current and required recovery package plus every public product-site object with redirects disabled. Bounded polling tolerates Pages propagation only when the complete remote site converges to the exact release source, sizes, and SHA-256 digests. No Apple or updater authority reaches deployment or remote verification.

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
