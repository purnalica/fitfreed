# ADR 0004: Adopt capability and lifecycle bounded contexts

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Bounded contexts](../../domain/bounded-contexts.md), [module map](../module-map.md), [source integration](../source-integration.md), [import lifecycle](../import-lifecycle.md)

## Context

FitFreed needs domain boundaries that protect provider neutrality, repeatable import, longitudinal fitness meaning, user-facing insights, and library recovery. Polar Flow exports group data by delivery artifacts, while Clean Architecture groups code by dependency direction. Neither structure alone identifies ownership of domain language, invariants, or life cycles.

Milestone 1 exercised one daily-activity observation through provider detection and mapping, import assessment and progress, canonical reconciliation, atomic persistence and migration, provider-neutral queries, localized presentation, backup, packaged restart, and installation recovery. That vertical evidence is sufficient to decide the initial context map without pretending that every future fitness module is already known.

## Considered alternatives

### Capability and lifecycle contexts

Source Translation owns external formats; Import Control owns package assessment and operation life cycle; Fitness History owns canonical identity and reconciliation; Insights owns queries, reports, and visualization-ready meaning; Library Stewardship owns schema evolution, backup, restore, and explicit retention operations. Clean Architecture applies within and between these capabilities.

### One bounded context per provider or export family

Polar, Garmin, activity files, training files, and sleep files could each define a context. This mirrors delivery structure, but it makes provider vocabulary and arbitrary export partitioning determine the product model. Cross-provider concepts, import consistency, and longitudinal insights would lack clear ownership.

### Technical layers without explicit domain contexts

The project could rely only on domain, application, infrastructure, host, and presentation layers. Dependency direction would remain clear, but package assessment, fitness semantics, insights, and library evolution would compete inside broad modules without an explicit ownership model.

## Decision

FitFreed adopts the capability and lifecycle context map:

- **Source Translation** understands one provider export and produces typed package assessment, coverage, source locators, and normalized candidates through an anti-corruption layer.
- **Import Control** coordinates package identity, progress, cancellation, staging, terminal outcomes, provenance links, and the atomic visibility boundary.
- **Fitness History** owns provider-neutral observations, logical identities, invariants, equivalence, enrichment, preservation, conflict, and canonical time and unit semantics.
- **Insights** owns exploration queries, report rules, comparisons, gaps, and accessible visualization-ready read models.
- **Library Stewardship** owns library location, schema versions, migrations, backup, restore, portable-exit coordination, and explicit destructive operations.

The contexts are conceptual ownership boundaries, not a requirement for one deployable, crate, or database per context. Existing Cargo layers continue to enforce dependency direction. A fitness capability such as training, sleep, or recovery becomes a separate bounded context only when distinct language, invariants, ownership, or life cycle provide evidence for the split.

Provider-specific parsing, storage technology, Tauri, React, localization, accessibility, packaging, and updates remain adapters or cross-cutting capabilities rather than fitness-domain contexts.

## Consequences

### Positive

- Provider formats cannot dictate canonical fitness concepts or application workflows.
- Import consistency and fitness reconciliation have separate, testable ownership.
- Insights can evolve projections without becoming a second source of canonical truth.
- Storage migrations and recovery cannot silently define domain meaning.
- Additional providers can reuse the same application boundaries without a speculative runtime plug-in system.

### Negative

- The current physical modules contain responsibilities from more than one context, so contributors must use the context map and ports rather than infer ownership only from directories.
- Some source-specific but user-valuable observations still require an explicit controlled representation.
- Context boundaries must be revisited when later vertical capabilities provide contrary domain evidence.

## Verification

Milestone 1 verifies the Source Translation to Import Control to Fitness History to Insights path with synthetic daily activity through the packaged desktop application. Domain and application crates compile without ZIP, JSON, SQLite, Tauri, React, or provider dependencies. Architecture checks reject provider and adapter concerns in the inner crates. Persistence tests verify atomic reconciliation, provenance, migration, backup, cancellation, interruption, and restart separately from presentation. A later provider fixture must be addable through the source adapter boundary without changing existing use cases.

Create a superseding ADR if evidence requires combining these ownership boundaries, splitting Fitness History, or moving an invariant to another context. Adding a new fitness module inside the accepted map does not by itself supersede this decision.
