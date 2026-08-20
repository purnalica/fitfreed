# Testing Strategy

## Purpose

Automated testing is the primary source of evidence that the product behaves correctly, preserves user data, respects architectural boundaries, and remains safe to change. Unit, integration, and end-to-end tests have distinct responsibilities and are all required.

## Principles

- Test behavior, invariants, contracts, and user outcomes rather than internal structure.
- Use the lowest test level that can prove a behavior reliably; use higher levels to prove boundaries and journeys that lower levels cannot establish.
- Keep tests deterministic, isolated, diagnosable, and executable through documented commands.
- Use synthetic data only. Preserve relevant shape and edge cases without retaining personal values from the reference export.
- A green test suite is required but not sufficient: acceptance also requires realistic evaluation, documentation, and architecture evidence.
- Never delete or weaken an assertion merely because production structure changed. Preserve the protected behavior through an appropriate observation path.
- Never disable strict test-double validation or hide flaky behavior through unconditional retries.

## Test levels

### Unit tests

**Purpose:** prove domain behavior and application decisions quickly and precisely.

**Primary scope:**

- Entities, value objects, aggregates, and domain services.
- Logical identity, reconciliation, conflict rules, and idempotency.
- Calculations, time ranges, units, locale-independent semantics, and classifications.
- Format-version selection and normalized error models.
- Use-case orchestration through test-controlled ports.

**Excluded:** concrete databases, ZIP readers, JSON libraries, operating-system APIs, update services, and graphical interfaces.

### Integration tests

**Purpose:** prove concrete adapters and contracts against real supporting technology.

**Primary scope:**

- ZIP validation, safe extraction or streaming, JSON parsing, and schema variants.
- Anti-corruption mapping from Polar Flow structures to domain inputs.
- Database constraints, transactions, migrations, queries, rollback, and restart behavior.
- Import fingerprints, provenance, overlap reconciliation, and retry behavior.
- Localization catalogs, placeholders, plural rules, and fallback.
- Versioned source-acquisition guide validation, adapter ownership, exact locale selection, and least-privilege official-link capabilities.
- Application-shell structure, semantic sidebar ownership, broad desktop workspace, compact navigation rail, and initial-window presentation contracts.
- Training workspace and session-detail navigation, semantic current-location state, and enforced progressive-disclosure boundaries.
- Shared activity, sleep, recovery, and aligned-history workspace navigation, current-location state, exact-detail replacement, and progressive-disclosure boundaries.
- Report Library, Compose, Preview, stale-evidence review, and export-review boundaries, including preserved mounted drafts and inaccessible inactive stages.
- Value-first empty startup before Sources, plus distinct Settings categories for preferences and update maintenance.
- Presentation motion declarations and the reduced-motion boundary.
- Update metadata, signature validation, artifact selection, and migration coordination.
- Protected release-workflow syntax, exact permissions, action pins, authority isolation, immutable publication, provenance, and direct Pages-byte convergence.
- Version-matched public user, operations, support, security, disclaimer, manual-evaluation, readiness, release-note, policy, and locale documentation contracts.
- Process-lifetime update cadence, non-overlap, no-burst scheduling, and typed event presentation.
- Packaging and operating-system integration where a complete UI journey is unnecessary.

### End-to-end tests

**Purpose:** prove that release-shaped desktop applications support complete user journeys.

**Primary scope:**

