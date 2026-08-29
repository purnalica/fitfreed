# Training Exploration Architecture

## Status

Accepted target architecture under [ADR 0021](decisions/0021-model-training-as-attributed-evidence.md). Production persists provider-neutral session summaries, mapped exercise/lap/pause structure, primary and transition routes with exact points, supported exercise and transition signals with exact samples, supported recorded zones with exact aggregates, user-authored sport classifications and explicit collection relationships, session-owned personal ranges, reusable segment criteria, and a disposable discovery workspace. Full-history search, chronology, calendar projection, comparison selection, restart restoration, structural detail, bounded local route traces, exact route pagination, gap-aware bounded signal charts, exact signal pagination, recorded-zone inspection, personal-range lifecycle, summary, cross-representation interaction, source-structure and exact-evidence range entry, user-authored segmentation, and on-demand session provenance are implemented. The personal-range Alpha acceptance matrix is complete locally. E4 is complete in the [MVP experience delivery plan](../plans/mvp-experience-delivery.md); the [public-release readiness ledger](../testing/public-release-readiness.md) owns current exact-source acceptance evidence.

## Ownership

- The domain owns provider-neutral session, exercise, lap, pause, zone, route, numeric-series,
  sport-classification, sport-recognition suggestion, personal-range, and segment-criterion identities and
  invariants.
- Source Translation owns Polar Flow decoding, enumeration and unit interpretation, source identity, mapping versions, and anti-corruption mapping into typed canonical evidence.
- The application owns discovery, classification, criterion evaluation, bounded session-detail queries, downsampled views, exact pagination, coverage, and provenance use cases.
- Persistence owns atomic canonical storage, indexes, mapping-aware reconciliation, and bounded projections. It does not invent sport meaning, align unknown series, or evaluate presentation rules.
- Presentation owns accessible visual and exact alternatives, workspace state, privacy disclosures, and origin-aware navigation. It does not reconstruct provider semantics or query persistence directly.

## Evidence layers

One canonical session can expose three non-interchangeable layers:

1. Source evidence: exercises, source laps, automatic laps, pauses, zones, routes, supported series, and
   separately acquired provider catalogue candidates with exact provenance.
2. FitFreed-derived evidence: downsampled visual projections and deterministic segments produced by a versioned calculation.
3. User-authored evidence: sport classification, explicit sport-collection relationships, session-owned personal ranges, and reusable segment criteria with explicit authorship and revision.

Every read model retains layer attribution and provenance. Reimport or recalculation may enrich or regenerate the applicable layer but cannot rewrite another layer silently.

## Sport-identity and classification boundary

The [training sport identity contract](../data-formats/insights/training-sport-identity-v3.md) resolves
provider evidence and the independent
[canonical sport-classification contract](../data-formats/canonical/sport-classification.md) without changing
either. Application and persistence may handle the exact `(originId, sourceSportRef)` key, but presentation
receives only an opaque stable `sportRef`, exact identity state, optional personal classification,
provider-neutral recognition, candidate count, and aggregate coverage. Source identifiers, provider name
keys, catalogue hierarchy, and origin identities never become labels.

One active catalogue candidate produces `recognized`; multiple candidates produce `ambiguous`; no candidate
produces `unknown`; absent usable sport evidence in the imported export produces `unavailable`. The last state means
export-missing and does not claim that the provider account failed to record a sport. Candidate order is not authority.
Recognition carries localized provider names, an optional provider-neutral family suggestion, catalogue and
mapping version, retrieval instant, and opaque evidence reference.
[ADR 0027](decisions/0027-resolve-sport-identity-from-versioned-provider-evidence.md) owns the immutable
catalogue and activation boundary. No sport is inferred from session measurements.

An absent authored value leaves recognition authoritative or retains revision-zero unresolved state. A
classification has the explicit `unresolved-source-profile` scope: it applies only to the source-profile remainder
that lacks stronger exact-session evidence. Exact recognized and ambiguous collections carry no fallback
classification capability. Saving changes only the remainder to `personally-overridden`; it never absorbs an exact
collection, changes that collection's filter identity, or deletes recognition. The separate
[canonical unified-sport relationship](../data-formats/canonical/unified-sport-relationship.md) can combine two or
more represented collections only through explicit user authorship and visible identity precedence. It retains the
member capabilities and never changes their source evidence or fallback classification. Resetting a classification
writes a new user-authored unknown revision rather than deleting the history of user intent. Compare-and-save revision
checks reject stale editors. Import and reimport can reveal a new source reference but cannot create or overwrite
personal meaning or relationships.

The unified-sport domain boundary is implemented independently of application projection and persistence. Training
sports version 5 carries that aggregate through its preview, compare-and-save, review-required, exact filtering,
whole-library recovery, migration, and presentation contracts. An active projection uses the chosen member's
recognized or personally classified identity and sums exact member coverage. A missing member or unusable primary
fails closed into explicit review; equal names, families, or one private observation never repair it silently.

