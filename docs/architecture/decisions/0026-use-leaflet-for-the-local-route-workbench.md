# ADR 0026: Use Leaflet for the local route workbench

- **Status:** Accepted
- **Date:** 2026-08-22
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-006](../../requirements.md#fr-006--visualization),
  [FR-025](../../requirements.md#fr-025--evidence-complete-session-exploration),
  [NFR-002](../../requirements.md#nfr-002--privacy-of-reference-data),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality),
  [NFR-009](../../requirements.md#nfr-009--developer-experience-quality), and
  [NFR-023](../../requirements.md#nfr-023--measurable-quality-targets)
- **Related delivery plan:** [MVP redesign production migration](../../plans/mvp-redesign-production-migration.md)
- **Related architecture:** [Training exploration](../training-exploration.md),
  [ADR 0013](0013-render-mvp-visualizations-with-semantic-html.md)

## Context

ADR 0013 selected semantic HTML and CSS for the original bounded bars, compositions, timelines, and
aligned lanes. It explicitly requires reconsideration when a product need introduces dense spatial
interaction. The accepted outdoor-session experience has now crossed that boundary: the recorded route is
the dominant workspace and must support pointer and keyboard pan, zoom, complete-track reset, selected
position, route-role discontinuities, signal gaps, direction, start and finish, synchronized elapsed
evidence, focused viewing, and responsive restoration.

The spatial surface remains deliberately narrower than a general map product. The MVP draws only recorded
local geometry over a neutral geographic context. It does not load a basemap, request a tile, contact a
geocoder, invent a place label, locate the current device, or send a coordinate outside the process. Exact
coordinates and samples remain behind deliberate disclosure, and the complete semantic value strip, elapsed
control, signal lanes, and exact table remain authoritative accessible paths outside the spatial renderer.

This decision therefore evaluates one bounded presentation adapter. It does not change the provider-neutral
Session Story application contract, route persistence, exact pagination, privacy authority, or any non-route
visualization.

## Decision drivers

- Deliver map-quality pan, zoom, fit, projection, pointer, and keyboard behavior without making FitFreed the
  maintainer of a general interaction engine.
- Keep map selection synchronized with the application-owned elapsed position and exact evidence.
- Preserve keyboard parity, VoiceOver comprehension, 200% content zoom, reduced motion, and a non-spatial
  structured alternative.
- Remain reliable in the Tauri macOS WebView without WebGL, workers, network sources, or a relaxed content
  security policy.
- Add the smallest justified production and contributor surface and keep it isolated behind a replaceable
  presentation component.
- Retain complete offline privacy and make accidental location egress testable.

## Measured evidence

The evaluation used the stable packages available on 2026-08-22: Leaflet 1.9.4, OpenLayers 10.10.0, and
MapLibre GL JS 6.5.0. All three use permissive BSD licenses compatible with FitFreed's GPL distribution.
Leaflet 1.x remains actively supported while 2.x is a prerelease according to the
[maintainer's current release guidance](https://github.com/Leaflet/Leaflet/discussions/10138).

A fresh temporary installation bundled and minified the smallest route-relevant ESM entry for each candidate
with esbuild 0.25.9 for a browser target, then added its minified required stylesheet. Gzip used level 9. The
entries included map/view construction, a vector line, point markers or features, fit bounds, and default
interaction controls; they excluded application code, source maps, tiles, plugins, and imagery.

| Candidate | Minified JS + CSS | Gzip | Direct runtime dependencies | Rendering/runtime boundary |
|---|---:|---:|---:|---|
| Existing custom SVG projection | 531 B built chunk | 353 B | 0 | DOM/SVG; fit-to-frame and anti-meridian unwrapping only |
| Leaflet 1.9.4 | 161,381 B | 46,093 B | 0 | DOM/SVG with built-in pointer, touch, wheel, and keyboard map navigation |
| OpenLayers 10.10.0 | 275,316 B | 80,189 B | 6 | Canvas-oriented GIS map and interaction platform |
| MapLibre GL JS 6.5.0 | 1,029,317 B | 258,025 B | 15 | WebGL2, worker, style, and tiled-GeoJSON platform |

The current custom helper is intentionally small, but its 34 source lines and two tests implement neither a
viewport nor an interaction model. Reaching accepted parity would make FitFreed own projection edge cases,
drag and wheel gestures, touch behavior, keyboard pan and zoom, focus recovery, bounds, scale, hit testing,
resize invalidation, and platform regressions. Its byte advantage does not offset that permanent ownership
for the product's highest-value outdoor interaction.

The maintained alternatives were also compared against their official behavior and the FitFreed boundary:

| Criterion | Custom semantic SVG | Leaflet | OpenLayers | MapLibre GL JS |
|---|---|---|---|---|
| Pan, zoom, fit, and resize | Entirely application-owned | Built in and independently controllable | Built in | Built in |
| Synchronized route selection | Direct but all hit testing is owned | Map events and coordinate/container transforms; elapsed identity remains FitFreed-owned | Map events and pixel/coordinate transforms | Map events and rendered-feature queries |
| Keyboard parity | Entirely application-owned | Focusable map with arrow and `+`/`-` navigation; FitFreed still owns elapsed traversal | Default keyboard pan/zoom when its target retains focus | Default keyboard camera controls; exact point traversal still external |
| Accessibility | Inspectable SVG, but every role and interaction must be built | Documented keyboard-operable container and markers; exact structured alternative still required | Canvas needs a separate semantic interaction and value surface | WebGL canvas needs a separate semantic interaction and value surface |
| WebView risk | Lowest; already proven for static traces | Low: DOM/SVG, no worker or graphics context | Moderate: Canvas and a broader event/render lifecycle | Highest: WebGL2, workers, style lifecycle, and CSP changes |
| Contributor surface | Small dependency graph, large FitFreed-owned engine | Narrow documented API and no runtime dependency graph | Broad GIS API and six direct dependencies | Broad rendering/style/worker API and fifteen direct dependencies |
| Offline privacy | Intrinsic | Intrinsic when tile, geolocation, popup HTML, and remote layers are prohibited | Requires the same source restrictions | Requires a deliberately local style/source/worker configuration |

Leaflet's [reference](https://leafletjs.com/reference) documents SVG vector rendering, fit and bounds,
keyboard pan and zoom, wheel and touch interaction, and map events. Its
[accessibility guide](https://leafletjs.com/examples/accessibility/) documents keyboard-operable map and
marker defaults while still requiring application testing. OpenLayers documents its
[keyboard pan interaction](https://openlayers.org/en/latest/apidoc/module-ol_interaction_KeyboardPan-KeyboardPan.html)
and [client-side vector layer](https://openlayers.org/en/latest/apidoc/module-ol_layer_Vector-VectorLayer.html).
MapLibre describes itself as a [WebGL renderer](https://maplibre.org/maplibre-gl-js/docs) and its current
map options require a WebGL context and add a worker-oriented source lifecycle. Those capabilities are useful
for cartography and tiled spatial data, but do not improve FitFreed's bounded recorded-track task.

The existing production build is split by workspace: the Training chunk is loaded only when that experience
is opened. The Leaflet cost can remain in the session-workbench chunk rather than the interactive startup
shell. FitFreed has no general compressed-byte budget, so the decision remains governed by cold-launch,
interaction, memory, and dense-session budgets rather than an arbitrary package-size target.

## Considered alternatives

### Extend the application-owned semantic SVG renderer

This preserves the smallest dependency graph and offers direct SVG control. It was rejected because the
accepted workbench would turn a static projection helper into a general viewport and gesture engine. The
result would duplicate mature interaction behavior at greater accessibility, platform, test, and contributor
cost precisely where outdoor-session quality is a primary adoption requirement.

### Use OpenLayers

OpenLayers is actively maintained, GPL-compatible, modular, and capable of local vector-only maps. It was
rejected because FitFreed needs a bounded route viewport rather than the broader projection, source, layer,
format, and GIS feature set. The measured route entry costs materially more than Leaflet, uses a canvas-first
semantic boundary, and does not remove the application-owned synchronized-evidence work.

### Use MapLibre GL JS

MapLibre is actively maintained, GPL-compatible, and appropriate for rich styled cartography and large tiled
data. It was rejected because the MVP deliberately has no tiles or basemap and gains no value from its style,
worker, and WebGL2 pipelines. Its measured entry is over five times Leaflet's gzip cost, would require a new
WebView graphics and CSP risk boundary, and still needs a separate accessible exact-selection surface.

### Use Leaflet for one local vector-only viewport

Leaflet supplies the mature interaction and geographic projection primitives that the accepted experience
requires while retaining an SVG renderer, a narrow API, no runtime dependency graph, and no inherent need for
network data. FitFreed continues to own evidence meaning, elapsed alignment, selection identity, privacy,
semantics, layout, and exact alternatives.

## Decision

FitFreed will use stable Leaflet 1.9.4 for one lazily loaded, local, vector-only route-workbench adapter.
`@types/leaflet` is a development dependency. The boundary is mandatory:

- Leaflet may exist only in the route spatial component and its presentation helpers. Domain, application,
  infrastructure, transport schemas, reports, and non-route charts cannot import or expose Leaflet types.
- The component receives the bounded, revision-coherent route and aligned evidence already returned by
  `SessionStory`. It performs no independent command or persistence query and invents no interpolation,
  measurement, segment, or sport meaning.
- The component creates no `TileLayer`, remote layer, geocoder, geolocation control, telemetry, plugin,
  remote icon, or popup from source-authored HTML. It imports Leaflet code and CSS from the packaged
  application only. Content security policy remains unchanged.
- Primary routes, transition routes, and exercises are separate polylines and are never bridged. Canonical
  route version 1 contains no source-authored intra-route break; missing elapsed time prevents synchronization
  but does not prove a geometric break. Anti-meridian unwrapping, exact source ordinals, and missing elapsed
  positions remain explicit presentation inputs rather than being hidden by renderer normalization.
- Leaflet owns spatial pan, zoom, fit, resize, pointer projection, and metric scale. FitFreed owns the selected
  recorded point, elapsed traversal, direction/start/end/selected symbols, overlay legend, focus/full-screen
  state, reset behavior, and origin restoration.
- The map is one representation of the current selection. A native elapsed-position control, attached value
  strip, semantic signal lanes, status text, and exact paginated table expose the same state without relying
  on pointer use, spatial perception, or color.
- Arrow keys pan only while the map surface is focused. The application provides named controls for zoom in,
  zoom out, reset to the complete track, and enter/leave focused view; recorded-point traversal uses its own
  native control so map navigation and evidence navigation never compete for the same keys.
- The default renderer is SVG. Canvas is not an undocumented performance escape: changing renderer requires
  dense-session evidence plus renewed accessibility and synchronization review.
- Stable Leaflet 1.x remains pinned until an explicit dependency upgrade evaluates the breaking 2.x line,
  licenses, advisories, bundle impact, packaged WebView behavior, and all workbench tests.

ADR 0013 remains accepted for every non-spatial visualization. This decision is a bounded exception, not a
general charting or mapping dependency policy.

## Consequences

### Positive

- FitFreed can spend implementation effort on recorded-evidence exploration instead of rebuilding generic
  map mechanics.
- The route surface retains DOM/SVG rendering and does not add WebGL, workers, remote cartography, or runtime
  transitive dependencies.
- The library remains replaceable because no Leaflet type crosses the presentation adapter.
- The dependency loads with the detailed Training workspace rather than the first interactive shell.

### Negative

- The route experience adds approximately 46 KiB gzip before FitFreed workbench code and packaged assets.
- Leaflet 1.x is a maintained legacy line while 2.x remains prerelease, so a later migration requires an
  explicit compatibility increment.
- Leaflet's general map accessibility does not provide synchronized exact-evidence semantics; FitFreed still
  owns and tests those controls and alternatives.
- Styling, React lifecycle integration, map invalidation after responsive/focused layout changes, route-point
  hit testing, and selection synchronization remain application responsibilities.

### Risks and mitigations

- A future contributor could add a remote tile or location service. Architecture checks reject prohibited
  Leaflet constructors and remote map assets; packaged E2E observes external requests and fails on any
  coordinate egress.
- Imperative map state could conflict with React state. One component owns one map instance, disposes it on
  unmount, treats the selected source ordinal and viewport state as explicit inputs, and tests remount,
  resize, focus, and return behavior.
- Map and exact values could drift. Both derive from one `SessionStory`; tests select points through map,
  elapsed control, signal lanes, and exact evidence and assert one source ordinal and one displayed value set.
- Dense pointer hit testing could miss the 60-frame-per-second target. Overview geometry remains bounded,
  pointer work is frame-coalesced, and the dense-session packaged benchmark measures interaction and layout.
- Library UI strings or controls could bypass localization and accessibility. FitFreed supplies the visible
  controls and localized names, removes unused built-in controls, and retains manual keyboard and VoiceOver
  gates in both locales, themes, and 100%–200% zoom.

## Verification

The decision increment is supported by the version and license inspection, the reproducible minified/gzip
comparison above, the existing custom-renderer build and tests, official interaction/accessibility contracts,
and the unchanged Tauri content security policy. Production acceptance additionally requires:

1. architecture tests proving that Leaflet remains presentation-only and that no remote map source,
   geolocation, geocoder, plugin, or source-authored popup enters production;
2. unit tests for exercise and route-role discontinuities, signal gaps, anti-meridian unwrapping, fit/reset,
   selected source ordinal, pointer and keyboard selection, missing elapsed evidence, resize, and disposal;
3. synchronized component tests proving visual, value-strip, signal-lane, elapsed-control, and exact-table
   agreement from the same `SessionStory`;
4. packaged macOS E2E proving pan, zoom, reset, focused view, focus restoration, both locales, light/dark/
   system appearance, 100%–200% zoom, reduced motion, VoiceOver-ready semantics, and zero external requests;
5. dense-session evidence proving 60-frame-per-second interaction intent, no visible input loss, the common
   navigation budget, bounded memory, and no startup-shell regression; and
6. dependency audit, license notice, source-bound production package inspection, and upgrade monitoring.

A failure to meet packaged WebView, accessibility, privacy, synchronization, or dense-session gates reopens
this decision before R6 can close. External basemaps, offline tile packages, geographic search, atlases, and
geospatial analysis require separate product and architecture decisions.
