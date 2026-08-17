# Milestone 1 Execution Plan

## Status

Complete as of 2026-08-16. All six increments passed their local and hosted acceptance gates. The [Milestone 2 plan](milestone-2.md) is now the canonical implementation sequence for the MVP.

## Objective

Create a production-shaped, versioned application that can be built, tested, packaged, localized, and evaluated from a clean clone. The first vertical slice imports independently constructed Polar Flow daily-activity artifacts through a provider adapter, reconciles them into a provider-neutral library, and presents persisted history through the desktop application.

No product source, behavioral test, required fixture generator, or continuous-integration entry point may depend on ignored spike content or private exports.

## Increment M1.1 — Promote the selected foundation

**Status:** complete. Product source, tests, fixtures, brand assets, toolchains, and packaging configuration are versioned and pass the local and hosted acceptance gates.

**Outcome:** the selected application becomes the single versioned source of truth.

**Work:**

1. Inventory every spike artifact and incoming reference before moving or retiring it.
2. Promote live source, lockfiles, packaging configuration, synthetic fixture generators, unit tests, integration tests, presentation tests, and packaged E2E tests into the tracked application.
3. Remove spike language, template branding, generated output, logs, and unused template assets.
4. Establish explicit domain, application, infrastructure, source-adapter, Tauri-host, and React-presentation boundaries with dependencies pointing inward.
5. Add an automated architecture check that prevents domain and application code from importing provider, persistence, archive, JSON, desktop, or operating-system adapters.
6. Retire the local Tauri spike only after no live reference or unique required artifact remains.

**Acceptance evidence:** tracked source has no `.local` dependency; formatting, static analysis, architecture, unit, integration, presentation, packaging, and repository-safety checks pass.

Pre-purge hosted evidence passed the portable, production-package, packaged macOS E2E, repository-content, and secret-scan gates. Its obsolete workflow records are not retained after privacy history cleanup.

## Increment M1.2 — Reproducible GitHub Actions verification

**Status:** complete. The portable and packaged macOS jobs pass from a clean checkout without manual command relay.

**Outcome:** contributors and the default branch receive automated evidence without requiring the project owner to run local commands.

**Work:**

1. Provide versioned local entry points for setup, fast verification, full verification, synthetic fixture generation, production packaging, instrumented E2E packaging, and packaged E2E execution.
2. Add a GitHub Actions pull-request and `main` workflow with least-privilege read access and bounded timeouts.
3. Run deterministic frontend tests and Rust domain, application, adapter, migration, formatting, lint, architecture, documentation, localization, repository-content, and secret checks.
4. Run a macOS job that installs only declared toolchains and locked dependencies, generates independent synthetic fixtures, builds the Tauri application with test-only WebDriver capabilities, and drives the packaged application through the release-shaped E2E journey.
5. Verify language switching, every included control, invalid input, background progress, cancellation, exact reimport, cumulative import, accessible output, persisted restart, and recovery behavior.
6. Publish privacy-safe logs, test reports, and screenshots as short-lived failure artifacts. Never upload a database, selected filesystem path, real export, credential, or personal value.
7. Prove that the production package excludes WebDriver commands, permissions, and test-only plugins.

**Acceptance evidence:** the same documented commands pass locally and in GitHub Actions; the macOS E2E job passes from a clean checkout; a deliberately broken journey makes the required check fail with usable diagnostics; no manual command relay is part of the workflow.

An environment limitation never waives this gate. This increment remained open until GitHub Actions produced successful packaged E2E evidence.

Evidence: the successful pre-purge run above exercised every required lane. Its preceding genuinely failing packaged journey provided stronger evidence than the planned synthetic break: it failed the required check at the picker boundary and retained a privacy-safe screenshot and tool logs before the corrected run passed. The obsolete workflow records are not retained after privacy history cleanup.

## Increment M1.3 — Transactional library foundation

**Status:** complete. Immutable schema versions 1 and 2 now provide fail-closed creation and upgrade, durable lifecycle and terminal outcomes, complete artifact coverage, source and mapping versions, detailed reconciliation provenance, atomic canonical visibility, startup recovery, and backup evidence.

**Outcome:** SQLite storage and migrations implement the provider-neutral application ports with recoverable lifecycle behavior.

**Work:**

1. Convert the demonstrated schema into immutable versioned migrations.
2. Persist import operations, provenance, daily-activity observations, and conflicts transactionally.
3. Verify first creation, exact repeat, overlap, enrichment, preservation, conflict, cancellation rollback, injected interruption, backup, restart, and unsupported future schema behavior.
4. Keep SQLite and migration types outside the domain and application layers.

**Acceptance evidence:** unit and adapter integration suites prove the domain policy and persistence contract independently; restart-shaped tests recover a consistent library after each supported failure.

Local evidence on 2026-08-16: 24 Rust tests passed across domain, application, migration, and adapter boundaries; architecture, data-contract, documentation, localization, presentation, formatting, and lint checks passed; the instrumented macOS application completed its packaged E2E import, cancellation, repeat, cumulative, accessibility, and restart journey; and the production application and DMG passed the test-instrumentation exclusion check.

Pre-purge hosted evidence passed the portable, packaged macOS, repository-content, and secret-scan lanes. Its obsolete workflow records are not retained after privacy history cleanup.

## Increment M1.4 — Localized vertical journey

**Status:** complete. The desktop journey reads terminal outcomes through a provider-neutral application port and presents localized status, source, history effect, complete five-category coverage, and sanitized actionable failures. Locale selection is durable in schema version 3, first-run resolution follows the operating-system preference order with an `en-US` fallback, and dates, numbers, count forms, text expansion, and reduced motion are verified.

