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
- Keep exhaustive campaign watchdogs separate from bounded operation waits and product-performance budgets; extending a campaign cannot make a stalled operation or slow interaction pass.
- Automated verification owns functional correctness. Product-owner review is a bounded experience evaluation, not a
  manual regression suite: it supplies comprehension, trust, usefulness, and quality evidence that automation cannot
  establish. Any functional failure observed there identifies a missing automated regression and must return to the
  appropriate unit, integration, contract, packaged E2E, restart, installation, update, or recovery gate.

## Test levels

### Unit tests

**Purpose:** prove domain behavior and application decisions quickly and precisely.

**Primary scope:**

- Entities, value objects, aggregates, and domain services.
- Logical identity, reconciliation, conflict rules, and idempotency.
- Calculations, time ranges, units, locale-independent semantics, and classifications.
- Format-version selection and normalized error models.
- Use-case orchestration through test-controlled ports.
- Revision-coherent personal-range summaries over exact exercise, route, and signal coordinates, including
  non-interpolation, half-open signal aggregation, bounded gaps, unavailable alignment, and dense streamed
  evidence.

**Excluded:** concrete databases, ZIP readers, JSON libraries, operating-system APIs, update services, and graphical interfaces.

### Integration tests

**Purpose:** prove concrete adapters and contracts against real supporting technology.

**Primary scope:**

- ZIP validation, safe extraction or streaming, JSON parsing, and schema variants.
- Anti-corruption mapping from Polar Flow structures to domain inputs.
- Database constraints, transactions, migrations, queries, rollback, and restart behavior.
- Import fingerprints, provenance, overlap reconciliation, and retry behavior.
- Package-identity, provider-compatibility, malformed-content, safety, and resource-limit classification with
  complete member scanning; source-file and canonical-item progress; delayed-progress explanation; and
  cancellation rollback before the atomic commit boundary.
- Range-summary composition from real SQLite route, signal, source-lap, review-required, reimported, and stale
  revision evidence without moving calculation or cross-coordinate alignment into persistence.
- Localization catalogs, placeholders, plural rules, and fallback.
- Production presentation reachability, locale-message consumption, CSS ownership, automation entry points,
  and packaged-test registration, with explicit typed handling for dynamic dictionaries and generated class
  families. The same contract scan rejects production `Intl` constructors outside the named shared
  presentation-format boundary.
- Versioned source-acquisition guide validation, adapter ownership, exact locale selection, and least-privilege official-link capabilities.
- Application-shell structure, semantic sidebar ownership, broad desktop workspace, compact navigation rail, and initial-window presentation contracts.
- Training workspace and session-detail navigation, semantic current-location state, focused reveal below persistent navigation, enforced progressive-disclosure boundaries, and the single route → signal → structure → zone evidence-layout matrix for complete, partial, unsupported-only, and summary-only stories.
- Conditional route-signal composition for one through four independently scaled lanes over only an
  application-authorized route elapsed coordinate, including pace `M:SS` formatting, nulls and source gaps,
  stable full-domain selection, shared map movement, absence without alignment, exact-sample disclosure only
  from supplied overlay ordinals, one native accessible position alternative, high-zoom sizing, and in-place chart
  updates rather than renderer replacement.
- Route-relative map zoom derives from the complete-track fit, retains a bounded useful context, caps unsupported
  GPS detail, handles single-point and degenerate geometry, recalculates after resize, and exposes one localized
  relative state. Component and packaged WebView tests prove identical limits for buttons, keyboard, and the
  underlying Leaflet viewport, plus a minimum visible route extent at the lowest permitted level.
- History starts with visible chronological results while its complete sport index is closed. Deliberate opening
  retains every sport identity and contextual classification action; choosing a sport closes the index, exposes the
  exact applied refinement, and focuses its result count without a second discovery contract.
- Shared production-table naming, distinct nested scroll-region labels, keyboard-scroll boundaries, explicit
  numeric-column semantics, and closed-by-default segment and zone tables without row-level attribution
  duplication. Report exact tables derive distinct names from their analytical block and source, so repeated
  evidence never creates duplicate table or scroll-region landmarks. The UI contract rejects direct production
  `<table>` ownership outside `DataTable` and CSS that assigns table alignment from first, last, or ordinal column
  position.
- Personal-range creation, selection, exact elapsed validation, rename, immutable-coordinate adjustment, legacy anchoring, reimport review, optimistic-conflict draft retention, guarded removal, remount restoration, accessible signal-chart range descriptions, concise summary disclosure, both locales, and opaque-capability exclusion.
- Shared activity, sleep, recovery, and aligned-history workspace navigation, current-location state, exact-detail
  replacement, and progressive-disclosure boundaries. Activity retains its visual and day actions while its exact
  table is closed, then reveals the same gap-aware rows without another application query and remains coherent
  through locale and range changes. Its period form follows the answer, opens deliberately, retains the current
  answer during a pending operation, and closes after a successful replacement while focus returns to the Activity
  heading instead of remaining in hidden controls.
