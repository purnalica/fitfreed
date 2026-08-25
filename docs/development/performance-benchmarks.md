# Performance Benchmarks

## Purpose and status

The versioned performance gates protect full-scale import plus the current daily-activity, training-session, sleep, recovery, and integrated longitudinal Insights paths against the budgets in the [quality targets](../quality-targets.md). They use independently authored deterministic data, exercise production boundaries, emit one machine-readable JSON object per gate, and return a non-zero status when a budget is exceeded.

These gates establish environment-qualified evidence under [ADR 0015](../architecture/decisions/0015-qualify-performance-evidence-by-execution-environment.md). Executable changes must pass the complete hosted macOS campaign, and the exact candidate must pass a clean local Apple Silicon production campaign before handoff. The budgets and commands are identical in both environments; a passing result proves that environment rather than promising identical timing on every supported Mac.

## Cold launch benchmark

Build the normal production application from a clean revision and run the macOS campaign:

```sh
npm run package:app
npm run benchmark:cold-launch
```

The production build wrapper binds the exact Git revision and clean-tree state into the host. The benchmark rejects a dirty checkout, an application built from another revision, an instrumented package, an unexpected signal field, invalid or unordered timing values, or a build that was not clean. It starts the timer immediately before creating each application process. After locale initialization, React waits for the next animation frame and reports the interactive shell through a one-shot host command. The host emits a closed privacy-safe JSON signal containing the event contract, application version, source revision, clean-tree state, and monotonic durations for host setup, host signal receipt, renderer locale readiness, and renderer signal invocation. These durations contain no wall-clock timestamp, path, host identity, or user data. WebDriver, driver creation, WebView reloads, and timers started after process creation are outside this boundary and cannot satisfy it.

The campaign runs exactly 100 fresh production processes with no warm-up and a distinct empty temporary home for each process. One hundred measurements prevent the p95 estimator from collapsing to the single maximum observation while retaining a distinct reported maximum and enough observations above the selected percentile to expose the tail. Every duration includes process creation, Tauri and WebView startup, storage initialization and interrupted-import recovery, locale resolution, React rendering, one painted localized shell frame, and the signal round trip. Analytical reads, source guidance, update discovery, update-recovery confirmation, and their separately loaded presentation modules start only after the signal command is dispatched. They never await diagnostic settlement and therefore cannot be blocked by its output consumer. A one-second no-frame fallback cancels the diagnostic attempt and continues the product without emitting evidence; the benchmark fails closed when the signal is absent. Deferred work is deliberately outside the first-interaction boundary and remains covered by its own behavioral, recovery, and performance gates. The process is terminated only after the signal, and all temporary application data is removed. Output and diagnostics are bounded; their raw content is never included in evidence.

The initial renderer graph contains the complete canonical English catalog as its deterministic fallback. A
persisted non-default catalog is fetched as a separate production module and must finish loading before the
localized shell can satisfy the signal; changing locale later uses the same cached runtime catalog. Ordinary Home
startup also defers the Settings, Sources, and import-outcome presentation modules until after the first interactive
frame. Explicitly choosing one of those destinations remains authoritative and loads it immediately. This split is
part of the measured production path rather than benchmark-only instrumentation, and locale, navigation, import,
and preference tests protect the behavior on both sides of the boundary.

Durations are sorted and p95 uses zero-based index `ceil((n - 1) * 0.95)`. The p95 budget is 2.5 seconds. The local output object records application and source identity, clean-tree state, host profile, free storage, scenario, boundary, run policy, median, p95, maximum, budget, result, and aggregate median/p95/maximum for five exhaustive phases: outer process creation plus evidence transport; host startup through setup completion; setup completion through renderer startup plus command transport; renderer startup through locale readiness; and locale readiness through the painted-shell signal. The first and third values deliberately combine intervals that cannot be separated without cross-process absolute timestamps; the labels preserve that limitation instead of implying false precision. The phases sum to the total within each process, but aggregate phase percentiles can belong to different processes and must not be added together. Per-process timings are never emitted as benchmark evidence. The exact host profile and raw output remain local. Versioned evidence retains aggregate measurements and classifies the run only as hosted macOS or local Apple Silicon. Both maintained environments must pass for candidate handoff.

