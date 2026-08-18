# Polar Flow Daily Activity to Canonical Daily Activity

## Status and authority

Normative mapping version 1 for the implemented walking skeleton. The external structure is described by the [Polar Flow export reference](../providers/polar-flow.md); the target meaning is defined by the [canonical daily activity specification](../canonical/daily-activity.md).

This mapping defines FitFreed behavior. It does not claim that Polar guarantees the observed source format.

## Recognition boundary

The adapter examines safe regular files at the ZIP root. Only `activity-{YYYY-MM-DD}-{UUID}.json` with the complete observed lexical token shapes is recognized as a daily activity artifact. A prefix match or malformed near miss is unrecognized. Directories, symbolic links, encrypted members, duplicate names, nested paths, absolute paths, and members that exceed configured resource limits reject the package before mapping.

Filename tokens are used for family recognition and consistency validation. They do not provide canonical identity, provenance identity, ordering, or precedence. The JSON `date` remains the canonical source-local date, but it must equal the date token in the recognized filename. A mismatch makes the artifact invalid because the evaluated format provides two contradictory representations of the same source fact.

## Field mapping

| Source input | Validation and transformation | Canonical output | Information loss |
|---|---|---|---|
| Exact version 1 account-data username claim | Resolved through a library-scoped HMAC-SHA-256 digest; raw value is discarded after resolution. No filename token is substituted. | `originId` | The target is an opaque random library-local observation origin, not the claim or digest. |
| `date` | Required JSON string parsed as a valid `YYYY-MM-DD` calendar date; preserved verbatim after validation. | `localDate` | No time-zone identifier exists at this level. |
| Filename date and JSON `date` differ | Reject the complete package with the privacy-safe reason `filename-content-date-mismatch`. | none | Neither representation is selected silently. |
| `summary` absent or null | Accepted. | `stepCount` = null | Other daily summary information is not mapped. |
| `summary.stepCount` absent or null | Accepted. | `stepCount` = null | Absence and explicit null currently produce the same canonical value. |
| `summary.stepCount` integer greater than or equal to zero | Preserved as a signed 64-bit integer. | `stepCount` | No transformation. |
| `summary.stepCount` negative, fractional, string, boolean, object, or out of range | Reject the complete package as invalid supported content. | none | No partial canonical state is published. |

Unknown JSON fields are accepted and ignored by mapping version 1. `exportVersion`, `physicalInformation`, `samples`, and every `summary` field other than `stepCount` are deliberately not mapped by this version. Their presence does not imply support, and their values do not affect reconciliation.

## Structural compatibility policy

No adequate provider version contract has been established for this artifact family. Mapping version 1 therefore uses an explicit shape-based boundary instead of treating `exportVersion` as authoritative:

| Source variation | Mapping version 1 behavior |
|---|---|
| Root object with a valid matching `date`; `summary` absent or null | Compatible; maps a null step count. |
| `summary` object with `stepCount` absent, null, zero, or a non-negative 64-bit integer | Compatible under the field rules above. |
| Additional root, `summary`, `samples`, or `physicalInformation` fields | Compatible but ignored; no support is implied for their meaning. |
| Any `exportVersion` value or absence | Not interpreted; compatibility is decided only from the mapped shape. |
| Non-object root, missing or invalid `date`, non-object non-null `summary`, or invalid `stepCount` type/range | Invalid supported content; the package is rejected atomically. |
| Filename date and JSON `date` mismatch | Invalid supported content; neither date is preferred. |
| More than one daily-activity artifact for the same resolved origin and JSON date in one package | Invalid supported content with reason `duplicate-daily-activity-date`; delivery order and filename tokens never choose a winner. |

This is a precise compatibility claim for the evaluated shapes, not a guarantee about every historical or future Polar export. New independently observed variants extend this table and its synthetic evidence before the adapter accepts them.

## Coverage, provenance, failure, and atomicity

Every safe ZIP-root member receives one artifact-coverage classification when assessment completes. A structurally valid account-data claim and successfully mapped activity artifacts are `supported`; malformed account data and recognized activity artifacts with malformed JSON, an invalid or missing `date`, or an invalid mapped value are `invalid`. Other complete known Polar Flow grammars are `unsupported` or `deliberately-ignored` according to the provider registry, while unfamiliar and malformed names are `unrecognized`. Field-level omissions inside a supported activity artifact do not create additional artifact rows.

Mapping reads one expanded artifact at a time before the canonical visibility transaction. Each mapped observation carries its artifact locator, artifact SHA-256, `json-root` source-record locator, provider, current adapter version `polar-flow-archive@8`, and this mapping version into reconciliation. Reconciliation stores a provenance row for create, equivalent, enrichment, preservation, and conflict decisions. Current import operations record the combined `polar-flow-mapping-set@3` contract while daily-activity provenance retains the more specific `polar-flow-daily-activity@1` mapping. Historical operations may retain `polar-flow-mapping-set@1` or `polar-flow-mapping-set@2`.

Any invalid supported artifact rejects the complete package after coverage has been recorded. Cancellation, rejection, failure, or injected transaction interruption exposes no canonical changes. Accepted canonical observations, provenance, conflicts, reconciliation counts, and the completed import outcome become visible in one SQLite transaction.

## Reimport behavior

The canonical (`originId`, `localDate`) identity drives overlap reconciliation. Byte-identical packages use a SHA-256 fast path only when an earlier completed operation has complete coverage, a verified source subject where required, and exactly the current provider, adapter, and mapping versions. A new completed operation links to that evidence and copies its artifact coverage without parsing or duplicating canonical history. An adapter or mapping upgrade reassesses the same bytes under the new contract. Different package bytes still reconcile by canonical identity using the rules in the canonical specification.

## Compatibility limits

Current adapter version `polar-flow-archive@8` retains the shape-based matrix, filename/content consistency, duplicate-identity rejection, version-scoped exact-repeat reuse, and source-subject resolution under [ADR 0005](../../architecture/decisions/0005-use-library-scoped-source-subject-correlation.md). Recognition still does not imply that every JSON structure or semantic variant is supported. The privacy-safe acceptance predicate has passed against the supplied reference export, but one evaluated package cannot establish universal historical compatibility.

## Synthetic evidence

Integration tests independently construct ZIP and JSON inputs with full fictional filename grammars for valid, absent, invalid, overlapping, conflicting, repeated, cancelled, interrupted, duplicate-name, unsafe-path, symbolic-link, known-family, ignored-family, unknown-family, and compression-limit cases in [`../../../src-tauri/src/infrastructure.rs`](../../../src-tauri/src/infrastructure.rs). No example is copied from a personal export.
