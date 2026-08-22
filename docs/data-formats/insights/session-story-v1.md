# Session Story Version 1

## Purpose and boundary

`SessionStory` is the provider-neutral application read model for one training-session workbench. It
lets a client render session identity, recorded structure, route geometry, signal lanes, zones, source
provenance, exact-evidence affordances, and safe map/signal synchronization from one coherent result.
It is a composition over existing read ports, not a new canonical record, SQLite join, cache, or
provider-specific reconstruction.

The Tauri command and schemas are:

| Command | Request | Response |
|---|---|---|
| `query_session_story` | [`session-story-query-v1.schema.json`](../../../schemas/session-story-query-v1.schema.json) | [`session-story-v1.schema.json`](../../../schemas/session-story-v1.schema.json) |

The response carries `schemaVersion` set to 1. Changing snapshot coherence, source-state preservation,
role separation, alignment, metric semantics, exact capabilities, or privacy behavior requires a new
contract version.

## Request and coherent snapshot

The request contains an opaque `sessionRef`, optional `snapshotRef`, `maxVisualPoints`, and
`maxVisualSamples`. Both visual bounds are integers from 2 through 500. The application first resolves
the exact session through the authoritative discovery port. Its accepted snapshot becomes mandatory
for every structure, route, signal, zone, and provenance query in the same use case.

Every sub-result must repeat that snapshot and session identity. A revision change before or during
composition returns `training-session-detail-changed`; the application never returns a mixed story.
Invalid requests, malformed sub-results, cross-source exercise identity conflicts, and inconsistent
exercise counts return `invalid-training-session-detail`. Missing evidence or persistence failures
return `training-session-detail-failed`. No read mutates canonical data.

## Source assessments remain authoritative

Top-level `session`, `structure`, `routes`, `signals`, `zones`, and `provenance` reuse their documented
version-1 contracts. In particular, `structure`, `routes`, `signals`, and `zones` preserve their
different null, source-absent, present-empty, and present states. The composed `exercises` collection
does not replace those assessments.

The composition forms one exercise identity from matching `exerciseRef` and `ordinal` pairs. A
present structural exercise set is authoritative: route, signal, or zone evidence cannot introduce a
different exercise. When structure is not available, other valid evidence may still form a partial
exercise composition for evidence-adaptive presentation. A session recorded with one exercise may
reuse its session sport only when the composition also contains exactly one exercise and
exercise-level sport evidence is unavailable; multi-exercise stories do not guess an exercise sport.

Each composed exercise exposes:

- `exerciseRef`, `ordinal`, optional `sport`, optional structural `structure`, and optional `zones`;
- independent `primary` and `transition` roles;
- the bounded route and signal evidence belonging to each role;
- an ordered `primaryMetric` and `eligibleOverlays` projection;
- `exactRoute` and `exactSignals` capabilities for the existing exact-page commands.

Primary and transition evidence never crosses roles.

## Bounded evidence and exact capabilities

The story embeds the same endpoint-preserving `source-ordinal-v1` route and signal projections
returned by the route and signal read models. It performs no interpolation, smoothing, normalization,
or resampling. Exact ordinals, units, null values, signal-sample `gapBefore`, optional route elapsed time,
and primary/transition roles remain intact. Canonical route version 1 has no source-authored intra-route
break: missing route elapsed time prevents alignment but does not authorize a geometric gap.

`exactRoute` contains the opaque `routeRef` and exact `pointCount`. `exactSignals` contains every
opaque `signalRef`, source `kind`, source `unit`, and exact `sampleCount`. Clients use those stable
capabilities with `query_training_route_points` and `query_training_signal_samples`; they do not turn
the visual projection into supposed exact evidence.

## Recorded-time alignment

An `eligibleOverlays` entry references one recorded signal series. Its `alignedSamples` contain a
route point and signal sample only when both bounded source selections carry exactly the same recorded
`elapsedMilliseconds`. Every match preserves `routePointOrdinal`, `signalSampleOrdinal`, `value`, and
`gapBefore`.

