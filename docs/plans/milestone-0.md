# Milestone 0 Execution Plan

## Status

Active as of 2026-08-15. This is the canonical detailed plan for Milestone 0. It refines the outcomes in `docs/roadmap.md` without changing product scope.

## Objective

Produce enough verified product, source-format, domain, architecture, technology, and delivery evidence to begin the executable foundation without relying on a disposable prototype or an untested packaging assumption.

Milestone 0 ends with decisions and executable plans, not production feature implementation. Disposable technology experiments remain local; durable evidence, decisions, synthetic scenarios, and selected implementation foundations enter version control.

## Selected-foundation transition

An ignored technology spike may exist only while alternatives are being compared. Once an ADR selects that stack, no new product behavior may be added to the ignored implementation. Any remaining release-shaped verification must run against the versioned application foundation and becomes part of the Milestone 1 acceptance path.

The Tauri spike crossed this boundary when ADR 0001 was accepted. Promotion of its live behavior, tests, fixtures, and automation into the versioned product is therefore the first Milestone 1 increment. Generated output, logs, private measurements, and superseded experiments remain local.

## Execution order

### Increment M0.1 — Repository and OSS foundation

**Status:** complete in local commit `1731c56`.

**Outcome:** the project has canonical requirements, roadmap, architecture direction, quality and testing strategies, documentation governance, community health files, GPL licensing, privacy boundaries, and automated initial-publication safeguards.

**Evidence:** candidate-content checks, a checksum-verified Gitleaks scan of the working tree and complete history, a reviewed initial allowlist, and public-safe Git identity metadata.

### Increment M0.2 — Source compatibility and domain discovery

**Status:** complete.

**Outcome:** the Polar Flow export is described structurally without publishing private values, and its external concepts are separated from FitFreed's domain language and identity rules.

**Work:**

1. Build a local structural inventory of every detected file family, top-level shape, cardinality pattern, historical variant, relationship, size class, and high-resolution series.
2. Search for and assess official provider documentation, recording exactly which structures are guaranteed, partially described, or undocumented.
3. Classify source concepts by candidate FitFreed bounded context and identify external terms that must remain inside the anti-corruption layer.
4. Define import vocabulary covering artifact, archive, file, source record, normalized observation, domain entity, import operation, coverage, provenance, reconciliation, and conflict.
5. Define candidate logical identities and overlap rules for the first vertical concept without generalizing unverified identities across all data families.
6. Establish the normative specification structure for FitFreed's canonical model and source-to-canonical mappings, including how machine-readable schemas and contract tests remain synchronized with implementation.
7. Specify independently constructed synthetic scenarios for valid, duplicate, overlapping, amended, unknown, malformed, unsafe, interrupted, and resource-limit cases.
8. Record unsupported or uncertain mappings as explicit compatibility questions rather than silently flattening them.

**Exit evidence:** a provider-format compatibility structure, normative FitFreed data-specification structure, ubiquitous-language document, bounded-context proposal, import-state model, and synthetic fixture specification containing no private values or private data-set fingerprints.

**Evidence:** [`../data-formats/README.md`](../data-formats/README.md), [`../data-formats/providers/polar-flow.md`](../data-formats/providers/polar-flow.md), [`../domain/ubiquitous-language.md`](../domain/ubiquitous-language.md), [`../domain/bounded-contexts.md`](../domain/bounded-contexts.md), [`../domain/daily-activity.md`](../domain/daily-activity.md), [`../architecture/import-lifecycle.md`](../architecture/import-lifecycle.md), and [`../testing/synthetic-import-scenarios.md`](../testing/synthetic-import-scenarios.md). The complete structural inventory and analysis utilities remain local under the private-data policy; only reviewed, non-identifying structural conclusions enter the cited documents.

### Increment M0.3 — Integrated technology evaluation

**Status:** selection complete. [ADR 0001](../architecture/decisions/0001-select-tauri-application-stack.md) accepts Tauri 2 with a Rust core and TypeScript and React presentation. [ADR 0002](../architecture/decisions/0002-select-sqlite-storage.md) accepts SQLite as the single system of record. The release-shaped E2E, accessibility, responsive background import, signed-update, migration-recovery, minimum-hardware, and dependency-automation gates remain mandatory, but must now execute against the versioned foundation rather than extend a disposable spike.

