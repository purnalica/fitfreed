# FitFreed Product Requirements

## Document status

Initial requirements document. Unconfirmed decisions remain explicitly open and are not yet part of the agreed scope.

## Vision

Build a cross-platform desktop application that imports personal activity, training, sleep, recovery, and related data exported from vendor platforms and transforms it into a particularly clear and engaging experience for exploration, reporting, and visual analysis.

The product is vendor-neutral and multi-source by design. Polar Flow will be the only data source supported by the MVP; later importers may support Garmin and other platforms without turning any provider into the product's identity.

The application is named **FitFreed** and will be an open-source project published on GitHub under the `fitfreed` repository slug. [ADR 0001](architecture/decisions/0001-select-tauri-application-stack.md) selects Tauri 2, a Rust core, and a TypeScript and React presentation layer.

The architecture will follow Clean Architecture and Domain-Driven Design (DDD).

## Product objective

Enable people who hold data in vendor platforms to understand and benefit from their own history without depending on the exploration and reporting capabilities selected by those platforms. Data portability is only meaningful when people also have practical software that can use, present, and analyze the exported data.

Allow later exports and additional supported sources to be incorporated without duplicating or losing previously imported information.

The product must provide an exceptional user experience and an exceptional developer experience. Open-source sustainability is a product objective: the project must actively reduce the cost of understanding, using, contributing to, reviewing, and maintaining it.

## Product thesis

Legal access to personal data and practical freedom to use it are different capabilities. Where the GDPR right to data portability applies, it provides a legal path for a person to receive qualifying personal data in a structured, commonly used, machine-readable format and to transmit it elsewhere. Open-source software can turn that legal possibility into durable practical agency by making exported data understandable, useful, inspectable, extensible, and independent of a vendor's product decisions.

The project's central argument is:

> **GDPR-enabled portability + open-source software = meaningful user freedom.**

This thesis will guide product naming, public messaging, onboarding, documentation, architecture, local storage, interoperability, and roadmap priorities. The product must not replace a vendor silo with another opaque or inescapable silo.

The project will remain legally precise: it will not claim that the GDPR requires a particular ZIP archive, that every field in a vendor export necessarily falls under the right to portability, or that this application is a legal-compliance service. The canonical interpretation and messaging rules are maintained in [`product-thesis.md`](product-thesis.md).

## Confirmed scope

### Import

- The MVP input will be the ZIP archive provided by a Polar Flow personal data export.
- The application will process the ZIP archive directly; users will not need to extract it first.
- The same ZIP archive can be imported again without duplicating information or degrading the existing state.
- Later ZIP archives containing additional information can be imported.
- Successive imports will integrate new information with existing information.

### Data use

- Explore imported data.
- Produce reports derived from imported data.
- Visualize the information through an interface with a strong emphasis on visual communication.

### Distribution

- The product will be a cross-platform desktop application.
- The project will be published as open-source software on GitHub.
- The canonical repository is `purnalica/fitfreed` at `https://github.com/purnalica/fitfreed`.
- The repository is owned by the `purnalica` GitHub organization from its creation; the superseded plan to begin under a personal account was never adopted.
- Supported platforms will receive straightforward native installation packages and an in-application update path.
- The MVP will support macOS only.
- Linux will be the next supported desktop platform, followed by Windows.
- The macOS MVP will be a private evaluation alpha without Apple code signing or notarization.
- No unsigned macOS binary will be promoted to a public release channel.
- The first publicly distributed macOS release will use Developer ID signing and Apple notarization.
- The project is licensed under `GPL-3.0-or-later`.

### Vendor neutrality

- The product name, visual identity, domain model, primary navigation, and general product copy will not reference or imply affiliation with Polar, Garmin, or any other data provider.
- Provider names will appear only where needed to identify an importer, explain compatibility, attribute a data source, or give factual import guidance.
- Supporting a new provider will require a new importer and compatibility mapping, not a provider-specific fork of the product or a redesign of existing provider-neutral use cases.

### Language

- English is the canonical source and project language.
- Source code, identifiers, comments, technical documentation, tests, logs, configuration examples, contribution materials, and release artifacts will use English.
- Localized user-interface resources are the explicit exception to the English-only artifact rule.
- The initial product will support English for the United States (`en-US`) and Spanish for Spain (`es-ES`).
- The internationalization design will make additional languages straightforward to add and suitable for collaborative translation workflows.

## Initial functional requirements

### FR-001 — Import a Polar Flow export

The application will allow the user to select a Polar Flow takeout ZIP archive, validate that its structure is recognizable, and process the compatible data it contains.

### FR-002 — Idempotent reimport

Reimporting the same content will produce the same logical state: it will not create duplicates or improperly alter information that has already been incorporated.

### FR-003 — Cumulative import

Importing a later export will incorporate new information and reconcile previously known information according to deterministic rules.

### FR-004 — Exploration

The application will provide understandable navigation and querying of imported information. Specific entities, filters, searches, and relationships will be defined after the real takeout format has been inventoried.

