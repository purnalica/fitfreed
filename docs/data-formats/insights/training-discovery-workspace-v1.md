# Training-Discovery Workspace Version 1

## Status and purpose

Normative local presentation-state contract for resuming an interrupted training-session investigation. The
Tauri `load_training_discovery_workspace`, `save_training_discovery_workspace`, and
`clear_training_discovery_workspace` commands use
[`training-discovery-workspace-v1.schema.json`](../../../schemas/training-discovery-workspace-v1.schema.json).
The workspace is a convenience state, not canonical fitness data, a portable export, or evidence that a
session still exists.

## Fields and invariants

`version` is one. `snapshotRef` binds all restored evidence to the coherent training-discovery snapshot that
produced it. `from`, `through`, `sportRefs`, `requiredMeasurements`, `text`, and `sort` retain the exact search
semantics of `training-session-search-v1`. `offset` and `limit` identify the visible page; the presentation
contract fixes `limit` at 25 and requires `offset` to be a multiple of 25.

`view` is `chronology` or `calendar`. A chronology workspace has null `calendarMonth` and `calendarDay`. A
calendar workspace has a canonical `calendarMonth`; optional `calendarDay` must fall within that month and
the workspace date bounds. `selectedSessionRefs` contains zero through four unique opaque references in
comparison order. `openSessionRef` is null or the independently open session and may duplicate a comparison
reference. No canonical origin, provider identifier, source session identity, or rendered label is stored.

## Restoration and invalidation

Restoration first re-runs the page query with the stored filters, page, and `snapshotRef`. Calendar state is
then projected from the accepted snapshot, and the ordered union of `selectedSessionRefs` and
`openSessionRef` is resolved through the selection contract. Only after those reads agree is the complete
workspace shown. This avoids reconstructing comparison or detail from a possibly unrelated visible page.

If the snapshot changed, FitFreed preserves still-valid filters and calendar intent, restarts from the first
page, and clears session selection and open detail because their old evidence is stale. An out-of-range
calendar month is clamped to the current filtered range. Malformed persisted state fails closed with
`invalid-training-discovery-workspace` or `training-discovery-workspace-query-failed`; a write or clear failure
returns `training-discovery-workspace-update-failed` without changing canonical history.

The application saves after a coherent UI transition rather than after every keystroke. Explicit **Back to
Home** clears both the top-level exploration destination and this detailed workspace. Closing and reopening
the application does not clear it. Import and reimport never rewrite it directly; snapshot validation handles
their effects.

Changing field meaning, restoration order, stale-snapshot behavior, selection limits, clear behavior, opaque
identity, or error codes requires a new contract version and persistence migration.
