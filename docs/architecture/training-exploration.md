# Training Exploration Architecture

## Status

Accepted target architecture under [ADR 0021](decisions/0021-model-training-as-attributed-evidence.md). Production persists provider-neutral session summaries, user-authored sport classifications, and a disposable discovery workspace. Full-history search, chronology, calendar projection, comparison selection, and restart restoration are implemented through E3; evidence-complete detail continues through E4 of the [MVP experience delivery plan](../plans/mvp-experience-delivery.md).

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

Mapping changes reassess identical source bytes. The visibility transaction publishes a complete enrichment or leaves the previous session intact. Child identities, order, provenance, and conflicts are versioned in the corresponding canonical, mapping, and persistence specifications when implemented.

## Privacy boundary

Route geometry is local sensitive data. The first renderer uses local SVG and no external map or tile request. Route export, MCP access, and future remote cartography each require their own explicit permission or privacy boundary; the existence of a route in the library grants none of them.
