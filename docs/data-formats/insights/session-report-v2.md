# Session Report Read Models Version 2

## Purpose

Version 2 adds ordered block composition, authoritative route selection, endpoint privacy, and complete
location review to the version-1 session-report use cases. It does not add deliberate refresh or non-session
block kinds.

| Operation | Input | Output |
|---|---|---|
| compose | [`session-report-create-v2`](../../../schemas/session-report-create-v2.schema.json) | [`report-definition-v2`](../../../schemas/report-definition-v2.schema.json) |
| edit composition | [`session-report-update-v2`](../../../schemas/session-report-update-v2.schema.json) | portable version-2 definition |
| list | none | unchanged bounded version-1 report list |
| load | valid `reportRef` | preserved version-1 or version-2 definition |
| resolve | valid `reportRef` | [`session-report-resolution-v2`](../../../schemas/session-report-resolution-v2.schema.json) |
| export | [`session-report-export-v2`](../../../schemas/session-report-export-v2.schema.json) | unchanged version-1 export receipt |

## Composition commands

Creation drafts never supply `blockRef`; the application owns every new identity. Update drafts carry an
optional existing `blockRef`, and the application allocates a new identity only for a genuinely new block.
An update cannot reuse a foreign block identity or change an existing block identity into another kind. The
exact session and every route are verified against the requested training snapshot before the definition is
written. One invalid or changed reference prevents the entire transaction.

An unchanged edit preserves the revision. A stale expected revision returns `report-definition-conflict`.
Create and update validate the complete version-2 invariants even when no route is selected.

## Resolution

The response accepts both immutable version-1 definitions and version-2 definitions. It adds ordered
`routes` evidence. Each route identifies its block and opaque route, recorded kind and local start,
`sourcePointCount`, at most 500 endpoint-redacted recorded `visualPoints`, the applied
`endpointRedactionMeters`, and whether geometry is included.

`sensitiveContents` uses complete records:

- heart rate has `kind: heart-rate`, null `blockRef`, boolean `included`, and null redaction;
- each route has the `precise-location` kind, its block identity, boolean `included`, and its saved endpoint
  redaction.

Exact route coordinates exist only in this local resolved read model and the training-route read models.
The report definition and exported HTML never contain them. Missing evidence, source changes, provenance,
fitness limitations, and stale status retain their version-1 behavior.

## Export authorization

`routeChoices` contains exactly one choice for every saved route block. Each choice identifies the block,
decides whether geometry is included, and declares an endpoint redaction equal to or stricter than the saved
value. Choices cannot lower saved privacy or introduce evidence.

Route resolution is memory-bounded. Cancellation is checked before resolution, between exact route pages,
between route blocks, and throughout staged output generation. The output adapter receives only the
authorized bounded visual points. Destination,
cancellation, atomicity, error codes, and receipt semantics retain the version-1 contract. Generated output
follows [HTML report version 2](../portable/report-html-v2.md).
