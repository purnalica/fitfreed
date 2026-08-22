# Training Exploration Architecture

## Status

Accepted target architecture under [ADR 0021](decisions/0021-model-training-as-attributed-evidence.md). Production persists provider-neutral session summaries, mapped exercise/lap/pause structure, primary and transition routes with exact points, supported exercise and transition signals with exact samples, supported recorded zones with exact aggregates, user-authored sport classifications and reusable segment criteria, and a disposable discovery workspace. Full-history search, chronology, calendar projection, comparison selection, restart restoration, structural detail, bounded local route traces, exact route pagination, gap-aware bounded and aligned signal charts, exact signal pagination, recorded-zone inspection, user-authored segmentation, and on-demand session provenance are implemented. E4 is complete in the [MVP experience delivery plan](../plans/mvp-experience-delivery.md); the [public-release readiness ledger](../testing/public-release-readiness.md) owns current exact-source acceptance evidence.

## Ownership

- The domain owns provider-neutral session, exercise, lap, pause, zone, route, numeric-series, sport-classification, and segment-criterion identities and invariants.
- Source Translation owns Polar Flow decoding, enumeration and unit interpretation, source identity, mapping versions, and anti-corruption mapping into typed canonical evidence.
- The application owns discovery, classification, criterion evaluation, bounded session-detail queries, downsampled views, exact pagination, coverage, and provenance use cases.
- Persistence owns atomic canonical storage, indexes, mapping-aware reconciliation, and bounded projections. It does not invent sport meaning, align unknown series, or evaluate presentation rules.
- Presentation owns accessible visual and exact alternatives, workspace state, privacy disclosures, and origin-aware navigation. It does not reconstruct provider semantics or query persistence directly.

## Evidence layers

One canonical session can expose three non-interchangeable layers:

1. Source evidence: exercises, source laps, automatic laps, pauses, zones, routes, and supported series mapped from a provider artifact.
2. FitFreed-derived evidence: downsampled visual projections and deterministic segments produced by a versioned calculation.
3. User-authored evidence: sport classification and reusable segment criteria with explicit authorship and revision.

Every read model retains layer attribution and provenance. Reimport or recalculation may enrich or regenerate the applicable layer but cannot rewrite another layer silently.

## Sport-classification boundary

The [canonical sport-classification contract](../data-formats/canonical/sport-classification.md) resolves
meaning without changing source evidence. Application and persistence may handle the exact
`(originId, sourceSportRef)` key, but presentation receives only an opaque stable `sportRef`, explicit
unknown or unavailable state, localized family code, optional user label, authorship, revision, and
aggregate coverage. Source references and origin identities never become labels.

An absent authored value is revision-zero unknown. Resetting a value writes a new user-authored unknown
revision rather than deleting the history of user intent. Compare-and-save revision checks reject stale
editors. Import and reimport can reveal a new source reference but cannot create or overwrite its meaning.

`SportClassificationTask` is the sole presentation mutation boundary for family, personal label, validation,
save, reset, cancellation, operation progress, and optimistic-conflict recovery. The Sports workspace composes
it as the complete management surface; the Sessions sport summary composes the same task only for an
unresolved identity encountered in context. Library Home version 3 also preserves every unresolved profile as
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

The [training-session search contract](../data-formats/insights/training-session-search-v1.md) is the
complete-history discovery path. It combines optional local-date bounds, opaque sports, required-measurement
coverage, and user-label text without loading detail evidence. Each result carries exact source-separated
summaries over the complete filtered set rather than reconstructing aggregates from the visible page. Offset
pages share an opaque mutation snapshot; session or classification changes invalidate later pages instead of
shifting them silently. Period-comparison windows remain a separate read model and cannot limit discovery.

