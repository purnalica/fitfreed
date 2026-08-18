# Training Sports Read Model Version 1

## Status and boundary

Normative provider-neutral contract for discovering the sport evidence in a complete FitFreed library and
adding an optional user interpretation. The application derives this disposable read model from canonical
training sessions and the [canonical sport-classification contract](../canonical/sport-classification.md).
It is not canonical training history, a provider catalogue, a portable export, or a persistence schema.

The Tauri `query_training_sports` command has no input value and returns JSON conforming to
[`training-sports-v1.schema.json`](../../../schemas/training-sports-v1.schema.json). The
`save_training_sport_classification` command accepts
[`sport-classification-save-v1.schema.json`](../../../schemas/sport-classification-save-v1.schema.json)
and returns [`saved-sport-classification-v1.schema.json`](../../../schemas/saved-sport-classification-v1.schema.json).

## Complete-library discovery

`originCount` is the number of distinct origins represented by detected sports. `sessionCount` is the exact
sum of every group's `coverage.sessionCount`. `sports` contains one group for each exact non-null source sport
reference within an origin, plus at most one null-reference group per origin. Discovery always covers the
complete library; it is independent from the date window selected in the training-session explorer.

Each sport has `sourceIndex`, a stable ordinal over sorted opaque origin identities for this response,
`firstLocalDate`, `lastLocalDate`, and `coverage`. The date range is inclusive and ordered. Coverage contains
positive `sessionCount`, exact unsigned-decimal `totalDurationMilliseconds`, `distanceSessionCount`, and
`heartRateSessionCount`. Both measurement counts are bounded by the session count; absence remains zero and
is never imputed.

The opaque `sportRef` is a library-local transport capability for later commands. It never contains or
reveals `originId` or `sourceSportRef`, and presentation never renders it. When more than one origin exists,
presentation may use `sourceIndex` to distinguish otherwise ambiguous groups without exposing identity.

## States and classification

Every group has exactly one `state`:

- `unknown` has a non-null `sportRef` and classification. An unresolved classification has null
  `canonicalFamily`, `displayLabel`, and `authorship` at `revision` zero. A user-authored reset has the same
  null meaning, `authorship` `user`, and a positive revision.
- `classified` has a non-null `sportRef`; `authorship` `user`; a positive revision; and a non-null
  `canonicalFamily`, `displayLabel`, or both. Family codes are `running`, `cycling`, `swimming`, `walking`,
  `hiking`, `strength`, `mobility`, `racket-sport`, `team-sport`, `winter-sport`, `water-sport`, and `other`.
- `unavailable` has null `sportRef` and `classification`. The source supplied no sport reference, so the group
  cannot be classified.

Classified groups sort first by family and label, unresolved groups next, and unavailable groups last;
ties retain origin ordinal and opaque reference order. Labels are trimmed user text of one through 80 Unicode
scalar values without control characters. Presentation localizes family codes but never translates user text.

## Save and concurrency

The save envelope contains `request` with `sportRef`, `expectedRevision`, `canonicalFamily`, and
`displayLabel`. At least one meaning field creates or amends a `classified` value. Two null meaning fields
write an explicit user-authored `unknown`. Saving an identical authored value returns `outcome` `unchanged`
without increasing the revision; a material change returns `changed`. Both outcomes include the complete
refreshed `overview`, so presentation adopts the application-owned ordering and aggregate coverage instead
of rebuilding either rule after the mutation.

The application compares `expectedRevision` before writing. A stale revision returns
`sport-classification-conflict`, changes nothing, and requires presentation to reload the current value.
Invalid references, family codes, labels, or unclassifiable groups return `invalid-sport-classification`.
Storage or query failure returns `sport-classification-failed`; prior canonical history and classifications
remain authoritative.

## Reimport and compatibility

Import and reimport do not write classification. Identical bytes can be reassessed by a newer mapping while
existing exact-key classifications survive. Newly visible source values begin as unresolved. A disappeared
source value is not presented but its authored row remains in the library for later reappearance, backup,
restore, and eventual portable export.

Changing grouping identity, complete-history scope, origin separation, ordering, coverage calculation,
opaque-reference behavior, state meaning, revision rules, family vocabulary removal, error codes, or numeric
encoding requires a new contract version. Domain, application, SQLite, transport, schema, component,
packaged E2E, accessibility, and performance evidence protect this contract.
