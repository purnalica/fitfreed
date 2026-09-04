# Application Stack Architecture

## Status

Current architecture after [ADR 0001](decisions/0001-select-tauri-application-stack.md). This document describes dependency ownership; it does not make Tauri or React the product architecture.

## Layer ownership

| Area | Selected technology | Architectural responsibility |
|---|---|---|
| Domain | Rust without desktop, persistence, ZIP, JSON, or provider-framework dependencies | FitFreed concepts, identities, value objects, invariants, and reconciliation policy |
| Application | Rust | Use cases, input and output ports, transaction intent, progress, cancellation, and provider-neutral DTOs |
| Source and infrastructure adapters | Rust | Provider decoding, ZIP and JSON access, persistence, migrations, backup, update service, and operating-system integrations |
| Storage | Bundled SQLite through a Rust adapter | Authoritative local library, migrations, backup, indexes, and rebuildable projections |
| Desktop host | Tauri 2 | Process lifecycle, windowing, native dialogs, capabilities, command registration, packaging, and update integration |
| Presentation | TypeScript and React with semantic HTML, one Leaflet route adapter, and one lazily loaded ECharts analytical adapter | Localized interaction, accessible visualization, view state, and command invocation |

The current physical modules and compile-time boundaries are documented in the [module map](module-map.md).

## Dependency rules

- Dependencies point inward from Tauri, React, and infrastructure adapters toward application ports and the domain.
- Domain and application modules do not import Tauri, React, provider schemas, database APIs, archive APIs, or operating-system APIs.
- Tauri commands are thin inbound adapters. They validate transport input, invoke one use case, translate failures, and return serializable provider-neutral results.
- The renderer receives only the data required by a view. It never receives filesystem paths, database handles, provider JSON, or unrestricted native authority.
- Provider names and schemas remain in source adapters and compatibility documentation.
- Long-running import work executes outside the UI event path and reports explicit progress and cancellation outcomes through application ports.

## Process boundary

The initial desktop distribution uses one Tauri application process and its managed task runtime. Import use cases execute on blocking workers rather than the UI event path. Every synchronous Tauri command that opens the SQLite library is declared as an asynchronous command so Tauri dispatches it away from the main-thread invoke path; the Rust body remains a thin inbound adapter over the same application use case. This follows Tauri's documented [asynchronous-command boundary](https://v2.tauri.app/develop/calling-rust/#async-commands) and prevents ordinary Home, History, report, and preference work from blocking the WebView event loop while import owns a separate transaction. Application coordination permits one active import; adapter tests prove atomic visibility and cancellation rollback. Packaged timing, shutdown, restart recovery, and active-reconciliation navigation remain mandatory hosted-E2E gates.

Before any SQLite access, the host prepares the exact application data directory and library through the
[local library filesystem contract version 2](../data-formats/persistence/local-library-filesystem-v2.md). The adapter
creates or repairs the owner-controlled directory and file to user-only access, opens without following Unix links or
Windows reparse points, and rejects foreign ownership, non-regular objects, and multiple hard links. Unix uses exact
`0700` and `0600` modes. Windows uses protected current-user, LocalSystem, and Builtin Administrators ACLs, keeps file
validation compatible with concurrent SQLite readers and writers, and applies a bounded retry for native transient
access, sharing, and lock denials. A rejected boundary never selects an alternate
library or exposes its path to React. Creation and repaired permissions are synchronized where supported before SQLite
access. Corrupt bytes, storage exhaustion, and a competing writer fail without replacing committed history; startup
recovery and an explicit retry resume only after the underlying boundary is supported again.

