# Release Delivery Architecture

## Status

Current private-development preparation under [ADR 0003](decisions/0003-stage-verifiable-macos-development-releases.md), extended by the private-alpha [update trust boundary](update-trust.md) under [ADR 0008](decisions/0008-authenticate-update-policy-above-tauri.md). [ADR 0020](decisions/0020-compose-product-and-update-pages.md) selects the public delivery topology, [ADR 0023](decisions/0023-use-fitfreed-org-as-the-public-origin.md) assigns its canonical origin to `https://fitfreed.org/`, and [ADR 0024](decisions/0024-generate-localized-product-pages.md) defines its generated locale surfaces. The English fallback and deterministic Spanish product surfaces are live and byte-accepted at that HTTPS origin with verified organization ownership. No real update endpoint, production signing key, uploaded package, or public release exists.

## Stages and authority boundaries

1. A clean source revision and explicit version enter the versioned preparation workflow.
2. The normal Tauri production build creates the macOS application bundle and DMG.
3. Production checks reject test instrumentation, build-host paths anywhere in the application bundle, and inconsistent package identity.
4. Ecosystem-specific tools create production dependency and license inventories.
5. FitFreed combines reviewed version-specific notes with generated release identity, then generates checksums and a release manifest into ignored local staging.
6. Installation verification checks integrity before mounting and copies the application only to an isolated test destination.

These stages prepare unsigned development evidence; they do not publish it. Tags, GitHub releases, artifact uploads, production signatures, notarization, live update metadata, and promotion remain separate authorized actions.

## Cross-platform parity engineering sequence

Linux and Windows parity engineering may proceed while an earlier platform still has an open human acceptance,
credential, or publication gate. This separation applies to portability investigation, native compilation, packaging,
installation and removal automation, update and recovery implementation, platform E2E, accessibility and localization
parity, and release-shaped evidence. It does not treat later-platform evidence as acceptance of the macOS candidate or
authorize a public artifact.

Each platform owns an independent complete acceptance boundary. Public promotion remains ordered macOS, Linux, then
Windows; a later platform cannot be promoted merely because its engineering campaign passes. The current milestone
sequence and gate ownership remain canonical in the [roadmap](../roadmap.md), and the rationale for separating
engineering from promotion is recorded in [ADR 0039](decisions/0039-decouple-platform-engineering-from-promotion.md).

[ADR 0044](decisions/0044-publish-expanding-complete-platform-sets.md) reconciles that ordered availability with
immutable GitHub Releases and the single-version stable channel. The first public version contains macOS only; the
later Linux expansion contains newly built macOS and Linux targets; and the still-later Windows expansion contains
newly built targets for all three platforms. Every expansion has one tag, source revision, application version,
library schema, signed checksum set, release manifest, provenance set, support statement, and Pages snapshot. An
earlier artifact is a predecessor, never the current-version package under a new name, and no target may exist only in
Pages or signed update metadata.

[ADR 0040](decisions/0040-support-ubuntu-lts-with-debian-packages.md) defines the first Linux release as one x86-64
Debian package built on Ubuntu 24.04 and supported on Ubuntu Desktop 24.04 and 26.04 LTS after clean-environment
evidence. AppImage, RPM, Flatpak, Snap, AUR, ARM64, and other distribution families remain separate future package
contracts. Public Debian bytes require checksums, detached FitFreed release signing, updater signing, SBOM, source-bound
provenance, exact package inventory, and version-matched documentation.

The versioned Linux Tauri overlay and `npm run package:linux` command form the single source-build entry point for that
Debian package. Under [ADR 0043](decisions/0043-separate-linux-package-and-display-identities.md), the overlay gives Tauri
the technical product identity `fitfreed` so its derived Debian control and installed desktop identities remain
canonical, while a reviewed desktop template retains the visible name `FitFreed`. The command is Linux-only and
requests only `deb`; the overlay also binds vendor-neutral application metadata, the canonical public origin, GPL
licensing, and Debian section and priority. It does not associate FitFreed with the generic ZIP MIME type. After Tauri
finishes, the wrapper changes only the generated package filename to the versioned public
`FitFreed_<version>_amd64.deb` name; it never rewrites the package bytes. Tauri derives the native runtime dependency
list during package creation; package inspection extracts the package into an isolated temporary directory and
validates the exact artifact name, Debian control identity, mandatory WebKitGTK and GTK dependencies, production
executable permissions, desktop entry, icon set, visible launcher name, and installed GPL text. The same exact artifact generates the versioned
[Linux package inventory](../data-formats/release/linux-package-inventory-v1.md): its digest-bound control metadata and
complete byte-sorted extracted layout are the canonical package-content evidence. The resulting inventory and complete
dependency field must still enter the release manifest, checksum, signing, and provenance boundaries before the
artifact can become a candidate.

