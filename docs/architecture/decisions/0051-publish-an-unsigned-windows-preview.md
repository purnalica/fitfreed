# ADR 0051: Publish an unsigned Windows preview

- **Status:** Accepted
- **Date:** 2026-09-16
- **Decision owners:** FitFreed project owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [ADR 0044](0044-publish-expanding-complete-platform-sets.md), [ADR 0045](0045-separate-windows-native-and-updater-signing-authority.md), [ADR 0050](0050-retire-signpath-as-windows-signing-authority.md), [Milestone 5 plan](../../plans/milestone-5.md)

## Context

FitFreed has complete hosted Windows package, capability, update-recovery, performance, filesystem-recovery, and
data-scale engineering evidence, but no public Windows artifact. SignPath Foundation declined the project's
application, and ADR 0050 retired SignPath without selecting another release route.

Current European screening identifies HARICA's individual-validated certificate as the preferred future
Authenticode authority. Activating it now would introduce certificate purchase, individual validation, physical-token
custody, signing-host integration, and a recurring release procedure before any Windows user has expressed interest.
Withholding Windows indefinitely would make demand impossible to observe.

Microsoft documents that an unsigned download ordinarily presents `Windows protected your PC`, can be blocked by
enterprise policy, and may be blocked outright by Smart App Control. Independent updater signatures and release
signatures authenticate FitFreed-controlled bytes, but they do not create an Authenticode publisher identity or make
an unsigned binary equivalent to a signed one.

This decision selects the bootstrap Windows distribution profile. It does not activate HARICA, claim stable Windows
trust parity, represent hosted Windows Server evidence as exact Windows 11 evidence, or authorize publication before
the exact candidate passes the preview gates defined here.

## Decision drivers

- Make the already engineered Windows application available so real demand can be observed.
- Avoid recurring certificate and custody work before any Windows interest exists.
- Describe the platform limitation honestly at every download and installation decision point.
- Preserve cryptographic update integrity, source provenance, release checksums, SBOMs, and immutable official bytes.
- Retain clean installation, update recovery, data preservation, removal, and exact-candidate admission as release
  blockers.
- Avoid repeating accepted product E2E, performance, or subjective evaluation when only the release trust profile
  changes.

## Considered alternatives

### Wait for HARICA-signed distribution

This provides Authenticode publisher identity from the first public download, but introduces cost and a physical
signing boundary before demand is known. It also prevents the project from collecting the feedback that would justify
that investment.

### Publish unsigned Windows as a stable peer of macOS and Linux

This makes the package available quickly but obscures material installation and policy differences. A user whose
system blocks the package would reasonably interpret the stable claim as a broken installation. This alternative is
rejected.

### Publish a transparent unsigned Windows preview

This makes the package discoverable while preserving an explicit trust distinction and all non-Authenticode release
controls. It creates a feedback path without representing the package as universally installable. This is the
selected alternative.

## Decision

FitFreed will publish one x86-64 current-user NSIS package as **Windows preview — unsigned**.

1. The setup, installed `fitfreed.exe`, and installed `uninstall.exe` must all be demonstrably unsigned. The release
   manifest, native package inventory, build evidence, candidate verifier, and remote verification must identify the
   unsigned preview profile explicitly; absence of a signature must never be inferred from missing evidence.
2. The product site, GitHub Release notes, Windows user guide, and candidate evaluation state that the publisher will
   appear as unknown, SmartScreen normally requires an explicit continuation, enterprise policy may prevent it, and
   Smart App Control may block it. Guidance must not ask users to disable system-wide protections.
3. macOS and Linux remain the stable supported release platforms. Windows is labelled preview wherever availability
   or platform support is presented and is not described as having equivalent native trust or installability.
4. Tauri updater signatures, independent release-checksum signatures, immutable GitHub Release origin, source-bound
   provenance, SBOMs, replay protection, authenticated predecessors, and update-recovery behavior remain mandatory.
   `Unsigned` means no Authenticode publisher identity; it does not mean unauthenticated distribution.
5. The exact candidate must pass native installation, launch, update-authority, data preservation, restart, and
   removal gates on the pinned GitHub-hosted Windows environment. Accepted product capability, E2E, update-recovery,
   data-scale, and performance campaigns are retained unless an executable product change invalidates them. This
   admits a preview package, not exact Windows 11 support: the download surfaces must state that the candidate is
   built and automatically verified on hosted Windows and still needs direct Windows 11 feedback.
6. The download surfaces provide a direct, account-free route for Windows feedback. No analytics, telemetry, account,
   or synchronization service is introduced to measure interest.
7. HARICA Code Signing IV is the deferred Authenticode authority. It will be activated before Windows is promoted from
   preview to stable, or earlier when real Windows feedback shows that unsigned installation friction is blocking
   adoption. Its price, Spanish individual-validation path, supplied-token middleware, signing-host integration, and
   ability to sign every NSIS trust surface must be revalidated before purchase.

## Consequences

### Positive

- Windows users can evaluate FitFreed without waiting for speculative certificate investment.
- The project can base the signing decision on observed demand rather than assumption.
- Existing Windows engineering evidence and provider-neutral packaging work remain useful.
- Update and release integrity remain independently verifiable.

### Negative

- Users receive an unknown-publisher warning, and some Windows 11 systems cannot run the preview.
- Each unsigned binary version starts without transferable publisher reputation.
- The Windows preview cannot honestly claim the same installation experience or native trust as the stable macOS
  package.
- The release pipeline and schemas must gain an explicit unsigned public profile rather than reusing the existing
  Authenticode profile.

### Risks and mitigations

- Users could mistake the warning for detected malware. Download surfaces explain the precise trust limitation and
  provide independent verification from the official origin without claiming that signing proves software quality.
- Instructions could encourage unsafe global configuration. The user guide permits only the ordinary per-file
  continuation exposed by Windows and explicitly rejects disabling system-wide protections.
- An attacker could substitute an unsigned installer. Immutable official origin, signed checksum inventory, source
  provenance, updater signatures, and exact digest verification remain mandatory.
- Preview status could become permanent without review. Any Windows stable claim requires HARICA admission through a
  later ADR and exact signed-candidate evidence.

## Verification

Static contracts must reject an unsigned Windows artifact unless every release surface declares the preview profile
and retains the required warning. They must also reject Authenticode claims, a non-preview Windows support claim,
instructions to disable system protections, missing updater or checksum authority, and any publication path that
bypasses exact candidate admission.

One source-bound package must report `NotSigned` for the setup, installed executable, and installed uninstaller; pass
the pinned hosted-Windows preview lifecycle; enter an immutable complete-platform candidate; and remain byte-identical
through GitHub Release, Pages, stable update metadata, provenance, and remote verification. The verifier must preserve
the distinction between this evidence and exact Windows 11 admission. Publication remains a separate protected
decision.
