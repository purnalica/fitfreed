# Training Exploration Architecture

## Status

Accepted target architecture under [ADR 0021](decisions/0021-model-training-as-attributed-evidence.md). Production currently persists provider-neutral session summaries only; implementation proceeds through E3 and E4 of the [MVP experience delivery plan](../plans/mvp-experience-delivery.md).

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

## Query and scale boundary

Session identity and lightweight structure load independently from large routes and series. Visual queries request bounded windows and an explicit resolution; exact queries are stable and paginated. A downsampled point never masquerades as a recorded sample, and every visual offers an exact accessible path.

Mapping changes reassess identical source bytes. The visibility transaction publishes a complete enrichment or leaves the previous session intact. Child identities, order, provenance, and conflicts are versioned in the corresponding canonical, mapping, and persistence specifications when implemented.

## Privacy boundary

Route geometry is local sensitive data. The first renderer uses local SVG and no external map or tile request. Route export, MCP access, and future remote cartography each require their own explicit permission or privacy boundary; the existence of a route in the library grants none of them.