## Full-scale import benchmark

Run on macOS:

```sh
npm run benchmark:import
```

The command generates a temporary deterministic ZIP with one fictional account artifact, 5,999 daily-activity summaries, and 4,000 training-session summaries. The training artifacts contain two million independently authored synthetic time-series items under a field that summary mapping version 1 deliberately does not persist. It requires exactly that composition, 10,000 entries, and at least 5 GiB of expanded JSON before the campaign can start. Repetitive synthetic padding deliberately exercises the expanded-volume boundary without imitating a personal history; this is a resource and supported-domain envelope, not a claim that the generated history or excluded sample shape represents a typical provider export.

The Rust benchmark executable is built once in release mode. Seven fresh processes each use a distinct temporary library, import the archive through the production adapter, repeat the exact same ZIP, and execute one indexed full-year activity query plus one indexed full-year training query in each of 50 iterations. Every process must report exactly 10,000 recognized artifacts, 9,999 new observations, 366 results from each domain query, an exact-repeat outcome, complete non-negative phase timings, and a measurable peak resident set. The query measurement covers the pair. The aggregate uses the sorted zero-based `ceil((n - 1) * 0.95)` percentile, which intentionally selects the slowest value in a seven-process campaign.

The enforced p95 budgets are:

- first import: at most 10 minutes;
- exact repeat: at most 30 seconds;
- representative query: at most 500 ms;
- peak resident memory: strictly less than 1,536 MiB.

The local output records the application version, source revision and clean-tree state, host profile, free storage, exact generated scale, compressed archive size, run policy, aggregate timings, phase p95 values, memory, and budget result. Exact host details and raw output remain local; versioned evidence retains the synthetic scale, aggregate measurements, result, and only the hosted macOS or local Apple Silicon classification. Temporary ZIP and SQLite files are removed even after failure. The complete hosted campaign and clean local candidate campaign must both pass their unchanged budgets.

## Dense training-history benchmark

Run on macOS:

```sh
npm run benchmark:dense-history
```

The command independently generates a provider ZIP with one fictional account artifact and 520 weekly
one-hour sessions beginning on 2016-01-01. Every session contains one exercise and four supported regular
signals: heart rate, speed, altitude, and cadence. Each series contains 3,601 one-second slots with explicit
deterministic gaps. The accepted scale is exactly 521 archive entries, 520 sessions, 2,080 series, and
7,490,080 persisted samples. This is a provider-independent resource envelope rather than a description or
derivative of a private history.

The release-mode Rust benchmark process uses the production archive adapter, anti-corruption mapping,
reconciliation, SQLite persistence, and application query use cases. Three fresh processes each receive a
new library, perform the first import, repeat the exact same archive, checkpoint SQLite, and verify every
persisted count. Each process then executes five warm-ups and 20 measurements for the coherent Library Home,
the first 25 sessions, the four-series 300-sample-per-series bounded overview, and one 250-sample exact page.
The Home measurement composes the complete history span, sport identities, four most recent sessions,
historical or equal-period highlight, domain coverage, and latest import outcome through the production
SQLite ports and application use case. Query p95 uses sorted
zero-based index `ceil((n - 1) * 0.95)`. Campaign aggregation applies the same formula to the three
process-level results, intentionally selecting the slowest process.

The gate enforces:

- first import at or below 10 minutes;
- exact repeat at or below 30 seconds;
- peak resident memory strictly below 1,536 MiB;
- checkpointed SQLite size at or below 512 MiB;
- Library Home composition, session discovery, signal overview, and exact sample page p95 at or below 500 milliseconds; and
- exact session, series, sample, visual-sample, and page counts.

Database size is `page_count * page_size` after the WAL checkpoint. The limit qualifies this exact workload,
not every possible library. Output records source identity, clean-tree state, host and free-storage context,
scenario, run policy, import phase timings, aggregate measurements, budgets, and result. Exact local host
details and raw output remain local. Every generated ZIP and database is removed after success or failure.
Both maintained performance environments must pass the same command before PX-03 can close.

