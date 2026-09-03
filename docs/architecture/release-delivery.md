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

The first complete-platform expansion separates executable trust from private signing authority.
`npm run package:linux-expansion-input` uses the same closed Debian boundary and embeds the active public `stable-v3`
endpoint and updater trust in the executable, but it neither reads a private updater key nor asks Tauri to emit a
signature. The secret-free Ubuntu job can therefore produce the exact update-capable Debian bytes before any protected
environment is admitted. The protected composer later signs those unchanged bytes with the selected updater key. An
ordinary `package:linux` result lacks this public-channel trust and cannot be substituted as an expansion input.

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

The first platform expansion has two immutable transport boundaries. A publication-authority-free Ubuntu 24.04 job
produces exactly the Debian package with active public `stable-v3` trust, its package inventory, and source/schema-bound
build evidence, verifies clean native installation, then seals those three files and exposes their archive digest. The
protected Apple Silicon
composer reopens that digest and complete identity before receiving any private key. It builds current-version macOS
bytes, signs the already verified Linux package, and emits one manifest version 6 set whose Release assets, checksums,
stable-v3 targets, recovery packages, and Pages paths must be identical. The complete candidate is sealed again before
the independent promotion approval. A secret-free hosted matrix reopens that sealed candidate by its transport digest
on x86-64 Ubuntu 24.04 and 26.04, validates the complete manifest version 6 set, installs the exact manifest-declared
Debian artifact, verifies native identity and dynamic linking, performs a graphical first launch into an isolated
private library whose schema matches the manifest, applies the production cold-launch budget, purges package-owned
paths, and proves that the library remains private and integral. Residual package state is removed unconditionally
after either result. Promotion depends on both matrix rows, has no signing authority, and derives its expected GitHub
provenance workflow from the immutable manifest version.

The subsequent [complete-platform release manifest version 7](../data-formats/release/release-manifest-v7.md) closes
the Windows expansion to newly built macOS, Linux, and Windows packages from one version, revision, and storage schema.
It adds the NSIS setup, Windows package inventory, Windows public build evidence, Windows updater signature,
Authenticode certificate fingerprint, Windows support family, and third stable target to checksums, provenance, Pages,
and the release-signing boundary. Stable-channel staging derives the setup name from the Windows package contract and
accepts Windows only when both existing macOS and Linux targets are present.

The same exact package is mounted read-only, without the repository, into a digest-pinned x86-64 Ubuntu 24.04 base
image. That image must contain no Node.js, npm, Cargo, Rustc, Git, or C compiler before installation. Native package
installation must resolve the declared runtime dependencies, leave a completely linked executable and registered
package identity, and native purge must remove every FitFreed package-owned path. This establishes a repeatable clean
input boundary. It does not substitute for the later sealed-candidate matrix, which owns graphical launch and the
exact-package check on both supported Ubuntu versions.

[ADR 0041](decisions/0041-support-windows-11-with-per-user-nsis.md) defines the first Windows release as one x86-64
current-user NSIS setup executable for Windows 11 editions still in Microsoft support at candidate issuance. The
installer includes the offline WebView2 runtime and both initial locales. Public setup and installed binaries require
trusted Authenticode signatures in addition to updater signing, checksums, SBOM, and source-bound provenance. MSI,
Microsoft Store, WinGet, per-machine installation, Windows on ARM, and Windows 10 remain separate future contracts.

The versioned `tauri.windows.conf.json` overlay and `npm run package:windows` command form the only ordinary Windows
package entry point. The overlay closes the target to NSIS, the host to x86-64 Windows, installation to the current
user, installer resources to English and Spanish with operating-system locale selection, and WebView2 acquisition to
the silent bundled offline installer. It retains the visible `FitFreed` identity, canonical icon and public origin,
GPL license, and vendor-neutral descriptions without claiming the generic ZIP association. Authenticated predecessor
recovery requires the NSIS installer to permit a deliberate older-version reinstall; update metadata and exact
predecessor verification, rather than the package version alone, grant that authority. The ordinary overlay contains
no certificate selection, signer command, timestamp service, account identity, or protected path. The separate
versioned `tauri.windows.public-signing.conf.json` overlay contains only the reviewed Node.js signing adapter and
Tauri's `%1` binary placeholder. A future protected candidate build must select it explicitly and provide all authority
through the protected process boundary; its presence cannot make the ordinary package signed or public.

Under [ADR 0045](decisions/0045-separate-windows-native-and-updater-signing-authority.md), the distinct
`npm run package:windows-expansion-input` entry point requires active recoverable `stable-v3` public
update trust and the public timestamped Authenticode profile before it changes the NSIS output directory. It rejects
all updater private-key inputs, selects only the Authenticode overlay, embeds the public channel endpoint and trust set,
accepts only diagnostic verbosity, and builds only NSIS. The resulting directory must contain exactly the
version-derived setup as one non-empty regular singly linked file. An independent post-package trust pass binds its
final digest, x86-64 product identity, version, admitted leaf-certificate fingerprint, Windows application policy, and
timestamp after Tauri has finished writing the package. The later complete-platform compositor uses separate updater
authority to sign these sealed bytes and create stable channel metadata.

`npm run prepare:windows-expansion-input -- <version> <directory>` admits one clean source revision and the protected
public Authenticode authority before running the dependency audit and that build. It then performs the public-profile
native installation cycle, hashes the complete installed layout, verifies data-preserving removal, and atomically
stages only the setup, its [Windows package inventory](../data-formats/release/windows-package-inventory-v1.md), and
the source-bound [Windows public build evidence](../data-formats/release/windows-public-build-evidence-v1.md). The
closed evidence binds version, revision, storage schema, setup and inventory digests, certificate fingerprint, and the
ordered public updater trust identifiers embedded by the build. It contains no updater signature, private key,
certificate selector, SignTool path, machine identity, or publication authority. Every file must be regular, non-empty,
singly linked, and named by the versioned contract; any mismatch removes the temporary staging directory without
replacing an existing input.

