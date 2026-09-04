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
- Changed-container equivalent reimport proves that only the latest state-changing artifact provenance can bypass
  redundant training reconstruction; different evidence or adapter or mapping versions retain complete remapping.
- Every synchronous Tauri command that opens SQLite carries the framework's asynchronous-dispatch annotation, so
  application queries and mutations do not execute on the main invoke thread.
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
- Personal-range creation, selection, exact elapsed validation, rename, immutable-coordinate adjustment, legacy anchoring, reimport review, optimistic-conflict draft retention, guarded removal, remount restoration, accessible signal-chart range descriptions, concise summary disclosure, both locales, and opaque-capability exclusion. Route-preview scheduling tests issue a rapid boundary burst while one exact query remains unresolved and require one active request plus only the latest pending pair. The packaged dense-route journey continuously moves both native range controls across 20,001 exact points, waits for the final complete-route preview, cancels, and proves the next route interaction remains responsive.
- Analytical-chart zoom tests hover and drag both rendered ECharts slider handles through sustained message-channel-separated mouse input at zrender's stable SVG or canvas viewport root in single-series SVG, default multi-lane SVG, and maximum four-lane canvas charts. They require each handle's observed visual position to move by at least 20 logical pixels and the session workspace to remain responsive; renderer fingerprints, configuration, or control presence are insufficient because hover emphasis and delayed reconciliation can change a renderer without changing its range. Viewport-targeted events preserve renderer-relative coordinates while exercising zrender's own hit-test and drag lifecycle. They must not retain a child shape or replaceable SVG/canvas content element as their target, or depend on animation-frame visibility. Tauri WebDriver mouse moves currently lose the pressed-button state and can expose child-relative coordinates that zrender cannot interpret, so WebDriver Actions are not admissible evidence for this interaction until that boundary is verified independently. The chart contract keeps slider `realtime` processing disabled: the handle follows sustained input, while the analytical range and series are recalculated once when the user releases it.
- The slider-handle oracle resolves the exact active application accent rather than accepting generic green pixels.
  Both the normal and pointer-emphasized ECharts states must preserve that accent and border, so an observed handle
  remains the same themed control before and after a drag instead of becoming timing-dependent test evidence.
- The completed ECharts `dataZoom` action must synchronously flush zrender exactly once. A lifecycle unit test protects
  that adapter boundary, while the packaged handle-position oracle proves its user-visible result when an occluded
  embedded WebView suspends animation-frame callbacks. The flush occurs after release and cannot reintroduce
  per-movement analytical recalculation.
- Shared activity, sleep, recovery, and aligned-history workspace navigation, current-location state, exact-detail
  replacement, and progressive-disclosure boundaries. Activity retains its visual and day actions while its exact
  table is closed, then reveals the same gap-aware rows without another application query and remains coherent
  through locale and range changes. Its period form follows the answer, opens deliberately, retains the current
  answer during a pending operation, and closes after a successful replacement while focus returns to the Activity
  heading instead of remaining in hidden controls.
- Shared focus-settling behavior, including restoration after a reveal, surrender after an explicit focus change,
  the transient case in which that new control disappears before the next scheduled settling check, and cleanup
  through the initiating element's captured document after an owning view or test DOM is disposed.
- Sleep and recovery select singular or plural night units through the shared locale boundary for conclusions and
  exact coverage. Both locales protect one-night and multiple-night evidence rather than accepting a fixed plural.
- Compact sport classification measures are asserted across the 40-combination locale, appearance, viewport, and
  zoom matrix. The open native disclosure, editor, fields, preview, and actions must occupy the available WebKit
  width without min-content collapse, clipping, or one-character-per-line copy.
- Closed sport-card composition has its own 40-combination locale, appearance, viewport, and zoom matrix. It verifies
  a contained overview heading and localized count, complete word-readable identities, an independent wrapping action
  row, one-column compact and 150%–200% layouts, contained cards and controls, persistent-navigation reveal,
  accessibility, and no page-level horizontal overflow. From 150% content zoom, the overview heading and count form
  separate rows so neither competes with the sport cards for minimum inline space.
  A native resize is ready only after the WebView width remains unchanged and within the platform allowance for three
  consecutive observations. Geometry failures record the viewport, document width, and overflowing element classes
  without retaining rendered text or user data.
