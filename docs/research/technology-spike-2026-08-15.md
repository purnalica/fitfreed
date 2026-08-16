# Integrated Technology Spike Evidence

## Status

Evidence was recorded on 2026-08-15 and extended on 2026-08-16. [ADR 0001](../architecture/decisions/0001-select-tauri-application-stack.md) selects Tauri 2, a Rust core, and a TypeScript and React presentation layer. The unresolved release-shaped gates below remain required implementation and release-readiness evidence; selection does not imply that they have passed.

Rejected-candidate source, generated archives, databases, application bundles, private keys, and raw measurements remain outside version control. The selected Tauri behavior, tests, fixture generators, and packaging configuration were promoted into the versioned product foundation on 2026-08-16; the ignored Tauri spike was then removed. This document contains only independently generated scenario definitions, sanitized measurements, conclusions, and limitations.

## Evaluated paths

The two paper-screen finalists implement the same narrow vertical scenario:

- a React interface with equivalent semantic HTML and styling;
- runtime switching between `en-US` and `es-ES`;
- a visual daily step comparison with an exact table alternative;
- ZIP inspection with a 10,000-entry limit, an 8 GiB expanded-size limit, a 64 MiB per-entry limit, duplicate-name rejection, and root-only member policy;
- one-entry-at-a-time archive access rather than whole-archive loading;
- mapping from a synthetic Polar-shaped activity artifact into a provider-neutral `DailyActivity` observation;
- SQLite persistence keyed by observation origin and local date;
- exact-package repeat detection, semantic equivalence, compatible enrichment, preservation of richer existing data, and explicit conflict recording;
- transactional rollback after invalid content or an injected interruption;
- inclusive local-date range queries; and
- unsigned Apple Silicon application packaging.

The Tauri path uses Rust, `rusqlite` with bundled SQLite, and the Tauri command boundary. The Electron path uses TypeScript, the Node `node:sqlite` module, a sandboxed preload bridge, sender-validated IPC, and Electron Forge.

Neither original disposable core was the production Clean Architecture module structure. The promoted foundation now uses separate `fitfreed-domain` and `fitfreed-application` Cargo crates, concrete infrastructure adapters, transport DTOs, and a thin Tauri host. Cargo manifests and a metadata check enforce the inward dependency direction; further decomposition of the first infrastructure adapter continues with the vertical slice.

## Environment

| Item | Evaluated value |
|---|---|
| Execution profile | Local Apple Silicon macOS workstation materially above the provisional 8 GB reference profile; exact workstation details remain local |
| Rust toolchain | `rustc` and Cargo 1.97.1 |
| Tauri | CLI 2.11.4, Rust crate 2.11.5 |
| Local Node used for the TypeScript core benchmark | 22.14.0 |
| Electron | 43.4.0 with Forge 7.11.2 |

The machine materially exceeds the provisional 8 GB reference profile. These measurements compare the candidates on one machine; they do not validate minimum-hardware budgets. Electron 43 embeds Node 24, but display-control restrictions prevented the packaged Electron runtime from being exercised in this checkpoint. The Node core measurements therefore prove that implementation path, not the final packaged process.

## Correctness evidence

Each core passes twelve equivalent automated integration tests:

1. first import, sorted query, and exact repeat without duplicates;
2. equivalent overlap, compatible enrichment, preservation of richer data, and conflict retention;
3. injected interruption with zero visible partial state;
4. invalid content with package-level rollback;
5. unsafe archive-member rejection;
6. exact duplicate member-name rejection;
7. symbolic-link member rejection;
8. extreme compression-ratio rejection;
9. inclusive local-date filtering;
10. transactional schema-migration interruption and recovery;
11. creation and reopening of a queryable consistent backup; and
12. phase-level timing on first import and exact repeat.

The Rust preflight parses standard and ZIP64 central directories because the selected `zip` crate otherwise collapses duplicate names before callers can inspect them. This dependency behavior is now explicit evidence rather than a hidden ambiguity.

Every large run also reported exactly 10,000 recognized artifacts, 10,000 new canonical observations, and successful exact-repeat detection. The scenario uses no personal data and no value, identifier, route, timestamp sequence, or aggregate fingerprint from the private reference export.

The promoted foundation passes sixteen Rust tests: one pure domain reconciliation test, one application coordination test, and fourteen adapter integration tests covering the historical behaviors above plus ordered progress and cancellation rollback. Four headless presentation tests verify locale switching, native-dialog cancellation, selected-package state, responsive progress, cancellation, invalid input, result reporting, multiple records, exact reimport, and restored history. This evidence is versioned and runs without a graphical session.

## Generated scale scenario

