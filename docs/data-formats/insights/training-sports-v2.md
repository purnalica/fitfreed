# Training Sports Read Model Version 2

## Status and boundary

Normative provider-neutral contract for complete-library sport discovery with trustworthy provider evidence
and independent personal meaning. Version 2 retains grouping, coverage, ordering, concurrency, error, and
opaque capability rules from [version 1](training-sports-v1.md). It replaces the `classified` presentation
state with the shared [training sport identity](training-sport-identity-v1.md).

The Tauri `query_training_sports` command returns
[`training-sports-v2.schema.json`](../../../schemas/training-sports-v2.schema.json). The unchanged
`save_training_sport_classification` input remains
[`sport-classification-save-v1.schema.json`](../../../schemas/sport-classification-save-v1.schema.json) and
now returns
[`saved-sport-classification-v2.schema.json`](../../../schemas/saved-sport-classification-v2.schema.json).

## Complete-library discovery

`originCount`, `sessionCount`, `sports`, `sourceIndex`, `firstLocalDate`, `lastLocalDate`, and `coverage`
retain version-1 meaning. Coverage contains positive `sessionCount`, exact unsigned-decimal
`totalDurationMilliseconds`, `distanceSessionCount`, and `heartRateSessionCount`; both measurement counts
are bounded by the session count. The opaque `sportRef` is a local command capability and is never rendered.

Each group adds `recognition` and `recognitionCandidateCount`. Its `state` is exactly `recognized`,
`ambiguous`, `unknown`, `personally-overridden`, or `unavailable`. State shape, provider-neutral provenance,
locale fallback, privacy, and personal precedence are defined once by the shared identity contract.

Recognized groups sort by provider-neutral recognized family and deterministically ordered localized names.
Personally overridden groups sort by personal family and label and retain precedence over their source
recognition. Ambiguous groups precede unknown groups, and unavailable groups remain last. Ties retain origin
ordinal and opaque capability order.

## Save, refresh, and reimport

The save envelope still contains `sportRef`, `expectedRevision`, nullable `canonicalFamily`, and nullable
`displayLabel`. A material user-authored change returns `changed`; an identical value returns `unchanged`.
Both outcomes return the complete version-2 `overview`. A stale revision returns
`sport-classification-conflict`; invalid input returns `invalid-sport-classification`; query or storage
failure returns `sport-classification-failed`. No failure changes imported training evidence.

Two null meaning fields create an explicit `personally-overridden` unknown with `authorship` `user`; they do
not erase provider evidence. Reimport never overwrites personal meaning. Catalogue or mapping activation can
move a non-overridden group among recognized, ambiguous, and unknown, invalidates earlier discovery
snapshots, and keeps exact imported and authored evidence intact.

Changing grouping, coverage, ordering, state resolution, recognition provenance, personal precedence,
concurrency, error behavior, or privacy requires a new contract version.
