# SQLite Persistence Schema Version 22

## Status and migration

Schema version 22 applies `0022_training_comparison_reports.sql` atomically after version 21. It widens only
the report-definition tables for compatible version-3 analytical intent. Every version-21 definition and
block is copied losslessly with the same identity, order, content, revision, locale, snapshot, origin, and
timestamps.

Versions 1 through 22 are direct supported baselines. An interrupted migration rolls back creation, copy,
drop, rename, index, and schema marker as one transaction. Retry starts from the intact prior schema. All
non-report tables retain their version-21 meaning.

## `report_definition`

The previous columns and index are unchanged. `definition_version` accepts exactly 1, 2, or 3. Versions 1
and 2 retain their immutable meanings; version 3 uses the analytical composition reconstructed by the
domain.

## `report_block`

Version 22 retains every version-21 column and adds:

| Column | SQLite type | Null | Version-22 contract |
|---|---|---|---|
| `question_kind` | TEXT | yes | Analytical blocks only; exactly `training-period-comparison`. |
| `question_version` | INTEGER | yes | Analytical blocks only; exactly 1. |
| `baseline_from` | TEXT | yes | Canonical valid Gregorian start date. |
| `baseline_through` | TEXT | yes | Canonical valid Gregorian inclusive end date. |
| `comparison_from` | TEXT | yes | Canonical valid Gregorian start date. |
| `comparison_through` | TEXT | yes | Canonical valid Gregorian inclusive end date. |
| `metric` | TEXT | yes | Finding and chart only; one supported metric code. |

`kind` additionally accepts `training-finding`, `training-comparison`, `training-chart`,
`training-exact-table`, and `training-coverage`. SQLite checks reject mixed variant fields, invalid dates,
reversed ranges, ranges longer than 366 inclusive days, and unsupported question or metric codes. Domain
reconstruction additionally enforces shared query parameters, at most one analytical block of each kind,
and all earlier composition invariants.

## Data and privacy boundary

Version 22 stores question intent only. It has no baseline or comparison result, finding text, chart point,
coverage percentage, source-series label, route coordinate, output path, or rendered document. Resolution
reruns the versioned authoritative training query. Import and reimport never write report definitions.