The deterministic generator creates:

- 10,000 root-level activity JSON members;
- 10,000 distinct fictional local dates and logical identities;
- 5,369,727,223 expanded bytes, slightly above 5 GiB;
- a 25,895,831-byte ZIP; and
- a large, deliberately repetitive unknown JSON field in each artifact.

The archive passed a complete ZIP integrity check before measurement. Each importer reads, expands, decodes, and parses every recognized JSON member. The repeated padding makes the archive unusually compressible, so this scenario exercises expanded-volume processing and bounded per-entry memory but understates archive hashing, storage throughput, realistic JSON structure, and high-resolution sample work. It is not sufficient evidence for the final large-export budget by itself.

The generator and one ZIP integrity pass warmed the operating-system file cache before candidate measurements. Seven fresh-process runs per implementation then used a new database each time. Every process performed one first import, one exact repeat, and fifty one-year range queries. The final campaign instrumented archive fingerprinting, database setup, repeat lookup, archive validation, reading and decoding and mapping, reconciliation, and transaction control. Median and p95 use the sorted seven-run sample; with seven observations, the reported p95 is the sample maximum and is intentionally sensitive to outliers. Query figures below show the median and maximum of each run's internally measured p95.

## Measurements

| Measurement | Rust core | TypeScript/Node core |
|---|---:|---:|
| First import, median | 1.342 s | 6.823 s |
| First import, p95 | 1.360 s | 9.710 s |
| Exact repeat, median | 47.1 ms | 15.8 ms |
| Exact repeat, p95 | 47.7 ms | 33.8 ms |
| Peak resident memory, median | 21.7 MiB | 228.0 MiB |
| Peak resident memory, p95 | 22.7 MiB | 235.3 MiB |
| One-year query p95, median across runs | 0.57 ms | 0.74 ms |
| One-year query p95, worst run | 0.61 ms | 1.03 ms |

First-import phase medians explain the overall difference:

| Phase | Rust core | TypeScript/Node core |
|---|---:|---:|
| Compressed-archive SHA-256 | 46.3 ms | 17.4 ms |
| Database open and schema setup | 1.12 ms | 1.09 ms |
| Exact-repeat lookup | 0.02 ms | 0.03 ms |
| Archive metadata and policy validation | 38.7 ms | 194.8 ms |
| Read, decompress, decode, and map | 1,205.1 ms | 6,511.4 ms |
| Reconciliation writes | 34.8 ms | 90.4 ms |
| Transaction begin, import record, and commit | 2.04 ms | 2.14 ms |

Two Node runs experienced material read-and-decode slowdowns; the median remains representative of the five-run cluster while the p95 exposes that variability. In both implementations, SQLite setup, reconciliation, and commit are small fractions of total time. Reading, decompression, UTF-8 decoding, JSON parsing, and mapping dominate the first import.

Both paths meet the applicable provisional import, repeat, memory, and query budgets on this hardware and scenario. Rust is approximately five times faster on first import and uses approximately one tenth of the peak resident memory. Node hashes the small compressed archive faster on the exact-repeat path. No conclusion about realistic multi-gigabyte archive fingerprinting follows from that repeat result.

SQLite persisted the complete scenario and served the measured range query with ample margin. The padding field is intentionally unsupported content, so a separate structured scenario evaluated million-sample analytical workloads before the storage decision.

## Structured analytical storage scenario

The independently generated scenario contains 1,000 training sessions distributed across ten years and four fictional sport classifications. Each session has 5,000 one-second samples with deterministic heart-rate and speed values, for a total of five million samples. It contains no value, distribution, timestamp sequence, sport history, or aggregate derived from the private reference export.

SQLite uses one session table with a date and sport index and one `WITHOUT ROWID` sample table keyed by session and offset. One WAL transaction inserted the complete history and checkpointed it. The resulting database occupied 84.3 MiB. Preparation took 1.989 seconds with 10.1 MiB peak resident memory.

Fifteen warm executions per query produced:

| Product-shaped query | Result rows | Median | p95 | Applicable budget |
|---|---:|---:|---:|---:|
| Indexed default dashboard by month and sport | 480 | 0.22 ms | 0.56 ms | 500 ms |
| Annual heart-rate-zone totals from raw samples | 4 | 106.0 ms | 107.9 ms | 500 ms |
| One-session ten-second downsampling | 500 | 0.64 ms | 0.72 ms | 500 ms |
| Decade monthly trend from all raw samples | 120 | 1,294 ms | 1,334 ms | 2 s with loading state |
| Two two-year periods compared by sport from raw samples | 8 | 925.8 ms | 949.9 ms | 2 s with loading state |

