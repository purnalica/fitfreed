# Training Sports Read Model Version 3

## Status and boundary

Normative provider-neutral complete-library sport discovery contract. Version 3 retains coverage, ordering,
recognition, personal classification, concurrency, and privacy behavior from
[version 2](training-sports-v2.md), adopts [training sport identity version 2](training-sport-identity-v2.md),
and separates classification identity from represented-session identity.

`query_training_sports` returns
[`training-sports-v3.schema.json`](../../../schemas/training-sports-v3.schema.json).
`save_training_sport_classification` still accepts the version-1 command and now returns
[`saved-sport-classification-v3.schema.json`](../../../schemas/saved-sport-classification-v3.schema.json).

## Exact represented collections

Every item has a required opaque `sessionFilterRef`. It identifies exactly the sessions summarized by that
item and is the only value accepted by current History and calendar `sportRefs` filters. `sportRef` remains a
separate nullable personal-classification capability. Neither value is rendered.

Without a personal override, exact session evidence is grouped separately from the unresolved remainder of
the same source profile. Conflicting exact candidates form their own `ambiguous` collection. Exact evidence
can also produce a `recognized` or `ambiguous` collection with null `sportRef` and null `classification` when
the session record has no profile. A `personally-overridden` classification deliberately reunites every exact
and unresolved session belonging to that real source profile and produces one new stable `sessionFilterRef`.

Reimporting identical evidence preserves collection identity. A mapping revision, evidence change, or
personal classification advances the discovery snapshot; callers must re-query rather than mix identities.
Changing grouping, either capability meaning, coverage, ordering, state resolution, or privacy requires a
new response version.