Calendar discovery projects the same complete-history filters and snapshot into exact source-separated local
day aggregates. Comparison and open-detail restoration resolve an ordered set of opaque session capabilities
against that snapshot rather than searching the currently visible page. Presentation persists only the
versioned applied query, page, view, calendar origin, comparison order, and open session. A stale snapshot
retains still-valid query intent but clears session-specific evidence; explicit return to Home clears the
detailed workspace. The normative contracts are the
[training-session search](../data-formats/insights/training-session-search-v1.md) and
[training-discovery workspace](../data-formats/insights/training-discovery-workspace-v1.md) specifications.

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
the provider-neutral sport groups and actual chronological session results before query controls. Each sport
and session combines visible localized text with the same semantic family icon; unknown and unavailable
evidence use distinct explicit symbols and labels rather than a provider value or placeholder. Date, sport,
measurement, personal-label text, and sorting controls remain one complete form behind **Refine sessions**.
The sport index is a wrapping grid whose complete identities and contextual actions stay visible without a
horizontal-scroll convention or ellipsis. Session cards are evidence-adaptive: duration is the only required
summary fact, while distance, energy, and average heart rate create rows only when recorded. Presentation
formatters reduce dates, times, durations, and distances to locale-appropriate human precision for scanning;
they never mutate, round, or replace the exact application result. Deliberate detail, comparison, result-summary,
and provenance surfaces continue to expose exact source-separated evidence. Calendar cells describe multiple
source-separated entries as separate histories without exposing their opaque references or unexplained ordinal
badges.
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

An open session replaces discovery content inside Sessions and provides five explicit evidence sections:
Overview, Structure and segments, Signals and zones, Routes, and Source history. Only one section is visible
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

The [training-session structure read model](../data-formats/insights/training-session-structure-v1.md)
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
draw its bounded trace.

The independent [training-session signal read models](../data-formats/insights/training-session-signal-v1.md)
preserve unevaluated, absent, present-empty, populated, unsupported-series-count, and unavailable-sample
states. The overview selects at most 500 exact source slots per series with the same documented
endpoint-preserving `source-ordinal-v1` projection. Persistence derives interval gap evidence while selecting
those slots, so null values split rather than bridge the visible trace even when the null slot itself is not
part of the bounded projection.
The exact query returns stable contiguous pages of at most 250 slots. Exercise and transition collections,
kind, unit, interval, source ordinal, and sample ordinal remain explicit, and no signal query loads a complete
series merely to draw a bounded chart.

The [Session Story v3 composition](../data-formats/insights/session-story-v3.md) is the application
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
[version-2 contract](../data-formats/insights/session-story-v2.md) and
[version-1 contract](../data-formats/insights/session-story-v1.md) remain the preceding transport shapes.
Production requests the same bounded 400-item source-ordinal budget for route geometry and signal lanes for
predictable workbench cost, not as alignment authority.

Version 3 makes coordinate authority explicit on every eligible overlay. Route waypoint elapsed values are
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
as the exact-evidence path. Route lanes and the independent signal workbench share
`transformSessionStoryValue`, so a sport-aware speed-to-pace choice cannot acquire different semantics in the
two renderers. A session-level evidence account aggregates only the exact counts already present in Session
Story; it does not reinterpret absent containers or repeat a missing-data warning in every section.

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

[ADR 0026](decisions/0026-use-leaflet-for-the-local-route-workbench.md) defines the one spatial exception
to the semantic-HTML visualization policy. A lazily loaded presentation adapter uses stable Leaflet 1.x
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

Route workbench, map, and synchronized-lane reveals use the application shell's single responsive
reveal offset. The offset follows the persistent desktop, compact, and 175%–200% navigation geometry,
so programmatic or keyboard-driven scrolling places the requested evidence below the navigation instead
of hiding its heading or controls. Presentation contracts and packaged geometry assertions cover the
same token; individual route components do not carry independent fixed offsets.