The query process peaked at 14.4 MiB resident memory. The two whole-history queries require a loading state and cancellation under the quality targets, even though they remain within the complex-visualization budget. Production projections should make common reports faster, but this worst-case raw-scan evidence shows no MVP query failure that would justify a second engine. The hardware and warm-cache limitations still apply, so minimum-profile verification remains a release gate.

[ADR 0002](../architecture/decisions/0002-select-sqlite-storage.md) therefore selects bundled SQLite as the single system of record. DuckDB was not added to the application or contributor toolchain because the protocol requires measured value to exceed its additional schema, migration, consistency, backup, packaging, and recovery cost.

## Packaging and launch evidence

| Measurement | Tauri | Electron |
|---|---:|---:|
| Warm unsigned `.app` packaging | 13.35 s | 2.55 s |
| Allocated `.app` size | 12,468 KiB | 281,800 KiB |
| Architecture | arm64 | arm64 |

Both official toolchains produced macOS application bundles without an Apple Developer identity. Electron's bundle is ad-hoc signed by its packaging path. Tauri was built with signing disabled; its Mach-O executable retained a linker-generated ad-hoc signature, while the bundle had no sealed-resource signature.

Adding a Cargo benchmark under `src/bin` exposed a release-shaped packaging regression: with two discovered binary targets and no explicit default, Tauri packaged `benchmark` as `CFBundleExecutable`. The resulting 2,732 KiB bundle was not an application and failed structural signature verification. The benchmark was moved to a Cargo example and the spike declared an explicit default. The promoted package now declares `default-run = "fitfreed"`, contains `Contents/MacOS/fitfreed`, and uses `org.fitfreed.desktop`. A versioned bundle assertion verifies those values and rejects test-only WebDriver strings in the production executable.

Manual Tauri inspection confirmed application launch, switching from the default English interface to Spanish, native control rendering, and the empty-library state. It also exposed a real layout defect: the original single-row import controls compressed the selected-path region and truncated its message too aggressively. The disposable interface was adjusted to a two-row responsive layout; the revised bundle still requires inspection.

Automated screen capture was unavailable in the local terminal host. The Electron bundle exists, but visual launch, the packaged `node:sqlite` path, and comparative rendering remain unverified rather than inferred.

## Developer-experience evidence

The Tauri generator produced a current React and TypeScript setup. The promoted repository pins Node.js, npm, Rust, `rustfmt`, and Clippy; formatting, linting, architecture, translation, presentation, and Rust test commands now pass from the repository root. Tauri invokes `cargo metadata` by executable name before honoring its documented build runner option, so the Rustup proxies must remain available in the normal executable path. With dependencies present, tests complete in seconds; release packaging still performs an optimized application build.

The Electron generator completed with Forge 7.11.2 and Electron 43.4.0, but its first-party Vite integration is officially marked experimental. The generated TypeScript constraint was `~4.5.4`, which could not parse current Node type declarations. Moving to TypeScript 5.8 also required updating the generated TypeScript ESLint packages. Vite 5 did not recognize the newer `node:sqlite` built-in automatically, so the main-process build needed an explicit Rollup external. These are reproducible setup repairs, not application defects, but they weaken the clean-clone baseline.

The selection-time Tauri npm lock contained 134 package entries before release-shaped presentation and WebDriver tooling was added; the promoted locked installation contains 645 packages. Its normal Rust dependency graph contained 220 unique crate names in the spike. The Electron npm lock contained 828 package entries, predominantly Forge and packaging tooling, in addition to the bundled Chromium runtime. The current Tauri installation reports fifteen npm advisories in the complete development tree: one moderate and fourteen high; deprecated `glob` and `inflight` instances are reachable through the WebdriverIO/Mocha development path. The hosted production-only audit reports no vulnerability, but that does not close the separate development-tooling gate.

The resolved macOS Tauri graph declares MIT, Apache-2.0, BSD, MPL-2.0, Unicode-3.0, Zlib, Unlicense, CC0, and compatible compound expressions; no GPL-incompatible dependency was identified. The Electron application's production npm tree contains MIT and Apache-2.0 dependencies. This is selection evidence, not the production notice artifact: automated license policy, exact distributable contents, source-offer obligations, and release notices remain required.

Official Electron 43 documentation establishes that the major line embeds Node 24. Node's current SQLite documentation classifies `node:sqlite` as a release candidate rather than stable. That status and Electron's synchronous SQLite API require an explicit production decision; a release-candidate storage binding cannot become an accidental architecture default merely because it avoided a native npm add-on in the spike.

