# ADR 0032: Use specialized analytical visualization engines

- **Status:** Accepted
- **Date:** 2026-08-26
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-006](../../requirements.md#fr-006--visualization),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality),
  [NFR-009](../../requirements.md#nfr-009--developer-experience-quality), and
  [NFR-023](../../requirements.md#nfr-023--measurable-quality-targets)
- **Related delivery plan:** [X7-R4](../../plans/mvp-redesign-production-migration.md#x7-r4--adopt-a-mature-analytical-visualization-foundation)
- **Related evidence:** [X7-R4 chart foundation evaluation](../../research/x7-r4-chart-foundation-evaluation.md)
- **Related architecture:** [Application stack](../application-stack.md),
  [training exploration](../training-exploration.md), and [reporting](../reporting.md)
- **Supersedes:** [ADR 0013](0013-render-mvp-visualizations-with-semantic-html.md)

## Context

ADR 0013 selected semantic HTML and CSS for bounded bars, compositions, timelines, and exact tables. It required a
new decision if FitFreed later needed dense plots, multiple scales, gaps, selection, zoom, or reusable analytical
graphics. The accepted exercise, longitudinal, and report experiences now need those capabilities. Continuing to add
application-owned paths, axes, hit testing, linked cursors, and scale calculations would make FitFreed maintain a
general chart engine and has already produced visually weak, inconsistent analytical surfaces.

Two different trusted runtimes render analytical evidence. React owns interactive views in the packaged WebKit
renderer. The Rust report-export adapter receives a complete application-authorized evidence projection and writes
the deterministic self-contained HTML file atomically. Allowing React to submit rendered SVG would invert that trust
boundary, while adding a JavaScript runtime to the Rust exporter would enlarge packaging and execution authority only
to reuse a browser renderer.

The decision does not turn every visual into a chart. Short categorical compositions, status summaries, exact tables,
and controls still benefit from native HTML semantics. Leaflet remains the separate local spatial adapter selected by
ADR 0026. No renderer may invent a shared coordinate, provider meaning, or unavailable value.

## Decision drivers

- Make dense and multi-unit evidence understandable through mature axes, scales, gaps, legends, selection, and zoom.
- Preserve exact keyboard- and assistive-technology alternatives as first-class evidence rather than canvas fallbacks.
- Keep chart-library configuration and imperative state outside application and domain contracts.
- Keep report export deterministic, script-free, external-request-free, and authorized entirely above its output port.
- Load analytical code only where needed and remain inside startup, interaction, memory, and complex-view budgets.
- Select GPL-3.0-compatible, actively maintained OSS with reviewable dependency and security evidence.
- Give contributors one explicit port per runtime instead of distributed chart geometry and library calls.

## Considered alternatives

### Continue with semantic HTML and application-owned SVG

Native semantics remain appropriate for bounded categorical views. They are no longer sufficient for the accepted
dense and interactive shapes. Extending the existing approach would preserve the exact dependency count by making
FitFreed itself the unversioned chart dependency, including axes, responsive scaling, gaps, selection, linked views,
and export geometry.

### Use uPlot, Observable Plot, or Vega-Lite for interactive charts

The production-shaped comparison found uPlot markedly smaller and faster, but its fixed Canvas axes cramped at 200%
and its static, semantic, and report paths required substantial application-owned work. Observable Plot produced
clear SVG lanes but lacked native linked selection and the required zoom foundation. Vega-Lite covered the shapes but
had the largest evaluated closure and render cost; strict CSP also required its interpreter. None offered a better
whole-product trade-off than Apache ECharts.

### Use Apache ECharts for both live and exported graphics

ECharts can return SVG in a JavaScript runtime. The current export port runs in Rust after application authorization,
owns atomic file output, and deliberately accepts no renderer markup. Moving report generation into React would make
presentation input authoritative. Embedding a separate JavaScript runtime in infrastructure would add a second
execution and packaging boundary. Both costs are disproportionate to deterministic report graphics.

### Use one Rust renderer for live and exported graphics

A Rust renderer can produce deterministic SVG, but using it for the live WebKit surface would require a new WASM or
native-image bridge plus product-owned interaction synchronization. It would not replace a mature browser interaction
engine and would make the ordinary React contributor loop substantially harder.

### Use ECharts interactively and Plotters for authorized static SVG

ECharts satisfies the live WebKit requirements behind a narrow React adapter. Plotters supplies a native Rust
`SVGBackend::with_string`, chart axes, labels, and series without a JavaScript runtime or presentation-supplied markup.
With bitmap, font-discovery, and unrelated series features disabled, the report adapter adds only the vector
functionality it needs.

## Decision

FitFreed uses two presentation-edge analytical renderers behind FitFreed-owned ports:

- Apache ECharts 6.1.0 renders live analytical views in React. It is loaded lazily and imported through
  `echarts/core` with only the accepted charts, components, features, and Canvas or SVG renderers.
- Plotters 0.3.7 renders deterministic analytical SVG inside the Rust self-contained report-export adapter. Default
  features are disabled; only the SVG backend and required series features are enabled. No bitmap encoder, system-font
  discovery, animation, JavaScript, or remote resource enters exported output.

The boundary is mandatory:

- Application and domain read models retain evidence identity, coordinates, values, units, gaps, coverage,
  provenance, and limitations. They never expose ECharts options, Plotters types, pixels, colors, or renderer state.
- One provider-neutral TypeScript analytical-chart model owns the live title, accessible description, axes, series,
  gaps, display formatting, selection intent, and renderer preference. Only one adapter translates it to ECharts.
- ECharts event payloads are translated immediately into FitFreed selection identities. Saved ranges, report
  definitions, navigation, and exact-evidence requests never retain a chart index or library object.
- Multiple signals share a live coordinate only when the application evidence establishes the same exact coordinate.
  Otherwise they remain separate charts and no visual proximity implies synchronization or causation.
- Canvas may carry dense marks but never exclusive meaning. Every analytical view retains localized native controls,
  exact values or a bounded exact table, explicit gaps and unavailable states, a non-color distinction, and a concise
  accessible description derived from the same model. Reduced-motion preference disables chart animation.
- Plotters receives only the already authorized report projection inside infrastructure. The adapter supplies fixed
  dimensions and local theme tokens, validates the generated SVG as script-free and external-reference-free, and
  embeds it beside the exact table derived from the same evidence. User-authored labels remain escaped data.
- Simple bounded categorical summaries may remain semantic HTML and CSS. This is a deliberate mixed strategy, not an
  exception that allows new ad hoc analytical geometry.
- Leaflet remains confined to route geometry. ECharts and Plotters cannot add tiles, network sources, geolocation,
  telemetry, plugins, or coordinate-bearing requests. The Tauri CSP remains unchanged.
- The exact versions remain pinned until a reviewed upgrade repeats licence, advisory, bundle, deterministic-output,
  packaged-WebKit, accessibility, localization, theme, and performance evidence.

## Consequences

### Positive

- Dense live evidence gains mature axes, scales, gaps, zoom, selection, and linked-view primitives.
- Static reports gain vector charts without trusting renderer input from React or embedding executable code.
- Inner layers and portable contracts remain renderer-independent and testable without WebKit or graphics libraries.
- Contributors work through stable FitFreed models while generic renderer mechanics stay with maintained OSS.
- The mixed policy preserves native HTML where it is still the clearest and most accessible representation.

### Negative

- The application carries separate live and static rendering dependencies and must verify their visual agreement.
- The evaluated ECharts analytical chunk adds approximately 205 KiB gzip when first opened.
- Exact alternatives, native interaction controls, localization, and accessibility remain FitFreed responsibilities.
- Renderer upgrades require packaged WebKit and deterministic-export evidence, not only dependency automation.

### Risks and mitigations

- **Live and exported graphics may drift.** Both adapters consume the same named evidence and formatting policy;
  contract tests compare axis domain, series order, gaps, labels, and exact values across adapters.
- **Canvas may hide meaning from assistive technology.** Native controls and exact evidence remain authoritative, and
  packaged Axe plus manual keyboard and VoiceOver gates cover the complete task rather than the canvas element alone.
- **Library objects may leak inward.** Architecture checks allow ECharts imports only in the live adapter and Plotters
  only in infrastructure; source scans reject library vocabulary in application, domain, transport, and data formats.
- **A chart may imply false alignment.** Model construction requires an explicit coordinate identity and rejects mixed
  exercise, role, or authority series before either renderer runs.
- **Bundle or rendering cost may grow silently.** Production chunk, dense-render, interaction, memory, report-size,
  and startup-shell budgets run for the pinned graph and block upgrades or accidental eager imports.
- **Generated SVG may contain unsafe or nondeterministic content.** Export tests reject scripts, event handlers,
  external references, timestamps, local paths, and unstable bytes and retain the exact table independently.

## Verification

The selection is supported by the packaged four-candidate comparison, official renderer documentation, isolated
licence and dependency inspection, strict-CSP execution, 200% visual review, accessibility analysis, and measured
load, render, interaction, memory, and static-output evidence recorded in the linked evaluation. Plotters 0.3.7 is
MIT-licensed and its official API provides a string-backed SVG backend and Cartesian chart builder; the production
dependency will enable only the required vector features.

Production acceptance additionally requires:

1. architecture checks for both renderer boundaries and lazy live loading;
2. model and adapter tests for axes, units, gaps, unavailable values, multiple scales, exact selection, mixed-coordinate
   rejection, locale, theme, reduced motion, and exact alternatives;
3. deterministic report tests for SVG structure, labels, axes, gaps, tables, escaping, cancellation, repeatability,
   absence of script or external references, and bounded output;
4. packaged routed, non-routed, dense-signal, sparse-history, partial-evidence, report, light/dark, both-locale,
   keyboard, 200%, Axe, and restart journeys; and
5. dependency, licence, SBOM, production-package, chunk, render, interaction, memory, and export-size gates.

A renderer object crossing inward, an inaccessible canvas-only fact, fabricated alignment, external request,
presentation-authored report SVG, CSP relaxation, uncontrolled dependency growth, or missed quality budget reopens
the decision before X7-R4 can complete.
