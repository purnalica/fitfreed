# Training-Session Zone Read Model Version 1

## Purpose

This contract exposes the complete source-recorded zone distribution for one opaque training-session
capability without leaking provider identifiers or presenting aggregate bands as temporal segments. It is
independent from structure, route, signal, and personal-segmentation queries so opening a session does not
force unrelated evidence into one unbounded response.

## Query

`query_training_session_zones` accepts
[`training-session-zones-query-v1.schema.json`](../../../schemas/training-session-zones-query-v1.schema.json)
and returns
[`training-session-zones-v1.schema.json`](../../../schemas/training-session-zones-v1.schema.json).
`TrainingSessionZonesQuery` contains:

| Field | Type | Required | Contract |
|---|---|---|---|
| `sessionRef` | string | yes | Valid opaque `session-` capability. |
| `snapshotRef` | string or null | yes | Optional expected `training-snapshot-` capability from discovery. |

Malformed capabilities fail before the port runs. A supplied snapshot must still identify the current
canonical training revision.

## Result

`TrainingSessionZonesResult` contains the resolved `snapshotRef`, exact requested `sessionRef`, and `zones`.
Null `zones` means the session has not been evaluated by a compatible zone mapping. A present assessment
retains null, empty, and populated exercise collections separately.

Every `TrainingExerciseZonesView` contains an opaque `exerciseRef`, contiguous source `ordinal`, and optional
`zones`. Null exercise `zones` means the source field was absent. Present `TrainingZoneCollectionView`
contains ordered supported groups and `unsupportedGroupCount`.

Every `TrainingZoneGroupView` contains:

- opaque `zoneGroupRef` and contiguous mapped `ordinal`;
- exact `kind` and compatible `unit` codes from canonical version 1;
- null, empty, or populated `zones`, preserving source optionality.

The exact version-1 kind/unit pairs are `heart-rate` with `beats-per-minute`, `speed` with
`kilometers-per-hour`, and `power` with `watts`.

Every `TrainingZoneView` contains opaque `zoneRef`, contiguous `ordinal`, exact `lowerLimit` and `higherLimit`
bounds, and nullable recorded `timeInZoneMilliseconds`, `distanceMeters`, and `muscleLoad`. No
presentation-facing value contains a provider token, source locator, subject identity, session identifier,
or exercise identifier.

## Validation and boundedness

Application validation requires exact requested and returned session identity, a current snapshot, unique
domain-separated capabilities, contiguous exercise/group/zone order, valid kind/unit pairs, ordered finite
non-negative bounds, and kind-compatible optional aggregates. Exercise capabilities must align with the
independent structural assessment when both are read under the same snapshot.

Version 1 returns the exact zone collection rather than a downsampled projection. Import compatibility
limits each exercise to at most 64 source groups and each group to at most 256 source bands; therefore one
response is bounded without pagination. A future format requiring larger collections must revise both the
import and query contracts rather than truncate evidence silently.

## Attribution and rendering

The endpoint is source-recorded evidence. FitFreed-derived projection metadata and user-authored criteria do
not enter it. Presentation names that attribution, identifies unsupported groups without exposing their
tokens, and keeps the exact table available for every visual distribution.

Visual proportions may use only compatible known values within one group. Null values are omitted from the
known-value denominator and remain explicitly unavailable. A zero total yields no fabricated proportion.
The view cannot imply time ordering, phase boundaries, coverage outside the values actually present, or
medical interpretation.

## Failures and privacy

A changed snapshot returns `training-session-detail-changed`. Missing sessions and adapter or storage
failures return `training-session-detail-failed`. Malformed capabilities or internally inconsistent persisted
evidence return `invalid-training-session-detail` before presentation. No failure returns partial groups.

The query reads only the local library and performs no external request. Route geometry, exact temporal
signals, provider identifiers, and personal source locations are outside the response.
