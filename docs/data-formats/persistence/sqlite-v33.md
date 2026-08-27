# SQLite Persistence Schema Version 33

## Status and migration

Schema version 33 applies `0033_nullable_planned_training_phase_name.sql` atomically after version 32. It preserves
every planned-training row and report definition while allowing a planned phase to retain the absence of a
source-authored name. Versions 1 through 33 remain direct supported baselines.

The migration creates a replacement `planned_training_phase_v33` table, copies every version-32 phase without
reinterpretation, removes the preceding phase table, and renames the replacement. An interruption rolls back the
table replacement and schema marker together, leaving the complete version-32 library available for retry.

## `planned_training_phase`

All version-31 phase identity, ordering, goal, intensity, transition, repeat, uniqueness, and foreign-key contracts
remain unchanged. Only `name` changes:

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `name` | TEXT | yes | Exact source-authored phase name from 1 through 120 characters, or null when the source supplied an empty or whitespace-only name. |

Null does not authorize persistence to invent a label. Canonical queries and portable export retain null;
presentation may derive a localized ordinal label such as `Phase 1` without presenting it as source evidence.
Existing non-empty names remain byte-equivalent.

## Import compatibility and reimport

Source adapter `polar-flow-archive@14`, operation mapping set `polar-flow-mapping-set@9`, and planned-training
mapping `polar-planned-training@2` accept observed unnamed phases. The changed operation versions prevent an exact
repeat recorded under an earlier compatibility contract from bypassing reassessment. Reimport can therefore enrich
an existing library with planned intent that the earlier adapter rejected or did not map.

## Verification

Migration evidence covers a populated version-32 named phase, injected interruption, successful retry, exact name
preservation, nullable-name persistence, restart reconstruction, SQLite integrity, and migration from every declared
baseline. Import evidence covers both scheduled and favourite target decoding, an unnamed synthetic phase, durable
null restoration, localized ordinal presentation, normalized export, exact reimport reassessment, and package-level
atomicity.
