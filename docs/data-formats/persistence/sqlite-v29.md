# SQLite Persistence Schema Version 29

## Status and migration

Schema version 29 applies `0029_training_session_sport_evidence.sql` atomically after version 28. It adds
session-scoped training-target sport evidence without changing canonical sessions, global provider catalogues,
personal sport classifications, ranges, reports, or preceding tables. Versions 1 through 29 remain direct
supported baselines.

An interruption before schema commit restores the complete version-28 database. The migration adds no evidence
rows and invents no relationship for existing sessions. Reimport under adapter version 12 and mapping set 7 is
the only path that evaluates source targets.

## `training_session_sport_evidence`

One row is one mapped source sport code related to exactly one current session by the normative
[training-target mapping](../mappings/polar-flow-training-target-sport.md).

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id`, `session_id` | TEXT | no | Existing canonical training-session foreign key and exact relationship scope. |
| `source_provider` | TEXT | no | Adapter-private provider code, 1–128 bytes and trimmed. |
| `source_sport_code` | TEXT | no | Exact adapter-private source value, 1–256 bytes and trimmed. |
| `canonical_family_suggestion` | TEXT | yes | Optional provider-neutral family suggestion from the accepted family vocabulary. |
| `localized_names_json` | TEXT | no | Valid JSON object of validated language-tag/name pairs. |
| `catalogue_revision` | TEXT | no | Published vocabulary revision, 1–256 bytes and trimmed. |
| `retrieved_at_utc` | TEXT | no | Vocabulary retrieval instant ending in `Z`. |
| `mapping_version` | TEXT | no | Exact target-to-suggestion mapping version, 1–256 bytes and trimmed. |
| `evidence_ref` | TEXT | no | Unique `sport-evidence-` capability with 64 lowercase hexadecimal characters. |

The primary key is session, provider, source code, and mapping version. The unique evidence reference is a
deterministic digest of that scoped candidate identity. Equal source evidence and later exports of the same code
cannot multiply candidates; distinct exact codes remain distinct candidates. The session foreign key cascades only
when that canonical session is deliberately deleted.

`training_session_sport_evidence_lookup` serves exact session lookup. Insert, update, and delete triggers advance
`training_discovery_revision`, so cached Home, History, selection, report, and session projections cannot mix
pre- and post-recognition snapshots.

## `training_session_sport_evidence_source`

One row is one independently attributed target record supporting an existing candidate.

| Column | SQLite type | Null | Contract |
|---|---|---|---|
| `origin_id`, `session_id`, `source_provider`, `source_sport_code`, `mapping_version` | TEXT | no | Exact candidate foreign key. |
| `source_artifact_locator` | TEXT | no | Private target artifact locator, 1–2,048 bytes and trimmed. |
| `source_artifact_sha256` | TEXT | no | Lowercase 64-character target artifact digest. |
| `source_record_locator` | TEXT | no | Exact exercise sport path, 1–256 bytes and trimmed. |
| `source_started_at_local` | TEXT | no | Normalized source target start, 19–64 bytes and trimmed. |
| `source_export_version` | TEXT | no | Exact source export version, 1–64 bytes and trimmed. |
| `import_operation_id` | INTEGER | no | Import operation that established the evidence. |

The primary key extends candidate identity with artifact digest and record locator. Equal processing is idempotent;
another export of the same source-authored meaning adds provenance without creating another recognition candidate.
Deleting a candidate cascades to its supporting source rows, and every row retains the operation that established it.

## Resolution and privacy

Only rows for the current target-sport mapping version participate in recognition. One exact candidate is
`recognized`; multiple candidates are `ambiguous`; none falls back to the less-specific session-target evidence.
If exact candidates are absent, the active global provider-catalogue evidence remains available. Personal sport
classification still has presentation precedence.

Provider code, target locator, target digest, record locator, and source export metadata remain infrastructure
evidence and do not cross the provider-neutral read boundary. Both tables participate in SQLite backup, integrity
checks, migration recovery, and normal library replacement. They are not a portable public format; a later
normalized export must preserve auditable recognition without making this private schema normative.
