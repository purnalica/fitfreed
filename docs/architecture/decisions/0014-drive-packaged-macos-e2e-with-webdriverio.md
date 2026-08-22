# ADR 0014: Drive packaged macOS E2E with WebdriverIO

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Testing strategy](../../testing-strategy.md)

## Context

FitFreed's critical journey crosses the React presentation, Tauri IPC, Rust use cases, SQLite persistence, native package shape, restart, and macOS WebView. Browser-only tests cannot prove that boundary. Early local execution also showed that a global `tauri-driver`, direct replacement of Tauri's non-configurable WebView proxy, and unchanged empty UI state could produce fragile setup or false cancellation evidence.

The production bundle must contain no testing authority. Synthetic E2E runs still need controlled file selection, failure evidence, application restart, accessibility analysis, and release-shaped execution on local and hosted macOS environments.

## Decision drivers

- Exercise the packaged desktop process rather than a browser preview.
- Keep driver setup reproducible and repository-owned.
- Exclude instrumentation and test capabilities from production packages.
- Synchronize on observed boundary calls instead of accepting unchanged state as success.
- Support exhaustive controls, invalid input, reimport, persistence, localization, accessibility, and performance checks.

## Considered alternatives

### Treat React browser tests as E2E evidence

Browser tests are fast and valuable for presentation behavior, but cannot prove Tauri commands, SQLite, native dialogs, packaged startup, or restart persistence.

### Require a separately installed Tauri driver

A global driver introduces undocumented machine state and caused avoidable contributor setup failures. It does not improve the product boundary being exercised.

### Use WebdriverIO with the embedded Tauri driver provider

The Tauri service can start the compiled application with a repository-locked driver stack, expose WebDriver behavior, and integrate with the existing JavaScript test and accessibility ecosystem.

## Decision

Packaged macOS behavioral E2E uses WebdriverIO with `@wdio/tauri-service` and its embedded driver provider.

- E2E builds use an explicit Rust feature and Tauri configuration. The behavioral package uses the isolated `src-tauri/target/e2e` target and packaged-update variants use `.artifacts/update-e2e/target`. Production builds use `src-tauri/target/release`; no instrumented build may overwrite or masquerade as the retained production application.
- The instrumented presentation replaces only the operating-system archive-picker adapter. Normal development and production builds call the native dialog.
- Tests wait for the recorded picker invocation before observing cancellation or selection; unchanged initial UI state is not completion evidence.
- Synthetic libraries, packages, logs, screenshots, and fixtures remain under ignored `.artifacts` paths. Failure capture must remain privacy-safe.
- Browser-level React tests remain the fast presentation layer; packaged E2E owns the cross-process, persistence, restart, accessibility, and in-WebView performance journey.
- GitHub Actions executes the same versioned packaged command on a macOS runner whenever executable or release inputs change and on explicit full verification.
- Production-bundle inspection rejects E2E JavaScript markers, Rust instrumentation, and test capabilities.

## Consequences

### Positive

- A clean clone does not require a global `tauri-driver` installation.
- The release-shaped journey covers the actual desktop boundary and persists through restart.
- Test authority has an explicit compile-time and packaging boundary.
- A retained production bundle remains safe to launch after an E2E campaign, while WebdriverIO can only select the isolated instrumented executable.

### Negative

- Packaged execution is substantially slower than React tests and requires macOS for the MVP gate.
- WebdriverIO and its service add development-only dependencies and transitive compatibility obligations.
- WebKit driver limitations require a narrow picker seam and legacy single-context accessibility execution.

### Risks and mitigations

- Instrumentation could leak into production. Feature gates, capabilities, and binary-content inspection fail packaging when markers remain.
- An instrumented bundle could be opened manually and make mocked operating-system controls appear broken. Separate target directories and a tested WebdriverIO executable path prevent an E2E build from occupying the production bundle location.
- Driver behavior could report success before native work occurs. Tests synchronize on the boundary call and assert the resulting persisted behavior.
- Development dependencies can introduce advisories. Locked overrides, dependency audit, provenance checks, and periodic upstream review protect the selected versions.

## Verification

The packaged journey covers ZIP validation, picker cancellation, progress, cancellation before visibility, invalid input, complete family coverage, exact and overlapping reimport, all four detailed explorers, the longitudinal view, every included control, both locales, persistence after restart, automated accessibility, 200% text sizing, and in-WebView performance budgets. Restart evidence uses two WebdriverIO invocations and therefore two packaged application processes: the first records its process identity after saving controlled state, and the second proves a different identity before recovering the same generated library and preferences through normal startup. `reloadSession()` remains useful for WebDriver continuity but is not restart evidence. Hosted macOS execution is mandatory for executable changes. A driver that cannot exercise a required native boundary without widening production authority, or an upstream support change that removes the embedded path, triggers reconsideration.