`SportClassificationTask` is the sole presentation mutation boundary for family, personal label, validation,
save, reset, cancellation, operation progress, and optimistic-conflict recovery. The Sports workspace composes
it as the complete management surface; the Sessions sport summary composes the same task only for an
unresolved identity encountered in context. `SportUnificationTask` is the separate mutation boundary for selecting
two through 64 exact collections, choosing visible identity precedence, reviewing complete session coverage, saving,
revising, and removing the relationship. Library Home version 8 also preserves every unresolved profile as
a separate summary, associates recent sessions through the same opaque presentation capability, and routes its
contextual naming action to that exact task in Sports. It never aggregates unresolved profiles, displays the
capability, or owns another mutation path. A conflict reloads the authoritative overview and revision but retains
the person's unsaved family and label for deliberate review and retry. Presentation parents may choose where the
task is revealed and where focus returns, but cannot issue a parallel classification command or define another
label rule.

A changed classification is also a discovery-snapshot change. `TrainingInsightsPanel` publishes one ordered
classification event to the Sessions and Sports workspaces and to the application owner. Sessions applies the
returned overview immediately, then obtains a fresh page with a null snapshot request and resolves its calendar,
comparison basket, open session, and detail evidence against that one returned snapshot. Editable and applied
criteria, a still-valid page offset, calendar month and day, detail section, and return origin remain unchanged.
An invalidated final page alone may fall back to offset zero. The intentional refresh never produces the generic
library-changed warning. If any dependent query fails, the already saved identity remains visible with a local
retry; the prior exploration is not discarded and the save is never described as rolled back.

The application owner refreshes only the `LibraryHome` projection and never changes the active workspace as a
side effect. The hidden Sports workspace adopts the same overview; an open draft is retained and marked against
the newer saved revision. Report definitions remain immutable snapshot evidence: a later report resolution or
preparation reads the authored identity, while a previously saved report becomes deliberately stale and still
requires the existing explicit review instead of being rewritten silently.

Broad FitFreed family codes support localized navigation across providers. They do not assert that equal
families identify the same activity, session, or person. Exact origin separation remains visible whenever
otherwise equal labels would create ambiguity.

## Query and scale boundary

Session identity and lightweight structure load independently from large routes and series. Visual queries request bounded windows and an explicit resolution; exact queries are stable and paginated. A downsampled point never masquerades as a recorded sample, and every visual offers an exact accessible path.

The [training-session search version 5 contract](../data-formats/insights/training-session-search-v5.md) is the
complete-history discovery path. It combines optional local-date bounds, opaque sports, required-measurement
coverage, and identity text without loading detail evidence. Text matches personal labels plus recognized
localized names and provider-neutral family codes, but never provider identifiers or ambiguous candidates.
Each result carries exact source-separated
summaries over the complete filtered set rather than reconstructing aggregates from the visible page. Offset
pages share an opaque mutation snapshot; session or classification changes invalidate later pages instead of
shifting them silently. Period-comparison windows remain a separate read model and cannot limit discovery.

Calendar discovery projects the same complete-history filters and snapshot into exact source-separated local
day aggregates plus a bounded ordered activity list for the requested month. Each lightweight activity carries
only its opaque session capability, local start, duration, and provider-neutral sport identity; opening it resolves
the exact session against the shared snapshot rather than trusting the calendar card as detail evidence. Comparison
and open-detail restoration resolve an ordered set of opaque session capabilities against that snapshot rather than
searching the currently visible page. Presentation persists only the
versioned applied query, page, view, calendar origin, comparison order, and open session. A stale snapshot
retains still-valid query intent but clears session-specific evidence; explicit return to Home clears the
detailed workspace. The normative contracts are the
[training-session search](../data-formats/insights/training-session-search-v5.md) and
[training-discovery workspace](../data-formats/insights/training-discovery-workspace-v3.md) specifications.

Training-period comparison remains a distinct bounded calendar read model. Its `availableRange` reports the
first and last recorded session dates, but an ordered period of at most 366 inclusive dates may extend beyond
those evidence bounds and yields an exact empty summary where no sessions exist. This lets Library Home
compare two adjacent equal periods and lets a saved report reopen its exact source without converting a
valid empty baseline into an error. Training overview and ordinary session discovery retain their own
recorded-history range boundaries. The normative comparison behavior is documented in
[training comparison version 1](../data-formats/insights/training-comparison-v1.md).

## Presentation hierarchy and state

Training is one product workspace with three explicit views: Sessions, Sports, and Compare periods. Sessions
is the stable default. A deep session destination opens Sessions; a deep comparison destination opens Compare
periods; and a deep sport destination opens Sports with the exact shared classification task revealed and
focused. Returning to Home restores the initiating sport action when it still exists and falls back to the Home
heading after a saved classification removes that action. Switching views hides rather than unmounts their
presentation boundaries so a temporary visit does not discard filters, calendar position, classification editor
state, comparison input, or a selected session. This presentation state is disposable; only the versioned
discovery workspace described above is durable.

