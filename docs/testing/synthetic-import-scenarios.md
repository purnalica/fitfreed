# Synthetic Import Scenario Specification

## Status

Active cross-layer scenario contract. The Tauri fixture generator implements the current activity, training, sleep, and coverage journey; family-specific fields and expected canonical entities are added with each mapping.

## Purpose

Synthetic scenarios are the shared contract evidence for provider-format documentation, importer behavior, reconciliation, persistence, recovery, UI journeys, and performance. They are independently authored from documented shapes and semantics; they never copy a record, value set, route, timestamp sequence, identifier, or aggregate fingerprint from a personal export.

## Fixture model

Every scenario has:

- a stable identifier and one behavioral purpose;
- a deterministic source definition capable of producing the same package bytes when byte identity matters;
- an explicit provider-format and mapping version;
- a package manifest listing intended artifacts and their expected compatibility classification;
- expected normalized observations and reconciliation decisions;
- expected canonical state before and after the operation;
- expected import state transitions, coverage, warnings, and terminal outcome;
- declared resource scale and whether the fixture is versioned or generated locally;
- traceability to requirements and data-format sections.

Version-controlled definitions stay small and reviewable. Large histories, sample series, entry-count limits, and compression-limit inputs are generated deterministically during verification and excluded from version control.

Provider artifact names use the complete documented lexical grammar with obviously fictional numeric, date, partition, and UUID-shaped tokens. Short convenience suffixes are invalid fixtures because they bypass the same family-detection boundary used for real packages.

Production-path fixtures include exactly one obvious non-address fictional account-data username. Reimport fixtures vary delivery-only numeric and UUID-shaped filename tokens while retaining or deliberately changing the private claim. Tests assert only opaque origins, fixed outcome codes, and aggregate counts; raw claims and scoped digests never enter snapshots, logs, or hosted artifacts.

## Core scenario catalog

