# Performance Benchmarks

## Purpose and status

The versioned performance gates protect full-scale import plus the current daily-activity, training-session, sleep, recovery, and integrated longitudinal Insights paths against the budgets in the [quality targets](../quality-targets.md). They use independently authored deterministic data, exercise production boundaries, emit one machine-readable JSON object per gate, and return a non-zero status when a budget is exceeded.

These gates establish regression evidence on the machine that runs them. They do not yet prove the provisional Apple Silicon, 8 GB minimum profile. Cold launch, update, and reference-profile execution retain their own open performance gates. The reference-profile run must execute these same commands; a result from a more capable host cannot replace it.

## Cold launch benchmark

Build the normal production application from a clean revision and run the macOS campaign:

```sh
npm run package:app
npm run benchmark:cold-launch
```

The production build wrapper binds the exact Git revision and clean-tree state into the host. The benchmark rejects a dirty checkout, an application built from another revision, an instrumented package, an unexpected signal field, invalid or unordered timing values, or a build that was not clean. It starts the timer immediately before creating each application process. After locale initialization, React waits for the next animation frame and reports the interactive shell through a one-shot host command. The host emits a closed privacy-safe JSON signal containing the event contract, application version, source revision, clean-tree state, and monotonic durations for host setup, host signal receipt, renderer locale readiness, and renderer signal invocation. These durations contain no wall-clock timestamp, path, host identity, or user data. WebDriver, driver creation, WebView reloads, and timers started after process creation are outside this boundary and cannot satisfy it.

The campaign runs exactly 20 fresh production processes with no warm-up and a distinct empty temporary home for each process. Every duration therefore includes process creation, Tauri and WebView startup, storage initialization and interrupted-import recovery, locale resolution, React rendering, one painted localized shell frame, and the signal round trip. Analytical reads, update discovery, update-recovery confirmation, and their separately loaded presentation modules start only after the signal command settles. They are deliberately outside the first-interaction boundary and remain covered by their own behavioral, recovery, and performance gates. The process is terminated only after the signal, and all temporary application data is removed. Output and diagnostics are bounded; their raw content is never included in evidence.

Durations are sorted and p95 uses zero-based index `ceil((n - 1) * 0.95)`. The p95 budget is 2.5 seconds. The local output object records application and source identity, clean-tree state, host profile, free storage, scenario, boundary, run policy, median, p95, maximum, budget, result, and aggregate median/p95/maximum for five exhaustive phases: outer process creation plus evidence transport; host startup through setup completion; setup completion through renderer startup plus command transport; renderer startup through locale readiness; and locale readiness through the painted-shell signal. The first and third values deliberately combine intervals that cannot be separated without cross-process absolute timestamps; the labels preserve that limitation instead of implying false precision. The phases sum to the total within each process, but aggregate phase percentiles can belong to different processes and must not be added together. Per-process timings are never emitted as benchmark evidence. The exact host profile and raw output remain local. Versioned evidence retains the aggregate measurements and states only whether the environment satisfies the provisional 8 GB Apple Silicon profile. Only a passing clean campaign on that profile closes the acceptance gate; other hosts provide regression evidence only.

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

The local output records the application version, source revision and clean-tree state, host profile, free storage, exact generated scale, compressed archive size, run policy, aggregate timings, phase p95 values, memory, and budget result. Exact host details and raw output remain local; versioned evidence retains the synthetic scale, aggregate measurements, result, and only the reference-profile classification. Temporary ZIP and SQLite files are removed even after failure. Only a clean-tree result on the provisional 8 GB Apple Silicon profile closes that profile's import gate; other local and hosted runs remain valuable regression evidence.

## Application read-model benchmark

Run:

```sh
npm run benchmark:insights
```