The Sessions view composes that existing discovery contract as a History Desk. Its default viewport presents
actual chronological session results before either query controls or the complete provider-neutral sport index.
The closed **Sports in this history** disclosure keeps the sport route immediately reachable without enumerating
a large history before its first session. Opening it reveals the complete wrapping grid without a horizontal-scroll
convention or ellipsis; selecting one sport applies the existing exact refinement, closes the index, and focuses the
visible applied-query result. Contextual classification remains inside the open index and uses the same shared task.
Each sport and session combines visible localized text with the same semantic family icon; unknown and unavailable
evidence use distinct explicit symbols and labels rather than a provider value or placeholder. Date, sport,
measurement, personal-label text, and sorting controls remain one complete form behind **Refine sessions**.
Session cards are evidence-adaptive: duration is the only required summary fact, while distance, energy,
and average heart rate create rows only when recorded. Presentation
formatters reduce dates, times, durations, and distances to locale-appropriate human precision for scanning;
they never mutate, round, or replace the exact application result. Deliberate detail, comparison, result-summary,
and provenance surfaces continue to expose exact source-separated evidence. Calendar cells render every bounded
activity in local-start order with the same sport icon and label as chronology, a human-scale duration, and direct
exact-session navigation. The day summary remains a direct route to that day's result set. Year selection spans the
current query boundary and **Today** returns directly to the current month. Multiple source-separated entries are
described as separate histories without exposing opaque references or unexplained ordinal badges.
The aggregate summary remains calculated over the complete filtered set, but follows the paginated result
list behind **Result summary** so numeric coverage does not displace the sessions a person came to find.
Chronology, calendar, comparison selection, pagination, and workspace restoration retain their application
contracts. `TrainingSessionLibraryPanel` owns this composition and the restrained unresolved-sport entry,
`TrainingSportsPanel` owns full classification management, `SportClassificationTask` owns the one mutation
interaction, and `SportFamilyIcon` is the single presentation primitive for sport identity.

`assets/sport/sport-icons.svg` is the single source for the project-authored provider-neutral icon geometry.
The application mounts those trusted local definitions once in the document and `SportFamilyIcon` uses
same-document fragment references. This avoids blank external-fragment rendering in packaged WebKit without
copying paths into components. The self-contained HTML report adapter embeds the same sprite. Family, unknown,
unavailable, and personal-label-only classified states always resolve to a non-empty symbol. Session headings,
exercise summaries, report previews, and report exports retain the same visible localized or personally authored
label beside the redundant visual symbol.

The History Desk keeps the editable refinement draft distinct from the applied discovery criteria. The
visible **Applied refinements** region is derived only from the applied criteria and authoritative sport
overview; it never reflects unsubmitted form values. It gives the exact result count and represents each
bounded date, sport, required measurement, authored-label text, and non-default sort as a localized removable
control. A saved sport whose overview is temporarily unavailable remains an explicit removable filter without
exposing its opaque reference. Removing one criterion or clearing all submits a new canonical application query at offset zero,
updates the matching draft field, and retains every unrelated draft value. The same snapshot-recovery path as
the complete form handles library changes. The applied criteria and visible result set change only after a
successful query; failure leaves the prior applied query and results intact, while a failed form submission
also leaves its edited draft open for recovery. A successful form submission closes the secondary editor and moves
focus to the applied-query count; removal and clear actions restore focus there when their initiating control
disappears. An empty refined result is a result state with direct recovery, not an empty-library state.

An open session replaces discovery content inside Sessions and provides six explicit evidence sections:
Overview, Personal ranges, Structure and segments, Signals and zones, Routes, and Source history. Only one section is visible
and exposed to assistive technology at a time. Every lower-layer query retains its existing independent error
boundary, exact-evidence path, and snapshot binding. The hierarchy changes disclosure, not evidence loading,
identity, attribution, or availability semantics. The return action restores the exact chronology or calendar
origin and its focus target; report return restores the originating session or period comparison.

The period-comparison view is a result-first Answer Canvas. A Home or saved-report source entry executes its
exact accepted periods immediately; manual entry keeps editable periods available without placing them
before a valid answer. Each origin leads with a human-scale duration conclusion and proportional visual,
then session and optional-measurement coverage. Exact values remain available in an accessible disclosure,
and report creation carries the authoritative query rather than copying rendered values. Validation and
contextual retrieval failures preserve the last valid answer, periods, and source separation.

The [training-session structure read model](../data-formats/insights/training-session-structure-v2.md)
loads separately for one opaque session capability under the same discovery snapshot. It preserves
not-yet-evaluated, absent, present-empty, and populated structure as different states. Application validation
requires unique domain-separated child capabilities, contiguous source order, valid local timestamps, and
non-negative finite measurements before presentation receives the result. Provider child identifiers remain
inside persistence.

The independent [training-session route read models](../data-formats/insights/training-session-route-v1.md)
preserve unevaluated, absent, present-empty, and populated route states. The overview selects at most 500
exact source points per route with the documented endpoint-preserving `source-ordinal-v1` algorithm; the
exact query returns stable contiguous pages of at most 250 points. Primary and transition routes remain
separate, point ordinals prove visual provenance, and no route query loads the complete geometry merely to
draw its bounded trace. SQLite starts every exact page at the requested ordinal through the composite route-point
index; deep pagination and the two bounded-memory endpoint-redaction passes never discard an increasingly large
prefix through positional `OFFSET` scans.

