# Session Story Version 3

## Purpose and compatibility

`SessionStory` version 3 is the current provider-neutral application read model for an evidence-adaptive
training-session workbench. It retains the coherent source assessments, exercise composition, bounded
projections, exact capabilities, evidence summaries, sport-aware metrics, provenance, and privacy boundaries
of the preceding contracts. It corrects one semantic boundary: route and regular-signal elapsed values are
not placed on one timeline unless recorded evidence explicitly establishes that they use the same coordinate.

The command remains `query_session_story`. Its request conforms to
[`session-story-query-v1.schema.json`](../../../schemas/session-story-query-v1.schema.json), while its
response conforms to
[`session-story-v3.schema.json`](../../../schemas/session-story-v3.schema.json) and carries
`schemaVersion` set to 3. The
[`version-2 contract`](session-story-v2.md) and
[`version-1 contract`](session-story-v1.md) document the preceding response shapes.

Version 3 changes transport because a version-2 overlay did not state the authority for its
`alignedSamples`. A version-3 client must use `alignmentState`; it must not infer alignment from equal or
nearby elapsed values.

## Independent elapsed coordinates

Every bounded route point retains its recorded route-relative `elapsedMilliseconds`. Every regular signal
sample retains the series-relative position derived from its source ordinal and recorded interval. Those
numbers describe positions inside their respective evidence representations; numerical equality does not
prove that they describe the same instant.

The application must not create a relationship by:

- comparing equal or nearby elapsed numbers;
- subtracting local civil timestamps from separate source objects;
- treating exercise duration, route extent, signal extent, or lap extent as interchangeable; or
- interpolating, resampling, smoothing, or filling missing source evidence.

An explicit provider field, canonical relationship, or independently retained source fact may establish a
shared coordinate in a future mapping. The relationship must be recorded and validated before the
application may emit aligned samples. Source familiarity or plausible timing is not authority.

## Overlay alignment state

Every `eligibleOverlays` entry adds `alignmentState` with exactly one of these values:

| Value | Meaning |
|---|---|
| `exact-recorded` | An explicit recorded relationship proves that the route points and signal samples use the same elapsed coordinate. Every `alignedSamples` entry is an exact equality inside that proven coordinate. |
| `unavailable` | No explicit recorded relationship proves a shared coordinate. `alignedSamples` must be empty. |

`eligibleOverlays` continues to describe supported signal metrics and value transforms for independent
signal presentation. Eligibility does not itself imply route synchronization. An `exact-recorded` overlay may
have an empty `alignedSamples` collection when the bounded source projections contain no equal positions;
the state describes coordinate authority, not a guarantee that a projected match exists.

The current Polar Flow personal-data-export mapping emits `unavailable`. Route waypoint offsets are relative
to route start, while regular signal series provide an interval without a recorded series time origin. Equal
numeric offsets therefore remain separate evidence rather than becoming a synchronized map overlay.

## Presentation contract

Presentation must follow `alignmentState`:

1. `unavailable` keeps the route and signal independently explorable. It must not color the route from that
   signal, synchronize cursors, or imply a shared instant.
2. `exact-recorded` permits interaction only through the returned `alignedSamples`; presentation must not
   invent additional matches by proximity or interpolation.
3. Route geometry may still lead the workbench without a synchronized overlay. The supported signal remains
   available in its own evidence surface and exact-sample path.
4. A missing alignment relationship is one precise capability state, not a general missing-data warning.
   The source assessments and evidence summaries remain the factual availability account.
5. Exercise and primary or transition role boundaries remain strict even when two roles use an
   `exact-recorded` coordinate.

The application response still carries no color, icon, layout, localized prose, diagnosis, recommendation,
inferred phase, external map authority, or provider-specific presentation decision.

## Failures, boundedness, and privacy

Request validation, snapshot coherence, exercise identity, role separation, bounded source-ordinal
projections, exact pagination capabilities, error codes, and local-only privacy behavior remain unchanged.
Malformed alignment state or a non-empty `alignedSamples` collection with `alignmentState: unavailable`
violates the response contract. A mixed evidence revision returns `training-session-detail-changed`;
malformed composition returns `invalid-training-session-detail`; an unavailable authoritative query returns
`training-session-detail-failed`. No failure returns a partial story.

Changing coordinate-authority meaning, permitted alignment derivation, assessment-state meaning, count
meaning, composition identity, exact capabilities, metric transforms, or privacy behavior requires a new
response version.
