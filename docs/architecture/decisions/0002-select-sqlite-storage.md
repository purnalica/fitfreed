# ADR 0002: Select SQLite as the single system of record

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** FitFreed project owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Storage architecture](../storage.md), [Import lifecycle](../import-lifecycle.md)

## Context

FitFreed must preserve canonical fitness history, provenance, import outcomes, conflicts, schema versions, and derived query state in a local library that remains atomic, recoverable, portable, and understandable to contributors. Realistic histories contain thousands of files and millions of time-series samples. Common navigation must complete within 500 ms p95; complex historical visualizations may take up to 2 seconds when they expose an explicit loading state and remain cancellable.

The technology paper screen advanced SQLite, DuckDB, and a split transactional and analytical design. The integrated spike proved SQLite import transactions, exact reimport, range queries, interrupted-migration rollback, and consistent backup. A subsequent structured analytical scenario stored five million synthetic samples across ten years and exercised product-shaped summaries, period comparisons, and downsampling.

This decision selects authoritative and derived persistence ownership. Portable FitFreed export formats remain a separate contract and SQLite does not become the user's only exit path.

## Decision drivers

- Atomic reconciliation, migrations, and visible import outcomes.
- Reliable backup, recovery, and long-lived file compatibility.
- Query performance for the MVP dashboard, filters, reports, and downsampling.
- Bounded memory and storage on the provisional 8 GB reference profile.
- One understandable migration, backup, packaging, and support model.
- Cross-platform embedded operation and GPL compatibility.

## Considered alternatives

### SQLite as the single system of record

SQLite scored highest in the paper screen and already supports the spike's transactional and recovery behavior. The structured scenario inserted five million samples in approximately 2 seconds into an 84.3 MiB database. Warm p95 queries ranged from less than 1 ms for the default dashboard and session downsampling to 1.334 seconds for a raw decade-wide monthly aggregate. Query-process peak resident memory was 14.4 MiB.

The principal risk is slower raw scans than a columnar engine as histories and analytical complexity grow. Indexed canonical tables and rebuildable projections must be designed around actual use cases rather than relying on unrestricted raw scans.

### DuckDB as the single system of record

DuckDB offers strong vectorized analytical execution and could outperform SQLite on wide scans and complex aggregates. It was not selected because no required SQLite query failed its applicable budget, while the spike already demonstrated stronger SQLite evidence for incremental reconciliation, migrations, backup, and recovery.

### SQLite with a separate DuckDB analytical store

A split design could combine transactional and analytical strengths. It was rejected because it creates a second schema, migration lifecycle, consistency boundary, backup model, packaged dependency, contributor toolchain, and failure-recovery path without measured user value.

## Decision

FitFreed will use bundled SQLite as the single authoritative storage engine for the local library.

- Canonical information, provenance, imports, reconciliation decisions, conflicts, schema state, and derived query projections live in one versioned SQLite library.
- One application-owned writer serializes durable changes. Read connections may run concurrently under an explicitly tested journal and checkpoint policy.
- Schema migrations are immutable, ordered, transactional assets. A migration that can affect recoverability requires a verified pre-migration backup.
- Long import parsing and mapping may stage outside the visible canonical tables, but one short transaction publishes the complete canonical effect and terminal import outcome together.
- Derived indexes, summaries, and projections may be rebuilt from authoritative state. Their ownership, version, and rebuild status are explicit.
- Backups use SQLite's supported online backup mechanism and are reopened and integrity-checked before being considered usable.
- Portable FitFreed exports remain documented independently of the SQLite schema.
- DuckDB is not a runtime, build, packaging, or contributor dependency.

The exact journal mode, connection pool shape, staging representation, and projection catalog will be selected by measured walking-skeleton needs within these boundaries.

## Consequences

### Positive

- One atomic consistency and recovery model covers imports and exploration.
- Contributors learn and operate one embedded database.
- Packaging, migrations, backup, diagnostics, and support remain smaller.
- Measured MVP-shaped queries already meet their applicable budgets on the spike hardware.
- The public-domain engine and Rust binding fit the selected GPL project stack.

### Negative

- Complex whole-history scans may require purpose-built indexes or projections.
- One serialized writer requires deliberate import and maintenance scheduling.
- WAL growth, checkpoints, long readers, and bulk visibility transactions require explicit operational tests.
- Current measurements do not prove the provisional 8 GB reference profile.

### Risks and mitigations

- Projection drift could show stale results; projection versions and rebuild state are transactional and testable.
- A long write could harm responsiveness; parsing and reconciliation remain outside the short visible commit where safe, and cancellation is tested before that boundary.
- Corruption or failed migration could strand a library; verified backups, integrity checks, startup recovery, and portable exports are release gates.
- If optimized SQLite cannot meet a required budget, a measured query and complete consistency design are required before reconsidering DuckDB.

## Verification

The decision is supported by the [paper screen](../../research/technology-paper-screen.md) and [integrated spike evidence](../../research/technology-spike-2026-08-15.md). Reconsider it only when a representative release-shaped scenario fails an applicable query, import, memory, storage, or concurrency budget after appropriate SQLite indexing and projections, or when recovery evidence invalidates the single-store design.