**Outcome:** the packaged application provides the first useful import-to-history journey in `en-US` and `es-ES`.

**Work:**

1. Move interface text into validated locale resources compatible with collaborative translation tools.
2. Present import selection, coverage, progress, cancellation, actionable errors, daily history, and accessible visual comparison.
3. Verify keyboard operation, semantic structure, locale-aware formatting, text expansion, and reduced-motion behavior.
4. Keep provider names at the import boundary and provider-neutral concepts in the library and presentation contracts.

**Acceptance evidence:** component and packaged E2E suites verify both locales and the persisted journey; accessibility automation has no accepted critical or serious violation; any required manual audit is recorded separately and does not replace automation.

Local evidence on 2026-08-16: 9 presentation tests and 28 Rust tests passed; architecture, all three persistence contracts, documentation links, translation structure, reduced-motion containment, TypeScript compilation, Rust formatting, and Clippy passed; the packaged macOS E2E journey passed validation, complete outcome coverage, cancellation, exact and cumulative reimport, locale-aware dates and numbers, Spanish text expansion, accessibility, and Spanish preference restoration after process restart; and the production application and DMG passed the test-instrumentation exclusion check.

Pre-purge hosted evidence passed the portable, packaged macOS, repository-content, and secret-scan lanes. Its obsolete workflow records are not retained after privacy history cleanup.

## Increment M1.5 — Contributor and user documentation

**Status:** complete. Documentation is navigable by audience; the supported environment, setup, architecture, tests, fixtures, debugging, packaging, localization, data contracts, privacy boundaries, contribution flow, current user journey, safety boundary, and unavailable alpha capabilities are explicit and versioned. The documented environment and verification entry points pass from a clean GitHub Actions checkout on both Ubuntu and macOS.

**Outcome:** a new contributor and a development evaluator can complete the current Milestone 1 journeys without private maintainer knowledge. Alpha-user documentation evolves with the real-data, installation, backup, recovery, and update behavior that enters Milestone 2; unavailable behavior is never documented as usable.

**Work:**

1. Document prerequisites, setup, architecture navigation, commands, tests, fixtures, debugging, packaging, localization, data contracts, privacy boundaries, and contribution workflow.
2. Document installation, first launch, ZIP import, history exploration, language selection, backup, recovery, update notices, privacy, and troubleshooting for users.
3. Validate contributor instructions from a clean clone and user instructions against the packaged application.
4. Keep documentation changes in the same increment as the behavior they describe.

**Acceptance evidence:** clean-clone and packaged-journey walkthroughs pass using only versioned instructions and synthetic data.

Local evidence on 2026-08-16: the environment doctor passed against the pinned macOS toolchain; all 158 local documentation links passed; and the documented `npm run verify:full` entry point passed architecture, data-contract, documentation, translation, reduced-motion, presentation, Rust, formatting, lint, packaged E2E, production-package, and test-instrumentation exclusion gates.

Pre-purge hosted evidence passed the portable, packaged macOS, repository-content, and secret-scan lanes. Its obsolete workflow records are not retained after privacy history cleanup.

## Increment M1.6 — Release-shaped installation and recovery

**Status:** complete. Accepted ADR 0003 defines the package, integrity, ecosystem-specific SBOM, manifest, and isolated installation evidence boundary. The versioned preparation and real-DMG verification workflows implement that boundary without publishing artifacts.

**Outcome:** Milestone 1 produces a private development package and release-draft input whose installation and failure behavior are verified without publishing an unsigned binary.

**Work:**

1. Add one versioned release-preparation entry point that produces the production package, checksums, dependency and license evidence, software bill of materials, provenance inputs, and draft release notes from an explicit reviewed version.
2. Verify clean installation, first launch, retained library state, removal boundaries, and a deliberately failed or interrupted installation using release-shaped macOS artifacts.
3. Prove that installation failure leaves the previous application usable and never deletes or partially migrates the user's library.
4. Document package locations, private evaluation handling, installation diagnostics, recovery, and the unsigned and non-notarized distribution boundary.
5. Keep release publication, tags, signing credentials, notarization, and public update channels behind their existing human authority gates.

**Acceptance evidence:** the versioned preparation and installation-recovery workflows pass locally and in the mandatory macOS GitHub Actions lane; generated artifacts contain no test instrumentation, personal data, credentials, or private paths; no unsigned package is uploaded to a public release channel.

Local evidence on 2026-08-16: a clean temporary Git revision produced the production application and DMG, one npm and three Cargo CycloneDX 1.5 documents, the version 1 release manifest, checksums, and draft notes. All direct production dependencies and declared licenses passed; development dependencies, test instrumentation, absolute repository paths, and `file://` references were absent. The real DMG passed pre-mount integrity verification, isolated installation, uninstrumented first launch with schema 3, corrupted-image rejection before the mount command, byte-preservation of the existing application and library, relaunch, and application-removal/library-retention checks. The same test exposed and now covers migration from the exact precontract version 1 developer-library shape.

Pre-purge hosted evidence passed the portable, private-release, installation-recovery, packaged macOS, repository-content, and secret-scan lanes. Its obsolete workflow records are not retained after privacy history cleanup.

## Cross-cutting completion rule

An increment is incomplete while any applicable unit, integration, E2E, packaging, documentation, localization, architecture, privacy, security, installation, update, or recovery evidence is absent or failing. Environment friction must be fixed or moved to a reproducible automated lane; it never converts a required check into an optional one.