**Outcome:** one desktop application family and one storage architecture have demonstrated the complete release-shaped path required by the first vertical slice.

**Work:**

1. Apply the paper-screen criteria in `docs/technology-evaluation.md` to every credible structural candidate.
2. Verify current framework, library, distribution, updater, accessibility, testing, licensing, and platform claims against primary sources.
3. Execute local disposable spikes for the highest-scoring candidates rather than committing parallel product foundations.
4. Exercise build, package, launch, import, persistence, reimport, query, visualization, localization, accessibility semantics, update verification, failure recovery, and automated test entry points.
5. Benchmark representative synthetic scenarios against the provisional budgets in `docs/quality-targets.md` and record exact hardware and methodology.
6. Analyze dependency licenses and supply-chain implications before selection.

**Exit evidence:** completed evaluation matrix, reproducible sanitized measurements, documented rejected alternatives, and proposed ADRs for the selected application and storage architecture.

**Evidence checkpoint:** [`../research/technology-paper-screen.md`](../research/technology-paper-screen.md) and [`../research/technology-spike-2026-08-15.md`](../research/technology-spike-2026-08-15.md).

### Increment M0.4 — Architecture baseline

**Outcome:** the selected technology is bound to Clean Architecture and DDD responsibilities rather than becoming the architecture itself.

**Work:**

1. Accept ADRs for the application family, UI boundary, persistence and analytics architecture, update architecture, and test execution model where the choices are independently durable.
2. Define initial bounded contexts, module boundaries, dependency rules, use-case ports, adapter ownership, and architecture checks.
3. Define transactional import phases, progress, cancellation, interruption recovery, schema migration, backup, and rollback boundaries.
4. Define localization resource format, translation validation, accessibility strategy, and user-visible error model.
5. Define development, continuous-integration, packaging, and private-alpha update commands with one implementation underneath local and hosted workflows.

**Exit evidence:** accepted ADRs, current thematic architecture, module map, dependency checks, and documented commands ready to be implemented by the walking skeleton.

### Increment M0.5 — Milestone 1 implementation plan

**Status:** in progress. The initial versioned plan is [`milestone-1.md`](milestone-1.md).

**Outcome:** the first production-shaped vertical slice can be implemented in small commits and evaluated through a real desktop entry point.

**Work:**

1. Select the smallest source concept that proves meaningful import-to-history value and exercises identity, provenance, persistence, query, localization, and visualization.
2. Break the slice into behavior-first increments with unit, integration, E2E, documentation, packaging, and recovery evidence.
3. Map every increment to requirements and define its acceptance commands.
4. Confirm that a clean clone can reach each evaluation point without private data or undocumented maintainer state.
5. Define separate, versioned documentation workstreams: contributor onboarding verified from a clean clone, and localized user guidance verified against the packaged installation, import, exploration, privacy, update, recovery, and troubleshooting journeys.
6. Define a mandatory GitHub Actions macOS E2E lane that builds the instrumented package, generates independent synthetic fixtures, exercises the packaged application, and retains safe diagnostic evidence on failure.

**Exit evidence:** reviewed Milestone 1 plan, traceable acceptance criteria, synthetic inputs, explicit user and contributor documentation deliverables with acceptance walkthroughs, and no unresolved decision blocking implementation.

## Cross-cutting rules

- Continue autonomously between increments; pause only at a gate in `docs/execution-policy.md`.
- Commit each coherent increment only after its applicable tests, documentation, privacy, security, and repository-content checks pass.
- Push each verified commit normally to `origin/main` under the standing project-owner authority. Do not force-push, tag, publish releases or packages, sign, notarize, use another target, or alter external repository settings without separate authority.
- Keep private exports and every derived value outside candidate repository content and diagnostic output.
- Prefer representative evidence over framework claims and end-to-end behavior over isolated demonstrations.
- Update this plan when sequencing or evidence changes; update requirements first if product scope changes.

## Milestone completion gate

Milestone 0 is complete only when every exit criterion in the roadmap is supported by linked evidence, all accepted structural choices have ADRs, the complete MVP journey remains feasible, and the Milestone 1 plan can start without an unresolved human decision or a knowingly disposable architecture.
