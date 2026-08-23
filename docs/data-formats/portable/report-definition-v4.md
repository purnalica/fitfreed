# Portable Report Definition Version 4

## Purpose and encoding

[`report-definition-v4.schema.json`](../../../schemas/report-definition-v4.schema.json) is the normative
JSON representation of a version-4 FitFreed report definition.

- Media type: `application/vnd.fitfreed.report-definition+json;version=4`
- Encoding: UTF-8
- Root: one schema-valid JSON object
- Unknown members: rejected
- `revision`: canonical positive base-10 text
- `blocks`: semantic array order

The schema defines the four `origin.kind` values `session`, `question`, `exploration`, and `blank`, and all
version-3 block shapes. It enforces individual shapes, cardinalities, and the session/non-session evidence
boundary. The application additionally enforces valid date spans, shared analytical queries, origin/query
coherence, route uniqueness, matching session references, and global block identity.

## Related boundary schemas

- [`report-start-v1.schema.json`](../../../schemas/report-start-v1.schema.json) describes question,
  exploration, and blank entry intent.
- [`prepared-report-start-v1.schema.json`](../../../schemas/prepared-report-start-v1.schema.json)
  identifies one `sourceSnapshotRef`, normalized origin, and optional `suggestedQuery`.
- [`report-create-v4.schema.json`](../../../schemas/report-create-v4.schema.json) accepts drafts without
  caller-owned block identities.
- [`report-update-v4.schema.json`](../../../schemas/report-update-v4.schema.json) accepts an
  `expectedRevision` and preserves supplied owned block identities.
- [`report-refresh-v1.schema.json`](../../../schemas/report-refresh-v1.schema.json) binds deliberate
  confirmation to the exact saved definition revision, saved snapshot, and candidate snapshot reviewed by
  the person.
- [`report-remove-v1.schema.json`](../../../schemas/report-remove-v1.schema.json) binds deletion to an
  exact report capability and optimistic revision; [`removed-report-v1.schema.json`](../../../schemas/removed-report-v1.schema.json)
  names the object that was removed.
- [`report-resolution-v4.schema.json`](../../../schemas/report-resolution-v4.schema.json) represents
  nullable session evidence and discriminated `provenance`.
- [`report-export-v4.schema.json`](../../../schemas/report-export-v4.schema.json) retains the explicit
  physiology, route, destination, snapshot, and revision review boundary.

## Independent synthetic example

```json
{
  "reportRef": "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "title": "How has my recent training changed?",
  "locale": "en-US",
  "sourceSnapshotRef": "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "origin": {
    "kind": "question",
    "question": "training-period-comparison",
    "questionVersion": 1
  },
  "provenancePolicy": "current-attribution",
  "authorship": "user",
  "definitionVersion": 4,
  "revision": "1",
  "blocks": [
    {
      "blockRef": "report-block-1111111111111111111111111111111111111111111111111111111111111111",
      "kind": "training-finding",
      "query": {
        "question": "training-period-comparison",
        "questionVersion": 1,
        "baselineRange": { "from": "2026-01-01", "through": "2026-01-31" },
        "comparisonRange": { "from": "2026-02-01", "through": "2026-02-28" }
      },
      "metric": "duration"
    },
    {
      "blockRef": "report-block-2222222222222222222222222222222222222222222222222222222222222222",
      "kind": "narrative",
      "body": "The recorded duration increased; the reason remains my interpretation."
    }
  ]
}
```

The example is independently constructed and contains no user-export value.

## Portability boundary

The definition contains intent and opaque relationships, not resolved totals, finding sentences, chart
coordinates, route coordinates, provider identity, or HTML. Consumers preserve unsupported versions
byte-for-byte and never downgrade them. Resolution and export require an authorized compatible local
snapshot.

Refresh is a mutation boundary, not a portable historical-diff format. A successful refresh preserves the
portable definition's title, locale, origin, provenance policy, authorship, block identities, semantic order,
queries, metrics, and privacy choices; only `sourceSnapshotRef` and `revision` advance. The request contains
opaque capabilities and is not retained as report content.

Removal is likewise a library mutation rather than a tombstone inside the portable definition. Its receipt
contains only the removed report capability, title, and revision. It contains no export path, provider identity,
or imported-history capability.
