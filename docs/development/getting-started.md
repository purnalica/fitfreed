# Contributor Setup

## Supported development baseline

The current product foundation is developed and packaged on macOS first. The repository pins:

- Node.js 22.14.0 in `.nvmrc`;
- npm 10.9.2 in `package.json`;
- Rust 1.97.1 with `rustfmt` and Clippy in `rust-toolchain.toml`.

Install the Xcode command-line tools and a Rustup installation before setup. Node version managers may read `.nvmrc`; Rustup reads the repository toolchain file automatically. The macOS system commands checked by `npm run doctor` include `ditto`, `hdiutil`, `openssl`, `plutil`, `shasum`, `sqlite3`, and `strings`. No separately installed Tauri, WebdriverIO, SQLite library, or fixture tool is required.

The portable quality lane compiles the pinned Tauri updater refinement on Linux. Debian and Ubuntu contributors running that lane need Tauri's native development packages: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, and `pkg-config`. GitHub Actions installs them explicitly before running `npm run doctor`; the doctor checks the required GLib, GIO, GObject, GTK, and WebKitGTK modules before reporting a usable Linux environment.

## First setup

From the repository root:

```sh
npm run doctor
npm ci
npm run test:fast
```

`npm run doctor` checks the supported Node.js and npm ranges, pinned Rust toolchain, required Rust components, macOS Xcode command-line toolchain and native commands, or the native Tauri development modules used by the Linux quality lane, without requiring installed project dependencies. `npm ci` installs the exact JavaScript graph from `package-lock.json`. The fast lane verifies compile-enforced architecture boundaries, the pinned updater source and provenance, translation catalogs, presentation behavior, GitHub workflow syntax and policy, the updater refinement test, and all FitFreed Rust workspace tests. Its workflow check installs checksum-verified actionlint 1.7.12 and ShellCheck 0.10.0 under ignored `.tools/`; no global installation is required and shell analysis is identical on supported contributor and CI hosts.

## Primary commands

| Outcome | Command |
|---|---|
| Diagnose the development environment | `npm run doctor` |
| Audit production and build dependencies | `npm run audit:dependencies` |
| Run the desktop application in development | `npm run tauri -- dev` |
| Verify architecture boundaries | `npm run check:architecture` |
| Verify canonical, mapping, and persistence contracts | `npm run check:data-contracts` |
| Verify release identity and version contracts | `npm run check:release-contracts` |
| Verify the application and library upgrade matrix | `npm run check:upgrade-matrix` |
| Verify documentation links and public-release guidance | `npm run check:docs` |
| Verify locale catalogs | `npm run check:i18n` |
| Verify reduced-motion presentation contracts | `npm run check:ui-contracts` |
| Verify pinned updater source and provenance | `npm run check:vendored-updater` |
| Verify GitHub workflow syntax and public-release policy | `npm run check:workflows && npm run check:public-release-workflow` |
| Seal a verified public candidate for protected handoff | `npm run pack:public-release -- <candidate-directory> <archive>` |
| Reopen an exact digest-bound public candidate | `npm run unpack:public-release -- <archive> <sha256> <candidate-directory>` |
| Run presentation tests | `npm test` |
| Run project automation tests | `npm run test:scripts` |
| Run all Rust tests | `npm run test:rust` |
| Run the pinned updater refinement test | `npm run test:vendor-updater` |
| Run the fast contributor lane | `npm run test:fast` |
| Check Rust formatting | `npm run format:check` |
| Run Clippy with warnings denied | `npm run lint:rust` |
| Generate independent E2E fixtures | `npm run fixture:e2e` |
| Generate the cancellation-scale fixture | `npm run fixture:large` |
| Generate the Insights performance fixture | `npm run fixture:insights-performance` |
| Verify full-scale import and exact-repeat budgets | `npm run benchmark:import` |
| Verify detailed and longitudinal read-model performance | `npm run benchmark:insights` |
| Build only the unsigned production application bundle | `npm run package:app` |
| Verify cold launch against that clean production bundle | `npm run benchmark:cold-launch` |
| Build the unsigned production package | `npm run package` |
| Install the pinned local release evidence tool | `npm run install:release-tools` |
| Install the pinned local workflow validator | `npm run install:workflow-tools` |
| Prepare release-shaped private evidence | `npm run prepare:development-release -- 0.1.0` |
| Verify macOS installation and failure boundaries | `npm run verify:development-release` |
| Verify recovery-pair preparation against the production app | `npm run verify:update-recovery-preparation` |
| Build and run the instrumented packaged E2E journey | `npm run verify:e2e` |
| Verify signed packaged update replacement and recovery | `npm run verify:update-e2e` |
| Run the broad local product-verification lane | `npm run verify:full` |

