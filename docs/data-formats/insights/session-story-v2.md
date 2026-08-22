# Session Story Version 2

## Purpose and compatibility

`SessionStory` version 2 is the provider-neutral application read model for evidence-adaptive
training-session presentation. It retains every version-1 source assessment, composed exercise, role,
bounded projection, exact capability, recorded-time alignment, sport-aware metric, provenance, and privacy
rule. It adds application-owned evidence summaries so a client can foreground a route, a supported signal,
recorded structure, or recorded zones without reconstructing source-state semantics in presentation.

The command remains `query_session_story`. Its request still conforms to
[`session-story-query-v1.schema.json`](../../../schemas/session-story-query-v1.schema.json), while its
response conforms to
[`session-story-v2.schema.json`](../../../schemas/session-story-v2.schema.json) and carries
`schemaVersion` set to 2. The immutable
[`version-1 contract`](session-story-v1.md) documents the preceding response.

Version 2 is additive in meaning but intentionally versioned in transport. A version-1 client must not
accept the added `composition` or `evidence` objects accidentally, and a version-2 client must not infer
them from a version-1 payload.

## Coherent source assessments

Top-level `session`, `structure`, `routes`, `signals`, `zones`, and `provenance` retain the exact version-1
contracts. `composition` summarizes only their exercise-container states after all ports have accepted the
same `snapshotRef`:

| State | Meaning |
|---|---|
| `not-evaluated` | No compatible assessment exists for that evidence family. |
| `source-absent` | The assessment exists and the source exercise collection was absent. |
| `source-empty` | The source exercise collection was present with no entries. |
| `source-present` | The source exercise collection contains one or more entries. |

The four independent fields are `structureState`, `routeState`, `signalState`, and `zoneState`.
`exerciseCount` is the number of exercise identities composed from all valid evidence families. It may be
positive when structural evidence is not evaluated or absent. Source-present does not claim that every
exercise has a route, supported series, populated zone group, lap, or pause; the exact nested assessments
remain authoritative.

## Exercise evidence summary

Every composed exercise adds one `evidence` object. It states whether structural exercise evidence is
present and counts recorded supported children without replacing their exact collections:

- `hasStructure`;
- `manualLapCount`, `automaticLapCount`, and `pauseCount`;
- `zoneGroupCount` and `zoneCount`;
- `timedZoneCount`, counting only zone bands with recorded `timeInZoneMilliseconds`; and
- `unsupportedZoneGroupCount`.

A zone band without recorded time remains useful bound or aggregate evidence. It is not a temporal phase,
and `timedZoneCount` prevents a client from treating every recorded band as a timeline.

Each independent `primary` and `transition` role also adds `evidence`:

- `routePointCount`;
- `signalSeriesCount` and `signalSeriesWithValuesCount`;
- `partialSignalSeriesCount`, for a non-empty series containing both values and unavailable slots;
- `unavailableSignalSeriesCount`, for a non-empty series with no recorded value;
- `emptySignalSeriesCount`;
- `unsupportedSignalSeriesCount`;
- `signalSampleCount`, `availableSignalSampleCount`, and `unavailableSignalSampleCount`.

All counts cover the exact source series metadata, not only the bounded `visualSamples`. Counts use
validated non-negative arithmetic and fail the complete query if they cannot be represented. An unsupported
series remains an attributed count and never becomes a guessed kind, unit, value, or label. A series with
unavailable samples remains distinct from an empty series and from a source collection that was absent.

## Presentation contract

The application describes availability, role, counts, units, transforms, exact capabilities, and source
attribution. Presentation owns the accepted hierarchy and may select the strongest usable evidence for the
leading surface. It must follow these constraints:

1. A route surface requires an actual route with recorded points. An absent or zero-point route cannot
   reserve an empty map.
2. A signal-led surface requires a supported series with at least one recorded value. Null values and
   `gapBefore` remain gaps.
3. Structural and zone evidence may lead when no route or usable signal exists, but their recorded children
   cannot be rearranged into an invented chronology.
4. Mixed exercises and primary or transition roles remain separate. Evidence cannot cross exercise or role
   boundaries merely to fill a visual region.
5. One concise availability account may use the summaries. Exact source states and values remain reachable
   through the retained nested assessments and exact capabilities rather than being repeated as general
   warnings throughout the session.
6. `provenance.totalEventCount` and `provenance.current` remain the factual account of one or multiple source
   observations. Presentation cannot describe every repeated observation as a changed canonical session.

The response still carries no color, icon, layout, localized prose, diagnosis, recommendation, inferred
route, inferred phase, or external map authority.

## Failures, boundedness, and privacy

Request validation, snapshot coherence, exercise identity, role separation, bounded projections, exact
pagination capabilities, recorded-time equality, error codes, and local-only privacy behavior are unchanged
from version 1. A mixed evidence revision returns `training-session-detail-changed`; malformed composition
returns `invalid-training-session-detail`; an unavailable authoritative query returns
`training-session-detail-failed`. No failure returns a partial story.

Changing assessment-state meaning, count meaning, composition identity, alignment, exact capabilities,
sport-aware transforms, or privacy behavior requires a new response version.
