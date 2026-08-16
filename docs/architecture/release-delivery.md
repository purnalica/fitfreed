# Release Delivery Architecture

## Status

Current Milestone 1 design under verification by [ADR 0003](decisions/0003-stage-verifiable-macos-development-releases.md). No public release channel exists.

## Stages and authority boundaries

1. A clean source revision and explicit version enter the versioned preparation workflow.
2. The normal Tauri production build creates the macOS application bundle and DMG.
3. Production checks reject test instrumentation and inconsistent package identity.
4. Ecosystem-specific tools create production dependency and license inventories.
5. FitFreed generates checksums, a release manifest, and draft notes into ignored local staging.
6. Installation verification checks integrity before mounting and copies the application only to an isolated test destination.

These stages prepare evidence; they do not publish it. Tags, GitHub releases, artifact uploads, signatures, notarization, update manifests, and promotion remain separate authorized actions.

## Release evidence set

The staged evidence set will contain:

- the production `.app` and DMG artifacts;
- SHA-256 checksums;
- separate CycloneDX JSON documents for npm and Cargo production graphs;
- machine-readable version, source revision, platform, architecture, storage schema, tool version, package identity, size, digest, and unsigned-state metadata; and
- draft notes that state the development boundary and known limitations.

Every generated file is reproducible from versioned commands and ignored by Git. No file may contain a personal export, application library, machine-local path, credential, signing material, or private email address.

`npm run check:release-contracts` is the current machine-readable identity gate. It requires one SemVer value across npm, Tauri, and all three Cargo packages; the approved product and bundle identifiers; `GPL-3.0-or-later` package declarations; the canonical repository; active production bundling; and no E2E capability in the production Tauri configuration.

## Build dependency security

Release integrity includes development tools because they execute while producing and testing the application. `npm run audit:dependencies` therefore audits the complete JavaScript graph, not only runtime dependencies.

WebdriverIO 9.30.1 currently accepts Puppeteer's browser-management package version 2, whose unmaintained `extract-zip` dependency has no patched release for its symlink traversal advisory. FitFreed overrides that transitive package to version 3.2.0, which no longer contains `extract-zip`; the packaged Tauri E2E journey verifies the embedded-driver path against the newer dependency. Mocha 10.8.2 requests `serialize-javascript` 6, so FitFreed overrides it to 7.1.0, which contains the published code-injection and denial-of-service corrections. These overrides remain explicit compatibility obligations until upstream dependency ranges remove the need for them.

## Installation evidence

The macOS development package uses Tauri's DMG drag-copy interaction. Verification mounts only a digest-verified image, finds the expected `FitFreed.app`, copies it to an isolated destination, and checks its bundle identifier, executable, version, and absence of test capabilities.

The failure scenario corrupts the candidate or checksum and proves that verification stops before the image is mounted or an existing destination is changed. Migration interruption and library recovery remain owned by the storage and import lifecycle tests; installation automation does not delete, edit, or invent recovery for a user library.

## Future extension

The first public macOS release adds Developer ID signing, Apple notarization, Gatekeeper verification, signed update metadata, hosted artifact provenance, clean upgrade and rollback matrices, and public installation and removal documentation. Those controls extend the staged evidence contract and cannot be inferred from an unsigned private package.
