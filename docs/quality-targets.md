# Quality Targets

## Status

Initial measurable product budgets. They apply to the macOS MVP and will be validated during Milestone 0 technology spikes and every accepted increment.

Targets may be tightened through normal planning. Relaxing a target requires measured evidence, an impact analysis, and an explicit product decision.

## Performance environments

Performance acceptance uses environments that the project can execute and reproduce:

- Hosted macOS automation for every executable or release-input change.
- A clean local Apple Silicon production campaign for the exact candidate before handoff.
- SSD storage with enough free capacity for the source archive, temporary processing, database, and recovery state.
- Release-shaped application packages for user-journey measurements.

Raw local benchmark output records the exact execution environment needed to assess validity and remains local under the [repository content policy](repository-content-policy.md). Versioned evidence reports the application and source identity, data scenario, number of runs, warm-up policy, percentile calculation, aggregate measurements, result, and only whether the run used hosted macOS or local Apple Silicon. It never publishes a maintainer's or participant's workstation details.

The same latency, throughput, cancellation, and memory budgets apply in every maintained performance environment. A passing result proves that environment, not universal performance across every supported Mac. Apple Silicon on macOS 15.0 or later defines functional support under [ADR 0016](architecture/decisions/0016-support-apple-silicon-on-macos-15-or-later.md); installed memory is not a private-alpha performance promise. [ADR 0015](architecture/decisions/0015-qualify-performance-evidence-by-execution-environment.md) owns the evidence model.

## Responsiveness budgets

| Interaction | Target |
|---|---:|
| Cold launch to interactive shell, p95 | ≤ 2.5 s |
| Initial visible feedback after user input | ≤ 100 ms |
| Common navigation and filter result, p95 | ≤ 500 ms |
| Complex historical visualization, p95 | ≤ 2 s with an explicit loading state |
| Progress indication after starting long work | ≤ 1 s |
| Cancellation acknowledgement | ≤ 1 s |
| Consistent cancellation boundary | ≤ 5 s unless safe interruption is impossible |

The main interface must remain usable while import, indexing, report generation, or update preparation runs. A technically asynchronous operation still fails this requirement if it starves rendering or interaction.

## Import budgets

The representative large scenario is an independently generated synthetic test envelope, not a description or derivative of the private reference export. It contains 10,000 files, 5 GiB extracted, thousands of daily and training records, and millions of time-series samples.

| Scenario | Target |
|---|---:|
| First import of representative large synthetic export | ≤ 10 min |
| Peak application memory during that import | < 1.5 GB |
| Exact archive reimport after fingerprinting | ≤ 30 s |
| Duplicate logical records after exact reimport | 0 |
| Data loss or partial committed state after interruption | 0 |

Synthetic scale fixtures will be generated during benchmarking and will not be stored as large repository artifacts. Import reports must separate reading, validation, mapping, reconciliation, persistence, and indexing time so regressions can be diagnosed.

### Dense supported-signal envelope

The provider-independent dense-history scenario contains 520 weekly one-hour sessions over ten years. Every
session carries four supported one-second series with 3,601 exact slots, for 2,080 series and 7,490,080
persisted samples. It is an independently authored resource envelope, not a typical-history claim or a
derivative of a private export.

Three fresh release-mode processes each import the archive into a new current-schema library, repeat the
exact archive, and query the production application boundary. The slowest process-level p95 must satisfy:

| Scenario | Target |
|---|---:|
| First dense-history import | ≤ 10 min |
| Exact dense-history reimport | ≤ 30 s |
| Peak process memory | < 1,536 MiB |
| Resulting SQLite library | ≤ 512 MiB |
| First 25 complete-history sessions, p95 | ≤ 500 ms |
| Four-series bounded signal overview, p95 | ≤ 500 ms |
| 250-sample exact signal page, p95 | ≤ 500 ms |

Every run must also preserve the exact session, series, sample, visual-bound, and page counts. The storage
limit applies to this exact workload after a WAL checkpoint; it is not a universal maximum library size.

## Query and visualization budgets

- Opening an already indexed default dashboard follows the common-navigation budget.
- Filtering common date ranges and sport categories follows the 500 ms p95 budget.
- Queries that exceed 500 ms expose progress or progressive results and remain cancellable.
- Downsampling or aggregation may improve rendering but must preserve displayed meaning and provide access to exact values.
- Visual interaction targets 60 frames per second; sustained work must not block the UI event loop in a way that causes visible input loss or frozen progress.

## Accessibility target

The product targets [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) using [WCAG2ICT](https://www.w3.org/TR/wcag2ict/) to interpret applicable criteria for non-web desktop software. WCAG2ICT explicitly covers native applications and Level A and AA guidance, but also notes that non-web accessibility can require measures beyond WCAG.

The MVP additionally requires:

- Complete keyboard operation without traps.
- Predictable focus order and visible focus.
- VoiceOver names, roles, values, state changes, and chart alternatives.
- No information conveyed by color alone.
- Text scaling and layout resilience.
- Reduced-motion support.
- Accessible error identification and recovery guidance.
- Exact tabular or textual alternatives for visualized values.
- Manual accessibility evaluation in addition to automated checks.

## Localization target

- 100% of scoped user-interface keys have valid `en-US` and `es-ES` resources.
- Missing keys, invalid placeholders, broken plural rules, and source literals outside catalogs block acceptance.
- Dates, times, durations, numbers, distances, weights, energy, and units use locale-aware formatting without changing domain semantics.
- Both locales pass the critical E2E journeys and text-expansion review.

## Reliability target

- Clean installation, every supported upgrade path, interrupted update, migration recovery, and removal pass on every supported platform before release.
- Data-loss, library-corruption, unrecoverable migration, and incorrect duplicate-creation defects have zero accepted occurrences.
- A failed import or update leaves a consistent supported state and actionable recovery information.
- Quality-gate retries do not convert a failure into a pass; flaky behavior remains a defect.

## Measurement automation

- Benchmarks run through versioned commands and produce machine-readable results.
- Continuous integration protects fast regression budgets; scheduled or release workflows run large-scale and platform-specific scenarios.
- Results are compared to a versioned baseline and identify the responsible phase or query.
- Measurements never publish personal data, raw routes, identifiers, or sensitive diagnostic values.

The implemented cold-launch, full-scale import, dense training-history, daily-activity, training-session,
route-report, sleep, recovery, and integrated longitudinal gates, synthetic scales, percentile policy,
timed boundaries, machine profile output, and interpretation limits are documented in the
[performance benchmark guide](development/performance-benchmarks.md).
