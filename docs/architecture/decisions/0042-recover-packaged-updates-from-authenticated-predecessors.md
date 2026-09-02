# ADR 0042: Recover packaged updates from authenticated predecessors

- **Status:** Accepted
- **Date:** 2026-09-02
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Update trust](../update-trust.md), [release delivery](../release-delivery.md)

## Context

The implemented recovery format and infrastructure preserve a macOS `.app`, derive its executable and version from
Apple bundle metadata, copy it with `ditto`, and identify processes through macOS APIs. Those are correct properties of
the closed macOS version 1 contract, not portable application concepts.

A Debian package and an NSIS installer also own package-manager state, registration, shortcuts, and removal metadata.
Copying only installed files back after a failed update could make the old application appear to run while the native
installer still records the new version. Treating that inconsistent state as recovery would violate the release gate.
Conversely, relying only on an old installer is insufficient if native rollback is temporarily blocked by
operating-system authorization or a package-manager failure: the person must not be stranded without a runnable prior
version and recovery guidance.

The stable update envelope already authenticates the candidate package. Cross-platform recovery also needs exact,
authenticated predecessor material before replacement begins. The closed macOS version 1 schema cannot be silently
reinterpreted for another installed layout.

## Decision drivers

- Restore native package-manager state rather than only visible application files.
- Keep a runnable previous version available when native rollback cannot complete immediately.
- Authenticate every predecessor byte before granting it recovery authority.
- Preserve the existing lifecycle, database pairing, fail-closed validation, and privacy boundary.
- Isolate operating-system behavior behind infrastructure ports without leaking package concepts into the domain.

## Considered alternatives

### Generalize the macOS application-tree copy

Each platform could copy its installed directory and replace that directory on failure. This does not restore Debian
or Windows installer state and can leave shortcuts, registration, versions, or uninstall metadata inconsistent.

### Retain only the predecessor installer

Reinstalling the exact old package restores native state, but a denied authorization prompt or installer failure can
leave no usable application while recovery evidence still exists.

### Preserve an authenticated predecessor installer and a runnable predecessor image

The native installer is the authoritative rollback mechanism. A separately validated runnable image keeps the prior
version available and presents recovery status if native restoration cannot complete immediately. Both are paired with
the matching library backup and one recovery manifest.

## Decision

Linux and Windows updates will use a new recovery-contract version that preserves both an authenticated predecessor
installer and the minimum complete runnable predecessor image before candidate replacement starts.

- The update channel identifies a recovery artifact for every supported installed-version, target, and package-kind
  baseline. Its URL, size, digest, updater signature, application version, and package identity are authenticated by
  the signed channel payload.
- Recovery preparation obtains the exact predecessor artifact from a valid local cache or the authenticated immutable
  release location, then reopens and verifies it. An unavailable or invalid predecessor blocks installation of the new
  candidate.
- A platform installation port derives the installed identity, package kind, native destination, runnable-image
  boundary, predecessor launch command, rollback command, and validation rules. Callers cannot supply arbitrary paths
  or commands.
- The recovery manifest binds the predecessor installer, runnable image, library backup, target installer, installed
  destinations, versions, schemas, and digests. Unknown platforms, package kinds, fields, or path layouts fail closed.
- A copied predecessor runner acquires operating-system-native exclusive leases and records process identity before the
  candidate installer starts. Linux uses supported Unix primitives and `/proc` evidence; Windows uses native process
  handles, creation times, canonical executable paths, and exclusive file handles. A process identifier alone is never
  authority.
- On candidate failure, the runner first restores the matching library and invokes the predecessor native installer.
  Debian rollback uses the operating system's authorization boundary; current-user NSIS rollback is unprivileged. The
  runner validates package state and installed bytes before declaring recovery complete.
- If native rollback cannot complete, the validated predecessor image remains available through an explicit recovery
  launch mode and retains all recovery assets. This state is not reported as recovered. It provides the previous
  application and actionable retry guidance without treating mixed native state as success.
- macOS recovery version 1 remains closed and unchanged. Shared lifecycle policy may be extracted, but platform layouts
  and schema versions remain explicit adapters.
- The domain and application layers retain provider-neutral update authorization and recovery outcomes. Package
  discovery, filesystem durability, installer execution, process control, and platform locks remain infrastructure.

## Consequences

### Positive

- Recovery restores the native installation contract as well as user data.
- A temporary rollback-authority failure does not discard the last runnable version or its evidence.
- Platform-specific security rules become explicit and independently testable.
- A future package family can add an adapter without weakening existing formats.

### Negative

- Recovery consumes space for a predecessor package, runnable image, and database backup.
- Stable update metadata must describe supported predecessor artifacts, not only the new candidate.
- Linux authorization and Windows process semantics require distinct integration and E2E suites.

### Risks and mitigations

- A predecessor download could turn recovery into a network dependency. Preparation completes and verifies all
  predecessor material before any replacement transition; later recovery is offline.
- A malicious path or executable could acquire recovery authority. Fixed platform identities, canonical path checks,
  private permissions, exact digests, native process creation evidence, and closed schemas remain mandatory.
- The fallback runnable image could be mistaken for completed rollback. It uses a distinct non-terminal outcome and
  cannot remove recovery assets or enable another update until native state is restored.

## Verification

Contract tests must reject missing, mismatched, cross-platform, cross-package, mutable, and unsupported predecessor
artifacts. Each platform adapter requires unit tests for identity, paths, locks, process lifetime, installer commands,
interruption points, and terminal validation. Release-shaped E2E must prove successful replacement, installer failure,
candidate startup failure, native predecessor restoration, temporarily unavailable rollback authority, runnable
predecessor fallback, retry, database pairing, restart resumption, cleanup, and removal. No platform is release-ready
until these scenarios pass with its exact package type in a clean supported environment.
