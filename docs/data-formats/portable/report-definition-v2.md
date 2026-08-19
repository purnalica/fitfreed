# Portable Report Definition Version 2

## Purpose and encoding

[`report-definition-v2.schema.json`](../../../schemas/report-definition-v2.schema.json) is the normative
JSON representation of a version-2 FitFreed report definition.

- Media type: `application/vnd.fitfreed.report-definition+json;version=2`
- Encoding: UTF-8
- Root: one schema-valid JSON object
- Unknown members: rejected
- `revision`: a canonical positive base-10 string
- Ordering: block-array order is semantic; object-member order is not

The schema enforces typed shapes, bounds, and exactly one session and narrative block. FitFreed additionally
enforces unique `blockRef` and `routeRef` values and equality among origin, session-block, and route-block
session references because those cross-member invariants are not fully expressed by JSON Schema.
Each route block declares its integer `endpointRedactionMeters` choice in the definition rather than in
resolved evidence.

## Portability boundary

The definition carries user intent and opaque relationships, not resolved measurements or route points.
Opaque references are meaningful within the same portable FitFreed library. A future library-bundle import
must resolve them to the carried canonical evidence or report the evidence unavailable; it must not silently
retarget them.

Version-1 and version-2 definitions are distinct compatible inputs. Editing a version-1 definition with
version-2 composition creates a version-2 revision while preserving block identity. Backup tools that do
not understand a later version preserve its bytes losslessly.

## Independent synthetic example

```json
{
  "reportRef": "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "title": "Morning route review",
  "locale": "en-US",
  "sourceSnapshotRef": "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "origin": {
    "kind": "session",
    "sessionRef": "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  "provenancePolicy": "current-attribution",
  "authorship": "user",
  "definitionVersion": 2,
  "revision": "1",
  "blocks": [
    {
      "blockRef": "report-block-1111111111111111111111111111111111111111111111111111111111111111",
      "kind": "route",
      "sessionRef": "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "routeRef": "route-2222222222222222222222222222222222222222222222222222222222222222",
      "endpointRedactionMeters": 200
    },
    {
      "blockRef": "report-block-3333333333333333333333333333333333333333333333333333333333333333",
      "kind": "narrative",
      "body": "The middle section felt controlled."
    },
    {
      "blockRef": "report-block-4444444444444444444444444444444444444444444444444444444444444444",
      "kind": "session-evidence",
      "sessionRef": "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "includePhysiologicalContext": true
    }
  ]
}
```

The example is independently constructed and contains no user-export value or coordinate.