Normal production builds bind the exact Git revision and clean-tree state into the host through the versioned build wrapper. Startup has an explicit progressive boundary. Durable import recovery starts on a blocking worker while the WebView initializes; the application-preference load and import commands share a process-scoped completion barrier, and import and preference mutation remain disabled until recovery releases it. The renderer exposes only a neutral startup surface until the complete persisted preference set has been validated and recovered if necessary. The canonical English catalog is the deterministic catalog in the initial renderer graph; a selected non-default catalog loads through a separate cached runtime module. The selected catalog must be available before the application applies document language, appearance, and zoom and reveals the localized shell with Home, History, Reports, Sources, and Settings as distinct destinations. React waits for the next animation frame and invokes the host's one-shot interactive-shell signal. Source guidance, the provider-neutral Library Home, latest import outcome, update discovery, update-recovery confirmation, and presentation modules that belong only to Sources or Settings begin only after that command is dispatched during ordinary Home startup. An explicit early destination remains authoritative and loads its required module immediately. Deferred work never awaits diagnostic settlement, so a blocked output consumer cannot hold the product in a partial startup state. If a suspended renderer supplies no frame callback within one second, FitFreed cancels that diagnostic attempt and continues deferred startup without claiming painted-shell evidence; a benchmark that receives no signal fails closed.

Startup chooses a destination from canonical state. An empty library opens a value-first Home that explains the private library outcome and offers both direct archive acquisition and acquisition guidance; Sources owns the resulting provider guide, import operation, coverage, and diagnostics. A populated library opens Home, while a valid durable exploration destination that the current library can still answer restores that exact explorer. Home composes the authoritative default read models, complete sport discovery, bounded session discovery, and at most one conservative current or historical highlight. It exposes only evidence-backed questions, measurement coverage, provider-neutral training identity, an explicitly correlated post-import reveal, and an optional resumable destination. Recorded source evidence, evidence usable by current questions, and the explicitly scoped primary range are separate meanings; training counts are paired only with the complete training range. A library with recorded but currently unusable observations opens a source-review state rather than masquerading as first run. Recognized, ambiguous, unknown, personally overridden, and unavailable sports retain distinct presentation states under one training snapshot. Unresolved sport profiles keep separate opaque capabilities in Home and recent-session identity; a contextual action routes the exact capability to the existing Sports classification task. The application surrounds the composition with one opaque library revision and gives every training query the same discovery snapshot; one concurrent change retries the complete composition and a repeated change fails closed. It never reads provider records or persistence tables from presentation and never duplicates report calculations. Opening a question stores only the versioned destination and mounts only its analytical presentation module; unrelated analytical queries do not run. The training module may submit only an opaque sport capability, expected revision, broad family code, and optional user label; the host never serializes the underlying origin/source key or provider catalogue key. **Back to Home** clears that durable destination. Temporarily visiting Sources or Settings preserves the active explorer. Requested navigation away from an unsaved Settings draft pauses at an explicit choice to keep editing or discard and continue; no top-level navigation silently changes preferences. Update discovery still runs after ready startup, but its maintenance controls are presented in Settings rather than occupying Home. This overlaps independent startup work and keeps non-essential reads, parsing, and rendering outside the first interactive frame without changing their behavior, visibility boundary, or failure reporting. The current normative Home contract is [Library Home version 9](../data-formats/insights/library-home-v9.md); preceding versions remain immutable historical evidence. The base and visible sport projections, classification boundary, and reusable relationship compare-and-save operations and provider-normalized defaults are documented in [Training Sports version 6](../data-formats/insights/training-sports-v6.md), with shared state meaning in [Training Sport Identity version 3](../data-formats/insights/training-sport-identity-v3.md).

`ApplicationShell` owns the persistent conceptual navigation landmark. At desktop widths it renders a full-height 240-pixel sidebar beside a workspace that can grow to 1600 pixels. At widths up to 1080 pixels, and whenever content zoom is 175% or 200%, it reflows the same five destinations into labelled horizontal navigation; no primary destination becomes icon-only. Home and History are distinct destinations and only Home is current on an empty first run. History remains unavailable until the authoritative Library Home has established whether the library contains explorable evidence; the shell must never present an action that can discard a fast startup click. Startup read models may populate destinations after the shell becomes interactive, but their captured navigation revision prevents a late result from replacing the person's first explicit destination. Each top-level destination owns its current document scroll position, which shell navigation restores independently; direct first-run acquisition starts at the relevant Sources task instead of inheriting an unrelated prior position. The initial 1280-by-820 window exposes the desktop hierarchy at default zoom. High-zoom first run places the acquisition actions before the illustrative preview while preserving the same conceptual navigation model. Presentation-only layout contracts and packaged WebView geometry assertions prevent a return to the former top-header, icon-only compact navigation, or narrow-document structure.