The independent [training-session signal read models](../data-formats/insights/training-session-signal-v1.md)
preserve unevaluated, absent, present-empty, populated, unsupported-series-count, and unavailable-sample
states. The overview selects at most 500 exact source slots per series with the same documented
endpoint-preserving `source-ordinal-v1` projection. Persistence derives interval gap evidence while selecting
those slots, so null values split rather than bridge the visible trace even when the null slot itself is not
part of the bounded projection.
The exact query returns stable contiguous pages of at most 250 slots. Exercise and transition collections,
kind, unit, interval, source ordinal, and sample ordinal remain explicit, and no signal query loads a complete
series merely to draw a bounded chart.

The [Session Story v4 composition](../data-formats/insights/session-story-v4.md) is the application
boundary for a single-session workbench. It resolves discovery first and requires every structure,
route, signal, zone, and provenance port to answer at that accepted snapshot. The application then
matches exercise identities and primary/transition roles and exposes exact-page capabilities. SQLite remains a set of
independent evidence adapters; it has no joined story query, presentation cache, or reconstructed
timeline. The production session surface invokes `query_session_story` once per selected session and
accepted discovery revision. It renders structure, routes, signals, and zones from that one response;
independent exact-route and exact-signal pagination remains deliberately on demand.
The story also carries application-owned assessment states and exact supported-evidence counts for every
composed exercise and role. Those summaries distinguish source absence, source emptiness, empty series,
fully unavailable series, partial series, unsupported series, zone bands without recorded time, and
multi-exercise composition without turning presentation into a second evidence interpreter. The immutable
[version-3 contract](../data-formats/insights/session-story-v3.md),
[version-2 contract](../data-formats/insights/session-story-v2.md), and
[version-1 contract](../data-formats/insights/session-story-v1.md) remain preceding transport shapes.
Production requests the same bounded 400-item source-ordinal budget for route geometry and signal lanes for
predictable workbench cost, not as alignment authority.

Version 3, retained by version 4, makes coordinate authority explicit on every eligible overlay. Route waypoint elapsed values are
route-relative; regular signal values are series-relative unless the source supplies an explicit shared
origin. Equal or nearby numbers, compatible cardinality, and subtraction of separate local civil timestamps
cannot establish a relationship. `alignmentState: unavailable` requires an empty aligned-sample collection
and keeps route and signal interaction independent. `alignmentState: exact-recorded` is reserved for a
validated recorded relationship and permits only the exact matches returned by the application. The current
Polar Flow mapping emits `unavailable`.

Presentation applies one evidence-adaptive hierarchy to that application-owned composition. A role with
bounded route points receives the local route workbench. When no route can be drawn, the first
application-ranked supported signal receives a full-width signal workbench instead; presentation uses the
overlay's declared metric and value transform, preserves the bounded source gaps, and keeps the source series
as the exact-evidence path. Route lanes and the independent signal workbench share the value transform and
metric formatter in `session-story-metric.ts`, so a sport-aware speed-to-pace choice cannot acquire different
semantics or precision in the two renderers. A session-level evidence account aggregates only the exact counts
already present in Session Story; it does not reinterpret absent containers or repeat a missing-data warning in
every section.

When neither route nor supported visual signal exists, a composed exercise with recorded structure receives
the leading visual region. Its duration track and source- or automatic-lap bars use only validated recorded
duration, split, and lap-duration values. The renderer clamps those bars to the exercise duration but does not
place pauses on the track: pause timestamps are local civil times and Session Story does not claim an
elapsed-session alignment for them. Counts and exact local timestamps remain available without turning that
absence of alignment into fabricated chronology. This source-authored structure is still distinct from the
user-authored segment criteria available in the same progressive-detail destination.

Supported source-zone bands become the leading region only when no route, supported visual signal, or source
structure can lead. The presentation keeps each exercise and group separate, prefers recorded time as the
aggregate measure, and falls back to recorded distance for speed groups or recorded muscle load for power
groups when time is wholly absent. The visual proportions compare only known values within that one group;
coverage names how many bands contributed, and an unavailable pattern distinguishes missing evidence from a
recorded zero. The exact bounds and aggregate values already carried by Session Story remain the authority.
An action reveals and focuses the selected exact group in Signals and zones; it does not turn bands into
elapsed boundaries, join groups, or reinterpret source zones as personal segments.

`sessionStoryLayout` is the presentation SSOT for this evidence hierarchy and its capability-adaptive detail
navigation. It returns one leading-evidence kind and one ordered section list from the coherent Session Story;
workbench rendering and navigation consume that same result. A route may remain an exact-detail capability
while lacking bounded points to lead visually, and unsupported signal or zone counts may retain their detail
destination without becoming fabricated visual evidence. Loading deliberately exposes the complete stable
navigation shape until the accepted story resolves; the resolved layout then removes unsupported destinations.

Detail navigation is capability-adaptive after the story arrives. Routes are present only when a composed
exercise has a route object, and Signals and zones only when a composed exercise has supported or unsupported
signal or zone evidence. Structure and segments remains available even without source structure because
personal segmentation is a separate user-authored capability, not a source-structure state. Signal and route
detail iterate the composed exercises rather than using source structure as an accidental index; a valid
signal-only or route-only exercise therefore remains inspectable. Overview and on-demand source history are
always available.

