# Milestone 5 Execution Plan

## Status

In progress as of 2026-09-03, with independent portability engineering authorized by ADR 0039. Public promotion
remains ordered after the accepted public Linux MVP.

| Increment | Status | Current evidence boundary |
|---|---|---|
| M5.0 Native portability admission | In progress | Portable commands and the pinned hosted job are implemented and locally verified; acceptance awaits a successful immutable `windows-2025-x86_64-host-package` run for the exact revision. |
| M5.1 Windows package identity and trust | In progress | The closed unsigned NSIS source-build, dual-profile clean installation/removal and inventory, fail-closed Authenticode signer and inspector, synthetic authority-cleanup campaign, and authority-separated three-file Windows expansion input are implemented and locally verified. Native execution awaits the hosted lane; protected public authority, complete candidate composition, and exact Windows 11 trust remain open. |
| M5.2–M5.6 | Not started | Their recovery, parity, reliability, documentation, candidate, human, and promotion gates remain open. |

## Objective

Deliver the unchanged first-MVP capability baseline on supported x86-64 Windows 11 editions through one current-user
NSIS setup executable with complete capability, installation, update, recovery, accessibility, localization,
performance, documentation, trust, support, and release evidence.

The milestone is not complete when a Windows executable compiles, an NSIS file exists, or hosted Server automation
passes. One exact Authenticode-signed candidate must pass every automated and Windows 11 desktop gate, and Linux must
already be publicly available before promotion.

## Scope protection

This milestone ports the frozen product. Windows integration, defects, installation, update, recovery,
accessibility-parity, localization-parity, performance, security, and required documentation are in scope. New product
capabilities remain locked until this milestone is publicly complete.

ADR 0041 fixes the first Windows boundary to supported Windows 11 x86-64 editions, one current-user NSIS installer, and
a bundled WebView2 offline installer. MSI, Microsoft Store, WinGet, per-machine installation, Windows on ARM, and
Windows 10 are outside this release.

## Stable inputs and independent gates

- The capability baseline and provider/canonical contracts are shared; Windows never receives a reduced functional
  edition.
- Shared cross-platform recovery contracts from Milestone 4 are inputs only after their lifecycle semantics pass; the
  Windows installation, locking, process, and durability adapters remain independently verified.
- Windows engineering may proceed while macOS or Linux human and publication gates remain open.
- Public Windows promotion requires an already published Linux release plus Windows signing, exact-candidate, clean
  Windows 11, human, and publication authority.
- The Windows expansion uses the next unreleased semantic version after that immutable Linux Release and contains
  newly built macOS, Linux, and Windows targets under
  [ADR 0044](../architecture/decisions/0044-publish-expanding-complete-platform-sets.md).

## Increment M5.0 — Native portability admission

**Outcome:** ordinary CI detects complete desktop-host and automation regressions on Windows.

**Work:**

1. Add a pinned stable x86-64 Windows hosted job with the repository's exact Node.js and Rust toolchains.
2. Compile, test, format-check, and lint the complete Rust workspace and desktop host with Windows-relevant features.
3. Make every invoked Node.js command, path, environment variable, temporary directory, process operation, and artifact
   name portable; do not depend on Bash in contributor or CI entry points required on Windows.
4. Resolve the instrumented executable as `fitfreed.exe` and preserve production/instrumented identity separation.
5. Key impact-aware evidence by Windows executable inputs so unchanged code does not repeat the expensive campaign.

**Acceptance evidence:** the full desktop host and portable fast lane pass on the pinned Windows runner; contract tests
reject Unix-only commands and prove fail-closed evidence reuse.

## Increment M5.1 — Windows package identity and trust

**Outcome:** one release-shaped current-user NSIS setup has a closed installation, runtime, locale, dependency, and
public trust contract.

**Work:**

1. Configure the Windows release profile for NSIS `currentUser`, x86-64, English and Spanish installer resources, and
   the WebView2 offline installer.
2. Verify installed path, registry identity, Start Menu entry, executable metadata, icons, version, publisher, license,
   WebView2 availability, and Add or Remove Programs entry.
3. Extend release schemas, inventories, checksums, SBOMs, provenance subjects, bundle-content rules, and target routing
   with a closed `windows-x86_64-nsis` artifact.
4. Implement fail-closed Authenticode preparation and inspection without putting certificates, account names, private
   keys, passwords, or machine-local paths in source, logs, or retained evidence.