Activity, sleep, nightly recovery, and aligned history share a presentation-owned workspace hierarchy. Each has an explicit history view and period-comparison view with one localized current location; exact day or night detail replaces history discovery inside the history view. Switching views hides rather than unmounts their presentation boundaries, so an intentional temporary visit preserves entered periods and a valid comparison result. Opening an exact detail always selects history, while closing it restores the originating control or the stable explorer heading. This disposable state never enters a domain, application, transport, or persistence contract. Hidden views are removed from visual and assistive-technology exposure, and all authoritative queries, missing-data distinctions, source separation, and cross-explorer navigation remain unchanged.

The daily-activity Home question enters the comparison workspace as an Answer Canvas. React chooses
the latest two adjacent equal calendar periods, capped at 30 days each, and submits both unchanged to
the existing activity-comparison command. The application result remains the sole source for totals,
averages, changes, coverage, missing observations, and origin separation. Presentation formats that
result as one plain conclusion and proportional relationship per origin, then discloses exact values
and editable periods deliberately. Fewer than two calendar days produce a presentation-owned
insufficient-history state and no comparison command. Contextual retrieval failure keeps the selected
periods and offers an in-place retry; it does not replace the failure with a global alert. Successful
comparison focus aligns the result heading below persistent compact navigation, including at high
content zoom, so the visible result rather than the preceding controls owns the viewport.

The training-period Home highlight and saved-report source follow the same result-first grammar while using
the authoritative training-comparison command. The command accepts structurally valid periods of at most
366 inclusive dates even when an adjacent period contains no recorded session; its `availableRange` remains
recorded-evidence metadata rather than a comparison validity boundary. React submits the exact accepted
periods, presents the application-owned duration change and coverage per origin at a human scale, and keeps
period editing, exact values, and report creation as deliberate actions. It neither recalculates aggregates
nor converts missing distance, energy, or heart-rate evidence into zero.

Sleep and nightly recovery use the same Answer Canvas hierarchy for both their latest-period and
comparison workspaces. React formats application-owned counts, averages, and comparison-minus-baseline
changes into factual conclusions, keeps each origin separate, and makes the existing per-night
relationship the primary evidence. Range controls, complete measurement coverage, exact-night tables,
and source-derived physiological fields follow as deliberate disclosures. A successful range or
comparison query focuses the new answer; a contextual comparison failure retains the previous answer and
selected periods and offers an in-place retry. Presentation never interprets sleep scores or recovery
intervals as health, readiness, improvement, or decline. Missing nights and unavailable measurements
remain distinct from zero, and opening an exact night continues through the existing typed detail command.

Aligned history presents the application-owned longitudinal projection as one provider-neutral analytical
chart per source before its exact summary and table. Four independently scaled and labelled lanes share the
exact local-date coordinate; activity steps, training duration, asleep duration, and recovery interval keep
their own units and never undergo normalization. Missing measurements remain chart gaps while a recorded zero
training duration remains zero. Dense periods enable linked cursor and bounded zoom and use the canvas renderer;
short periods retain deterministic SVG. React formats only the supplied dates, counts, and daily domain values;
it does not derive overlap categories, fill missing measurements, combine origins, or reinterpret a training
zero as missing evidence. Exact-day and range controls remain deliberate disclosures, while the non-causality
boundary stays beside the visual relationship. A longitudinal comparison likewise presents the four
application-owned baseline and comparison aggregates before exact values and controls, preserves the previous
valid result across a contextual failure, and makes no claim about causation, health, or readiness.

