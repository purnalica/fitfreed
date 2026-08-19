# Canonical Report Definition Version 2

## Status and authority

Version 2 extends the immutable [version-1 definition](report-definition.md) with genuine ordered
composition and reviewed route evidence. It remains a session-origin report: one authoritative session
summary and one user narrative are required, while zero or more distinct routes from that same session may
be placed anywhere in the ordered block collection.

The normative independent JSON representation is the
[portable version-2 contract](../portable/report-definition-v2.md). Persistence and rendered HTML are
separate representations.

## Definition header

`reportRef`, `title`, `locale`, `sourceSnapshotRef`, session `origin`, `provenancePolicy`, `authorship`, and
`revision` retain their version-1 meanings. `definitionVersion` is exactly `2`. The `blocks` collection has
2 through 32 entries with globally unique opaque `report-block-` identities.

Every valid definition has:

- exactly one `session-evidence` block whose `sessionRef` equals `origin.sessionRef`;
- exactly one `narrative` block;
- at most one `route` block for each `routeRef`; and
- no block that references a session other than the origin.

Array order is semantic. Session and narrative are required content, not fixed positions. Route blocks can
be added, removed, or reordered. Editing a version-1 definition through the version-2 composition use case
preserves its existing block identities and upgrades it to version 2; readers continue to accept unchanged
version-1 definitions.

## Block variants

### Session evidence

`session-evidence` retains the version-1 fields and sensitivity authority. Its
`includePhysiologicalContext` value authorizes, but does not require, an individual export to include
recorded average or maximum heart rate.

### Narrative

`narrative` retains the version-1 normalization, 1–10,000 Unicode-scalar limit, control-character policy,
plain-text interpretation, and user authorship.

### Route

| Field | Type | Semantics |
|---|---|---|
| `blockRef` | opaque block capability | Stable identity used by editing and export review. |
| `kind` | `route` | Typed discriminator. |
| `sessionRef` | opaque session capability | Exactly the report origin session. |
| `routeRef` | opaque route capability | A distinct authoritative route belonging to the origin session. |
| `endpointRedactionMeters` | integer, 0–5,000 | Minimum recorded distance removed independently from the start and end before preview or export. |

The definition stores no coordinate, copied point, route label, distance calculation, or projection. A zero
redaction value is an explicit authored choice to retain the complete recorded geometry; it is never a
default inferred from missing input.

## Route resolution and endpoint privacy

Resolution first verifies the route belongs to the exact session and snapshot through the authoritative
training-route query. It then visits exact points in source order without reading persistence tables from
the report use case.

Endpoint redaction uses cumulative haversine distance over consecutive recorded coordinates:

1. A complete first pass determines total recorded route distance.
2. A second pass retains only recorded points whose cumulative distance is at least the chosen start
   redaction and at most total distance minus the chosen end redaction.
3. No coordinate is interpolated, moved, snapped, or replaced. If no recorded point remains, the route is
   explicitly fully redacted.
4. At most 500 retained recorded points are selected deterministically by cumulative-distance thresholds
   for the bounded visual projection. Source point count remains explicit.

An export review may omit a route or increase its endpoint redaction through 5,000 metres. It cannot include
an unselected route, lower the saved redaction, or authorize a route without an exact choice for its block.
Changing export choices does not mutate the definition.

## Compatibility and privacy

Version-2 readers reject unsupported block kinds, mixed block shapes, duplicate route references, foreign
session references, duplicate identities, invalid ordering cardinality, or out-of-range redaction. Invalid
or future definitions remain stored for recovery and never degrade into partial reports.

Definitions contain sensitive authored intent and opaque local relationships, but no provider account,
package digest, artifact path, coordinate, resolved fitness value, or export destination. Imports never
rewrite them. A changed source snapshot remains stale until the separate deliberate-refresh capability is
implemented.
