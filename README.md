# FitFreed

![FitFreed — Your fitness data, freed](assets/brand/fitfreed-logo.svg)

**Turn the fitness history you can download into a history you can actually use.**

FitFreed is a local-first, open-source desktop application for importing personal fitness exports,
finding sessions and patterns across years, inspecting the evidence behind them, and keeping useful
results outside the platform that recorded them.

[Visit the product site](https://fitfreed.org/) · [Review the roadmap](docs/roadmap.md) ·
[Evaluate the current source](docs/user/development-preview.md) · [Contribute](CONTRIBUTING.md)

> **No supported release is available yet.** The current source contains the tested macOS engineering
> baseline and the implemented MVP experience. The independent machine-assisted audit has passed; production-native
> human evaluation and exact-candidate acceptance remain in progress. Real
> personal exports remain outside the public-evaluation boundary until an exact release candidate
> passes its privacy, installation, update, and usability gates.

## A downloaded archive is not practical freedom

Data access matters, but a ZIP full of machine-readable files is difficult to explore and easy to
abandon. Useful ownership means being able to understand a history, preserve it when a provider
changes, inspect every transformation, and move the result again.

FitFreed's founding argument is:

> **GDPR-enabled portability + open-source software = meaningful user freedom.**

The GDPR is an enabling legal foundation, not a product endorsement. FitFreed is not a legal
service, compliance product, medical device, or diagnostic tool. The precise argument and its
sources live in the [product thesis](docs/product-thesis.md).

## Find it. Understand it. Keep it.

### Find the part of your history that matters

Explore the sports, years, sessions, routes, and available context in one provider-neutral library.
Search and compare without knowing the source format, and return from detail to the exact filters,
view, position, and selection that led there.

### Understand what happened

Move from a whole history to a sport, a session, its structure, temporal signals, route, and exact
values. Recorded facts, FitFreed calculations, personal interpretation, missing measurements, and
unsupported conclusions remain visibly different.

### Keep more than a screenshot

Compose evidence and your own words into a saved, reproducible report. Review how later imports can
change it, inspect sensitive location or physiological content, and export an independently useful
artifact under your control.

The sports, session-evidence, map-led route, navigation, personal-range, and result-first report
experiences are implemented in the current source. Whole-product hardening has passed its independent
machine-assisted audit; production-native human evaluation is tracked in the [active delivery
plan](docs/plans/mvp-redesign-production-migration.md).
The evidence boundary remains explicit in the
[experience assessment](docs/research/mvp-experience-boundary-assessment.md), while release readiness
is governed independently by the [current ledger](docs/testing/public-release-readiness.md).

## Where the project stands

<!-- product-status:start -->
<details data-status="available">
<summary><strong>Implemented in source — Current capability</strong></summary>
<ul>
<li>Polar Flow ZIP validation and import</li>
<li>Explicit supported, ignored, and unrecognized coverage</li>
<li>Safe exact and cumulative reimport</li>
<li>Provider-neutral SQLite history for activity, training summaries, structure, routes, signals, sleep, and recovery</li>
<li>Immediate coverage-aware daily activity answers and bounded visual comparisons</li>
<li>Personal sport naming and complete-history session search without exposing provider identifiers</li>
<li>Reusable personal sport combinations across later imports and versioned normalization for documented provider equivalences</li>
<li>Chronology, source-separated calendar discovery, session comparison, and restart restoration</li>
<li>Recorded exercise, mixed-sport, source-lap, automatic-lap, and pause inspection</li>
<li>Interactive local primary and transition route workbench with route-point selection, local map navigation, and exact route evidence</li>
<li>Gap-aware supported signal charts with paginated exact samples</li>
<li>Exact recorded heart-rate, speed, and power zones with applicable aggregates</li>
<li>Reusable personal segment criteria with exact locally derived session views</li>
<li>Result-led Library Home with complete span, current sport identities, recent exact sessions, conservative comparison or historical fallback, and precise post-import outcomes</li>
<li>Persistent navigation, offline export guidance, and allowlisted official links</li>
<li>Durable language, appearance, and content zoom settings</li>
<li>en-US and es-ES, packaging, update recovery, and release-shaped tests</li>
<li>On-demand privacy-bounded session provenance and reconciliation history</li>
<li>Selectable same-role signal alignment with exact sample paths</li>
<li>Composable session and route reports with privacy-reviewed self-contained HTML export</li>
<li>Result-first training-period answers with human-scale visuals, exact values, coverage, and report handoff</li>
<li>Result-first sleep-period answers with recorded-night coverage, human-scale visuals, exact evidence, and night detail</li>
<li>Result-first recovery-period answers with factual interval relationships, source boundaries, exact evidence, and no medical interpretation</li>
<li>Result-first aligned-history answers with four-lane daily evidence, exact cross-domain navigation, factual period comparisons, and an explicit non-causality boundary</li>
<li>Coherent question-led entry, exact initiating-control focus, and Home return across all five History Answer Canvases</li>
<li>Result-first report library with four curated evidence-aware examples, contextual starts, independent duplication, and compatible reopening</li>
<li>Deliberate stale-report refresh through an exact current-evidence review</li>
<li>Origin-aware navigation between saved reports and their exact session or comparison source</li>
</ul>
<p><a href="docs/roadmap.md#milestone-2--mvp">MVP capability boundary →</a></p>
</details>

<details data-status="active" open>
<summary><strong>Work in progress — MVP release preparation and human evaluation</strong></summary>
<ul>
<li>Exact current-source package, installation, update, recovery, and performance validation completed</li>
<li>Exact independent audit and native candidate gates passed; bounded product-owner experience evaluation pending</li>
<li>Trustworthy automatic Polar sport recognition after official catalogue retrieval and lawful redistribution or reviewed local-only acquisition</li>
</ul>
<p><a href="docs/plans/mvp-redesign-production-migration.md">Active production migration plan →</a></p>
</details>

<details data-status="later">
<summary><strong>Later scope — Outside the current MVP</strong></summary>
<ul>
<li>Additional providers and live APIs</li>
<li>Linux and Windows distribution</li>
<li>Local MCP access for authorized agents</li>
<li>Advanced encryption and extension systems</li>
<li>Collaborative or hosted analytics</li>
<li>Features without validated user value</li>
</ul>
<p><a href="docs/roadmap.md#evolution-tracks-after-the-mvp">Post-MVP evolution tracks →</a></p>
</details>

<!-- product-status:end -->

Polar Flow is the first importer, not the product identity. Provider-specific formats stay at the
source boundary; the domain, reports, and owned library remain provider-neutral.

## Private by architecture

- Core use is local-first, offline-capable, and requires no FitFreed account.
- Personal exports, routes, reports, logs, and derived personal data never belong in this repository.
- Exact values and limitations remain available beside visual summaries.
- Original source evidence, normalized facts, calculations, and user-authored material stay
  distinguishable.
- Open, versioned formats and recoverable migrations prevent FitFreed from becoming another silo.

## Built in the open, for the long term

FitFreed uses Tauri 2, Rust, React, SQLite, Clean Architecture, and Domain-Driven Design. Unit,
integration, contract, packaged end-to-end, accessibility, performance, installation, update, and
recovery evidence protect each runnable vertical increment.

A project without contributors is a product with an expiry date. The repository therefore treats
contributor setup, architecture, data contracts, testing, localization, troubleshooting, and
decision records as product capabilities rather than cleanup work.

Start here:

- [Contributor setup](docs/development/getting-started.md)
- [Architecture module map](docs/architecture/module-map.md)
- [Data-format specifications](docs/data-formats/README.md)
- [Testing strategy](docs/testing-strategy.md)
- [Documentation by audience](docs/README.md)
- [Contribution guide](CONTRIBUTING.md)

## Independence, risk, and licence

FitFreed is independent and is not affiliated with, endorsed by, or sponsored by Polar Electro,
Garmin, the European Union, or any regulator. It is experimental software supplied without warranty;
read the [at-your-own-risk disclaimer](DISCLAIMER.md) and [support policy](SUPPORT.md) before running a
build.

FitFreed is licensed under the [GNU General Public License v3.0 or later](LICENSE).
