# Performance Benchmarks

## Purpose and status

The versioned performance gates protect the current daily-activity and training-session Insights paths against the budgets in the [quality targets](../quality-targets.md). They use independently authored deterministic data, exercise production boundaries, emit one machine-readable JSON object per gate, and return a non-zero status when a budget is exceeded.

These gates establish regression evidence on the machine that runs them. They do not yet prove the provisional Apple Silicon, 8 GB minimum profile. Cold launch, full-scale import, update, sleep, and recovery retain their own open performance gates.

## Application read-model benchmark

Run:

```sh
npm run benchmark:insights
```

The release-mode Rust example creates a temporary schema-version-6 SQLite library through the production migration path, generates ten calendar years for four opaque origins, and inserts deterministic daily observations and one training session per origin and date. Daily activity includes available, unavailable, and missing observations; training includes varied durations and deterministic optional distance, energy, heart-rate, sport-reference, and exercise-count coverage. No generated database survives the process.

It measures the SQLite adapter plus application read model separately for daily activity and training sessions. Each domain covers:

- the default 30-day overview;
- an explicit common 30-day filter;
- the maximum supported filter;
- a common 30-day two-period comparison;
- a maximum-range two-period comparison.

Each interaction has 10 warm-up executions and 100 measured executions. Durations are sorted and p95 uses zero-based index `ceil((n - 1) * 0.95)`. Default and common interactions must remain within 500 ms p95; maximum-range interactions must remain within the 2-second complex-visualization budget. The output reports application version, source revision, host profile, free storage, generated scale, database size, run policy, median, p95, maximum, budget result, and peak process memory.

## Packaged UI benchmark

`npm run verify:e2e` generates a separate two-year provider archive containing deterministic activity gaps, unavailable daily values, and one varied training session per date. It imports the archive through the packaged application and measures both domains inside the macOS WebView. The timed interval starts immediately before form submission and ends on the animation frame after the expected exact table has rendered. It therefore contains the real Tauri command, SQLite and application work, transport, React update, and WebView rendering; WebDriver transport and fixture setup remain outside the interval.

For each domain, the packaged journey uses four warm-up runs, 20 measured common filters, seven measured maximum filters, and 20 measured common comparisons. It applies the same percentile calculation and p95 budgets as the read-model benchmark. It also verifies both maximum 366-day presentations at 200% text size without horizontal page overflow. The run emits a second machine-readable JSON object with its host, source, scenario, method, per-domain measurements, and results.

## Automation and evidence handling

`npm run verify:full` includes both gates. The macOS GitHub Actions job runs the read-model benchmark explicitly and then the packaged journey, so local and hosted paths share the same versioned commands. A budget failure is not retried or converted into a pass.

Generated archives, databases, raw benchmark output, screenshots, and logs remain ignored local or short-lived CI evidence. Only the synthetic generators, executable assertions, budgets, and methodology are versioned. Do not replace them with a provider export or values derived from one.

When investigating a regression, first separate query, application-model, transport, React, render, and test-controller time. Changing a budget requires measured evidence, impact analysis, and an explicit product decision; test-runner overhead is not product latency.
