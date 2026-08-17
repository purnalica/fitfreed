# Technology Evaluation Protocol

## Status

Completed Milestone 0 selection protocol retained as the evaluation baseline. [ADR 0001](architecture/decisions/0001-select-tauri-application-stack.md) selects Tauri 2, a Rust core, and a TypeScript and React presentation layer. [ADR 0002](architecture/decisions/0002-select-sqlite-storage.md) selects bundled SQLite as the single system of record and rejects an additional analytical engine without a measured budget failure. [ADR 0013](architecture/decisions/0013-render-mvp-visualizations-with-semantic-html.md) selects semantic HTML and CSS for the bounded MVP visualizations, and [ADR 0014](architecture/decisions/0014-drive-packaged-macos-e2e-with-webdriverio.md) selects the embedded WebdriverIO Tauri path for packaged macOS behavioral automation.

The dated [`research/technology-paper-screen.md`](research/technology-paper-screen.md) advanced Tauri and Electron to equivalent integrated spikes, with SQLite as the transactional baseline and DuckDB as the comparative analytical candidate. The [`research/technology-spike-2026-08-15.md`](research/technology-spike-2026-08-15.md) checkpoint records correctness, scale, packaging, footprint, security, localization, developer-experience, and rejected-alternative evidence. Remaining gates determine release readiness and the outstanding component decisions; they no longer preserve a parallel Electron implementation.

## Decision boundary

Technology selection covers an integrated desktop delivery system:

- Domain and application implementation language.
- Desktop host and operating-system integration.
- UI rendering, accessibility, localization, and visualization.
- Transactional persistence, migrations, analytical queries, and large-series representation.
- Unit, integration, E2E, architecture, performance, and packaging tests.
- macOS packaging, private-alpha update verification, later signing and notarization, and credible Linux and Windows evolution.
- Contributor setup, dependency management, reproducibility, automation, security, and GPL compatibility.

Selecting components independently is insufficient when their integration creates the actual product risk.

## Non-negotiable constraints

Every selected architecture must demonstrate:

- Clean Architecture dependency direction and provider-neutral DDD boundaries.
- Streaming or bounded-memory processing of large heterogeneous ZIP and JSON inputs.
- Deterministic logical reconciliation, atomic recovery, and explainable provenance.
- Responsive visual exploration of long histories and high-resolution series.
- WCAG 2.2 Level AA target interpreted through WCAG2ICT, including VoiceOver and keyboard operation on macOS.
- `en-US` and `es-ES` with additive collaborative translation workflows.
- Release-shaped unit, integration, E2E, migration, installation, update, and recovery testing.
- Straightforward macOS installation and cryptographically verified private-alpha updates.
- A credible route to Developer ID signing, notarization, Linux, and Windows.
- Excellent clean-clone contributor experience without mandatory proprietary services.
- `GPL-3.0-or-later` compatible dependencies and distributable artifacts.

## Structural candidate families

The paper screen will assess at least:

1. **Tauri 2 host, Rust domain/application core, and a TypeScript web UI.**
2. **Electron host and a TypeScript domain/application and web UI.**
3. **Kotlin/JVM domain/application with Compose Multiplatform Desktop.**
4. **.NET domain/application with Avalonia UI.**
5. **Flutter desktop with a Dart domain/application core.**

Candidate inclusion is not endorsement. A family may be removed before implementation spikes only when primary evidence shows that it cannot satisfy a non-negotiable constraint or is materially dominated across the weighted criteria.

Storage architectures are evaluated with the application family rather than assumed:

1. **Transactional relational store:** SQLite or an equivalent embedded transactional engine owns normalized state and serves indexed analytical queries.
2. **Embedded analytical store:** DuckDB or an equivalent engine owns normalized and analytical state with an explicit transaction, migration, and recovery design.
3. **Separated transactional and analytical stores:** a transactional catalog owns identity and reconciliation while columnar or analytical storage owns derived query state, with explicit consistency and rebuild boundaries.

The third option is justified only if measured value exceeds the additional consistency, migration, backup, and contributor complexity.

## Weighted evaluation criteria

| Criterion | Weight | Required evidence |
|---|---:|---|
| Import correctness, transactions, interruption, and recovery | 18 | Fault-injected import and reimport scenarios with persisted-state inspection |
| Desktop distribution, updates, and platform evolution | 16 | Release-shaped package, verified update artifact, failure recovery, and official platform documentation |
| UX, accessibility, localization, and visualization | 16 | Keyboard and VoiceOver inspection, locale switching, chart alternative, and responsive interaction |
| Large-history storage, query, and memory behavior | 15 | Representative synthetic benchmark with phase-level measurements |
| Clean Architecture and domain modeling fit | 10 | Enforced module dependency proof and framework-free domain tests |
| Unit, integration, E2E, migration, and packaging testability | 10 | Automated commands proving each boundary and a release-shaped journey |
| Contributor experience and ecosystem sustainability | 10 | Clean-clone setup, feedback-loop timings, diagnostics, documentation, and ecosystem health evidence |
| Security, footprint, licensing, and supply chain | 5 | Dependency inventory, artifact inspection, update verification, and license analysis |
| **Total** | **100** | |

A score without linked evidence is invalid. A candidate that fails a non-negotiable constraint cannot win through its weighted total.

## Integrated spike scenarios

The highest-ranked candidates must implement the same disposable, provider-neutral scenario:

1. Build and package a localized macOS desktop application from a documented clean-clone workflow.
2. Stream a synthetic ZIP containing multiple JSON files through a source adapter without loading the entire archive into memory.
3. Map one source record family into provider-neutral inputs, persist logical identity and provenance, and expose coverage results.
4. Reimport an identical archive and an overlapping amended archive, proving deterministic state and no duplicates.
5. Interrupt parsing and persistence at controlled points, restart, and prove a consistent recoverable library.
6. Query a generated longitudinal series, filter a period, and render an accessible visualization with exact textual values.
7. Switch between `en-US` and `es-ES`, verify locale formatting, and detect missing or invalid messages automatically.
8. Detect an update, reject a tampered artifact, verify an authentic development artifact, and demonstrate recovery from an interrupted update or migration.
9. Run unit, integration, E2E, architecture, migration, performance, and package verification through documented commands.

Spike repositories and generated data remain under ignored local storage. Only independently constructed fixture specifications, sanitized measurements, accepted decisions, and selected production code enter the project history.

## Measurement and scoring rules

- Use the reference profile and reporting fields in `docs/quality-targets.md`.
- Repeat timings enough to report median and p95 without presenting one run as a performance conclusion.
- Measure peak process memory and identify work performed outside the primary process.
- Separate parsing, mapping, reconciliation, persistence, indexing, query, serialization, and rendering time.
- Record cold and warm behavior explicitly.
- Evaluate documentation and setup from a clean environment, not an already configured maintainer workstation.
- Record unresolved evidence as unresolved; never convert absence of proof into a neutral score.
- Re-run time-sensitive ecosystem, release, and platform claims immediately before accepting the ADR.

## Decision outputs

Technology selection produces:

- One or more accepted ADRs with context, evidence, alternatives, consequences, and reconsideration triggers.
- Current module, process, data, packaging, update, and test architecture documentation.
- A dependency and license baseline.
- Versioned clean-clone, fast-verification, full-verification, package, and update-test commands.
- A Milestone 1 plan that uses the selected production path rather than preserving the disposable spikes.
