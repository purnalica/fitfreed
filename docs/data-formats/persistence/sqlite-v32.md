# SQLite Persistence Schema Version 32

## Status and migration

Schema version 32 applies `0032_planned_training_reports.sql` atomically after version 31. It extends durable
report definitions to reference one exact planned-training target and one planned-library snapshot while preserving
all version-31 planned-training rows and every existing report value. Versions 1 through 32 remain direct supported
baselines.

The migration creates replacement `report_definition_v32` and `report_block_v32` tables, copies every existing
report and block without reinterpretation, removes the preceding report tables, renames the replacements to
`report_definition` and `report_block`, and recreates `report_definition_recent`. An interruption rolls back that
whole sequence and the schema marker together, leaving the complete version-31 library available for retry.

## `report_definition`

The version-32 definition table retains all preceding report fields and adds the planned-training evidence boundary.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `report_ref` | TEXT | no | Opaque `report-` identity and primary key. |
| `title` | TEXT | no | Trimmed user title, 1–120 characters. |
| `locale` | TEXT | no | Exactly `en-US` or `es-ES`. |
| `source_snapshot_ref` | TEXT | no | One opaque `training-snapshot-` or `planned-snapshot-` capability selected by the origin. |
| `origin_kind` | TEXT | no | Exactly `session`, `question`, `exploration`, `planned-training`, or `blank`. |
| `origin_session_ref` | TEXT | yes | Required only by a `session` origin. |
| `origin_planned_target_ref` | TEXT | yes | Required only by a `planned-training` origin; opaque `planned-target-` identity. |
| `origin_question_kind` | TEXT | yes | `training-period-comparison` for question and exploration origins. |
| `origin_question_version` | INTEGER | yes | Exactly 1 when a question is present. |
| `origin_baseline_from` | TEXT | yes | Exploration-origin baseline start date. |
| `origin_baseline_through` | TEXT | yes | Exploration-origin baseline inclusive end date. |
| `origin_comparison_from` | TEXT | yes | Exploration-origin comparison start date. |
| `origin_comparison_through` | TEXT | yes | Exploration-origin comparison inclusive end date. |
| `provenance_policy` | TEXT | no | Exactly `current-attribution`. |
| `authorship` | TEXT | no | Exactly `user`. |
| `definition_version` | INTEGER | no | One of 1, 2, 3, 4, or 5. Planned-training origins require version 5. |
| `revision` | INTEGER | no | Positive optimistic-concurrency revision. |
| `created_at_utc` | TEXT | no | Original creation time. |
| `updated_at_utc` | TEXT | no | Latest successful revision time. |

Relational checks require exactly the fields and snapshot family belonging to the selected origin. Session, question,
exploration, and blank origins retain a `training-snapshot-` source. A planned-training origin requires one
`planned-target-` capability, a `planned-snapshot-` source, and definition version 5. Exploration ranges remain valid
ordered Gregorian dates of at most 366 inclusive days. The `report_definition_recent` index orders the bounded
library by update time and opaque identity.

## `report_block`

The version-32 block table retains every version-31 block shape and adds a distinct planned-training block.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `report_ref` | TEXT | no | Owning definition; cascades on deletion. |
| `block_ref` | TEXT | no | Globally unique opaque `report-block-` identity. |
| `ordinal` | INTEGER | no | Semantic order from 0 through 31. |
| `kind` | TEXT | no | `session-evidence`, `route`, `narrative`, one training-analysis kind, or `planned-training`. |
| `session_ref` | TEXT | yes | Session-evidence and route blocks only. |
| `planned_target_ref` | TEXT | yes | Planned-training blocks only; opaque `planned-target-` identity. |
| `include_physiological_context` | INTEGER | yes | Boolean session-evidence choice. |
| `route_ref` | TEXT | yes | Route blocks only. |
| `endpoint_redaction_meters` | INTEGER | yes | Route blocks only; 0–5000 metres. |
| `narrative_body` | TEXT | yes | Narrative blocks only; trimmed and bounded. |
| `question_kind` | TEXT | yes | Analytical blocks only; `training-period-comparison`. |
| `question_version` | INTEGER | yes | Analytical blocks only; exactly 1. |
| `baseline_from` | TEXT | yes | Analytical baseline start date. |
| `baseline_through` | TEXT | yes | Analytical baseline inclusive end date. |
| `comparison_from` | TEXT | yes | Analytical comparison start date. |
| `comparison_through` | TEXT | yes | Analytical comparison inclusive end date. |
| `metric` | TEXT | yes | Finding and chart only: `session-count`, `training-days`, `duration`, `distance`, or `energy`. |

SQLite checks reject mixed variant fields, invalid dates, reversed or excessive ranges, invalid metrics, and invalid
question codes. Domain reconstruction additionally enforces definition-version rules, global block identity, semantic
order, origin/block compatibility, route uniqueness, shared analytical queries, and the single-source boundary.

A planned-training definition contains exactly one planned-training block whose `planned_target_ref` equals
`origin_planned_target_ref`, plus zero or one narrative block. It cannot contain session, route, or analytical blocks.
Other origins cannot contain a planned-training block. Those semantic equality and composition invariants are checked
by the domain on every write and restoration rather than duplicated as denormalized SQL state.

## Evidence ownership and refresh

The report stores target and snapshot capabilities, not a copied plan. Resolution reads the exact target through the
planned-training application port at `source_snapshot_ref`. A later planned-library revision makes the complete
current candidate stale but does not mutate the definition. Deliberate refresh advances only the source snapshot and
report revision after optimistic checks; import and reimport never edit a report implicitly.

Schema 32 does not add a foreign key from reports to planned-training targets. Planned intent is revisioned evidence,
and a missing or changed target must remain representable as unavailable or stale report evidence rather than causing
an imported-library deletion to cascade into user-authored content. The application authorizes resolution and export
against both opaque capabilities.

## Data, privacy, backup, and portability

The migration persists no resolved objective, exercise, phase, transition, repetition, route coordinate, provider
identifier, source filename, output path, rendered HTML, or cached result. Whole-library backup preserves the new
report references together with schema-31 planned-training history and verifies schema and SQLite integrity before
success.

The SQLite file remains an implementation format. [Portable report definition version
5](../portable/report-definition-v5.md) documents authored report intent;
[planned-training export version 1](../portable/planned-training-v1.md) remains the exact normalized data exit; and
[self-contained report HTML version 7](../portable/report-html-v7.md) is an explicitly rendered presentation rather
than a library backup.

## Verification

Migration evidence covers a populated version-31 source with legacy report versions 1 through 4, byte-equivalent
definition and block reconstruction, an injected interruption, successful retry, schema version, table and index
inventory, restart, backup/restore, and `PRAGMA integrity_check`. Report integration evidence covers planned-report
creation, update, current and stale resolution, deliberate refresh, unavailable evidence, optimistic conflicts,
result-first listing, deterministic localized export, and preservation of the source report when export fails or is
cancelled.
