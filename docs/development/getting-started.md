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
npm ci
npm run test:fast
```

`npm ci` installs the exact JavaScript graph from `package-lock.json`. The fast lane verifies compile-enforced architecture boundaries, translation catalogs, presentation behavior, and all Rust workspace tests.

## Primary commands

| Outcome | Command |
|---|---|
| Run the desktop application in development | `npm run tauri -- dev` |
| Verify architecture boundaries | `npm run check:architecture` |
| Verify canonical, mapping, and persistence contracts | `npm run check:data-contracts` |
| Verify locale catalogs | `npm run check:i18n` |
| Run presentation tests | `npm test` |
| Run all Rust tests | `npm run test:rust` |
| Run the fast contributor lane | `npm run test:fast` |
| Check Rust formatting | `npm run format:check` |
| Run Clippy with warnings denied | `npm run lint:rust` |
| Generate independent E2E fixtures | `npm run fixture:e2e` |
| Generate the cancellation-scale fixture | `npm run fixture:large` |
| Build the unsigned production package | `npm run package` |
| Build and run the instrumented packaged E2E journey | `npm run verify:e2e` |

Generated application, database, fixture, log, screenshot, icon, and bundle output is ignored. Never replace the synthetic generators with a real provider export or a record copied from one.

## Architecture navigation

- `src-tauri/crates/fitfreed-domain` contains provider-neutral concepts and reconciliation policy and has no dependencies.
- `src-tauri/crates/fitfreed-application` contains use cases, ports, progress, and cancellation coordination and depends only on the domain and its error helper.
- `src-tauri/src/infrastructure.rs` contains the Polar Flow ZIP/JSON adapter and SQLite adapter demonstrated by the first vertical slice.
- `src-tauri/src/lib.rs` and `presentation.rs` are the Tauri host and serialized transport boundary.
- `src` contains the React presentation; localized copy exists only under `src/locales`.

The detailed dependency map is [`../architecture/module-map.md`](../architecture/module-map.md), and the machine-readable contract index is [`../data-formats/README.md`](../data-formats/README.md). Source-format, canonical-format, mapping, or persistence changes must update their normative documentation and synthetic contract evidence in the same increment.

## Continuous integration

GitHub Actions runs portable quality checks and a mandatory macOS packaged-E2E job for pull requests and `main`. The macOS job builds a normal production package first and rejects WebDriver instrumentation before building the separate test variant. It then drives the packaged application through validation, progress, cancellation, both locales, exact and cumulative reimport, accessibility, and persisted restart.

When E2E fails, the job retains only synthetic screenshots and tool logs for seven days. It never uploads the generated library, fixture paths, real exports, or personal values.

## Troubleshooting

- If Rust reports a missing toolchain component, run `rustup show` from the repository root and confirm that Rustup can install the pinned `rustfmt` and Clippy components.
- If `npm ci` changes `package-lock.json`, the installed npm version does not match the supported baseline or the lockfile was already inconsistent. Do not commit an unexplained lockfile rewrite.
- If packaging selects the wrong executable, verify `default-run = "fitfreed"` and run `npm run check:production-bundle` after the package build.
- Treat a flaky or environment-dependent test as a defect. Reproduce and correct its state, timing, or platform dependency; do not remove the assertion or silently skip the gate.