5. Bind installed binary signatures, setup signature, updater signature, signed channel metadata, and GitHub provenance
   as independent release requirements.

**Acceptance evidence:** synthetic signing tests cover orchestration and cleanup; exact trust inspection remains open
until a real candidate has a valid trusted chain, timestamp, expected publisher authority, matching version and target,
and unchanged digest.

The implemented signing boundary uses the authority-free
`tauri.windows.public-signing.conf.json` overlay only when a protected candidate build explicitly selects it. The
overlay contains the executable adapter and `%1` binary placeholder, not certificate or service identity. The adapter
requires an explicit profile, absolute SignTool path, SHA-1 certificate-store selector, independently derived lowercase
SHA-256 certificate fingerprint, and a credential-free HTTPS RFC 3161 endpoint for the public profile. It signs with
SHA-256 and immediately invokes the independent Windows policy inspector. The inspector requires SignTool policy
verification, a valid Windows Authenticode result, exact certificate fingerprint, timestamp when public, unchanged
file digest, and—when inspecting a product binary—x86-64 PE architecture plus exact FitFreed name and version.

The hosted synthetic campaign uses only the already built unsigned `fitfreed.exe`. It creates a non-exportable,
short-lived self-signed certificate, trusts it only in the disposable current-user process boundary, signs and verifies
a temporary copy without a timestamp, proves the source binary is unchanged, and removes the trust-store copies,
private key, environment values, and temporary directory before it can emit success. This proves orchestration and
cleanup, not public publisher identity, timestamping, reputation, Windows 11 desktop behavior, or release authority.

[ADR 0045](../architecture/decisions/0045-separate-windows-native-and-updater-signing-authority.md) assigns
`npm run package:windows-expansion-input` as the separate protected native-build entry point. It requires active
recoverable `stable-v3` updater trust and the public timestamped Authenticode profile before removing stale NSIS
output, but explicitly rejects updater private-key authority. It selects only the authority-free Authenticode overlay,
embeds the public channel endpoint and trust set, builds only NSIS, rejects any output other than the exact setup, and
independently reinspects the final setup bytes after packaging. The clean installation adapter then supports a public
profile that inspects the setup and installed executable with full identity checks, inspects the installed uninstaller
signature, binds all three trust results to their independently hashed bytes, and preserves the same removal and
application-data boundary as the unsigned profile. A later protected complete-platform compositor signs those sealed
setup bytes for the updater and binds them to stable metadata and provenance. This is implemented structure, not
evidence that protected authority or a signed candidate exists.

The preparation boundary requires a clean source revision and composes dependency audit, protected native build,
public-profile installation, complete installed-layout inventory, verified data-preserving removal, and atomic staging.
Its closed handoff contains only the exact setup, inventory, and source-bound build evidence. The evidence binds their
digests to version, revision, storage schema, Authenticode certificate fingerprint, and the ordered public updater trust
identifiers embedded in the executable. It excludes all private authority and machine identity. Any unexpected file,
link, digest, certificate, channel, version, revision, or schema mismatch rejects the handoff without replacing an
existing directory.

## Increment M5.2 — Windows-native update recovery

**Outcome:** Windows installer termination cannot strand the library or remove recovery authority.

**Work:**

1. Implement ADR 0042's Windows package identity, predecessor image, filesystem durability, exclusive handle, process
   creation-time, canonical executable-path, process-control, installer, relaunch, and native-state validation adapters.
2. Prepare and authenticate the predecessor NSIS package, complete runnable directory, and matching library before
   invoking the candidate installer.
3. Launch the predecessor watchdog from the private recovery image and establish readiness before Windows causes the
   initiating application to exit.
4. Restore the current-user predecessor setup and matching library after installer failure, candidate rejection,
   timeout, interruption, or crash; retain the runnable predecessor and a non-terminal recovery result if native
   restoration cannot complete.
5. Resume after restart, reject reused process identifiers and changed paths, serialize concurrent actors, and remove
   assets only after exact terminal validation and acknowledgement.

**Acceptance evidence:** Windows unit and integration tests cover each native primitive and lifecycle transition;
release-shaped E2E proves successful replacement, installer failure, candidate failure, process interruption, offline
rollback, fallback launch, retry, restart resumption, data pairing, and cleanup.

## Increment M5.3 — Packaged capability parity

