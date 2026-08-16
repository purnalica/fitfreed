# Storage Architecture

## Status

Current architecture after [ADR 0002](decisions/0002-select-sqlite-storage.md). SQLite is the only storage engine in the application and the authoritative local-library format. It does not replace the documented portable FitFreed data contract.

The current implemented schema and compatibility boundary are documented in the [SQLite version 3 persistence specification](../data-formats/persistence/sqlite-v3.md), which extends the version 2 import ledger with a durable locale preference. Earlier specifications remain immutable migration history.

## Ownership

One versioned SQLite library owns:

- canonical provider-neutral information;
- source provenance and mapping versions;
- import operations, artifact coverage, reconciliation decisions, and conflicts;
- application settings that must evolve atomically with the library;
- schema and projection versions; and
- derived indexes, summaries, and projections used for exploration and reports.

Caches that can be discarded without changing observable truth may live outside the library. They must never become the only representation of user information.

## Transaction boundaries

- One application-owned writer serializes migrations, visible imports, projection publication, and destructive library operations.
- Import assessment, ZIP access, decoding, mapping, and most reconciliation work remain outside the short visibility transaction when this can be done without weakening package-level atomicity.
- Assessment may persist coverage under a non-terminal operation so cancellation and rejection remain explainable. Consumers expose it as a final outcome only after the operation becomes terminal.
- The visibility transaction publishes canonical changes, provenance, reconciliation decisions, conflicts, and the completed operation together. Its completed state makes the already prepared complete coverage final at the same logical boundary.
- Cancellation is accepted before the visibility transaction and deferred while that atomic boundary resolves.
- Readers never observe a terminal import outcome without its complete canonical effect.

## Migrations and recovery

- Every schema migration is an immutable ordered asset with forward migration and compatibility tests from every released schema.
- Schema version changes occur inside the same transaction as their DDL and data transformation.
- A migration that could make the previous application unable to read the library requires a verified pre-migration backup.
- Startup resolves interrupted imports before allowing new writes. In schema version 2, any surviving non-terminal state moves through recovery to a failed outcome because canonical publication and completion are one transaction.
- Backup artifacts are reopened through the normal adapter and pass SQLite integrity checking before success is reported.

## Query model

Canonical tables protect identity and invariants. Indexes and derived projections serve product queries; they are designed from measured use cases and remain rebuildable from authoritative state.

Queries expected to exceed 500 ms expose a loading state and remain cancellable. A required query that exceeds its 2-second complex-visualization budget after appropriate indexing and projection design is a storage-architecture reconsideration trigger.

## Operational decisions still to verify

- Journal mode, checkpoint thresholds, and long-reader behavior.
- Connection ownership and bounded read concurrency.
- Staging representation and cleanup after interruption.
- Projection versioning, invalidation, and online rebuild behavior.
- Backup location, retention, user controls, and available-storage checks.
- Minimum-hardware import, query, migration, and recovery budgets.