- Shared focus-settling behavior, including restoration after a reveal, surrender after an explicit focus change,
  and the transient case in which that new control disappears before the next scheduled settling check.
- Sleep and recovery select singular or plural night units through the shared locale boundary for conclusions and
  exact coverage. Both locales protect one-night and multiple-night evidence rather than accepting a fixed plural.
- Compact sport classification measures are asserted across the 40-combination locale, appearance, viewport, and
  zoom matrix. The open native disclosure, editor, fields, preview, and actions must occupy the available WebKit
  width without min-content collapse, clipping, or one-character-per-line copy.
- Report Library, Compose, Preview, stale-evidence review, and export-review boundaries, including preserved mounted drafts and inaccessible inactive stages.
- Value-first empty startup before Sources, plus one persistently mounted Settings workspace with distinct preference and update categories, a concrete preference preview, and one continuous update lifecycle.
- Ordered same-process Home publication across deferred startup, mapping-aware reimport, and sport-classification refreshes, including suppression of stale exploration destinations and a Sessions request that settles after deliberate entry.
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
- Home, History, Reports, Sources, and Settings navigation with independent scroll restoration, preserved workspace state, visible labels at compact widths and high zoom, focus behavior, exploration, filtering, visualizations, all included controls, and accessible alternatives.
- Sources ready, guide, active, changed, repeated, rejected, failed, and cancelled states; filename-only archive identity; active-task dominance; local picker/link recovery; distinct terminal reasons; closed-by-default exact coverage; result actions; and unchanged-library guarantees.
- Rendered shell geometry at broad desktop and compact widths, localized current-location semantics, route
  workbench, map, independent-signal reveals, conditional exact-relationship lanes, and absence of page-level
  horizontal overflow at 100% and 200% content zoom. The packaged performance journey fixes a 1024-by-720
  logical window before its maximum-range 200% checks so layout evidence is independent of the host display size.
  The packaged functional journey similarly fixes a 1280-by-720 logical window before its localized maximum-zoom
  report-library check and uses the production reveal margin as the single persistent-navigation offset.
- A packaged 20,001-point route accompanied by four independent 20,001-slot signals: the current unavailable-alignment contract requires bounded local route rendering without an invented overlay or attached signal lane, alternating first/last map selection, truthful source-ordinal labels, focused retrieval of the exact final route row, deliberate transition to the independent signal destination, four-lane cross-signal selection, and exact signal pagination under explicit interaction budgets.
- Full-history training discovery with combined filters, deterministic sorting, coherent forward and backward pagination, source-separated calendar traversal, two-through-four-session comparison, exact chronology or calendar return, complete application-process restart restoration, library-change recovery, exact results, and lightweight detail.
- Explicit traversal among Sessions, Sports, and Compare periods and among every session evidence section, proving that hidden views are inaccessible while their disposable state survives temporary navigation.
- Evidence-adaptive session leadership for routed, signal-only, structure-only, zone-only, and summary-only sessions, including a closed-by-default complete evidence account, deliberate evidence reveal, exact-detail focus, missing-versus-zero aggregates, both locales, compact width, 200% zoom, and restart.
- Unsupported signal and zone counts remain in that complete session account. Section-specific compatibility
  explanations start closed, remain keyboard and assistive-technology reachable, and reveal their complete text on
  request without repeating warning copy across the primary visual composition.
- Personal-range creation, cancellation, validation, reopening, renaming, exact-timeline boundary adjustment,
  guarded removal, concise revision-coherent summary, disclosed exact evidence and limitations, reimport review,
  stale revision recovery, packaged-process restart, accessibility, adaptive layout, and dense-session response
  budgets. Direct map, independent-signal, structure, and exact-evidence entry, including overlapping and
  duplicate-name interaction, are part of the current journey.
- Signal-overview opening and deliberate fourth-lane selection are separate user interactions with independent budgets. The selection journey uses a real WebDriver click to exercise the controlled input, while an in-WebView capture listener starts measurement at the actual click and finishes after the four-lane result is laid out. Automation transport and polling are therefore excluded from the application-response measurement.
- Longitudinal-chart coverage verifies four independently scaled labelled lanes over one exact local-date coordinate, source separation, locale-aware dates and durations, missing-value gaps, recorded training zero, the 366-day canvas and zoom boundary, invalid-date fail-closed behavior, high-zoom sizing, and the complete exact-table alternative. The packaged timing boundary verifies both the requested date count and first local date before accepting the laid-out result.
- Explicit traversal between history and comparison in every other explorer, including preserved comparison input and results, exact-detail return, cross-explorer entry, and inaccessible hidden views.
- Explicit traversal among report Library, Compose, and Preview, including preserved drafts, saved-report selection, independent review replacement, complete block manipulation, source return, and export.
- Explicit traversal between Appearance & language and Updates, including a concrete localized session preview, visual appearance choices, a preserved and explicitly discardable unsaved draft, hidden inactive content, visible installed version, continuous update discovery, save, reset, restart, and discard-on-exit behavior.
- `en-US` and `es-ES` behavior, including text expansion and locale-aware formatting.
- Update availability, postponement, download, verification, installation, migration, and recovery.
- Removal behavior and explicit treatment of the user's data library.

