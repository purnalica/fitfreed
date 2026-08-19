# Training-Session Provenance Read Model Version 1

## Purpose

This contract explains how one opaque training session entered and evolved inside the local FitFreed
library. It is a progressive, user-requested view rather than part of the default session summary. The view
names the source, the source record's revision time, the FitFreed interpretation versions, and the effect of
each evaluated import without exposing provider identifiers or private package evidence.

## Query

`query_training_session_provenance` accepts
[`training-session-provenance-query-v1.schema.json`](../../../schemas/training-session-provenance-query-v1.schema.json)
and returns
[`training-session-provenance-v1.schema.json`](../../../schemas/training-session-provenance-v1.schema.json).
The query contains:

| Field | Type | Required | Contract |
|---|---|---|---|
| `sessionRef` | string | yes | Valid opaque `session-` capability. |
| `snapshotRef` | string or null | yes | Optional expected `training-snapshot-` capability from discovery. |
| `offset` | integer | yes | Zero-based event offset from the oldest evidence; at most 999,999. |
| `limit` | integer | yes | Requested page size from 1 through 25. |

Malformed capabilities or pagination fail before the port runs. A supplied training snapshot still binds the
canonical session identity and facts. Provenance is append-only audit evidence: new events append after
existing ordinals and never reorder an already returned page.

## Current attribution

`current` identifies the most recent event that contributes to the visible session. It contains the exact
supported `provider`, `sourceModifiedAtUtc`, `sourceAdapterVersion`, and `mappingVersion`, plus
`contributingEventCount` and `nonContributingEventCount`. Version 1 supports provider code `polar-flow`.
Presentation localizes that code rather than displaying it as raw source vocabulary.

The current attribution does not claim that one import independently created every visible child. A mapping
enrichment may contribute newly supported structure while earlier compatible evidence remains part of the
session history.

## Evidence events

Events are ordered oldest first and use a stable contiguous `ordinal`. Every event contains:

| Field | Type | Meaning |
|---|---|---|
| `ordinal` | non-negative integer | Stable position in this session's append-only provenance history. |
| `observedAtUtc` | RFC 3339 UTC instant | When the successful local import finished evaluating this evidence. |
| `sourceModifiedAtUtc` | RFC 3339 UTC instant | Revision time asserted by the source record. |
| `provider` | `polar-flow` | Supported source attribution code. |
| `sourceAdapterVersion` | versioned code | Source compatibility contract used for decoding. |
| `mappingVersion` | versioned code | Training mapping used to produce provider-neutral evidence. |
| `decision` | decision code | Reconciliation effect described below. |
| `contributesToVisibleState` | boolean | Whether the event supports the visible canonical session. |

Decision codes have exact user-relevant semantics:

- `create`: the source evidence added the session;
- `equivalent`: it matched the visible session without changing facts;
- `enrich`: it added newly supported evidence without changing known facts;
- `amend`: a newer source revision replaced the complete mapped session;
- `preserve`: an older source revision was evaluated and the newer visible session was retained;
- `conflict`: equally ordered evidence disagreed and the visible session was retained for explicit review.

`create`, `equivalent`, `enrich`, and `amend` contribute to visible state. `preserve` and `conflict` do not.
Zero events is invalid for an existing imported session.

## Pagination and validation

The result repeats the resolved `snapshotRef`, exact `sessionRef`, `totalEventCount`, requested `offset` and
`limit`, optional `nextOffset`, current attribution, and at most 25 events. `nextOffset` is null exactly when
the returned page reaches `totalEventCount`. Application validation requires exact request/result identity,
UTC timestamps, safe version codes, supported provider and decisions, contiguous event ordinals, exact
counts, and decision/contribution consistency before presentation receives any value.

Ascending append-only order keeps an already returned page stable if a later import adds evidence while the
canonical training snapshot remains unchanged. A changed canonical snapshot still returns
`training-session-detail-changed`.

## Privacy and presentation

The response deliberately excludes observation-origin identity, provider session or exercise identifiers,
import-operation identity, package or artifact filename, source record locator, package or artifact digest,
local path, and source-subject evidence. Those values remain protected reconciliation state.

Presentation loads this contract only after an explicit provenance action. It explains ordinary outcomes in
plain language, labels adapter and mapping versions as technical interpretation details, and distinguishes
the source revision time from the local observation time. Missing evidence, adapter failure, or inconsistent
persisted rows returns `training-session-detail-failed` or `invalid-training-session-detail`; no failure
returns a partial history.