| ID | Scenario | Required evidence |
|---|---|---|
| `SYN-001` | Minimal recognized package | One supported family reaches `Completed`, creates the expected canonical state, and reports exact coverage. |
| `SYN-002` | Exact package repeat | The same bytes take the repeat-safe path, create no duplicate, and produce a new explainable operation outcome. |
| `SYN-003` | Repackaged semantic duplicate | Different package bytes and delivery metadata contain equivalent domain information; canonical state remains unchanged while provenance follows policy. |
| `SYN-004` | Cumulative non-overlapping package | New logical identities are added without changing established history. |
| `SYN-005` | Overlapping equivalent package | Intersecting logical identities reconcile as equivalent independently of artifact and package order. |
| `SYN-006` | Documented amendment | A later representation for the same logical identity applies the concept's amendment rule and retains decision provenance. |
| `SYN-007` | Unresolved conflict | Competing credible values cannot be reconciled; the conflict is visible and source order does not choose a winner. |
| `SYN-008` | Known unsupported family | The package may complete for supported content, but unsupported coverage is explicit and never counted as imported. |
| `SYN-009` | Deliberately ignored family | The documented policy and user-visible reason appear in coverage. |
| `SYN-010` | Unrecognized artifact | Unknown content is reported without being parsed speculatively or silently discarded. |
| `SYN-011` | Compatible unknown field | A documented extension point accepts the record, retains the compatibility warning required by policy, and does not alter known semantics. |
| `SYN-012` | Incompatible field type, shape, or contradictory identity evidence | Intended supported content, including a filename/content date mismatch, is invalid; the package is rejected under the atomicity policy and history remains unchanged. |
| `SYN-013` | Malformed JSON and invalid encoding | Parsing fails safely with an artifact-specific error and sanitized recovery guidance. |
| `SYN-014` | Missing required relationship | Cross-record validation rejects or conflicts the affected candidate according to the family contract. |
| `SYN-015` | Ambiguous or absent source identifier | The family-specific identity rule is exercised; no universal filename or content-hash fallback is invented. |
| `SYN-016` | Date, time-zone, and daylight-saving boundary | Source semantics normalize deterministically without losing the original precision or offset evidence required by the mapping. |
| `SYN-017` | Unknown enumeration value | Compatibility behavior follows the field contract and preserves the distinction between unknown, absent, and invalid. |
| `SYN-018` | Duplicate archive member name | The container is rejected before mapping because member selection would be ambiguous. |
| `SYN-019` | Unsafe path or link | Absolute paths, traversal, links, and platform path variants cannot escape controlled package access. |
| `SYN-020` | Resource-limit violation | Entry count, expanded size, per-entry size, nesting, or compression-ratio limits stop work predictably without partial state. |
| `SYN-021` | Cancellation by durable phase | Cancellation during assessment, staging, or reconciliation exposes no canonical changes and cleans or records staging according to policy. |
| `SYN-022` | Process interruption by durable phase | Restart resolves assessment/staging safely and proves either complete commit or rollback for an interrupted visibility boundary. |
| `SYN-023` | Artifact-order and batch-size permutations | Property-based permutations produce the same coverage, decisions, and canonical result; duplicate daily identities reject in either archive order instead of selecting a delivery-order winner. |
| `SYN-024` | Mixed coverage package | Supported, unsupported, ignored, unrecognized, and invalid artifacts produce deterministic family-level counts, localized reasons and next actions, and no silent category or exposed locator. |
| `SYN-025` | Generated realistic scale | Streaming import, bounded memory, progress, cancellation, persistence, and representative queries meet validated budgets. |
| `SYN-026` | Schema migration and reimport | Data created by every supported library schema migrates, remains queryable, and reconciles correctly with a later package. |
| `SYN-027` | Gap-aware daily activity overview | One selected range contains an available step total, an observation with no step total, and a date with no observation; exact summaries and both localized accessible representations preserve all three states. |
| `SYN-028` | Training summary exploration | Multiple sessions exercise ordered range filtering, exact duration and energy, optional distance and heart-rate coverage, neutral type availability, detail, comparison, localization, and restart without exposing opaque references. |
| `SYN-029` | Split sleep history | Result and optional score artifacts exercise source-assigned dates, offset boundaries, declared arithmetic, staged and non-staged variants, enrichment, preservation, conflicts, invalid relationships, migration, querying, and restart. |
| `SYN-030` | Dated nightly recovery with unidentifiable samples | Minimal and complete dated summaries exercise independent optional groups, enrichment, preservation, conflict, duplicate rejection, migration, range querying, restart, and atomic interruption while the undated sample blob remains explicitly excluded and unjoined. |

## Family contract matrix

Every supported provider family extends the core catalog with at least:

1. minimal and maximal valid structural shapes;
2. every documented historical variant;
3. optional, absent, null, empty, and boundary forms where they have distinct semantics;
4. units, precision, time, enumeration, ordering, and relationship boundaries;
5. logical identity, semantic duplicate, amendment, and conflict examples;
6. unknown-field and incompatible-change behavior;
7. source-to-canonical loss and provenance assertions.

No family is marked supported until its format reference, mapping specification, synthetic definitions, and expected canonical outcomes cover that matrix.

The implemented daily-activity matrix covers an absent or null summary, absent or null step count, zero, a non-negative integer, ignored unknown fields and `exportVersion` shapes, invalid roots, missing or invalid dates, invalid summary and step-count types, filename/content date mismatch, duplicate logical dates in both archive orders, and reassessment after an adapter-version change.

The implemented training-session matrix covers a minimal summary, absent optional measurements, one and multiple child exercises, fractional timestamp normalization, official duration and distance limits, invalid null and field shapes, filename/content start mismatch, duplicate source identity, ignored route and sample detail, source-subject-scoped identity, equivalent reimport, newer amendment, older preservation, equal-revision conflict, provenance, query recovery, and interrupted version 5 migration. Application and transport tests cover default and explicit ranges, multi-origin separation, exact duration and energy arithmetic, optional distance and measurement coverage, invalid facts, comparisons, and empty libraries. Component tests distinguish loading, empty, and failed reads; enter ranges; open and close detail; compare periods; clear results; reject invalid input without discarding valid history; change locale; and reload multiple sessions. The packaged journey exercises multiple sessions, missing optional metrics, an amendment, cumulative addition, every training control, both locales, exact repeat, accessibility, 200% text sizing, and restart without exposing source references.

