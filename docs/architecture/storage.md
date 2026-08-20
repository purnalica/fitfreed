# Storage Architecture

## Status

Current architecture after [ADR 0002](decisions/0002-select-sqlite-storage.md). SQLite is the only storage engine in the application and the authoritative local-library format. It does not replace the documented portable FitFreed data contract.

The current implemented schema and compatibility boundary are documented in the [SQLite version 23 persistence specification](../data-formats/persistence/sqlite-v23.md). It preserves the complete provider-neutral fitness library through version 8, authenticated-update state from version 9, application preferences from version 10, a resumable exploration destination from version 11, user-authored sport classifications from version 12, coherent full-history training discovery evidence from version 13, the disposable training-discovery workspace from version 14, mapped training exercises, laps, and pauses from version 15, primary and transition route assessments with exact points from version 16, regular temporal training signals with exact unavailable slots from version 17, reusable personal segmentation criteria from version 18, provider-recorded training-zone assessments from version 19, durable versioned report definitions from version 20, composable route-report intent from version 21, user-selected training-period report queries from version 22, and question-, exploration-, session-, and blank-origin reports from version 23. Earlier specifications remain immutable migration history.

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

Schema version 13 adds a singleton training-discovery revision advanced by canonical session and authored-classification triggers. Search derives an opaque snapshot reference from it and rejects later offset pages after a mutation. The same read transaction returns the exact count, source-separated filtered aggregates, classification context, and bounded page; application rules validate their coupling before presentation. Duration and distance indexes support deterministic longest- and farthest-first pages; existing start and sport indexes support chronological, date, and sport paths. The revision is synchronization evidence, not a fitness fact or event log.

Schema version 14 stores one replaceable training-discovery workspace: applied filters, page, chronology or
calendar view, selected calendar origin, comparison order, and open lightweight detail. It contains only
opaque presentation capabilities and no provider or canonical identity. Application validation owns its
cross-field invariants. Import never rewrites the row; snapshot validation either restores coherent evidence
or restarts the query while discarding stale session selections. Returning explicitly to Home deletes this
workspace together with the top-level exploration destination.

Schema version 15 stores provider-neutral exercise, lap, and pause structure below a session. Schema version
16 adds independent primary and transition routes with exact ordered points. Schema version 17 adds
independent regular-signal assessments, exact series metadata, and every ordered sample slot. Bounded route
and signal overviews select deterministic source ordinals in SQL, while exact pages remain available without
loading a session's complete geometry or sample history. All three evidence groups reconcile with the session
summary as one atomic record and advance the coherent training-discovery snapshot when changed.

Schema version 18 stores reusable user-authored segment criteria and their ordered exercise associations.
Derived segments remain application-owned calculations over the current duration or streamed exact signal
evidence and are not persisted as provider facts. Criteria survive exact reimport, use optimistic revisions,
and remain visibly independent from source laps and FitFreed-derived boundaries.

Schema version 19 stores provider-recorded training-zone assessments independently for each exercise.
Supported heart-rate, speed, and power groups retain ordered zone bounds and their applicable aggregate time,
distance, and muscle-load measurements. Missing measurements remain distinguishable from zero and from metrics
that do not apply to a group kind. Unsupported group kinds contribute only a count; provider vocabulary and
values that FitFreed cannot interpret are not persisted. Zone evidence reconciles atomically with the complete
session record and advances the coherent training-discovery snapshot when changed.

Schema version 20 stores durable provider-neutral report headers and the exact two ordered block variants
supported by report-definition version 1. Report rows retain authored identity, locale, sensitivity choice,
optimistic revision, origin, and saved source snapshot without copying resolved measurements. Imports never
rewrite authored reports. Opaque source references deliberately survive missing or changed evidence so the
application can present stale or unavailable resolution explicitly.

Schema version 21 generalizes ordered report blocks with route identity and endpoint-redaction choices.
Schema version 22 adds versioned training-comparison intent without storing results. Schema version 23
generalizes report origins to session, question, exploration, and blank. Its relational checks require the
exact fields for each origin and continue to prohibit provider accounts, rendered output, resolved totals,
and destination paths. All three migrations copy prior definitions and blocks atomically; imports and
reimports remain unable to rewrite authored rows.

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