- Install, value-first Home, both export-acquisition paths, language selection, and empty-state guidance.
- Import through the file picker with realistic synthetic ZIP archives.
- Reimport, cumulative import, interruption, failure recovery, and persisted restart.
- Home, Explore, Reports, Sources, and Settings navigation with preserved workspace state, focus behavior, exploration, filtering, visualizations, all included controls, and accessible alternatives.
- Rendered shell geometry at broad desktop and compact widths, localized current-location semantics, and absence of page-level horizontal overflow at 100% and 200% content zoom.
- Full-history training discovery with combined filters, deterministic sorting, coherent forward and backward pagination, source-separated calendar traversal, two-through-four-session comparison, exact chronology or calendar return, complete restart restoration, library-change recovery, exact results, and lightweight detail.
- Explicit traversal among Sessions, Sports, and Compare periods and among every session evidence section, proving that hidden views are inaccessible while their disposable state survives temporary navigation.
- Explicit traversal between history and comparison in every other explorer, including preserved comparison input and results, exact-detail return, cross-explorer entry, and inaccessible hidden views.
- Explicit traversal among report Library, Compose, and Preview, including preserved drafts, saved-report selection, independent review replacement, complete block manipulation, source return, and export.
- Explicit traversal between Appearance & language and Updates, including a preserved unsaved preview, hidden inactive content, continuous update discovery, save, reset, restart, and discard-on-exit behavior.
- `en-US` and `es-ES` behavior, including text expansion and locale-aware formatting.
- Update availability, postponement, download, verification, installation, migration, and recovery.
- Removal behavior and explicit treatment of the user's data library.

E2E tests verify persisted outcomes and recovered state, not only visible controls.

## Fixture strategy

Synthetic fixtures will be generated from the explicitly documented [`testing/synthetic-import-scenarios.md`](testing/synthetic-import-scenarios.md) contract. The fixture catalog will include:

- Minimal valid exports for each supported file family and historical variant.
- Multiple related records and high-resolution samples at bounded test sizes.
- Exact duplicate archives and logically equivalent exports with different file identities.
- Older and newer overlapping exports, amended entities, and deterministic conflicts.
- Unknown file families, unknown fields, unsupported versions, malformed JSON, unsafe paths, decompression-limit violations, and interrupted streams.
- Empty, partial, and internally inconsistent exports.
- Database baselines for every supported migration path.

Large-scale performance fixtures will be generated during the test and excluded from version control.

## Execution layers

The concrete commands will be selected with the technology stack. The required execution model is:

1. **Developer fast loop:** formatting, static analysis, architecture rules, unit tests, and focused integration tests.
2. **Pull-request gate:** all unit tests, integration tests, documentation and localization validation, security checks, and a focused E2E journey set.
3. **Main-branch confidence:** broader E2E, migration, import-compatibility, and performance scenarios.
4. **Release gate:** signed release-shaped packages, clean installation, platform E2E matrix, supported-version upgrades, failed-update recovery, and removal.

Local and continuous-integration workflows will invoke the same underlying commands.

### Continuous-integration distribution

- GitHub Actions runs impact classification, documentation links, public documentation contracts, and repository safety for every pull request and `main` revision. README, canonical product-status, and static product-page changes run their SSOT, resource, release-state, and accessibility checks without invalidating unchanged executable evidence. A closed documentation-only allowlist may reuse evidence only when an immutable marker proves that the exact executable-input Git-tree fingerprint already passed both complete lanes; missing evidence and any other or unknown path run the complete portable checks.
- A mandatory macOS job prepares the source-bound production package, enforces its process-to-painted-shell cold-launch budget, then builds the instrumented Tauri package under an isolated target and executes the focused packaged E2E journey with independently generated synthetic fixtures whenever executable or release inputs change and for every explicit manual or release-candidate verification request. The tested WebdriverIO configuration rejects the production executable path. The packaged journey resizes the real WebView across the accepted desktop and compact boundaries and measures sidebar, workspace, current-location, localization, zoom, and overflow behavior rather than inferring layout from component presence.
- The same macOS job generates an ephemeral HTTPS authority and Minisign key, builds synthetic 0.1.0 and 0.2.0 applications, and proves both native replacement with candidate confirmation and rejected-candidate recovery to the exact previous application/library pair.
- Test-only WebDriver plugins and capabilities are feature-gated. A separate packaging assertion proves that they are absent from the production application.
- The instrumented presentation replaces only operating-system interaction boundaries that cannot be driven
  reliably through the embedded WebView: archive selection, explicit official-link opening, and report export
  destination selection. Each adapter uses the WebdriverIO mock registry while preserving its complete options
  and result contract. Tests synchronize on the recorded invocation before asserting cancellation, selection,
  or output; unchanged UI state is not accepted as evidence that an operating-system action completed.
