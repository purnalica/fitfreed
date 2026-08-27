# SQLite Persistence Schema Version 31

## Status and migration

Schema version 31 applies `0031_planned_training.sql` atomically after version 30. It adds normalized,
provider-neutral planned-training intent without rewriting any canonical observation, recorded training structure,
sport classification, authored range, criterion, report, or disposable workspace. An interruption rolls back every
new table, index, trigger, and `PRAGMA user_version` change to the complete version-30 library. Versions 1 through 31
remain direct supported baselines.

The migration accompanies source adapter `polar-flow-archive@13`, operation mapping set
`polar-flow-mapping-set@8`, and planned-training mapping `polar-planned-training@1`. Equal ZIP bytes completed under
`polar-flow-archive@12` or `polar-flow-mapping-set@7` are reassessed under the new compatibility contract rather than
short-circuited as an exact repeat.

The migration creates no inferred target from earlier session-scoped sport evidence. Planned targets enter only
through a later validated source import. The circular current-head relationship is declared
`DEFERRABLE INITIALLY DEFERRED`, allowing one transaction to create a target head and its immutable first revision
without a temporarily visible orphan.

## Schema ownership

The exact SQL migration is the machine-readable persistence contract. The tables below explain its logical roles and
column groups. Persistence remains an implementation format, not the portable FitFreed interchange contract.

### `planned_training_revision`

Singleton column `id` is fixed to one; `revision` stores the non-negative visible revision. Target insertion, current-head or conflict-state
change, target deletion, and favourite-snapshot insertion advance it. Provenance refresh and last-seen metadata do
not claim a new visible fitness state.

### `planned_training_target`

One row is the current head for `(origin_id, target_id)`.

| Columns | Contract |
|---|---|
| `origin_id`, `target_id` | Composite primary key; target identity is `planned-target-` plus 64 lowercase hexadecimal characters and belongs to an existing observation origin. |
| `source_provider`, `source_kind`, `source_identity` | Infrastructure identity. Kind is `scheduled` or `favorite-template`; the tuple is unique within an origin. |
| `current_evidence_revision`, `current_mapping_version` | Deferred foreign key to the immutable current revision. |
| `reconciliation_state` | `current` or `conflicted`. Conflict never silently selects the incoming revision. |
| `first_seen_import_operation_id`, `last_seen_import_operation_id` | Existing import-operation references that bound provenance without changing target identity. |

### `planned_training_target_revision`

One immutable mapped representation is keyed by `origin_id`, `target_id`, `evidence_revision`, and
`mapping_version`. `evidence_revision` uses `planned-evidence-` plus 64 lowercase hexadecimal characters;
`mapping_version` is a non-empty
trimmed string.

| Columns | Contract |
|---|---|
| `target_kind`, `scheduled_at_local`, `completion_state` | Scheduled revisions require the local instant and `pending` or `completed`; favourite templates prohibit both. |
| `name`, `description` | Name length is 1–160; optional description length is at most 2,000. Text meaning is owned by the canonical contract. |
| `editability` | `editable`, `non-editable`, or `unspecified`. |
| `exercises_present` | Distinguishes an absent exercise collection from present-empty. |
| `mapping_state`, `unmapped_field_count` | `complete` requires zero; `partial` requires a positive count. |
| `source_export_version` | Non-empty trimmed source format metadata, at most 64 characters by the SQLite constraint; the source adapter also applies its encoded-byte bound. |

The row references its target head with deferred cascading ownership. A mapping upgrade can add a second revision for
the same source evidence while preserving the former mapped representation.

### `planned_training_exercise`

Exercises belong to one target revision. `exercise_id` uses `planned-exercise-` plus 64 lowercase hexadecimal
characters. Its composite identity is unique, and `ordinal` is unique within the revision.

| Columns | Contract |
|---|---|
| `ordinal` | Non-negative canonical order. Contiguity is a domain invariant checked before persistence. |
| `exercise_kind` | `open`, `phased`, `volume`, `strength`, or `unmapped`. |
| `duration_goal_milliseconds`, `distance_goal_meters` | Optional positive goals in whole milliseconds and metres. |
| `sport_state` | `unavailable`, `unmapped`, or `recognized`. |
| `canonical_family_suggestion`, `localized_names_json` | Provider-neutral recognized suggestion only. Names must be a valid JSON object. |
| `catalogue_revision`, `catalogue_retrieved_at_utc`, `sport_mapping_version`, `sport_evidence_ref` | All required together for `recognized` and all absent for `unavailable` or `unmapped`. Evidence reference uses `sport-evidence-` plus 64 lowercase hexadecimal characters. |
| `phases_present` | Distinguishes absent phases from present-empty. |

Canonical family suggestions are restricted to the provider-neutral `SportFamily` values implemented by the domain.
Private source codes never enter this table.

### `planned_training_phase`

Phases belong to one exercise revision. `phase_id`, mandatory `transition_id`, and optional `repeat_id` use the
`planned-phase-`, `planned-transition-`, and `planned-repeat-` digest forms. Phase ordinal is unique within the
exercise.

