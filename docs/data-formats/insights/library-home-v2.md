# Library Home Read Model Version 2

## Status and boundary

Normative provider-neutral contract for a recognizable, value-first view of an imported FitFreed
library. Version 2 retains the coverage, conservative questions, explicitly correlated import
reveal, and resumable destination from version 1. It adds complete training identity, recent
sessions, and one bounded factual highlight without turning Home into a dashboard of unrelated
metrics.

The Tauri `query_library_home` command continues to accept
[`library-home-query-v1.schema.json`](../../../schemas/library-home-query-v1.schema.json) and now
returns [`library-home-v2.schema.json`](../../../schemas/library-home-v2.schema.json). The request
does not accept a date, provider, source identity, range, or presentation preference. The host
supplies the current local calendar date through an application clock port.

Version 1 remains the immutable contract for the earlier projection and its migration evidence.
Version 2 is a disposable projection over authoritative canonical read models. It is not canonical
history, a persistence format, a readiness or wellness score, medical interpretation, training
advice, or a claim of causation.

## Coherent library revision

Every response contains `version` 2 and an opaque `libraryRevisionRef`. The revision covers the
latest terminal import operation and the training-discovery revision. Canonical activity, training,
sleep, and recovery facts change only through a terminal import transaction; authored sport meaning
changes the training-discovery revision. The SQLite adapter derives the reference without exposing
an import operation, source, path, or classification key.

The application reads this revision before and after composing coverage, training identity, the
highlight, the correlated import result, and the resumable destination. A changed revision causes
one complete retry. A second change fails the query rather than returning mixed evidence. Every
training search within one attempt uses the same `trainingSnapshotRef`; a stale snapshot has the
same retry behavior.

The exploration workspace is presentation continuity rather than analytical evidence. It is
validated against the questions produced by the accepted library revision but does not contribute
to `libraryRevisionRef`.

## Retained version 1 fields

`availableRange`, ordered `domains`, ordered `questions`, `postImport`, and
`resumableExploration` retain the version 1 meanings and validation rules. Domain coverage remains a
bounded latest-30-date availability projection; it must never be presented as a complete-history
record count.

Version 2 adds `unchangedObservations` to `postImport`. It is the checked sum of equivalent and
preserved canonical observations from the matching completed import. Home uses the correlated result
only to distinguish a changed, unchanged, or exact-repeat completion after the personal result hierarchy;
it does not repeat reconciliation counts or source diagnostics. Sources presents the non-zero change
categories and keeps exact artifact coverage, unsupported input, invalid input, and provenance behind
its deliberate result disclosure. A failed, rejected, cancelled, active, missing, or superseded operation
still produces no Home acknowledgement.

## Complete training identity

`training` is null when canonical training history is unavailable. Otherwise it contains:

- `trainingSnapshotRef`: the opaque snapshot shared by every returned training fact;
- `sessionCount`: the complete unfiltered session count, not a recent-window count;
- `sportProfileCount`: the complete number of detected provider-independent sport profiles;
- `omittedSportProfileCount`: profiles not represented by the bounded `sports` list;
- at most six provider-neutral `sports` summaries; and
- at most four newest `recentSessions`, ordered by local start descending with stable opaque
  identity.

The complete sport projection and complete unfiltered training search must report the same session
count. Disagreement fails the Home query. The search bounds must also agree with the training domain
bounds. This prevents a visually plausible but incoherent headline.

### Sport summaries

Each sport summary contains `state`, optional `canonicalFamily`, optional user-authored
`displayLabel`, `profileCount`, and `sessionCount`. It contains no provider sport value, source
index, origin, or editable capability.

Profiles with the same state, canonical family, and display label are aggregated. Unknown profiles
are aggregated together; profiles whose source did not provide usable sport identity are aggregated
as unavailable. Summaries are ordered by session count descending, then classified before unknown
before unavailable, then by family and label. The first six are returned. `profileCount` and
`omittedSportProfileCount` preserve the exact relationship between the bounded summaries and the
complete detected profile count.

### Recent sessions

Each recent session contains `sessionRef`, `startedAtLocal`, `durationMilliseconds`, optional
`distanceMeters`, and provider-neutral sport state, family, and user-authored label. Integer duration
is transported as a decimal string. The session reference opens exact current detail through the
authoritative session-selection path; Home never reconstructs detail or exposes source identity.

## One bounded highlight

`highlight` is null only for an empty library. Exactly one of the following variants is returned for
a non-empty library.

### Recent training comparison

`recent-training-comparison` is available only when at least one training session falls within the
seven inclusive local dates ending on the host's current local date. It contains:

- `referenceDate`;
- a seven-date `baseline` immediately preceding the current period;
- a seven-date `comparison` ending on `referenceDate`;
- each period's exact session count and total duration; and
- signed `sessionCountChange` and `durationChangeMilliseconds` values.

The baseline may contain zero sessions; zero is a fact, not missing evidence. Period duration and
signed duration change are decimal strings. The application sums already validated, source-separated
training-search summaries and does not calculate from the bounded recent-session cards.

### Historical training fallback

`historical-training` is returned when training exists but the current seven-date period contains no
session, or when the latest training date is after the host reference date. It contains
`referenceDate`, `currentRange`, `latestSessionDate`, and reason `no-current-training` or
`history-after-reference-date`. Presentation must confirm that the imported history remains usable,
show the newest recorded sessions, and avoid current-performance language.

### Non-training library fallback

`library-history` is returned when the library has activity, sleep, or recovery evidence but no
training session. It contains `latestEvidenceDate`. Presentation may route to answerable questions
but must not imply that training is missing from the source archive or that a current comparison was
possible.

## Presentation obligations

Home leads with the imported span, complete session count, current provider-neutral sport summaries, recent
sessions, and the single highlight. Coverage diagnostics do not compete with these outcomes. Dates,
durations, distances, counts, and signed changes are localized and rounded for reading; exact values
remain available through the authoritative destinations.

Unknown or unavailable sport meaning is stated quietly in context; History remains the owner of
classification. Missing optional distance is omitted. Home never displays provider vocabulary,
opaque references, raw precision, speculative conclusions, or repeated warnings about data that
FitFreed does not yet interpret.

## Compatibility

Changing revision ownership, retry behavior, complete-count meaning, sport aggregation, list bounds,
recent ordering, highlight selection, comparison periods, fallback reasons, post-import unchanged
meaning, or any retained version 1 semantic requires a new Library Home contract version.
Application, SQLite, transport schema, component, packaged E2E, accessibility, localization, dense
history, and restart tests protect this contract.
