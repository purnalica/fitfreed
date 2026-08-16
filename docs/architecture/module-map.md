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
| `fitfreed-application` | Use cases, input/output ports, progress, cancellation, and application failures | `fitfreed-domain`, `thiserror` |
| `infrastructure` | ZIP safety, Polar Flow decoding, anti-corruption mapping, SQLite transactions, migrations, backup, and concrete port implementations | Application and domain crates plus adapter libraries |
| Tauri host and transport | Native lifecycle, command registration, blocking-worker dispatch, capabilities, and serialized DTO mapping | Application ports, concrete adapters, Tauri, and serialization |
| React presentation | Localized interaction, accessible visualization, and view state | Transport contracts exposed by the Tauri host |
| React desktop adapter | Native archive selection at the presentation boundary | Tauri dialog API; a compile-time test adapter replaces only this boundary in the instrumented E2E package |

The architecture check reads Cargo metadata and rejects adapter, serialization, persistence, desktop, or provider terms in the domain and application source. Cargo separately prevents either inner crate from importing a dependency absent from its own manifest.

## Milestone 1 foundation and MVP transition

The completed foundation recognizes a deliberately small daily-activity shape. Its current canonical concept, source mapping, persistence schema, artifact-family registry, and library-scoped source-subject correlation are indexed in the [data format documentation](../data-formats/README.md). The production host no longer supplies an identity: the Polar adapter extracts a versioned account claim and the library resolves an opaque observation origin. The application queries terminal outcomes through a dedicated provider-neutral read port. Infrastructure groups the persisted coverage evidence without exposing locators, the transport serializes stable codes and counts, and React owns localized family names, reasons, and next actions. Richer daily activity, historical real-export compatibility, and the remaining MVP capabilities enter through the same boundaries under the [Milestone 2 plan](../plans/milestone-2.md).
