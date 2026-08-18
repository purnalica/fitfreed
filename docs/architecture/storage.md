# Storage Architecture

## Status

Current architecture after [ADR 0002](decisions/0002-select-sqlite-storage.md). SQLite is the only storage engine in the application and the authoritative local-library format. It does not replace the documented portable FitFreed data contract.

The current implemented schema and compatibility boundary are documented in the [SQLite version 12 persistence specification](../data-formats/persistence/sqlite-v12.md). It preserves the complete provider-neutral fitness library through version 8, authenticated-update state from version 9, application preferences from version 10, a resumable exploration destination from version 11, and user-authored sport classifications from version 12. Earlier specifications remain immutable migration history.

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

## Source-subject correlation

[ADR 0005](decisions/0005-use-library-scoped-source-subject-correlation.md) and schema version 4 give the library an opaque observation-origin catalog, a per-library correlation key, versioned source-subject evidence digests, and an optional resolved-origin link on import operations. Raw provider claims are transient and never stored.

Schema version 5 adds only `daily_activity_local_date_origin`, an index ordered by local date and origin for bounded Insights reads. SQLite returns canonical facts and bounds; gap disclosure and report aggregates remain application-owned rules.

Schema version 6 adds training summaries keyed by origin and source-scoped session identity. Source `modified` time remains persistence and provenance control state rather than a canonical training fact. A later valid revision atomically amends the visible summary; older evidence cannot roll it back and equal revision evidence with different content becomes an explicit conflict. The import operation records an adapter-wide mapping-set version while each provenance row retains its family-specific mapping version.

The training Insights adapter derives earliest and latest local start dates, an ordered distinct origin catalog, and inclusive bounded session facts through `training_session_start_origin`. Date selection is lexical over the canonical local date-time representation and remains independent of the computer time zone. SQLite does not aggregate durations, optional measurements, training days, or comparison changes; those provider-neutral rules belong to the application read models.

Schema version 7 adds sleep periods keyed by origin and the source-assigned sleep date. Offset boundaries, declared duration arithmetic, optional phase summaries, optional stage timelines, and optional score sets remain canonical source facts. Result and score artifacts are joined before the visibility transaction. Because they carry no established orderable revision evidence, only strict additions of previously unavailable optional groups enrich visible state; omitted known groups are preserved, and changed known values become explicit conflicts. SQLite stores no provider-specific sleep type or scoring label.

The sleep Insights adapter derives bounds, the ordered distinct origin catalog, and inclusive summary facts through `sleep_period_date_origin`. Overview and comparison reads include only the timeline-availability flag; they do not load `sleep_stage_transition` rows. Exact detail lookup loads the ordered transition set for one (`origin_id`, `sleep_date`) identity. SQLite does not fill calendar gaps, average durations, aggregate phases or scores, decide goal attainment, or calculate comparison changes.

Schema version 8 adds nightly recovery keyed by origin and source-assigned recovery date. Shared interval and RMSSD measurements are stored beside constrained, versioned source-specific assessment, baseline, and guidance components. Strict optional enrichment can replace visible state; omitted known information is preserved, and changed known facts or schemes become explicit conflicts because the source supplies no orderable record revision. The undated recovery blob is classified but never joined or stored: file order, array position, sample content, and delivery tokens are not identity evidence. `nightly_recovery_date_origin` supports chronological range reads; report aggregation remains application-owned.

Schema version 9 adds the singleton authenticated-update replay high-water mark, trusted release identity, and mutually exclusive dismissal or postponement preference. It contains no endpoint, trust key, package material, installation identifier, or usage event. Installation recovery remains a separate filesystem-backed contract; update state is included in a whole-library backup but excluded from the portable fitness model.

Schema version 10 renames the locale-only row to `application_preference` and extends it with a fixed preference-contract version, system/light/dark appearance, and 100%–200% content zoom. The application reads, validates, recovers, saves, resets, backs up, and restores the complete set atomically. Preview state remains presentation-only and is discarded when the user leaves Settings without saving.

Schema version 11 stores one constrained, versioned exploration destination for Library Home resume. It contains no filters, source identifiers, user text, or provider detail and is cleared through the same application port that validates it.

Schema version 12 stores a current user-authored sport-classification revision keyed by exact observation origin and source sport reference. Absence means revision-zero unknown; a user reset persists an authored unknown revision. A covering training-session index supports detected-sport grouping without exposing the key to presentation. Import and reimport do not write authored meaning.

New origin and evidence rows become durable only inside the same visibility transaction as canonical history and operation completion. Existing development origins migrate as unverified origins without invented evidence. Exact-repeat lookup may inherit an origin only from a completed operation whose correlation state is verified; an old package fingerprint alone cannot authorize subject resolution.

Exact-repeat reuse is additionally scoped to the current source provider, adapter version, and mapping version. Identical bytes are reassessed after any compatibility-contract change, so a previous outcome cannot bypass validation added by a newer adapter.

The correlation key remains part of protected backup state so a restored library preserves reimport behavior. A scoped digest is still sensitive metadata and is excluded from public diagnostics and the normalized portable export unless a later versioned contract explicitly requires it.

## Query model

Canonical tables protect identity and invariants. Indexes and derived projections serve product queries; they are designed from measured use cases and remain rebuildable from authoritative state.

The latest-outcome read adapter derives family coverage by grouping `import_artifact_coverage` on nullable family code, classification, and reason code. It returns only those stable codes and a validated non-negative count; it never returns artifact locators or source hashes to the host. Exact-repeat operations copy the original classification reasons because repeat status is already represented by the operation itself and must not replace the explanation of each family.

Queries expected to exceed 500 ms expose a loading state and remain cancellable. A required query that exceeds its 2-second complex-visualization budget after appropriate indexing and projection design is a storage-architecture reconsideration trigger.

## Operational decisions still to verify

- Journal mode, checkpoint thresholds, and long-reader behavior.
- Connection ownership and bounded read concurrency.
- Staging representation and cleanup after interruption.
- Projection versioning, invalidation, and online rebuild behavior.
- Backup location, retention, user controls, and available-storage checks.
- Minimum-hardware import, query, migration, and recovery budgets.
