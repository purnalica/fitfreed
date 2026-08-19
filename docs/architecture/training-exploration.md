# Training Exploration Architecture

## Status

Accepted target architecture under [ADR 0021](decisions/0021-model-training-as-attributed-evidence.md). Production persists provider-neutral session summaries, mapped exercise/lap/pause structure, primary and transition routes with exact points, supported exercise and transition signals with exact samples, user-authored sport classifications, and a disposable discovery workspace. Full-history search, chronology, calendar projection, comparison selection, restart restoration, structural detail, bounded local route traces, exact route pagination, gap-aware bounded signal charts, and exact signal pagination are implemented. Provider-defined zones, provenance presentation, reusable criteria, and user-authored segmentation continue through E4 of the [MVP experience delivery plan](../plans/mvp-experience-delivery.md).

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

Mapping changes reassess identical source bytes. Version 2 training mapping can strictly enrich a summary
written by version 1, version 3 can strictly enrich equal version-2 summary and structure with evaluated
route evidence, and version 4 can strictly enrich version-3 evidence with supported temporal signals. A later source revision atomically replaces summary and all mapped children. Older or
conflicting evidence changes neither. The visibility transaction publishes one complete result or leaves the
previous session intact; duplicate sessions, exercises, routes, or points are never an enrichment strategy.
Child identity, order, provenance, and conflict semantics are fixed by the canonical, mapping, read-model,
and persistence specifications.

## Privacy boundary

Route geometry and physiological or performance signals are local sensitive data. The first renderers use
local SVG and no external visualization service. Route or signal export, MCP access, and future remote
cartography each require their own explicit permission or privacy boundary; the existence of evidence in the
library grants none of them.
