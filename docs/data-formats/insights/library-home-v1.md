# Library Home Read Model Version 1

## Status and boundary

Normative provider-neutral contract for the first useful view of an imported FitFreed library. The
Home answers two questions before an explorer is opened: which history is actually available, and
which evidence-backed questions can be answered now. It is a disposable projection over the
authoritative activity, training, sleep, recovery, longitudinal, and import-outcome application
contracts. It is not canonical history, a persistence format, a provider dashboard, a readiness
score, medical interpretation, training advice, or evidence of causation.

The Tauri `query_library_home` command accepts
[`library-home-query-v1.schema.json`](../../../schemas/library-home-query-v1.schema.json) and returns
[`library-home-v1.schema.json`](../../../schemas/library-home-v1.schema.json). The
`save_exploration_workspace` command accepts
[`exploration-workspace-save-v1.schema.json`](../../../schemas/exploration-workspace-save-v1.schema.json);
`clear_exploration_workspace` has no input value.

## Request and post-import context

The request always contains `afterImportOperationRef`. A normal library entry sends null. The
successful-import journey sends the opaque operation reference returned by that import. A blank
reference returns `invalid-library-home-request` before any library query.

`postImport` is non-null only when the requested reference exactly matches the latest durable import
outcome and that outcome is `completed`. A missing, superseded, cancelled, rejected, failed, or still
active operation returns null. This correlation prevents an old import result from being presented
as the explanation for current library state.

The reveal contains `exactRepeat`, `canonicalHistoryChanged`, `newObservations`,
`enrichedObservations`, and `amendedObservations` from that committed outcome.
`sourceReviewRecommended` is true when archive coverage was incomplete, any artifact was
`unsupported`, `deliberately-ignored`, `unrecognized`, or `invalid`, or reconciliation found a
conflict. Detailed artifact coverage and provenance remain in Sources.

## Resumable exploration

`resumableExploration` is null or contains `version` 1 and one provider-neutral `destination`.
Home returns it only when the durable workspace version is current and the corresponding question
remains answerable from current canonical history. A saved destination therefore never overrides
measurement coverage or grants authority to query absent information.

Saving accepts only `activity`, `training`, `sleep`, `recovery`, or `longitudinal`, re-evaluates Home,
and returns `invalid-exploration-workspace` when the destination is not currently answerable. An
explicit return Home clears the workspace. Unknown, obsolete, or stale persisted state produces a
null resumable exploration instead of hiding Home. Version 1 deliberately persists no range,
origin, filter, search, coordinate, measurement, free text, focus target, or scroll position.

## Ranges and domain order

Top-level `availableRange` spans the earliest through latest date represented by any available
domain. It is null only when every domain is unavailable. Dates use canonical `YYYY-MM-DD`.

`domains` always contains exactly four entries in this order: `training`, `activity`, `sleep`, and
`recovery`. This stable order makes training the primary product route without hiding health and
longitudinal history.

Each available domain carries its stable `domain` code, complete `availableRange`, the
`selectedRange` used to calculate Home, `originCount`, `observedRecordCount`, and ordered
`measurements`. Home delegates to the current domain overview with a null requested range, so
`selectedRange` covers at most the latest 30
inclusive dates ending at that domain's latest observation. Counts are summed across origins while
origins remain independent in their authoritative explorers.

An unavailable domain has null ranges, zero origins and observations, and no measurements. Bounds
without valid origins, origins without bounds, invalid facts, overflow, or measurement coverage
greater than its observation denominator returns `library-query-failed`; Home never presents a
partial projection as complete.

## Measurement coverage

Every `measurement` entry has `availableRecords` and `observedRecords`. The denominator is the
domain's observed records in the selected range, summed across origins. The numerator is the number
of those records carrying that measurement. Zero is meaningful partial coverage; absence is never
imputed.

| Domain | Ordered measurement codes | Availability |
|---|---|---|
| `training` | `training-duration`, `training-distance`, `training-energy`, `training-heart-rate` | One record per session. Declared duration is required; the other measurements remain optional. |
| `activity` | `activity-steps` | One record per observed daily-activity fact; a fact may explicitly lack steps. |
| `sleep` | `sleep-duration`, `sleep-interruptions`, `sleep-efficiency`, `sleep-phases`, `sleep-stages`, `sleep-score`, `sleep-goal`, `sleep-power-status` | One record per observed night. Duration, interruption, and efficiency facts are required; the remaining structures are optional. |
| `recovery` | `recovery-beat-to-beat-interval`, `recovery-heart-rate-variability`, `recovery-breathing-interval`, `recovery-assessment`, `recovery-baseline`, `recovery-guidance` | One record per observed night. Beat-to-beat and breathing intervals are required; the remaining facts are optional or source-specific. |

Source-specific assessment, baseline, guidance, score, sport, and artifact values do not enter Home.
The projection exposes only provider-neutral availability and routes to the detailed explorer.

## Answerable questions

`questions` is conservative and ordered. A question appears only when its required measurement has
at least one available record:

| `kind` | `destination` | Exact condition |
|---|---|---|
| `explore-training-sessions` | `training` | `training-duration` is available. |
| `align-history` | `longitudinal` | At least two of training duration, activity steps, sleep duration, and recovery beat-to-beat interval are available. |
| `review-activity-steps` | `activity` | `activity-steps` is available. |
| `review-sleep-patterns` | `sleep` | `sleep-duration` is available. |
| `review-recovery-patterns` | `recovery` | `recovery-beat-to-beat-interval` is available. |

The order is training, longitudinal alignment, activity, sleep, and recovery after inapplicable
questions are removed. A recorded activity day without steps therefore does not offer a steps
question. An empty library offers none. Presentation may localize the question but must not invent a
route or claim unsupported insight. Every destination retains navigation to Sources for coverage,
limitations, and provenance.

## Compatibility

Changing request correlation, range selection, domain or measurement order, coverage denominators,
question conditions, question-to-destination pairs, post-import meaning, resumable state, null
behavior, source separation, or error codes requires a new library-Home contract version.
Application, SQLite, transport, schema, component, packaged E2E, accessibility, and performance
tests protect this contract.