- The dense-history gate imports a byte-distinct but logically equivalent archive into an existing 7,490,080-sample
  library, proves that it did not use exact-package reuse, and measures 20 Library Home and first-page History queries
  while the final fifth of reconciliation remains active. The changed-package duration and both interactive p95
  measurements retain their independent budgets alongside all existing fresh-import, exact-repeat, storage, and
  post-import query budgets.
- Report Library, Compose, Preview, stale-evidence review, and export-review boundaries, including preserved mounted drafts and inaccessible inactive stages.
- Value-first empty startup before Sources, plus one persistently mounted Settings workspace with distinct preference and update categories, a concrete preference preview, and one continuous update lifecycle.
- Ordered same-process Home publication across deferred startup, mapping-aware reimport, and sport-classification refreshes, including suppression of stale exploration destinations and a Sessions request that settles after deliberate entry.
- Presentation motion declarations and the reduced-motion boundary.
- Update metadata, signature validation, artifact selection, and migration coordination.
- Protected release-workflow syntax, exact permissions, action pins, authority isolation, immutable publication, provenance, and direct Pages-byte convergence.
- Version-matched public user, operations, support, security, disclaimer, product-owner experience, readiness, release-note, policy, and locale documentation contracts.
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
- Every in-WebView interaction measurement waits for its exact complete control set before starting the browser clock. A visible workspace container is not readiness evidence for asynchronously composed filters, comparisons, or report editors; their required controls remain asserted rather than treated as optional.
- Component journeys follow the same readiness boundary: a synchronously rendered workspace container or heading does
  not prove that its asynchronous result is available. Before inspecting or activating result-owned controls, tests
  wait for one exact result-owned element and retain every subsequent behavior assertion. When a durable collection
  has a known expected cardinality, the test waits for that complete cardinality before retaining element handles;
  an empty collection observed while its query is still pending is not persistence evidence.
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

- GitHub Actions runs impact classification, documentation links, public documentation contracts, and repository safety for every pull request and `main` revision. README, canonical product-status, static product-page, and the closed publication-only compositor, verifier, test, and Pages-workflow set run their SSOT, resource, release-state, accessibility, publication, composition, and update-preservation checks without invalidating unchanged application-package evidence. A closed non-application allowlist may reuse evidence only when an immutable marker proves that the exact executable-input Git-tree fingerprint already passed every admitted complete lane; missing evidence and any application, shared dependency, release-candidate, or unknown path run the complete portable checks plus complete Rust workspace and desktop-host tests and strict linting on pinned Ubuntu 24.04.
- A pinned `windows-2025` x86-64 job independently runs the portable contracts, presentation suite and build, Rust
  formatting, workspace and pinned-updater tests, strict Clippy, and the release-shaped unsigned NSIS build. It then
  performs one real current-user installation, identity inspection, complete installed-file inventory, removal, and
  application-data preservation check. It then creates a non-exportable synthetic code-signing certificate, signs only
  a temporary copy of the already built release executable, verifies that signature through the same fail-closed
  signing and independent Windows-policy inspection adapters, and requires complete certificate, private-key, trust,
  environment, and temporary-file cleanup plus an unchanged source digest.
  Only a valid `windows-2025-x86_64-host-package` marker bound to the current executable-input fingerprint can reuse
  that evidence; missing or invalid evidence runs the job. Static workflow tests reject Unix-only commands, mutable
  actions, elevated permissions, protected secrets, incomplete completion dependencies, and evidence written before
  every required Windows check passes. This hosted Windows Server lane is native portability, engineering-package,
  and synthetic Authenticode-orchestration evidence, not public timestamped signing, signed Windows 11, desktop,
  accessibility, or product-acceptance evidence.
