# Training Sports Read Model Version 6

## Status and boundary

Normative provider-neutral complete-library sport discovery with reusable personal correlation and exact
provider-normalization defaults. Version 6 retains the identity, classification, coverage, ordering, command, error,
and base-collection contracts from [version 5](training-sports-v5.md), and adopts the
[canonical unified sport relationship version 2](../canonical/unified-sport-relationship-v2.md).

`query_training_sports` returns
[`training-sports-v6.schema.json`](../../../schemas/training-sports-v6.schema.json).
Classification saves return
[`saved-sport-classification-v6.schema.json`](../../../schemas/saved-sport-classification-v6.schema.json), and
relationship saves or removals return
[`saved-unified-sport-relationship-v2.schema.json`](../../../schemas/saved-unified-sport-relationship-v2.schema.json).
The command request schemas remain version 1 because their reviewed inputs are unchanged.

## Base, personal, and normalized projections

`sportCollections` remains the complete exact base set. Every entry contains one exact `sport-*` capability in both
`sessionFilterRef` and its one-item `memberSessionFilterRefs`, and has null `unification`.

`sports` applies personal relationships first. A current reusable relationship contains the effective exact members
resolved under canonical relationship version 2 and exposes the same `unified:sport-*` capability and user-authored
`unification` value as version 5. A missing member without a compatible retained selector or an unresolved primary
replacement remains in `unificationReviews`.

Remaining exact recognized collections may then receive one adapter-owned provider normalization. Two or more base
collections appear as one normalized visible item only when they have the same opaque versioned normalization
capability within one origin and their provider-neutral recognition values agree. The visible item contains:

- the normalization `sport-*` capability as `sessionFilterRef`;
- every exact base capability in canonical `memberSessionFilterRefs` order;
- the common recognized identity and null `unification`;
- minimum and maximum local dates; and
- checked sums of exact member coverage.

A provider-normalized item remains bounded to 64 exact members. Exceeding that bound fails the coherent query rather
than returning an arbitrary or truncated normalized item.

Unknown, ambiguous, unavailable, differently recognized, cross-origin, or personally claimed collections never enter
that default. Provider identifiers and normalization evidence do not cross the port. Navigation, filters, workspaces,
and reports use `memberSessionFilterRefs`; the normalized capability is not a session-search predicate.

Every base collection occurs exactly once in the visible result, directly, through one valid personal relationship,
or through one provider-normalized item. The checked visible session sum equals `sessionCount`.

## Reimport and precedence

A non-identical cumulative import may introduce another base collection. A retained personal selector applies it to
the existing relationship without changing user revision. Equal exact provider evidence may also extend a normalized
visible item. An explicit personal relationship always claims its reviewed and compatible effective members before
provider normalization runs.

Changing provider evidence advances the training discovery snapshot. Saved queries must resolve their exact member
capabilities against the new snapshot; no synthetic visible capability is persisted as a source predicate.

## Privacy and compatibility

Transport contains only opaque FitFreed capabilities and provider-neutral identity evidence already permitted by
version 5. Private source selectors, provider identifiers, and source code sets remain inside infrastructure. Schema
37 stores the private local matcher as protected library state and excludes it from public diagnostics.

Changing effective membership, normalization eligibility, precedence, filtering, privacy, or command outcomes
requires a new response version.
