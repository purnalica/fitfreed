# SQLite Persistence Schema Version 20

## Status and migration

Schema version 20 applies `0020_report_definitions.sql` atomically after version 19. It adds durable
provider-neutral report definitions and their ordered authored blocks. Existing fitness evidence, import
history, settings, exploration workspaces, sport classifications, segmentation criteria, and update state
retain their version-19 meaning.

The migration invents no reports from disposable Insights screens. Versions 1 through 19 remain supported
direct migration baselines. An interruption leaves the prior schema and all prior information intact and
retryable.

## `report_definition`

One row stores the versioned header and refresh boundary of one authored report.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `report_ref` | TEXT | no | Opaque `report-` identity and primary key. |
| `title` | TEXT | no | Canonical 1–120-character title. |
| `locale` | TEXT | no | `en-US` or `es-ES`. |
| `source_snapshot_ref` | TEXT | no | Exact opaque training snapshot last saved deliberately. |
| `origin_kind` | TEXT | no | Exactly `session` in version 1. |
| `origin_session_ref` | TEXT | no | Stable opaque canonical session capability. |
| `provenance_policy` | TEXT | no | Exactly `current-attribution`. |
| `authorship` | TEXT | no | Exactly `user`. |
| `definition_version` | INTEGER | no | Exactly 1. |
| `revision` | INTEGER | no | Positive signed-64-bit optimistic revision. |
| `created_at_utc` | TEXT | no | Local creation-order metadata; not report evidence or portable output. |
| `updated_at_utc` | TEXT | no | Local effective-save metadata; not report evidence or portable output. |

`report_definition_recent` orders the bounded Reports home by most recent effective save and stable report
identity. Creation inserts the header and every block in one transaction. Editing compares the expected
revision, replaces both blocks, and advances the header in one transaction. A stale comparison changes
nothing.

## `report_block`

Rows use `(report_ref, ordinal)` as their primary key and a globally unique opaque `report-block-` identity.
The report foreign key deletes blocks only when an explicit future report-deletion use case deletes their
definition.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `report_ref` | TEXT | no | Owning report and cascading foreign key. |
| `block_ref` | TEXT | no | Globally unique opaque `report-block-` identity. |
| `ordinal` | INTEGER | no | Exactly 0 or 1; order is semantic. |
| `kind` | TEXT | no | `session-evidence` or `narrative`, consistent with the ordinal. |
| `session_ref` | TEXT | yes | Opaque session identity for the evidence block only. |
| `include_physiological_context` | INTEGER | yes | Boolean sensitivity choice for the evidence block only. |
| `narrative_body` | TEXT | yes | Canonical user-authored text for the narrative block only. |

Version 1 allows exactly these shapes:

- ordinal 0, `session-evidence`, non-null opaque `session_ref`, boolean
  `include_physiological_context`, and null narrative;
- ordinal 1, `narrative`, canonical 1–10,000-character `narrative_body`, and null session and sensitivity
  fields.

SQLite shape checks prevent mixed variants. The domain reconstruction additionally requires exactly two
rows, unique identities, canonical Unicode/control-character rules, and equality between origin and block
session references. Missing, duplicated, reordered, unsupported, or otherwise invalid rows fail the whole
read; no partial definition reaches presentation.

## Source independence, reimport, and privacy

Opaque session and snapshot references deliberately have no foreign key to protected canonical identities.
A report must survive a missing or changed source so resolution can explain that state instead of deleting
the person's authorship. Import and reimport never write either report table.

The tables store no resolved metric, route coordinate, provider identity, source subject, package digest,
artifact locator, export destination, rendered HTML, or telemetry. Report definitions are included in the
whole-library backup. The documented portable JSON representation, not these tables, is the user-facing
interchange boundary.
