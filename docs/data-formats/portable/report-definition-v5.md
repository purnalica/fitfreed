# Portable Report Definition Version 5

## Purpose and encoding

[`report-definition-v5.schema.json`](../../../schemas/report-definition-v5.schema.json) is the normative JSON
representation of a version-5 FitFreed report definition.

- Media type: `application/vnd.fitfreed.report-definition+json;version=5`
- Encoding: UTF-8
- Root: one schema-valid JSON object
- Unknown members: rejected
- `revision`: canonical positive base-10 text
- `blocks`: semantic array order

Version 5 retains all version-4 origin and block variants and adds `planned-training`. Its `sourceSnapshotRef` union
accepts exact `training-snapshot-` and `planned-snapshot-` capabilities. Origin-specific schema branches require the
appropriate snapshot family and prevent a planned-training block from appearing in any other report.

For a planned-training origin, exactly one `planned-training` block and zero or one `narrative` block are permitted.
The schema validates each `targetRef` as an opaque `planned-target-` capability. The application additionally requires
the origin and block target references to be equal, validates global block identity, and applies all canonical domain
invariants documented in [canonical report definition version
5](../canonical/report-definition-v5.md).

## Related boundary schemas

- [`report-create-v5.schema.json`](../../../schemas/report-create-v5.schema.json) accepts version-5 drafts, including a
  planned-training origin and a new planned block without a caller-owned block identity.
- [`report-update-v5.schema.json`](../../../schemas/report-update-v5.schema.json) accepts an `expectedRevision` and
  preserves supplied owned block identities.
- [`report-refresh-v2.schema.json`](../../../schemas/report-refresh-v2.schema.json) accepts either snapshot family and
  binds deliberate confirmation to the exact saved and reviewed revisions.
- [`report-duplicate-v1.schema.json`](../../../schemas/report-duplicate-v1.schema.json) binds an independent copy to
  one exact saved source revision and accepts only its caller-confirmed title. The application owns every fresh report
  and block identity; the returned copy is another complete version-5 definition at revision one.
- [`report-library-v4.schema.json`](../../../schemas/report-library-v4.schema.json) adds planned-training subject,
  scheduled period, and plan-shape result variants.
- [`report-resolution-v7.schema.json`](../../../schemas/report-resolution-v7.schema.json) carries one exact normalized
  planned target and `planned-training-snapshot` provenance.
- [`report-export-v5.schema.json`](../../../schemas/report-export-v5.schema.json) accepts either snapshot family while
  retaining the existing per-export physiology, route, and destination review shape. Planned reports necessarily use
  no route choice and no physiological context.

## Independent synthetic example

```json
{
  "reportRef": "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "title": "Planned interval session",
  "locale": "en-US",
  "sourceSnapshotRef": "planned-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "origin": {
    "kind": "planned-training",
    "targetRef": "planned-target-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  "provenancePolicy": "current-attribution",
  "authorship": "user",
  "definitionVersion": 5,
  "revision": "1",
  "blocks": [
    {
      "kind": "planned-training",
      "blockRef": "report-block-1111111111111111111111111111111111111111111111111111111111111111",
      "targetRef": "planned-target-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    },
    {
      "kind": "narrative",
      "blockRef": "report-block-2222222222222222222222222222222222222222222222222222222222222222",
      "body": "This is my note about the planned session, not recorded completion evidence."
    }
  ]
}
```

The example is independently constructed and contains no user-export value.

## Portability boundary

The definition contains intent and opaque evidence relationships, not the planned target contents, recorded
completion, resolved plan shape, provider identity, HTML, or export destination. Consumers preserve unsupported
versions byte-for-byte and never downgrade them. Resolution and export require an authorized compatible local
snapshot.

Refresh preserves title, locale, origin, provenance policy, authorship, block identities, order, target capability,
and narrative; only `sourceSnapshotRef` and `revision` advance. Exact target content remains independently portable
through `application/vnd.fitfreed.planned-training+json;version=1`.

Duplication is not an alternative portable representation. It copies one exact definition into fresh durable
identities and returns the same version-5 representation. The duplicate retains the source snapshot and authored
content but has no reference to the source report, so either aggregate may subsequently change or be removed without
affecting the other.
