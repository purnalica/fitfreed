# FitFreed Product Roadmap

## Status

Milestone 1 is complete. The production-shaped Tauri and SQLite foundation, architecture, localized vertical slice, contributor path, continuous integration, and private macOS release-evidence boundary have passed their acceptance gates. Milestone 2 capability implementation is complete, and Apple Silicon on macOS 15.0 or later is its accepted platform boundary. Update-authority, controlled-distribution, and participant-evaluation gates remain open but do not block Milestone 3 engineering; they join the final release-readiness audit after Milestone 3 implementation.

## Purpose

This document is the canonical source for product sequencing and milestone boundaries. It defines outcomes and dependencies without turning uncertain future work into falsely precise task estimates.

Detailed execution plans will be created per milestone and linked from this roadmap. Implementation issues will derive from those plans rather than replacing them.

The Milestone 0 closure plan is [`plans/milestone-0.md`](plans/milestone-0.md). The completed foundation plan is [`plans/milestone-1.md`](plans/milestone-1.md). The implemented MVP sequence is [`plans/milestone-2.md`](plans/milestone-2.md). The active public-release sequence is [`plans/milestone-3.md`](plans/milestone-3.md). Technology evidence follows [`technology-evaluation.md`](technology-evaluation.md).

## Planning principles

- Deliver the smallest responsible MVP as the first usable product milestone.
- Build through runnable vertical increments that can be evaluated early.
- Keep only the current milestone detailed enough for execution; refine later milestones as evidence becomes available.
- Do not pull post-MVP features or speculative infrastructure into the MVP critical path.
- Preserve all confirmed quality and architectural constraints within the reduced MVP scope.
- Record scope, dependency, or sequencing changes together with their rationale and impact.
- Maintain traceability from requirements to milestone outcomes and verification evidence.
- Continue autonomously across accepted increments and stop only at the human intervention gates in `execution-policy.md`.

## Milestone map

### Milestone 0 — Product definition and delivery baseline

**Outcome:** enough verified product, data, architecture, and delivery context exists to define the MVP without assumptions.

**Included:**

- Product vision, constraints, and acceptance model.
- Confirmed product thesis linking GDPR-enabled portability, open-source software, and meaningful user freedom.
- The approved `FitFreed` identity and a legally precise public narrative that express that thesis without implying a compliance service or regulatory affiliation.
- Safe inventory of the real Polar Flow export format.
- Open provider-format reference and a normative documentation structure for every FitFreed-owned data representation.
- Initial ubiquitous language and candidate bounded contexts.
- Decisions that materially shape the MVP: users, privacy, supported platforms, core exploration outcome, storage expectations, original-data retention, open normalized-data export, portable backup, and accessibility target.
- Vendor-neutral domain boundaries and a source-import contract proven by the Polar Flow adapter without speculative runtime plug-in infrastructure.
- Technology evaluation criteria and architecture baseline.
- Initial compatibility, testing, documentation, localization, contribution, and release strategies.
- Unit, integration, E2E, fixture, performance, and quality-gate strategy.
- Developer, continuous-integration, release, distribution, translation, and maintenance automation strategy.
- Supported-platform installation, signing, update, migration, and release-notification strategy.
- Defective-update withdrawal, application rollback, data recovery, and supported-upgrade policy.
- Named MVP boundary and ordered post-MVP outcomes.

**Explicitly excluded:** production implementation of product features.

**Exit criteria:**

- No unresolved decision prevents the MVP from being described as a complete user journey.
- The MVP has measurable acceptance criteria and explicit exclusions.
- The selected architecture and technology can satisfy the verified data volume, cross-platform distribution, UX, DX, localization, privacy, and OSS constraints.
- Technology spikes demonstrate a credible path to the budgets in `quality-targets.md` on the reference Mac profile.
- The MVP execution plan is small enough to review and detailed enough to implement incrementally.
- Required implementation authority is recorded, and every unresolved human gate before autonomous execution is closed or explicitly deferred beyond the MVP.
- The selected name and public narrative communicate practical data freedom accurately without claiming that the product provides legal compliance or that the GDPR mandates a specific export package.

### Milestone 1 — Executable product foundation

**Outcome:** a production-shaped application can be built, tested, packaged, localized, and run with synthetic data through the complete architectural path needed by the first MVP capability.

**Dependency:** Milestone 0 exit criteria.

**Boundary:** this milestone may establish the walking skeleton and contributor workflow, but it is not the MVP unless it already delivers the agreed usable MVP journey.

**Provisional exit criteria:**