An absent route timestamp, an absent signal value, a non-matching elapsed time, or evidence belonging
to another role produces no invented match. Null signal values may be aligned because their
unavailability is itself recorded evidence; presentation must show the gap rather than bridge it.
The bounded intersection is safe for overview interaction but is not a substitute for exact-page
verification.

For deliberate verification, a client may use a selected match's `routePointOrdinal` or
`signalSampleOrdinal` to request the exact page containing that source item, then identify the returned row
by the same ordinal. The exact route or signal command remains authoritative: clients must not display an
aligned bounded value as though it came from an exact-page response. When a selected route point has no
aligned sample, no signal ordinal exists to target and the client must not infer one from elapsed proximity.

## Sport-aware metric semantics

`primaryMetric` is the first eligible metric in a provider-neutral sport profile. The profile changes
ordering and an explicitly described value transform; it never chooses presentation color. Supported
metric codes are `pace`, `speed`, `heart-rate`, `elevation`, `cadence`, `stroke-rate`, `temperature`,
and `power`.

For running, walking, and hiking, a recorded `speed` series is exposed as `pace` with
`valueTransform: kilometers-per-hour-to-minutes-per-kilometer`. The source remains identified by
`sourceKind: speed` and `sourceUnit: kilometers-per-hour`. A zero or unavailable speed cannot yield a
finite pace and must remain unavailable in presentation. Cycling prioritizes speed and power before
other eligible facts. Swimming and water sports prioritize speed and physiological evidence.

A source `cadence` series remains `cadence`, including for a water sport. It becomes `stroke-rate`
only when a future provider-neutral signal kind carries explicit stroke evidence. Sport context alone
is not permission to relabel a measurement. `distance` remains available in the source signal
assessment but is not a route-color overlay in version 1.

`valueTransform: identity` means that presentation uses the recorded source value and unit.
`kilometers-per-hour-to-minutes-per-kilometer` is the only derived display transform in version 1.
The original speed series, exact samples, and units remain available for verification.

## Transport shape

All duration and elapsed integer values that may exceed JavaScript's safe integer range cross the
boundary as canonical decimal strings. Important composed fields are `snapshotRef`, `session`,
`structure`, `routes`, `signals`, `zones`, `provenance`, `exercises`, `primary`, `transition`,
`primaryMetric`, `eligibleOverlays`, `signalRef`, `metric`, `sourceKind`, `sourceUnit`,
`valueTransform`, `alignedSamples`, `routePointOrdinal`, `signalSampleOrdinal`,
`elapsedMilliseconds`, `value`, `gapBefore`, `exactRoute`, `routeRef`, `pointCount`, `exactSignals`,
`kind`, `unit`, and `sampleCount`.

A minimal synthetic partial story can preserve unavailable assessments without pretending that an
outdoor workbench exists:

```json
{
  "schemaVersion": 1,
  "snapshotRef": "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "session": { "sessionRef": "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  "structure": null,
  "routes": null,
  "signals": null,
  "zones": null,
  "provenance": { "totalEventCount": 1, "current": {} },
  "exercises": []
}
```

The abbreviated nested objects illustrate assessment state only; complete transported values must
conform to [`session-story-v1.schema.json`](../../../schemas/session-story-v1.schema.json).

## Privacy and presentation responsibility

Composition is local and performs no network request. It exposes no archive path, source record ID,
artifact digest, external map tile, geocoding label, or provider coordinate service. Opaque local
capabilities are not portable identities.

The response deliberately has no color, prose, icon, diagnosis, or training advice. Presentation
owns locale-aware formatting, accessible non-color legends, keyboard interaction, and spatial
rendering. It must disclose transformed pace semantics, retain access to exact source evidence, and
never imply continuity across a missing timestamp or signal gap.
