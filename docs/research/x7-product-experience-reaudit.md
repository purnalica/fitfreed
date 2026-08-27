# X7 Product-Experience Reaudit

## Status

In progress on 2026-08-27. This audit challenges the corrected X7 product before the revision-isolated
production-native handoff. It does not inherit the accepted X6 machine verdict: the later production-native human
evaluation rejected that experience and is the regression baseline for this independent repeat.

The current machine audit uses the packaged macOS E2E application rebuilt from clean revision `7aa38af`. Its latest
executable change is candidate `c7cc208`, with executable-input fingerprint
`dc0b344b9f363b5ba810f766820ba0d5270a2c238cb0444242ad96c5f04e96d2`. All archives, databases, screenshots, and
exports are synthetic, local, and ignored. No personal history or machine-local locator is versioned.

The independent machine-assisted product-experience verdict is **pass** on 2026-08-27. The exact clean-rebuild repeat
closes the corrected material finding without accepting another critical or major finding. This verdict admits the
candidate to the complete local and hosted gates; it does not close X7-R7, authorize a production-native package, or
replace the reserved human observations.

## Method and evidence boundary

The audit starts by replaying the three independent X6 packaged journeys against the corrected executable before
adding X7-specific paths. Existing component, integration, and maintained E2E tests are evidence only after their
covered behavior has been traced to a real production surface. The independent pass observes the packaged product,
captures visible state and geometry, runs Axe against the main surface, and treats every prior human finding as a
regression prompt without limiting discovery to that list.

Automation cannot establish that the default browser became visible, that VoiceOver communication is useful, or that
the product is compelling with recognizable personal history. Those claims remain reserved for the final
revision-isolated production-native human gate.

## Live-surface traceability

The inventory baseline is the X7 starting revision `96b3c72`; the candidate is `c7cc208`. A current registration and
production-invocation scan establishes that every command added or changed by X7 is registered in the desktop host,
invoked by a reachable production component, and exercised through that component. The removed `reset_preferences`
command has no registration or production invocation. It was replaced by the existing `save_preferences` path, so
Settings has one durable write rather than a second reset transaction.

### Desktop transport

