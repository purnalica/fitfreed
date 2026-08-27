# Report Workflow Version 7

## Scope

Version 7 retains result-first report library behavior, creation, update, refresh, removal, optimistic concurrency,
privacy review, export authorization, deterministic output, and every version-6 recorded-training projection. It adds
the planned-training evidence library defined by report definition version 5.

`list_report_library` returns
[`report-library-v4.schema.json`](../../../schemas/report-library-v4.schema.json), `resolve_report` returns
[`report-resolution-v7.schema.json`](../../../schemas/report-resolution-v7.schema.json), mutations accept
[`report-create-v5.schema.json`](../../../schemas/report-create-v5.schema.json),
[`report-update-v5.schema.json`](../../../schemas/report-update-v5.schema.json), and
[`report-refresh-v2.schema.json`](../../../schemas/report-refresh-v2.schema.json), and export accepts
[`report-export-v5.schema.json`](../../../schemas/report-export-v5.schema.json). HTML uses
[self-contained output version 7](../portable/report-html-v7.md).

## Planned report lifecycle

A planned-training creation request carries one exact `planned-snapshot-` source revision, one
`origin.kind = planned-training` with `targetRef`, one matching planned-training block, and optional narrative. The
application resolves the target at that snapshot before persistence. It rejects mismatched capabilities, mixed
evidence libraries, missing evidence, a changed snapshot, and unsupported composition before writing anything.

Edits preserve the origin and source revision, accept owned block identities, and produce definition version 5.
Deleting a report removes only its definition and blocks. Import, reimport, target amendment, or favourite changes do
not edit user-authored report rows.

Resolution returns `plannedTraining` with `blockRef` and the complete
[`planned-training-target-v1.schema.json`](../../../schemas/planned-training-target-v1.schema.json) response. `session`
and `trainingComparison` are null, `routes` and `sensitiveContents` are empty, and provenance is
`planned-training-snapshot`. The exact target detail remains distinct from any related recorded session. The
definition target, evidence block target, and resolved target must match.

When the saved snapshot differs from the current planned library, resolution re-runs the exact target query against
the current compatible snapshot and returns that complete candidate with `status = stale`. Edit and export remain
blocked. `report-refresh-v2` confirms the exact saved report revision, saved source snapshot, and reviewed candidate
snapshot; it resolves again immediately before the optimistic write. A missing target is unavailable, never replaced
by another target or a cached result.

## Result-first library

A planned-training item uses:

- `subject.kind = planned-training` and the optional target name;
- `period.kind = planned-training` plus `scheduledAtLocal` for scheduled targets, or null for favourite templates;
- `result.kind = planned-training` with nullable `exerciseCount`, `phaseCount`, `expandedPhaseCount`, and
  `repeatBlockCount`; and
- a sensitivity summary with no physiological or location claims.

Counts are null when the source evidence did not provide the corresponding structure; zero is retained only for an
explicitly present empty collection. The card result is a bounded projection for recognition and navigation, not a
replacement for exact target resolution.

## Export authorization and errors

`report-export-v5` retains the common request shape. A planned report requires the exact current report revision and
planned source snapshot. `includePhysiologicalContext` is false and `routeChoices` is empty because those values cannot
be introduced into a planned-only definition. The authorized export contains the complete planned target resolved at
that exact snapshot and no recorded session or training comparison.

Existing report errors retain their meaning. `report-source-changed` covers a planned snapshot change;
`report-evidence-unavailable` covers a missing target; definition, optimistic-concurrency, cancellation, and output
errors preserve the saved report and any complete existing destination. Provider identifiers and source records do
not cross the application boundary.

Changing the single-source rule, target identity, stale/refresh authorization, projection shape, privacy boundary, or
planned-versus-recorded distinction requires a new workflow version.