[ADR 0026](decisions/0026-use-leaflet-for-the-local-route-workbench.md) defines the spatial rendering boundary,
while [ADR 0032](decisions/0032-use-specialized-analytical-visualization-engines.md) defines the sibling analytical
boundary. `analytical-chart.ts` owns the renderer-neutral live-chart model, validation, axes, series, gaps,
annotations, and restrained interaction contract. `AnalyticalChart` validates that meaning and lazily loads
`EChartsAnalyticalChart`; `echarts-analytical-chart-adapter.ts` is the sole ECharts import boundary and translates
only that model into a locally bundled renderer. ECharts option objects do not cross the adapter. The adapter uses
the inherited application palette, font family, and content-zoom scale; disables animation; formats axes through the
shared presentation boundary; preserves explicit source gaps; and renders selection or range annotations only when
the model carries authoritative coordinates. The React boundary records the last rendered width, height, and device
pixel ratio, so a chart is resized only after an actual geometry change; hiding and revealing an unchanged evidence
section cannot trigger redundant renderer work. A localized error boundary fails closed without logging private
evidence. Every live chart retains its semantic heading, controls, explanation, and exact tabular or structured
alternative outside the renderer, so canvas pixels never become the sole meaning or interaction path.

The cross-signal view uses the same port with a `stacked-lanes` layout rather than owning another drawing system.
One through four independently scaled signal series each receive a horizontal lane identity, numeric scale, unit,
non-color marker, exact-sample path, and separate grid. A source ordinal appears in the ordinary identity only when
multiple series have the same signal kind; exact evidence always retains it. ECharts repeats horizontal names above
the independent scales, while linked horizontal axes preserve the one application-established elapsed coordinate. One cursor and one
horizontal zoom window therefore move across all visible lanes without normalizing values, joining gaps, aligning
another evidence role, or claiming causation. The coordinate domain remains stable while the visible selection
changes because it is derived from every eligible series in that one exercise role. Lane summaries and direct exact-
sample actions remain semantic HTML outside ECharts.

The conditional route-signal view uses that same `stacked-lanes` contract for one through four measurements. Its
coordinate is the one route elapsed coordinate established by an `exact-recorded` application overlay; every lane
keeps its transformed values, unit, independent domain, source gaps, and complete bounded visual samples. Pace axes
use the shared clock-like `M:SS` presentation policy rather than decimal minutes. A selected route point supplies the
authoritative chart annotation only when that point has recorded elapsed evidence. Selecting a returned chart point
moves the shared map position to the nearest returned route point on that already established coordinate, while the
exact-source action still uses only the application-supplied aligned signal-sample ordinal. It never derives an exact
relationship from chart proximity. One native range control supplies pointer and explicit Left, Right, Home, and End
navigation for the shared position; named ranges, current values, source coverage, and exact actions remain semantic
HTML outside the renderer. The React adapter updates an existing ECharts instance when selection changes and mounts
the latest model if geometry becomes visible later, so map traversal does not recreate the renderer or reveal stale
evidence.

A separately lazily loaded presentation adapter uses stable Leaflet 1.x
only for a local vector viewport: projection, pan, zoom, fit, resize, pointer coordinates, and metric scale.
It receives one bounded `SessionStory`, creates no independent query, and exposes no Leaflet type outside
presentation. FitFreed continues to own selected source ordinal, elapsed traversal, route roles and gaps,
sport-aware overlays, focus and return state, semantic controls, exact alternatives, and all evidence
meaning. The adapter cannot create tiles, remote layers, geocoding, geolocation, telemetry, plugins,
source-authored popup HTML, or any coordinate-bearing request. Application code and styles are packaged
locally and the Tauri content security policy remains unchanged. The adapter disables Leaflet's document-level
keyboard handler because it does not pan in the supported macOS WebView despite receiving the focused key
event. A local element-scoped translation maps unmodified arrow and zoom keys to Leaflet `panBy`, `zoomIn`,
and `zoomOut`; Leaflet still owns every spatial operation, while the focused DOM boundary remains explicit,
testable, and disposable. `keyboard-key.ts` is the single presentation compatibility adapter for keyboard
names. It leaves ordinary DOM keys unchanged and maps only the standard WebDriver special-key code points
that the embedded macOS automation driver exposes literally. Timeline and viewport mappings consume the
normalized names; feature components contain no driver branch, environment switch, or synthetic event path.

The adapter derives its minimum zoom from the current complete-track fit and permits only two additional
context levels below that fit. Zoom 19 is the upper precision boundary; a single-point or spatially degenerate
route uses fit level 16 and therefore levels 14 through 19. The bounds are recalculated after viewport resize,
and Leaflet receives them directly, so buttons, element-scoped keys, wheel, touch, double-click, reset, and
programmatic requests cannot diverge. React receives only a renderer-neutral relative level, level count, and
availability of each direction. It localizes and announces that state and disables the corresponding named
control at each boundary without exposing Leaflet zoom numbers.

Route workbench, map, and deliberate reveals into independent signal, structure, and exact-evidence detail
use the application shell's single responsive reveal offset. The offset follows the persistent desktop,
compact, and 175%–200% navigation geometry, so programmatic or keyboard-driven scrolling places the requested
evidence below the navigation instead of hiding its heading or controls. Presentation contracts and packaged
geometry assertions cover the same token; individual route components do not carry independent fixed offsets.

