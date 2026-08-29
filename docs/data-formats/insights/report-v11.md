# Report Workflow Version 11

## Scope

Version 11 retains every definition, example, subject-selection, duplication, resolution, refresh, removal, privacy,
and export rule from [version 10](report-v10.md). It adds an application-owned, read-only planned-training subject
query for the built-in `structured-training-plan` example. Report definition version 5, report example descriptor
version 1, SQLite storage, and self-contained HTML version 8 do not change.

`query_report_example_planned_training_subjects` accepts
[`report-example-planned-training-subject-query-v1.schema.json`](../../../schemas/report-example-planned-training-subject-query-v1.schema.json)
and returns
[`report-example-planned-training-subject-v1.schema.json`](../../../schemas/report-example-planned-training-subject-v1.schema.json).
All other requests and outputs retain the schemas listed by version 10.

## Exact initiating context

The query carries `exampleId = structured-training-plan` and `exampleVersion = 1`; the response repeats both values.
Presentation rejects a mismatched response and keeps the selection task inside Reports. Selecting **Use this training
plan** resolves that exact target through the authoritative planned-training detail query and opens an unsaved draft
with the example's planned-training block recipe. It does not redirect to the generic plan explorer, allocate durable
identities, or save anything.

Cancellation returns to the exact example action, restores its focus, and writes no report or workspace state. The
subject workspace reuses the version-10 query-generation rule: cancellation, replacement, or a fresh first page
invalidates older in-flight work, and a late response cannot revive an obsolete selection task.

## Eligibility and paging

Eligible subjects are current canonical scheduled targets and favorite templates with at least one current structured
exercise. Superseded targets and targets without imported exercise structure are excluded by the persistence query
before counting or paging. Scheduled targets are ordered first by local schedule descending; favorite templates follow
by case-insensitive name ascending. The opaque target reference is the final stable tie-breaker.

The subject projection contains only the opaque `targetRef`, scheduled or favorite `kind`, optional local schedule and
completion state, display `name`, `exerciseCount`, `phaseCount`, `repeatBlockCount`, and
`containsIntensityEvidence`. It does not expose provider identity, provider record keys, source indices, raw payload, objectives,
phase definitions, or personal recorded results. Complete target evidence crosses the boundary only after explicit
selection through the existing planned-training target contract.

The first request has a null `snapshotRef`. Its response establishes one current `planned-snapshot-` capability. Every
subsequent page supplies that exact capability. A revision change returns `report-source-changed`; pages are never
combined across snapshots. `offset`, `limit`, `totalCount`, `nextOffset`, and early-page completeness use the
planned-training chronology invariants, with a maximum page size of 100.

## Draft construction

The selected target detail must repeat the chooser snapshot and selected target identity. A mismatch or stale source
leaves the chooser recoverable and writes nothing. A successful selection supplies the draft origin, title recipe,
planned target detail, and one planned-training block. The ordinary report save command remains the sole durable write.

Changing planned-subject eligibility, ordering, returned fields, initiating-context preservation, snapshot coherence,
selection or cancellation behavior, or structured recipe preservation requires a new workflow version.
