# SQLite Schema Version 37

## Migration

Schema version 37 applies `0037_reusable_sport_correlation.sql` atomically after version 36. It adds two private
matching tables and their training-discovery revision triggers. During the same migration, current version-36
relationship members are resolved through the production sport-group query and their available selectors are
derived. No provider value is guessed. Interruption rolls back DDL, derived rows, and `user_version` together.

If two existing relationships would claim the same selector, migration fails and retains the complete version-36
library. A missing current member simply receives no selector and preserves version-1 review-required behavior.

## Source-selector table

`unified_sport_relationship_source_selector` stores the private reusable matcher:

| Column | Contract |
|---|---|
| `relationship_ref` | Required relationship parent with cascading delete. |
| `origin_id` | Required resolved observation origin. |
| `source_sport_ref` | Required non-empty exact provider sport reference; never returned through public ports. |
| `primary_identity` | Boolean marker stating that the reviewed primary supplied this selector. |

The composite primary key prevents repetition inside one relationship. Global uniqueness of `(origin_id,
source_sport_ref)` prevents two relationships from claiming the same private selector.

`unified_sport_relationship_member_selector` records which reviewed capability supplied which selector. Its member
foreign key and selector foreign key both cascade, and one reviewed member has at most one selector. Several reviewed
members may legitimately share one selector when exact evidence split one source profile into multiple collections.

| Column | Contract |
|---|---|
| `relationship_ref` | Required relationship and member parent. |
| `session_filter_ref` | Required reviewed member capability; unique inside the relationship. |
| `origin_id` | Required selector origin. |
| `source_sport_ref` | Required selector source sport reference. |

## Writes and discovery coherence

Creating or revising a relationship derives selectors only from the exact current groups whose session count and
snapshot were reviewed. Member rows, selector rows, primary marker, relationship revision, and all uniqueness checks
share one immediate transaction. Revision deletes the previous derived matcher before installing the replacement;
removal cascades both tables.

Insert, update, and delete triggers advance `training_discovery_revision`. The numeric revision may advance several
times for one transaction and remains an opaque coherence token.

## Reads, privacy, and recovery

The adapter combines persisted reviewed members with current groups matching retained selectors before restoring the
domain aggregate. A missing reviewed member is replaced only through its own retained selector. Primary replacement
requires exactly one current usable group marked by the primary selector. Invalid, overlapping, or unbounded restored
state fails the coherent query without returning a partial or truncated projection.

Whole-library backup preserves selectors because they are required for reimport behavior. They are sensitive local
mapping metadata, not anonymized facts, and are excluded from transport, diagnostics, report output, and the current
portable fitness formats.

Versions 1 through 37 form the supported migration chain. A higher `PRAGMA user_version` remains unsupported.
