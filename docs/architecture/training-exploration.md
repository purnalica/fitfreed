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
periods. Switching views hides rather than unmounts their presentation boundaries so a temporary visit does
not discard filters, calendar position, classification editor state, comparison input, or a selected session.
This presentation state is disposable; only the versioned discovery workspace described above is durable.

The Sessions view composes that existing discovery contract as a History Desk. Its default viewport presents
the provider-neutral sport groups and actual chronological session results before query controls. Each sport
and session combines visible localized text with the same semantic family icon; unknown and unavailable
evidence use distinct explicit symbols and labels rather than a provider value or placeholder. Date, sport,
measurement, personal-label text, and sorting controls remain one complete form behind **Refine sessions**.
The aggregate summary remains calculated over the complete filtered set, but follows the paginated result
list behind **Result summary** so numeric coverage does not displace the sessions a person came to find.
Chronology, calendar, comparison selection, pagination, and workspace restoration retain their application
contracts. `TrainingSessionLibraryPanel` owns this composition, `TrainingSportsPanel` owns full classification
management, and `SportFamilyIcon` is the single presentation primitive for sport identity.

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
