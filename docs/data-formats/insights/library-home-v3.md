# Library Home Read Model Version 3

## Status and boundary

Normative provider-neutral contract for a recognizable, actionable view of an imported FitFreed
library. Version 3 retains every revision, coverage, question, post-import, recent-session, highlight,
ordering, and fallback rule from [version 2](library-home-v2.md). It changes only sport-summary identity:
distinct unresolved profiles remain distinct, a summary for exactly one editable profile carries a safe
capability for the existing sport-classification task, and recent sessions retain the same opaque sport
association so their visible identity stays coherent.

The Tauri `query_library_home` command continues to accept
[`library-home-query-v1.schema.json`](../../../schemas/library-home-query-v1.schema.json) and now returns
[`library-home-v3.schema.json`](../../../schemas/library-home-v3.schema.json). Versions 1 and 2 remain
immutable historical read-model contracts. Version 3 is a disposable projection, not canonical history,
a persistence format, or provider evidence.

## Retained version 2 contract

Every response contains `version` 3 and the version-2 `libraryRevisionRef`. `availableRange`, `domains`,
`questions`, `highlight`, `postImport`, and `resumableExploration` retain their complete version-2 meanings.
Training and sport counts, bounded list sizes, revision retry, snapshot coherence, ordering, localization,
and exact-detail ownership are unchanged.

## Actionable sport summaries

Each `training.sports` entry retains `state`, optional `canonicalFamily`, optional user-authored
`displayLabel`, `profileCount`, and `sessionCount`, and adds nullable `sportRef`.

`sportRef` is a provider-independent opaque capability already owned by the training-sport discovery
contract. It is non-null only when the summary represents exactly one profile whose source sport identity
is available. It is never a provider sport value, classification key, origin, path, or display label. The
presentation must not render it, serialize it into an exported report, use it as copy, or infer sport meaning
from its bytes. It may only target the existing classification use case and restore the exact originating
control.

Unknown profiles are keyed by their distinct `sportRef` and therefore never aggregate with one another.
Each has `profileCount` 1 and a non-null capability. Presentation gives multiple unknown profiles distinct
localized ordinal labels and offers a contextual naming action. It does not guess names.

Classified profiles with identical canonical family and display label retain version-2 aggregation. A
single-profile classified summary carries its capability; an aggregate of two or more profiles has null
`sportRef`. Unavailable profiles retain null `sportRef` because no safe classification target exists.
`profileCount`, the six-summary bound, and `omittedSportProfileCount` preserve complete coverage exactly as
in version 2.

Each `recentSessions` entry adds nullable `sportRef` with the same safe opaque meaning. It is non-null for an
unknown or classified session whose detected profile is available and null when sport evidence is unavailable.
Presentation uses it only to associate an unknown recent session with the corresponding ordinal Home summary;
the existing `sessionRef` remains the sole exact-detail target. The value is never displayed or exported.

## Navigation and propagation obligations

The contextual action opens the existing Sports classification task for the exact profile; Home must not
create a second classification editor. Save, reset, validation, conflict handling, persistence, and
classification revision rules remain owned by the canonical classification use case. A successful change
refreshes Home and every mounted training surface from the returned overview under the new library revision.
Return navigation restores the originating Home control when it still represents that profile, with a safe
Home-heading fallback if aggregation removes the exact control.

## Compatibility

Changing capability availability, unknown-profile separation, aggregation, bounds, safe-reference meaning,
or any retained version-2 semantic requires a new Library Home contract version. Application, transport,
schema, component, packaged E2E, accessibility, localization, dense-history, restart, and repository privacy
tests protect this contract.