The route workbench uses the same analytical boundary only when the application supplies an exact recorded
route-and-signal coordinate. One through four independently scaled measurement lanes share that route elapsed axis,
retain source gaps, and synchronize their selected coordinate with the map. Chart point selection navigates returned
route evidence; exact signal disclosure remains tied to the application-supplied aligned sample ordinal. A native
shared-position control and semantic lane summaries keep keyboard, current-value, provenance, range, and exact-source
meaning outside the renderer. Selection updates reuse the mounted chart instance instead of replacing it. The local
Leaflet adapter also derives one route-relative minimum zoom from the current complete-track fit, caps maximum GPS
detail, and supplies only a relative localized level state to React. The same native limits govern named controls,
keyboard, wheel, touch, reset, resize, and programmatic zoom.

Reports uses the same current-location semantics for a separate staged workflow. Library owns saved definitions and new starts, Compose owns the complete ordered editor and its evidence tools, and Preview owns resolved output plus mutually exclusive stale-evidence or export review. The mounted draft and resolved candidate survive temporary stage changes, while a successful save and a saved-report selection lead to Preview. The stage never becomes durable report data; only the existing versioned definition and its application-owned evidence reference cross the transport and persistence boundaries.

Settings has a presentation-owned category location. **Appearance & language** owns the atomic preference editor and representative preview; **Updates** owns maintenance status and actions without competing visually with those preferences. Moving between categories preserves an unsaved preview. Restoring defaults changes only the draft and appears beside the affected preference group only while the draft is not already at its defaults. Cancel and save form the dirty-draft transaction and are absent when there is no pending change. Cancellation reapplies the complete saved set without writing, and saving is the sole preference mutation. Requested top-level navigation pauses until the person keeps editing or explicitly discards and continues. The update component remains mounted when its category or Settings itself is hidden, so launch and periodic discovery retain one lifecycle and do not restart merely because the person navigates. Category location never enters the preference DTO or SQLite row.

React owns one provider-neutral presentation-format boundary for locale grouping and named summary,
comparison, detail, and exact-evidence precision. Feature panels select the role that matches the current
information hierarchy; they do not round canonical values, mutate exports, or construct a competing
duration policy. Exact elapsed coordinates retain milliseconds, ordinary session and structural
detail rounds to seconds, and aggregate summaries use magnitude-aware precision. Analytical axes and
tooltips enter the same named boundary; a renderer adapter does not construct its own locale or duration
policy. An ordinary same-day session composes one localized date, one start-to-end time range, and one
human-scale duration. Full timestamps, offsets, and source precision remain in deliberate exact evidence.
The same presentation boundary formats every ordinary calendar period: equal boundaries produce one localized
date, while distinct boundaries produce a true range. Home, sport collections, comparison panels, and reports do
not compose independent date-range strings.

The host writes only a closed JSON object containing its fixed event contract, application version, source revision, clean-tree state, and bounded monotonic startup durations. The durations cover host setup completion and host receipt of the signal plus renderer locale readiness and signal invocation. They contain no wall-clock timestamps, paths, host identity, application data, or operation values. The benchmark combines them with its outer process timer to report aggregate phase distributions while retaining the application-owned process-to-painted-shell boundary without WebDriver, WebView reloads, personal data, filesystem paths, or test-only package capabilities. Failure to write or validate the diagnostic signal never blocks ordinary deferred startup; a benchmark that cannot observe it fails closed.

## Contributor contract

The repository will pin supported Rust and Node versions and expose one documented command for each fast check, full verification, application launch, package build, and release-shaped test. A clean clone must not require private data, proprietary services, or undocumented global tooling.

Storage is defined by [ADR 0002](decisions/0002-select-sqlite-storage.md). Update trust is defined by [ADR 0008](decisions/0008-authenticate-update-policy-above-tauri.md). [ADR 0032](decisions/0032-use-specialized-analytical-visualization-engines.md) owns the mixed analytical visualization boundary, [ADR 0026](decisions/0026-use-leaflet-for-the-local-route-workbench.md) owns spatial rendering, and [ADR 0014](decisions/0014-drive-packaged-macos-e2e-with-webdriverio.md) owns packaged macOS behavioral automation.