`npm run pack:windows-expansion-input -- <input> <archive> <version> <revision> <schema> <certificate-sha256>`
reopens that complete three-file input before creating a temporary compressed tar archive beside its requested
destination. The portable `ustar` header uses neutral ownership through an explicitly admitted GNU tar or bsdtar
dialect rather than retaining the native account. An unknown archive implementation fails closed. The
command admits the archive only when its entry listing is exactly the closed input set, atomically moves the archive
into place, and exposes its SHA-256 transport digest. The matching
`npm run unpack:windows-expansion-input -- <archive> <sha256> <output> <version> <revision> <schema> <certificate-sha256>`
validates the digest and listing before extraction, reopens every internal artifact, trust, source, schema, and channel
binding in a temporary sibling directory, and makes the result visible atomically. Mutation, an unsafe or additional
entry, existing destination, or verification failure leaves no accepted output.

The pinned Windows engineering lane builds that NSIS package instead of compiling the release host a second time: the
package build already contains the complete production host. A closed native adapter then runs only on a clean
current-user profile. It verifies `%LOCALAPPDATA%\FitFreed`, `fitfreed.exe`, `uninstall.exe`, the `HKCU` uninstall
registration, canonical Start Menu and silent-install desktop shortcuts, release metadata, publisher and public
support links, and WebView2 availability. The setup and installed binaries must report `NotSigned` in this
authority-free lane. Native removal must remove package-owned state while retaining
`%APPDATA%\org.fitfreed.desktop`; that ordinary unsigned result is engineering evidence and cannot enter a public
channel.

The same native cycle creates the versioned
[Windows package inventory](../data-formats/release/windows-package-inventory-v1.md) beside the exact setup. It binds
the setup digest and native identity to every installed regular file's portable relative path, size, and digest, then
records successful removal of package state and preservation of application data. The inventory distinguishes the
ordinary unsigned engineering profile from the future public Authenticode profile, but a structural public claim is
never trust evidence without the independent protected inspector. One CI command performs installation, inspection,
inventory generation, and removal so the expensive native transition is not repeated for the same package. Its public
profile invokes the independent policy inspector while the installed files still exist. The setup and application
executable receive complete architecture, identity, version, certificate, timestamp, and digest inspection; the
uninstaller receives certificate, timestamp, policy, and digest inspection because it is a package control binary, not
the application executable. The adapter then cross-checks those three observed file digests against the setup artifact
and complete installed-file inventory before removal.

The public signing adapter accepts only an explicit public or synthetic-test profile, an absolute `signtool.exe`, a
SHA-1 certificate-store selector, an independently calculated lowercase SHA-256 leaf-certificate fingerprint, and—only
for the public profile—a credential-free HTTPS RFC 3161 endpoint. SignTool signs with SHA-256; raw tool output is never
retained. The independent inspector then runs SignTool's Windows application policy over every signature, requires an
RFC 3161 timestamp for public evidence, compares the SHA-256 fingerprint from the actual signer certificate, verifies
that inspection did not change the file digest, and closes product-binary evidence to x86-64 plus the expected name and
version. Certificate subjects, store paths, account identity, and timestamp-service details are not evidence fields.

The pinned hosted lane exercises this machinery with a fresh non-exportable self-signed certificate and a temporary
copy of the unsigned release executable. It removes the certificate from the current user's personal, Root, and
TrustedPublisher stores, deletes its private key and all temporary files, restores the process environment, and proves
the source executable is unchanged before recording success. An untimestamped synthetic signature establishes adapter
and cleanup behavior only. Public admission still requires the exact setup and installed binaries to pass the real
trusted-chain, timestamp, digest, identity, package-inventory, and clean supported-Windows-11 gates.

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
configuration; the closed Debian-only Linux overlay; the closed current-user, offline-WebView2, bilingual NSIS Windows
overlay; and a complete reviewed release-note body at the exact version-derived path.

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

Protected preparation repeats preflight, removes stale generated bundle output, builds with path-based updater authority and one complete Apple notarization credential mode, then runs objective trust inspection before assembling evidence. The ignored atomic candidate directory separates GitHub Release inputs from the deployable Pages artifact. The ADR 0020 compositor combines the verified update snapshot with the exact tagged localized product site before candidate verification, so a release cannot replace the site with an update-only tree. Stable metadata is signed over exact payload bytes without placing the updater password on a command line. Checksums, inventories, and manifest digests cover the final signed and notarized bytes; local-path and secret scans run before the directory is promoted. No network publication occurs during preparation.

[ADR 0019](decisions/0019-separate-candidate-build-from-public-promotion.md) closes the hosted authority sequence. Exact-revision CI, repository safety, origin tag, protected-environment, and HTTPS Actions-backed Pages evidence must pass before the GitHub-hosted Apple Silicon runner receives authority. Private inputs are materialized outside the checkout in an ephemeral keychain and private files, and cleanup restores runner state. The build job cannot publish: it seals the verified candidate, records its transport digest, retains it for independent evaluation, and removes authority. A second protected approval admits only those exact reopened bytes to promotion without Apple or updater secrets. Every checksum subject, the checksum inventory, and the detached platform-expansion checksum signature receive source-bound GitHub attestations. The still-private complete Pages artifact is uploaded before the exact draft is published, and the GitHub Release must become immutable before Pages can replace the stable snapshot. Final verification downloads all public Release bytes, validates provenance against the exact workflow, tag, and revision, and accepts every direct no-redirect product and update object only after the complete remote site converges to the tagged source and declared package digests.