The implemented sleep matrix covers a result without a score, a later score enrichment, an omitted retained score, changed known score conflict, staged and non-staged structures, phase arithmetic, empty and missing timelines, midnight and daylight-saving offset boundaries, source-assigned dates, rating and stage enumerations, duplicate dates in each split family, orphan scores, invalid score ranges, persistence provenance, restart querying, and interrupted version 6 migration. Application and transport tests cover default and explicit ranges, multiple origins, explicit gaps, exact duration arithmetic, optional phase, score, goal, timeline, and recording-status coverage, unequal comparisons, exact detail, separation of summary and timeline reads, invalid facts, and lossless JavaScript transport. Component and packaged tests cover loading, empty, unavailable, and partial states; filtering; complete detail; comparison; invalid-input retention; locale changes; exact repeat; cumulative import; restart; accessibility; and 200% text sizing without exposing source references or representing gaps as zero sleep.

The implemented nightly-recovery matrix covers minimal and complete dated arrays, absent nightly RMSSD, independent assessment, baseline, baseline-RMSSD, and guidance groups, documented value ranges, invalid partial groups, duplicate dates, equivalent reimport, strict enrichment, preservation, conflict, protected provenance, indexed range and identity queries, restart, atomic interruption, and interrupted version 7 migration. It separately classifies the undated recovery blob as deliberately ignored, persists no sample content or hash, and never associates it through delivery order or token similarity. Application and transport tests cover default and explicit ranges, multiple origins, explicit gaps, exact interval averages, source-component coverage, unequal comparisons, exact detail, separation of lightweight overview data from baseline values and guidance text, invalid facts, and lossless JavaScript transport. Component and packaged tests cover loading, empty, unavailable, and partial states; filtering; complete source-context detail; comparison; invalid-input retention; locale changes; exact repeat; cumulative import; restart; accessibility; and 200% text sizing without exposing origin references or inferring medical meaning.

## Test-layer use

- **Schema and contract checks** validate source definitions and expected outputs against published machine-readable schemas.
- **Unit tests** exercise canonical identities, invariants, equivalence, amendment, and conflicts without JSON or persistence.
- **Adapter integration tests** generate source packages and prove classification, validation, and mapping.
- **Persistence integration tests** prove atomic visibility, migration, restart, and provenance.
- **E2E tests** use the same scenario definitions through the packaged desktop entry point and verify visible coverage, guidance, persistence, exploration, and both locales.
- **Performance tests** expand deterministic generators to recorded scales without committing generated personal-like histories.

The current `SYN-025` Insights slice has two complementary generated envelopes. The release-mode read-model benchmark creates ten years and four opaque origins directly in a temporary production-schema library, with daily observations, one varied training session, one primary sleep period, and one nightly-recovery observation per origin and date, to isolate indexed queries and application calculations. Sleep and recovery overview and comparison use lightweight projections while exact detail retrieves one complete identity. The packaged journey imports a two-year, one-origin provider archive with available, unavailable, and missing daily activity plus one varied training session, primary sleep period, and recovery observation per date before measuring Tauri, React, and WebView filtering and comparison for all four domains and exact sleep and recovery detail. Their exact methods and limits are documented in the [performance benchmark guide](../development/performance-benchmarks.md).

## Review safeguards

- Fixture pull requests explain independent construction and identify the public format section they exercise.
- Values are obviously fictional, minimal, and varied enough to expose accidental fixed-value assumptions.
- Geospatial fixtures use invented geometries that do not trace real journeys or sensitive locations.
- Images and binary artifacts are newly generated or license-compatible project assets.
- Expected outputs contain only the data necessary to prove behavior.
- Repository-content and secret scans run over fixture sources and generated small artifacts before publication.

## Completion gate

A scenario is complete only when its documentation, generator or fixture, expected outcome, and applicable automated tests agree. A provider or FitFreed format change that alters a scenario updates the specification and contract evidence in the same increment.