### FR-005 — Reports

The application will produce reports. The report catalog, parameters, degree of customization, and output formats remain to be defined.

### FR-006 — Visualization

The application will provide visualizations that help users interpret evolution, distribution, relationships, and patterns in the data. Specific visualizations will be defined after assessing the available data and its quality.

### FR-007 — Import history management

The application will retain the information needed to explain which files were processed, when they were processed, and what the outcome was. This history will not replace duplicate detection based on content or logical identity.

## Confirmed design principles

- Import must be safe to repeat.
- Historical data must evolve cumulatively.
- The visual experience is a core product capability, not a later enhancement.
- User experience and developer experience are first-class quality attributes, not polish deferred until after feature implementation.
- The project will optimize for sustainable external contribution rather than assuming a permanent closed group of maintainers.
- Product construction will be gradual and will expose working increments early enough to evaluate behavior, usability, architecture, and priorities before the full product is built.
- The implementation roadmap and planning model will be explicit before implementation begins, while preserving the shortest responsible path to a usable MVP.
- Unit, integration, and end-to-end testing will form the primary evidence for product quality throughout development.
- Installation and update reliability are adoption-critical: a release that fails either path can immediately and permanently lose users.
- Repeatable development, verification, documentation, translation, packaging, release, and maintenance processes will be automated wherever reliable automation is possible.
- Once implementation starts, execution will proceed autonomously through the agreed roadmap and will pause only when human authority, credentials, product decisions, or an external-state change are genuinely required.
- Technology choices will be driven by product requirements and are not predetermined.
- Analysis of the real format will precede data-model design and implementation.
- The architecture will follow Clean Architecture and DDD.

## Confirmed architectural constraints

### Clean Architecture

- The domain will be independent of the user interface, persistence, operating system, development frameworks, and Polar Flow export format.
- Code dependencies will point toward the domain: presentation and infrastructure will depend on use cases and the domain, never the reverse.
- Use cases will coordinate application operations through explicit ports.
- ZIP and JSON processing, persistence, file generation, and integrations will be implemented as replaceable adapters.

### Domain-Driven Design

- The model will express the product language—activity, training, sleep, recovery, imports, and reports—instead of directly mirroring the JSON structure.
- Identity, reconciliation, and idempotency rules will be explicit invariants of the import domain.
- Bounded contexts will be defined during domain design according to capabilities and life cycles, not according to takeout folders.
- The Polar Flow format will be treated as an external model and translated into the internal model through an anti-corruption layer.
- Aggregates, entities, value objects, and domain services will be used when they protect real business invariants; DDD will not justify abstractions without a domain responsibility.

### Architectural verification

- Domain tests will not require a graphical interface, database, ZIP files, or external services.
- Use-case tests will use controllable ports and verify coordination without depending on concrete adapters.
- Integration tests will separately verify import, persistence, and presentation adapters.
- Code structure and automated checks will prevent dependencies from the domain toward outer layers.

## Private reference data

A private local Polar Flow export has been explicitly supplied outside the repository for format analysis. Its exact path, archive identifier, and personal contents are local-only and must not be recorded in versioned artifacts.

The source archive, extracted files, copied fragments, derived databases, screenshots, logs, reports, and benchmark outputs must not be added to the repository or published artifacts. Versioned test samples must be independently constructed, synthetic, and minimal under `repository-content-policy.md`.

## Verified inventory of the reference format

Private analysis confirms that realistic exports can contain thousands of files, multiple gigabytes, and high-resolution time series. Exact private archive counts and sizes are deliberately not versioned. Import cannot be designed under the assumption that all content can be loaded into memory at once.

The following information families have been identified:

| Area | Available information |
|---|---|
| Account | Account data, profile, and preferences |
| Devices | Active and archived devices, registrations, and settings |
| Daily activity | Steps, distance, calories, MET values, activity levels, summarized sleep, and inactivity alerts |
| Heart rate | Continuous heart rate and PPI samples |
| Training | Sessions, exercises, sports, duration, distance, calories, load, routes, pauses, laps, zones, and sample series |
| Planning | Targets, favorites, calendar entries, programs, and personal events |
| Sleep | Timing, phases, interruptions, continuity, efficiency, scores, and ratings |
| Recovery | Heart-rate variability, breathing, recommendations, and perceived recovery |
| Tests | Orthostatic and fitness tests |
| Physical evolution | Weight, VO2 max, thresholds, heart rate, and other historical physical information |
| Sport configuration | Sport profiles and zone, unit, and reminder settings |

The format is not homogeneous: it combines JSON objects and collections, singleton files, daily files, monthly files, and per-session files. It also contains historical variants of equivalent structures and high-resolution time series. Some records contain particularly sensitive data, including routes and coordinates, physiological data, birth dates, and device and account identifiers.

## Requirements derived from the verified format

### FR-008 — Explicit format coverage

Every detected file family will be classified as supported, deliberately ignored, or unrecognized. The import result will report this classification; no file will be silently discarded.

### FR-009 — Evolutionary compatibility

