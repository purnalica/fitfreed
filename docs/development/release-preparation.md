# Private macOS Development Release Preparation

## Boundary

This workflow prepares and verifies unsigned, non-notarized development evidence. It does not create a tag, GitHub release, uploaded artifact, signature, notarization request, update channel, or public distribution. Those actions require separate release authority and later architecture decisions.

Use only a clean commit and independently generated synthetic data. Read the [project disclaimer](../../DISCLAIMER.md) and [release delivery architecture](../architecture/release-delivery.md) first.

## Prepare a release-shaped package

From a clean checkout on macOS:

```bash
npm ci
npm run doctor
npm run install:release-tools
npm run prepare:development-release -- 0.1.0
```

Replace `0.1.0` with the explicitly reviewed version. Preparation stops unless that value matches npm, Tauri, and every FitFreed Cargo package. Continuous integration passes its reviewed release version through the same gate. `cargo-cyclonedx` is installed under ignored `.tools/`; no global installation is required.

The reviewed release-note body must exist at `release/notes/<version>.md`. It contains exactly these non-empty level-two sections in order: Highlights, Compatibility, Privacy and data, Known limitations, Installation and recovery, and Support. It has no level-one heading because preparation generates the title and exact release identity. Missing, reordered, duplicated, unexpected, or unterminated sections block both the fast release-contract check and release preparation.

The command audits the complete JavaScript production and build graph, verifies the candidate-bound upgrade matrix, builds the normal Tauri production package, rejects E2E instrumentation, generates and validates production-only CycloneDX inventories, normalizes machine-local Cargo references, scans the complete evidence set for secrets, and stages it under `.artifacts/releases/<version>/`.

Preparation requires a clean Git revision so the manifest can identify its complete source. A failure keeps the last complete version directory and removes only the incomplete ignored staging directory.

## Inspect the evidence

The ignored version directory contains:

- `FitFreed.app` and the native-architecture Tauri DMG;
- one npm and three Cargo CycloneDX 1.5 JSON documents;
- `supported-upgrades.json`, the exact [version 1 compatibility matrix](../data-formats/release/upgrade-matrix-v1.md);
- `release-manifest.json` conforming to the [version 2 contract](../data-formats/release/release-manifest-v2.md) and binding that matrix by digest;
- `SHA256SUMS`; and
- `RELEASE_NOTES.md`, assembled from generated candidate identity and the exact reviewed version-specific body.

No generated package or evidence file belongs in Git. The workflow blocks repository paths and `file://` references. Before sharing any evidence privately, also inspect it for credentials, signing material, personal exports, application libraries, private email addresses, and other machine-local content.

## Verify installation and failure behavior

```bash
npm run verify:development-release
npm run verify:update-recovery-preparation
```

The macOS verifier checks every manifest artifact and checksum before mounting the real DMG. It installs into a temporary isolated destination, validates the bundle identity and production executable, and starts the installed application with a temporary `HOME` consumed by Tauri's normal path resolver. This exercises the uninstrumented production path while keeping the library outside the developer's real application-data directory.

It then corrupts a temporary copy of the DMG and proves that verification stops before the mount command or destination is reached. The existing application and library must remain byte-for-byte unchanged, and the application must still launch afterward. Finally, moving the isolated application away must leave its separate library intact. All temporary applications, libraries, mounts, logs, and corrupt candidates are removed at exit.

The update-recovery preparation check uses the real production `FitFreed.app`, a temporary synthetic library, and the production macOS copying adapter. It requires the bundle identifier, version, executable, complete deterministic tree digest, SQLite online backup, exact schema, integrity check, retained locale, closed manifest, and active `prepared` phase to agree. It neither downloads nor installs an update and removes its temporary recovery directory at exit.

## Diagnostics

- `release preparation requires a clean Git revision`: commit or deliberately discard the source changes before preparing evidence. Do not bypass the gate.
- `cargo-cyclonedx 0.5.9 is required`: run `npm run install:release-tools`.
- `SBOM contains forbidden local text`: inspect the generator output; do not publish or manually delete the failing field to force success.
- `missing direct production component`: reconcile the manifest dependency and the generated root dependency edge before continuing. A component appearing only transitively does not satisfy this gate.
- `direct development component`: remove the development dependency from the production root edge. Do not delete a legitimately transitive production component from the inventory.
- `Release integrity verification failed`: do not mount or copy the DMG. Rebuild from the recorded clean revision.
- A macOS launch or mount failure: preserve only privacy-safe command output, run `npm run doctor`, and consult [troubleshooting](troubleshooting.md). Never attach a personal library or export.
