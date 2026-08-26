# Polar Flow Training-Target Sport-Evidence Mapping

## Status

This is the normative Polar Flow adapter contract for deriving session-scoped, provider-neutral sport-recognition
suggestions from completed training targets. It does not change canonical training-session identity and does not
map a provider sport code to an opaque `sport.id`.

- Source provider: `polar-flow`
- Source adapter version: `polar-flow-archive@12`
- Operation mapping set: `polar-flow-mapping-set@7`
- Sport mapping: `polar-training-target-sport@1`
- Vocabulary revision: `polar-accesslink-detailed-sport-info@2026-05-06`
- Vocabulary source: [Polar AccessLink API](https://www.polar.com/accesslink-api/)
- Source-format evidence: [Polar Flow personal data export](../providers/polar-flow.md)
- Structural decision: [ADR 0031](../../architecture/decisions/0031-scope-training-target-sport-evidence-to-one-session.md)

## Supported source boundary

`sport-profiles-{numeric-token}-{uuid-token}.json` is supported as an array of sport-vocabulary observations.
Every item requires a canonical non-empty `exportVersion` and an uppercase, underscore-separated `sport` code.
The artifact validates that the export uses the observed detailed-sport vocabulary, but supplies no relationship
between that code and training-session `sport.id`. Profile array position, frequency, settings, and proximity are
not join evidence.

`training-target-{date}-{numeric-token}-{uuid-token}.json` is supported as one target object. It requires a
canonical non-empty `exportVersion`, parseable local `startTime`, Boolean `done`, and at most 256 `exercises`.
Every exercise requires a syntactically valid `sport` code. Unknown valid codes remain evaluated but unmapped;
an invalid known field rejects the complete package before visible state changes.

## Relationship contract

A target can contribute sport recognition only when all of these conditions hold:

1. `done` is `true`.
2. Its `startTime`, normalized without inventing a time zone, equals `startedAtLocal` for exactly one current
   training session in the same resolved observation origin.
3. The exact exercise sport code is present in the independently authored adapter mapping below.

No candidate is persisted when no session matches or when two or more sessions share the same local start.
Distinct mapped codes in one exact completed target produce distinct candidates and therefore an honest
`ambiguous` session. Repeated equal exercise codes contribute one candidate. A target never labels another
session merely because it shares the same opaque `sport.id`.

## Provider-neutral mapping version 1

| Source sport code | English name | Spanish name | Canonical family suggestion |
|---|---|---|---|
| `RUNNING` | Running | Carrera | `running` |
| `ROAD_RUNNING` | Road running | Carrera en asfalto | `running` |
| `TRAIL_RUNNING` | Trail running | Carrera por montaña | `running` |
| `TREADMILL_RUNNING` | Treadmill running | Carrera en cinta | `running` |
| `CYCLING` | Cycling | Ciclismo | `cycling` |
| `ROAD_CYCLING` | Road cycling | Ciclismo en carretera | `cycling` |
| `MOUNTAIN_BIKING` | Mountain biking | Ciclismo de montaña | `cycling` |
| `INDOOR_CYCLING` | Indoor cycling | Ciclismo indoor | `cycling` |
| `WALKING` | Walking | Caminar | `walking` |
| `HIKING` | Hiking | Senderismo | `hiking` |
| `SWIMMING` | Swimming | Natación | `swimming` |
| `POOL_SWIMMING` | Pool swimming | Natación en piscina | `swimming` |
| `OPEN_WATER_SWIMMING` | Open-water swimming | Natación en aguas abiertas | `swimming` |
| `STRENGTH_TRAINING` | Strength training | Entrenamiento de fuerza | `strength` |
| `MOBILITY_STATIC` | Static mobility | Movilidad estática | `mobility` |
| `CROSS_TRAINER` | Cross trainer | Bicicleta elíptica | `other` |
| `INDOOR_ROWING` | Indoor rowing | Remo indoor | `other` |
| `WATERSPORTS_CANOEING` | Canoeing | Piragüismo en canoa | `water-sport` |
| `WATERSPORTS_KAYAKING` | Kayaking | Piragüismo en kayak | `water-sport` |
| `OTHER_OUTDOOR` | Other outdoor activity | Otro deporte al aire libre | `other` |

The table maps only exact published vocabulary codes. It does not claim that the AccessLink page specifies the
takeout archive, that every published code is implemented, or that its FIT mapping identifies takeout
`sport.id`. Extending this table changes `polar-training-target-sport` mapping version and requires synthetic
contract evidence.

## Persistence, projection, and reimport

Each accepted relation persists one candidate containing private source code, mapping version, vocabulary revision,
retrieval instant, localized provider-neutral names, optional family suggestion, and one opaque evidence reference.
Separate source rows retain every target artifact digest and locator, exact record locator, source start, export
version, and import operation. Another export of the same relationship adds provenance without multiplying the
candidate. Public application and presentation contracts receive only the provider-neutral suggestion, provenance
version fields, opaque evidence reference, and candidate count.

Session-scoped candidates take precedence over a less-specific provider-catalogue candidate for that session.
Personal classification retains higher presentation precedence without deleting recognition evidence. Equal ZIP
bytes are an exact repeat only under the same source-adapter and operation-mapping versions. A later mapping set
therefore reassesses an older completed ZIP and can enrich session identity without duplicating sessions or
evidence rows.

Recognition does not require the matched session to contain `sport.id`. Exact evidence can therefore produce a
`recognized` or `ambiguous` session with no personal-classification capability. History assigns every represented
exact candidate set its own opaque `sessionFilterRef`; the unresolved remainder of a recorded source profile has a
different filter. The independent `sportRef` continues to identify only a real source profile that the user may
classify. A personal override reunites exact and unresolved sessions for that profile without deleting exact
evidence. This separation is defined by training sport identity version 2 and training sports version 3.

## Explicit non-evidence

The adapter never derives sport identity from opaque numeric identifiers, profile array position, route presence,
GPS shape, device, pace, distance, heart rate, power, cadence, target name, target description, or sport frequency.
Those observations may support exploration, but none establishes one provider-authored sport identity.