Import will tolerate known historical format variants and maintain an explicit strategy for versions, fields, or types that are not yet recognized.

### FR-010 — Observable and recoverable import

The interface will show phased progress and the final import outcome. A partial failure will not leave an inconsistent state or require the user to rebuild the library manually.

### FR-011 — Provenance and reconciliation

Normalized data will retain the minimum provenance needed to diagnose an import and reconcile reimports. Fast detection of an identical ZIP archive may rely on its fingerprint, but integration of later exports will use each entity's logical identity rather than relying only on file names.

### FR-012 — Protection from malicious or defective input

The application will validate the ZIP archive, limit uncontrolled resource consumption, and reject paths, sizes, structures, or content that could compromise the computer or corrupt the library.

### FR-013 — Locale selection

The application will select a supported locale from the operating-system preference on first run, fall back to English when no match exists, and allow the user to change the locale explicitly without reimporting data.

### FR-014 — Initial localized experience

All user-facing features included in the first release will be available in English and Spanish for Spain. Missing or invalid translations will fall back predictably to the canonical English source.

### FR-015 — Update availability notifications

- The application will check for new stable releases periodically and on explicit user request.
- When an update is available, the application will show a localized, non-disruptive notification containing the installed version, available version, release notes, and a clear update action.
- Users may dismiss or postpone an update unless the installed version is known to be unsafe or incompatible with the local data format; the policy for exceptional mandatory action remains to be defined.
- Failure to contact the update service will not prevent normal offline use and will not produce repeated intrusive errors.

### FR-016 — Safe application update

- The application will provide a guided update path appropriate to each supported operating system.
- Update installation will verify the authenticity and integrity of downloaded artifacts before execution.
- Updating the application will preserve the user's imported library, settings, and locale.
- Data-schema migrations will be versioned, tested, recoverable, and completed before the updated application exposes partially migrated data.
- The application will report the result of an update and provide actionable recovery guidance if installation or migration fails.

### FR-017 — Multiple data-source importers

- The application will expose a provider-neutral import capability implemented by source-specific adapters.
- Each importer will detect or validate its own export format, interpret source versions, and translate external records into provider-neutral application inputs through an anti-corruption layer.
- The MVP will provide one Polar Flow importer through the same application boundary intended for later importers.
- A new importer will declare its supported artifacts, format versions, capabilities, limitations, and synthetic compatibility fixtures.

### FR-018 — Source provenance

- Imported information will preserve enough source provenance to explain where a fact originated, diagnose mappings, and reconcile later imports.
- Exploration and reports will normally use provider-neutral concepts while allowing users to inspect source attribution when it is relevant.
- Cross-source reconciliation will remain separate from source parsing so future imports cannot silently merge semantically different records.

### FR-019 — Open export-format reference

- For each supported provider export, the project will identify and link any adequate official format specification.
- When no adequate official specification exists, FitFreed will publish a clean-room, observation-based reference covering file families, naming patterns, structural shapes, fields, types, relationships, known semantics, historical variants, compatibility status, and unresolved questions needed to use the export independently.
- The reference will distinguish official guarantees from observed behavior and FitFreed interpretations, identify when evidence was last verified, and evolve alongside importer compatibility.
- Published examples and schemas will be independently constructed and synthetic. No real record, value, route, identifier, timestamp sequence, or private data-set fingerprint will be copied into the reference.
- This documentation is a product outcome of practical data liberation, not merely internal importer documentation.

### FR-020 — Open FitFreed data specifications

- Every data representation owned by FitFreed will be documented completely and versioned alongside its implementation. This includes the provider-neutral canonical model, the portable export format, and implementation-specific persisted schemas and migrations.
- The normative canonical and portable-format specifications will define entities, value objects, fields, types, units, optionality, cardinality, identities, relationships, invariants, provenance, time and time-zone rules, enumerations, compatibility behavior, and known information loss.
- Each source importer will document how supported external fields map into the canonical model, including transformations, derived values, ignored information, ambiguity, and loss.
- Machine-readable schemas will be provided wherever the representation permits them. Automated contract tests will verify schemas, synthetic examples, migrations, and importer mappings against the implementation.
- Documentation will distinguish the stable portable contract from replaceable persistence details. A storage engine or internal schema will not silently become the only way to recover a user's normalized data.
- No new or changed FitFreed data field, mapping, migration, or portable representation will be complete until its corresponding specification and compatibility status are updated.

## Confirmed MVP scope

The MVP is a private unsigned macOS alpha that provides one complete user journey:

1. Launch the application in `en-US` or `es-ES`.
2. Select and import a Polar Flow takeout ZIP archive directly.
3. Inspect phased progress and a coverage report that distinguishes supported, deliberately ignored, and unrecognized data.
4. Persist normalized data locally and recover it after restarting the application.
5. Explore a longitudinal dashboard covering daily activity, training sessions, sleep, and recovery.
6. Filter the history, open detail views, and compare selected periods through a visual report.
7. Reimport the same archive without duplicates and import a later overlapping archive cumulatively.
8. Receive actionable guidance for invalid, partial, unsupported, interrupted, or failed imports.