| X7 owner | Registered commands introduced or affected | Production caller and reachable control | Complete behavior evidence |
| --- | --- | --- | --- |
| R1 | `import_archive`, `query_source_acquisition_guides`, `open_official_source_link`, `query_latest_import_outcome` | `App` owns archive selection, progress, cancellation, projection refresh, and latest outcome; `SourcesPanel` exposes the guide, two official destinations, ZIP selection, retry, cancellation, and the result account through `official-source-link.ts` | Source acquisition application and native-adapter tests cover allowlisting and every typed launcher result; host tests cover progress coalescing; import infrastructure tests cover every resource-limit category, rollback, and terminal progress; `SourcesPanel.test.tsx`, `App.test.tsx`, and the packaged acquisition-to-restart journey cover the mounted paths. Actual visible browser appearance remains the final native human observation. |
| R2 | `query_library_home`, `query_training_sports`, `save_training_sport_classification`, `query_training_sessions`, `query_training_session_calendar`, `query_training_session_selection`, `load_training_discovery_workspace`, `save_training_discovery_workspace`, `clear_training_discovery_workspace`, and the five domain comparison queries | `LibraryHomePanel`, `TrainingSportsPanel`, `SportClassificationTask`, `TrainingSessionLibraryPanel`, `ActivityComparisonPanel`, `TrainingComparisonPanel`, `SleepComparisonPanel`, `RecoveryComparisonPanel`, and `LongitudinalComparisonPanel` expose exact sport collections, classification, saved discovery state, detail selection, useful presets, and manual dates | Sport-discovery and training-discovery application tests cover exact, ambiguous, unavailable, overridden, filtered, restored, and invalid states. Component tests cover every card, nested edit action, origin return, preset consumer, and manual range. The packaged journey opens Home and History collections, restores their exact origins, and proves distinct comparison defaults. |
| R3 | `load_preferences`, `save_preferences`, plus the read commands consumed by each progressively disclosed explorer | `App` mounts one preference draft and unsaved-navigation guard; `SettingsPanel` exposes `Restore defaults`, `Cancel changes`, and `Save changes`. Every explorer uses `presentation-format.ts` and `DataTable` for the visible result and exact disclosure. | Preference application, transport, persistence, `SettingsPanel`, and `App` tests cover draft reset, cancellation without a write, save, validation, sequential edits, navigation guard, and restart. Formatter property and boundary tests, `DataTable` semantics, UI-contract automation, component disclosure tests, and the packaged locale/theme/zoom journey cover the shared presentation path. |
| R4 | The existing activity, training-signal, route, longitudinal, report-resolution, and `export_report` commands; `export_report` was extended to the static chart port | `AnalyticalChart` is the single live chart boundary; `TrainingSignalPlot`, `TrainingCrossSignalPanel`, `TrainingRouteSignalLanes`, `LongitudinalInsightsPanel`, and `TrainingRouteWorkbench` expose charts, exact alternatives, linked selection, and bounded route navigation. `ReportsPanel` invokes the same report resolution/export path for deterministic static SVG. | Renderer-model, ECharts-adapter, WebView component, route-zoom, route-workbench, signal, cross-signal, longitudinal, Plotters, report-HTML, dependency, and architecture tests cover the live and static boundaries. The packaged journey proves route limits, keyboard selection, gaps, multiple scales, exact alternatives, export without scripts or external requests, both locales, dark appearance, and 200% zoom. |
| R5 | `query_planned_training_chronology`, `query_planned_training_target`, `query_session_planned_training_relation`; planned evidence also extends `create_report`, `update_report`, `refresh_report`, `list_report_library`, `resolve_report`, and `export_report` | `PlannedTrainingPanel` exposes chronology, filters, target detail, exact phases, recorded-session relation, and report creation. `TrainingSessionLibraryPanel` exposes the inverse exact relation. `ReportsPanel` resolves, reviews, refreshes, and exports the same planned target. | Domain graph and relationship tests, adapter grammar tests, SQLite import/query/migration/backup/export tests, application query and report tests, transport tests, `PlannedTrainingPanel` and session component tests, and the packaged planned-training-to-report journey cover the complete vertical path. |
| R6 | `list_report_examples`, `duplicate_report`; the report create/update/refresh/list/resolve/export commands retain the same persisted path | `ReportsPanel` shows the example catalogue before saved results, routes parameterized examples to the exact selection workspace, opens a fresh unsaved draft, duplicates from the result, and returns to result-first review and export | Descriptor/prerequisite, report-domain, duplication use-case, SQLite independence, transport, and `ReportsPanel` tests cover empty, ready, unavailable, cancellation, validation, fresh identities, source independence, restart, refresh, and export. The complete packaged journey proves example selection, cancellation without writes, save, duplicate cancellation/focus, independent deletion, reimport, and structured-plan routing. |

### Contract, application, and persistence families

| X7 owner | Transport and application contract | Persistence or output boundary | Reachability conclusion |
| --- | --- | --- | --- |
| R1 | `OpenOfficialSourceLinkRequestDto`, `OpenOfficialSourceLinkOutcomeDto`, `ImportProgressDto`, `ImportOutcomeDto`, `OfficialSourceLinkOpenerPort`, `ImportCoordinator`, and typed `ArchiveResourceLimit` reasons | `NativeOfficialSourceLinkOpener`, `SqlitePolarFlowArchiveImporter`, import-outcome storage, and the coalesced Tauri progress channel | No test-only branch exists: the same ports and adapters are constructed by the registered production commands. |
| R2 | `LibraryHomeDto`, training-sport v3, sport-identity v2, search/calendar/selection v3/v2, discovery-workspace v2, and the shared comparison-period presentation value object | Migrations `0029_training_session_sport_evidence.sql` and `0030_training_discovery_workspace_v2.sql`; `SqliteTrainingLibrary` and the existing classification/workspace stores | Source evidence enters one exact represented collection identity, which is consumed by Home, History, search, calendar, selection, saved workspace, reports, and portable projections. |
| R3 | Versioned application-preference transport plus the provider-neutral formatting, result-section, metric-group, disclosure, and `DataTable` presentation contracts | `SqliteApplicationPreferences`; exact values remain unchanged in SQLite, report resolution, and exports | Draft behavior is presentation state, the sole save crosses the application port, and display precision never mutates evidence. |
| R4 | Renderer-neutral `AnalyticalChartModel`, route viewport/zoom model, report resolution v7, and report export v5/output v7 | ECharts only in the presentation adapter; Leaflet only in the route adapter; Plotters only in `report_chart.rs`; deterministic HTML only in `report_html.rs` | Library-specific objects do not cross inward boundaries, and exact semantic alternatives derive from the same resolved evidence as each visual. |
| R5 | Planned chronology, target, session-relation, report-definition v5, report-resolution v7, normalized-export v1, and their application ports and use cases | Migrations `0031_planned_training.sql` and `0032_planned_training_reports.sql`; Polar target adapter, `planned_training_store.rs`, normalized export, whole-library backup, and deterministic report output | Scheduled intent survives import, reconciliation, restart, migration, data exit, report persistence, and export without becoming recorded or user-authored evidence. |
| R6 | `ReportExampleCatalogDto`, `DuplicateReportRequestDto`, versioned application descriptors, and domain duplication with fresh report and block identities | Existing atomic report-definition store; examples remain application-owned and unpersisted | Example selection writes only on explicit save. A duplicate is a new independent aggregate and uses the ordinary report lifecycle thereafter. |

