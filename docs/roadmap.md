# FitFreed Product Roadmap

## Status

Milestone 1 and Milestone 2 capability implementation and the current Milestone 3 public-release engineering baseline are complete. Apple Silicon on macOS 15.0 or later is the accepted MVP platform boundary. Before activating production trust or preparing a public candidate, the project is executing the production UI and UX intervention through the [MVP experience delivery plan](plans/mvp-experience-delivery.md). D0 accepted the ordered evidence report with self-contained HTML export, the attributed deep-session workspace with routed and non-routed verticals, reusable segmentation, and user-authored sport classification. P1 published the truthful canonical product site with exact remote verification and no premature download action. E1 and E2 have passed their complete local checkpoints; their latest exact hosted executable evidence remains pending. All three E3 slices have passed locally: sport classification, indexed full-history search, chronology, source-separated calendar discovery, two-through-four-session comparison, exact lightweight return, and restart restoration now form one packaged journey. E4 has reached its complete local checkpoint. Its recorded-structure, route, temporal-signal, reusable-segmentation, recorded-zone, session-provenance, and cross-signal verticals expose provider-neutral exercise evidence, primary and transition geometry, bounded private local traces, supported gap-aware time series, two-through-four independently scaled series on a shared elapsed-time axis, paginated exact points and samples, exact recorded heart-rate, speed, and power zone aggregates, explicit unsupported evidence counts, user-authored criteria with exact FitFreed-derived segments, and a privacy-bounded account of how import evidence produced the visible session. The first E5 vertical has passed locally: a session can become a durable, editable, privacy-reviewed personal interpretation whose deterministic self-contained HTML output is verified outside the application and whose source change remains explicit after reimport. E5 remains active for the additional accepted block types, start paths, deliberate refresh, and complete report navigation before E6 integration and evaluation. Hosted evidence for the latest executable fingerprint remains pending. Milestone 3 release acceptance remains active but externally gated until the redesigned experience is accepted: deterministic trust, candidate, publication, recovery, user, maintainer, and readiness paths pass local and hosted automation with production trust deliberately inactive, while production authority, protected GitHub configuration, exact-candidate evaluation, and public-release publication remain open in the consolidated readiness ledger.

## Purpose

This document is the canonical source for product sequencing and milestone boundaries. It defines outcomes and dependencies without turning uncertain future work into falsely precise task estimates.

Detailed execution plans will be created per milestone and linked from this roadmap. Implementation issues will derive from those plans rather than replacing them.

The Milestone 0 closure plan is [`plans/milestone-0.md`](plans/milestone-0.md). The completed foundation plan is [`plans/milestone-1.md`](plans/milestone-1.md). The implemented MVP sequence is [`plans/milestone-2.md`](plans/milestone-2.md). The accepted product direction is recorded in [`plans/ui-redesign.md`](plans/ui-redesign.md), and its active production sequence is [`plans/mvp-experience-delivery.md`](plans/mvp-experience-delivery.md). The public-release sequence remains [`plans/milestone-3.md`](plans/milestone-3.md). Technology evidence follows [`technology-evaluation.md`](technology-evaluation.md).

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
- Canonical GitHub Pages product site with readiness-gated links to immutable GitHub Release downloads and evidence.
- Verification of clean installation, first launch, update, migration, interruption recovery, and removal using public-release-shaped artifacts.
- Public user documentation, release notes, checksums, signatures, software bill of materials, provenance, support policy, and security-reporting path.

**Exit criteria:** Gatekeeper recognizes the application as signed and notarized, every public release gate passes, and no unsigned binary is exposed through the public release channel.

### Active MVP experience delivery stage

**Outcome:** replace the diagnostic document-like interface with one coherent journey from product promise and import to session evidence and a durable personal report.

**Dependency:** the accepted interaction direction and D0 report, deep-session, segmentation, sport-classification, navigation, and public-communication boundaries.

**Included:** first-run acquisition and settings; question-led Home; import-to-value handoff; origin-aware navigation; sport and full-history session discovery; user-authored sport classification; the accepted routed and non-routed session evidence verticals; reusable segment criteria; ordered personal evidence reports; deterministic self-contained HTML export; accessibility, localization, performance, documentation, and release-shaped regression evidence; and the truthful canonical GitHub Pages product site.

**Boundary:** FR-005, FR-025, and FR-026 define the accepted MVP limits. Broader sample families, external cartography, a free-form publishing system, additional providers, connected APIs, MCP, and new platforms remain outside this intervention. The product site may be published before the application, but it cannot expose a supported-download action until the Milestone 3 release gate passes.

**Execution:** D0 is accepted. E1 through E6 are the runnable vertical increments in the [MVP experience delivery plan](plans/mvp-experience-delivery.md); each produces a reviewable package and complete lower-layer, UI, test, and documentation evidence before the next depends on it.

### Horizon 1 — Broader insight coverage

**Outcome:** expand the supported Polar Flow domains, relationships, user-authored reports, exports, and visualizations beyond the MVP while preserving import compatibility and performance.

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
2. Incremental provider-API connectors that extend an established historical library with newly available records.
3. Additional provider importers and matching incremental connectors, potentially including Garmin, selected by user value and available export and API capabilities.

Archive import remains the historical baseline; a provider API is an incremental convenience, not a substitute for historical portability. Connector authorization, limited history windows, unavailable data families, rate limits, revocation, outages, and API discontinuation remain explicit. The relative scheduling of platform expansion and additional data sources remains a product decision after MVP evaluation. Neither track may compromise the provider-neutral core.

### Horizon 2 — Mature personal analytics

**Outcome:** provide deeper longitudinal analysis, comparison, export, and advanced visualization capabilities based on validated user needs, then expose supported library questions to user-authorized artificial-intelligence agents through a local Model Context Protocol boundary.

**Planning level:** outcome only; no Horizon 2 capability is an MVP prerequisite. MCP access remains disabled by default and requires a separate permission, privacy, observability, and revocation design before implementation.

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
