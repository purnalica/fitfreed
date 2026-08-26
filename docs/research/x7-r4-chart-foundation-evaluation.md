# X7-R4 Chart Foundation Evaluation

## Status

The production-shaped decision spike completed on 2026-08-26. It selected Apache ECharts 6.1.0 as the
presentation-only live analytical chart engine. A subsequent export-boundary review selected Plotters 0.3.7 for
authorized static SVG inside the Rust report adapter. [ADR 0032](../architecture/decisions/0032-use-specialized-analytical-visualization-engines.md)
records the accepted mixed rendering boundary; production migration remains in progress.

This document is the canonical selection evidence for the X7-R4 decision spike. Raw builds, screenshots, process
measurements, and candidate lockfiles remain ignored local artifacts under the repository-content policy.

## Product-shaped question

FitFreed needs one maintainable foundation for dense exercise signals, sparse longitudinal series, missing data,
multiple units and scales, exact selection, linked views, localization, themes, accessible alternatives, and
deterministic report graphics. The chart engine must remain confined to presentation; provider, domain, application,
persistence, and portable contracts must continue to express evidence rather than library configuration.

The spike compared:

- Apache ECharts 6.1.0;
- uPlot 1.6.32;
- Observable Plot 0.6.17; and
- Vega 6.4.0 with Vega-Lite 6.4.3 and the CSP-compatible Vega interpreter 2.3.2.

## Method

Each candidate ran in its own packaged Tauri macOS WebKit process against the same independently generated evidence:

- one 20,001-point exercise with four differently scaled signals and explicit gaps;
- one sparse 366-day longitudinal series;
- one deterministic report comparison graphic;
- exact accessible tabular evidence;
- linked or equivalent exact selection behavior; and
- a 1,280 by 788 viewport at 200% content zoom.

The harness retained FitFreed's strict content-security policy, performed no external request, captured production
chunk size, module-import time, render time, interaction time, process resident-memory change, DOM size, static-export
format and size, horizontal overflow, and an Axe audit. These comparative local measurements establish candidate
behavior in packaged WebKit; they do not claim the minimum supported hardware profile.

## Results

| Candidate | Gzip-loaded chunks | Import | Render | Interaction | Resident-memory change | Static output | Accessibility result |
|---|---:|---:|---:|---:|---:|---|---|
| Apache ECharts | 204,860 B | 16 ms | 105 ms | 22 ms | 1,536 KiB | 3,127 B SVG | No Axe violation |
| uPlot | 25,341 B | 9 ms | 17 ms | 30 ms | 288 KiB | 79,842 B PNG data URL | No Axe violation |
| Observable Plot | 97,431 B | 15 ms | 77 ms | 22 ms | 464 KiB | 4,035 B SVG | One `aria-prohibited-attr` violation |
| Vega-Lite | 279,548 B | 22 ms | 475 ms | 26 ms | 1,856 KiB | 14,718 B SVG | No Axe violation |

All candidates remained below the applicable two-second complex-visualization budget and avoided page-level
horizontal overflow. The differences that determine fitness for the product are structural rather than raw speed:

- **Apache ECharts** supplied native independent scales, linked selection, Canvas for dense signals, SVG for sparse
  and static output, gaps, explicit component imports, and ARIA facilities. The 200% multi-axis view remained usable.
- **uPlot** was substantially smaller and faster, but its fixed Canvas axes became cramped at 200%, static output was
  raster, and the evaluated report and accessibility path would require FitFreed to own more custom rendering and
  semantics. It is an excellent narrow time-series renderer, not the complete required visualization foundation.
- **Observable Plot** produced clean separated SVG lanes, but did not provide native linked selection or the required
  pan-and-zoom foundation. The candidate needed custom interaction code, and its evaluated dark tooltip required
  product-specific correction. It is better suited to concise declarative graphics than the complete exercise
  workbench.
- **Vega-Lite** covered the interaction and rendering shapes, but its dependency closure, loaded size, and render cost
  were the largest. Vega's default expression compiler uses the `Function` constructor and failed under FitFreed's
  CSP. The official interpreter restored strict-CSP operation without weakening policy, at the cost of another runtime
  dependency and the interpreter overhead documented by Vega.