The schema registry and current-documentation checks bind every version named above to its JSON Schema and canonical
format documentation. Rust architecture checks bind ports and adapters to Clean Architecture direction; presentation
inventory and UI-contract checks reject unreachable production modules, direct table ownership, ad hoc formatters,
and visualization-library leakage. The maintained packaged journey invokes controls rather than host commands
directly, so it proves the transport is reachable through the product surface rather than merely callable in tests.

## Challenge matrix

| Required challenge | Current evidence | Result |
| --- | --- | --- |
| Wide, short-laptop, compact, and narrow windows | The maintained journey exercises 1440×900, 1280×820, 1280×720, 900×760, and 720×760 application windows. The independent X7 journey adds a 760×700 compact high-zoom stress state. | No root horizontal overflow or escaped control was observed. Required controls remain reachable through ordinary vertical scrolling. |
| 100% through 200% zoom | The sport-classification composition runs all 40 combinations of 720/1280 widths, both locales, both explicit appearances, and 100%, 125%, 150%, 175%, and 200%. High-risk Home, reports, route, range, signal, and planned-training states repeat at 200%. | Geometry contracts pass at every level. Long controls stack at 150% and above without reducing the accepted content boundary. |
| English/light and Spanish/dark | Independent and maintained journeys cover both locales, light, dark, and system appearance. The Spanish/dark/200% repeat includes navigation, exact values, user-authored reports, duplication, ranges, and structured phases. | Locale-specific formatting and navigation remain usable; imported and user-authored names remain intentionally untranslated. |
| Long and evidence-dense content | The candidate is challenged with an 80-character personal sport name, a valid long report title near its contract boundary, multi-signal charts, exact route samples, personal ranges, and structured planned phases. | Normal single-line inputs scroll their value; visible reading content wraps without clipping. Exact evidence remains behind explicit disclosure. |
| Pointer, keyboard, focus, scroll, and return | Packaged controls are activated through their production surfaces. The journeys exercise keyboard route position and pan, range handles, form controls, cancellation, saved-result focus, origin-aware return, compact navigation, and scroll placement below persistent navigation. | All asserted focus and return destinations pass, including the corrected Sources-local chooser cancellation. |
| Motion and accessibility | The UI-contract gate rejects motion outside `prefers-reduced-motion: no-preference`; the Sources component proves smooth and reduced-motion scroll branches. Axe runs across 60 independent captured states plus the maintained high-risk surfaces. | No Axe violation is reported. VoiceOver usefulness remains a production-native human observation. |
| Empty, loading, partial, stale, invalid, failure, and recovery | Independent journeys cover clean first use, acquisition guidance, active import, cancellation, unsafe and malformed archives, resource limits, exact repeat, extension, preserved history, partial sessions, stale reports, explicit refresh, invalid ranges, export, and retry. | Every state presents a reachable consequence or recovery action without mutating the library on cancellation or rejection. |
| Restart and large-library responsiveness | The complete packaged campaign starts a new application process for durable library, preference, report, and personal-range evidence. The isolated performance fixture contains 731 sessions, 20,001 route points, four signal series, 731 sleep periods, and 731 recovery nights. | Both restart journeys pass. Every measured interaction remains inside its documented p95 budget; the largest observed p95 is 157 ms for signal overview. |

