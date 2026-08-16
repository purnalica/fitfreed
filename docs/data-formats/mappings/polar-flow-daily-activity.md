# Polar Flow Daily Activity to Canonical Daily Activity

## Status and authority

Normative mapping version 1 for the implemented walking skeleton. The external structure is described by the [Polar Flow export reference](../providers/polar-flow.md); the target meaning is defined by the [canonical daily activity specification](../canonical/daily-activity.md).

This mapping defines FitFreed behavior. It does not claim that Polar guarantees the observed source format.

## Recognition boundary

The adapter examines safe regular files at the ZIP root. Only `activity-{YYYY-MM-DD}-{UUID}.json` with the complete observed lexical token shapes is recognized as a daily activity artifact. A prefix match or malformed near miss is unrecognized. Directories, symbolic links, encrypted members, duplicate names, nested paths, absolute paths, and members that exceed configured resource limits reject the package before mapping.

Filename tokens are used only for family recognition. They do not provide canonical identity, date, provenance identity, or ordering. The JSON `date` is currently not cross-checked against the filename date token.

## Field mapping

| Source input | Validation and transformation | Canonical output | Information loss |
|---|---|---|---|
| Adapter-supplied source-subject identity | Required by the adapter boundary; no filename token is substituted. | `originId` | Real Polar source-subject resolution is not implemented. |
| `date` | Required JSON string parsed as a valid `YYYY-MM-DD` calendar date; preserved verbatim after validation. | `localDate` | No time-zone identifier exists at this level. |
| `summary` absent or null | Accepted. | `stepCount` = null | Other daily summary information is not mapped. |
| `summary.stepCount` absent or null | Accepted. | `stepCount` = null | Absence and explicit null currently produce the same canonical value. |
| `summary.stepCount` integer greater than or equal to zero | Preserved as a signed 64-bit integer. | `stepCount` | No transformation. |
| `summary.stepCount` negative, fractional, string, boolean, object, or out of range | Reject the complete package as invalid supported content. | none | No partial canonical state is published. |

Unknown JSON fields are accepted and ignored by mapping version 1. `exportVersion`, `physicalInformation`, `samples`, and every `summary` field other than `stepCount` are deliberately not mapped by this version. Their presence does not imply support, and their values do not affect reconciliation.

## Coverage, provenance, failure, and atomicity

Every safe ZIP-root member receives one artifact-coverage classification when assessment completes. Successfully mapped activity artifacts are `supported`; recognized activity artifacts with malformed JSON, an invalid or missing `date`, or an invalid mapped value are `invalid`. Other complete known Polar Flow grammars are `unsupported` or `deliberately-ignored` according to the provider registry, while unfamiliar and malformed names are `unrecognized`. Field-level omissions inside a supported activity artifact do not create additional artifact rows.

Mapping reads one expanded artifact at a time before the canonical visibility transaction. Each mapped observation carries its artifact locator, artifact SHA-256, `json-root` source-record locator, provider, adapter version, and this mapping version into reconciliation. Reconciliation stores a provenance row for create, equivalent, enrichment, preservation, and conflict decisions.

Any invalid supported artifact rejects the complete package after coverage has been recorded. Cancellation, rejection, failure, or injected transaction interruption exposes no canonical changes. Accepted canonical observations, provenance, conflicts, reconciliation counts, and the completed import outcome become visible in one SQLite transaction.

## Reimport behavior

The canonical (`originId`, `localDate`) identity drives overlap reconciliation. Byte-identical packages use a SHA-256 fast path only when an earlier completed operation has complete coverage. A new completed operation links to that evidence and copies its artifact coverage without parsing or duplicating canonical history. Different package bytes still reconcile by canonical identity using the rules in the canonical specification.

## Compatibility limits

The adapter does not yet detect `exportVersion`, validate historical daily-activity variants, or resolve a stable real account identity. The executable filename registry covers every family observed in the current reference, but a recognized name does not imply that its JSON structure or semantics are supported. Real-export MVP compatibility therefore remains open.

## Synthetic evidence

Integration tests independently construct ZIP and JSON inputs with full fictional filename grammars for valid, absent, invalid, overlapping, conflicting, repeated, cancelled, interrupted, duplicate-name, unsafe-path, symbolic-link, known-family, ignored-family, unknown-family, and compression-limit cases in [`../../../src-tauri/src/infrastructure.rs`](../../../src-tauri/src/infrastructure.rs). No example is copied from a personal export.