E2E tests verify persisted outcomes and recovered state, not only visible controls.

## Fixture strategy

Synthetic fixtures will be generated from the explicitly documented [`testing/synthetic-import-scenarios.md`](testing/synthetic-import-scenarios.md) contract. The fixture catalog will include:

- Minimal valid exports for each supported file family and historical variant.
- Multiple related records and high-resolution samples at bounded test sizes.
- A long multi-session history with dense supported routes and signals, exact gaps, and a bounded current-schema storage envelope.
- Exact duplicate archives and logically equivalent exports with different file identities.
- Older and newer overlapping exports, amended entities, and deterministic conflicts.
- Unrelated ZIPs, provider-shaped unsupported layouts and versions, unknown file families, unknown fields, malformed current content, unsafe paths, decompression-limit violations, and interrupted streams.
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

- GitHub Actions runs impact classification, documentation links, public documentation contracts, and repository safety for every pull request and `main` revision. README, canonical product-status, static product-page, and the closed publication-only compositor, verifier, test, and Pages-workflow set run their SSOT, resource, release-state, accessibility, publication, composition, and update-preservation checks without invalidating unchanged application-package evidence. A closed non-application allowlist may reuse evidence only when an immutable marker proves that the exact executable-input Git-tree fingerprint already passed both complete lanes; missing evidence and any application, shared dependency, release-candidate, or unknown path run the complete portable checks.
- A mandatory macOS job prepares the source-bound production package, enforces its process-to-painted-shell cold-launch budget, then qualifies full-scale import, dense supported-signal storage and queries, and longitudinal read models before building the instrumented Tauri application under an isolated target and executing the focused packaged E2E journey with independently generated synthetic fixtures whenever executable or release inputs change and for every explicit manual or release-candidate verification request. The E2E build produces only the `.app` consumed by WebdriverIO; an instrumented DMG adds no behavioral evidence, while the separate production package and installation gates retain complete DMG coverage. The tested WebdriverIO configuration rejects the production executable path. The ordinary functional instrumented application has the stable `org.fitfreed.desktop.e2e` bundle identifier, distinct from the production identifier, so macOS can retain a dedicated Desktop assignment across rebuilds. The synthetic update packages instead obtain the canonical production identifier from `tauri.conf.json`: update recovery deliberately rejects any other application identity, and the update campaign must exercise that production security boundary while retaining its package, library, and process isolation. The packaged journey resizes the real WebView across the accepted desktop and compact boundaries and measures sidebar, workspace, current-location, localization, zoom, and overflow behavior rather than inferring layout from component presence.
- The same macOS job generates an ephemeral HTTPS authority and Minisign key, builds synthetic 0.1.0 and 0.2.0 applications, and proves both native replacement with candidate confirmation and rejected-candidate recovery to the exact previous application/library pair.
- The complete macOS campaign has a 75-minute job limit. This is a bounded orchestration allowance for the measured sequence of independent package, performance, functional, replacement, and recovery gates; each operation and scenario keeps its narrower watchdog and product budget. The workflow contract prevents the campaign limit from silently returning to the 60-minute boundary that cancelled a healthy final update scenario after every preceding gate had passed.
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
- The functional journey and its restart-verification continuation run as two separate packaged application processes against the same uniquely generated SQLite library. The first process records its exact identity only after durable state is ready; the second must have a different identity and recover that state through the normal startup path. Evidence-adaptive session composition runs in a third process with its own generated library and archive. The full-scale Insights campaign runs in a fourth process with another distinct generated library. A WebDriver session replacement or an environment-variable change inside an active process is neither restart nor isolation evidence.
- Component coverage drives native keyboard activation through contextual-create and saved-edit cancellation
  and checks focus return to the exact source or restored result. The packaged journey crosses cancellation,
  privacy review, and evidence review through the embedded driver's native activation command; leaves and returns
  to a running import through the shell; opens complete Sessions and Sports evidence from positive Home aggregates;
  and checks focus return to the exact source, result, summary, or initiating action. It also runs Axe plus overflow and hierarchy
  assertions on Library, Preview, refresh review, and export review in English and Spanish, light and dark
  appearance, and ordinary and 200% content zoom. The read-model benchmark separately enforces the maximum
  bounded report-library page and complete atomic self-contained HTML export budgets.
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
