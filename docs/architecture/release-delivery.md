# Release Delivery Architecture

## Status

Current private-development preparation under [ADR 0003](decisions/0003-stage-verifiable-macos-development-releases.md), extended by the private-alpha [update trust boundary](update-trust.md) under [ADR 0008](decisions/0008-authenticate-update-policy-above-tauri.md). No real update endpoint, production signing key, uploaded package, or public release channel exists.

## Stages and authority boundaries

1. A clean source revision and explicit version enter the versioned preparation workflow.
2. The normal Tauri production build creates the macOS application bundle and DMG.
3. Production checks reject test instrumentation and inconsistent package identity.
4. Ecosystem-specific tools create production dependency and license inventories.
5. FitFreed combines reviewed version-specific notes with generated release identity, then generates checksums and a release manifest into ignored local staging.
6. Installation verification checks integrity before mounting and copies the application only to an isolated test destination.

These stages prepare unsigned development evidence; they do not publish it. Tags, GitHub releases, artifact uploads, production signatures, notarization, live update metadata, and promotion remain separate authorized actions.

## Release evidence set

The staged evidence set will contain:

- the production `.app` and DMG artifacts;
- SHA-256 checksums;
- separate CycloneDX JSON documents for npm and Cargo production graphs;
- machine-readable version, source revision, platform, architecture, storage schema, tool version, package identity, size, digest, and unsigned-state metadata; and
- release notes assembled from the reviewed `release/notes/<version>.md` body and generated identity evidence.

Every generated file is reproducible from versioned commands and ignored by Git. No file may contain a personal export, application library, machine-local path, credential, signing material, or private email address.

`npm run check:release-contracts` is the current machine-readable identity gate. It requires one SemVer value across npm, Tauri, and all three Cargo packages; the approved product and bundle identifiers; `GPL-3.0-or-later` package declarations; the canonical repository; active production bundling; no E2E capability in the production Tauri configuration; and a complete reviewed release-note body at the exact version-derived path.

`npm run prepare:development-release -- <version>` is the staging entry point. It accepts only a clean commit and writes through a temporary directory before promoting it to ignored `.artifacts/releases/<version>/`; a failed promotion restores the previous complete directory. The generated note header binds version, source revision, target architecture, storage schema, compatibility matrix, unsigned status, and integrity guidance to the reviewed body. The [release manifest version 2 contract](../data-formats/release/release-manifest-v2.md) is the canonical description of its machine-readable output. It binds the exact [upgrade matrix](../data-formats/release/upgrade-matrix-v1.md) for the candidate by size and SHA-256 digest.

## Build dependency security

Release integrity includes development tools because they execute while producing and testing the application. `npm run audit:dependencies` therefore audits the complete JavaScript graph, not only runtime dependencies.

WebdriverIO 9.30.1 currently accepts Puppeteer's browser-management package version 2, whose unmaintained `extract-zip` dependency has no patched release for its symlink traversal advisory. FitFreed overrides that transitive package to version 3.2.0, which no longer contains `extract-zip`; the packaged Tauri E2E journey verifies the embedded-driver path against the newer dependency. Mocha 10.8.2 requests `serialize-javascript` 6, so FitFreed overrides it to 7.1.0, which contains the published code-injection and denial-of-service corrections. These overrides remain explicit compatibility obligations until upstream dependency ranges remove the need for them.

CycloneDX evidence uses the locked npm graph and the default-feature Cargo graph without development or build dependencies. `cargo-cyclonedx` emits absolute file references for local workspace packages; preparation rewrites those references and their dependency edges to stable `pkg:cargo` identifiers, then rejects any remaining repository path or `file://` value. Validation compares each Cargo manifest's direct production dependencies with the SBOM root edges. A development-only crate blocks staging when it appears on a root edge, while the same crate remains valid when reached only through a normal production dependency; pruning that transitive component would make the inventory false. Missing direct production components and missing license declarations also block staging.

The complete staged directory passes the same pinned, checksum-verified Gitleaks binary used by repository safety automation before promotion. This scan complements structural path and component validation; it does not authorize sharing or replace human inspection of privately handled evidence.

## Installation evidence

The macOS development package uses Tauri's DMG drag-copy interaction. Verification mounts only a digest-verified image, finds the expected `FitFreed.app`, copies it to an isolated destination, and checks its bundle identifier, executable, version, and absence of test capabilities. First launch gives the uninstrumented production process a temporary `HOME`, so Tauri's normal application-data resolver creates an isolated library without a test-only database override.

The failure scenario corrupts a copy of the real candidate and proves that verification stops before the image is mounted or a destination is changed. The existing isolated application and library remain byte-for-byte unchanged, and the existing application must still launch. Moving that application away must leave its separate library intact. Migration interruption and library recovery remain owned by the storage and import lifecycle tests; installation automation does not delete, edit, or invent recovery for a user library.

## Private-alpha update extension

The [update channel version 1 contract](../data-formats/release/update-channel-v1.md) adds a signed exact-byte release statement above Tauri's mandatory package signature. The signed payload binds version, compatibility, localized release notes, withdrawals, artifact URL, byte size, SHA-256 digest, and Tauri signature. The release-bound matrix separates real application baselines from directly readable library schemas under [ADR 0012](decisions/0012-publish-two-dimensional-upgrade-support.md). Production update preparation will extend the release evidence set with the updater archive, both signatures, signed channel payload, and recovery evidence; none is generated or uploaded by the current unsigned development-release command.

The ordinary application remains explicitly unconfigured until a private-alpha HTTPS endpoint and production public trust are supplied through the release authority gate. Test-only signing material and transport exceptions cannot configure a production build. Application preservation, library backup, first-launch migration, and watchdog restoration form the release-blocking update matrix described by the [update trust architecture](update-trust.md). The initial 0.1.0 matrix truthfully contains no application baseline because no prior release exists; it separately verifies direct migration of library schemas 1 through 9. [ADR 0010](decisions/0010-run-update-recovery-from-the-preserved-application.md) assigns external recovery to the preserved previous executable, while the versioned [local recovery manifest](../data-formats/release/update-recovery-v1.md) binds the exact application/library pair and legal lifecycle transitions.

## Public distribution extension

The first public macOS release adds Developer ID signing, Apple notarization, Gatekeeper verification, hosted artifact provenance, public key-compromise and channel-operation procedures, clean upgrade and rollback matrices, and public installation and removal documentation. Those controls extend the staged and private-alpha evidence contracts and cannot be inferred from an unsigned private package or from the updater's independent Minisign signature.
