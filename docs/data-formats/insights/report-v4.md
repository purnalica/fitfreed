# Report Workflow Version 4

## Purpose

Version 4 exposes one report workflow for all accepted starts while preserving the session-report contracts
as compatibility adapters.

| Operation | Input | Output |
|---|---|---|
| prepare start | [`report-start-v1`](../../../schemas/report-start-v1.schema.json) | [`prepared-report-start-v1`](../../../schemas/prepared-report-start-v1.schema.json) |
| compose | [`report-create-v4`](../../../schemas/report-create-v4.schema.json) | [`report-definition-v4`](../../../schemas/report-definition-v4.schema.json) |
| edit | [`report-update-v4`](../../../schemas/report-update-v4.schema.json) | portable version-4 definition |
| refresh | [`report-refresh-v1`](../../../schemas/report-refresh-v1.schema.json) | preserved definition with the reviewed evidence revision |
| list | none | unchanged bounded version-1 report list |
| load | valid `reportRef` | preserved version-1, version-2, version-3, or version-4 definition |
| resolve | valid `reportRef` | [`report-resolution-v4`](../../../schemas/report-resolution-v4.schema.json) |
| export | [`report-export-v4`](../../../schemas/report-export-v4.schema.json) | unchanged version-1 receipt |

## Starting and composing

Preparing a `question`, `exploration`, or `blank` start binds it to one current local-library snapshot. A
question receives a conservative pair of adjacent recent periods derived from the available training
range. An exploration retains its exact completed query after validation. A blank page receives an
optional suggested query so evidence can be added before or after its first narrative-only save.

Question and exploration starts initially select all five analytical views plus one empty narrative. Blank
starts initially select only the narrative. Session starts retain the existing session-summary workflow.
All starts use the same create, update, list, resolve, privacy-review, and export commands.

Creation never accepts `blockRef`; update accepts an owned `blockRef` so semantic blocks retain identity.
Optimistic concurrency uses `expectedRevision`. A failed mutation leaves the prior definition unchanged.

## Deliberate refresh

A stale resolution is a candidate calculated from the current library, not an implicit mutation and not a
historical value comparison. The library does not retain prior canonical snapshots, so FitFreed never
invents a numeric before-state after source facts have evolved. Review instead identifies the saved and
candidate source revisions, shows the complete candidate preview, and states that title, narrative, origin,
queries, block identity, order, presentation choices, and sensitivity choices remain unchanged.

Refresh requires the exact saved definition revision, saved source snapshot, and candidate snapshot that the
person reviewed. The application resolves the complete candidate again, rejects a current, changed,
unavailable, or incompatible candidate, and only then advances the definition revision and
`sourceSnapshotRef` through optimistic persistence. Cancellation before confirmation writes nothing. Import
never invokes refresh, and a failed or concurrent refresh retains the previous definition.

## Resolution model

`session` is nullable. `routes` and `sensitiveContents` remain complete bounded arrays.
`trainingComparison` is null without analytical blocks and otherwise contains one exact
[`training-comparison-v1`](../../../schemas/training-comparison-v1.schema.json) result shared by the
analytical block family.

`provenance.kind` is exactly one of:

- `session`, with current source attribution;
- `library-snapshot`, for analysis calculated from the identified local revision; or
- `authored-only`, when a blank report currently selects no imported evidence.

No non-session path invents a session or provider. A changed snapshot produces `status` `stale`; export is
blocked by `report-source-changed`. Unavailable evidence produces `report-evidence-unavailable` without a
partial definition or mixed-revision result.

## User-visible workflow

The report library offers question and blank starts. A completed training comparison offers an exploration
start with contextual return navigation. A session detail offers the session start. Saved reports can be
reopened independently of their origin, edited, resolved against their authorized snapshot, privacy
reviewed, and exported as self-contained HTML.

The preview identifies recorded data, FitFreed calculations, and user-authored interpretation separately.
The export review is the complete outbound content boundary; cancellation leaves no partial destination.