The MVP also publishes the Polar Flow export-format reference required by FR-019 for every file family evaluated by the importer, including explicit gaps and unsupported structures. It publishes the FitFreed specifications required by FR-020 for every canonical concept, mapping, persisted schema, migration, and portable representation implemented by the MVP.

The MVP explicitly excludes:

- Route maps and detailed geospatial exploration.
- Full-resolution physiological and training sample exploration.
- Additional source providers.
- Linux and Windows packages.
- Apple code signing, notarization, and public binary distribution.
- Advanced application-level encryption.
- A runtime importer plug-in marketplace.

### NFR-001 — Local scalability

Import and queries must work with multi-gigabyte histories, thousands of files, and millions of samples without requiring the entire data set to reside in memory.

### NFR-002 — Privacy of reference data

Personal data supplied for analysis may only be read from its local location. It will not be copied into the repository, used in versioned tests, or included in diagnostic logs.

The MVP will apply baseline protections: local processing and storage by default, no transmission of imported data, no personal values in logs or diagnostics, restricted temporary-file handling, and explicit user control over destructive data operations. Advanced controls such as application-level encryption may remain in the post-MVP roadmap unless threat analysis identifies an MVP blocker.

### NFR-003 — Representative tests without personal data

Importer tests will use synthetic cases representing the variants and edge cases observed in the sample, including repeated ZIP archives, overlapping exports, new data, historical structures, unknown files, and invalid input.

### NFR-004 — Documentation as part of the product

User and technical documentation are mandatory deliverables. Every increment that changes behavior, architecture, installation, operation, or contribution procedures will update its canonical documentation source as part of the same change.

### NFR-005 — Reproducible developer onboarding

A new developer must be able to prepare the environment, run the application, execute automated checks, and understand the architectural boundaries using only the versioned repository documentation.

### NFR-006 — English as the canonical project language

All canonical engineering artifacts and source text will use English. Localized product resources are maintained separately and are the only multilingual project content. Automated checks will enforce this separation where practical.

### NFR-007 — Translation-tool interoperability

- User-facing text will be externalized from source code and represented through stable translation keys.
- The chosen resource format and workflow must support lossless import and export with established collaborative translation platforms such as Weblate, Crowdin, or Transifex.
- Translation resources will retain translator context, plural rules, interpolation metadata, and source-language changes.
- Automated checks will detect missing keys, invalid placeholders, malformed resources, and untranslated source text in the user interface.
- Interface layouts will tolerate translated text expansion and locale-specific number, date, time, duration, distance, and measurement formatting.
- The translation workflow will support adding a locale without changing domain or application code.

### NFR-008 — User experience quality

- The first-run experience will guide users from an empty library to a successfully imported and explorable history without requiring prior knowledge of the takeout structure.
- Information architecture will use progressive disclosure: summaries will remain approachable while detailed physiological and time-series data remain accessible.
- Long-running operations will keep the interface responsive and provide meaningful progress, safe cancellation when technically possible, and actionable recovery guidance.
- Empty, loading, success, partial-success, error, and unsupported-data states will be deliberately designed and tested.
- Destructive or privacy-sensitive actions will make their scope and consequences clear before execution.
- Keyboard navigation, focus behavior, color contrast, screen-reader semantics, reduced-motion preferences, and scalable text will be treated as core behavior under the WCAG 2.2 Level AA and WCAG2ICT target defined in `quality-targets.md`.
- Visualizations will remain interpretable without relying on color alone and will expose exact values and units through accessible alternatives.
- Locale-aware units, dates, times, durations, numbers, and terminology will be consistent throughout the product.
- UX acceptance will include realistic end-to-end usability sessions, not only component-level or screenshot review.

### NFR-009 — Developer experience quality

- A clean clone will provide one documented primary path to install prerequisites, build, run, test, lint, format, package, and diagnose the application.
- The default local workflow will not require personal data, proprietary credentials, or access to private infrastructure.
- Synthetic fixtures and data generators will make import behavior and visual states easy to reproduce.
- Fast checks will provide early local feedback, while comprehensive checks will remain available before integration.
- Formatting, static analysis, dependency rules, tests, documentation checks, packaging checks, and translation validation will run consistently locally and in continuous integration.
- Architectural boundaries, extension points, domain terminology, and representative implementation patterns will be discoverable and enforced where practical.
- Failures will report the violated rule and a concrete remediation path rather than exposing only an opaque tool error.
- Development tasks will be automatable and non-interactive by default so contributors and continuous integration use the same commands.

### NFR-010 — Open-source community sustainability

