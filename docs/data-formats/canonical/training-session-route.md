# Canonical Training-Session Route Version 1

## Status and authority

This is the normative provider-neutral contract for recorded route evidence below a FitFreed
training-session aggregate. Version 1 is introduced by Polar Flow mapping
`polar-flow-training-session@3`, but its route kinds, point order, coordinates, missing-value
semantics, and reconciliation rules do not depend on Polar terminology.

Route evidence extends the [training-session summary](training-session.md) and references the
exercise identities defined by [training-session structure](training-session-structure.md). It does
not replace either contract. A route is recorded evidence, not a corrected road, inferred activity,
or source of authoritative aggregate distance.

## Assessment and collection states

`TrainingSessionRecord.routes` has these distinct states:

- null means no compatible route mapping has evaluated the persisted session;
- a present assessment with null `exercises` means the source exercise collection was absent;
- a present assessment with an empty `exercises` collection means the source supplied no exercises;
- every assessed exercise retains the structural `exerciseId` and `ordinal` and has an optional
  `routes` value;
- null exercise `routes` means the source route container was absent;
- present exercise `routes` with null `primary` and `transition` means the source container was
  present without either route;
- a present route may have zero, one, or many recorded points.

Importers never convert one state into another and never infer a route from distance, sport, or
other sample families.

## Entities

### `TrainingExerciseRouteAssessment`

| Field | Type | Required | Semantics |
|---|---|---|---|
| `exerciseId` | string | yes | Existing non-empty source-scoped exercise identity. |
| `ordinal` | non-negative integer | yes | Zero-based contiguous exercise order, equal to the structural exercise order. |
| `routes` | route collection or null | yes | Source route-container state. |

### `TrainingRoutes`

`primary` and `transition` are independent optional `TrainingRoute` values. Primary evidence
describes the exercise route. Transition evidence describes a separately attributed movement
between exercise parts. Equal points do not merge the kinds, and FitFreed never connects one kind
to another with an invented line.

### `TrainingRoute`

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `kind` | `primary` or `transition` | yes | Route identity component. |
| `startedAtLocal` | ISO 8601 local date-time | yes | Source route start without an invented zone. |
| `points` | ordered collection | yes | Exact recorded waypoints; an empty collection is permitted. |

Route identity is `(originId, sessionId, exerciseId, kind)`. There is at most one route of each kind
per exercise in this version.

### `TrainingRoutePoint`

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `ordinal` | non-negative integer | yes | Zero-based contiguous source order. |
| `latitudeDegrees` | finite binary64 | yes | WGS84 latitude in degrees, from -90 through 90. |
| `longitudeDegrees` | finite binary64 | yes | WGS84 longitude in degrees, from -180 through 180. |
| `altitudeMeters` | finite binary64 or null | yes | Recorded altitude in metres; null means unavailable. |
| `elapsedMilliseconds` | non-negative signed 64-bit integer or null | yes | Recorded elapsed offset from route start; null means unavailable for that point. |

Present elapsed values are non-decreasing in source order. Missing elapsed values do not authorize
interpolation. Equal adjacent coordinates, elapsed values, or altitudes remain distinct recorded
points.

## Projection and exact evidence

Canonical storage retains every mapped point. A visual projection may select a deterministic bounded
subset, but each selected value remains an exact recorded point with its original ordinal. The
projection is derived evidence and cannot replace the canonical collection. Exact ordered points
remain available through a stable paginated read model.

The first renderer joins adjacent points only within one explicit route kind and source order. It
does not snap to roads, bridge primary and transition routes, infer missing coordinates, smooth
geometry, or claim cartographic accuracy.

## Reconciliation

Reconciliation applies atomically to the complete `TrainingSessionRecord`:

1. a new session creates summary, evaluated structure, and evaluated route evidence together;
2. complete record equality is equivalent;
3. an equal existing field or a previously unevaluated field becoming evaluated is strict
   `enrich` when no evaluated field regresses or changes;
4. a later valid source revision replaces summary and every mapped child atomically;
5. an earlier revision preserves the complete visible record;
6. equal or unorderable revision evidence with different evaluated content is a conflict.

Mapping-aware exact reimport must reassess identical bytes when mapping version 3 becomes active and
must never create a duplicate session, exercise, route, or point.

## Privacy and compatibility

Coordinates are sensitive local data. Canonical route storage, route queries, and rendering perform
no external request. Export, remote cartography, MCP exposure, telemetry, and provider synchronization
require separate explicit authority; importing a route grants none of them.

Version 1 does not define map tiles, road matching, named places, endpoint masking, inferred gaps,
speed, pace, signal alignment, zones, or user-authored segments. Adding one of those meanings or
changing identity, route kinds, order, units, assessment states, or reconciliation requires a new
contract version.