The release-mode Rust example creates a temporary schema-version-9 SQLite library through the production migration path, generates ten calendar years for four opaque origins, and inserts deterministic daily observations, one training session, one primary sleep period, and one nightly-recovery observation per origin and date. Daily activity includes available, unavailable, and missing observations; training includes varied durations and deterministic optional distance, energy, heart-rate, sport-reference, and exercise-count coverage; sleep includes deterministic phase, score, goal, timeline, and recording-status data; recovery varies shared intervals while retaining typed source assessment, baseline, and guidance. The scale contains 14,612 primary sleep periods, 58,448 sleep transitions, and 14,612 recovery nights. No generated database survives the process.

It measures the SQLite adapter plus application read model separately for daily activity, training sessions, sleep, recovery, and their longitudinal composition. Each path covers:

- the default 30-day overview;
- an explicit common 30-day filter;
- the maximum supported filter;
- a common 30-day two-period comparison;
- a maximum-range two-period comparison.

Sleep and recovery additionally measure exact detail retrieval for one identity. Sleep overview and comparison must not load high-resolution transition rows; recovery overview and comparison must not load baseline values or guidance text. Each detail path loads only the selected identity's complete information. Longitudinal measurements execute the global range and origin composition plus all four established domain models; they must not use a persisted report cache.

Each interaction has 10 warm-up executions and 100 measured executions. Durations are sorted and p95 uses zero-based index `ceil((n - 1) * 0.95)`. Default and common interactions must remain within 500 ms p95; maximum-range interactions must remain within the 2-second complex-visualization budget. The local output reports application version, source revision, host profile, free storage, generated scale, database size, run policy, median, p95, maximum, budget result, and peak process memory. Public documentation follows the same minimized evidence boundary as the other benchmarks.

## Packaged UI benchmark

`npm run verify:e2e` generates a separate two-year provider archive containing deterministic activity gaps, unavailable daily values, one varied training session per date, one primary sleep period and score per date, and one nightly-recovery summary per date. It imports the archive through the packaged application and measures all four detailed domains plus the integrated longitudinal view inside the macOS WebView. The timed interval starts immediately before form submission and ends on the animation frame after the expected exact table has rendered. It therefore contains the real Tauri command, SQLite and application work, transport, React update, and WebView rendering; WebDriver transport and fixture setup remain outside the interval.

For each detailed domain and the longitudinal view, the packaged journey uses four warm-up runs, 20 measured common filters, seven measured maximum filters, and 20 measured common comparisons. Sleep and recovery additionally measure 20 exact-detail selections after four warm-up runs. It applies the same percentile calculation and p95 budgets as the read-model benchmark. It also verifies every maximum 366-day presentation at 200% text size without horizontal page overflow. The run emits a second machine-readable JSON object with its host, source, scenario, method, per-path measurements, and results.

## Automation and evidence handling

`npm run verify:full` includes the cold-launch, full-scale import, read-model, and packaged-UI gates. The macOS GitHub Actions job runs the same commands explicitly, so local and hosted paths share the same versioned entry points. After fast checks and production-package preparation, hosted automation evaluates cold launch before the longer import and Insights campaigns. This fail-fast order reduces wasted runner time after a startup regression without removing any successful-path gate. A budget failure is not retried or converted into a pass.

Generated archives, databases, raw benchmark output, exact local host profiles, screenshots, and logs remain ignored local or short-lived CI evidence. Only the synthetic generators, executable assertions, budgets, methodology, privacy-safe aggregate measurements, and reference-profile classification are versioned. Do not replace them with a provider export, values derived from one, or a maintainer's or participant's workstation details.

When investigating a regression, first separate archive fingerprinting, database setup, validation, decode and mapping, reconciliation, transaction control, query, application-model, transport, React, render, and test-controller time. Changing a budget requires measured evidence, impact analysis, and an explicit product decision; test-runner overhead is not product latency.

Cold-launch evidence measures the production process-to-painted-interactive-shell boundary described above. A result from an instrumented package, WebView reload, driver session, stale binary, dirty source tree, or post-process timer measures a different boundary and cannot close that gate.