## Application read-model benchmark

Run:

```sh
npm run benchmark:insights
```

The release-mode Rust example creates a temporary current-schema SQLite library through the production migration path, generates ten calendar years for four opaque origins, and inserts deterministic daily observations, one training session, one primary sleep period, and one nightly-recovery observation per origin and date. Daily activity includes available, unavailable, and missing observations; training includes varied durations and deterministic optional distance, energy, heart-rate, sport-reference, and exercise-count coverage; sleep includes deterministic phase, score, goal, timeline, and recording-status data; recovery varies shared intervals while retaining typed source assessment, baseline, and guidance. The scale contains 14,612 training sessions, 14,612 primary sleep periods, 58,448 sleep transitions, and 14,612 recovery nights. No generated database survives the process.

It measures the SQLite adapter plus application read model separately for daily activity, training sessions, sleep, recovery, and their longitudinal composition. Each path covers:

- the default 30-day overview;
- an explicit common 30-day filter;
- the maximum supported filter;
- a common 30-day two-period comparison;
- a maximum-range two-period comparison.

Sleep and recovery additionally measure exact detail retrieval for one identity. Sleep overview and comparison must not load high-resolution transition rows; recovery overview and comparison must not load baseline values or guidance text. Each detail path loads only the selected identity's complete information. Longitudinal measurements execute the global range and origin composition plus all four established domain models; they must not use a persisted report cache.

Training additionally stores one independently invented recorded structure for each origin at the latest
date. Each contains one exercise, one source lap, one automatic lap, one pause, a 250,000-point primary
route, a 100,000-slot heart-rate signal with explicit gaps, and the maximum supported 64 recorded-zone groups
with 256 zones each, for one million independently generated route points, 400,000 signal samples, and
65,536 zones in total. Every generated latest exercise also applies one independently authored heart-rate
criterion. The gate measures the first 25-session
complete-history discovery page, one source-separated calendar month, ordered resolution of four opaque
session capabilities, exact retrieval of one recorded structure, a 400-point bounded route overview, a
250-point exact route page, complete two-pass endpoint-redacted report resolution over the same 250,000-point
route, a 300-sample bounded signal overview, a 250-sample exact signal page, and exact
retrieval of the complete bounded recorded-zone collection against one coherent snapshot. It also
recalculates personal segmentation by streaming the complete 100,000-slot series, preserving source gaps and
the 250-segment output bound. These paths include the concrete SQLite adapter and application validation.
Exact route pages seek from the requested ordinal through the composite route-point index. The two endpoint-redaction
passes remain memory-bounded, but repeated pages cannot use positional `OFFSET` scans that discard every preceding
point again.
The same generated library contains a complete 24-item report page. The report-library gate reads that bounded
page through SQLite and the application projection, resolves only the recognition evidence required by each
card, and exercises reuse of identical comparison queries. It also exports the maximum route report through
the complete application authorization and resolution path, deterministic HTML renderer, private staging
file, synchronization, and atomic destination replacement. Report-library p95 uses the 500-millisecond common
interaction budget. Complete self-contained HTML export and maximum-route resolution use the 2-second
complex-visualization budget; the other detailed training paths use the common-interaction budget.

Each interaction has 10 warm-up executions and 100 measured executions. Durations are sorted and p95 uses zero-based index `ceil((n - 1) * 0.95)`. Default and common interactions must remain within 500 ms p95; maximum-range interactions must remain within the 2-second complex-visualization budget. The local output reports application version, source revision, host profile, free storage, generated scale, database size, run policy, median, p95, maximum, budget result, and peak process memory. Public documentation follows the same minimized evidence boundary as the other benchmarks.

## Packaged UI benchmark

`npm run verify:e2e` generates a separate two-year provider archive containing deterministic activity gaps, unavailable daily values, one varied training session per date, a 20,001-point primary route and four independent supported 20,001-slot primary signals on the latest session, one primary sleep period and score per date, and one nightly-recovery summary per date. It imports the archive through the packaged application and measures all four detailed domains plus the integrated longitudinal view inside the macOS WebView. The timed interval starts immediately before form submission or detail action. It ends on the browser task after the expected answer boundary has been observed and a synchronous layout read has forced the WebView to resolve that presentation. It therefore contains the real Tauri command, SQLite and application work, transport, React update, DOM reconciliation, and WebView layout; WebDriver transport and fixture setup remain outside the interval. This boundary remains executable when the embedded automation driver suspends animation-frame callbacks and deliberately makes no claim about compositor or physical-pixel presentation latency.

