# ADR 0001: Select the Tauri application stack

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** FitFreed project owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Application stack](../application-stack.md)

## Context

FitFreed needs a macOS-first desktop stack that preserves Clean Architecture and DDD boundaries, processes multi-gigabyte exports with bounded memory, supports an accessible localized visual interface, produces straightforward native packages, and provides a credible route to signed cross-platform updates. Contributor setup, feedback speed, distributable size, supply-chain surface, and GPL compatibility are part of the product decision.

The technology paper screen advanced Tauri and Electron to equivalent disposable spikes. Both paths implemented the same synthetic import, reconciliation, SQLite persistence, query, localization, visualization, recovery, and packaging scenario. The spike evidence records remaining release-readiness gates separately from the application-family choice.

Storage architecture, visualization libraries, end-to-end driver, and release automation remain outside this decision boundary.

## Decision drivers

- Bounded-memory import throughput and low runtime overhead.
- Explicit separation between a framework-free core and the desktop host.
- Small native packages that do not bundle a browser runtime.
- Mandatory cryptographic verification in the official updater path.
- Explicit runtime capabilities and a narrow command boundary.
- A credible macOS, Linux, and Windows delivery path.
- Sustainable open-source contributor and dependency governance.

## Considered alternatives

### Tauri 2 with Rust and a TypeScript web interface

The integrated Rust path imported the large synthetic scenario approximately five times faster than the TypeScript/Node path while using approximately one tenth of its measured peak resident memory. Its corrected unsigned macOS application bundle occupies approximately 12 MiB. Tauri uses the operating-system webview and exposes an explicit capability model.

The main costs are a dual Rust and TypeScript toolchain, platform-webview variability, and the need to prove accessibility and packaged E2E behavior on every supported operating system.

### Electron with TypeScript

Electron offers one primary application language, consistent Chromium rendering, mature web tooling, and fast warm packaging. The spike demonstrated equivalent core correctness.

It was not selected because the measured import and memory costs, approximately 275 MiB application bundle, bundled browser security surface, generated-tooling repairs, experimental Forge Vite integration, and release-candidate SQLite binding outweighed those advantages for this local-first product.

### Avalonia, Flutter, and Compose Multiplatform

The paper screen retained Avalonia as a reserve and rejected the other families for the current milestone. None produced evidence strong enough to displace either finalist. Their dated assessment remains in the technology paper screen rather than being duplicated here.

## Decision

FitFreed will use:

- Tauri 2 as the desktop host and operating-system integration boundary;
- Rust for domain, application, import, reconciliation, and infrastructure code;
- TypeScript and React for the presentation layer; and
- explicit Tauri commands and serializable DTOs as the boundary between presentation and application adapters.

Tauri and React remain outer-layer implementation details. Domain and use-case code must not depend on them. Provider-specific formats remain behind source adapters and must not cross the application boundary.

The Electron spike will not be retained as an alternative implementation. Its durable value is the comparative evidence and rejected-alternative record.

## Consequences

### Positive

- The common import path has materially lower measured time and memory use.
- The packaged application remains small and uses the system webview.
- Rust types and ownership support bounded resource handling and explicit domain invariants.
- Tauri capabilities and commands provide a narrow, reviewable authority boundary.
- The official updater aligns with mandatory artifact-signature verification.

### Negative

- Contributors need supported Rust and Node toolchains.
- Platform webviews can differ in rendering and accessibility behavior.
- Rust compile times and the larger transitive crate graph require deliberate tooling and documentation.
- Native-dialog and whole-application E2E tests require Tauri-specific seams and drivers.

### Risks and mitigations

- Accessibility or webview regressions may differ by platform; automated semantic checks and real keyboard and assistive-technology acceptance are release gates.
- The dual toolchain can harm onboarding; versions, installation, diagnostics, and one-command verification will be automated and documented.
- Tauri APIs could leak into inner layers; module dependency checks will enforce inward dependencies.
- If Tauri cannot meet a non-negotiable release gate, this decision will be reconsidered against the reserve candidate rather than patched with a parallel host.

## Verification

The decision is supported by the [paper screen](../../research/technology-paper-screen.md) and [integrated spike evidence](../../research/technology-spike-2026-08-15.md). Reconsider it if Tauri fails required macOS accessibility, packaged E2E, update recovery, minimum-hardware, Linux accessibility, GPL compatibility, or sustainable clean-clone contributor gates.
