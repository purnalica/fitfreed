# ADR 0010: Run update recovery from the preserved application

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Update trust](../update-trust.md), [release delivery](../release-delivery.md)

## Context

An in-application update can replace the bundle that contains the running executable. The new application must then open and, when required, migrate the separate SQLite library before the update is safe. A process that fails to launch, crashes during startup, or cannot open the migrated library cannot reliably restore itself.

The Tauri macOS installer temporarily moves the current application while replacing it, but that temporary directory is scoped to the installation call. It is not a durable recovery asset after installation returns. FitFreed therefore needs a verified copy that survives application replacement and a recovery actor whose executable is not part of the newly installed bundle.

## Decision drivers

- A failed replacement, launch, migration, or confirmation must preserve a usable matching application and library pair.
- Recovery must still run when the new application cannot start.
- Recovery state must survive process and machine interruption.
- The recovery mechanism must not create an independently versioned privileged helper.
- Paths, assets, transitions, and cleanup must be constrained and auditable.

## Considered alternatives

### Let the new application restore itself

This handles errors detected after enough startup code runs. It cannot handle failure to launch, an early crash, a hung startup, or an unreadable executable. It therefore cannot own the recovery guarantee.

### Rely on the native updater's temporary backup

The native installer can use a temporary copy while replacing the application. That copy is not retained across the post-installation launch and library-migration confirmation window, so it cannot restore a later failure.

### Ship a separately versioned recovery helper

A dedicated helper could remain outside the application bundle. It would add another executable, package identity, update lifecycle, signing target, installation location, and removal obligation. The private macOS alpha does not need that additional product surface.

### Execute recovery mode from the preserved previous application

The verified recovery copy already contains the exact previous executable. Launching that executable in a narrowly validated non-UI recovery mode keeps the recovery actor independent of the candidate bundle without adding a separately shipped binary.

## Decision

FitFreed will execute the external recovery watchdog from its verified copy of the previous application.

- Before native replacement, FitFreed creates and verifies a persistent application copy and a consistent SQLite online backup under its application-data recovery directory.
- A versioned local recovery manifest binds the source and target versions, trusted update identity, installed paths, backup locations, application-tree digest, and library digest and schema. The manifest and active-attempt pointer are written atomically.
- The previous executable starts in a private recovery mode before replacement begins and confirms readiness. It accepts only the active attempt under the expected recovery root and validates the complete manifest and asset set before acting.
- After successful replacement, the original process exits. The watchdog launches the replacement itself and retains the child-process handle.
- The new application confirms success only after its compiled version matches the target, the library opens and reaches the expected schema, and normal startup recovery succeeds.
- If the replacement fails, exits early, hangs past the bounded confirmation window, or cannot confirm its library, the watchdog stops that child, restores the verified previous application and library, and launches the restored executable.
- Recovery restoration is idempotent. Cleanup is permitted only after a terminal confirmed or recovered outcome has been retained for user-visible reporting.
- The helper mode has no arbitrary copy or delete interface. Recovery identifiers, roots, fixed relative asset paths, manifest transitions, bundle identity, installed destinations, and digests are validated before filesystem mutation.
- The initial implementation is macOS-specific. Linux and Windows will implement the same application-owned recovery contract through platform adapters when those targets enter scope.

The normative local representation is [update recovery version 1](../../data-formats/release/update-recovery-v1.md).

## Consequences

### Positive

- Recovery remains available even when the candidate application never starts.
- The restored executable and library are an explicitly matched pair.
- No additional packaged executable or privileged resident service is introduced.
- The state machine and assets can be exercised with release-shaped applications and deliberate interruption.

### Negative

- The previous application remains on disk until confirmation and cleanup.
- Installation requires cross-process coordination, atomic local state, bounded waiting, and platform-specific process handling.
- Application copying and restoration must preserve macOS bundle metadata and later code-signing validity.

### Risks and mitigations

- A forged manifest could turn recovery into an unsafe filesystem primitive. Fixed relative paths, expected-root validation, bundle and library identity checks, closed schemas, and exact digests constrain every target before mutation.
- The watchdog itself could be interrupted. Every transition is persisted atomically and restoration is idempotent, so the next launch can resume the same active attempt.
- Cleanup could erase the only recovery copy too early. Terminal outcome persistence and successful application/library confirmation precede deletion.
- A future signed bundle could be damaged by an incomplete copy. macOS copying preserves bundle metadata, and the copy must pass tree, bundle-identity, executable, and release-shaped launch checks before replacement.

## Verification

Unit tests must reject illegal lifecycle transitions. Integration tests must cover atomic preparation, valid app and SQLite copies, tampering, malformed or unknown manifest data, active-attempt conflicts, interrupted writes, idempotent restoration, and safe cleanup. Packaged macOS tests must cover successful replacement, retained locale and library content, launch failure, migration failure, timeout, watchdog interruption, restored launch, and removal that keeps the library.
