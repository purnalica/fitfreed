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
| Presentation | TypeScript and React with semantic HTML and CSS visualizations | Localized interaction, accessible visualization, view state, and command invocation |

The current physical modules and compile-time boundaries are documented in the [module map](module-map.md).

## Dependency rules

- Dependencies point inward from Tauri, React, and infrastructure adapters toward application ports and the domain.
- Domain and application modules do not import Tauri, React, provider schemas, database APIs, archive APIs, or operating-system APIs.
- Tauri commands are thin inbound adapters. They validate transport input, invoke one use case, translate failures, and return serializable provider-neutral results.
- The renderer receives only the data required by a view. It never receives filesystem paths, database handles, provider JSON, or unrestricted native authority.
- Provider names and schemas remain in source adapters and compatibility documentation.
- Long-running import work executes outside the UI event path and reports explicit progress and cancellation outcomes through application ports.

## Process boundary

The initial desktop distribution uses one Tauri application process and its managed blocking-task runtime. Import use cases execute on blocking workers rather than the UI event path. Application coordination permits one active import; adapter tests prove atomic visibility and cancellation rollback. Packaged timing, shutdown, and restart recovery remain mandatory hosted-E2E gates.

Normal production builds bind the exact Git revision and clean-tree state into the host through the versioned build wrapper. Startup has an explicit progressive boundary. Durable import recovery starts on a blocking worker while the WebView initializes; the application-preference load and import commands share a process-scoped completion barrier, and import and preference mutation remain disabled until recovery releases it. The renderer exposes only a neutral startup surface until the complete persisted preference set has been validated, recovered if necessary, and applied to the document language, appearance, and zoom. It then reveals the localized shell with Home, History, Reports, Sources, and Settings as distinct destinations. React waits for the next animation frame and invokes the host's one-shot interactive-shell signal. Source guidance, the provider-neutral Library Home, latest import outcome, update discovery, and update-recovery confirmation begin only after that command is dispatched. They never await diagnostic settlement, so a blocked output consumer cannot hold the product in a partial startup state. If a suspended renderer supplies no frame callback within one second, FitFreed cancels that diagnostic attempt and continues deferred startup without claiming painted-shell evidence; a benchmark that receives no signal fails closed.

Startup chooses a destination from canonical state. An empty library opens a value-first Home that explains the private library outcome and offers both direct archive acquisition and acquisition guidance; Sources owns the resulting provider guide, import operation, coverage, and diagnostics. A populated library opens Home, while a valid durable exploration destination that the current library can still answer restores that exact explorer. Home composes the authoritative default read models, complete sport discovery, bounded session discovery, and at most one conservative current or historical highlight. It exposes only evidence-backed questions, measurement coverage, provider-neutral training identity, an explicitly correlated post-import reveal, and an optional resumable destination. Distinct unresolved sport profiles retain separate opaque capabilities in Home and recent-session identity; a contextual action routes the exact capability to the existing Sports classification task. The application surrounds the composition with one opaque library revision and gives every training query the same discovery snapshot; one concurrent change retries the complete composition and a repeated change fails closed. It never reads provider records or persistence tables from presentation and never duplicates report calculations. Opening a question stores only the versioned destination and mounts only its analytical presentation module; unrelated analytical queries do not run. The training module may submit only an opaque sport capability, expected revision, broad family code, and optional user label; the host never serializes the underlying origin/source key. **Back to Home** clears that durable destination. Temporarily visiting Sources or Settings preserves the active explorer, while leaving Settings without saving discards its presentation-only preview and restores the complete saved preference set. Update discovery still runs after ready startup, but its maintenance controls are presented in Settings rather than occupying Home. This overlaps independent startup work and keeps non-essential reads, parsing, and rendering outside the first interactive frame without changing their behavior, visibility boundary, or failure reporting. The current normative Home contract is [Library Home version 3](../data-formats/insights/library-home-v3.md); [version 1](../data-formats/insights/library-home-v1.md) and [version 2](../data-formats/insights/library-home-v2.md) remain immutable historical evidence. The sport projection and compare-and-save boundary are documented in [Training Sports version 1](../data-formats/insights/training-sports-v1.md).

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

Aligned history presents the application-owned longitudinal projection as a source-separated four-lane
calendar before its exact summary and table. React formats only the supplied dates, counts, and daily domain
values; it does not derive overlap categories, fill missing measurements, combine origins, or reinterpret a
training zero as missing evidence. Exact-day and range controls remain deliberate disclosures, while the
non-causality boundary stays beside the visual relationship. A longitudinal comparison likewise presents
the four application-owned baseline and comparison aggregates before exact values and controls, preserves
the previous valid result across a contextual failure, and makes no claim about causation, health, or
readiness.

Reports uses the same current-location semantics for a separate staged workflow. Library owns saved definitions and new starts, Compose owns the complete ordered editor and its evidence tools, and Preview owns resolved output plus mutually exclusive stale-evidence or export review. The mounted draft and resolved candidate survive temporary stage changes, while a successful save and a saved-report selection lead to Preview. The stage never becomes durable report data; only the existing versioned definition and its application-owned evidence reference cross the transport and persistence boundaries.

Settings has a presentation-owned category location. **Appearance & language** owns the atomic preference editor and representative preview; **Updates** owns maintenance status and actions without competing visually with those preferences. Moving between categories preserves an unsaved preview, while leaving Settings still discards it and reapplies the complete saved set. The update component remains mounted when its category or Settings itself is hidden, so launch and periodic discovery retain one lifecycle and do not restart merely because the person navigates. Category location never enters the preference DTO or SQLite row.

The host writes only a closed JSON object containing its fixed event contract, application version, source revision, clean-tree state, and bounded monotonic startup durations. The durations cover host setup completion and host receipt of the signal plus renderer locale readiness and signal invocation. They contain no wall-clock timestamps, paths, host identity, application data, or operation values. The benchmark combines them with its outer process timer to report aggregate phase distributions while retaining the application-owned process-to-painted-shell boundary without WebDriver, WebView reloads, personal data, filesystem paths, or test-only package capabilities. Failure to write or validate the diagnostic signal never blocks ordinary deferred startup; a benchmark that cannot observe it fails closed.

## Contributor contract

The repository will pin supported Rust and Node versions and expose one documented command for each fast check, full verification, application launch, package build, and release-shaped test. A clean clone must not require private data, proprietary services, or undocumented global tooling.

Storage is defined by [ADR 0002](decisions/0002-select-sqlite-storage.md). Update trust is defined by [ADR 0008](decisions/0008-authenticate-update-policy-above-tauri.md). [ADR 0013](decisions/0013-render-mvp-visualizations-with-semantic-html.md) owns the MVP visualization boundary, and [ADR 0014](decisions/0014-drive-packaged-macos-e2e-with-webdriverio.md) owns packaged macOS behavioral automation.
