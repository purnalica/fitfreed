# ADR 0003: Stage verifiable macOS development releases

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [Automation strategy](../../automation-strategy.md)

## Context

Milestone 1 must prove that a clean commit can produce an inspectable private macOS development package and release-draft input without publishing an unsigned binary. The evidence must cover package identity, integrity, dependency inventory, license declarations, source revision, clean installation, and failure before installation changes existing state. The same entry points must work locally and in GitHub Actions without depending on private maintainer knowledge.

Tauri produces the macOS application bundle and DMG used by the selected application stack. Its [official DMG guidance](https://v2.tauri.app/distribute/dmg/) defines the normal outside-App-Store interaction as dragging the application from the mounted image to the Applications folder. FitFreed must verify that real boundary; it must not create a test-only installer and present that as product evidence.

The private development package remains unsigned and non-notarized. This decision does not authorize a GitHub release, artifact upload, tag, signing operation, notarization request, update channel, or public distribution.

## Decision drivers

- Integrity must be checked before a disk image is mounted or copied.
- Dependency and license evidence must describe the production npm and Cargo graphs without presenting development-only test tooling as runtime content.
- Release evidence must identify one explicit version and clean Git revision across every package metadata source.
- Local and hosted workflows must share versioned commands and deterministic inputs.
- The process must remain useful while the repository and unsigned packages are private.
- Future signing, notarization, updates, and public provenance must extend this boundary rather than replace it.

## Considered alternatives

### Ecosystem-specific CycloneDX inventories plus a FitFreed release manifest

The official [CycloneDX npm tool](https://github.com/CycloneDX/cyclonedx-node-npm) derives the JavaScript dependency graph through npm and can omit development dependencies. The official [CycloneDX Cargo tool](https://github.com/CycloneDX/cyclonedx-rust-cargo) derives the Rust graph through Cargo and avoids development dependencies that cannot affect final executables. Separate inventories preserve ecosystem evidence and can be listed together by a small FitFreed-owned release manifest.

### One filesystem scanner for the repository or final application

A scanner such as [Syft](https://github.com/anchore/syft) supports both JavaScript and Rust and can emit CycloneDX or SPDX. A source-tree scan can overstate the runtime graph with development dependencies, while a final statically linked application scan can understate Rust source dependencies. Using one output is simpler but weakens the relationship between the declared build graph and the evidence.

### GitHub-hosted attestations as the only provenance and SBOM path

GitHub artifact attestations can bind provenance and SBOM predicates to artifacts. Availability for private repositories depends on the account plan, and a hosted-only path would not provide equivalent local preparation or offline inspection. Attestations remain a future publication layer over versioned local evidence.

## Decision

FitFreed will implement the ecosystem-specific CycloneDX and release-manifest alternative for Milestone 1 verification.

- One explicit release version must agree with `package.json`, Tauri configuration, and every published Cargo package before preparation starts.
- Preparation requires a clean commit and writes only to an ignored, version-specific staging directory.
- The production Tauri build produces the application bundle and DMG. The existing production-bundle check rejects E2E instrumentation before either artifact becomes a release input.
- Pinned official CycloneDX generators produce separate JSON inventories for the production npm and Cargo dependency graphs. Development-only dependencies are excluded from the release inventory.
- A FitFreed release manifest records the version, Git revision, platform, architecture, schema version, unsigned and private-development status, generator versions, artifact names, sizes, and SHA-256 digests. Draft release notes and checksum files derive from the same reviewed inputs.
- Missing, unknown, or malformed dependency-license declarations block preparation for review. The inventory is evidence, not a legal-compliance claim.
- Installation verification checks the DMG digest before mounting it, copies the contained application to an isolated destination, and verifies bundle identity there. A deliberately corrupted digest must stop before mounting or modifying an existing destination.
- Private development artifacts remain local or inside a non-publishing CI job. Public release storage and cryptographic attestations enter only with explicit release authority and the required signing and notarization design.

## Consequences

### Positive

- Each package ecosystem is interpreted by a tool that understands its dependency graph.
- The manifest binds otherwise separate evidence to one package, source revision, and version.
- Checksum failure proves a meaningful pre-installation safety boundary without inventing a product installer.
- The staged contract can later add signatures, notarization results, update manifests, and hosted attestations.

### Negative

- Two SBOM generators and their pinned versions must be installed, updated, and verified.
- Separate SBOMs require consumers to follow the release manifest rather than opening one merged dependency graph.
- Declared licenses still require human review; an SBOM does not establish legal compatibility by itself.
- A private unsigned DMG cannot prove Gatekeeper, notarization, or public update behavior.

### Risks and mitigations

- Dependency omission could make evidence incomplete; production-only graph selection and known direct dependency checks are automated.
- A tool update could change output nondeterministically; versions are pinned, timestamps derive from the source revision, and output contracts are tested.
- Local application state could be touched during installation testing; destinations and test libraries are isolated, and the workflow rejects any non-test data path.
- Users could mistake a staged DMG for a public release; manifests and notes identify it as private, unsigned development material and automation does not upload it.

## Verification

Acceptance requires generated CycloneDX documents to validate, contain every direct production dependency, exclude named E2E-only dependencies, and provide reviewable license declarations. The manifest, checksums, package metadata, application bundle, and DMG must agree on version and identity. Clean installation and corrupted-checksum scenarios must pass locally and on the mandatory macOS GitHub Actions lane without touching an existing application or non-synthetic library.

The ADR can move to `Accepted` only after those workflows pass from a clean checkout. Reconsider the SBOM structure if the selected generators cannot represent the actual production graphs or if a later signed distribution system requires a different standard as its canonical predicate.