**Outcome:** the installed NSIS application provides the same accepted product experience on Windows 11.

**Work:**

1. Build and install the instrumented NSIS candidate, then drive its real WebView through WebdriverIO's embedded Tauri
   provider.
2. Run every critical synthetic journey enumerated by Milestone 4, including real Windows file selection, official-link
   opening, export persistence, chart and route range interaction, settings persistence, restart, and update notices.
3. Exercise `en-US` and `es-ES`, keyboard-only operation, Axe, focus, 100% and 200% zoom, system/light/dark appearance,
   compact and ordinary windows, long copy, and Windows display scaling.
4. Verify Windows date, time, number, unit, path, and file-dialog conventions without changing canonical semantics.
5. Assert responsiveness during reconciliation and repeated analytical selection through native pointer input.

**Acceptance evidence:** packaged Windows E2E passes without retries, disabled assertions, development servers, or
mocked business behavior. The exact Windows 11 candidate later repeats all platform-visible paths in a clean desktop.

## Increment M5.4 — Windows performance and reliability admission

**Outcome:** the Windows package satisfies the shared performance and data-safety budgets under Windows semantics.

**Work:**

1. Run release-shaped cold launch, import, reimport, dense history, Insights, chart, and report benchmarks.
2. Verify UI responsiveness during long reconciliation and update preparation.
3. Exercise NTFS permissions, file sharing, antivirus-like transient denial, locked files, disk-full behavior,
   interruption, corrupt inputs, corrupt library, migration, and concurrent instances.
4. Verify ACLs and private application-data placement, junction and reparse-point rejection, temporary cleanup, long
   paths, Unicode paths, and absence of personal or machine-local evidence.
5. Separate hosted Windows Server performance evidence from exact Windows 11 candidate evidence.

**Acceptance evidence:** all applicable budgets pass and every failure leaves a coherent installed application/library
pair or a retained runnable predecessor with explicit incomplete-recovery status.

## Increment M5.5 — Installation, operations, and documentation

**Outcome:** users and contributors can install, trust, update, recover, remove, debug, and support FitFreed on Windows
without private knowledge.

**Work:**

1. Add localized user guidance for setup verification, SmartScreen interpretation, current-user installation, first
   launch, updates, recovery, offline use, removal, and separate library deletion.
2. Document the supported Windows 11 lifecycle rule and the truthful behavior on Windows 10, ARM64, managed MSI, or
   per-machine environments.
3. Extend contributor setup, PowerShell-safe commands, packaging, E2E, performance, signing, release, incident,
   certificate rotation, withdrawal, and reproducibility guidance.
4. Generate the version-matched expanding macOS-plus-Linux-plus-Windows manifest, notes, checksums, signatures, SBOMs,
   provenance, known limitations, and support links from one release input.
5. Expose a Windows product-site download only after exact-candidate acceptance.

**Acceptance evidence:** documentation, PowerShell clean-room setup, localized content, installed help, artifact
reopening, and support-link checks pass for the exact candidate.

## Increment M5.6 — Exact candidate and promotion

**Outcome:** one immutable macOS-plus-Linux-plus-Windows expansion candidate is independently admitted and promoted
only after Linux publication.

**Work:**

1. Build the exact tagged target in each protected native environment with ephemeral platform and updater authority,
   then compose only their same-version, same-revision evidence and remove all authority.
2. Seal the candidate before independent evaluation and preserve exact bytes across promotion.
3. Run the complete matrix on a clean supported Windows 11 x86-64 desktop, including trust UI, installation, first
   launch, update, recovery, migration, removal, accessibility, localization, and product experience.
4. Attest and publish only the accepted complete expanding target set, atomically update versioned downloads and
   channel data, and verify every remote digest and endpoint.
5. Keep promotion blocked until the public Linux dependency is objectively satisfied.

**Acceptance evidence:** every Windows readiness row passes for one revision and the complete target-set digests;
setup, installed signatures, GitHub Release, product site, update channel, release notes, provenance, and documentation
all name and deliver that same candidate.

## Human intervention boundary

Engineering and hosted evidence proceed autonomously. Final acceptance requires accountable Authenticode signing
authority, protected release configuration, a clean supported Windows 11 x86-64 evidence environment, the bounded
product-owner usability verdict, explicit tag and publication authority, and the public Linux dependency. A hosted
Windows Server run or unsigned NSIS file cannot substitute for those gates.