`npm run package:linux-public-candidate` reuses that package boundary and adds only the public updater overlay. It
requires active recoverable `stable-v3` update trust and external updater signing authority, causing Tauri to emit the
mandatory signature for the exact Debian bytes. The wrapper changes the package and signature filenames together
without changing their contents. An ordinary `package:linux` result remains installation evidence, not a signed public
candidate.

The public stable-channel staging boundary accepts an explicit closed set of target packages. It derives the canonical
name and direct URL for `darwin-aarch64` and `linux-x86_64-deb`, binds every package's size, digest, and updater
signature into one signed payload, and mirrors that same complete target set for Tauri. Targets are sorted and unique;
an absent, duplicated, or unsupported target fails before staging. This prevents Linux enablement from silently
removing the already published macOS update path.

Candidate verification reopens the signed payload from the stable envelope, resolves its key identifier only through
the versioned public trust set, and cryptographically verifies both the metadata signature and the independent package
signature. It then binds the selected platform entry and Tauri compatibility mirror to the manifest's exact package
name, bytes, digest, version, schema target, and canonical direct URL. Structural equality without valid signatures is
not release evidence.

The same exact package is mounted read-only, without the repository, into a digest-pinned x86-64 Ubuntu 24.04 base
image. That image must contain no Node.js, npm, Cargo, Rustc, Git, or C compiler before installation. Native package
installation must resolve the declared runtime dependencies, leave a completely linked executable and registered
package identity, and native purge must remove every FitFreed package-owned path. This establishes a repeatable clean
package-manager boundary; graphical desktop launch and both supported Ubuntu versions remain later independent gates.

[ADR 0041](decisions/0041-support-windows-11-with-per-user-nsis.md) defines the first Windows release as one x86-64
current-user NSIS setup executable for Windows 11 editions still in Microsoft support at candidate issuance. The
installer includes the offline WebView2 runtime and both initial locales. Public setup and installed binaries require
trusted Authenticode signatures in addition to updater signing, checksums, SBOM, and source-bound provenance. MSI,
Microsoft Store, WinGet, per-machine installation, Windows on ARM, and Windows 10 remain separate future contracts.

Linux and Windows use the authenticated predecessor recovery architecture in
[ADR 0042](decisions/0042-recover-packaged-updates-from-authenticated-predecessors.md). Their release manifests and
stable-channel payloads bind the candidate plus every supported predecessor package needed for offline rollback. A
candidate is incomplete when it contains only an installable new package: it must also prove native package-state
recovery, runnable predecessor fallback, library pairing, interruption resumption, and terminal cleanup.

The [Milestone 4](../plans/milestone-4.md) and [Milestone 5](../plans/milestone-5.md) plans own the executable
increments, hosted matrices, clean-environment gates, documentation, and publication dependencies. GitHub-hosted
Ubuntu or Windows Server results are engineering evidence; they do not replace the exact Ubuntu Desktop or Windows 11
candidate gate.

## Release evidence set

The staged evidence set will contain:

- the production `.app` and DMG artifacts;
- SHA-256 checksums;
- separate CycloneDX JSON documents for npm and Cargo production graphs;
- machine-readable version, source revision, platform, architecture, storage schema, tool version, package identity, size, digest, and unsigned-state metadata; and
- release notes assembled from the reviewed `release/notes/<version>.md` body and generated identity evidence.

Every generated file is reproducible from versioned commands and ignored by Git. No file may contain a personal export, application library, machine-local path, credential, signing material, or private email address.

The shared production build boundary remaps Rust source locations from the checkout, build user home, explicit Cargo
and Rustup homes, and temporary roots to stable virtual prefixes before compilation. The complete-bundle inspection is
the independent fail-closed control: it recognizes macOS, Linux, and Windows local-home and temporary path classes as
well as test-only routing, and reports only classification labels rather than the matching local bytes.

`npm run check:release-contracts` is the current machine-readable identity gate. It requires one SemVer value across
npm, Tauri, and all three Cargo packages; the approved product and bundle identifiers; `GPL-3.0-or-later` package
declarations; the canonical repository; active production bundling; no E2E capability in the production Tauri
configuration; the closed Debian-only Linux overlay; and a complete reviewed release-note body at the exact
version-derived path.

`npm run prepare:development-release -- <version>` is the staging entry point. It accepts only a clean commit and writes through a temporary directory before promoting it to ignored `.artifacts/releases/<version>/`; a failed promotion restores the previous complete directory. The generated note header binds version, source revision, target architecture, storage schema, compatibility matrix, unsigned status, and integrity guidance to the reviewed body. The [release manifest version 2 contract](../data-formats/release/release-manifest-v2.md) is the canonical description of its machine-readable output. It binds the exact [upgrade matrix](../data-formats/release/upgrade-matrix-v1.md) for the candidate by size and SHA-256 digest.

