# Milestone 0 Technology Paper Screen

## Status

Completed on 2026-08-15. This is a dated evidence filter, not a technology decision. Tauri and Electron advance to equivalent integrated spikes; Avalonia remains the reserve candidate if either finalist fails a non-negotiable constraint.

## Method

The five application families required by [`../technology-evaluation.md`](../technology-evaluation.md) were assessed against its weights using current primary documentation. Each criterion receives a score from `0` (no credible path) to `5` (strong direct evidence). The weighted total is the sum of `weight × score ÷ 5`.

Missing evidence reduces a score. A framework feature list cannot prove FitFreed's import recovery, accessibility, packaging, performance, or contributor workflow; those claims remain provisional until exercised by the common spike.

## Application-family screen

| Candidate | Import and recovery 18 | Distribution and updates 16 | UX, accessibility, localization, visualization 16 | Storage and memory 15 | Architecture 10 | Testing 10 | Contributor experience 10 | Security, footprint, license 5 | Total / 100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Tauri 2 + Rust + TypeScript web UI | 4.0 | 5.0 | 4.0 | 4.5 | 5.0 | 4.5 | 3.5 | 5.0 | **87.7** |
| Electron + TypeScript web UI | 4.0 | 4.5 | 5.0 | 4.0 | 4.0 | 4.0 | 5.0 | 2.5 | **85.3** |
| .NET + Avalonia UI | 4.5 | 3.0 | 4.5 | 4.0 | 5.0 | 4.5 | 3.5 | 4.0 | **82.2** |
| Flutter desktop + Dart | 4.0 | 3.0 | 4.0 | 3.5 | 4.0 | 4.0 | 4.0 | 3.5 | **74.8** |
| Kotlin/JVM + Compose Multiplatform Desktop | 4.5 | 3.5 | 2.0 | 4.5 | 5.0 | 3.5 | 3.0 | 3.0 | **73.3** |

The 2.4-point difference between the finalists is too small and too dependent on unmeasured behavior to select from documentation. Both must complete the same spike.

## Evidence by family

### Tauri 2

Strengths:

- Official tooling builds macOS application bundles and documents signing, notarization, DMG, Linux, and Windows distribution paths.
- The updater requires cryptographic signatures and does not permit signature verification to be disabled. It produces signed artifacts for macOS, Linux, and Windows and supports static metadata.
- The capabilities, permission scopes, runtime authority, and configurable content security policy provide an explicit least-privilege boundary between bundled UI and system access.
- Current official WebDriver guidance supports packaged-application testing on macOS through the embedded WebdriverIO provider, including IPC execution and mocking. This removes an earlier macOS automation gap, but the test plugins and production exclusion still require inspection.
- Rust offers a strong fit for bounded-memory import, explicit domain types, and framework-independent modules. Tauri uses the operating system webview rather than shipping a browser runtime.

Risks and spike obligations:

- Contributors need both Rust and the TypeScript toolchain; clean setup and feedback-loop cost must be measured rather than assumed.
- The system webview changes across operating systems and versions. Rendering, accessibility, localization, SVG/chart behavior, and E2E consistency require real platform evidence.
- Tauri does not prove application-level transaction recovery, schema migration, or accessible visualization. Those remain FitFreed responsibilities.