Generated application, database, fixture, log, screenshot, icon, and bundle output is ignored. Never replace the synthetic generators with a real provider export or a record copied from one.

The unsigned macOS production application and DMG are generated under `src-tauri/target/release/bundle/`. `npm run package:app` builds only `FitFreed.app` for the cold-launch campaign; `npm run package` builds the complete application and DMG set. Both commands bind the exact Git revision and clean-tree state into the host. The instrumented behavioral E2E executable and bundles use the separate `src-tauri/target/e2e/` target and must never be opened as a user build or distributed. WebdriverIO is contractually pinned to that isolated executable, so an E2E campaign cannot replace the production application a reviewer launches. Packaged-update test builds, ephemeral keys and certificates, isolated installed bundles, libraries, recovery state, logs, and screenshots live under ignored `.artifacts/update-e2e`; its Cargo output is further isolated under `.artifacts/update-e2e/target`.

## Synthetic fixture workflow

`npm run fixture:e2e` generates the current valid, invalid, and cumulative-overlap ZIP packages under `.artifacts/e2e/fixtures`. `npm run fixture:large` generates the 10,000-entry mixed activity, training, excluded-sample, expanded-volume, and cancellation scenario, while `npm run fixture:insights-performance` generates the two-year packaged-UI activity, training, sleep, recovery, and integrated longitudinal performance history. None of their output is added to Git. The behavioral source of truth is the [synthetic import scenario specification](../testing/synthetic-import-scenarios.md); every implemented scenario must keep its generator, expected outcome, data-format documentation, and tests consistent.

## Architecture navigation

- `src-tauri/crates/fitfreed-domain` contains provider-neutral concepts and reconciliation policy and has no dependencies.
- `src-tauri/crates/fitfreed-application` contains use cases, ports, provider-neutral domain Insights calculations, longitudinal composition, source-acquisition guide validation, progress, and cancellation coordination and depends only on the domain, calendar arithmetic, and its error helper.
- `src-tauri/src/infrastructure.rs` contains the Polar Flow ZIP/JSON anti-corruption layer, daily-activity, training-summary, sleep, and nightly-recovery mappings, SQLite adapter, and bundled Polar Flow acquisition-guide adapter.
- `src-tauri/src/infrastructure/update_recovery.rs` owns the macOS recovery-pair copy, deterministic application digest, SQLite verification, local manifest, and active-attempt persistence.
- `src-tauri/src/infrastructure/update_installation.rs` coordinates verified package installation with recovery preparation, watchdog readiness, native replacement, and failure handoff.
- `src-tauri/src/infrastructure/update_watchdog.rs` owns the preserved-executable process runner, restart-safe candidate observation, confirmation deadline, and recovery execution.
- `src-tauri/src/lib.rs` and `presentation.rs` are the Tauri host and serialized transport boundary.
- `src-tauri/vendor/tauri-plugin-updater` is the provenance-checked source refinement selected by ADR 0009; its `README.fitfreed.md` is the mandatory review and upgrade guide.
- `src` contains the React presentation, its desktop archive-picker and official-link adapters, and test-only presentation instrumentation; localized copy exists only under `src/locales`. `ApplicationShell` owns the persistent Home, Explore, Reports, Sources, and Settings navigation. Home owns the first-run promise and evidence-backed questions; Sources owns acquisition, import, outcomes, and compatibility evidence; Explore owns analytical history workspaces; Reports owns durable starts, ordered composition, stale-evidence review, privacy review, local export, and contextual source return; Settings owns durable presentation preferences.