`TrainingRouteSignalLanes` is the semantic, renderer-independent timeline attached to that viewport. It pairs
each selected role's bounded signal series with its application-composed `eligibleOverlay` by the validated
signal capability. The complete bounded series supplies lane geometry and source gaps; the overlay's exact
route-point and signal-sample ordinal matches supply only the selected value, map overlay, and exact-row path.
This prevents differing endpoint-preserving route and signal projections from erasing legitimate lane
evidence while still forbidding proximity joins. Each lane retains the transformed display metric, source
signal identity, recorded elapsed time, null value, and gap marker already present in the coherent
`SessionStory`. Up to four full-width lanes share the longest recorded elapsed value in the role and route.
Their common selected route point can move from the map, the native
position control, a lane pointer position, or a lane's Left, Right, Home, and End keys. A missing route elapsed
time leaves the lane cursor unavailable rather than creating a timestamp, while a null or `gapBefore` sample
splits the visible path. Presentation neither resamples nor launches an independent signal query to construct
a lane. When the route contains no elapsed evidence at all, no synchronized lane workspace is rendered; the
independent bounded signal views remain available in deliberate detail.

The selected bounded point remains a capability for exact disclosure, not exact evidence itself. The route
action uses its retained source point ordinal to request the containing exact page. A lane action does the
same with the retained signal-sample ordinal when that point has an aligned source sample. The existing exact
query validates the page and contiguous ordinals; presentation marks, scrolls to, and focuses that exact row.
The visible position and accessible value name that source ordinal against the route's complete exact point
count, while the native range control retains only bounded visual indexes as its internal mechanics. A dense
20,001-point route therefore names its last projected point as point 20,001 of 20,001, not point 400 of 400.
If no signal sample aligns at the selected route point, the action opens the exact source series without
claiming a corresponding row. Ordinary route and signal detail actions continue to open the first exact page.

Cross-signal inspection is a presentation of that same validated overview, not a new calculated fact. It
allows two through four series from one exercise and one role to be selected, then places them in separate
vertically scaled lanes over one elapsed-time axis. Exercise and transition series never share a view. Each
lane labels its own kind, source-series order, unit, range, and coverage; horizontal position uses the exact
returned elapsed time. No value is interpolated, normalized into a hidden common unit, or connected across a
source gap. The longest returned elapsed time across the eligible role fixes the shared axis so changing a
selection does not move the remaining evidence. Each selected series retains a direct path to its exact
paginated samples, and the interface describes co-occurrence without asserting causation.

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

The [canonical training-session range version 2](../data-formats/canonical/training-session-range-v2.md) is a
durable, session-owned named selection on one selected exercise's elapsed coordinate. It is independent from
source laps, reusable criteria, and disposable derived segments even when their boundaries coincide. Its
optimistic revision covers both authored edits and evidence reconciliation. Compatible strict enrichment
retains exact boundaries only while the same exercise remains valid; incompatible or missing elapsed evidence
preserves them in a review-required state and never redirects the range to another session or exercise.
Schema-25 session-coordinate rows have no provable exercise transformation and remain unanchored review
evidence until explicit adjustment supplies one current exercise and complete replacement boundaries.

The [version-2 application range boundary](../data-formats/insights/training-session-range-v2.md) lists at most
1,000 exercise contexts and 1,000 aggregates for one opaque session and one coherent training-discovery
snapshot, ordered by elapsed start, end, title, and identity. Create, rename, adjust, and remove require that
snapshot; edits and removal also require the expected aggregate revision. Every port mutation returns its
complete committed range context from the same transaction, so presentation never constructs success by
combining a write with a later unrelated query. Invalid context, stale source evidence, missing identity,
optimistic conflict, and local-storage failure remain distinct application outcomes.

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

Route geometry, physiological or performance signals, and their recorded zone aggregates are local sensitive data. The first renderers use
local SVG and no external visualization service. Route or signal export, MCP access, and future remote
cartography each require their own explicit permission or privacy boundary; the existence of evidence in the
library grants none of them.
