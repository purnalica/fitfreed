# Report Workflow Version 10

## Scope

Version 10 retains every definition, example, duplication, resolution, refresh, removal, privacy, and export rule from
[version 9](report-v9.md). It adds an application-owned, read-only training-session subject query for the two built-in
examples whose parameter is a recorded session. Report definition version 5, report example descriptor version 1,
SQLite storage, and self-contained HTML version 8 do not change.

`query_report_example_training_session_subjects` accepts
[`report-example-session-subject-query-v1.schema.json`](../../../schemas/report-example-session-subject-query-v1.schema.json)
and returns
[`report-example-session-subject-v1.schema.json`](../../../schemas/report-example-session-subject-v1.schema.json).
All other requests and outputs retain the schemas listed by version 9.

## Exact initiating context

The query carries the initiating example `exampleId` and `exampleVersion`; only `session-visual-story` and
`outdoor-route` are valid. The response repeats both values. Presentation rejects a mismatched response and keeps the
selection task inside Reports. Selecting **Use this session** opens the ordered block recipe of that exact example;
it does not redirect to a generic history task, replace the recipe with a generic session report, allocate durable
identities, or save anything.

Cancellation returns to the same built-in example action and writes no report or workspace state. Planned-training
selection retains its planned-training explorer contract in this version.

The evidence origin of a previously resolved report and the return destination of a new composition are separate
presentation facts. Beginning an example from the Reports library always returns to that exact library action, even
when a prior report was opened from a session or another contextual origin. Beginning a contextual report retains
that initiating origin only for the lifetime of the new composition. Opening a saved report derives navigation from
its canonical resolved source rather than from any earlier transient composition.

## Eligibility and paging

The application translates the example into one provider-neutral eligibility rule. `session-visual-story` accepts any
canonical training session. `outdoor-route` accepts only a session for which canonical route storage contains at least
one route with two or more recorded points. The persistence adapter applies that rule to the count, source summaries,
ordering, and page query together; it cannot page an unfiltered result and discard ineligible rows afterwards.

Subjects are ordered by local start descending and reuse the complete session identity from training-session search
version 4. `hasRouteEvidence` states whether the returned session has the bounded route capability. It is always
`true` for every `outdoor-route` subject. No provider record identifier, source sport code, raw database key, route
geometry, signal sample, or report result crosses this contract.

The first request has a null `snapshotRef`. Its response establishes one current `training-snapshot-` capability.
Every subsequent page supplies that exact capability. A revision change returns `report-source-changed`; pages are
never combined across snapshots. `offset`, `limit`, `totalCount`, `nextOffset`, and early-page completeness use the
training-session search invariants, with a maximum page size of 100.

The subject workspace owns one active query generation. Cancellation, a new example action, or a fresh first-page
request invalidates older in-flight work; a late response cannot restore a cancelled task or replace newer evidence.
While subject selection is active, Reports exposes its own return action and does not present an unrelated contextual
return destination as a competing choice.

## Draft construction

The session visual-story recipe opens with one session-evidence block. The outdoor-route recipe resolves the selected
session through the authoritative route port and opens with one session-evidence block followed by its first
authoritative route in stable route order. Additional routes remain available through ordinary composition. Failure
to resolve the route writes nothing and leaves the selection task recoverable.

The selected subject, rather than any earlier contextual origin, supplies draft capabilities such as recorded
physiology availability. This keeps the recipe and its eligible controls coherent when the person selects a different
session.

Changing eligible subject meaning, route qualification, initiating-context preservation, snapshot coherence,
selection or cancellation behavior, returned fields, ordering, or draft recipe preservation requires a new workflow
version.