| Columns | Contract |
|---|---|
| `ordinal`, `name` | Non-negative order and a 1–120-character source-authored name. |
| `goal_kind` | `duration`, `distance`, or `unmapped`; exactly the matching positive goal column is populated. |
| `intensity_kind` | `none`, `zone-range`, or `unmapped`. A range requires `intensity_metric` equal to `heart-rate`, `speed`, or `power`, `lower_zone` and `upper_zone` from 1–5, and ordered bounds; other kinds prohibit all range columns. |
| `change_kind` | `manual`, `automatic`, or `unmapped`. |
| `repeat_id`, `return_to_phase_ordinal`, `total_iterations` | All absent or all present. Return ordinal is non-negative and total iterations is 2–100. Graph shape and expansion are domain invariants. |

### Mapping and source evidence

`planned_training_unmapped_field` stores one ordered, unique `source_field_locator` for each unmapped member of a
target revision. It stores no unknown source value. Locator length is 1–2,048 and surrounding whitespace is invalid.

`planned_training_source_sport_evidence` stores one private `source_sport_code` and exact
`source_record_locator` per exercise, `mapping_version`, and `source_provider`. It owns no canonical sport name. The
source code is non-empty, trimmed, and at most 128 characters; the record locator is non-empty, trimmed, and at most
256 characters.

The target revision's mapping state and count must agree with its complete locator rows. Import code verifies an
existing evidence-and-mapping revision against both locator order and source-sport structure before reuse; a mismatch
is an invalid library contract collision.

### Provenance and conflicts

`planned_training_target_provenance` records every accepted import observation. Its local `id` references the exact
immutable revision and stores `import_operation_id`, `source_provider`, `source_adapter_version`, `mapping_version`,
`source_identity`, `source_artifact_locator`, `source_artifact_sha256`, `source_record_locator`,
`source_export_version`, `reconciliation_decision`, and `contributes_to_visible_state`. Decisions are `create`,
`equivalent`, `enrich`, `amend`, `preserve`, or `conflict`. The composite
uniqueness rule prevents duplicate provenance inside one operation while allowing later exports to add attribution.

`planned_training_conflict` records its local `id`, `import_operation_id`, `existing_evidence_revision`,
`existing_mapping_version`, `incoming_evidence_revision`, `incoming_mapping_version`, and incoming
`source_artifact_locator`. Both revisions must exist. The target head changes only to
`reconciliation_state = conflicted`; conflict insertion does not replace its current revision.

### Favourite snapshots

`planned_training_favorite_snapshot` stores an immutable exported collection identity per origin. `snapshot_ref` uses
`favorite-snapshot-` plus 64 lowercase hexadecimal characters. `source_provider`, `source_adapter_version`,
`mapping_version`, `source_artifact_locator`, `source_artifact_sha256`, and `import_operation_id` retain snapshot
provenance.

`planned_training_favorite_snapshot_membership` stores contiguous application-validated order and the exact target
revision represented by that snapshot. Ordinal is unique, and one target appears at most once in a snapshot. A
snapshot with zero membership rows is an explicit empty source collection, not missing data.

A later snapshot never deletes an earlier target or snapshot. Current exported membership is determined by the most
recent successful snapshot operation, while full history remains recoverable.

## Transactional reconciliation

Planned-target records reconcile after current training sessions and inside the same package visibility transaction.
That order permits exact completed-target sport attribution without turning it into target identity.

- `create` inserts the deferred head and immutable revision.
- `equivalent` records provenance and last-seen operation without duplicating canonical structure.
- `enrich` and `amend` move the current head to an already inserted immutable revision.
- `preserve` retains the current head and stores the incoming revision and provenance.
- `conflict` retains both revisions, marks the head conflicted, and inserts explicit conflict evidence.
- Favourite snapshot and membership publication occurs in the same transaction after its target records.

Package cancellation is honored before the visibility boundary and deferred while it resolves. Any SQL failure or
injected interruption rolls back heads, revisions, normalized children, provenance, conflicts, snapshots, membership,
operation completion, and revision counters together.

## Indexes and query boundary

`planned_training_target_current` supports origin, kind, conflict-state, and identity scans.
`planned_training_revision_chronology` supports scheduled chronology with deterministic target tie-breaking.
`planned_training_provenance_target` supports target history by import operation.
`planned_training_favorite_snapshot_recent` supports latest-snapshot resolution.

SQLite owns bounded identity, chronology, joins, and exact persisted state. Application query adapters own
relationship cardinality, result hierarchy, localized formatting, plan-versus-recorded composition, report meaning,
and disclosure. A raw phase table is never the primary product read model.

## Privacy, backup, and portability

Schema 31 contains sensitive local training intent and source provenance. Artifact locators, hashes, private provider
sport codes, and conflict details must not enter public diagnostics. Whole-library backup preserves every table and
passes schema and SQLite integrity checks before success.

The SQLite file remains non-portable. [Portable planned-training export version
1](../portable/planned-training-v1.md) reconstructs domain values through the same invariant checks as an application
query, excludes private library correlation material, distinguishes mapped values from unmapped locators, and
preserves identities, ordering, provenance, conflicts, and favourite snapshot meaning. It is a capability export
rather than a complete library export; consumers never infer its contract from these tables.

## Verification

Migration evidence covers a complete version-30 source, an injected transactional interruption, successful retry,
schema version, table inventory, and `PRAGMA integrity_check`. Synthetic import evidence covers scheduled and
favourite structure, exact repeat, pending-to-completed amendment, older evidence, unorderable conflict, mapping
revision identity, changed and empty favourite snapshots, exact source-sport retention, and package-level rollback.