Primary evidence: [Electron 43 stack](https://www.electronjs.org/blog/electron-43-0), [Node SQLite status](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), and [Electron Forge Vite template status](https://www.electronforge.io/templates/vite).

## Security and responsiveness observations

Both interfaces apply a restrictive content security policy. The Electron window explicitly enables context isolation and sandboxing, disables Node integration, exposes only three operations through the preload bridge, validates the sender frame, and retains the selected archive path in the main process. Tauri grants only core, file-dialog open, and opener capability sets. The promoted host exposes import, cancellation, and query commands; test-only WebDriver permissions exist only in a separate feature-gated build configuration.

Both spike cores enforce entry-count, per-entry expanded-size, total expanded-size, compression-ratio, root-only name, duplicate-name, symbolic-link, and encryption policies. Synthetic tests cover duplicates, symbolic links, and extreme compression ratios. Encrypted fixtures across producers, malformed standard and ZIP64 central directories, decoded-name normalization collisions, and cumulative CPU budgets remain required container-contract scenarios.

The Tauri command dispatches import work through its blocking-task runtime, and the Electron host built the import core as a dedicated `worker_threads` entry. Core tests and all three Electron Vite entries compiled, but Electron Forge did not recopy the runtime, so inclusion of the worker in its historical `.app` was not verified. The promoted Rust tests prove ordered phases, non-cancellable commit, terminal cancellation, and atomic rollback. Presentation tests prove that language selection remains interactive while import is pending and that cancellation feedback restores the interface. The cancellation-scale packaged timing budgets still require the macOS E2E job.

The first packaged WebDriverIO session successfully launched the embedded WebKit driver and inspected the application, but failed while selecting the Spanish `<option>`. Root-cause inspection found that the embedded macOS driver implements option clicks as `el.click()` without updating the parent `<select>` or dispatching `change`, so React never received the event. The E2E journey uses WebDriver script execution to apply the native select value and dispatch standard `input` and `change` events while preserving the visible locale assertion.

The subsequent picker failure exposed a separate WebKit boundary. The WebdriverIO plugin cannot replace `window.__TAURI__.core.invoke` on the non-configurable macOS Tauri proxy, while the application-side dialog module invokes `window.__TAURI_INTERNALS__` directly. Consequently, the registered dialog mock recorded no call and an `undefined` result made the unchanged empty state look like a successful cancellation. The instrumented presentation now routes only the archive-picker adapter through the registered mock and waits for its recorded invocation. Production continues to call Tauri's native dialog, and the production-package check rejects the JavaScript and Rust instrumentation markers. Axe uses its single-context legacy execution because the embedded driver rejects the auxiliary `window/new` operation used by the default algorithm. The complete packaged journey passes locally and in the [clean GitHub Actions macOS run](https://github.com/purnalica/fitfreed/actions/runs/31954424171).

Both implementations now apply schema version 1 inside a SQLite transaction. A fault injected after DDL but before the version commit leaves schema version 0 and no visible partial tables; the next migration succeeds. Each path also creates a separate backup and reopens it through the normal query path. Production still requires migrations as immutable versioned assets, pre-migration backup policy, restart-shaped recovery, and compatibility tests from every released schema.

## Remaining implementation and decision gates

1. Inspect the packaged interface with keyboard navigation and VoiceOver; this complements rather than replaces the automated gate.
2. Exercise cryptographically signed update metadata, authentic-artifact verification, tamper rejection, interrupted update recovery, and the unsigned-alpha notification path.
3. Complete durable non-terminal import outcomes and provenance on top of the immutable versioned migration, then verify restart-shaped recovery from every supported failure.
4. Repeat large measurements on or constrained to the reference memory profile with a realistic-compression archive using the demonstrated phase-level timing fields.
5. Resolve or explicitly replace vulnerable development-tooling chains, complete exact distributable-content inventories, and automate license enforcement and notices.

## Decision outcome

[ADR 0001](../architecture/decisions/0001-select-tauri-application-stack.md) accepts Tauri because its common import path is substantially smaller, faster, and more memory-efficient; its capability model is explicit; and its official updater has a mandatory signature model. Electron retains historical advantages in warm packaging speed, a single primary application language, Chromium consistency, and mature web tooling, but its footprint, generated-tooling friction, release-candidate SQLite binding, update asymmetry, and unverified packaged worker path are meaningful costs.

[ADR 0002](../architecture/decisions/0002-select-sqlite-storage.md) accepts SQLite as the single system of record. A second analytical engine has no measured justification and is not part of the selected stack.

The remaining gates can still trigger reconsideration, block a release, or determine separate storage, test, and update ADRs. They do not justify preserving a parallel Electron codebase.
