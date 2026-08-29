# Report Workflow Version 12

## Scope

Version 12 retains every definition, example, subject-selection, duplication, resolution, refresh, removal, privacy,
and export rule from [version 11](report-v11.md). It separates durable comparison defaults from parameters supplied
for one report run. A user can therefore inspect another period without editing the saved composition, and an export
uses the exact effective dates reviewed on screen.

Report definition version 5 and report example descriptor version 1 do not change. The workflow adds:

- [`report-resolve-v1.schema.json`](../../../schemas/report-resolve-v1.schema.json) for resolution requests;
- [`report-run-parameters-v1.schema.json`](../../../schemas/report-run-parameters-v1.schema.json) for transient input
  and resolved parameter provenance;
- [`report-resolution-v9.schema.json`](../../../schemas/report-resolution-v9.schema.json) for generic results;
- [`session-report-resolution-v7.schema.json`](../../../schemas/session-report-resolution-v7.schema.json) for the
  retained session-report compatibility boundary; and
- [`report-export-v6.schema.json`](../../../schemas/report-export-v6.schema.json) for exports.

The portable output is [self-contained report HTML version 9](../portable/report-html-v9.md).

## Saved defaults and one-run values

`resolve_report` requires an opaque `reportRef`. An omitted `runParameters` member or an empty object resolves the
definition's saved comparison query. A `trainingComparison` member supplies one complete question-versioned baseline
and comparison query for that resolution only. Partial overrides are not accepted.

The resolved `runParameters.trainingComparison` is null when the report has no comparison. Otherwise it contains:

- `savedDefault`: the query retained in the definition;
- `effectiveValue`: the query actually used to calculate the returned evidence; and
- `origin`: `saved-default` or `transient-override`.

Transient resolution does not update the definition, allocate a revision, or write workspace state. Duplicating the
report copies its saved definition only. Restoring saved dates performs a fresh resolution without an override.

## Validation and snapshot coherence

The application rejects a comparison override when the report has no compatible comparison question, either date
range is invalid or longer than 366 days, or a range falls outside the current training-library bounds. Validation
finishes before comparison evidence is queried. Resolution still checks the saved source capability before and after
calculation; a changed library produces the existing source-change behavior rather than combining revisions.

Every successful result repeats both saved and effective values. Returned comparison ranges must equal the effective
query. Generic and retained session-report response schemas require null parameter evidence when comparison evidence
is null and resolved parameter evidence when comparison evidence is present.

## Export

The export request repeats the one-run parameters after the user reviews the result. The application resolves those
parameters again against the expected report and source revisions before authorizing bytes. Consequently, the HTML
cannot combine a saved default with evidence calculated for another period. An empty export parameter object exports
the saved defaults; a transient override exports the temporary result while leaving the report definition unchanged.

Changing parameter meaning, supported parameter kinds, validation, persistence effects, resolved provenance, export
coherence, or snapshot behavior requires a new workflow version.
