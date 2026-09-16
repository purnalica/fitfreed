# Code signing policy

## Status

FitFreed uses native platform trust in addition to its independent update and release-integrity signatures. The
current public macOS package is signed with Apple Developer ID and notarized by Apple. Windows Authenticode signing
remains inactive. The SignPath Foundation application was declined and SignPath was retired by
[ADR 0050](docs/architecture/decisions/0050-retire-signpath-as-windows-signing-authority.md). FitFreed has no Foundation
certificate or active free signing sponsorship. [ADR 0051](docs/architecture/decisions/0051-publish-an-unsigned-windows-preview.md)
authorizes an explicitly unsigned Windows preview while deferring HARICA Code Signing IV for revalidation before
Windows becomes stable or when observed demand justifies earlier activation.

## Product and source boundary

Only binaries built from the public [`purnalica/fitfreed`](https://github.com/purnalica/fitfreed) repository may be
signed as FitFreed. The repository and the complete signed product are licensed under GPL-3.0-or-later. Upstream
binaries are never re-signed as FitFreed.

The Windows package contract covers the version-matched x86-64 per-user NSIS setup, the installed `fitfreed.exe`, and
the installed `uninstall.exe`. The unsigned preview requires all three to report `NotSigned`; a partial or ambiguous
trust state is rejected. A future stable Windows release requires all three to carry valid, timestamped Authenticode
signatures from the same admitted certificate. A signed outer setup alone is never a valid stable FitFreed Windows
release.

Official downloads are published only through an immutable
[GitHub Release](https://github.com/purnalica/fitfreed/releases) linked from <https://fitfreed.org/>. A signature does
not make an artifact from another location an official FitFreed distribution.

## Team roles

The current bootstrap roles follow the public [governance model](GOVERNANCE.md):

- **Authors:** [`@matutet`](https://github.com/matutet), the current project owner and maintainer, may modify the
  repository directly.
- **Reviewers:** [`@matutet`](https://github.com/matutet) reviews contributions from people without commit access.
- **Approvers:** [`@matutet`](https://github.com/matutet) approves the separate candidate-construction and FitFreed
  publication gates. No Windows production-signing request is currently authorized.

Role membership will move to public GitHub teams when additional maintainers are appointed. Every team member with
repository or protected release access must use multi-factor authentication.

## Retired SignPath integration

The following controls describe the inactive integration retained pending a complete dependency inventory. They are
not an available signing procedure and cannot produce an authorized public Windows package.

- The retired SignPath GitHub connector bound signing requests to GitHub-provided
  repository, workflow, revision, and build metadata.
- Every job that contributed bytes to a SignPath request ran on a GitHub-hosted runner. Signing inputs were uploaded as
  GitHub workflow artifacts before submission.
- The SignPath GitHub Action remains pinned to a reviewed immutable commit. Project, signing-policy, and artifact-configuration
  identifiers are protected configuration, not workflow-dispatch inputs.
- Every production signing request required manual approval in SignPath. The intended certificate private key would
  have remained in SignPath's hardware security module rather than being exported to GitHub or a maintainer machine.
- Artifact configurations restrict exact filenames and enforce the FitFreed product name and one consistent version.
- The executable and externally generated NSIS uninstaller are signed before final packaging. The resulting setup is
  signed in a separate request, then installed on a clean supported Windows 11 system so independent verification can
  inspect the setup, installed executable, and installed uninstaller.
- Tauri updater signatures, platform-neutral release signatures, and Authenticode remain separate authorities. None
  substitutes for another.

The current implementation and release gates are documented in the
[release-delivery architecture](docs/architecture/release-delivery.md) and the
[public-release operations runbook](docs/development/public-release-operations.md).

## Unsigned Windows preview

The Windows preview has no Authenticode publisher identity. Windows therefore displays an unknown publisher,
Microsoft Defender SmartScreen normally requires an explicit per-file continuation, enterprise policy may prevent
installation, and Smart App Control may block it. FitFreed documentation must never instruct users to disable
system-wide protections.

The preview remains authenticated by its immutable official GitHub Release origin, updater signatures, independently
signed checksum inventory, source-bound provenance, and SBOMs. Those controls detect substituted bytes and bind the
package to its public source, but they do not create a Windows publisher identity or make the package equivalent to an
Authenticode-signed executable. The download surface labels Windows as preview and states that automated admission is
performed on the pinned hosted Windows environment rather than claiming exact Windows 11 coverage.

## Privacy and network behavior

FitFreed has no account, analytics, telemetry, advertising, or synchronization service. Imported fitness history,
routes, reports, provenance, and preferences remain in the local library and are not sent to a signing provider,
GitHub, or any other service.

The application contacts the fixed public FitFreed update endpoint after a ready startup, when the user requests an
update check, and no more than once every 24 hours while it remains open. These requests send no imported facts,
provider data, locale, library schema, installation identifier, or usage data. Opening an official provider or
project link contacts that destination only after the user activates the link. Core import, exploration, reporting,
and export remain available offline.

No Windows signing provider currently receives release binaries. Synthetic test data is used by automated
verification; personal exports and local libraries never enter the release workflow.

## Installation and removal

The Windows package installs FitFreed for the current user, registers it in Windows Installed apps, and creates the
documented shortcuts. It includes the WebView2 runtime needed for offline installation and provides a registered
uninstaller. Removing the application removes package-owned files but deliberately preserves the separate local
fitness library so an uninstall cannot silently destroy user data. The version-matched user guide explains how to
remove that library separately.

## Reporting a problem

Report suspected signing misuse, supply-chain defects, or security vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/purnalica/fitfreed/security/advisories/new). Do not attach
personal fitness data, a FitFreed library, private paths, credentials, or signing material.
