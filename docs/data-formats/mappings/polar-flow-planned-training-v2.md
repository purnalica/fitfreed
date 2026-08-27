# Polar Flow Planned-Training Mapping Version 2

## Status

This is the normative Polar Flow adapter contract for translating supported scheduled and favourite training targets
into [canonical planned training version 1](../canonical/planned-training.md).

- Source provider: `polar-flow`
- Source adapter version: `polar-flow-archive@14`
- Operation mapping set: `polar-flow-mapping-set@9`
- Planned-training mapping: `polar-planned-training@2`
- Planned-sport mapping: `polar-training-target-sport@1`
- Source-format evidence: [Polar Flow personal data export](../providers/polar-flow.md)
- Persistence: [SQLite schema version 34](../persistence/sqlite-v34.md)
- Structural decision: [ADR 0033](../../architecture/decisions/0033-model-planned-training-as-versioned-intent.md)

## Accepted artifacts and bounds

One `training-target-{date}-{numeric-token}-{uuid-token}.json` object maps one scheduled target. One
`favourite-targets-{numeric-token}-{uuid-token}.json` array maps one immutable favourite snapshot with zero to
10,000 items. The strict top-level filename grammar, safe archive layout, required source-subject claim, and complete
package validation run before visible publication.

Each target accepts at most 256 exercises. Each exercise accepts at most 20 unique phases. Repeat expansion accepts at
most 200 phase occurrences with depth at most two. Exceeding any bound invalidates the supported artifact; it is not
truncated.

## Identity and revisions

Scheduled source identity is the filename's numeric token following its date. The delivery UUID and date token are
not canonical target identity. `targetId` is a scoped digest of provider, origin, scheduled kind, and that source
identity, so a later artifact for the same scheduled target retains the target identity while its evidence may
change.

Favourite item identity is a digest of the canonical JSON item plus a zero-based occurrence counter for exact
duplicates. Array reordering therefore retains the set of item identities. The snapshot identity is a digest of
origin and complete artifact SHA-256, so ordering, additions, removals, and an explicitly empty array remain distinct
source snapshots. Array position is retained only as membership order and is not promoted into target identity.

`evidenceRevision` is a digest of the complete canonical source target object. It is independent from
`polar-planned-training@2`; a later mapping can enrich the same source evidence without fabricating a source edit.
Reusing one evidence and mapping identity with different mapped structure is an invalid mapping collision.

The mapped contract carries `targetId`, `evidenceRevision`, `completion`, `editability`, `mappingCoverage`,
`exerciseId`, `durationGoalMilliseconds`, `distanceGoalMeters`, `phaseId`, `ordinal`, `transitionId`, `repeatId`,
`returnToPhaseOrdinal`, and `totalIterations`. Its controlled outcome tokens include `scheduled`,
`favorite-template`, `partial`, and `conflict`.

## Target mapping

The provider grammar and observed types are owned by the [source-format reference](../providers/polar-flow.md). The
table below defines only their mapping outcomes.

The canonical target-kind tokens are `scheduled` and `favorite-template`.

| Source path or condition | Canonical outcome |
|---|---|
| scheduled target | `kind = scheduled` |
| favourite item | `kind = favorite-template` |
| `exportVersion` | Retained as source-format provenance after strict non-empty text validation; no ordering is inferred. |
| `startTime` | Parsed as a real source-local date-time and normalized without an offset. Required for scheduled targets. |
| `done = false` / `true` | `completion = pending` / `completed`. Required for scheduled targets. |
| `name` | Target name, with the canonical 160-character limit. |
| absent / present `description` | Absent / exact target description, including a present empty string. |
| absent `nonUserEditable` | `editability = unspecified` |
| `nonUserEditable = false` / `true` | `editable` / `non-editable` |
| absent / present `exercises` | Absent / exact ordered collection, including present-empty. |

Favourite items must omit `startTime`, `done`, and `nonUserEditable`. Their presence rejects the item and therefore
the complete package. Scheduled targets require `startTime` and `done`; absence rejects the artifact.

## Exercise mapping

| Source value | Canonical outcome |
|---|---|
| `exercises[].type = FREE` | `kind = open` |
| `exercises[].type = PHASED` | `kind = phased` |
| `exercises[].type = VOLUME` | `kind = volume` |
| `exercises[].type = STRENGTH` | `kind = strength` |
| another `exercises[].type` string | `kind = unmapped` plus an unmapped-value locator |
| absent / present `exercises[].duration` | Absent / exact positive whole-millisecond duration goal |
| absent / present `exercises[].distance` | Absent / exact positive finite metre goal |
| absent `exercises[].sport` | `sport = unavailable` |
| supported exact `exercises[].sport` code | Provider-neutral recognized suggestion and private attributed source evidence |
| another syntactically valid `exercises[].sport` code | `sport = unmapped` plus an unmapped-value locator |
| absent / present `exercises[].phases` | Absent / exact ordered phase collection, including present-empty |

Duration syntax is the non-negative ISO 8601 subset `P[nD][T[nH][nM][n[.fraction]S]]`. At least one component is
required, an empty `T` component is invalid, overflow is rejected, and fractional precision beyond milliseconds is
accepted only when every discarded digit is zero. The resulting goal must be greater than zero.

Sport suggestions use the exact vocabulary and localized mapping defined by the
[training-target sport-evidence contract](polar-flow-training-target-sport.md). The source code, record locator, and
mapping provenance remain infrastructure data. A planned exercise never inherits the recorded session's opaque
sport reference.

## Phase, intensity, and repeat mapping

Source `phases[].index` values must equal their one-based array position. Canonical phase ordinals are zero-based. A mismatch
invalidates the artifact instead of reordering it.