Primary evidence: [Tauri architecture](https://v2.tauri.app/concept/architecture/), [prerequisites](https://v2.tauri.app/start/prerequisites/), [capabilities](https://v2.tauri.app/security/capabilities/), [content security policy](https://v2.tauri.app/security/csp/), [distribution](https://v2.tauri.app/distribute/), [macOS bundles](https://v2.tauri.app/distribute/macos-application-bundle/), [updater](https://v2.tauri.app/plugin/updater/), and [WebDriver testing](https://v2.tauri.app/develop/tests/webdriver/).

### Electron

Strengths:

- One TypeScript-oriented ecosystem can cover the host, application orchestration, web UI, tests, and contributor tooling.
- A bundled Chromium runtime gives consistent HTML, CSS, SVG, internationalization, and accessibility-tree behavior across supported operating systems.
- Official Forge-oriented documentation covers packaging, code signing, and notarization. Electron's updater covers macOS and Windows, with static-feed support.
- The web ecosystem provides mature visualization and accessibility tooling. Playwright can drive Electron windows and the main process.

Risks and spike obligations:

- The built-in macOS updater requires a code-signed application, so the unsigned private alpha needs a separate verified notification and guided-install path rather than pretending the production updater already works.
- Electron has no built-in Linux updater; the future Linux strategy must integrate with distribution packages or another explicit mechanism.
- Playwright labels Electron automation experimental and does not drive native dialogs directly. The release-shaped file-picker and installation journeys need a separate controllable seam or platform driver.
- Shipping Chromium and Node increases package size, runtime memory, security-update urgency, and supply-chain surface. Official guidance requires sandboxing, context isolation, restrictive navigation, validated IPC senders, and a content security policy.

Primary evidence: [Electron accessibility](https://www.electronjs.org/docs/latest/tutorial/accessibility), [security](https://www.electronjs.org/docs/latest/tutorial/security), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [updates](https://www.electronjs.org/docs/latest/tutorial/updates), [`autoUpdater`](https://www.electronjs.org/docs/latest/api/auto-updater/), [code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing), [ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity), and [Playwright Electron automation](https://playwright.dev/docs/api/class-electron).

### Avalonia

Avalonia remains technically credible. Official documentation describes full accessibility bridges to NSAccessibility, UI Automation, and AT-SPI, plus headless tests and Appium E2E through the platform accessibility tree. The framework is MIT licensed.

It ranks below the finalists because the documented open-source macOS route requires manual application-bundle, signing, notarization, and DMG work, while the first-party Parcel automation CLI requires an Avalonia Plus license and credential. No equivalent first-party open updater path was established in this review. Third-party or project-authored packaging and update automation could work, but it adds critical-path evidence and maintenance that the finalists provide more directly.

Primary evidence: [Avalonia accessibility](https://docs.avaloniaui.net/docs/app-development/accessibility), [testing](https://docs.avaloniaui.net/docs/testing/), [macOS deployment](https://docs.avaloniaui.net/docs/deployment/macos), [tooling FAQ](https://docs.avaloniaui.net/tools/faq), and [Parcel CLI](https://docs.avaloniaui.net/tools/parcel/command-line-reference).

### Compose Multiplatform Desktop

Kotlin, the JVM, Gradle, and desktop Compose testing provide a strong domain and storage path, and desktop Compose is stable. Official native distribution tasks produce self-contained DMG or PKG, EXE or MSI, and DEB or RPM packages and cover macOS signing and notarization.

Compose does not advance because current official documentation marks macOS accessibility fully supported, Windows supported through Java Access Bridge, and Linux unsupported. Linux is FitFreed's second target platform, so this is a current non-negotiable platform-evolution failure rather than a minor score difference. The common Compose UI test API is also experimental, an open JetBrains issue describes the need for Selenium/Appium-like whole-application testing, and no first-party cryptographically verified desktop updater path was established. Reconsideration requires official Linux accessibility support and a credible release-shaped E2E path.

Primary evidence: [native distributions](https://kotlinlang.org/docs/multiplatform/compose-native-distribution.html), [desktop accessibility status](https://kotlinlang.org/docs/multiplatform/compose-desktop-accessibility.html), [Compose UI testing](https://kotlinlang.org/docs/multiplatform/compose-test.html), [desktop stability](https://blog.jetbrains.com/kotlin/2023/08/compose-multiplatform-1-5-0-release/), and [whole-application testing gap](https://youtrack.jetbrains.com/projects/CMP/issues/CMP-7094/Support-selenium-like-UI-testing).

### Flutter desktop

Flutter officially builds native applications for macOS, Windows, and Linux, has a single SDK, supplies a semantics model, and includes unit, widget, performance, and desktop integration testing.

It ranks below the finalists because the official integration driver cannot interact with native platform UI, the reviewed macOS release guide centers on Xcode and App Store distribution, and no first-party cross-platform desktop updater with FitFreed's signature and recovery contract was established. Flutter also requires the full Xcode and CocoaPods setup for macOS development, whereas the current Tauri and Electron spikes can package with the installed command-line tools. These are delivery and testability penalties, not a judgment about visual quality.

Primary evidence: [Flutter desktop support](https://docs.flutter.dev/platform-integration/desktop), [macOS setup](https://docs.flutter.dev/platform-integration/macos/setup), [macOS release](https://docs.flutter.dev/deployment/macos), [accessibility technologies](https://docs.flutter.dev/ui/accessibility/assistive-technologies), and [integration testing](https://docs.flutter.dev/cookbook/testing/integration/introduction).

## Storage architecture screen

Storage uses a separate fit matrix because desktop rendering and updater criteria do not distinguish embedded databases.

| Candidate | Transactions and recovery 25 | Analytical scale 25 | Import writes 15 | Migration and backup 10 | Cross-platform integration 10 | Simplicity and DX 10 | Security and license 5 | Total / 100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| SQLite system of record | 5.0 | 4.0 | 4.5 | 5.0 | 5.0 | 5.0 | 5.0 | **93.5** |
| DuckDB system of record | 4.0 | 5.0 | 5.0 | 4.0 | 4.5 | 4.0 | 4.5 | **89.5** |
| SQLite plus rebuildable analytical store | 4.0 | 5.0 | 4.0 | 3.0 | 3.0 | 2.0 | 4.5 | **77.5** |

SQLite advances as the default transactional candidate. It is designed for local application storage, provides atomic commit and rollback, supports concurrent readers with one serialized writer, has a stable cross-platform file format and online backup API, and is public domain. FitFreed's single local writer and staged short visibility commit align with that model. WAL checkpoint behavior and bulk-import transaction sizing require measurement.

DuckDB advances as a comparative analytical candidate, not as a presumed second store. It provides ACID transactions, snapshot isolation, vectorized execution, spill-to-disk support, and primary Rust and Node clients under MIT. It is optimized for bulk analytical work; some allocations and indexes fall outside its configured memory limit, and current guidance recommends substantial memory per execution thread. Recovery, migrations, small reconciliation writes, backup, and the 8 GB reference profile require direct evidence.

The two-store design does not advance to implementation. It is reconsidered only if SQLite fails a required query or scale budget and DuckDB cannot safely own the transactional library. A measured failure must justify the additional consistency, migration, backup, packaging, and contributor burden.

Primary evidence: [appropriate SQLite uses](https://www.sqlite.org/whentouse.html), [SQLite transactions](https://www.sqlite.org/transactional.html), [write-ahead logging](https://www.sqlite.org/wal.html), [backup API](https://www.sqlite.org/backup.html), [SQLite public-domain status](https://www.sqlite.org/copyright.html), [DuckDB transactions](https://duckdb.org/docs/stable/sql/statements/transactions), [DuckDB persistence](https://duckdb.org/docs/stable/connect/overview), [client support](https://duckdb.org/docs/stable/clients/overview), [workload tuning](https://duckdb.org/docs/stable/guides/performance/how_to_tune_workloads), and [memory limits](https://duckdb.org/docs/stable/configuration/pragmas).

## Spike decision

The common spike proceeds in this order:

1. Implement the provider-neutral import, reconciliation, SQLite persistence, query, localization, and accessible visualization scenario without a desktop framework dependency.
2. Host that same application path in Tauri and Electron shells; neither candidate may receive a simplified domain or fake persistence path.
3. Package and launch unsigned macOS application bundles, record artifact and runtime measurements, and drive release-shaped E2E paths.
4. Exercise signed-update metadata and tamper rejection without publishing a release or requiring Apple credentials.
5. Compare representative analytical queries with DuckDB only after SQLite establishes the correctness baseline.

Avalonia is activated as the reserve spike if a finalist fails a non-negotiable constraint and the failure is specific to that family rather than to the shared scenario.

## Reverification triggers

Repeat this screen before an ADR when a finalist releases a new major version, an official E2E or updater path materially changes, a dependency becomes license-incompatible, a platform drops required operating-system support, or the integrated measurements invalidate a paper assumption.
