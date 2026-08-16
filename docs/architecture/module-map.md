# Module Map

## Purpose

The selected Tauri, React, and SQLite technologies are adapters around FitFreed's Clean Architecture. Cargo crate boundaries make the two innermost dependency rules compile-time constraints instead of naming conventions.

```mermaid
flowchart LR
    UI[React presentation] --> HOST[Tauri host and transport DTOs]
    HOST --> APP[fitfreed-application]
    INFRA[Polar Flow and SQLite adapters] --> APP
    APP --> DOMAIN[fitfreed-domain]
    INFRA --> DOMAIN
```

## Ownership and allowed dependencies

| Module | Owns | May depend on |
|---|---|---|
| `fitfreed-domain` | Provider-neutral observations, identities, invariants, and reconciliation decisions | Rust standard library only |
| `fitfreed-application` | Use cases, input/output ports, Insights range and report rules, progress, cancellation, and application failures | `fitfreed-domain`, `chrono`, `thiserror` |
| `infrastructure` | ZIP safety, Polar Flow decoding, anti-corruption mapping, SQLite transactions, migrations, backup, and concrete port implementations | Application and domain crates plus adapter libraries |
| Tauri host and transport | Native lifecycle, command registration, blocking-worker dispatch, capabilities, and serialized DTO mapping | Application ports, concrete adapters, Tauri, and serialization |
| React presentation | Localized interaction, accessible visualization, and view state | Transport contracts exposed by the Tauri host |
| React desktop adapter | Native archive selection at the presentation boundary | Tauri dialog API; a compile-time test adapter replaces only this boundary in the instrumented E2E package |

The architecture check reads Cargo metadata and rejects adapter, serialization, persistence, desktop, or provider terms in the domain and application source. Cargo separately prevents either inner crate from importing a dependency absent from its own manifest.

## Milestone 1 foundation and MVP transition

The production adapter recognizes the documented daily-activity and training-session summary shapes, resolves a library-scoped source subject, and records complete family coverage. The training anti-corruption layer streams past excluded nested detail, preserves aggregate rather than child semantics, and supplies separately persisted source-revision evidence for deterministic amendment. The application owns provider-neutral Insights read models for both implemented domains: each overview selects the latest 30 local dates by default or validates an explicit range of up to 366 inclusive dates, and each comparison validates two such periods and calculates comparison-minus-baseline changes. Daily activity distinguishes unavailable measurements from missing observations. Training distinguishes expected non-training dates from unavailable session measurements, carries metric-coverage counts with aggregates, and never invents a sport name. Both keep observation origins separate. SQLite owns bounds, distinct origin catalogs, inclusive indexed fact retrieval, canonical facts, and provenance but no report rule. The Tauri transport validates typed range boundaries and encodes integer facts and signed changes as decimal strings to preserve precision in JavaScript. React owns the implemented daily localized labels, date entry, detail selection, comparison controls, locale-aware formatting, responsive visual scaling, and exact accessible table alternatives. The equivalent training presentation remains the next M2.3 slice.

The current canonical concept, source mapping, persistence schema, artifact-family registry, Insights read models, and source-subject correlation are indexed in the [data format documentation](../data-formats/README.md); production-path performance evidence is defined in the [benchmark guide](../development/performance-benchmarks.md). The benchmark generator enters through the concrete SQLite adapter and provider-neutral application use cases, while packaged timing crosses Tauri transport and React without creating another product path. Richer daily activity and the remaining MVP capabilities enter through the same boundaries under the [Milestone 2 plan](../plans/milestone-2.md).
