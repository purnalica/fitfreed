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

The production adapter recognizes the documented daily-activity shape, resolves a library-scoped source subject, and records complete family coverage. The application owns the provider-neutral Insights read model: it selects the latest 30 local dates by default or validates an explicit range of up to 366 inclusive dates, keeps observation origins separate, discloses missing and unavailable days, and calculates exact totals and rounded averages from canonical facts returned by an indexed port. SQLite owns bounds, the distinct origin catalog, and inclusive fact retrieval but no report rule; keeping the catalog separate preserves all-missing ranges. The Tauri transport validates the typed range boundary and encodes step counts as decimal strings to preserve 64-bit and aggregate precision in JavaScript. React owns localized labels, date entry, detail selection from the returned model, locale-aware formatting, responsive visual scaling, and the exact accessible table alternative.

The current canonical concept, source mapping, persistence schema, artifact-family registry, Insights read models, and source-subject correlation are indexed in the [data format documentation](../data-formats/README.md). Period comparison, richer daily activity, and the remaining MVP capabilities enter through the same boundaries under the [Milestone 2 plan](../plans/milestone-2.md).