## Build dependency security

Release integrity includes development tools because they execute while producing and testing the application. `npm run audit:dependencies` therefore audits the complete JavaScript graph, not only runtime dependencies.

WebdriverIO 9.30.1 currently accepts Puppeteer's browser-management package version 2, whose unmaintained `extract-zip` dependency has no patched release for its symlink traversal advisory. FitFreed overrides that transitive package to version 3.2.0, which no longer contains `extract-zip`; the packaged Tauri E2E journey verifies the embedded-driver path against the newer dependency. WebdriverIO 9.30.1 also requests `deepmerge-ts` 7, whose recursive-object handling has a stack-exhaustion advisory, so FitFreed overrides it to 8.0.1; WebdriverIO only uses the compatible `deepmerge` and `deepmergeCustom` APIs, and the packaged journey verifies the configuration and driver paths. Mocha 10.8.2 requests `serialize-javascript` 6, so FitFreed overrides it to 7.1.0, which contains the published code-injection and denial-of-service corrections. These overrides remain explicit compatibility obligations until upstream dependency ranges remove the need for them.

CycloneDX evidence uses the locked npm graph and the default-feature Cargo graph without development or build dependencies. `cargo-cyclonedx` emits absolute file references for local workspace packages; preparation rewrites those references and their dependency edges to stable `pkg:cargo` identifiers, then rejects any remaining repository path or `file://` value. Validation compares each Cargo manifest's direct production dependencies with the SBOM root edges. A development-only crate blocks staging when it appears on a root edge, while the same crate remains valid when reached only through a normal production dependency; pruning that transitive component would make the inventory false. Missing direct production components and missing license declarations also block staging.

The complete staged directory passes the same pinned, checksum-verified Gitleaks binary used by repository safety automation before promotion. This scan complements structural path and component validation; it does not authorize sharing or replace human inspection of privately handled evidence.

## Installation evidence

The macOS development package uses Tauri's DMG drag-copy interaction. Verification mounts only a digest-verified image, finds the expected `FitFreed.app`, copies it to an isolated destination, and checks its bundle identifier, executable, version, and absence of test capabilities. First launch gives the uninstrumented production process a temporary `HOME`, so Tauri's normal application-data resolver creates an isolated library without a test-only database override.

The failure scenario corrupts a copy of the real candidate and proves that verification stops before the image is mounted or a destination is changed. The existing isolated application and library remain byte-for-byte unchanged, and the existing application must still launch. Moving that application away must leave its separate library intact. Migration interruption and library recovery remain owned by the storage and import lifecycle tests; installation automation does not delete, edit, or invent recovery for a user library.

## Private-alpha update extension

The [update channel version 1 contract](../data-formats/release/update-channel-v1.md) adds a signed exact-byte release statement above Tauri's mandatory package signature. The signed payload binds version, compatibility, localized release notes, withdrawals, artifact URL, byte size, SHA-256 digest, and Tauri signature. The release-bound matrix separates real application baselines from directly readable library schemas under [ADR 0012](decisions/0012-publish-two-dimensional-upgrade-support.md). Production update preparation will extend the release evidence set with the updater archive, both signatures, signed channel payload, and recovery evidence; none is generated or uploaded by the current unsigned development-release command.

The ordinary application remains explicitly unconfigured until a private-alpha HTTPS endpoint and production public trust are supplied through the release authority gate. Test-only signing material and transport exceptions cannot configure a production build. Application preservation, library backup, first-launch migration, and watchdog restoration form the release-blocking update matrix described by the [update trust architecture](update-trust.md). The initial 0.1.0 matrix truthfully contains no application baseline because no prior release exists; its current direct-library compatibility set is owned by the versioned [candidate matrix](../data-formats/release/upgrade-matrix-v1.md) and its machine-readable instance. [ADR 0010](decisions/0010-run-update-recovery-from-the-preserved-application.md) assigns external recovery to the preserved previous executable, while the versioned [local recovery manifest](../data-formats/release/update-recovery-v1.md) binds the exact application/library pair and legal lifecycle transitions.

## Public distribution extension

The first public macOS release adds Developer ID signing, Apple notarization, Gatekeeper verification, hosted artifact provenance, public key-compromise and channel-operation procedures, clean upgrade and rollback matrices, and public installation and removal documentation. Those controls extend the staged and private-alpha evidence contracts and cannot be inferred from an unsigned private package or from the updater's independent Minisign signature.

