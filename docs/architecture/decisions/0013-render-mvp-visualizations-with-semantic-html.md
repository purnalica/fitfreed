# ADR 0013: Render MVP visualizations with semantic HTML

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Application stack](../application-stack.md)

## Context

FitFreed must make gaps, optional measurements, multiple independent origins, exact values, and period comparisons understandable without treating a chart as the source of truth. The MVP visualizations cover bounded activity, training, sleep, recovery, and aligned longitudinal views. They need responsive 200% text behavior, keyboard access where interaction exists, non-color alternatives, locale-aware values, and predictable rendering inside the macOS WebView.

The implemented views use short bounded series and simple bars, compositions, timelines, and aligned lanes. They do not require free-form plotting, zooming, spatial selection, or millions of rendered marks.

## Decision drivers

- Every visual claim must have an exact accessible representation.
- Missing, unavailable, and zero values must remain distinct.
- Presentation dependencies must earn their security, bundle, localization, and contributor cost.
- The current bounded series must meet packaged interaction and rendering budgets.
- Visual treatment must remain replaceable without changing application read models.

## Considered alternatives

### Adopt a general charting library

A charting library offers broader geometry and interaction primitives. For the current bounded bar, composition, and lane views, it adds a production dependency and accessibility behavior without removing the obligation to provide exact tables and semantic controls.

### Build canvas or custom SVG charts

Canvas and SVG allow precise drawing and larger plotting surfaces, but introduce a parallel focus, labeling, scaling, and hit-testing model. The MVP does not contain an interaction or mark-density requirement that justifies that model.

### Use semantic HTML and CSS with exact alternatives

Native lists, figures, buttons, tables, and CSS tracks cover the accepted visual vocabulary while preserving browser semantics and ordinary responsive layout.

## Decision

MVP visualizations use React-rendered semantic HTML and CSS without a production charting dependency.

- Application use cases return provider-neutral, visualization-ready read models; CSS width or layout calculations stay in presentation helpers.
- Every visualization is paired with an exact localized table or equivalent textual values. A redundant decorative visual is hidden from assistive technology; an interactive datum is a real labeled control.
- Visual state never relies on color alone. Missing, unavailable, and zero values remain explicit in the exact representation.
- Wide exact tables scroll inside labeled, keyboard-focusable containers. Layout must remain usable at 200% text size without page-level horizontal overflow.
- Motion respects reduced-motion preferences. Locale formatting applies to both visual labels and exact alternatives.
- A future charting, SVG, canvas, or virtualization dependency requires measured geometry, interaction, or scale needs that the semantic implementation cannot satisfy within the established budgets. It must preserve the same read-model and exact-alternative contracts.

## Consequences

### Positive

- The production dependency graph stays small and the accessibility model remains inspectable.
- Exact values, gaps, and optional coverage cannot disappear behind graphical approximation.
- Contributors can change presentation without learning a chart-specific data model.

### Negative

- Complex axes, dense plots, brushing, and zooming would require additional implementation or a later decision.
- CSS layout and visual scaling helpers remain FitFreed maintenance responsibilities.

### Risks and mitigations

- A decorative chart could drift from its table. Component and packaged tests assert both from the same read model.
- Responsive CSS could hide controls or exact values. The packaged journey exercises controls, keyboard-accessible containers, and 200% text sizing.
- Native semantics alone do not guarantee accessibility. Automated analysis and manual keyboard, VoiceOver, contrast, and usability evaluation remain release gates.

## Verification

React tests cover missing, unavailable, zero, multi-origin, filtering, detail, comparison, and locale behavior. Packaged macOS E2E drives every included control, compares visible summaries and exact tables, runs automated accessibility analysis, and checks 200% text sizing. Synthetic performance gates cover all four detailed views and the integrated longitudinal view. A required visualization that exceeds the documented two-second budget after bounded read-model work, or a product need for dense spatial interaction, triggers reconsideration.