The detailed dependency map is [`../architecture/module-map.md`](../architecture/module-map.md), the importer ownership boundary is [`../architecture/source-integration.md`](../architecture/source-integration.md), and the machine-readable contract index is [`../data-formats/README.md`](../data-formats/README.md). Source-format, acquisition-guide, canonical-format, mapping, or persistence changes must update their normative documentation, localized content when applicable, and synthetic contract evidence in the same increment.

Report work starts with [`../architecture/reporting.md`](../architecture/reporting.md). The domain owns versioned block invariants, the application resolves block references only through authoritative query ports, SQLite stores intent rather than copied evidence, and the HTML adapter receives only an authorized bounded projection. A new block kind therefore requires domain and application behavior, transport, persistence migration, canonical and portable schemas, independently constructed contract evidence, both locale catalogs, complete editor controls, privacy review where applicable, deterministic output, and component plus packaged E2E coverage in one vertical increment. Do not begin by adding a React control or by reading report data directly from SQLite.

The host starts one process-lifetime update schedule after setup. The ready interface still requests the immediate launch evaluation; later successful scheduled evaluations cross the host boundary through `fitfreed://update-check-completed`. The architecture check prevents the Rust and TypeScript event names from drifting. Tokio's paused clock makes the 24-hour cadence, repeated execution, no-burst behavior, and occupied-operation skip deterministic in the Rust fast lane; no developer should shorten the production interval to make these tests run.

The [localization guide](localization.md) documents locale resolution, durable preferences, formatting, translation-catalog rules, and the complete acceptance path for adding a language.

The [performance benchmark guide](performance-benchmarks.md) documents cold launch, synthetic scales, timed boundaries, run counts, percentile calculation, budgets, machine-readable evidence, and interpretation limits.

The [private release preparation guide](release-preparation.md) owns the clean-revision package and installation evidence lane. It remains separate from `verify:full` because preparation must bind its output to a clean, reviewable commit.

The [public release guide](public-release.md) owns the inactive production trust boundary, exact-tag preflight, protected inputs, signed candidate, immutable Release, Pages deployment, provenance, and remote verification workflow. `npm run check:docs` also binds the version-matched public user guide, maintainer runbook, manual evaluation, readiness ledger, supporting policies, reviewed release notes, release policy, and both initial locale catalogs. Contributor commands may verify that workflow, but normal setup and CI cannot publish a binary.

## Continuous integration

GitHub Actions classifies every pull request and `main` revision through a closed documentation-only allowlist. Documentation links and repository safety always run; README, canonical product-status, and static product-page changes additionally run their focused generated-content and page contracts. A documentation-only revision skips executable verification only when the exact Git-tree fingerprint of every executable and release input has evidence that both complete lanes previously passed; missing evidence fails closed. Executable, release-affecting, unknown, and explicitly requested changes run the complete portable quality checks and mandatory macOS packaged-E2E job. The macOS job verifies the full-scale import, exact-repeat, detailed-domain, longitudinal read-model, and production cold-launch budgets, prepares and installation-tests a normal private production package, and then builds separate test variants. It drives the packaged application through validation, progress, cancellation, both locales, exact and cumulative reimport, accessibility, persisted restart, and in-WebView performance budgets for all four detailed Insights areas and their integrated longitudinal view. It also exercises a real signed 0.1.0-to-0.2.0 native update through loopback HTTPS, including successful confirmation and automatic rollback after deliberate candidate rejection.

The instrumented build routes the archive picker, explicit official-link opener, and report-destination picker
through WebdriverIO mocks because these operating-system surfaces cannot be driven reliably through the embedded
macOS WebView. The E2E test verifies each complete invocation before observing its result and independently
opens the generated report bytes. Normal development and production builds use Tauri's native dialogs and
opener directly, and the production-bundle check rejects both Rust and presentation WebDriver markers.

When E2E fails, the job retains only synthetic screenshots and tool logs for seven days. It never uploads generated libraries, applications, updater packages, recovery pairs, signing material, fixture paths, real exports, or personal values.

The [troubleshooting guide](troubleshooting.md) is the canonical failure guide. It maps common symptoms to their owning boundary and lists privacy-safe escalation evidence.
