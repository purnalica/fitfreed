# Portable Report Definition Version 3

## Purpose and encoding

[`report-definition-v3.schema.json`](../../../schemas/report-definition-v3.schema.json) is the normative
JSON representation of a version-3 FitFreed report definition.

- Media type: `application/vnd.fitfreed.report-definition+json;version=3`
- Encoding: UTF-8
- Root: one schema-valid JSON object
- Unknown members: rejected
- `revision`: a canonical positive base-10 string
- Ordering: block-array order is semantic; object-member order is not

Version 3 retains every version-2 session, narrative, and route rule. It adds five optional analytical block
kinds: `training-finding`, `training-comparison`, `training-chart`, `training-exact-table`, and
`training-coverage`. At most one of each kind may occur.

Every analytical block contains the same `training-period-comparison` question version 1 with inclusive
`baselineRange` and `comparisonRange` local dates. Finding and chart blocks also select `session-count`,
`training-days`, `duration`, `distance`, or `energy`. FitFreed enforces valid Gregorian dates, ordered ranges
of at most 366 days, and byte-for-byte equality of all analytical question parameters. JSON Schema enforces
the individual shapes; the application enforces those cross-block and date-span invariants.

## Portability boundary

The definition carries authored intent and opaque evidence relationships. It contains no resolved total,
change, finding sentence, chart coordinate, coverage percentage, provider account, source filename, or
rendered output. Opening or exporting the report reruns the referenced versioned question against the
exact authorized local-library snapshot. Missing evidence is reported rather than replaced with copied or
newly guessed data.

Versions 1, 2, and 3 are distinct compatible inputs. Current edits create version 3 while preserving owned
block identities. A tool that cannot interpret version 3 preserves its bytes; it does not downgrade it.

## Independent synthetic example

```json
{
  "reportRef": "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "title": "Winter training comparison",
  "locale": "en-US",
  "sourceSnapshotRef": "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "origin": {
    "kind": "session",
    "sessionRef": "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  "provenancePolicy": "current-attribution",
  "authorship": "user",
  "definitionVersion": 3,
  "revision": "1",
  "blocks": [
    {
      "blockRef": "report-block-1111111111111111111111111111111111111111111111111111111111111111",
      "kind": "session-evidence",
      "sessionRef": "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "includePhysiologicalContext": false
    },
    {
      "blockRef": "report-block-2222222222222222222222222222222222222222222222222222222222222222",
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
      "blockRef": "report-block-3333333333333333333333333333333333333333333333333333333333333333",
      "kind": "training-exact-table",
      "query": {
        "question": "training-period-comparison",
        "questionVersion": 1,
        "baselineRange": { "from": "2026-01-01", "through": "2026-01-31" },
        "comparisonRange": { "from": "2026-02-01", "through": "2026-02-28" }
      }
    },
    {
      "blockRef": "report-block-4444444444444444444444444444444444444444444444444444444444444444",
      "kind": "narrative",
      "body": "The comparison is descriptive; the context remains my interpretation."
    }
  ]
}
```

The example is independently constructed and contains no user-export value.
