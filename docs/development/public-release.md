# Public Release Architecture

## Current boundary

Public binary release automation remains gated and has not published an application. The checked-in update
configuration contains the reviewed public `stable.primary-1` trust key, while release-checksum trust remains
inactive. No private updater, Apple, release-checksum, or Windows Authenticode authority is present in source or
ordinary continuous integration. The protected environment contains the updater and Apple authority required for the
initial macOS candidate. Protected runs have signed updater artifacts, but the standalone stable-metadata signature
has not yet completed inside a sealed candidate. The environment also contains the repository-scoped
Administration-read token used only to verify immutable Releases; that permission
check passed inside the first protected execution.
The `public-macos-release` environment is configured with the bootstrap reviewer, initiator approval, disabled
administrator bypass, and the single `v*` tag policy. The later Linux and Windows release authorities and environments
remain unavailable. Repository-level immutable Releases are enabled, and Actions-backed Pages is live at the
canonical origin for the product site without an application download or signed update snapshot. The initial macOS
workflow is active only through explicit dispatch and two protected approvals. The first Linux-expansion and
complete-platform Windows-expansion workflows exist but remain inactive. These are release gates, not reasons to weaken or
bypass an implemented publication workflow.

The first `v0.1.0` dispatch on 2026-09-10 stopped in the secret-free preflight before any protected environment or
credential was admitted. The preflight expected a runner environment variable for repository visibility that GitHub
does not provide. Current source obtains the canonical repository identity and live visibility from GitHub's read-only
repository API alongside the existing Pages, workflow, and environment evidence. The public `v0.1.0` tag remains
fixed at the rejected source and is neither moved nor reused.

The `v0.1.1` dispatch on 2026-09-11 passed the secret-free preflight, the first protected approval, immutable-Release
permission verification, and ephemeral Apple and updater authority installation. Candidate preparation then repeated
the live preflight without receiving the job-scoped read-only GitHub token and stopped before building, signing,
notarizing, sealing, or publishing any artifact. The protected authority cleanup passed. Current source makes that
read-only token an explicit preparation input and verifies the boundary through the workflow contract. The public
`v0.1.1` tag remains fixed at the rejected source and is neither moved nor reused; the corrected first publishable
candidate is 0.1.2.

The `v0.1.2` dispatch on 2026-09-11 passed both preflights and every protected prerequisite. It built and Developer
ID-signed the application, Apple accepted notarization, the workflow stapled the application, and it built and signed
the DMG. Tauri then refused to create the updater signature because its 2.11.4 bundle path reads
`TAURI_SIGNING_PRIVATE_KEY`, while the protected installer exposed only `TAURI_SIGNING_PRIVATE_KEY_PATH`. The latter
is accepted by Tauri's signer subcommand but is not the bundle command's private-key input. Cleanup passed, and no
candidate was sealed, retained, or published. Current source exposes both names as the same private absolute file path,
never as key contents, and rejects a missing, inline, or mismatched value before packaging. The public `v0.1.2` tag
remains fixed at the rejected source and is neither moved nor reused; its corrected successor was 0.1.3.