## Licence, maintenance, and supply-chain evidence

The isolated candidate lock contained 3 packages for the ECharts closure, 1 for uPlot, 42 for Observable Plot, and 79
for the evaluated Vega-Lite stack. Every declared licence was Apache-2.0, BSD-3-Clause, ISC, MIT, 0BSD, or Unlicense;
the GNU licence guidance identifies the evaluated permissive licences, including Apache License 2.0 with GPLv3, as
compatible with GPL-3.0-or-later. The isolated production audit reported no known vulnerability on 2026-08-26. That
snapshot complements rather than replaces the repository's continuing dependency, licence, and release audits.

Apache ECharts also has the strongest match for long-term project stewardship in this comparison: it is an active
Apache project with published releases, a security policy, documented tree-shakable imports, and maintained Canvas,
SVG, server-rendering, and accessibility guidance.

The report exporter cannot safely reuse browser output: its Rust application port authorizes exact evidence and its
infrastructure adapter owns deterministic atomic output without accepting presentation markup. Plotters 0.3.7 was
therefore reviewed as a separate static-runtime decision. Its MIT-licensed official API provides Cartesian chart
construction and an SVG backend that writes into a string, while disabled default features avoid bitmap encoding,
font discovery, and unrelated rendering backends. This keeps static chart mechanics in maintained OSS without adding
a JavaScript runtime or moving export authority into React.

Primary sources:

- [Apache ECharts Canvas and SVG guidance](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
- [Apache ECharts SVG server rendering](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/)
- [Apache ECharts accessibility guidance](https://echarts.apache.org/handbook/en/best-practices/aria/)
- [Apache ECharts tree-shakable imports](https://echarts.apache.org/handbook/en/basics/import/)
- [Apache ECharts releases](https://github.com/apache/echarts/releases)
- [uPlot repository and documentation](https://github.com/leeoniya/uPlot)
- [Observable Plot accessibility](https://observablehq.com/plot/features/accessibility)
- [Observable Plot pointer interaction](https://observablehq.com/plot/interactions/pointer)
- [Observable Plot interaction boundaries](https://observablehq.com/plot/features/interactions)
- [Vega CSP interpreter](https://vega.github.io/vega/usage/interpreter/)
- [Plotters repository and feature boundary](https://github.com/plotters-rs/plotters)
- [Plotters string-backed SVG API](https://docs.rs/plotters/latest/plotters/backend/struct.SVGBackend.html)
- [Plotters Cartesian chart builder](https://docs.rs/plotters/latest/plotters/chart/struct.ChartBuilder.html)
- [GNU licence compatibility](https://www.gnu.org/licenses/license-compatibility.en.html)
- [GNU licence list](https://www.gnu.org/philosophy/license-list.html)

## Recommendation and continuation point

Use Apache ECharts behind a FitFreed-owned live analytical-chart port and evidence DTO. Load it only on analytical
surfaces, import only the required charts, components, and renderers, and preserve native controls and exact tables as
the keyboard and assistive-technology contract. Use Canvas for dense live signals and SVG where sparse live vector
output is the better fit. Use feature-limited Plotters inside the Rust report adapter for deterministic static SVG.
No renderer object may cross inward from its presentation or infrastructure edge.

The continuation sequence is:

1. add the exact ECharts and feature-limited Plotters dependencies plus automated licence boundaries;
2. introduce the provider-neutral live chart port and both renderer adapters through TDD;
3. migrate analytical exercise, linked route-signal, longitudinal, and report graphics while retaining exact
   alternatives; and
4. implement and verify route-relative zoom bounds before completing X7-R4.

As of 2026-08-26, the live adapter and the exercise, cross-signal, conditional linked route-signal, and longitudinal
migrations in steps 2 and the live portion of step 3 are implemented. Static report graphics and route-relative zoom
bounds remain before X7-R4 can close.

Simple bounded categorical summaries may remain semantic HTML when that is clearer and more accessible. Leaflet
remains the local route-workbench renderer. The decision does not authorize external tiles, network requests,
fabricated shared coordinates, or library types outside presentation.
