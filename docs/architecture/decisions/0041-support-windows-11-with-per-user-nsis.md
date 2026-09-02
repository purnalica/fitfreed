# ADR 0041: Support Windows 11 with a per-user NSIS installer

- **Status:** Accepted
- **Date:** 2026-09-02
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [Milestone 5 plan](../../plans/milestone-5.md)

## Context

The frozen first-MVP baseline must reach Windows through a familiar installer, an authenticated in-application update
path, recoverable replacement, and an honest supported-version boundary. Tauri can generate WiX MSI packages and NSIS
setup executables. It can install either through the updater, but Windows exits the running application as soon as the
native installer starts. Recovery therefore cannot depend on the replaced executable continuing to coordinate the
operation.

Windows 10 public support has ended. Windows 11 is the maintained consumer desktop family. GitHub-hosted Windows
runners provide repeatable compilation and WebDriver evidence, but Windows Server runner evidence does not by itself
prove the exact Windows 11 desktop installation experience.

The NSIS installer's default current-user mode writes beneath `%LOCALAPPDATA%` without administrator authority. An MSI
is useful for managed deployment, but introduces WiX and machine-oriented installation behavior that is not necessary
for the first consumer release. A bundled WebView2 offline installer increases package size but prevents a missing
runtime or unavailable network from turning first launch into an installation failure.

## Decision drivers

- Provide a familiar double-click setup and Add or Remove Programs removal journey.
- Avoid unnecessary administrator prompts for the default consumer installation and update path.
- Make clean installation independent of WebView2 download availability.
- Preserve authenticated update and external recovery after Windows terminates the initiating process.
- Keep the first Windows matrix narrow enough to verify exhaustively.

## Considered alternatives

### Ship both MSI and NSIS installers

This covers consumer and managed deployment preferences, but creates two installation modes and two updater artifacts
whose replacement, recovery, removal, signing, and documentation evidence cannot be shared completely.

### Ship a per-machine MSI

An MSI is familiar to enterprise administrators and supports managed deployment. It requires Windows-only WiX
packaging and normally introduces elevation and machine-wide state that add no value to the first consumer MVP.

### Ship a current-user NSIS setup executable

NSIS is a familiar consumer installer, is directly supported by Tauri's updater, and avoids elevation in its default
current-user mode. It provides one coherent installation identity and a practical unprivileged rollback path.

## Decision

The first public Windows FitFreed release will support x86-64 editions of Windows 11 that remain in Microsoft support
at candidate issuance, through one Authenticode-signed NSIS setup executable.

- The package target is `windows-x86_64-nsis`.
- NSIS uses `currentUser` installation mode. Per-machine installation is not part of the first Windows contract.
- The installer contains English and Spanish installer resources and selects the operating-system locale by default.
- The package includes the WebView2 offline installer. Clean installation and first launch do not depend on downloading
  a browser runtime.
- The public setup executable and installed binaries require Authenticode signing with a certificate chain trusted by
  Windows. Updater signing, SHA-256 inventories, GitHub provenance, and Authenticode are independent mandatory layers.
- MSI, Microsoft Store, WinGet publication, Windows on ARM, Windows 10, and system-wide installation remain outside the
  first Windows release. Each future channel requires its own install, update, recovery, and removal evidence.
- Hosted Windows automation is engineering evidence. A clean supported Windows 11 desktop environment remains a
  separate release-candidate gate.

## Consequences

### Positive

- Ordinary installation and updates avoid administrator authority.
- The installer remains usable when WebView2 cannot be downloaded.
- One package format keeps user guidance, recovery, signing, and support coherent.
- The boundary excludes an end-of-support operating-system family.

### Negative

- The offline WebView2 payload materially increases download size.
- Managed MSI deployment and machine-wide installation are deferred.
- Public release requires external Authenticode signing authority and a clean Windows 11 evidence environment.

### Risks and mitigations

- A valid signature may still encounter reputation-based SmartScreen warnings, particularly with a new organization
  certificate. Candidate evaluation records the exact Windows trust result; documentation never describes a warning
  as trusted installation.
- Windows exits the application during updater installation. ADR 0042 moves recovery authority into a preserved
  predecessor runner before the installer starts.
- Hosted Server images may hide Windows 11 integration defects. The exact candidate must pass the complete matrix on a
  clean supported Windows 11 desktop before publication.

## Verification

Normal CI must compile, lint, and test the complete desktop host on a pinned stable x86-64 Windows runner. Platform CI
must build the NSIS package, prove the offline WebView2 payload and current-user identity, and run packaged capability,
localization, accessibility, update, and recovery E2E. The exact public candidate must additionally pass Authenticode
chain verification, SmartScreen and launch inspection, clean installation, first launch, update, deliberate candidate
failure and predecessor recovery, migration, removal, offline launch, and retained-library checks on a supported clean
Windows 11 desktop. Reconsider the package choice only when a second distribution channel can carry its own complete
matrix.
