# Milestone 2 Execution Plan

## Status

Active as of 2026-08-16. Milestone 1 established the production-shaped application, architecture, persistence, localization, contributor workflow, packaged E2E path, and private macOS release-evidence boundary used by this plan.

## Objective

Deliver the agreed private macOS MVP alpha: a person can import a compatible real Polar Flow personal-data ZIP, understand complete coverage, explore provider-neutral daily activity, training, sleep, and recovery history, compare periods visually, repeat and extend imports safely, recover from actionable failures, and evaluate an integrity-verified private update path.

The MVP is complete only as one usable journey. A domain parser, database table, chart, or package is not independently sufficient evidence.

## Scope protection

This plan includes only the confirmed MVP in the [product requirements](../requirements.md). Route maps, full-resolution physiological or training sample exploration, providers other than Polar Flow, Linux and Windows packages, Apple signing and notarization, advanced application-level encryption, and a runtime importer marketplace remain excluded.

The private reference export is local acceptance input, never a fixture or publication input. Versioned evidence remains independently constructed and synthetic. No exact private path, filename token, value, count, timestamp sequence, identifier, route, package fingerprint, database, log, or screenshot may enter Git or GitHub Actions.

## Increment M2.1 — Real-package assessment and source-subject safety

**Status:** complete as of 2026-08-16. The strict provider-owned filename registry distinguishes the observed supported, unsupported, deliberately ignored, unrecognized, and invalid family boundaries. [ADR 0005](../architecture/decisions/0005-use-library-scoped-source-subject-correlation.md), schema version 4, the production adapter, localized failure guidance, and synthetic reimport evidence implement library-scoped source-subject correlation. Adapter version 3 adds the documented shape matrix, filename/content date consistency, duplicate-date rejection independent of ZIP order, and compatibility-version-scoped exact-repeat reuse. The terminal-outcome read model and responsive presentation provide localized family names, reasons, and next actions without exposing archive locators. Historical compatibility remains explicitly limited to the evaluated structure.

**Outcome:** the production application can assess a compatible real Polar Flow ZIP, resolve one library-local source subject without a fixed synthetic identity, import the supported daily-activity boundary, and explain the status of every archive member.

**Work:**

1. Define and test a provider-owned family registry for every observed filename grammar, root shape, and compatibility state required to classify the archive without speculative parsing.
2. Replace the host-supplied synthetic origin with an application contract for source-subject resolution. Provider evidence remains in the adapter; the canonical history receives only an opaque library-local identity.
3. Record a decision for privacy-preserving correlation across repeated exports. Raw account names, email addresses, and delivery-only filename values must not become canonical identity, logs, or user-facing diagnostics. Conflicting evidence must never merge two histories automatically.
4. Validate the observed daily-activity source versions and structural variants before mapping. Unknown compatible fields, incompatible shapes, invalid artifacts, known unsupported families, deliberately ignored artifacts, and unrecognized files remain distinct outcomes.
5. Persist complete artifact coverage and sanitized failure evidence while keeping assessment, staging, reconciliation, and canonical visibility recoverable and cancellable.
6. Present a localized coverage view by family and classification, including reasons and next action, without exposing archive paths or personal values.
7. Extend the provider reference, source mapping, canonical contract, persistence schema, migrations, synthetic scenario definitions, and contributor guidance in the same changes as behavior.

**Acceptance evidence:** synthetic unit, contract, adapter, persistence, migration, presentation, and packaged E2E tests cover source-subject creation, repeat correlation, conflicting identity evidence, every coverage class, real-shaped daily variants, invalid input, cancellation, and restart. A local privacy-preserving acceptance run against the supplied reference ZIP imports supported daily history and records complete coverage without emitting or versioning personal data. Exact and overlapping synthetic reimports remain deterministic.

Local evidence on 2026-08-16: the fast lane passed 209 documentation links, schema version 4 and adapter version 3 contract checks, both complete 144-message locale catalogs, 11 automation tests, 11 presentation tests, and 54 Rust domain, application, adapter, persistence, and host tests. Rust formatting and strict Clippy checks, dependency audit, production packaging, production-bundle inspection, repository-content inspection, and secret scanning passed. The packaged macOS journey passed large-import cancellation, complete localized family coverage, invalid input, exact and cumulative reimport, restart, 200% text scaling without horizontal overflow, and automated accessibility checks. The privacy-safe acceptance predicate passed against the supplied read-only reference ZIP without retaining or publishing its path, values, counts, identifiers, database, logs, or output.