The session-detail navigation applies that same boundary to every Overview, Personal ranges, Structure and
segments, Signals and zones, Routes, and Source history transition. Each selection focuses its newly revealed
region and aligns it below persistent application navigation. The transition is presentation-owned because all
of the sections consume the already loaded coherent session story; it issues no substitute query and changes no
persisted exploration state merely to repair viewport position.

The leading route, signal, structure, or zone workbench remains the primary session answer. The complete
session-evidence account is a closed native disclosure immediately after that answer: opening it issues no query
and reveals the same composed counts for exercises, structure, routes, signals, gaps, laps, pauses, zones, and
unsupported evidence. This keeps compatibility detail explicit and accessible without placing an inventory of
limitations between the person and the strongest recorded visual.

`TrainingRouteSignalLanes` is a conditional analytical timeline, not an assumed accompaniment to a route. It can
pair a role's bounded route and signal evidence only through `exact-recorded` application overlays that name
the exact route-point and signal-sample relationship. The current Polar Flow mapping returns no such overlays,
so production renders the recorded route alone and keeps its regular signals in the independent Signals and
zones destination. Equal offsets, cardinality, or visual proximity never activate the component.

When a future importer supplies that authority, the complete bounded series provides renderer-neutral lane geometry
and source gaps while exact overlay matches provide selected values and exact-row paths. Each lane retains the
transformed metric, source identity, recorded elapsed time, null value, and gap marker from the coherent
`SessionStory`; presentation still neither resamples nor launches an independent query. Missing route elapsed
time or an unavailable alignment omits the synchronized lane workspace rather than creating a cursor or join.

The selected bounded point remains a capability for exact disclosure, not exact evidence itself. The route
action uses its retained source point ordinal to request the containing exact page. A conditional lane action
can do the same with an aligned signal-sample ordinal only when the application supplied an exact relationship.
The existing exact query validates the page and contiguous ordinals; presentation marks, scrolls to, and
focuses that exact row.
The visible position and accessible value name that source ordinal against the route's complete exact point
count, while the native range control retains only bounded visual indexes as its internal mechanics. A dense
20,001-point route therefore names its last projected point as point 20,001 of 20,001, not point 400 of 400.
If no signal sample aligns at the selected route point, the action opens the exact source series without
claiming a corresponding row. Ordinary route and signal detail actions continue to open the first exact page.

Cross-signal inspection is a presentation of that same validated overview, not a new calculated fact. It
allows one through four series from one exercise and one role to be selected, then places them in separate
vertically scaled lanes over one elapsed-time axis. Exercise and transition series never share a view. Available
series are ordered by a provider-neutral relevance policy refined by canonical sport family; source order breaks
ties only within the same kind. Speed and heart rate form the initial pair whenever both are recorded. Otherwise
the first one or two non-cumulative series in that order are selected, while cumulative distance stays available
at the end and explains its monotonic meaning when chosen. Each lane gives its kind, source-series order, unit,
range, coverage, and exact-sample path a horizontal identity before the chart. The source ordinal qualifies that
ordinary identity only when repeated signal kinds would otherwise be ambiguous; it remains available in exact evidence
for every series. Matching line patterns and point symbols keep the lanes distinguishable without color, and ECharts
repeats their horizontal names above their independent numeric scales instead of rotating them through adjacent lanes. Horizontal position uses the exact
returned elapsed time. No value is interpolated, normalized into a hidden common unit, or connected across a
source gap. The longest returned elapsed time across the eligible role fixes the shared axis so changing a
selection does not move the remaining evidence. Readable series retain point markers; dense bounded projections
remove per-point markers while retaining line pattern, scale, tooltip, zoom, and the exact paginated path. Stable
models are reused across unrelated detail state, and a changed selection replaces only ECharts' structural chart
components instead of recreating the renderer. The interface describes co-occurrence without asserting causation.

The independent [training-session zone read model](../data-formats/insights/training-session-zone-v1.md)
preserves unevaluated, absent, present-empty, populated, unsupported-group, and unavailable-aggregate states.
It exposes only heart-rate, speed, and power groups whose units have canonical meaning. The complete exact
collection remains bounded by documented importer compatibility limits and is never downsampled. Recorded
time, distance, or muscle load remains null when missing and is never derived from the exercise summary,
routes, or temporal signals.

Recorded zones are aggregate source evidence, not a timeline. Presentation may compare known values within
one group but cannot invent occurrence order or boundaries. Source groups remain separate from FitFreed-
derived and user-authored segmentation even when their numeric bounds look similar.

## Provenance inspection boundary

The [training-session provenance read model](../data-formats/insights/training-session-provenance-v1.md)
exposes an append-only, oldest-first history only after an explicit user action. The current attribution and
each bounded event identify the supported provider, source revision time, local observation time,
interpretation versions, reconciliation decision, and whether that evidence supports the visible session.
Ascending pagination remains stable when later evidence appends without changing canonical session facts.

