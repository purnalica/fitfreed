# Session Report Read Models Version 3

## Purpose

Version 3 adds user-selected training-period answers to the established session, route, narrative, privacy,
and export workflow.

| Operation | Input | Output |
|---|---|---|
| compose | [`session-report-create-v3`](../../../schemas/session-report-create-v3.schema.json) | [`report-definition-v3`](../../../schemas/report-definition-v3.schema.json) |
| edit composition | [`session-report-update-v3`](../../../schemas/session-report-update-v3.schema.json) | portable version-3 definition |
| list | none | unchanged bounded version-1 report list |
| load | valid `reportRef` | preserved version-1, version-2, or version-3 definition |
| resolve | valid `reportRef` | [`session-report-resolution-v3`](../../../schemas/session-report-resolution-v3.schema.json) |
| export | unchanged [`session-report-export-v2`](../../../schemas/session-report-export-v2.schema.json) | unchanged version-1 receipt |

## Authored question and composition

The editor lets the user add, remove, configure, and reorder each analytical presentation independently. All
selected analytical blocks share one question: training period comparison version 1. Creation and update
run that question through the authoritative training library before committing the definition. An invalid or
unavailable range prevents the complete mutation; no partial definition is written.

The comparison uses inclusive Gregorian local-date ranges of at most 366 days. The periods may overlap.
Creation drafts never supply `blockRef`; updates may preserve the identity of a same-kind owned block. The
version-2 identity, route, revision, and conflict rules remain unchanged.

## Resolution and consistency

`trainingComparison` is null when no analytical block exists and otherwise contains exactly one
[`training-comparison-v1`](../../../schemas/training-comparison-v1.schema.json) result shared by the whole
block family. The application checks the requested snapshot before and after the authoritative query. A
concurrent import produces `report-source-changed`; evidence from two library revisions is never combined.

Each source series remains separate. Exact integer totals and changes cross the transport boundary as
canonical decimal strings. Optional distance and energy stay null when not recorded. Opaque `seriesRef`
values support correlation but are not user-facing labels.

## Preview and export

The bilingual preview renders the five block kinds in authored order. Charts have a visible exact table
alternative. Findings are descriptive, retain signed values, and never claim causation or advice. Coverage
shows observed training days and measurement-bearing sessions for both periods.

Privacy review names the selected analytical values in the complete export boundary. Analytical resolution
adds no precise location or physiological authority. Route and heart-rate choices retain their version-2
rules, including complete `routeChoices` coverage. Generated output follows
[HTML report version 3](../portable/report-html-v3.md).