- The Windows package-configuration contract independently rejects MSI or mixed target sets, Windows on ARM,
  per-machine installation, network-dependent WebView2 acquisition, missing installer locales, generic ZIP file
  association, unreviewed NSIS customization, and signing authority in the versioned overlay. The Windows-only build
  wrapper accepts only diagnostic verbosity and invokes the shared production build with NSIS as its sole bundle. The
  native adapter accepts exactly one version-derived setup, refuses non-clean profiles, verifies package and executable
  metadata, current-user placement, Add or Remove Programs values, canonical shortcuts, WebView2 availability, and
  deliberately unsigned engineering signatures. It rejects reparse points, hashes every installed file under a safe
  relative path, validates the complete versioned inventory, and writes it atomically beside the exact setup. Real
  removal must erase package-owned state while retaining canonical application data. This evidence does not claim
  public trust. The separate public signing overlay contains no authority and must be explicitly selected only inside a
  protected candidate build. Its adapter accepts authority solely through the process environment, signs with SHA-256,
  suppresses native output, and invokes an independent inspector that requires exact signer fingerprint, public
  timestamp, Windows application-policy trust, unchanged digest, x86-64 architecture, and exact FitFreed identity.
  The protected expansion-input contract requires public Authenticode authority, rejects updater private-key authority,
  embeds only active public updater trust, rejects stale or extra NSIS output, and reinspects the final setup after
  packaging. Preparation then proves the public-profile native installation and data-preserving removal, atomically
  stages only the exact setup, inventory, and source-bound build evidence, and rejects extra entries, links, identity or
  digest drift, mismatched certificate trust, and changed updater trust. The later compositor independently signs those
  sealed bytes for the updater. Transport tests use the real compressed-tar adapter to prove the closed three-entry
  set, native line-ending handling, exact digest reopening, atomic visibility, mutation rejection, and cleanup after a
  certificate mismatch.
  Release-contract tests require manifest version 7 to contain newly built macOS, Linux, and Windows targets in order;
  bind the NSIS package, inventory, build evidence, Authenticode declaration, updater signature, checksums, and
  provenance; and reject a narrowed earlier-platform set. Stable-channel tests likewise reject Windows without both
  existing targets and prove its exact version-derived setup URL and bytes in the atomic Pages snapshot.
  Complete-candidate reopening tests independently construct the release and reject Windows package, inventory, native
  build, source revision, storage schema, Authenticode certificate, updater signature, checksum, release signature,
  recovery, file-set, and Pages drift. The same tests preserve version 6 behavior through the shared reopening kernel.
  Composition tests prove exact Authenticode-admitted setup bytes reach the updater signer, all three current packages
  and both native predecessor packages reach Pages, mixed Windows trust is rejected before staging, every detached
  signer is mandatory, failed staging is removed, and an existing candidate destination is never replaced.
  Public installation evidence is accepted only when the setup and installed executable pass full identity inspection,
  the uninstaller passes signature-policy inspection, and all three observed trust digests equal their independently
  recorded package or installed-file digests before a verified data-preserving removal.
- Windows recovery-adapter unit tests run on the portable Rust test path with synthetic native ports. They require the
  fixed current-user NSIS registration and critical-file identity, fixed recovery-owned candidate and predecessor
  package paths, silent installer invocation, and distinct failures for an installer that fails and an installer that
  succeeds but leaves an unreadable or wrong-version identity. They also require process creation-time and
  canonical-path binding, refusal to terminate a reused PID, and byte equality between the recovered installed
  application and uninstaller and the preserved runnable image. The pinned native Windows lane remains authoritative
  for the real known-folder, Registry, reparse-point, process-handle, wait, and termination APIs; non-Windows source
  tests cannot substitute for that execution evidence.
- Windows recovery-package unit tests require strictly ordered semantic versions, exact package size and SHA-256,
  x86-64 PE product and version identity, agreement with the installed predecessor, no-clobber preservation, a bounded
  complete non-reparse runnable tree with safe Windows names, deterministic tree hashing, reopening, mutation
  detection, and removal of only partially created assets. Native Windows execution remains authoritative for version
  resources, installed-directory semantics, file sharing, and reparse attributes.
- Windows recovery-contract tests validate schema version 3 independently from the closed macOS and Linux formats.
  They require one current-user x86-64 NSIS identity, canonical package and runnable paths, lossless process creation
  `FILETIME`, consistent native directories, exact source and target version relationships, credential-free immutable
  URLs, digest binding, phase-shaped process evidence, bounded native-recovery attempts, and only the documented
  lifecycle transitions.
