# SQLite Persistence Schema Version 28

## Status and migration

Schema version 28 applies `0028_provider_sport_catalogue.sql` atomically after version 27. It adds immutable
provider sport catalogue evidence and one explicit active selection per provider. Imported sessions,
personal sport classifications, ranges, reports, and every preceding table remain unchanged. Versions 1
through 28 remain direct supported baselines.

Interruption before schema commit restores the complete version-27 database. Retry applies the migration
from that intact state. The migration contains no provider catalogue rows and does not claim that an
unsupported or unauthorised catalogue is available.

## `provider_sport_catalogue_snapshot`

One row identifies one immutable normalized catalogue and mapping pair.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `source_provider` | TEXT | no | Adapter-owned provider code, 1–128 bytes, trimmed. It never crosses provider-neutral read models. |
| `catalogue_revision` | TEXT | no | Exact upstream catalogue revision, 1–256 bytes, trimmed. |
| `mapping_version` | TEXT | no | Exact provider-to-canonical suggestion version, 1–256 bytes, trimmed. |
| `retrieved_at_utc` | TEXT | no | RFC 3339 retrieval instant ending in `Z`, 20–64 bytes. |
| `provenance_uri` | TEXT | no | Exact retrieval source reference, 1–2,048 bytes, trimmed. |
| `provenance_sha256` | TEXT | no | Lowercase 64-character SHA-256 digest of retained source evidence. |
| `content_sha256` | TEXT | no | Lowercase 64-character SHA-256 digest of normalized catalogue input. |
| `installed_at_utc` | TEXT | no | Local installation timestamp generated inside the transaction. |

The primary key is (`source_provider`, `catalogue_revision`, `mapping_version`). Reinstalling the same
identity with the same `content_sha256` is idempotent; different content under that identity is rejected
before selection changes.

## `provider_sport_catalogue_entry`

One row is one normalized recognition candidate for one exact source identifier.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `source_provider` | TEXT | no | Snapshot provider and private adapter join component. |
| `catalogue_revision` | TEXT | no | Snapshot catalogue component. |
| `mapping_version` | TEXT | no | Snapshot mapping component. |
| `source_identifier` | TEXT | no | Exact provider value, 1–256 bytes, trimmed; private to the adapter. |
| `candidate_ordinal` | INTEGER | no | Contiguous zero-based order after deterministic normalization per source identifier. |
| `provider_name_key` | TEXT | no | Provider's stable name key, 1–256 bytes, trimmed; retained for provenance only. |
| `localized_names_json` | TEXT | no | Canonical JSON object of validated language-tag/name pairs. |
| `parent_identifier` | TEXT | yes | Optional provider parent value, 1–256 bytes and trimmed; not a canonical hierarchy. |
| `canonical_family_suggestion` | TEXT | yes | Optional provider-neutral family suggestion. |
| `evidence_ref` | TEXT | no | Unique `sport-evidence-` capability with 64 lowercase hexadecimal characters. |

Family codes are `running`, `cycling`, `swimming`, `walking`, `hiking`, `strength`, `mobility`,
`racket-sport`, `team-sport`, `winter-sport`, `water-sport`, and `other`. The foreign key to the immutable
snapshot cascades only when that unselected snapshot is deliberately removed. The primary key includes
candidate ordinal; the lookup index `provider_sport_catalogue_entry_lookup` serves exact provider and source
identifier resolution in active snapshot order.

Multiple distinct rows for one `source_identifier` are valid and produce `ambiguous`. One produces
`recognized`; none produces `unknown`. Exact duplicate candidates are rejected before persistence.

## `provider_sport_catalogue_selection`

One row chooses the active immutable snapshot for a provider.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `source_provider` | TEXT | no | Provider primary key, 1–128 bytes and trimmed. |
| `catalogue_revision` | TEXT | no | Selected immutable catalogue revision. |
| `mapping_version` | TEXT | no | Selected immutable mapping version. |
| `selected_at_utc` | TEXT | no | Local activation timestamp generated inside the transaction. |

The composite foreign key prevents a selection without installed evidence. Insert, update, and delete
triggers named `training_discovery_sport_catalogue_selection_insert`,
`training_discovery_sport_catalogue_selection_update`, and
`training_discovery_sport_catalogue_selection_delete` increment the singleton `training_discovery_revision`.
Selection and snapshot installation occur in one immediate transaction. An identical active selection
commits no revision change.

## Resolution, reimport, and privacy

Infrastructure joins the active catalogue by private (`source_provider`, `source_identifier`) evidence and
constructs validated provider-neutral suggestions. Personal `sport_classification` remains independent and
wins in the domain without deleting catalogue rows. Exact reimport neither rewrites the catalogue nor erases
personal meaning. A newer mapping is a new immutable snapshot and its explicit activation invalidates stale
Home, History, session, range-summary, and report projections.

The active rows participate in SQLite online backup, integrity checks, migration recovery, and normal local
library replacement. They are implementation persistence, not a portable user export or redistribution
grant. Provider identifiers, name keys, parent identifiers, provenance URI, and digests remain absent from
ordinary provider-neutral presentation. The normalized portable sport-identity export is not implemented in
schema 28; future exit must preserve personal meaning and auditable recognition without making this private
layout normative.