- The feature-gated host holds each instrumented report export for a bounded test-only interval, or until cancellation,
  before entering the unchanged application use case. This makes the packaged cancellation action deterministic
  while retaining the real coordinator, cancellation token, report resolution, output adapter, and cleanup path.
  Production builds contain neither the hold nor the WebDriver capability.
- The functional journey and the full-scale Insights campaign run as separate packaged application processes with distinct generated SQLite libraries. Changing an environment variable inside an active WebDriver session is not isolation evidence; no scenario may inherit canonical history, preferences, or workspace state from another scenario.
- Axe runs in its single-context legacy mode because the embedded macOS driver does not support the auxiliary browser window used by Axe's multi-context algorithm. The rule engine and violation assertions remain enabled.
- Privacy-safe failure reports, logs, and screenshots are retained as short-lived workflow artifacts. Application libraries, private paths, real exports, and derived personal values are never uploaded.
- The packaged E2E gate remains failed or pending until it succeeds in automation; inability to execute it in a local host is not accepted evidence.

The packaged update journey runs through `npm run verify:update-e2e`. It serves schema-validated metadata and a signed updater archive from a loopback HTTPS endpoint, adds its single ephemeral certificate authority only to the feature-gated test clients, and allocates a distinct embedded-WebDriver port and isolated application/library/recovery root per scenario. Home navigation uses the same verified helper as the complete packaged journey: each physical click must make the requested action current, and one bounded repeat covers the macOS activation click without accepting a navigation that never occurred. The success path must leave the installed bundle at 0.2.0 with an `updated` receipt and no active or attempt state. The failure path deliberately rejects the replacement after its process-bound startup gate and must leave the installed bundle at 0.1.0 with a `recovered` receipt, no active or attempt state, and no failed candidate after its identity is revalidated. Both paths verify SQLite integrity, retained locale, the localized terminal notice, absence of a private recovery identifier, and receipt removal only after explicit acknowledgement. Keys, certificates, packages, databases, logs, and screenshots are generated only under ignored `.artifacts/update-e2e`; CI retains only the privacy-safe evidence directory when the job fails.

Recurring discovery is split at its real boundary without waiting a day in CI. Paused-time host tests prove the exact production interval, first and subsequent 24-hour waits, and the absence of catch-up bursts; coordinator tests prove an occupied update operation is skipped. React tests drive the exact typed desktop event and prove that attention states become visible while unconfigured, offline, current, dismissed, and postponed results retain scheduled-policy silence. The architecture check binds both sides to the same event name. The production capability manifest includes Tauri's event listener permission, and the production-bundle gate proves no test capability is required or retained.

## Failure policy

- Diagnose failures to their root cause before changing production or test code.
- Preserve the behavior originally protected by a test when adapting it to structural changes.
- Treat flaky tests as defects. Record ownership, reproduce the timing or state dependency, and correct the cause.
- Quarantine is permitted only as a visible, time-bounded safety measure with an owner and restoration criterion; it cannot make a required quality gate appear healthy.
- Do not accept release artifacts when a required platform, migration, or E2E path is unverified.
- Treat clean installation and every supported update path as release blockers, including deliberately interrupted installation and migration scenarios.
- Verify that every failed update leaves a usable previous version or completes the documented automated recovery path without data loss.
- Keep unsigned macOS MVP alpha artifacts out of public release tests and channels; validate the first public macOS release with Developer ID, notarization, Gatekeeper, installation, and update E2E paths.

## Pending decisions

- Linux and Windows E2E runner distribution when those platforms enter implementation.
- Periodic review of performance budgets and maintained execution environments.
- Accessibility conformance tooling and manual audit cadence.
- Hosted-runner migration before the maintained macOS 15 image is retired.
- Mutation-testing policy for critical domain rules.
- Package update evidence for every application baseline declared by the release-bound upgrade matrix when a real predecessor exists. The first 0.1.0 matrix has no application baseline.
- Direct open, atomic interruption rollback, retry, integrity, and target-version evidence for every library schema declared by that matrix.
