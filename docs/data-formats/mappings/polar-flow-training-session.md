# Polar Flow Training Session Mapping Version 1

## Status

This is the normative anti-corruption-layer contract for mapping a compatible Polar Flow personal-data-export training-session artifact into [canonical training session summary version 1](../canonical/training-session.md).

- Source provider: `polar-flow`
- Source adapter version introducing support: `polar-flow-archive@4`
- Current source adapter version: `polar-flow-archive@5`
- Mapping version: `polar-flow-training-session@1`
- Source evidence: [Polar Flow personal data export reference](../providers/polar-flow.md)

## Supported artifact boundary

The adapter recognizes the two documented `training-session` filename grammars. Summary support requires a root JSON object and the fields below. Recognition of the filename alone is not successful mapping.

Unknown object fields are accepted. Known fields with incompatible types, invalid values, duplicate source identity within one package, or a filename timestamp that disagrees with `startTime` are invalid. Validation and mapping complete before canonical visibility changes.

| Source path | Requirement and validation | Canonical outcome |
|---|---|---|
| resolved source subject | exactly one verified package subject | `originId` |
| `identifier.id` | required non-empty string | `sessionId` by exact value |
| `modified` | required local-form ISO 8601 date-time with UTC semantics | separately persisted source revision evidence; not a canonical summary field |
| `startTime` | required local-form ISO 8601 date-time | `startedAtLocal`; its whole seconds must equal the filename timestamp |
| `stopTime` | required local-form ISO 8601 date-time | `stoppedAtLocal` |
| `timezoneOffsetMinutes` | absent or signed integer representable as 32 bits | `utcOffsetMinutes`; absence maps to null |
| `durationMillis` | required integer from zero through `359999999`, the official maximum | `durationMilliseconds` without derivation |
| `distanceMeters` | absent or finite number from zero through `9999000`, the official maximum in metres | `distanceMeters`; absence maps to null |
| `calories` | absent or non-negative integer representable as signed 64 bits | `energyKilocalories`; absence maps to null |
| `hrAvg` | absent or non-negative integer representable as signed 64 bits | `averageHeartRateBpm`; absence maps to null |
| `hrMax` | absent or non-negative integer representable as signed 64 bits and not below `hrAvg` when both exist | `maximumHeartRateBpm`; absence maps to null |
| `sport.id` | absent or non-empty string | `sportRef`; absence maps to null |
| `exercises` | absent or array | `exerciseCount`; absence maps to null and an array maps to its length |

`created` must be a valid local-form ISO 8601 date-time with UTC semantics even though canonical version 1 does not retain it. This protects the documented source shape and leaves revision evidence interpretable.

## Aggregate rule

Top-level session values are authoritative for the summary. The adapter does not replace them with a single exercise and does not sum, average, select, or otherwise derive them from multiple exercises. Child exercise identifiers do not participate in aggregate identity.

Nested exercise objects, including missing sport references and mixed sports, are accepted because version 1 uses only collection cardinality. A non-array `exercises` value is invalid.

## Reimport and revision mapping

Identity is `(originId, identifier.id)`. Exact canonical equality is equivalent. For differing canonical content, `modified` provides ordering under canonical date-time comparison:

- a later incoming revision amends the visible summary atomically;
- an earlier incoming revision is preserved as non-visible provenance;
- an equal revision with different content is a conflict;
- invalid or unorderable revision timestamps reject the artifact before reconciliation.

Two artifacts with the same mapped identity in one ZIP are invalid independently of their order. A whole-package exact repeat may reuse a completed outcome only when the source adapter and operation mapping-set compatibility versions match. Import operations introduced by this mapping use `polar-flow-mapping-set@1`; per-observation provenance retains `polar-flow-training-session@1` or the applicable family mapping.

## Deliberately unmapped information

Version 1 validates only the types it consumes and deliberately does not persist these known source areas:

- `latitude`, `longitude`, and every nested route waypoint;
- `samples`, `transitionSamples`, `rrSamples`, and `transitionRrSamples`;
- laps, automatic laps, pause intervals, zones, and detailed statistics;
- `name`, `note`, comments, feelings, targets, training benefit, training load, and recovery time;
- energy-source percentages, physical information, device, product, and application references;
- nested exercise measurements and identifiers.

The exclusion prevents route and full-resolution sample ingestion in the MVP and avoids presenting unresolved source semantics as canonical facts. The containing session artifact is still `supported` when its summary contract passes. User-facing coverage must disclose the summary-only boundary without exposing filenames, identifiers, coordinates, notes, or personal values.

## Sport limitation

`sport.id` refers to Polar's separately managed sports catalogue. The evaluated takeout does not contain the identifier-to-name catalogue, and its `sport-profiles` artifact does not provide an equivalent join. Version 1 therefore retains the exact reference only as opaque same-source classification evidence. It never guesses a name, copies a private activity label into the public specification, or treats the reference as a cross-provider taxonomy.

Resolving `sportRef` to a canonical sport name or parent class requires a separately versioned catalogue mapping with public evidence and explicit unknown-value behavior.
