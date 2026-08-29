# Training Sports Read Model Version 5

## Status and boundary

Normative provider-neutral complete-library sport discovery and explicit relationship contract. Version 5 retains the
identity, coverage, ordering, classification, exact represented-session filtering, and privacy rules from
[version 4](training-sports-v4.md), while adding the separate user-authored relationship defined by the
[canonical unified sport relationship](../canonical/unified-sport-relationship.md).

`query_training_sports` returns
[`training-sports-v5.schema.json`](../../../schemas/training-sports-v5.schema.json).
`save_training_sport_classification` still accepts the version-1 command and now returns
[`saved-sport-classification-v5.schema.json`](../../../schemas/saved-sport-classification-v5.schema.json).

## Coherent base and visible projections

`snapshotRef` is the opaque training-discovery snapshot shared by the complete response. `originCount` and
`sessionCount` retain their version-4 meanings.

`sportCollections` is the complete ordered base collection set. Every item has one `sport-*` `sessionFilterRef`, the
same single value in `memberSessionFilterRefs`, and null `unification`. Its exact coverage, identity, recognition,
classification capability, and source index are never rewritten by a relationship.

`sports` is the ordered visible projection. An unclaimed base collection appears unchanged. A valid active
relationship appears once with:

- its stable `unified:sport-*` relationship capability as `sessionFilterRef`;
- every exact member capability in `memberSessionFilterRefs`;
- the chosen primary member's identity, classification capability, recognition, and source index;
- the minimum first date, maximum last date, and exact checked sums of member coverage; and
- the complete user-authored `unification` value.

The synthetic relationship capability is never a session-search predicate. Navigation, filters, workspaces, and
reports use `memberSessionFilterRefs`, preserving their question when a relationship is later revised or removed.
Every base collection occurs in exactly one visible item, either alone or as one relationship member, and the visible
session total must equal `sessionCount`.

## Relationship value and review

`unification.relationshipRef` is stable across revisions. `primarySessionFilterRef` and every
`memberSessionFilterRefs` value name base collections from the same response. Membership contains two through 64
distinct values and includes the primary. `authorship` is `user`; `revision` starts at one and increments only for an
effective revision.

The primary must currently be `recognized` or `personally-overridden`. Unknown, ambiguous, and export-missing
collections may be represented members but cannot supply visible identity precedence.

If a persisted relationship has a missing member or no longer has a usable primary, FitFreed leaves all available base
collections separate and returns the authored value in `unificationReviews`. `missing-member` carries every missing
member capability; `unusable-primary` carries an empty missing list. No evidence change silently substitutes a member,
chooses another primary, or discards the authored relationship.

## Save and remove commands

`save_unified_sport_relationship` accepts
[`unified-sport-relationship-save-v1.schema.json`](../../../schemas/unified-sport-relationship-save-v1.schema.json).
A create sends null `relationshipRef` and revision zero. A revision sends the current relationship capability and
positive revision. `expectedSnapshotRef` binds the complete preview. Every `members` item sends one base capability
and the exact session count reviewed by the person; duplicate capabilities are invalid even when their counts differ.
The chosen primary must occur once in that member set.

The application compares snapshot, revision, current member coverage, primary usability, and overlap before one
atomic write. `invalid-sport-unification` reports an invalid request or relationship;
`sport-unification-conflict` reports stale snapshot, revision, or reviewed coverage; and
`sport-unification-failed` reports a persistence failure. A successful command returns
[`saved-unified-sport-relationship-v1.schema.json`](../../../schemas/saved-unified-sport-relationship-v1.schema.json)
with `changed` or `unchanged` plus one fresh coherent version-5 overview.

`remove_unified_sport_relationship` accepts
[`unified-sport-relationship-remove-v1.schema.json`](../../../schemas/unified-sport-relationship-remove-v1.schema.json).
It requires the reviewed snapshot, relationship capability, and revision. Success returns `removed` plus a fresh
overview. Removal deletes only relationship authorship; imported sessions, source evidence, recognition, personal
classification, report definitions, and base collection capabilities remain.

## Reimport, recovery, and portability

Import and reimport never author or broaden a relationship. Stable member capabilities retain an active relationship.
Changed evidence advances the discovery snapshot and can put an obsolete relationship into explicit review.

Schema-36 libraries persist relationships as user-owned local library state. Transactional migration and complete
library-file backup/restore preserve it. FitFreed 0.1.0 does not yet claim a complete portable normalized-library
export, so this contract does not pretend that copying the implementation database is the supported user exit path.
The relationship must enter that future portable contract before a complete library export is advertised.

Changing base collection meaning, visible projection, relationship invariants, concurrency, error semantics,
filter preservation, review behavior, or privacy requires a new response or command version.