- The repository will include a concise README, contribution guide, code of conduct, security policy, support policy, license, governance information, and issue and pull-request templates before its public launch.
- The project will publish its supported scope, roadmap, compatibility status, release process, and change history.
- Contribution units will be independently understandable and reviewable, with suitable issues prepared for first-time contributors when real bounded work exists.
- Contribution requirements will be proportional to risk and will not impose unexplained process or accidental tooling barriers.
- Decisions and review feedback with durable value will be reflected in canonical documentation rather than remaining available only in conversations.
- Dependency choices will consider project health, licensing, maintenance burden, contributor familiarity, and long-term availability in addition to technical capability.
- Public repository history and artifacts will protect contributor email privacy and use GitHub identities or approved `noreply` addresses instead of private personal addresses.

### NFR-011 — Incremental and evaluable delivery

- Development will proceed through small vertical increments that exercise the required domain, application, adapter, persistence, presentation, testing, and documentation paths for a coherent capability.
- Every product increment will be runnable and will provide an observable outcome that can be evaluated by users or contributors.
- The first increment will establish the smallest production-shaped end-to-end path, and later increments will extend it without replacing it with a disconnected implementation.
- User-interface elements will not be treated as complete until their supporting use case, domain behavior, and persistence path work end to end.
- Foundational work without visible product behavior must identify the next vertical increment it enables and provide direct verification of its architectural purpose.
- Early evaluation will include realistic interaction and representative data, not only compilation, isolated unit tests, or static mockups.
- Feedback from an increment will inform later decisions, but changes to agreed scope or constraints require an explicit product decision and corresponding documentation update.
- Gradual delivery will not relax architecture, testing, documentation, accessibility, privacy, localization, or code-quality requirements.

### NFR-012 — Roadmap and planning clarity

- A versioned product roadmap will define ordered outcomes, dependencies, milestone boundaries, MVP boundaries, acceptance gates, risks, and deferred capabilities before implementation begins.
- The roadmap will cover the expected product evolution, while detailed task planning will use progressive elaboration: the current milestone will be actionable and later milestones will remain outcome-oriented until they approach execution.
- Product roadmap, milestone execution plan, and implementation backlog will remain distinct. The roadmap defines direction and sequencing; milestone plans define verifiable delivery; backlog items define executable work.
- Every milestone will state its purpose, included scope, explicit exclusions, dependencies, evaluation method, and exit criteria.
- Progress will be traceable from requirement to milestone, increment, implementation evidence, and acceptance result.
- Roadmap changes will record their reason and impact. They will not silently redefine agreed scope or acceptance criteria.

### NFR-013 — MVP protection

- The MVP will be the first milestone that delivers a complete, usable product outcome to its intended user, not a collection of technical foundations or disconnected demonstrations.
- Pre-MVP work will be limited to capabilities required to deliver the MVP or to satisfy confirmed architectural, security, privacy, quality, localization, documentation, and distribution constraints.
- Post-MVP extensibility will be preserved through Clean Architecture and DDD boundaries, but speculative features and generalized infrastructure will not delay MVP validation.
- MVP quality requirements are not reduced versions of final quality requirements. Scope may be smaller, but included behavior must be integrated, documented, tested, and suitable for real evaluation.
- Post-MVP milestones must not become implicit prerequisites for accepting the MVP.

### NFR-014 — Installation and update quality

- Installation will use conventions familiar to each supported operating system and will not require a development toolchain or terminal commands.
- Release artifacts and update metadata will be produced through a reproducible, documented release process.
- Installers, application bundles, and update artifacts will be signed or notarized according to the security model of each supported platform.
- The private macOS MVP alpha is the only exception to Apple code signing and notarization. Its distribution will remain restricted to evaluation participants and outside public release channels.
- The private-alpha exception does not permit unverified update payloads: update artifacts and metadata must still have cryptographically verified integrity and origin within the update mechanism.
- Developer ID signing and Apple notarization are release blockers for the first publicly distributed macOS binary.
- Update checks will transmit only the minimum technical information needed to determine compatibility and availability. They will not transmit imported health, location, account, or usage data.
- Users will be able to inspect the current version, trigger an update check, and access release notes from within the application.
- Installation, update from every supported upgrade baseline, migration, failed-update recovery, and removal will be verified on every supported platform before release.
- Removing the application will clearly distinguish removal of application binaries from deletion of the user's imported library.
- The application will remain functional without network access except for capabilities that explicitly require it, including update checks and downloads.

### NFR-015 — Installation and update release gate

- Clean installation, first launch, update discovery, update installation, data migration, failure recovery, and removal are release-blocking journeys on every supported platform.
- A release will not be published for a platform unless its signed or otherwise platform-trusted release-shaped artifact has passed the applicable installation and update matrix in a clean environment.
- An update failure must leave either the previous application version usable or a documented automated recovery path; it must not leave a partially installed application as the only state.
- Application updates and data migrations will be coordinated so that a failed application replacement cannot strand the user with an unreadable or partially migrated library.
- Before an update changes persistent data, the application will verify recoverability and preserve the information needed to restore a consistent supported state.
- Published releases will include checksums, signatures, release notes, supported upgrade baselines, known limitations, and recovery instructions.
- Release procedures will define how to halt or withdraw a defective update and how users return to a supported version without losing their library.
- Installation or update regressions reported on a supported platform will receive the highest product-defect priority.