The independent observation sets contain 27 first-use/data-exit states, 11 import-outcome states, nine adaptive and
report-lifecycle states, and 13 X7-specific capability states. None reports horizontal overflow or an Axe violation.
The X7-specific geometry probe additionally reports no escaped visible control or clipped visible leaf text. Direct
visual inspection of the current core, analytical, adverse-state, and report capture sheets accepted no additional
material finding.

## Findings

| ID | Severity | State | Observable finding | Root cause | Required correction and evidence |
|---|---|---|---|---|---|
| X7A-01 | Major accessibility and interaction defect | Closed by exact clean-rebuild repeat | Cancelling the native archive chooser from the already-open Sources workspace did not restore focus to `Choose ZIP package`. The independent packaged journey timed out after the chooser returned without a selection. | `SourcesPanel.chooseArchive` called `focus()` while `archiveChoosing` still disabled the referenced button, then re-enabled it in `finally`. The immediate component test retained focus from its synthetic click and therefore missed the real WebView sequence. The Home shortcut followed a different remount path, so the maintained E2E journey did not exercise this Sources-local cancellation. | The component records pending restoration and focuses only after React commits the enabled state. Its test holds the chooser pending, proves the disabled state, displaces focus, resolves cancellation, and requires enabled focus. The exact clean rebuild passes the independent first-use journey, the complete maintained acquisition journey, and the complete packaged campaign containing the Sources-local regression. |

## Audit trail

1. The clean first-use X6 regression journey reached acquisition guidance in the current packaged application.
2. Its first Sources-local chooser cancellation invoked the instrumented native boundary with the exact ZIP-only
   options, then failed solely at focus restoration.
3. Investigation traced the behavior through the current helper, the introducing commit and test history, the live
   component, and the distinct Home cancellation test before accepting X7A-01. No assertion was removed or weakened.
4. After the candidate correction, the clean-first-use regression passed all 27 captured states. The import-outcome
   regression retained the visible exact rejection reason while adapting its obsolete disclosure selector, then
   passed cancellation, rejection, repeat, extension, and preservation. The adaptive regression passed route
   relationships, partial evidence, stale-report review, and explicit refresh.
5. The complete maintained packaged journey then passed in 2 minutes and 35 seconds. It exercised the new
   Sources-local cancellation before continuing through import, global progress, sports, comparisons, route and
   signal workbenches, personal ranges, report examples, independent duplication, localization at 200%, reimport,
   refresh, structured training intent, export, and restart preparation.
6. A clean `build:e2e` repeat produced the current package from revision `7aa38af`. An independent X7-specific
   packaged journey then passed 13 captured product states: first value, exact sport collection, useful comparison
   defaults, route workbench and minimum zoom, cross-signal analysis, report examples, a valid maximum-pressure
   user-authored title, result-first review, independent duplication, planned-training shape, and exact phases.
   Its Spanish, dark, compact-window, 200% states had no root horizontal overflow, escaped visible controls, clipped
   visible leaf text, or Axe violations. Direct visual inspection accepted no additional material finding. The audit
   helper first rejected an intentionally visually hidden chart legend and the journey first supplied a title beyond
   the documented 120-character contract; both were audit defects, not production corrections.
7. After the restart checkpoint, the exact clean package passed the three independent regression journeys again: 27
   first-use/data-exit states, 11 import-outcome states, and the adaptive route/partial/stale/refresh lifecycle. The
   complete maintained journey then passed again in 2 minutes and 35 seconds, including the Sources-local chooser
   cancellation.
8. The complete packaged campaign repeated the maintained journey, application-process restart, adaptive-session
   composition, personal-range restart after exact reimport, and the isolated large-library performance scenario.
   Every scenario and documented interaction budget passed.

## Continuation boundary

The audit evidence was collected from clean audit revision `7aa38af`; later documentation-only checkpoints preserve
the executable fingerprint. All production changes are committed locally, and the independent screenshots,
observations, databases, and one-off journeys remain ignored synthetic audit evidence. The live-surface trace and
independent machine-assisted product-experience audit are complete. The focused outgoing range remains ahead of the
last known `origin/main`; synchronization is pending after the configured SSH signing agent did not complete a
bounded attempt.

The deterministic continuation is the exact complete local verification, executable-input-selected hosted campaign,
and revision-isolated production-native review-package scan. A successful machine gate may prepare but must not
publish the package. No production-native human claim has been made.
