# Application Stack Architecture

## Status

Current architecture after [ADR 0001](decisions/0001-select-tauri-application-stack.md). This document describes dependency ownership; it does not make Tauri or React the product architecture.

## Layer ownership

| Area | Selected technology | Architectural responsibility |
|---|---|---|
| Domain | Rust without desktop, persistence, ZIP, JSON, or provider-framework dependencies | FitFreed concepts, identities, value objects, invariants, and reconciliation policy |
| Application | Rust | Use cases, input and output ports, transaction intent, progress, cancellation, and provider-neutral DTOs |
| Source and infrastructure adapters | Rust | Provider decoding, ZIP and JSON access, persistence, migrations, backup, update service, and operating-system integrations |
| Storage | Bundled SQLite through a Rust adapter | Authoritative local library, migrations, backup, indexes, and rebuildable projections |
| Desktop host | Tauri 2 | Process lifecycle, windowing, native dialogs, capabilities, command registration, packaging, and update integration |
| Presentation | TypeScript and React with semantic HTML and CSS visualizations | Localized interaction, accessible visualization, view state, and command invocation |

The current physical modules and compile-time boundaries are documented in the [module map](module-map.md).

## Dependency rules

- Dependencies point inward from Tauri, React, and infrastructure adapters toward application ports and the domain.
- Domain and application modules do not import Tauri, React, provider schemas, database APIs, archive APIs, or operating-system APIs.
- Tauri commands are thin inbound adapters. They validate transport input, invoke one use case, translate failures, and return serializable provider-neutral results.
- The renderer receives only the data required by a view. It never receives filesystem paths, database handles, provider JSON, or unrestricted native authority.
- Provider names and schemas remain in source adapters and compatibility documentation.
- Long-running import work executes outside the UI event path and reports explicit progress and cancellation outcomes through application ports.

## Process boundary

The initial desktop distribution uses one Tauri application process and its managed blocking-task runtime. Import use cases execute on blocking workers rather than the UI event path. Application coordination permits one active import; adapter tests prove atomic visibility and cancellation rollback. Packaged timing, shutdown, and restart recovery remain mandatory hosted-E2E gates.

Normal production builds bind the exact Git revision and clean-tree state into the host through the versioned build wrapper. Startup has an explicit progressive boundary. Durable import recovery starts on a blocking worker while the WebView initializes; the application-preference load and import commands share a process-scoped completion barrier, and import and preference mutation remain disabled until recovery releases it. The renderer exposes only a neutral startup surface until the complete persisted preference set has been validated, recovered if necessary, and applied to the document language, appearance, and zoom. It then reveals the localized shell with Explore, Sources, and Settings; Home is the question-led root of Explore. React waits for the next animation frame and invokes the host's one-shot interactive-shell signal. Source guidance, the provider-neutral Library Home, latest import outcome, update discovery, and update-recovery confirmation begin only after that command settles.

Startup chooses a destination from canonical state. An empty library opens Sources; a populated library opens Home; and a valid durable exploration destination that the current library can still answer restores that exact explorer. Home composes the authoritative default read models and exposes only evidence-backed questions, measurement coverage, an explicitly correlated post-import reveal, and an optional resumable destination. It never reads provider records or persistence tables from presentation and never duplicates report calculations. Opening a question stores only the versioned destination and mounts only its analytical presentation module; unrelated analytical queries do not run. **Back to Home** clears that durable destination. Temporarily visiting Sources or Settings preserves the active explorer, while leaving Settings without saving discards its presentation-only preview and restores the complete saved preference set. Update discovery still runs after ready startup, but its maintenance controls are presented in Settings rather than occupying Home. This overlaps independent startup work and keeps non-essential reads, parsing, and rendering outside the first interactive frame without changing their behavior, visibility boundary, or failure reporting. The normative Home and workspace contract is documented in [Library Home version 1](../data-formats/insights/library-home-v1.md).

The host writes only a closed JSON object containing its fixed event contract, application version, source revision, clean-tree state, and bounded monotonic startup durations. The durations cover host setup completion and host receipt of the signal plus renderer locale readiness and signal invocation. They contain no wall-clock timestamps, paths, host identity, application data, or operation values. The benchmark combines them with its outer process timer to report aggregate phase distributions while retaining the application-owned process-to-painted-shell boundary without WebDriver, WebView reloads, personal data, filesystem paths, or test-only package capabilities. Failure to write or validate the diagnostic signal never blocks ordinary deferred startup; a benchmark that cannot observe it fails closed.

## Contributor contract

The repository will pin supported Rust and Node versions and expose one documented command for each fast check, full verification, application launch, package build, and release-shaped test. A clean clone must not require private data, proprietary services, or undocumented global tooling.

Storage is defined by [ADR 0002](decisions/0002-select-sqlite-storage.md). Update trust is defined by [ADR 0008](decisions/0008-authenticate-update-policy-above-tauri.md). [ADR 0013](decisions/0013-render-mvp-visualizations-with-semantic-html.md) owns the MVP visualization boundary, and [ADR 0014](decisions/0014-drive-packaged-macos-e2e-with-webdriverio.md) owns packaged macOS behavioral automation.
