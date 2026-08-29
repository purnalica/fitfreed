# SQLite Schema Version 36

## Migration

Schema version 36 applies `0036_unified_sport_relationship.sql` atomically after version 35. It adds only the two
relationship tables and their training-discovery revision triggers. Every canonical fitness-data table, source record,
personal sport classification, report, and disposable workspace row remains unchanged. An interruption rolls back the
complete migration and retains a valid version-35 library.

## Relationship table

`unified_sport_relationship` stores one user-authored aggregate header:

| Column | Contract |
|---|---|
| `relationship_ref` | Primary key; `unified:sport-` plus exactly 64 lower-case hexadecimal characters. |
| `primary_session_filter_ref` | `sport-` plus exactly 64 lower-case hexadecimal characters. |
| `authorship` | Exactly `user`. |
| `revision` | Positive integer optimistic revision. |
| `updated_at_utc` | Application-supplied canonical UTC text under the existing persistence clock contract. |

`unified_sport_relationship_member` stores the canonical member set:

| Column | Contract |
|---|---|
| `relationship_ref` | Required parent reference with cascading delete. |
| `session_filter_ref` | Exact `sport-*` represented-collection capability; globally unique across active relationships. |

The composite primary key prevents a duplicate within one relationship. The global member uniqueness constraint
prevents overlap between relationships. SQLite enforces syntax, parent integrity, authorship, revision, and overlap;
the domain and compare-and-save application boundary enforce two-through-64 cardinality, primary membership, current
collection existence, reviewed session coverage, and usable identity precedence. A library whose restored rows cannot
form the canonical aggregate fails closed rather than exposing a partial relationship.

## Discovery coherence

Insert, update, and delete triggers on both tables advance the existing singleton `training_discovery_revision`.
One relationship transaction can therefore advance the numeric revision more than once; callers treat the derived
`training-snapshot-*` value as an opaque mutation token, never as an edit count. Relationship writes and revision
advancement share one immediate transaction.

Import and reimport do not write these tables. They may change the represented collection set and advance discovery
coherence through the pre-existing evidence triggers. The version-5 sport projection then either applies the complete
relationship or reports it for explicit review.

## Recovery and compatibility

A complete closed-library file backup contains both relationship tables and restores the authored aggregate with its
revision. This is implementation-level recovery evidence, not a claim that the SQLite file is a stable portable user
export.

Versions 1 through 36 form the supported migration chain. A higher `PRAGMA user_version` remains unsupported and is
never opened as though it were an older library.