- Windows recovery-state preparation tests create a current-schema synthetic library and exact native identity, then
  require both authenticated package expectations, the complete runnable predecessor, a verified online SQLite
  backup, the closed version 3 manifest, private lock files, and the no-clobber active pointer to reopen as one attempt.
  They reject authorization drift before filesystem mutation, concurrent outcome ownership, redirected roots or lock
  files, a second active attempt, and later package, runnable, library, or manifest mutation. State-transition tests
  require serialized legal phase changes, prohibit generic entry into `launching`, bind that phase to the exact PID,
  creation `FILETIME`, canonical installed executable, nonce, and deadline, and prove rejected process evidence does
  not mutate the durable phase. Watchdog tests derive authority only from the exact preserved executable and active
  attempt. Lease tests permit one watchdog and one candidate, require exact process, nonce, and installed target
  identity for the latter, release ownership on drop, and keep held no-sharing lock files out of reopening checks. An
  exact candidate-confirmation test requires the held lease, native target, running version, target library schema,
  fixed library and SQLite integrity, while rejected evidence preserves `launching`. Restoration tests require all
  three ownership boundaries, recover both an existing and absent fixed library from exact SQLite backup bytes, invoke
  the source package and identity only, persist the two closed failure reasons, retain retries after attempts one and
  two, and make attempt three terminal. Restart-authority tests derive the active context without presentation-owned
  identifiers or paths. Retry tests require an available watchdog boundary before returning to `recovering`, preserve
  the completed attempt count in the intervention, and allow only the matching leased retry to be cancelled. Discard
  tests remove an exact `prepared` attempt under all four ownership boundaries and preserve every attempt after
  replacement begins. An isolated Windows-target source build checks the no-sharing handle, reparse-aware file access,
  and restoration compilation path; only the pinned native Windows job can prove the corresponding operating-system
  behavior.
- The Ubuntu 24.04 lane then builds the source-bound Debian package through the same Linux-only command documented for contributors and extracts it for inspection. The gate rejects any drift in the external `FitFreed_<version>_amd64.deb` artifact name, internal `fitfreed` package identity, architecture, version, homepage, section, priority, mandatory GTK and WebKitGTK dependencies, executable permissions, `usr/share/applications/fitfreed.desktop` path, visible `FitFreed` launcher name, icons, or installed GPL text. It also proves that the wrapper changed only Tauri's generated filesystem name rather than reconstructing signed package bytes. It generates a schema-validated, digest-bound, complete extracted-layout inventory from those exact package bytes and proves deterministic ordering, safe relative links, and atomic evidence replacement. It next mounts only the package into a digest-pinned clean Ubuntu 24.04 image that has no development toolchain, installs repository dependencies, verifies dynamic linking and package-manager identity, purges the package, and verifies package-owned removal. The unsigned engineering package and inventory are not uploaded as public workflow artifacts.
- A separate Ubuntu 24.04 capability job builds an instrumented Debian package with the isolated technical
  `fitfreed-e2e` product and package name, `/usr/bin/fitfreed-e2e` executable, and `org.fitfreed.desktop.e2e`
  application identity. It refuses
  any pre-existing test installation, verifies the generated package metadata and executable entry, installs that
  exact package, and runs the same seven WebdriverIO functional, restart, adaptive-session, sport-catalogue, and
  performance scenarios as macOS under Xvfb. Purge must remove the test package and executable without deleting any
  synthetic journey library; successful data is then discarded, while CI may retain only privacy-safe failure logs
  and screenshots. The job is required before an executable fingerprint receives reusable complete-verification
  evidence and is skipped only when that exact fingerprint already has such evidence. Package inspection normalizes
  only the optional leading `./` used by some `dpkg-deb` versions when presenting relative paths; the package name,
  architecture, version, exact executable path, and executable mode remain independent fail-closed checks whose
  diagnostics identify the violated contract.
- The manual complete-platform publication workflow independently admits the already sealed manifest version 6
  candidate on hosted x86-64 Ubuntu 24.04 and 26.04 before promotion can reach its second approval. Each secret-free
  row verifies the transport digest and complete candidate, installs only the manifest-declared Debian artifact,
  verifies package identity, executable and resource paths, dynamic linking, graphical first launch into an isolated
  `0700`/`0600` library with the manifest-declared schema, and the production cold-launch budget, then purges
  package-owned paths while retaining an integral library. Unconditional cleanup removes residual package state after
  failures but cannot convert a failed row into acceptance. These exact-candidate checks complement, rather than
  replace, the same-revision instrumented
  capability, update/recovery, accessibility, localization, and data-performance evidence.
- The explicit Linux performance admission workflow builds and verifies the source-bound production Debian package,
  installs it, measures 100 fresh interactive-shell processes under Xvfb, and always purges it before running the
  production full-scale import, exact and equivalent reimport, dense-history, concurrent-navigation, Insights,
  report-resolution, and export read-model campaigns on
  Ubuntu 24.04 x86-64. It is dispatched for an exact changed performance input or candidate and has no push, pull
  request, or schedule trigger, so an unchanged multi-gigabyte campaign is not repeated. Linux `ru_maxrss` is
  interpreted as kibibytes and macOS `ru_maxrss` as bytes before both enter the same mebibyte budget; focused unit
  tests protect both conversions and reject unsupported hosts before execution. The same explicit workflow mounts a
  bounded 32 MiB `tmpfs` and drives a release-mode host test through actual Linux `ENOSPC`, then restores capacity,
  runs normal startup recovery, verifies SQLite integrity and unchanged committed history, and retries successfully.
  A shell trap always unmounts the isolated filesystem; the test refuses a symbolic boundary, a missing admission
  marker, or a filesystem outside the narrow capacity range before writing its bounded filler.
