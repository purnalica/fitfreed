# Import Lifecycle and Consistency Model

## Status

Proposed Milestone 0 baseline. [ADR 0002](decisions/0002-select-sqlite-storage.md) selects SQLite as the single system of record; this document defines the import behavior and the transaction boundaries that its adapter must implement.

## Goal

An import is repeatable, observable, cancellable before its visibility boundary, and recoverable after interruption. At no point may exploration see a partially integrated package or an import outcome that claims changes which are not visible in canonical history.

## State model

```mermaid
stateDiagram-v2
    [*] --> Assessing: package selected
    Assessing --> Planned: safe and recognizable
    Assessing --> Rejected: policy or input rejection
    Assessing --> Failed: system failure
    Assessing --> Cancelled: user cancellation
    Planned --> Staging: integration approved
    Planned --> Committing: exact-repeat fast path
    Planned --> Cancelled: user cancellation
    Staging --> Reconciling: all supported candidates mapped
    Staging --> Rejected: invalid supported content
    Staging --> Failed: system failure
    Staging --> Cancelled: user cancellation
    Reconciling --> Committing: all decisions prepared
    Reconciling --> Rejected: invariant violation
    Reconciling --> Failed: system failure
    Reconciling --> Cancelled: user cancellation
    Committing --> Completed: visibility boundary succeeds
    Committing --> Recovering: process interruption
    Recovering --> Completed: commit confirmed
    Recovering --> RolledBack: previous state restored
    RolledBack --> Failed: recovery outcome recorded
    Rejected --> [*]
    Cancelled --> [*]
    Failed --> [*]
    Completed --> [*]
```

`Assessing`, `Planned`, `Staging`, `Reconciling`, `Committing`, and `Recovering` are durable non-terminal states. `Completed`, `Rejected`, `Cancelled`, and `Failed` are terminal outcomes. A terminal operation is immutable except for separately recorded diagnostic or support annotations that cannot change its claimed data effect.

## Phase contracts

### 1. Assessing

The application reads the selected package without changing canonical history:

1. establish the import-operation identity and local package handle;
2. stream the package fingerprint and container inventory;
3. enforce entry-path, link, compression, size, count, nesting, and resource limits;
4. detect the source provider and applicable adapter version;
5. classify artifacts and derive a package assessment;
6. persist enough non-personal operation metadata to explain rejection or resume policy.

Assessment never trusts the filename extension, MIME declaration, archive paths, or compressed sizes alone.

### 2. Planned

The import plan fixes the adapter and mapping versions, artifact classification, intended work, resource budgets, and coverage baseline. It is deterministic for the same package bytes and application compatibility version.

An exact package fingerprint may take a fast path that avoids repeated parsing. The new import operation still records an explainable completed outcome and links to the earlier evidence; exact byte identity is not reused as logical identity for a different package.

### 3. Staging

Supported artifacts are streamed through their source adapter. Structural validation and the anti-corruption layer produce typed normalized observations and local provenance locators in bounded batches.

Staged candidates are not queryable as fitness history. Temporary state is private, bounded, permission-restricted, and either resumable under an exact implementation/version contract or safely disposable. Raw personal values never enter general application logs, public diagnostics, or test snapshots.

Known unsupported, deliberately ignored, and unrecognized artifacts remain in coverage. Invalid content intended for a supported mapping rejects the package unless a family specification explicitly defines an independently committable boundary and explains the resulting partial outcome. The MVP default is package-level atomicity for supported mappings.

### 4. Reconciling

Fitness History evaluates each candidate using the logical identity and invariant rules of its canonical concept. Every candidate receives one decision:

- **new:** create canonical information;
- **equivalent:** preserve canonical state and extend provenance when needed;
- **amended:** replace or enrich canonical information under a documented rule while retaining history of the decision;
- **conflicting:** preserve the conflict without silently choosing by source order;
- **rejected:** violate canonical invariants or an established semantic precondition.

The complete decision set is prepared before visible state changes. Reconciliation order cannot alter the resulting canonical state.

### 5. Committing

The visibility boundary atomically publishes:

- accepted canonical changes;
- provenance linking those changes to source evidence and mapping versions;
- reconciliation decisions and unresolved conflicts;
- final artifact and family coverage;
- the completed import outcome.

The implementation may stage data outside one long database transaction, but the visible switch is atomic. The selected storage architecture must demonstrate this property for multi-gigabyte packages rather than relying on a transaction that holds all parsed content in memory.

Cancellation requested after committing begins is deferred until the atomic boundary resolves. The interface explains this brief non-cancellable phase.

### 6. Recovering

On startup, the application resolves every interrupted commit before exposing the library. Recovery must prove one of two states:

- the complete new canonical state and completed outcome are visible; or
- the previous complete state is restored and a failed outcome records the recovery.

An ambiguous state blocks normal library writes and presents actionable recovery guidance. It never guesses that the import completed.

## Progress and outcomes

Progress is phase-aware. When total work is knowable, the application may report bounded artifact or byte progress; when it is not, it reports the active phase and completed work without displaying a false percentage.

Every terminal outcome includes:

- package recognition and adapter/mapping version;
- exact-repeat status;
- coverage grouped by supported, unsupported, deliberately ignored, unrecognized, and invalid;
- counts of reconciliation decisions without personal values;
- warnings, conflicts, or failures with recovery guidance;
- whether canonical history changed and whether temporary state was removed.

Public diagnostics use opaque operation references and sanitized aggregates. Detailed local provenance remains protected as personal-library data.

## Reimport invariants

1. Reimporting the same package cannot duplicate canonical information.
2. Different package bytes can still be semantically equivalent.
3. A later overlapping package is reconciled per canonical concept, not by filename or import time.
4. Artifact iteration order and batch size cannot change the final result.
5. An operation that does not reach `Completed` exposes no canonical changes.
6. A completed outcome and its canonical effect become visible together.
7. Provenance can grow when canonical content remains equivalent.
8. Unknown, unsupported, ignored, invalid, and conflicting information remains visible in coverage.

## Verification obligations

- State-machine unit tests reject illegal transitions and changes to terminal operations.
- Domain tests prove new, equivalent, amended, conflicting, and rejected outcomes per canonical concept.
- Adapter integration tests prove streaming, safety limits, classification, mapping, and cancellation with synthetic packages.
- Persistence integration tests interrupt every durable phase and verify startup recovery and atomic visibility.
- Property tests vary artifact order and batch boundaries while preserving the expected canonical result.
- E2E tests verify duplicate and overlapping reimports, progress, cancellation, restart, coverage, and recovery through release-shaped entry points.

## Pending decisions

- SQLite staging representation and the exact short transaction used for atomic visibility.
- Whether resumable staging is worth its privacy, versioning, and cleanup complexity for the MVP.
- The exact cancellation granularity and resource budgets after representative synthetic measurements.
- Family-specific exceptions, if any, to package-level atomicity for supported mappings.
- Retention duration and user controls for completed import operations and detailed provenance.
