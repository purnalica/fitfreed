# FitFreed Updater Source Refinement

## Purpose

This directory contains the minimum buildable source subset of the official `tauri-plugin-updater` crate required by FitFreed. It exists because version 2.10.1 cannot stop a package response at an authenticated byte limit and cannot construct its native installation object from release metadata already authenticated by the application. [ADR 0009](../../../docs/architecture/decisions/0009-bound-package-transfer-inside-tauri-updater.md) owns the decision and removal criteria.

The source remains licensed by the Tauri Programme under Apache-2.0 or MIT. The original license files and upstream README are retained unmodified apart from a final newline added by repository tooling.

## Provenance

- Upstream crate: `tauri-plugin-updater` 2.10.1.
- Registry source: <https://crates.io/crates/tauri-plugin-updater/2.10.1>.
- Upstream repository: <https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater>.
- Crate archive SHA-256: `806d9dac662c2e4594ff03c647a552f2c9bd544e7d0f683ec58f872f952ce4af`.
- Retained source: normalized `Cargo.toml`, Rust build and source files, generated API script required by the build, default permission source, upstream README, and both license texts.
- Excluded upstream material: images, JavaScript source, package-manager metadata, changelog, security policy, crate-local lockfile, registry metadata, and generated build output. None is required to build the Rust dependency or understand its license and provenance.

[`provenance.json`](provenance.json) is the machine-readable file allowlist and checksum manifest. Repository automation rejects additions, removals, or byte changes outside a deliberate provenance update.

## FitFreed changes

Only `src/error.rs` and `src/updater.rs` differ semantically from the published Rust source:

1. `Error::DownloadSizeMismatch` reports failure of the authenticated byte expectation.
2. `Updater::prepare_update` creates the upstream `Update` object from a supplied `RemoteRelease` without a network request or a second version comparison.
3. `Update::download_with_expected_size` reuses the upstream request and package-signature verifier while rejecting a mismatched declared length, an excess chunk before copying it, or an incomplete body.
4. The original `Updater::check` and `Update::download` delegate to the shared implementations without changing their public behavior.
5. A unit test protects declared-length and streamed-chunk bounds.

No updater command is exposed to React. FitFreed calls only the Rust APIs through its native infrastructure adapter.

## Review and upgrade procedure

1. Obtain the exact new `.crate` archive in a temporary directory and record its registry checksum before extraction.
2. Review the upstream changelog, security notices, dependency changes, package-signature implementation, download loop, and every platform installer change from 2.10.1 to the candidate version.
3. Replace only the retained upstream file allowlist and restore the original license files.
4. Reassess whether upstream now supports preparation from authenticated metadata and an abortable exact byte bound. Remove each local change that has an upstream equivalent.
5. Reapply any still-required refinement narrowly and update ADR 0009 or supersede it if the responsibility boundary changes.
6. Update `provenance.json`, the exact dependency version, Cargo lockfile, SBOM evidence, and this provenance note in one reviewable change.
7. Run:

   ```sh
   node scripts/check-vendored-updater.mjs
   CARGO_TARGET_DIR=src-tauri/target/vendor-updater \
     cargo test --manifest-path src-tauri/vendor/tauri-plugin-updater/Cargo.toml --lib
   npm run test:fast
   npm run lint:rust
   scripts/check-repository-content.sh
   scripts/run-secret-scan.sh
   ```

8. Repeat the complete release-shaped update, interruption, recovery, dependency, license, and packaging gates before distributing a build with the new updater.

Never version the crate-local `Cargo.lock`, `target`, or generated permission/schema directories. They are reproducible build output and are ignored by the repository.