- Unix host tests create and reopen the local library boundary with exact `0700` directory and `0600` file modes,
  repair broader owner-controlled modes without changing library bytes, and reject symbolic directory boundaries,
  symbolic library files, and multiply linked libraries without changing their external targets. They also prove
  corrupt SQLite bytes survive rejected startup unchanged and that a competing writer cannot alter committed history,
  after which the same import succeeds on retry. Every packaged E2E database path traverses this same adapter rather
  than a test-only filesystem shortcut.
- A mandatory macOS job prepares the source-bound production package, enforces its process-to-painted-shell cold-launch budget, then qualifies full-scale import, dense supported-signal storage and queries, and longitudinal read models before building the instrumented Tauri application under an isolated target and executing the focused packaged E2E journey with independently generated synthetic fixtures whenever executable or release inputs change and for every explicit manual or release-candidate verification request. The E2E build produces only the `.app` consumed by WebdriverIO; an instrumented DMG adds no behavioral evidence, while the separate production package and installation gates retain complete DMG coverage. The tested WebdriverIO configuration rejects the production executable path. The ordinary functional instrumented application has the stable `org.fitfreed.desktop.e2e` bundle identifier, distinct from the production identifier, so macOS can retain a dedicated Desktop assignment across rebuilds. The synthetic update packages instead obtain the canonical production identifier from `tauri.conf.json`: update recovery deliberately rejects any other application identity, and the update campaign must exercise that production security boundary while retaining its package, library, and process isolation. The packaged journey resizes the real WebView across the accepted desktop and compact boundaries and measures sidebar, workspace, current-location, localization, zoom, and overflow behavior rather than inferring layout from component presence.
- Acceptance uses `npm run verify:e2e`, which rebuilds the instrumented application before executing its journeys. A
  direct WebdriverIO invocation reuses the existing package and cannot qualify source changed since that package was
  built. Dense-detail interactions use component-scoped controls plus their localized visible labels; a global
  accessibility XPath across a large SVG is excluded because selector cost is not product-interaction latency.
