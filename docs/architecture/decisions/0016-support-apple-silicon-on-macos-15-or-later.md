# ADR 0016: Support Apple Silicon on macOS 15 or later

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [quality targets](../../quality-targets.md)

## Context

The macOS MVP already targets Apple Silicon, but its minimum operating-system version was unresolved. Tauri therefore emitted its default macOS 10.13 bundle metadata while the Apple Silicon executable required a later system. That mismatch was not a support contract and prevented an honest candidate handoff.

FitFreed needs a boundary that covers the approved processor family, can be exercised through production entry points, and remains maintainable in hosted automation. Apple lists the first M1 devices and every later Apple Silicon family among the computers compatible with macOS Sequoia 15. GitHub provides a maintained `macos-15` Apple Silicon runner, while its macOS 14 runner is already scheduled for retirement. Tauri maps `bundle.macOS.minimumSystemVersion` to both `LSMinimumSystemVersion` and `MACOSX_DEPLOYMENT_TARGET`.

## Decision drivers

- Cover every Apple Silicon generation without claiming Intel support.
- Test the minimum operating-system major version on the same architecture as the product.
- Keep package metadata and executable deployment targets identical.
- Avoid a support floor whose hosted verification is already being retired.
- Permit later expansion only after equivalent evidence exists.

## Considered alternatives

### macOS 11 or later

macOS 11 is the first Apple Silicon release and maximizes theoretical compatibility. No maintained hosted environment or controlled physical device is available to execute the complete FitFreed acceptance suite on that version.

### macOS 14 or later

macOS 14 supports Apple Silicon, but its hosted runner is already in deprecation. Selecting it would immediately create an expiring minimum-version gate.

### macOS 15 or later

macOS 15 supports every Apple Silicon generation and has a maintained Apple Silicon runner on which the complete packaged, update, recovery, and performance campaign already executes.

### Current macOS only

Requiring only the newest major release would simplify testing but unnecessarily exclude compatible Apple Silicon devices and create annual support churn.

## Decision

FitFreed 0.1.0 supports Apple Silicon on macOS 15.0 or later.

- Tauri bundle metadata and the executable deployment target are both `15.0`.
- The mandatory hosted packaged campaign runs on the pinned `macos-15` Apple Silicon image.
- Release verification rejects a bundle whose `LSMinimumSystemVersion` or Mach-O minimum differs from `15.0`.
- Intel packages are outside the macOS MVP and must not be inferred from Tauri's ability to build them.
- A future lower minimum or additional architecture requires its own maintained packaged, installation, update, recovery, accessibility, and performance evidence.

## Consequences

### Positive

- The platform boundary is executable, testable, and consistent across metadata and binary output.
- Every Apple Silicon generation remains inside the supported hardware family.
- CI detects platform drift before release preparation.

### Negative

- Macs that cannot run macOS 15 are unsupported even if an unofficial build starts.
- The minimum must be revisited before the hosted macOS 15 image is retired.
- Intel users remain outside the MVP.

### Risks and mitigations

- A dependency may silently raise its deployment target. Bundle inspection compares the actual Mach-O command and package metadata with the declared boundary.
- A hosted label may change architecture or retire. The workflow pins `macos-15`, and the release-readiness review tracks the runner's published lifecycle.
- Documentation may overstate performance across supported Macs. [ADR 0015](0015-qualify-performance-evidence-by-execution-environment.md) keeps functional support separate from environment-qualified performance.

## Verification

Release-contract tests require `15.0` in Tauri configuration. Production bundle inspection reads `LSMinimumSystemVersion` and the executable's Mach-O minimum. The complete hosted macOS job builds, launches, imports, queries, updates, recovers, and packages the application on GitHub's Apple Silicon macOS 15 image. The official compatibility and tool behavior are documented by [Apple's macOS Sequoia compatibility list](https://support.apple.com/en-us/120282), [GitHub's runner-image catalogue](https://github.com/actions/runner-images), and [Tauri's macOS bundle configuration](https://v2.tauri.app/reference/config/#macconfig).
