# Library Home Read Model Version 5

## Status and boundary

Normative provider-neutral Library Home contract. Version 5 retains the complete recorded, usable, and
primary temporal meaning from [version 4](library-home-v4.md), plus all question, highlight, import reveal,
workspace, ordering, revision, and navigation guarantees. It adds trustworthy sport identity to the bounded
training summary and recent sessions.

The Tauri `query_library_home` command continues to accept
[`library-home-query-v1.schema.json`](../../../schemas/library-home-query-v1.schema.json) and now returns
[`library-home-v5.schema.json`](../../../schemas/library-home-v5.schema.json). Earlier versions remain
immutable historical contracts.
The response `version` is 5.

## Training identity projection

`training.sports` remains a maximum-six result ordered primarily by `sessionCount`; `recentSessions` remains
a maximum-four newest-session result. Every entry now uses `recognized`, `ambiguous`, `unknown`,
`personally-overridden`, or `unavailable` state and adds `localizedNames` plus
`recognitionCandidateCount`. `canonicalFamily` and `displayLabel` retain provider-neutral and personal
meaning respectively.

The projection intentionally omits catalogue revision, retrieval instant, mapping version, provider, raw
identifier, and evidence reference because Home needs a concise result rather than diagnostic provenance.
The complete identity remains available to the versioned History read models, while the immutable catalogue
provenance stays in the adapter-owned evidence store rather than being copied into Home. Recognized output has
one candidate and at least one localized name. Ambiguous output has two or more candidates but no selected name.
Unknown and unavailable output have zero candidates. A personally overridden Home summary deliberately projects empty
`localizedNames` and zero `recognitionCandidateCount`: Home groups it only by effective personal meaning,
never by recognition evidence hidden behind that meaning. Its recent-session entry retains the exact candidate
cardinality and recognized localized-name set so History can preserve the complete session context.

Unknown and ambiguous summaries remain separate per opaque `sportRef`, keep `profileCount` one, and can open
the existing classification task. Recognized or personally identical summaries may combine profiles; a
combined summary has null `sportRef` and is not presented as a single editable identity. Recent sessions
always retain the exact non-null capability when a sport was recorded.

## Temporal and navigation guarantees

`recordedRange`, `usableRange`, `primaryRange`, `primaryRange.scope`, domain `training`, `activity`, `sleep`,
`recovery`, `combined` semantics, and activity `stepCount` availability are unchanged from version 4. Sport
catalogue activation changes the training-discovery revision and therefore `libraryRevisionRef` and
`trainingSnapshotRef`; an older Home result is never silently combined with newly recognized sessions.

Presentation resolves names by current locale, never renders an opaque capability, distinguishes ambiguous
from unknown, and keeps personal text untranslated. Exact archive reimport retains personal identity and can
adopt a newer activated recognition mapping without changing imported facts.

Changing temporal meaning, summary bounds, grouping, recognition reduction, candidate semantics, personal
precedence, or navigation behavior requires a new Library Home contract version.