| Source value | Canonical outcome |
|---|---|
| `phases[].goal.type = DURATION` with only `phases[].goal.duration` | Positive duration goal in exact whole milliseconds |
| `phases[].goal.type = DISTANCE` with only `phases[].goal.distance` | Positive finite distance goal in metres |
| another `phases[].goal.type` string | `goal = unmapped`; any supplied goal members receive unmapped locators |
| `phases[].intensity.type = NONE` with absent or zero/zero bounds | `intensity = none` |
| `phases[].intensity.type` equal to `HEART_RATE_ZONES`, `SPEED_ZONES`, or `POWER_ZONES` | Inclusive zone range for the corresponding canonical metric using `phases[].intensity.lowerZone` and `phases[].intensity.upperZone`. |
| another `phases[].intensity.type` string | `intensity = unmapped`; supplied bounds receive unmapped locators |
| `phases[].changeType = MANUAL` / `AUTOMATIC` | `change = manual` / `automatic` |
| another `phases[].changeType` string | `change = unmapped` plus an unmapped-value locator |
| empty or whitespace-only `phases[].name` | Absent canonical phase name; presentation may derive only a localized ordinal label. |
| non-empty `phases[].name` | Exact canonical phase name, subject to the 120-character bound. |
| both `phases[].jumpIndex` and `phases[].repeatCount` absent | No repeat edge |
| both present and valid | Return to `jumpIndex - 1`; `totalIterations = repeatCount + 1` |

Zone bounds must both be present, between 1 and 5, and ordered. A repeat source count is between 1 and 99, its jump
is between one and the current one-based phase index, and both members must occur together. Canonical graph
validation additionally rejects crossing ranges, excessive nesting, or excessive expansion.

## Unknown members and coverage

Unknown object members and unknown enum strings do not disappear silently. The adapter records stable
JSON-pointer-like locations through source-structure order and lexical object-member order, then sets canonical
mapping coverage to `partial` with the exact count.
It intentionally does not persist unknown source values as a generic object: their meaning, privacy, and compatibility
are not established. The original ZIP remains the source recovery artifact.

Malformed JSON, wrong root shape, wrong known-field type, invalid text, invalid sport-code syntax, impossible local
date-time, invalid duration, non-positive or non-finite goal, invalid phase order, incomplete repeat, or violated
canonical bound rejects the recognized artifact and prevents package-level visible publication.

## Completed-target relationship

A completed scheduled target additionally emits each distinct exercise sport code with its normalized local start.
After current sessions have reconciled, the narrower sport-evidence adapter may relate it only to exactly one session
in the same origin with the same canonical local start. Pending targets, no match, or multiple matches emit no session
candidate. This independent relationship can support sport recognition and later planned-versus-recorded composition;
it does not turn plan phases into recorded evidence.

Version 1 does not establish an exact planned-target relationship from target name, description, filename date,
duration, distance, sport family, route, samples, or phase similarity.

## Reimport and snapshots

All target revisions, provenance, conflicts, and favourite membership publish in the same import visibility
transaction as operation completion.

- Exact canonical state records equivalent provenance without duplicating the target.
- A richer mapping of equal evidence advances the current mapping revision.
- The same scheduled definition may advance only from pending to completed; an older pending observation cannot roll
  it back.
- Any other changed definition is retained as a conflict and does not replace the current head.
- A later favourite snapshot may reorder, add, remove, or contain zero items. Earlier targets and snapshots remain;
  only the latest snapshot states current exported membership.
- An injected interruption rolls back target heads, revisions, provenance, snapshots, and membership together.

## Synthetic examples

A supported scheduled phased target:

```json
{
  "exportVersion": "1.0",
  "name": "Progressive intervals",
  "description": "Synthetic structured intent",
  "startTime": "2026-01-02T10:30:00.000",
  "done": true,
  "nonUserEditable": false,
  "exercises": [
    {
      "type": "PHASED",
      "sport": "RUNNING",
      "phases": [
        {
          "index": 1,
          "name": "Warm up",
          "changeType": "AUTOMATIC",
          "goal": { "type": "DURATION", "duration": "PT10M" },
          "intensity": { "type": "HEART_RATE_ZONES", "lowerZone": 1, "upperZone": 2 }
        },
        {
          "index": 2,
          "name": "Work",
          "changeType": "MANUAL",
          "goal": { "type": "DISTANCE", "distance": 1000.0 },
          "intensity": { "type": "SPEED_ZONES", "lowerZone": 3, "upperZone": 4 }
        },
        {
          "index": 3,
          "name": "Recovery",
          "changeType": "AUTOMATIC",
          "goal": { "type": "DURATION", "duration": "PT1M" },
          "intensity": { "type": "NONE" },
          "jumpIndex": 2,
          "repeatCount": 3
        }
      ]
    }
  ]
}
```

The final edge records four total executions of phases 2–3: the initial execution plus three repeats. A supported
explicitly empty favourite snapshot is simply:

```json
[]
```

An invalid phase skips its required source index and is rejected:

```json
{
  "exportVersion": "1.0",
  "name": "Invalid synthetic target",
  "startTime": "2026-01-02T10:30:00",
  "done": false,
  "exercises": [
    {
      "type": "PHASED",
      "phases": [
        {
          "index": 2,
          "name": "Skipped first phase",
          "changeType": "MANUAL",
          "goal": { "type": "DURATION", "duration": "PT1M" },
          "intensity": { "type": "NONE" }
        }
      ]
    }
  ]
}
```

Synthetic adapter, domain, migration, reconciliation, empty-snapshot, and rollback tests are the executable evidence
for this contract. No example is copied from a personal export.