Artifact and package locators, hashes, import-operation identity, provider record identity, observation
origin, and source-subject evidence never cross the application boundary. Presentation localizes the closed
provider and decision vocabulary, explains technical versions progressively, and never asks a person to use
private evidence as a public diagnostic.

## Personal segmentation boundary

The [canonical training-session range version 3](../data-formats/canonical/training-session-range-v3.md) is a
durable, session-owned named selection on one selected exercise and one exact exercise, route, or signal
coordinate. It is independent from source laps, reusable criteria, and disposable derived segments even when
their numeric boundaries coincide. Its optimistic revision covers both authored edits and evidence
reconciliation. Compatible strict enrichment retains exact boundaries only while the same exercise and exact
coordinate remain valid; incompatible or missing evidence preserves them in a review-required state and never
redirects the range or treats equal offsets from different representations as aligned. Preserved session-
coordinate rows remain unanchored until explicit adjustment supplies one current exercise, coordinate, and
complete replacement boundary pair.

The [version-3 application range boundary](../data-formats/insights/training-session-range-v3.md) lists at most
1,000 exercise contexts, 1,000 coordinates per exercise, and 1,000 aggregates for one opaque session and one
coherent training-discovery snapshot. It orders by exercise ordinal and complete coordinate before comparing
boundaries, because elapsed values from different authorities are not one timeline. Create, rename, adjust,
and remove require that snapshot; edits and removal also require the expected aggregate revision. Every port
mutation returns its complete committed range context from the same transaction, so presentation never
constructs success by combining a write with a later unrelated query. Invalid context, stale source evidence,
missing identity or coordinate, optimistic conflict, and local-storage failure remain distinct outcomes.

The [range summary read model](../data-formats/insights/training-session-range-summary-v1.md) resolves one
range against its required discovery snapshot and optimistic range revision. A dedicated application port
first returns the exact exercise, coordinate metadata, source-lap structure, public provider attribution, and
independent-evidence counts. A second visit streams only the route or regular signal that owns the selected
coordinate. The application validates order and totals and computes boundary evidence, Haversine route
distance, initial bearing, measurement aggregates, gaps, source-range overlap, coverage, and explicit
limitations. The SQLite adapter neither joins independent clocks nor calculates these metrics.

Exercise, route, and signal coordinates deliberately yield different valid answers. Exercise ranges may use
exact source-lap boundaries and one exact source distance, while route ranges use recorded waypoint geometry
and signal ranges aggregate `[start, end)` samples while retaining the end sample as boundary evidence. Other
routes, signals, source laps, pause timestamps, and declared duration remain independent unless a recorded
relationship proves alignment. Moving and paused time therefore remain unavailable rather than being inferred.
A review-required range whose exercise or coordinate disappeared remains queryable as unavailable evidence;
its authored owner and coordinate are never redirected or discarded. Returned boundary matches and missing
intervals are bounded while their complete counts remain explicit, so dense evidence is processed without
creating an unbounded response.

`TrainingRangeInteractionProvider` is the one production presentation controller for the session-owned range
query, durable selection, local draft, mutation progress, conflict recovery, guarded removal, and selected
summary. `TrainingRangesPanel` composes the library and result inspector, while `TrainingRangeEditor` is the one
form composed by the library, route, independent-signal, source-structure, and exact-evidence entry points. The
library exposes exact boundaries on every choice and adds them to the accessible action name when authored
titles collide; title equality never substitutes for stable range identity. These components receive only the
complete application range context and `SessionStory` labels; opaque capabilities remain command values and
never become visible labels.
Exact elapsed input is parsed and formatted with `BigInt`, coordinate choices come only from the returned
application context, and an established owner and coordinate remain locked. The controller may retain an unsaved
draft across a failed or conflicting command, but it never treats mounted state as persistence: opening or
restarting the session always queries the durable range context and exact selected revision again. Selecting a
saved range uses the shared result-focus boundary so the library inspector receives focus and scrolls into view
in the stacked compact or high-zoom layout.

`TrainingRouteWorkbench` exposes the selected point's recorded ordinal, route-native elapsed time, coordinates,
altitude, and only application-authorized aligned values in a concise semantic strip. Exact coordinate precision
and complete point evidence remain available through the paginated route path. A new route draft begins with an
explicit two-boundary task: pointer selection on the recorded track or the native recorded-position control plus
named commit actions supplies the first and second timed point. Presentation orders a reversed pair by exact
`BigInt` elapsed evidence before opening the one shared editor. A missing or repeated elapsed value cannot complete
the pair, and cancelling an incomplete selection writes nothing. Each boundary transition returns the bounded
inspector to the current instruction, so a prior internal scroll cannot hide the next action.

Once the draft exists, two range controls provide pointer and explicit bounded keyboard traversal of timed points
through the shared `steppedInputValueForKey` policy; a track click moves only the boundary explicitly selected in
the inspector. The renderer port receives nullable exact point indexes for both the transient selection and the
editor's start and end markers. A typed elapsed value without an exact point in the bounded projection remains
unmarked rather than being snapped or inferred. Route choice stays locked throughout boundary selection and editing,
so the single draft cannot change coordinate context. The wide layout reserves approximately three quarters of the
workspace for the map and one quarter for the shared inspector, then stacks the inspector below the map at compact
width or high content zoom.

