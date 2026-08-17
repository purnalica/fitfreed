# ADR 0007: Compose longitudinal Insights by origin and date

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Bounded contexts](../../domain/bounded-contexts.md), [module map](../module-map.md), [Milestone 2 plan](../../plans/milestone-2.md)

## Context

FitFreed has provider-neutral, gap-aware Insights contracts for daily activity, training sessions, sleep, and nightly recovery. Presenting these four explorers one after another does not answer the longitudinal question: what information exists across the same dates, and how do its exact measurements and coverage change together?

The domains do not share identical observation semantics. Daily activity and sleep have at most one current canonical observation per origin and assigned date. Recovery has at most one nightly observation per origin and recovery date. Training is an event stream with zero or more sessions on a local start date, so zero sessions is meaningful and is not a missing daily observation. Sleep and recovery dates are source-assigned labels and cannot be replaced with timestamps inferred from another domain.

Observation origins are deliberately opaque and library-local. Two origins must not be merged merely because their records share dates. Similar movements between activity, sleep, and recovery are associations in the selected history; the data does not establish causation, diagnosis, or advice.

## Decision drivers

- Give one range and comparison context to all four MVP domains.
- Preserve each domain's identity, date, gap, optionality, unit, and aggregation rules.
- Keep different observation origins separate and avoid exposing their opaque references.
- Reuse accepted domain read models instead of implementing competing calculations in presentation code.
- Keep longitudinal projections disposable and independently versioned from canonical and persistence formats.
- Bound query and rendering work to the existing 366-day Insights limit.

## Considered alternatives

### Presentation-side composition of four independent queries

React could request every domain overview and comparison and align their responses. This would avoid a new application contract, but global range validation, origin alignment, date semantics, partial failure, and cross-domain invariants would become presentation behavior. Other report consumers could reproduce different rules.

### Materialized longitudinal dashboard state

SQLite could persist prejoined daily dashboard rows and update them after every import. Reads would be direct, but a disposable report would become a second history representation with synchronization, migration, and recovery obligations. Provider-neutral report rules would also move into persistence.

### Application-owned composition of existing Insights models

A dedicated application use case can establish a global range and origin catalog, execute the four existing report models against that shared context, validate their alignment, and return a minimal visualization-ready projection. SQLite remains an adapter for canonical fact queries, while React consumes one explicit contract.

## Proposed decision

FitFreed will use an application-owned, disposable longitudinal Insights projection composed from the four existing provider-neutral read models.

- The global available range is the earliest through latest canonical date found across daily activity, training start dates, sleep dates, and recovery dates. The default selection is at most the latest 30 inclusive dates; explicit overview and comparison ranges are limited to 366 inclusive dates inside that global range.
- The series catalog is the ordered union of observation origins represented by any included domain. Every series is composed independently. Presentation labels series ordinally and never exposes `seriesRef`.
- The same selected range and union origin catalog are supplied to every domain read model. A domain that has no fact for an origin and date reports its established gap semantics. Training retains zero sessions as an exact count, not as a fabricated missing state.
- Each longitudinal day carries only the exact values required to align the four domains: activity availability and steps; training session count and total declared duration; sleep availability and asleep duration; and recovery availability and shared interval measurements. Full training, sleep, recovery assessment, baseline, guidance, and provenance detail remain in their authoritative domain explorers.
- Each longitudinal summary and comparison embeds the established domain summary rules and calculates comparison-minus-baseline changes only for defined provider-neutral quantities. Source-specific status values are not combined or compared.
- Selecting a longitudinal date exposes an exact accessible four-domain synopsis and navigation to the authoritative explorers. It does not duplicate their full detail contracts.
- The projection states gaps and coverage explicitly. It does not impute observations, normalize unequal periods, produce a readiness score, infer causal relationships, or issue medical or training advice.
- Application, transport, JSON Schema, component, packaged E2E, accessibility, and performance tests version and protect the contract. A measured regression must be fixed at the owning layer; the projection will not be persisted as a cache during Milestone 2.

## Expected consequences

### Positive

- Range, origin, and comparison behavior has one testable owner.
- Existing domain calculations remain the single source of truth.
- Users receive a coherent daily relationship view while retaining exact accessible alternatives and complete domain detail.
- Future importers enter through canonical history and automatically participate when their observation origins and facts satisfy the existing contracts.

### Negative

- One longitudinal request executes several bounded domain queries and must be measured as a combined interaction.
- The application must reject any disagreement in series catalogs, selected ranges, or day alignment rather than returning a partial dashboard.
- Presentation still needs deliberate navigation between the synopsis and detailed explorers.

### Risks and mitigations

- **Temporal alignment implies causation:** copy and contracts describe co-occurrence and coverage only; no score, diagnosis, or recommendation is derived.
- **An origin exists in only some domains:** the union catalog is intentional, and the other domains render their established gaps or zero event count.
- **Repeated calculations drift:** longitudinal models compose the existing domain use cases and assert identical series and range alignment.
- **The combined response becomes large:** day detail is a minimal projection, ranges remain bounded, and performance gates cover default, common, and maximum interactions.

## Verification required for acceptance

Application tests must cover empty and partial libraries, disjoint domain ranges, multiple origins, unavailable activity, zero and multiple training sessions, sleep and recovery gaps, invalid ranges, mismatched adapter facts, exact daily alignment, and unequal comparisons. Transport and schema tests must preserve exact integers as decimal text and reject invalid discriminated states. UI and packaged E2E tests must use the shared range, every synopsis and comparison control, multiple dates, navigation, both locales, keyboard interaction, accessible exact alternatives, 200% text, restart, and refresh after import. Default, common, maximum, and comparison measurements must meet the published budgets without persisting a dashboard cache.
