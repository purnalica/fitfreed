# Contributor Setup

## Supported development baseline

The current product foundation is developed and packaged on macOS first. The repository pins:

- Node.js 22.14.0 in `.nvmrc`;
- npm 10.9.2 in `package.json`;
- Rust 1.97.1 with `rustfmt` and Clippy in `rust-toolchain.toml`.

Install the Xcode command-line tools and a Rustup installation before setup. Node version managers may read `.nvmrc`; Rustup reads the repository toolchain file automatically. No global Tauri, WebdriverIO, SQLite, or fixture tool is required.

## First setup

From the repository root:

```sh
npm run doctor
npm ci
npm run test:fast
```

`npm run doctor` checks the supported Node.js and npm ranges, pinned Rust toolchain, required Rust components, macOS Xcode command-line toolchain, and native packaging and installation-verification commands without requiring installed project dependencies. `npm ci` installs the exact JavaScript graph from `package-lock.json`. The fast lane verifies compile-enforced architecture boundaries, translation catalogs, presentation behavior, and all Rust workspace tests.

## Primary commands

| Outcome | Command |
|---|---|
| Diagnose the development environment | `npm run doctor` |
| Audit production and build dependencies | `npm run audit:dependencies` |
| Run the desktop application in development | `npm run tauri -- dev` |
| Verify architecture boundaries | `npm run check:architecture` |
| Verify canonical, mapping, and persistence contracts | `npm run check:data-contracts` |
| Verify release identity and version contracts | `npm run check:release-contracts` |
| Verify locale catalogs | `npm run check:i18n` |
| Verify reduced-motion presentation contracts | `npm run check:ui-contracts` |
| Run presentation tests | `npm test` |
| Run project automation tests | `npm run test:scripts` |
| Run all Rust tests | `npm run test:rust` |
| Run the fast contributor lane | `npm run test:fast` |
| Check Rust formatting | `npm run format:check` |
| Run Clippy with warnings denied | `npm run lint:rust` |
| Generate independent E2E fixtures | `npm run fixture:e2e` |
| Generate the cancellation-scale fixture | `npm run fixture:large` |
| Build the unsigned production package | `npm run package` |
| Install the pinned local release evidence tool | `npm run install:release-tools` |
| Prepare release-shaped private evidence | `npm run prepare:development-release -- 0.1.0` |
| Verify macOS installation and failure boundaries | `npm run verify:development-release` |
| Build and run the instrumented packaged E2E journey | `npm run verify:e2e` |
| Run every current local acceptance gate | `npm run verify:full` |

Generated application, database, fixture, log, screenshot, icon, and bundle output is ignored. Never replace the synthetic generators with a real provider export or a record copied from one.

The unsigned macOS production application and DMG are generated under `src-tauri/target/release/bundle/`. The separate E2E build is instrumented and must never be distributed. `npm run verify:full` finishes by rebuilding and checking the production package so the retained bundle is not the instrumented variant.

## Synthetic fixture workflow

`npm run fixture:e2e` generates the current valid, invalid, and cumulative-overlap ZIP packages under `.artifacts/e2e/fixtures`. `npm run fixture:large` generates the local entry-count and cancellation scenario without adding its output to Git. The behavioral source of truth is the [synthetic import scenario specification](../testing/synthetic-import-scenarios.md); every implemented scenario must keep its generator, expected outcome, data-format documentation, and tests consistent.

## Architecture navigation

- `src-tauri/crates/fitfreed-domain` contains provider-neutral concepts and reconciliation policy and has no dependencies.
- `src-tauri/crates/fitfreed-application` contains use cases, ports, progress, and cancellation coordination and depends only on the domain and its error helper.
- `src-tauri/src/infrastructure.rs` contains the Polar Flow ZIP/JSON adapter and SQLite adapter demonstrated by the first vertical slice.
- `src-tauri/src/lib.rs` and `presentation.rs` are the Tauri host and serialized transport boundary.
- `src` contains the React presentation, its desktop archive-picker adapter, and test-only presentation instrumentation; localized copy exists only under `src/locales`.

The detailed dependency map is [`../architecture/module-map.md`](../architecture/module-map.md), and the machine-readable contract index is [`../data-formats/README.md`](../data-formats/README.md). Source-format, canonical-format, mapping, or persistence changes must update their normative documentation and synthetic contract evidence in the same increment.

The [localization guide](localization.md) documents locale resolution, durable preferences, formatting, translation-catalog rules, and the complete acceptance path for adding a language.

The [private release preparation guide](release-preparation.md) owns the clean-revision package and installation evidence lane. It remains separate from `verify:full` because preparation must bind its output to a clean, reviewable commit.

## Continuous integration

GitHub Actions runs portable quality checks and a mandatory macOS packaged-E2E job for pull requests and `main`. The macOS job prepares and installation-tests a normal private production package before building the separate test variant. It then drives the packaged application through validation, progress, cancellation, both locales, exact and cumulative reimport, accessibility, and persisted restart.

The instrumented build routes only the archive-picker adapter to WebdriverIO's dialog mock because the embedded macOS WebView exposes Tauri globals through a non-configurable proxy. The E2E test waits for the recorded picker call before observing its result. Normal development and production builds use Tauri's native dialog directly, and the production-bundle check rejects both Rust and presentation WebDriver markers.

When E2E fails, the job retains only synthetic screenshots and tool logs for seven days. It never uploads the generated library, fixture paths, real exports, or personal values.

The [troubleshooting guide](troubleshooting.md) is the canonical failure guide. It maps common symptoms to their owning boundary and lists privacy-safe escalation evidence.