The [draft range summary read model](../data-formats/insights/training-session-range-draft-summary-v1.md)
calculates the current valid route boundaries before persistence. `TrainingRangeInteractionProvider` remains the
only presentation command boundary: it submits the current snapshot, exercise, route coordinate, and exact elapsed
pair, ignores superseded responses, and keeps a failed preview retry independent from the unsaved editor. The
application reuses the saved-summary accumulators over the complete ordered route stream; SQLite streams evidence
but does not calculate geometry, and the bounded `visualPoints` projection never becomes calculation input. The
response deliberately has no personal-range identity. Presentation reduces it to duration, route distance, altitude
extent, and an explicit partial-evidence note, while the documented exact model retains boundary, coverage,
source-overlap, and limitation detail for later progressive disclosure. Naming or saving the range remains a
separate mutation.

`TrainingSignalWorkbench` composes the same controller and editor for one regular signal's own elapsed
coordinate. Its selected-sample control and two boundary controls traverse exact bounded visual samples with
pointer or the same explicit keyboard policy. `TrainingSignalPlot` creates a validated analytical model from that
one series: exact elapsed milliseconds form the labelled horizontal coordinate, the recorded measurement owns its
labelled value axis and unit, nulls and source gaps remain disconnected, and exact sample ordinals alone can become
the selection line, boundary lines, and range band. The chart's accessible description repeats the exact visible
personal-range title and elapsed boundaries, so save, reimport, and process restart never make that projection
visual-only. A typed boundary that is not one of those returned visual samples remains unmarked. The chart
keeps approximately three quarters of the wide workspace and stacks above its inspector at compact width or
high content zoom. Dense series expose local horizontal chart zoom, while the native slider, explicit inputs, and
paginated exact-sample table remain the authoritative keyboard and assistive-technology paths. Point selection is
enabled only when the containing workflow exposes an exact action. The exact-sample action retains the selected
source ordinal and focuses its containing table row. While either representation owns the active draft, its evidence and saved-range selectors remain locked so
the single editor cannot silently change or lose its coordinate context. None of these interactions aligns the
signal with route offsets or another signal.

`TrainingRangeEvidencePicker` is the reusable entry boundary for source structure and paginated exact evidence.
It consumes only coordinates returned by the application range context and sends an explicit preset to the
shared controller; it owns no command, persistence, or durable draft. `TrainingStructureWorkbench` and detailed
structure derive interval presets only from recorded exercise duration plus valid source- or automatic-lap split
and duration pairs. The source interval remains independently rendered and attributed after the draft opens.
Exact route pages omit points without elapsed evidence, exact signal pages retain their returned elapsed values,
and both construct a provisional interval from adjacent entries on the current page. While the exact-coordinate
draft is active, either boundary can be replaced with the selected exact entry. The one session-level
`TrainingRangeEvidenceEditor` appears before detail navigation and uses the shared reveal/focus boundary; tables
do not mount another editor or add an action to every row. Page order is never treated as a coordinate when an
elapsed value is absent, and no entry point infers a relationship between independent clocks.

The [canonical segment criterion](../data-formats/canonical/segment-criterion.md) is reusable user-authored
evidence with stable local identity, optimistic revision, and one versioned rule. Its ordered exercise
application is independent from source laps, phases, routes, and signals. Editing a reused definition affects
every application; removing an application retains the reusable definition. Reimport retains an application
only while the same source exercise identity remains and never redirects it to a different exercise.

The [training-session segmentation read model](../data-formats/insights/training-session-segmentation-v1.md)
evaluates equal elapsed-time, equal recorded-distance, recorded heart-rate-range, and manual elapsed-boundary
rules under the current discovery snapshot. Distance and heart-rate evaluation stream exact primary signal
slots from persistence; they do not infer from chart pixels or load a complete series. Results are bounded to
250 exact segments and expose missing, ambiguous, incomplete, outside-session, zero-match, and source-gap
states separately. Derived segments are recalculated rather than persisted as canonical source evidence.
The presentation exposes one busy boundary for every criterion mutation, keeps each initiating action name
stable, announces localized progress, and retains the current derived result or editor draft until the
application returns a complete replacement.

Mapping changes reassess identical source bytes. Version 2 training mapping can strictly enrich a summary
written by version 1, version 3 can strictly enrich equal version-2 summary and structure with evaluated
route evidence, version 4 can strictly enrich version-3 evidence with supported temporal signals, and version
5 can strictly enrich equal version-4 evidence with source-recorded zones. A later source revision atomically replaces summary and all mapped children. Older or
conflicting evidence changes neither. The visibility transaction publishes one complete result or leaves the
previous session intact; duplicate sessions, exercises, routes, or points are never an enrichment strategy.
Child identity, order, provenance, and conflict semantics are fixed by the canonical, mapping, read-model,
and persistence specifications.

## Privacy boundary

Route geometry, physiological or performance signals, and their recorded zone aggregates are local sensitive data. Packaged local renderers make
no external request and use no visualization service. Route or signal export, MCP access, and future remote
cartography each require their own explicit permission or privacy boundary; the existence of evidence in the
library grants none of them.
