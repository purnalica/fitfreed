# SQLite Persistence Schema Version 23

## Status and migration

Schema version 23 applies `0023_report_start_origins.sql` atomically after version 22. It generalizes
report origins while copying every version-22 session report, block identity, order, authored value,
revision, locale, snapshot, and timestamp without reinterpretation. Versions 1 through 23 remain direct
supported baselines.

An interrupted migration rolls back table creation, copying, replacement, indexing, and the schema marker
as one transaction. Retry therefore starts from the intact prior schema. No non-report table changes.

## `report_definition`

The version-23 table has the following columns:

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `report_ref` | TEXT | no | Opaque `report-` identity and primary key. |
| `title` | TEXT | no | Trimmed user title, 1–120 characters. |
| `locale` | TEXT | no | Exactly `en-US` or `es-ES`. |
| `source_snapshot_ref` | TEXT | no | Opaque `training-snapshot-` revision used for resolution. |
| `origin_kind` | TEXT | no | Exactly `session`, `question`, `exploration`, or `blank`. |
| `origin_session_ref` | TEXT | yes | Required only by a `session` origin. |
| `origin_question_kind` | TEXT | yes | `training-period-comparison` for question and exploration origins. |
| `origin_question_version` | INTEGER | yes | Exactly 1 when a question is present. |
| `origin_baseline_from` | TEXT | yes | Exploration-origin baseline start date. |
| `origin_baseline_through` | TEXT | yes | Exploration-origin baseline inclusive end date. |
| `origin_comparison_from` | TEXT | yes | Exploration-origin comparison start date. |
| `origin_comparison_through` | TEXT | yes | Exploration-origin comparison inclusive end date. |
| `provenance_policy` | TEXT | no | Exactly `current-attribution`. |
| `authorship` | TEXT | no | Exactly `user`. |
| `definition_version` | INTEGER | no | One of 1, 2, 3, or 4. |
| `revision` | INTEGER | no | Positive optimistic-concurrency revision. |
| `created_at_utc` | TEXT | no | Original creation time. |
| `updated_at_utc` | TEXT | no | Latest successful revision time. |

Relational checks require exactly the fields belonging to the selected origin. Exploration ranges must be
valid ordered Gregorian dates of at most 366 inclusive days. Question intent deliberately stores no date
range; it is prepared from the current local library before composition. The `report_definition_recent`
index continues to order the bounded library by update time and opaque identity.

## `report_block`

The version-23 block table preserves the version-22 analytical model:

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `report_ref` | TEXT | no | Owning definition; cascades on deletion. |
| `block_ref` | TEXT | no | Globally unique opaque `report-block-` identity. |
| `ordinal` | INTEGER | no | Semantic order from 0 through 31. |
| `kind` | TEXT | no | Session, route, narrative, or one analytical block kind. |
| `session_ref` | TEXT | yes | Session evidence and route blocks only. |
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

SQLite checks reject mixed variant fields, invalid dates, reversed or excessive ranges, and invalid metric
or question codes. Domain reconstruction additionally enforces one narrative, compatible origin and block
families, shared analytical query parameters, unique analytical kinds, session consistency, route
uniqueness, and global block identity.

## Data and privacy boundary

Version 23 persists authored definitions and opaque evidence relationships, never resolved totals, chart
coordinates, provider accounts, source filenames, route coordinates, output paths, or rendered documents.
Question, exploration, and blank reports therefore remain provider-agnostic. Import and reimport do not
mutate definitions; explicit report edits are the only write path.