### NFR-016 — Behavior-based automated quality

- Every included behavior and invariant will be verified at the lowest test level that provides trustworthy evidence, with higher-level tests covering integration boundaries and complete user journeys.
- Tests will protect observable behavior and domain rules rather than implementation structure.
- A change is not complete while its required unit, integration, and end-to-end evidence is absent or failing.
- Test suites will be deterministic, isolated, reproducible, and suitable for both local execution and continuous integration.
- Real personal exports will never be test fixtures. Synthetic fixtures will preserve the structural and behavioral cases needed for confidence.
- Test coverage metrics may identify unexamined code, but numerical coverage alone will not be treated as quality evidence or motivate tests without behavioral value.

### NFR-017 — Unit testing

- Domain invariants, value objects, reconciliation rules, idempotency, version interpretation, calculations, and error classification will have fast focused unit tests.
- Use-case tests will verify orchestration through controllable ports without requiring concrete persistence, file systems, networks, or graphical interfaces.
- Test setup will expose only dependencies relevant to each behavior and will retain strict detection of unused or incorrect test doubles.

### NFR-018 — Integration testing

- Integration tests will verify ZIP and JSON adapters, database behavior, transactions, migrations, import provenance, translation resources, update metadata, packaging boundaries, and other framework integrations.
- Import integration tests will cover repeated archives, overlapping exports, amended records, historical format variants, unknown files, corrupted content, interrupted imports, and retry behavior.
- Persistence tests will verify committed state, rollback, restart recovery, concurrency rules, query correctness, and migration from every supported schema baseline.
- Contract tests will protect the boundary between the Polar Flow external model and the internal domain model.

### NFR-019 — End-to-end testing

- End-to-end tests will drive the packaged desktop application through real user entry points and verify the resulting persisted behavior.
- Critical journeys will include first run, locale selection, ZIP selection, successful import, repeated import, cumulative import, exploration, filtering, report or visualization interaction, restart and recovery, update notification, update migration, and error handling.
- Interface tests will enter realistic values, persist them, reload the application, exercise every control in scope, verify multiple-item behavior, and cover invalid and boundary inputs.
- Visualizations will be tested for interaction, exact displayed values, accessible alternatives, localization, and recovery from empty or partial data—not merely for presence on screen.
- Installer and updater journeys will be tested on every supported operating system using release-shaped artifacts.

### NFR-020 — Quality gates

- Pull requests and release candidates will not pass while required automated tests, architecture checks, static analysis, translation validation, documentation validation, packaging verification, or security checks fail.
- Fast unit and focused integration tests will support the inner development loop. Broader integration, E2E, packaging, migration, performance, and platform matrices will run at explicitly documented continuous-integration stages.
- Every defect fix will include a failing automated reproduction at the appropriate level before the correction whenever technically feasible.
- Flaky tests will be treated as product-quality defects with ownership and diagnosis; they will not be silently retried or disabled to obtain a green build.

### NFR-021 — Process automation

- Every repeatable process will be evaluated for automation and will remain manual only when automation would reduce safety, reliability, transparency, or decision quality.
- The same versioned entry points will drive local development and continuous integration; CI-only command sequences will be avoided.
- Environment setup, formatting, static analysis, architecture checks, tests, synthetic fixture generation, documentation validation, localization validation, dependency and license checks, vulnerability scanning, packaging, signing preparation, installer verification, update metadata, and release assembly will be automated where supported.
- Versioning, change-log assembly, release notes, checksums, software bills of materials, provenance, and publication artifacts will be generated from versioned and reviewable inputs.
- Dependency updates and routine maintenance checks may be proposed automatically, but they must pass the same quality gates and review as contributor changes.
- Automation will be deterministic, non-interactive by default, cross-platform where contributors need it, and safe to rerun.
- Automated failures will explain the violated rule and provide a concrete remediation path.
- Secrets will be supplied by protected execution environments and will never be embedded in scripts, configuration committed to the repository, logs, fixtures, or generated artifacts.
- Automation will not bypass required human approval for scope changes, architectural decisions, security exceptions, secret use, signing authority, or public release.
- Remaining manual steps will be documented, justified, and periodically reviewed for safe automation opportunities.
- Repository initialization, contribution, release, and publication checks will detect private email addresses in Git metadata and public artifacts before they leave the local environment.

The canonical automation strategy is maintained in [`automation-strategy.md`](automation-strategy.md).

### NFR-022 — Vendor-neutral domain and application core

- Domain concepts and use cases will represent user-owned activity, training, sleep, recovery, and related information without importing provider terminology or schemas into the core.
- Provider-specific parsers, schema handling, identifiers, and mappings will remain in source adapters.
- The normalized model will not collapse all providers into a lowest-common-denominator record. Shared concepts will be modeled explicitly, while genuinely source-specific observations will retain their meaning and provenance through a controlled extension boundary.
- The domain may evolve when a new source reveals a genuine product concept. Vendor neutrality does not require predicting every future provider in the MVP.
- Importer separation will be enforced through code boundaries and contract tests. A runtime plug-in marketplace or dynamic extension system is not required for the MVP.

