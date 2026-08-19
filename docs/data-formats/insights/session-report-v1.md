# Session Report Read Models Version 1

## Purpose

These contracts create, edit, list, reopen, resolve, review, and export the first durable session-origin
report without exposing persistence identity or asking presentation to calculate evidence.

## Commands and responses

| Operation | Input | Output |
|---|---|---|
| create | [`session-report-create-v1`](../../../schemas/session-report-create-v1.schema.json) | portable [`report-definition-v1`](../../../schemas/report-definition-v1.schema.json) |
| update | [`session-report-update-v1`](../../../schemas/session-report-update-v1.schema.json) | portable report definition |
| list | none | [`report-list-v1`](../../../schemas/report-list-v1.schema.json) |
| load | valid `reportRef` | portable report definition |
| resolve | valid `reportRef` | [`session-report-resolution-v1`](../../../schemas/session-report-resolution-v1.schema.json) |
| export | [`session-report-export-v1`](../../../schemas/session-report-export-v1.schema.json) | [`report-export-receipt-v1`](../../../schemas/report-export-receipt-v1.schema.json) |

Create first resolves the exact `sessionRef` against `sourceSnapshotRef`. It allocates identities and writes
only after that evidence is coherent. Update requires the exact positive expected revision. An unchanged
edit does not write or increment the revision. A concurrent edit returns `report-definition-conflict`.

The list is bounded to 1,000 definitions and is ordered by the persistence adapter from most recently
updated, with stable report identity as its tie-breaker. The response contains no narrative or fitness value.

## Resolution

Resolution returns the complete definition, `resolvedSnapshotRef`, `current` or `stale` `status`, one bounded
session summary, current provenance attribution, a `sensitiveContents` inventory, and ordered `limitations`
codes.
Session fields retain the training-selection contract's units and missing-value semantics. Heart-rate
values are null when physiological context is excluded, whether or not source evidence exists.

Sensitivity kind `heart-rate` appears only when average or maximum heart-rate evidence exists. `included`
states whether the resolved preview contains it. Limitation order is distance, energy, heart rate, then sport;
only applicable codes appear:

- `distance-unavailable`
- `energy-unavailable`
- `heart-rate-unavailable`
- `sport-unclassified`
- `sport-unavailable`

Current provenance contains provider, source revision time, adapter version, mapping version, and complete
contributing/non-contributing event counts from the authoritative provenance query. It does not expose
package or artifact evidence.

When the saved snapshot has changed, resolution retries the exact stable session identity against the
current snapshot and returns that value only as a `stale` refresh candidate. Missing current evidence is an
explicit `report-evidence-unavailable` result. A mutation between selection and provenance returns
`report-source-changed`; no partial response is returned.

## Export authorization

The destination is a local operating-system path selected explicitly by the person. It is command data,
never persisted in the report, diagnostics, output metadata, or public evidence. Export requires exact
definition revision and saved source snapshot, a current resolution, and a reviewed physiological-content
choice. Review may omit context allowed by the definition but cannot add context the definition excluded.

Cancellation before or during the output adapter returns `report-export-cancelled`. Failure returns
`report-export-failed`. Neither outcome may leave a destination that appears complete. Success returns only
the non-negative byte count; presentation already owns the selected destination.

The generated document follows the separate [HTML report version 1](../portable/report-html-v1.md)
contract.
