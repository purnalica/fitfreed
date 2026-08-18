# ADR 0021: Model training detail as attributed evidence

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** FitFreed maintainers and product owner
- **Related requirements:** [FR-025 and FR-026](../../requirements.md#fr-025--evidence-complete-session-exploration)
- **Related architecture:** [Training exploration](../training-exploration.md), [source integration](../source-integration.md), [storage](../storage.md)

## Context

The implemented training model retains provider-neutral session summaries but deliberately skips nested exercises, laps, routes, pauses, zones, and sample series. That boundary protects the current model from provider objects, but a summary cannot explain what happened inside a workout or support a useful indoor session when no route exists.

The evaluated source structure does not guarantee the same children for every session. Source laps, automatic laps, routes, and sample families are optional; some sessions contain multiple exercises or sports, and the takeout does not supply a trustworthy offline catalogue for its opaque sport references. User-defined segmentation must remain useful when source phases or laps do not exist.

## Decision drivers

- Make session detail valuable for routed and non-routed sports.
- Preserve source evidence without turning provider structures into the domain model.
- Distinguish recorded, FitFreed-derived, and user-authored structure.
- Keep exact evidence available while bounding memory and presentation work.
- Enrich exact reimports under improved mappings without duplicating logical sessions or children.
- Never invent a sport name from an opaque provider reference.

## Considered alternatives

### Retain summary-only sessions

This keeps implementation small but leaves the strongest training value in the export unusable and gives people no way to inspect intervals, laps, signals, or routes.

### Persist provider training documents directly

This preserves source detail quickly but makes provider fields, optionality, and revisions the application model. A second importer would either leak another document shape into the core or require a parallel product path.

### Flatten every child and sample into generic key-value series

This appears provider-neutral but erases the distinctions between exercises, source laps, automatic laps, pauses, zones, routes, and authored criteria. Presentation would have to reconstruct semantics from generic records.

### Use typed, attributed evidence beneath a common session identity

This retains specific meaning and provenance while allowing sport-specific extensions. Missing structures remain explicit, and derived or authored layers do not overwrite source facts.

## Decision

Training detail will use typed, attributed evidence beneath the existing provider-neutral session identity.

- Source exercises, source laps, automatic laps, pauses, source zones, routes, and supported sample series have distinct identities and provenance. A multisport session retains its ordered exercise children and optional transition route.
- The initial numeric series are heart rate, speed or pace, cumulative distance, altitude, cadence, and power only when the source mapping establishes enumeration, unit, interval, origin, missing-value encoding, and reconciliation behavior. Unsupported series remain covered source evidence rather than guessed measurements.
- Exact values remain queryable through bounded, paginated windows. Downsampled projections support visuals but never replace the exact series.
- Route geometry stays local. The first route presentation uses project-rendered SVG on a neutral surface and performs no external tile or location request.
- `SegmentCriterion` is a versioned provider-neutral concept. Initial variants are equal elapsed time, equal distance, heart-rate zone, and manual boundaries; each declares prerequisites, units, applicability, and evaluation version.
- Source structure, FitFreed-derived segments, and user-authored criteria remain independently attributed, reversible, and inspectable. A criterion cannot mutate source laps or exercises.
- Sport classification is user-authored and provider-neutral. It is keyed by observation origin and exact source sport reference and contains an explicit unknown state, optional canonical family, optional display label, authorship, and revision. A future provider catalogue may offer a provenance-bearing suggestion but cannot silently replace a user choice.
- Mapping-set changes force reassessment of identical source bytes. A newer mapping may enrich the existing session and its children atomically, but cannot duplicate their logical identities or roll back newer evidence.

## Consequences

### Positive

- One session workspace can explain both outdoor and indoor training without pretending all sessions have identical structure.
- Provider facts, derived segments, and personal interpretation remain trustworthy and independently evolvable.
- Later providers and sports can add typed mappings without changing the common session identity.
- Exact data remains available for evidence, export, and accessibility while visual queries stay bounded.

### Negative

- The canonical model, mappings, persistence schema, and queries become materially richer.
- Mapping and reconciliation tests must cover child identity, amendment, optionality, and large series.
- User classification creates a portable authored-data lifecycle that must survive restart, reimport, migration, and backup.

### Risks and mitigations

- Incorrect temporal alignment could make plots or segments misleading. Each series contract binds its origin, interval, units, and missing-value semantics before support is enabled.
- Precise route display could expose sensitive locations. Geometry remains local and export requires explicit sensitive-content review.
- Broad provider support could delay the MVP. Only the accepted series, criteria, routed vertical, and non-routed vertical enter the first slice; unsupported families remain explicit.

## Verification

Acceptance requires synthetic contract, mapping, reconciliation, migration, bounded-query, exact-table, route-privacy, and accessibility evidence for absent, single, multiple, multisport, amended, malformed, and large-series sessions. Reimport tests must import identical bytes through an older and newer mapping and prove atomic enrichment with no duplicated session, exercise, lap, route, or series identity. Packaged journeys must cover one routed and one non-routed session, multiple criteria, missing prerequisites, restart, and origin-aware return in both locales.
