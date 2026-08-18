# FitFreed

![FitFreed — Your fitness data, freed](assets/brand/fitfreed-logo.svg)

**Turn the fitness history you can download into a history you can actually use.**

FitFreed is a local-first, open-source desktop application for importing personal fitness exports,
finding sessions and patterns across years, inspecting the evidence behind them, and keeping useful
results outside the platform that recorded them.

[Visit the product site](https://purnalica.github.io/fitfreed/) · [Review the roadmap](docs/roadmap.md) ·
[Evaluate the current source](docs/user/development-preview.md) · [Contribute](CONTRIBUTING.md)

> **No supported release is available yet.** The current source contains a tested macOS engineering
> baseline, while the training-first experience shown in the product direction is active work. Real
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

The complete sports, deep-session, navigation, and report experience is the active product
direction. Its recommended MVP boundaries are explicit in the
[experience assessment](docs/research/mvp-experience-boundary-assessment.md); they are not presented
as already implemented production behavior.

## Where the project stands

<!-- product-status:start -->
| Available in source | Active experience work | Deliberately later |
|---|---|---|
| Polar Flow ZIP validation and import | Question-led home and post-import reveal | Additional providers and live APIs |
| Explicit supported, ignored, and unrecognized coverage | Sports and full-history session discovery | Linux and Windows distribution |
| Safe exact and cumulative reimport | Routed and non-routed session evidence workspaces | Local MCP access for authorized agents |
| Provider-neutral SQLite history for activity, training summaries, sleep, and recovery | Persistent settings and origin-aware navigation | Advanced encryption and extension systems |
| Bounded visual comparison and longitudinal context | Saved evidence reports with self-contained HTML export | Collaborative or hosted analytics |
| en-US and es-ES, packaging, update recovery, and release-shaped tests | A coherent, evaluated, documented macOS product journey | Features without validated user value |

Status sources: [MVP capability boundary](docs/roadmap.md#milestone-2--mvp) · [Active experience delivery plan](docs/plans/mvp-experience-delivery.md) · [Post-MVP evolution tracks](docs/roadmap.md#evolution-tracks-after-the-mvp).
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