The canonical source-integration architecture is maintained in [`architecture/source-integration.md`](architecture/source-integration.md).

### NFR-023 — Measurable quality targets

- Accessibility will target WCAG 2.2 Level AA, interpreted for the desktop application through WCAG2ICT and supplemented by native macOS keyboard and VoiceOver evaluation.
- The macOS MVP will use an Apple Silicon Mac with 8 GB of memory and SSD storage as the minimum performance reference profile until the supported-hardware decision establishes a lower baseline.
- On the reference profile, cold launch to an interactive application shell will complete within 2.5 seconds at the 95th percentile.
- Visible interaction feedback will begin within 100 milliseconds. Common navigation and filtering results will complete within 500 milliseconds at the 95th percentile; complex historical visualizations may take up to 2 seconds when their loading state is explicit.
- Long-running work will not block the interface. Progress will appear within 1 second, cancellation will be acknowledged within 1 second, and processing will reach a consistent cancellation boundary within 5 seconds unless an operating-system operation cannot be interrupted safely.
- The independently generated large synthetic scenario defined in `quality-targets.md` will import within 10 minutes on the reference profile while peak application memory remains below 1.5 GB and does not grow without bound as history grows.
- Reimporting an identical archive will complete within 30 seconds after fingerprinting and will not repeat full normalization or persistence work.
- Installation and supported update matrices require a 100% pass rate; data-loss, library-corruption, migration, and recovery failures have zero accepted occurrences.
- All scoped user-interface strings require valid `en-US` and `es-ES` resources before acceptance.

These are initial acceptance budgets, not aspirational observations. Milestone 0 performance spikes may tighten them or replace the reference hardware with a lower supported baseline. Relaxing a budget requires measured evidence and an explicit product decision.

The canonical definitions and measurement method are maintained in [`quality-targets.md`](quality-targets.md).

### NFR-024 — Autonomous execution

- Normal implementation choices within confirmed requirements will be resolved through evidence, documented trade-offs, and reversible decisions without requesting permission to continue.
- Build failures, test failures, defects, uncertain code behavior, and difficult implementation work will trigger root-cause analysis and continued in-scope work rather than a request for routine confirmation.
- Progress, decisions, verification evidence, known limitations, and remaining work will be preserved in versioned canonical documentation so execution can continue across long sessions.
- Execution will pause only when no safe in-scope path remains without human authority or information, including credentials, account ownership, public publication, destructive action, scope change, conflicting product requirements, legal acceptance, or access to unavailable external state.
- A pause will identify the exact blocker, completed safe work, available evidence, and the smallest human action needed to resume.
- Autonomous execution will not reinterpret a partial implementation as completion, bypass quality gates, broaden scope, or weaken a confirmed constraint to avoid a pause.

The canonical autonomy and intervention policy is maintained in [`execution-policy.md`](execution-policy.md).

The canonical testing strategy is maintained in [`testing-strategy.md`](testing-strategy.md).

### NFR-025 — No replacement lock-in

- The application will not require an account, subscription, or hosted service to import, retain, explore, report on, back up, or recover the user's library.
- The internal data model, persistence format, schema evolution, and recovery procedures will be documented sufficiently for independent inspection and implementation.
- Users must have a supported path to leave the application with their information intact. A portable backup and an open normalized-data export are architectural obligations; their exact formats and delivery milestone remain open decisions.
- Data migrations will preserve recoverability, and documented procedures will allow a library to be restored without depending on an unavailable proprietary service.
- Provider provenance will remain attached to normalized records so that portability does not erase origin or prevent future reinterpretation.

## Delivery model

Each increment will follow this cycle:

1. Define a coherent user or contributor outcome and measurable acceptance criteria.
2. Identify the smallest vertical slice that can demonstrate that outcome without introducing a disposable parallel design.
3. Implement the slice through the appropriate Clean Architecture layers using tests that protect behavior and architectural boundaries.
4. Run the application with representative synthetic data and evaluate the complete interaction.
5. Update user, technical, architectural, and compatibility documentation affected by the slice.
6. Present the runnable increment and its verification evidence for feedback before selecting or refining the next increment.

An increment is not accepted merely because its internal components exist. It must be integrated, observable, documented, and evaluable from its intended entry point.

The canonical product roadmap is maintained in [`roadmap.md`](roadmap.md).

## Documentation requirements

### User documentation

At minimum, it will cover:

- Supported platforms, installation, updates, and removal.
- Update notifications, postponement, release notes, migration behavior, and recovery from a failed update.
- First run and import of a Polar Flow ZIP archive.
- Reimports, cumulative imports, and the meaning of their outcomes.
- Included exploration features, reports, visualizations, and exports.
- Data location and handling, privacy, backups, and deletion.
- Common errors, safe diagnostics, and recovery.
- Known limitations and the Polar Flow format compatibility matrix.