For each detailed domain and the longitudinal view, the packaged journey uses four warm-up runs, 20 measured common filters, seven measured maximum filters, and 20 measured common comparisons. Sleep and recovery additionally measure 20 exact-detail selections after four warm-up runs. Training additionally measures 20 month-to-month calendar projections after four warm-ups, verifies coherent forward and backward pagination, builds an exact four-session comparison on the 731-session library, and exercises the dense route before the independent signal checks. Route-workbench opening uses seven measurements and a 1-second p95 budget; 20 alternating first/last source-ordinal selections use a 100-millisecond p95 budget; and seven alternating independent-signal reveals use a 250-millisecond p95 budget. The route gate requires a laid-out 400-point local trace, no invented overlay or attached signal lane, one recorded-track display choice, truthful point 1 and point 20,001 labels, map-marker movement, and focused retrieval of the exact last source row. The independent signal reveal requires all four supported series and continues to reject route overlays or attached lanes for the current Polar Flow relationship boundary. Signal detail and exact-page paths retain seven measurements after four warm-ups. The signal-detail boundary requires all four independently generated charts, expands cross-signal inspection from its default three lanes to its supported maximum of four, and waits for the complete laid-out result. Signal overview has a 1-second p95 budget; the exact 100-row page uses the common 500-millisecond budget. It applies the same percentile calculation to every path. The journey first fixes the native window at 1024 by 720 logical pixels, then verifies every maximum 366-day presentation at 200% text size without horizontal page overflow. Component layouts therefore have to respond to their actual workspace width; a wider developer display cannot hide a constrained-runner defect. The run emits a second machine-readable JSON object with its host, source, scenario, method, per-path measurements, and results.

The performance spec uses a dedicated 600-second campaign watchdog, while the exhaustive functional journey
uses a 300-second campaign watchdog. Both remain separate from every operation wait and interaction budget. The
expanded dense-route, signal, domain, and warm-up campaign can consume substantially longer than the prior
signal-only scenario while each interaction remains within its own accepted limit; import, navigation,
assertions, and WebDriver transport sit outside those measured intervals.
The campaign watchdogs prevent the test framework from pre-empting valid evidence, while bounded waits and the
unchanged per-interaction budgets still fail stalled or slow behavior. The functional journey records major
user-journey phases, and the performance journey records analytical domains, so an interrupted campaign names
the last active boundary.

## Automation and evidence handling

`npm run verify:full` includes the cold-launch, full-scale import, dense training-history, read-model, and packaged-UI gates. The macOS GitHub Actions job runs the same commands explicitly, so local and hosted paths share the same versioned entry points. After fast checks and production-package preparation, hosted automation evaluates cold launch before the longer import, dense-history, and Insights campaigns. This fail-fast order reduces wasted runner time after a startup regression without removing any successful-path gate. A budget failure is not retried or converted into a pass.

Generated archives, databases, raw benchmark output, exact local host profiles, screenshots, and logs remain ignored local or short-lived CI evidence. Only the synthetic generators, executable assertions, budgets, methodology, privacy-safe aggregate measurements, and broad execution-environment classification are versioned. Do not replace them with a provider export, values derived from one, or a maintainer's or participant's workstation details.

When investigating a regression, first separate archive fingerprinting, database setup, validation, decode and mapping, reconciliation, transaction control, query, application-model, transport, React, render, and test-controller time. Changing a budget requires measured evidence, impact analysis, and an explicit product decision; test-runner overhead is not product latency.

Cold-launch evidence measures the production process-to-painted-interactive-shell boundary described above. A result from an instrumented package, WebView reload, driver session, stale binary, dirty source tree, or post-process timer measures a different boundary and cannot close that gate.
