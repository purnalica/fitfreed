# Portable Report Definition Version 1

## Purpose

[`report-definition-v1.schema.json`](../../../schemas/report-definition-v1.schema.json) is the normative
JSON representation of a canonical FitFreed report definition. It lets a person understand, validate, back
up, and later migrate authored report intent without depending on SQLite or the desktop interface.

## Encoding and media type

- Media type: `application/vnd.fitfreed.report-definition+json;version=1`
- Character encoding: UTF-8
- Root: one JSON object conforming to the schema
- Unknown members: rejected
- Number safety: `revision` is a base-10 string because its domain is an unsigned 64-bit positive integer
- Ordering: array order is semantic; object-member order is not

The schema constrains every value independently. The additional equality invariant between
`origin.sessionRef` and the session block's `sessionRef` is mandatory and checked by FitFreed because JSON
Schema does not express cross-member identity directly.

## Portability boundary

Opaque references preserve relationships inside the same exported FitFreed library. They do not expose
provider identifiers and are not global public links. A complete future portable-library bundle must carry
the referenced canonical evidence or report it as unavailable on import; it must never silently retarget a
report to a different session.

The definition contains user intent, not resolved measurements. Reimplementations resolve it according to
the [canonical version-1 contract](../canonical/report-definition.md), declare incompatibility when they do
not support that contract, and preserve unknown later versions losslessly when acting as a backup tool.

## Synthetic example

```json
{
  "reportRef": "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "title": "Morning progression",
  "locale": "en-US",
  "sourceSnapshotRef": "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "origin": {
    "kind": "session",
    "sessionRef": "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  "provenancePolicy": "current-attribution",
  "authorship": "user",
  "definitionVersion": 1,
  "revision": "1",
  "blocks": [
    {
      "blockRef": "report-block-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "kind": "session-evidence",
      "sessionRef": "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "includePhysiologicalContext": true
    },
    {
      "blockRef": "report-block-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      "kind": "narrative",
      "body": "The final section felt controlled."
    }
  ]
}
```

The example is independently constructed and contains no user export value.