The required languages for user documentation remain an open product decision; technical and contribution documentation will use canonical English.

### Technical and contribution documentation

At minimum, it will cover:

- A quick start from a clean repository clone.
- Environment requirements, build, run, test, static analysis, and packaging procedures.
- Clean Architecture overview, dependency direction, and layer responsibilities.
- Domain model, ubiquitous language, bounded contexts, and primary invariants.
- Use cases, ports, adapters, and persistence strategy.
- Import pipeline, reconciliation, idempotency, and takeout version compatibility.
- Testing strategy and synthetic data generation.
- Durable architectural decisions through architecture decision records.
- Contribution workflow, review criteria, versioning, and publishing.
- Procedures for diagnosing errors without exposing personal data.

### Documentation governance

- Every piece of knowledge will have one canonical source; other documents will link to it.
- Documentation will distinguish the current design from historical decisions.
- Public examples will use synthetic data exclusively.
- Documented commands will be covered by automated verification when practical.
- Every change review will explicitly determine whether documentation must be updated.

## Open-source contributor experience

The public repository will provide a clear path through four stages:

1. **Evaluate:** understand the purpose, current capabilities, screenshots, supported data, platforms, license, and project status quickly.
2. **Run:** launch the application with synthetic data from a clean clone using the documented primary workflow.
3. **Contribute:** find a bounded issue, understand the relevant architecture and acceptance criteria, make a change, and run the same checks used by continuous integration.
4. **Maintain:** diagnose failures, review changes, publish releases, evolve schemas, and record durable decisions without relying on undocumented maintainer knowledge.

## Open decisions

1. Minimum macOS version and processor architectures supported by the MVP; minimum versions and architectures for later Linux and Windows support.
2. Privacy model beyond the confirmed local baseline, including backup and possible encryption.
3. Detailed identity, update, and conflict rules for the MVP data types.
4. Exact formats and delivery milestone for open normalized-data export and portable library backup, beyond the confirmed visual period-comparison report.
5. Accessibility and appearance requirements beyond the confirmed locale and quality targets.
6. Detailed distribution, update, Developer ID credential, signing, notarization, and installer strategy for the first public macOS release.
7. Programming language, development framework, persistence, and visualization library.
8. Support for one person or multiple independent libraries.
9. Retention or deletion of the original ZIP archive and JSON files after import.
10. Languages required for user documentation in the first release.
11. Governance evolution beyond the bootstrap owner-maintainer model defined in `GOVERNANCE.md`.
12. Update channel policy, check frequency, supported upgrade baselines, and exceptional security-update behavior.
13. Cross-source identity, overlap, conflict, and user-controlled reconciliation rules after the single-source MVP.

The canonical product spelling, positioning constraints, and public-branding validation gate are maintained in [`naming.md`](naming.md).

## Product acceptance criteria

The final criteria will be refined during analysis. At minimum, they must cover:

- Successful import of a compatible real export.
- Reimport of the same content without duplicates.
- Cumulative import of a later export.
- Correct persistence and recovery after restarting the application.
- Exploration of all information types included in scope.
- Correct generation of agreed reports.
- Functional verification of all filters, controls, and interactions in every visualization.
- Understandable handling of invalid, partial, or unsupported data.
- Verified installation and execution on every declared platform.
- No real personal data in the repository or public artifacts.
- Verified developer onboarding from a clean clone using the technical documentation.
- A complete walkthrough of included features using only the user documentation.
- Complete English and Spanish user-interface coverage with correct fallback, pluralization, interpolation, and locale-aware formatting.
- Successful round-trip of translation resources through at least one supported collaborative translation workflow.
- Successful completion of first-run, import, exploration, and recovery usability scenarios by participants who did not implement the feature.
- Successful build, test, and application launch by a new contributor from a clean clone using only repository documentation.
- Equivalent results from the documented local checks and continuous-integration checks.
- Unit, integration, and E2E evidence passing for every behavior included in the accepted increment.
- Public-launch readiness review covering community health files, licensing, security reporting, governance, roadmap, and contribution workflow.
- Early review of every increment through its real entry point, with acceptance evidence covering the complete vertical slice.
- Clean installation, update notification, signed update, data migration, failed-update recovery, and removal verified on every supported platform.
- Demonstrated preservation of a usable application and a consistent user library when update installation or migration is deliberately interrupted.
- Successful execution of documented automated workflows from a clean clone, with equivalent local and continuous-integration results.
- Demonstrated isolation of Polar Flow parsing and terminology from provider-neutral domain and application code.
- Compliance with the performance, responsiveness, accessibility, localization, installation, and data-integrity budgets in `quality-targets.md`.
- No unsigned macOS binary present in a public release channel; successful Developer ID and notarization verification for the first public macOS release.

## Scope boundary

The confirmed MVP exclusions are listed under `Confirmed MVP scope`. A capability that does not appear as a confirmed requirement is not authorized for implementation unless the project owner explicitly changes the scope and the canonical requirements and roadmap are updated together.