- A clean clone follows one documented path to build, test, run, and package the application.
- The first user-visible vertical slice imports a small synthetic Polar ZIP through the production source adapter and application use cases, maps at least one provider-neutral concept, persists it, and displays one useful historical result.
- The first source family, source-to-canonical mapping, canonical concept, and persistence schema are completely specified and checked against the implementation with synthetic contract evidence.
- Any headless import driver exercises the same application use cases as the desktop interface and does not become a parallel product or business-logic path.
- Clean Architecture dependency rules are automatically verified.
- The application runs in `en-US` and `es-ES` with translation validation.
- Synthetic fixtures exercise the initial end-to-end path without personal data.
- Continuous integration executes the same primary checks available locally.
- Unit, integration, and initial release-shaped E2E paths verify the first vertical capability.
- Documented automation covers setup, fast and full verification, synthetic-data execution, packaging, and release-draft preparation.
- The release pipeline can produce verifiable development packages through the same packaging architecture planned for public installers and updates.
- Deliberately failed installation and migration paths demonstrate recovery to a usable application and consistent synthetic library.

### Milestone 2 — MVP

**Outcome:** a private macOS alpha participant can complete the agreed primary journey with a real compatible Polar Flow ZIP archive and obtain meaningful, trustworthy value from the imported history without depending on Polar Flow's own exploration experience.

**Dependency:** Milestone 1 capabilities required by the agreed MVP journey.

**Scope:** the complete journey in `requirements.md`: Polar Flow ZIP import; coverage reporting; provider-neutral local persistence; activity, training, sleep, and recovery exploration; period filtering and comparison; idempotent and cumulative reimport; actionable recovery; both initial locales; complete specifications for every provider and FitFreed data representation implemented by the MVP; user documentation; a privately distributed unsigned macOS alpha package; and safe notification and cryptographic verification of private alpha updates.

**Exit criteria:** the confirmed MVP journey and applicable acceptance criteria in `requirements.md` pass through real entry points and the budgets in `quality-targets.md` are satisfied. Capability implementation may hand off to Milestone 3 before external authority and participant-evaluation gates close; those gates remain visible and must pass before an accepted distribution.

**Distribution boundary:** MVP source and development history may remain visible according to the repository publication plan, but unsigned application binaries will not enter a public release channel.

### Milestone 3 — Public macOS release

**Outcome:** the evaluated MVP journey is available to macOS users through a trusted, documented, and supportable public distribution path.

**Dependency:** completed MVP capability implementation and its automated evidence. Update-authority, controlled-distribution, and participant-evaluation work may close during the consolidated Milestone 3 release-readiness audit rather than blocking Milestone 3 engineering.

**Included:**

- Developer ID signing and Apple notarization.
- Public installer and update channel.
- Verification of clean installation, first launch, update, migration, interruption recovery, and removal using public-release-shaped artifacts.
- Public user documentation, release notes, checksums, signatures, software bill of materials, provenance, support policy, and security-reporting path.

**Exit criteria:** Gatekeeper recognizes the application as signed and notarized, every public release gate passes, and no unsigned binary is exposed through the public release channel.

### Horizon 1 — Broader insight coverage

**Outcome:** expand the supported Polar Flow domains, relationships, reports, and visualizations beyond the MVP while preserving import compatibility and performance.

**Planning level:** outcome only until MVP evaluation identifies the highest-value sequence.

## Evolution tracks after the MVP

### Platform track

1. Private unsigned macOS MVP alpha.
2. Signed and notarized public macOS release.
3. Linux support.
4. Windows support.

Minimum operating-system versions, architectures, packaging, signing, and update mechanisms will be decided per platform before its implementation milestone.

### Data-source track

1. Polar Flow importer in the MVP.
2. Additional provider importers, potentially including Garmin, selected by user value and available export formats.

The relative scheduling of platform expansion and additional data sources remains a product decision after MVP evaluation. Neither track may compromise the provider-neutral core.

### Horizon 2 — Mature personal analytics

**Outcome:** provide deeper longitudinal analysis, comparison, export, and advanced visualization capabilities based on validated user needs.

**Planning level:** outcome only; no Horizon 2 capability is an MVP prerequisite.

### Horizon 3 — Sustainable ecosystem

**Outcome:** mature contributor extension points, translation participation, format-evolution tooling, and community-led capabilities without weakening domain or privacy boundaries.

**Planning level:** outcome only; community readiness itself begins before public launch and is not deferred to this horizon.

## MVP critical-path rule

A task may enter the pre-MVP critical path only if at least one of the following is true:

1. It directly enables an accepted step in the MVP user journey.
2. It verifies an MVP acceptance criterion.
3. It is required by a confirmed architecture, security, privacy, quality, localization, documentation, accessibility, distribution, or OSS constraint.
4. Deferring it would create a known disposable implementation within the MVP path.

Convenience, possible future reuse, or an unvalidated post-MVP scenario is not sufficient.

## Change control

- Requirement changes are made in `requirements.md` first and reflected here afterward.
- Roadmap changes describe the affected milestones, dependencies, MVP impact, and decision owner.
- Detailed milestone plans may be refined without changing product scope, but any scope change requires an explicit product decision.
- Completed milestone evidence remains available as a historical record; the roadmap continues to describe the current forward plan.
