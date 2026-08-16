# Canonical Daily Activity

## Status and scope

Normative specification for canonical daily activity version 1, implemented by the Milestone 1 walking skeleton. This concept is provider-neutral. It is not a serialization format and does not define the future portable FitFreed export.

## Fields

| Field | Type | Cardinality | Meaning and invariants |
|---|---|---|---|
| `originId` | string | exactly one | Opaque identity of the source subject within one source namespace. It is required and participates in logical identity. Provider names, archive filenames, and import order are not canonical identity. |
| `localDate` | string | exactly one | Gregorian calendar date in `YYYY-MM-DD` form. It is valid as a calendar date and is preserved as source-local civil time without conversion through the computer time zone. |
| `stepCount` | signed 64-bit integer or null | zero or one value | Non-negative daily step total. Null means that no supported value is available; zero means an observed total of zero. |

The logical identity is the ordered pair (`originId`, `localDate`). Canonical query order is `localDate`, then `originId`.

## Reconciliation

Reconciliation is deterministic for one logical identity:

| Existing value | Incoming value | Decision | Canonical effect |
|---|---|---|---|
| absent observation | any valid value | new | Create the observation. |
| equal, including null/null | equal | equivalent | Preserve the value. |
| null | non-null | enriched | Replace null with the incoming value. |
| non-null | null | preserved | Preserve the existing value. |
| non-null | different non-null | conflicting | Preserve the existing value and record the competing value as a conflict. |

Package order and artifact order do not grant precedence. Exact package repetition is an import optimization and does not change canonical identity.

## Provenance

Every stored canonical value retains the SHA-256 fingerprint of the package that last created or enriched it. Competing observations retain the incoming package fingerprint separately. Provenance is implementation-owned metadata associated with the canonical observation; it is not part of the observation's logical identity.

## Compatibility and current limits

Version 1 contains only the daily step total. It does not yet model activity samples, calories, distance, inactivity, source-local time ranges, physical information, or source-format versions. Adding a field or changing identity, missing-value, date, unit, or reconciliation semantics requires a new canonical contract version and corresponding mapping, persistence, migration, and synthetic evidence.

The application host still supplies a synthetic development origin, so real-export import is not yet compatible. [ADR 0005](../../architecture/decisions/0005-use-library-scoped-source-subject-correlation.md) now defines the required replacement: canonical `originId` is an opaque library-local observation origin resolved from versioned, library-scoped provider evidence. The provider claim and its digest are not canonical fields. Implementation, migration, and acceptance evidence remain open in Milestone 2.

## Automated evidence

- Domain reconciliation behavior: [`../../../src-tauri/crates/fitfreed-domain/src/lib.rs`](../../../src-tauri/crates/fitfreed-domain/src/lib.rs)
- Persistence and adapter integration behavior: [`../../../src-tauri/src/infrastructure.rs`](../../../src-tauri/src/infrastructure.rs)
- Contract-to-code validation: [`../../../scripts/check-data-contracts.mjs`](../../../scripts/check-data-contracts.mjs)
