# SQLite Persistence Schema Version 21

## Status and migration

Schema version 21 applies `0021_composable_route_reports.sql` atomically after version 20. It widens only
the report-definition tables for compatible version-2 compositions. Every version-20 definition and block
is copied losslessly with definition version 1, the same identity, order, content, revision, locale, snapshot,
origin, and timestamps.

Versions 1 through 21 are direct supported baselines. An interrupted migration rolls back table creation,
copying, dropping, renaming, indexing, and the schema marker as one unit. Retry starts from the intact prior
schema. All non-report tables retain their version-20 meaning.

## `report_definition`

The version-20 columns and index are unchanged. `definition_version` now accepts exactly 1 or 2. Version 1
rows retain their immutable two-block meaning; version 2 rows use the composable invariant reconstructed by
the domain.

## `report_block`

| Column | SQLite type | Null | Version-21 contract |
|---|---|---|---|
| `report_ref` | TEXT | no | Owning definition with cascading foreign key. |
| `block_ref` | TEXT | no | Globally unique opaque block identity. |
| `ordinal` | INTEGER | no | Inclusive 0–31 semantic order. |
| `kind` | TEXT | no | `session-evidence`, `route`, or `narrative`. |
| `session_ref` | TEXT | yes | Session and route blocks only. |
| `include_physiological_context` | INTEGER | yes | Session block only; boolean. |
| `route_ref` | TEXT | yes | Route block only; opaque route identity. |
| `endpoint_redaction_meters` | INTEGER | yes | Route block only; inclusive 0–5,000. |
| `narrative_body` | TEXT | yes | Narrative block only; canonical 1–10,000-character text. |

SQLite checks prevent mixed variant fields. Domain reconstruction additionally enforces version-specific
cardinality, unique block and route identities, origin equality, canonical authored text, and supported
ordering. Invalid or future rows fail the whole read and remain in the database for recovery.

## Data and privacy boundary

Version 21 stores route intent only. It does not copy a coordinate, route point, resolved metric, provider
identity, source subject, package digest, output path, or rendered document. Opaque evidence references
remain deliberately free of foreign keys so authorship survives missing or changed source evidence. Import
and reimport never write report definitions.