The `v0.1.3` [dispatch `34619731032`](https://github.com/purnalica/fitfreed/actions/runs/34619731032) proved that
private-key correction, passed both preflights, compiled the application, completed Developer ID signing, received an
accepted Apple notarization result, stapled the application, and built and signed the DMG. Updater signing then stopped
because updater-artifact generation still read the empty ordinary Tauri `plugins.updater.pubkey` value. The canonical
public update configuration held the complete reviewed Base64-wrapped Minisign public key and embedded it in the
application trust set, but candidate construction had not selected that public key for Tauri's separate artifact
signer. Cleanup passed; no candidate was sealed, retained, or published. Current source derives a final public Tauri
configuration from the exact selected key in the canonical trust set and rejects an inactive or unknown selection
before packaging. The public `v0.1.3` tag remains fixed at the rejected source and is neither moved nor reused; the
corrected successor was 0.1.4.

The `v0.1.4` [dispatch `34623724477`](https://github.com/purnalica/fitfreed/actions/runs/34623724477) passed both
preflights, built and Developer ID-signed the application, received Apple's accepted notarization result, stapled the
application, built and signed the DMG, and emitted the updater archive and its signature. This proved the selected
public-key handoff. The objective trust pass then stopped at a generic code-signing failure before candidate sealing.
Source inspection established a separate structural gap: Tauri 2.11.4 finalizes the application through notarization
and stapling, but creates the subsequent DMG with only its generic signing step. That does not satisfy FitFreed's
contract for the final distributable container. Current source explicitly verifies, signs with a stable identifier
and secure timestamp, notarizes, checks the notarization log, and staples the final DMG before objective trust
inspection. Every command failure now identifies its exact stage without emitting raw signing diagnostics. Cleanup
passed; no candidate was sealed, retained, or published. The public `v0.1.4` tag remains fixed at the rejected source
and is neither moved nor reused; its corrected successor was 0.1.5.

The `v0.1.5` [dispatch `34628632360`](https://github.com/purnalica/fitfreed/actions/runs/34628632360) passed
preflight and independently signed, notarized, inspected, and stapled the final DMG after Tauri completed the same
application boundary and emitted the updater archive and signature. Stage-specific objective trust then stopped while
extracting the application's leaf signing certificate. A local reproduction against an existing signed application
established the command-contract defect: macOS `codesign` requires the output prefix in the single
`--extract-certificates=<prefix>` argument form; when supplied as a following argument, it treats that prefix as
another candidate path. The synthetic command mock had accepted the non-operational form. Current source encodes the
actual command shape in both implementation and contract test. Cleanup passed; no candidate was sealed, retained, or
published. The public `v0.1.5` tag remains fixed at the rejected source and is neither moved nor reused; the next
candidate was 0.1.6.

The `v0.1.6` [dispatch `34636087709`](https://github.com/purnalica/fitfreed/actions/runs/34636087709) passed both
preflights from exact source `575efec`, built and signed the updater archive, independently signed, notarized,
inspected, and stapled the final DMG, and passed the corrected leaf-certificate extraction boundary. Stable-channel
assembly then invoked Tauri's standalone signer with both `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PATH`. Those names intentionally point to the same protected file for the bundle and
standalone signer consumers, but the standalone command maps them to mutually exclusive options and rejected the
invocation before signing stable metadata. Current source removes the bundle-only variable from that one child
process while retaining the path and password inputs. A focused contract test preserves the exact path-only child
environment without mutating the protected parent environment. Cleanup passed; no candidate was sealed, retained,
or published. The public `v0.1.6` tag remains fixed at the rejected source and is neither moved nor reused; the next
candidate is 0.1.7.

An externally held G2 Developer ID Application identity has a valid Apple trust chain. Its non-secret exact
certificate fingerprint and expected Apple team identifier are configured in `public-macos-release`; its exportable
certificate bundle and separately supplied password are stored there as protected secrets. The environment also holds
an App Store Connect team API private key and its exact non-secret issuer and key identifiers. Authentication against
Apple's notarization service passes outside the workflow. The protected 0.1.2 through 0.1.6 executions imported the
certificate and private key, signed the application and DMG, submitted the application, received Apple's accepted
notarization result, and stapled the application. Version 0.1.4 proved updater artifact signing; version 0.1.5 also
proved independent final-DMG signing, notarization, log inspection, and stapling before objective certificate
inspection exposed the command-shape defect. Version 0.1.6 passed that corrected inspection and exposed the distinct
standalone metadata-signer environment boundary. No unsealed runner-local output was retained or published, and
unconditional authority cleanup passed.

No command in normal continuous integration creates a tag, GitHub Release, Pages deployment, or public binary. The standing authorization for ordinary commits and pushes does not authorize any of those operations.

## Secret-free preflight

The public workflow accepts only a manual dispatch whose selected ref is the exact `v<version>` tag. Before a secret-bearing runner can start, preflight verifies:

- one version across the dispatch input, tag, npm, Tauri, Cargo, release notes, and upgrade matrix;
- a clean tagged commit reachable from `origin/main` in the canonical public repository;
- an active `stable-v2` configuration containing the selected updater key;
- the `public-macos-release` environment through GitHub's API;
- the project owner as a required environment reviewer, initiator approval allowed under bootstrap governance,
  disabled administrator bypass, custom deployment policies, and the single `v*` tag policy;
- Actions-backed GitHub Pages at the canonical project URL with HTTPS enforced;
- successful `push` executions of `ci.yml` and `repository-safety.yml` for the exact release revision;
- the local and remote `v<version>` tag resolving to that exact revision; and
- current public repository identity and visibility read from GitHub's repository API.

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

The protected Windows native-builder environment additionally defines
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

The public update key identifier and public key are not secrets. The reviewed `stable.primary-1` key is active in the
versioned public update configuration; activation alone supplies no private signing authority and publishes no update.
The [public release operations runbook](public-release-operations.md#activate-the-public-updater-trust) owns key
custody, activation, rotation, compromise, withdrawal, and partial-publication recovery.

## Objective trust gate

After the protected build and explicit final-DMG notarization, `npm run check:public-macos-trust -- <application> <disk-image> <version> <team-id>` verifies Developer ID, hardened runtime, secure timestamp, matching leaf certificate, application identity, Apple Silicon and macOS 15.0 boundaries, stapled tickets, and Gatekeeper acceptance. It emits only the public fingerprint, team identifier, and Boolean trust results needed by the [public release manifest](../data-formats/release/release-manifest-v3.md). Command failures identify the exact trust stage without copying raw tool output into logs.

Synthetic tests prove orchestration and failure behavior but cannot claim Apple trust. A public candidate remains blocked until the same inspector succeeds against the exact final Developer ID-signed and Apple-notarized bytes.

## Protected preparation

After preflight and environment approval, `npm run prepare:public-release -- <version> <update-key-id> <issued-at>` repeats preflight inside the protected job with only the job-scoped read-only GitHub token needed to reopen repository, Pages, workflow, and environment evidence. It requires Apple Silicon macOS and accepts exactly one complete Apple notarization credential mode. The Developer ID identity is supplied as a certificate SHA-1 fingerprint rather than a subject name. The updater private key and App Store Connect private key must be absolute regular files outside the repository with no group or other permissions; an inline updater private key is rejected. The authority installer maps the same updater file path to FitFreed's path input and Tauri's bundle input because the pinned Tauri bundle command reads `TAURI_SIGNING_PRIVATE_KEY`, while its signer subcommand supports `TAURI_SIGNING_PRIVATE_KEY_PATH`. The two protected parent values must be identical paths and never key contents. Candidate construction keeps both inputs for packaging, then removes the bundle-only variable from the standalone stable-metadata signer child so that Tauri receives exactly its path option and the inherited password. It also selects the requested public key from the canonical active trust set and supplies its unchanged Base64-wrapped Tauri value through a final command-scoped configuration merge. Missing, inactive, malformed, or unknown public trust fails before native packaging. The updater password remains an environment secret and is never passed as a command-line argument.

Preparation deletes only the generated Tauri bundle directory before building, preventing stale private or test artifacts from satisfying a public check. Tauri creates the signed and notarized application, the initial DMG, the updater archive, and the updater signature. FitFreed then treats the exact DMG as an independent final distribution container: it verifies the image, signs it with the admitted Developer ID fingerprint, secure timestamp, and `org.fitfreed.desktop.dmg` identifier, submits that final image to Apple, requires an accepted issue-free notarization log, and staples and validates its ticket. The objective Apple trust inspector runs only after this finalization and before evidence is assembled. The same boundary is shared by the macOS-only, Linux-expansion, and complete-platform composers.

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
reconstructs the manifest-derived localized Pages snapshot, and reopens the distributed evidence.

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

`.github/workflows/public-windows-expansion.yml` implements that production path but remains manually dispatched and
inactive until every external gate is configured. Its secret-free preflight requires the immutable macOS-plus-Linux
predecessor, active independent updater and checksum trust, all three protected environments, exact successful source
checks, Pages, and the workflow policy. The certificate fingerprint comes only from the protected
`public-windows-release` environment; a dispatcher cannot select it.

The protected `fitfreed-windows-11-builder` job creates and seals the native input, after which the Apple Silicon
composer downloads and independently reopens every immutable predecessor Release through
`npm run download:complete-platform-predecessors -- <directory>`. The downloader stages each complete `release/` tree,
rejects non-files and partial downloads, reopens every matrix-required recovery package through authenticated release
evidence, and exposes the destination only after the entire set passes.

The complete sealed candidate then passes both Ubuntu admission rows and the separate secret-free
`fitfreed-windows-11-admission` runner. That Windows 11 x86-64 host is admitted through the reviewed
[Windows candidate policy](../data-formats/release/windows-candidate-admission-policy-v1.md), then verifies the exact
public setup's Authenticode trust, current-user installation, data-preserving removal, and cold launch. The same clean
revision builds an isolated instrumented package for exhaustive automated capability, localization, accessibility,
update, recovery, filesystem, and performance behavior; it is not substituted for the exact signed candidate.

Only after those technical jobs pass can `public-windows-product-acceptance` record the bounded human product verdict.
A later, separate `public-macos-release` approval reopens and promotes the exact candidate. A native input or complete
candidate is never rebuilt as a substitute for the sealed bytes after a downstream failure; recovery reopens the
retained transport and repeats only the failed authority-free admission or publication work.

## Sealed evaluation and protected publication

`.github/workflows/public-release.yml` is the initial macOS publication entry point. It is manually dispatched while selecting the exact `v<version>` ref and supplying only `version` and the public `update_key_id`. While its promotion job waits, `.github/workflows/public-macos-candidate-admission.yml` authenticates and admits the exact retained artifact without secrets or publication authority. The later `.github/workflows/public-linux-expansion.yml` entry point additionally accepts the public release-checksum key identifier and constructs the complete macOS-plus-Linux set described above. `.github/workflows/public-windows-expansion.yml` accepts those same three public selectors and constructs the complete macOS-plus-Linux-plus-Windows set; protected configuration, not dispatch, selects every private authority and the public Windows certificate fingerprint. The three publication workflows share one non-cancelling publication concurrency group; the read-only macOS admission workflow serializes each exact version and revision independently.

The first protected job has read-only repository permission. After local verification it seals only `release/` and `pages/` into one transport archive, records its SHA-256 digest, retains it for seven days as a private Actions artifact, and unconditionally removes Apple and updater authority. `npm run pack:public-release -- <candidate> <archive>` and `npm run unpack:public-release -- <archive> <sha256> <candidate>` verify the complete candidate on both sides of this boundary and reject mutation, additional roots, unsafe paths, partial extraction, or evidence drift.

Every platform-specific exact-candidate boundary must pass before its waiting publication job receives product and
promotion approval. For the initial macOS release, the separate read-only admission workflow runs while promotion
waits; later expansion workflows keep their native admission jobs inside the originating run. Automation verifies the
sealed candidate's applicable functional and distribution behavior without rebuilding it.
The product owner follows the bounded [canonical product-experience procedure](../testing/macos-candidate-manual-evaluation.md)
and, for the complete-platform candidate, its [Windows entry supplement](../testing/windows-candidate-manual-evaluation.md)
against the same sealed artifact. Promotion is rejected when the exact bytes did not pass, a serious finding remains open, or the
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
4. create `public-macos-release`, require the project owner as a reviewer, allow the initiating owner to approve under
   [ADR 0047](../architecture/decisions/0047-permit-bootstrap-solo-release-approval.md), disable administrator bypass,
   and admit only `v*` tags;
5. install the protected variables and secrets listed above;
6. before Windows expansion, create separately protected `public-windows-release` and
   `public-windows-product-acceptance` environments with the same version-tag, reviewer, initiator-approval, and
   administrator-bypass policies; provision separately labeled disposable Windows 11 x86-64 builder and admission runners under
   [ADR 0046](../architecture/decisions/0046-separate-windows-candidate-build-and-admission-hosts.md); and
7. create and push the reviewed exact version tag only after its CI and repository-safety runs pass.

These are accountable setting, credential, trust-root, tag, and publication actions. They are not performed by normal CI or inferred from the existence of the workflow.