Hosted evidence: commit `pre-purge` passed the [portable, private-release, installation-recovery, and packaged macOS E2E lanes](https://github.com/purnalica/fitfreed/actions/runs/31967414594) and the independent [repository content and secret scan](https://github.com/purnalica/fitfreed/actions/runs/31967414732).

## Increment M2.2 — Daily-activity exploration and comparison

**Status:** implementation complete locally; acceptance remains active pending hosted and reference-profile execution. GitHub has not allocated runners for the current commits. Overview version 2 preserves the 30-day default and adds a validated explicit range of up to 366 inclusive dates. Comparison version 1 accepts two validated periods and calculates exact signed changes while presenting both periods' availability coverage. Both keep observation origins separate and preserve unavailable values and missing observations. Schema version 5 provides their date-first query index; the responsive localized presentation provides date entry, visual and exact table alternatives, daily detail, and comparison controls without exposing opaque origin references. Versioned performance gates exercise the production SQLite and application read models over ten years and four origins, then exercise Tauri, transport, React, and WebView rendering after a two-year packaged import. Canonical daily activity remains at version 1 until additional source-field meaning and units are established; undocumented calories, distance, metabolic, and sleep-summary values do not enter the model speculatively.

**Outcome:** imported daily activity provides the first genuinely useful real-history dashboard, detail view, filter, and visual period comparison.

**Work:**

1. Extend canonical daily activity only with source fields whose meaning, units, optionality, time semantics, and loss are established well enough for user interpretation.
2. Define provider-neutral query ports and read models for overview ranges, daily detail, gaps, aggregates, and two-period comparison; presentation does not query persistence tables or provider records.
3. Add indexed persistence and migrations with deterministic reconciliation for every new field.
4. Build responsive localized visual and exact tabular representations with accessible names, units, non-color cues, keyboard interaction, empty and partial states, reduced motion, and text-expansion resilience.
5. Measure filtering, comparison, cold query, and rendering behavior against the applicable quality budgets.

**Acceptance evidence:** domain and mapping tests protect meaning and reconciliation; adapter and migration tests protect real-shaped input and historical libraries; UI and packaged E2E tests enter ranges, exercise every comparison control, verify exact values and accessible alternatives in both locales, reload persisted selections where specified, and cover invalid, empty, partial, and multiple-item behavior. The release-mode read-model gate uses 10 warm-up and 100 measured executions per interaction. The packaged gate uses four warm-up executions, 20 measured common filters, seven measured maximum filters, and 20 measured common comparisons; it also verifies a 366-day view at 200% text size. Both emit machine-readable host and method evidence and fail when p95 exceeds the applicable 500 ms or 2-second budget. Passing on a higher-specification developer machine does not yet prove the provisional 8 GB minimum profile.

## Increment M2.3 — Training-session summaries

**Status:** implementation complete locally; acceptance remains active pending hosted and reference-profile execution. The source, canonical, aggregate, identity, revision, local-time, unit, privacy, and known-loss contracts are specified for summary version 1. Adapter version 4 and schema version 6 implement summary-only import, source-subject-scoped identity, duplicate rejection, amendment ordering, provenance, conflicts, and indexed chronological querying. Provider-neutral training overview and comparison read models provide validated 30-day defaults and explicit ranges of up to 366 dates, per-origin detail, exact duration and energy arithmetic, optional distance totals, explicit metric-coverage counts, and comparison changes through typed Tauri transport. The localized responsive Insights UI adds summary, exact table and duration visual, filtering, detail, and two-period comparison while withholding opaque source references and distinguishing loading, empty, unavailable, and partial-measurement states. The packaged journey covers creation, exact repeat, later amendment, cumulative addition, every training control, 200% text sizing, accessibility, and restart through production entry points. The privacy-minimized private-reference predicate passes for both daily activity and training under one opaque origin. Polar's current Dynamic API provides official field semantics but its authenticated sports catalogue is absent from the evaluated takeout, so sport references remain explicitly unresolved rather than guessed.

**Outcome:** the same history can be explored by provider-neutral training sessions without importing route geometry or full-resolution samples into the MVP experience.

**Work:**

1. Specify observed training-session variants, relationships, identities, time offsets, units, enumerations, optional summaries, and explicitly unsupported route and sample structures.
2. Define canonical session summary, sport classification, identity, provenance, reconciliation, and known-loss rules without reproducing the provider object.
3. Add source mapping, persistence, queries, migrations, coverage, and progress through the existing import transaction.
4. Add training overview, filtering, detail, and period-comparison contributions to the established Insights contracts.

**Acceptance evidence:** synthetic variants cover equivalent, amended, conflicting, malformed, missing-relationship, time-zone, unknown-enumeration, and unsupported high-resolution cases. Unit, integration, migration, UI, packaged E2E, documentation, localization, accessibility, and query-budget gates pass.

Local import-to-storage evidence on 2026-08-16: contract and documentation checks passed schema version 6, adapter version 4, both complete 195-message locale catalogs, and 250 local links. Four domain, 11 application, 58 adapter, persistence, migration, and host tests, 14 presentation tests, strict Clippy, formatting, dependency audit, repository-content inspection, and secret scanning passed. The production bundle excluded test capabilities. The packaged macOS journey passed training-summary coverage in both locales, initial creation, exact repeat, later amendment, retained daily history, accessibility, restart, and the existing activity rendering budgets. The private-reference verifier passed its boolean-only activity, training, opaque-origin, coverage, and exact-repeat predicate without emitting counts, durations, paths, identifiers, dates, or values. This evidence closes the import-to-storage slice only; it does not close the training Insights increment.

Local Insights evidence on 2026-08-17: 16 presentation tests and the packaged macOS journey passed multiple-session filtering, complete and partial summaries, detail, comparison, invalid-range retention, both locales, exact repeat, amendment, cumulative addition, restart, automated accessibility, and 200% text sizing without page overflow. The release-mode gate measured ten years, four origins, and 14,612 synthetic training sessions through the production SQLite and application read models; every 500 ms and 2-second p95 budget passed. The packaged gate imported 731 training sessions, exercised 20 common filters, seven maximum filters, and 20 comparisons after four warm-up executions, and passed with local p95 values of 39 ms, 390 ms, and 32 ms respectively. These measurements establish regression evidence on the recorded high-specification host, not the provisional 8 GB reference profile.

## Increment M2.4 — Sleep history

**Outcome:** users can explore canonical sleep episodes and trends while distinguishing primary sleep records from activity-family sleep summaries.

**Work:**

1. Specify sleep-result and sleep-score structures, relationships, historical variants, interval semantics, phase meaning, scores, missing measurements, and observed ambiguity.
2. Define canonical sleep identity and reconciliation across local dates, offsets, midnight boundaries, amendments, and separate source artifacts.
3. Add transactional mapping, persistence, queries, migrations, coverage, detail, trend, and comparison behavior.
4. Expose gaps and unsupported sleep content rather than synthesizing certainty from absent records.

**Acceptance evidence:** synthetic fixtures cover midnight and daylight-saving boundaries, split artifacts, absent scores, amendments, conflicts, invalid intervals, partial coverage, and restart. Exact visual values, accessible alternatives, both locales, and applicable performance budgets pass through real entry points.

## Increment M2.5 — Recovery history

**Outcome:** nightly recovery information is understandable alongside sleep without collapsing source-specific physiological meaning into generic values.

**Work:**

1. Specify nightly-recovery and related blob structures, relationships, units, enumerations, recommendations, missingness, and unsupported high-resolution content.
2. Decide and document which observations are shared canonical recovery concepts and which require the controlled source-specific observation boundary.
3. Define identity, reconciliation, provenance, mapping, persistence, migrations, queries, and user-facing limitations.
4. Add recovery overview, detail, trends, and comparison contributions that disclose data gaps and measurement availability.

**Acceptance evidence:** unit and contract tests cover canonical and source-specific meaning; integration tests cover relationships, unknown variants, amendments, conflicts, and partial packages; UI and packaged E2E tests verify exact values, every control, accessible alternatives, localization, persistence, and recovery behavior.

## Increment M2.6 — Integrated longitudinal journey and scale

**Outcome:** daily activity, training, sleep, and recovery form one coherent longitudinal dashboard and visual comparison journey with trustworthy coverage and actionable recovery.

**Work:**

1. Integrate cross-domain range selection, overview, detail navigation, comparison, coverage gaps, and source attribution through provider-neutral Insights contracts.
2. Complete invalid, partial, unsupported, interrupted, cancelled, failed, exact-repeat, and cumulative-import guidance for the full MVP family set.
3. Generate the representative large scenario without versioning its output; measure import phases, peak memory, exact repeat, queries, visual readiness, cancellation, and restart against the published budgets.
4. Remove unbounded archive, mapping, persistence, query, and rendering behavior found by measurement at its owning layer.
5. Complete automated accessibility evidence and record the required privacy-safe manual keyboard, VoiceOver, scaling, contrast, and realistic usability evaluation procedure.
6. Complete user guidance for real ZIP import, coverage, exploration, reimport, data location, backup boundary, diagnostics, and recovery.

**Acceptance evidence:** the packaged desktop E2E suite exercises the complete eight-step MVP journey in both locales, enters realistic filters, uses every included control, verifies multiple records and persistence after restart, and checks exact accessible alternatives. The generated scale scenario meets every applicable budget on the reference profile; failures remain release blockers rather than accepted retries.

## Increment M2.7 — Private alpha update trust

**Outcome:** the application can report its version, check a private alpha channel without blocking offline use, present localized release information, and accept only an update whose metadata and payload origin and integrity are cryptographically verified.

**Work:**

1. Record the update metadata, signature, channel, minimum-supported-version, withdrawal, privacy, and application-versus-library rollback decision before connecting a real endpoint.
2. Implement provider-neutral update-check and notification use cases with explicit user action, dismissal, postponement, offline behavior, sanitized diagnostics, and no transmission of library or usage data.
3. Verify synthetic signed metadata, invalid signatures, digest mismatch, replay or downgrade attempts, incompatible schema requirements, unavailable service, and withdrawn versions.
4. Exercise update installation, application replacement failure, schema migration, previous-version recovery, retained locale and library, and removal using release-shaped artifacts.
5. Keep private endpoint creation, production signing material, participant distribution, and any uploaded package behind their documented human authority gates.

**Acceptance evidence:** unit, integration, presentation, packaged E2E, installation, update, migration, interruption, and offline tests pass with test-only cryptographic material. The real private channel remains an explicit release blocker until its endpoint and protected signing authority are supplied; no unsigned binary is uploaded publicly.

## Increment M2.8 — Private alpha readiness

**Outcome:** one reviewable source revision produces the documented private macOS alpha candidate and all evidence needed for a controlled real-data evaluation.

**Work:**

1. Close every implemented provider, canonical, mapping, persistence, migration, update, and release-evidence compatibility status and unresolved limitation.
2. Run the complete clean-clone, unit, integration, E2E, architecture, localization, documentation, security, privacy, dependency, SBOM, packaging, installation, update, recovery, accessibility, and performance gates.
3. Prepare version-matched user and contributor documentation, disclaimer references, release notes, checksums, manifest, inventories, known limitations, support boundary, and privacy-safe diagnostics.
4. Perform the local private-reference acceptance without publishing its data or evidence, then request only the human actions still required for update-channel authority and controlled participant evaluation.

**Acceptance evidence:** every Milestone 2 exit criterion and applicable product requirement has a linked passing result; the candidate remains unsigned, non-notarized, and outside public binary channels; any unmet human authority gate is reported as open and the MVP is not called complete until it closes.

## Cross-cutting completion rule

Every increment updates its user, developer, architecture, domain, provider-format, canonical, mapping, persistence, migration, fixture, localization, and test sources together. A new UI capability is incomplete until its application, domain, adapter, and persistence path works. A supported source field is incomplete until its semantics, compatibility, loss, and synthetic evidence are public. An environment limitation never waives a required gate.