- The same macOS job generates an ephemeral HTTPS authority and Minisign key, builds synthetic 0.1.0 and 0.2.0 applications, and proves both native replacement with candidate confirmation and rejected-candidate recovery to the exact previous application/library pair.
- The complete macOS campaign has a 95-minute job limit. This is a bounded orchestration allowance for the measured sequence of independent package, performance, functional, replacement, and recovery gates; each operation and scenario keeps its narrower watchdog and product budget. Exact hosted run [`33387742954`](https://github.com/purnalica/fitfreed/actions/runs/33387742954) passed the portable lane and every preceding macOS gate, then GitHub cancelled the healthy final update scenario at the former fixed 75-minute boundary after it had run for 8 minutes and 56 seconds. The current allowance provides bounded headroom for the maintained sequence without weakening a product budget, operation watchdog, security validator, or acceptance assertion. The workflow contract prevents the campaign limit from silently returning to either obsolete boundary.
- Test-only WebDriver plugins and capabilities are feature-gated. A separate packaging assertion proves that they are absent from the production application.
- The instrumented presentation replaces only operating-system interaction boundaries that cannot be driven
  reliably through the embedded WebView: archive selection, explicit official-link opening, and report export
  destination selection. Each adapter uses the WebdriverIO mock registry while preserving its complete options
  and result contract. Tests synchronize on the recorded invocation before asserting cancellation, selection,
  or output; unchanged UI state is not accepted as evidence that an operating-system action completed.
- Synchronization against transient live regions reads the complete matching renderer state in one
  `browser.execute` snapshot. It does not traverse a WebdriverIO `$$` collection across awaited element reads:
  WebdriverIO may resolve each indexed element against a later DOM, while a completed operation legitimately removes
  or replaces earlier status nodes. One shared helper preserves the exact expected text and timeout contract for every
  packaged scenario.
- The feature-gated host holds each instrumented report export for a bounded test-only interval, or until cancellation,
  before entering the unchanged application use case. This makes the packaged cancellation action deterministic
  while retaining the real coordinator, cancellation token, report resolution, output adapter, and cleanup path.
  Production builds contain neither the hold nor the WebDriver capability.
- The functional journey and its restart-verification continuation run as two separate packaged application processes against the same uniquely generated SQLite library. The first process records its exact identity only after durable state is ready; the second must have a different identity and recover that state through the normal startup path. Evidence-adaptive session composition runs in a third process with its own generated library and archive. The full-scale Insights campaign runs in a fourth process with another distinct generated library. A WebDriver session replacement or an environment-variable change inside an active process is neither restart nor isolation evidence.
- The exhaustive functional journey has a ten-minute aggregate watchdog and emits elapsed-time phase records from first shell through durable restart preparation. This allowance contains the complete bilingual, accessible, visual-evidence campaign and is independent from the narrower WebDriver command, operation, and product-performance budgets. Extending the journey cannot make a stalled operation or a slow product interaction pass.
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

Linux recovery tests protect the application-owned phase and three-attempt policy, active-manifest validation,
exclusive-watchdog transition, spawn-failure rollback, privacy-minimized host DTO, fail-closed update presentation, and
the distinction between a recovery-state read failure and an ordinary channel failure. The package-shaped campaign
runs through the self-contained `npm run verify:linux-update-e2e` entry point on native x86-64 Ubuntu. The entry point
generates Tauri's versioned icon inputs before either isolated package build. Its first scenarios install real signed
Debian packages and prove successful native replacement plus automatic rollback after either candidate rejection or a
Debian maintainer-script failure during native installation. The installer-failure package is a root-owned rebuild of
the ordinary synthetic candidate, is signed as distinct exact bytes, and fails through the real package-manager
boundary. Before either ordinary package is signed, the harness requires Tauri's exact technical
`fitfreed_<version>_amd64.deb` output and applies the production byte-preserving normalization to the canonical public
artifact name. It consumes that output into the isolated scenario package store before building the other version;
a stale display-name assumption, retained cross-version bundle output, or any extra Debian output fails before a
scenario can start.
Every terminal scenario verifies package-manager identity, SQLite integrity, locale persistence, terminal cleanup,
localized result presentation, and explicit acknowledgement. The authorization scenario permits candidate installation
but denies predecessor installation, verifies the retained first attempt and runnable fallback, grants only the same
preserved predecessor boundary, and drives the visible explicit retry to terminal recovery without network access.
A two-way completion handshake reopens the test channel only after terminal recovery and before the separate
notice-verification restart, so ordinary discovery after recovery remains outside the offline-recovery assertion
without weakening it.
The exhaustion scenario keeps that denial in place, drives the two available UI retries, verifies durable attempt
counts one through three and the classified authorization failure, then opens the preserved runnable predecessor and
requires localized manual-reinstall guidance with no retry or ordinary update action. Its evidence must retain the
active attempt, previous application, valid library, and recovery assets. The restart scenario pauses only an
instrumented build after durable `replacement-started`, stops both coordinator and watchdog, proves the phase did not
advance, and launches the installed application through its ordinary entry point. Startup must reattach exactly one
preserved watchdog, restore the predecessor pair, clean the terminal attempt, present the localized result, and remove
the receipt only after acknowledgement. The synchronization point is absent from production builds. Native Ubuntu
execution, not source inspection, is the acceptance evidence for both scenarios.

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

- Hosted Windows Server automation remains diagnostic rather than sufficient Windows 11 desktop evidence; select the
  reproducible clean Windows 11 candidate environment before the first Windows promotion.
- Reassess the hosted Ubuntu 26.04 public-preview runner before each exact candidate. If its image is unavailable or no
  longer representative of Ubuntu Desktop 26.04, use a documented clean virtualized candidate environment before
  claiming support; never silently drop that matrix row.
- Periodic review of performance budgets and maintained execution environments.
- Accessibility conformance tooling and manual audit cadence.
- Hosted-runner migration before the maintained macOS 15 image is retired.
- Mutation-testing policy for critical domain rules.
- Package update evidence for every application baseline declared by the release-bound upgrade matrix when a real predecessor exists. The first 0.1.0 matrix has no application baseline.
- Direct open, atomic interruption rollback, retry, integrity, and target-version evidence for every library schema declared by that matrix.
