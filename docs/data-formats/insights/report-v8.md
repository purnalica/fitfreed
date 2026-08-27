# Report Workflow Version 8

## Scope

Version 8 retains every version-7 definition, evidence, result-first library, resolution, refresh, privacy, export,
and removal contract. It adds a versioned built-in example catalog and an exact revision-bound duplication mutation
without changing report definition version 5, report resolution version 7, self-contained HTML version 7, or the
SQLite storage shape.

`list_report_examples` returns
[`report-example-catalog-v1.schema.json`](../../../schemas/report-example-catalog-v1.schema.json), and
`duplicate_report` accepts
[`report-duplicate-v1.schema.json`](../../../schemas/report-duplicate-v1.schema.json) and returns one complete
[`report-definition-v5.schema.json`](../../../schemas/report-definition-v5.schema.json). All other queries, mutations,
and outputs retain the schemas listed by [report workflow version 7](report-v7.md).

## Built-in example catalog

The application owns four provider-neutral descriptors in stable order: adjacent-period training volume, one
session's visual story, outdoor-route investigation, and structured-training review. Every descriptor carries a
stable `id`, descriptor `version`, semantic `purpose` and `question`, `requiredCapabilities`, one `parameter`
requirement, an ordered `blockRecipe`, and current `availability`. Presentation maps purpose, question, prerequisites,
and actions to locale resources; application code never returns one language as canonical user copy.

The catalog queries only bounded capability counts from the canonical local library. It returns no report identity,
selected session, selected target, provider identity, copied evidence, or calculated result. `ready` means the
parameter-free adjacent-period recipe can ask `prepare_report_start` for current adjacent ranges. A
`selection-required` descriptor names the natural training-sessions or planned-training destination and never chooses
among one or many candidates. `unavailable` lists the exact missing capabilities and offers no action that would
pretend the recipe can currently be resolved.

Examples are application-owned descriptors, not persisted report rows. Using the ready example opens an unsaved
question-origin draft containing only its finding, duration-chart, and coverage recipe. No report or block identity is
allocated before explicit save; the existing create use case owns fresh durable identities at that boundary.
Session-, route-, and planned-training examples first require explicit evidence selection in their existing explorer.
The selected evidence then follows the ordinary contextual report path, so save, cancellation, staleness, privacy,
export, and deletion have no example-specific persistence behavior. A structured-training example remains bound to
the planned evidence library and does not fabricate planned-versus-recorded comparison across the single-source
boundary.

## Duplication request

The request contains exactly:

- `sourceReportRef`: the opaque identity of the saved source report;
- `expectedSourceRevision`: the canonical positive base-10 revision reviewed by the caller; and
- `title`: the caller-confirmed title for the independent copy.

Unknown members are rejected. The title follows the report-definition length and non-whitespace contract. Localized
default-title composition belongs to presentation and is editable before this request crosses the application
boundary. The request contains no caller-selected destination identity, block identity, provider identifier, source
record, or copied result.

## Atomic copy semantics

The application loads the source definition and verifies `expectedSourceRevision` before allocating identities or
writing. It then creates one fresh report identity and one fresh identity for every ordered source block. The new
definition copies the source title-independent content, locale, origin, source snapshot, provenance policy,
authorship, block order, queries, narrative, and sensitivity choices; it uses the requested title, sets
`definitionVersion` to the current version 5, and sets `revision` to `1`. Reusing the source report identity or any
source block identity is invalid.

The source remains unchanged. The duplicate is one independent aggregate with no durable or runtime reference to the
source report. It therefore remains readable, editable, refreshable, exportable, and removable after the source is
edited or deleted. Its copied source snapshot gives it the same initial current, stale, or unavailable relationship
to evidence as the source had at the instant of duplication. Later refreshes and edits advance only the selected
aggregate.

Creation is atomic through the existing report-definition persistence transaction. An invalid title, absent source,
revision conflict, identity-allocation failure, invariant failure, or persistence failure writes neither a partial
copy nor any block. No SQLite migration is required because the copy uses the existing version-5 definition and
owned-block representation.

## Presentation and error behavior

Duplication is available from one saved library item and its resolved result. It is non-destructive and requires no
confirmation. Presentation obtains an editable localized default title, submits one exact request, opens the returned
duplicate as a result, and announces that the report is independent. Cancelling the title task writes nothing and
returns focus to the initiating action.

`report-revision-conflict` identifies a stale reviewed source revision. Existing report-not-found,
report-definition-invalid, identity-allocation, and persistence errors retain their established meaning. An error
does not silently retry against another revision, choose a different report, consume a durable caller-owned identity,
or modify the source.

Changing descriptor identity or recipes, capability meaning, selection honesty, exact-revision authorization,
fresh-identity ownership, copied fields, independence, atomicity, or the result-first success path requires a new
workflow version.