GitHub Releases owns the immutable human-facing DMG and evidence record. The canonical `https://fitfreed.org/` GitHub Pages origin serves the English fallback and locale negotiation at its root, deterministic Spanish product content beneath `/es/`, and the current stable signed envelope with its exact versioned updater archive beneath `/updates/`. One compositor generates localized product pages from the canonical English source and complete locale catalogs, then combines them with any byte-preserved update snapshot so product publication and release promotion cannot replace one another's files. Public release preparation is manual and exact-tag-bound; secret-free verification precedes a protected environment that alone may access Apple and Minisign private credentials. The ordinary application stays unconfigured, while a public build embeds the stable endpoint and public trust set at compile time. The [Milestone 3 plan](../plans/milestone-3.md) owns the executable sequence and remaining human gates.

The checked-in [public update configuration](../data-formats/release/public-update-configuration-v1.md) is initially inactive and contains no trust key. Activation is a reviewed trust-root change. A public candidate wrapper strips inherited update values, maps only that complete configuration into compile-time inputs, and applies a closed Tauri overlay that creates updater artifacts without storing endpoint or key values in Tauri configuration. Atomic channel staging validates stable version 2, signs the exact payload through an injected release authority, and promotes only a complete envelope/package pair. This engineering path is locally verified with synthetic credentials; it does not create a public release or substitute for Apple trust evidence.

The [public release manifest version 3](../data-formats/release/release-manifest-v3.md) is a separate closed contract rather than a mutable interpretation of private manifest version 2. It can describe only a Developer ID-signed, notarized, stapled, Gatekeeper-accepted Apple Silicon release for macOS 15.0 or later. It binds the stable updater archive, both update-signing layers, exact channel envelope, compatibility matrix, inventories, notes, and required hosted provenance subjects. Creating the manifest does not create an attestation or authorize publication; the protected workflow must attest and remotely verify every final subject.

Public trust inspection is privacy-minimizing and fail-closed. It verifies the complete nested application signature and disk-image signature, requires the Developer ID Application trust class, hardened runtime, secure timestamp, one matching leaf-certificate fingerprint, the explicitly expected team identifier, exact bundle identity and version, Apple Silicon executable, macOS 15.0 deployment target, stapled tickets on both distributable forms, and Gatekeeper acceptance. Generated evidence records the public certificate fingerprint and team identifier needed for independent verification, but never copies the certificate subject name or signing-account address into project evidence. Command failures report the failed trust stage without echoing raw signing output.

Secret-free preflight verifies the exact manual version tag and source revision, canonical public repository, release contracts, active stable key, and GitHub environment before any protected runner starts. The environment must require a reviewer, disallow administrator bypass, and admit only `v*` tags through a custom deployment policy. This explicit query prevents a workflow reference from silently creating and using an environment without the intended controls.

Each version has one reviewed [public release policy](../data-formats/release/public-release-policy-v1.md). It owns the monotonic channel sequence, matrix-derived minimum application version, localized update notes, and withdrawals. Issuance time, bounded expiry, and the selected key are supplied only by the protected release execution, so time-sensitive state and key rotation do not turn private credentials into versioned inputs.

Protected preparation repeats preflight, removes stale generated bundle output, builds with path-based updater authority and one complete Apple notarization credential mode, then runs objective trust inspection before assembling evidence. The current ignored atomic candidate directory separates GitHub Release inputs from a minimal update snapshot; the ADR 0020 compositor must combine that verified snapshot with the exact tagged product site before it can become a deployable Pages artifact. Stable metadata is signed over exact payload bytes without placing the updater password on a command line. Checksums, inventories, and manifest digests cover the final signed and notarized bytes; local-path and secret scans run before the directory is promoted. No network publication occurs during preparation.

[ADR 0019](decisions/0019-separate-candidate-build-from-public-promotion.md) closes the hosted authority sequence. Exact-revision CI, repository safety, origin tag, protected-environment, and HTTPS Actions-backed Pages evidence must pass before the GitHub-hosted Apple Silicon runner receives authority. Private inputs are materialized outside the checkout in an ephemeral keychain and private files, and cleanup restores runner state. The build job cannot publish: it seals the verified candidate, records its transport digest, retains it for independent evaluation, and removes authority. A second protected approval admits only those exact reopened bytes to promotion without Apple or updater secrets. Every checksum subject and the checksum inventory receive source-bound GitHub attestations. The still-private Pages artifact is uploaded before the exact draft is published, and the GitHub Release must become immutable before Pages can replace the stable snapshot. Final verification downloads all public Release bytes, validates provenance against the exact workflow, tag, and revision, and accepts the direct no-redirect Pages objects only after both converge to their declared digests.
