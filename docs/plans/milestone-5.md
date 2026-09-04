# Milestone 5 Execution Plan

## Status

In progress as of 2026-09-04, with independent portability engineering authorized by ADR 0039. Public promotion
remains ordered after the accepted public Linux MVP.

| Increment | Status | Current evidence boundary |
|---|---|---|
| M5.0 Native portability admission | In progress | Portable commands and the pinned hosted job are implemented and locally verified; acceptance awaits a successful immutable `windows-2025-x86_64-host-package` run for the exact revision. |
| M5.1 Windows package identity and trust | In progress | The closed unsigned NSIS source-build, dual-profile clean installation/removal and inventory, fail-closed Authenticode signer and inspector, synthetic authority-cleanup campaign, authority-separated three-file Windows expansion input, digest-bound transport, version 7 three-platform release contract, authority-separated candidate composition, and independent complete-candidate reopening are implemented and locally verified. Native execution awaits the hosted lane; protected public authority and exact Windows 11 trust remain open. |
| M5.2 Windows-native update recovery | In progress | Native adapters derive current-user NSIS identity, invoke only recovery-owned silent installers, distinguish installer failure from an invalid resulting native identity, bind process control to creation time plus canonical executable path, preserve digest- and PE-identity-checked packages with a bounded complete runnable predecessor tree, and verify recovered critical files against that image. The closed version 3 state contract and Rust preparation atomically bind and reopen both packages, the runnable tree, matching library, manifest, lock files, and active authority. Serialized lifecycle mutation admits only legal transitions and binds `launching` to exact Windows process evidence; exclusive watchdog and candidate leases revalidate their distinct authorities, confirmation requires the exact leased target installation and library, restoration atomically recovers the verified source pair with a closed three-attempt failure policy, and terminal maintenance validates the complete pair before durable receipt and cleanup. The installation coordinator and Windows host now route fresh, resumed, candidate, retry, and terminal work through the preserved watchdog. Native Windows execution and all release-shaped end-to-end recovery evidence remain open. |
| M5.3 Packaged capability parity | In progress | The isolated instrumented NSIS identity, build/install/removal orchestration, native Windows process-restart evidence, and impact-aware hosted capability lane are implemented and locally contract-tested. Native execution of the seven shared packaged scenarios and the remaining Windows-visible paths remain open. |
| M5.4–M5.6 | Not started | Their reliability, documentation, candidate, human, and promotion gates remain open. |

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

The transport commands reopen that input before packing, admit only its three exact archive entries, and expose one
SHA-256 archive digest. Reopening validates the digest and archive layout before extraction, repeats every internal
identity and trust check in a temporary sibling directory, and promotes the result atomically. No signing or
publication authority enters either transport operation.

Release manifest version 7 closes the Windows expansion to the ordered macOS, Linux, and Windows targets and adds the
NSIS package, inventory, native build evidence, updater signature, and Authenticode trust statement to the complete
checksum and provenance set. Stable update staging derives the exact NSIS name from that same package contract and
rejects Windows unless both previously supported targets are present. Independent reopening verifies the complete
artifact, native evidence, Authenticode, updater, checksum, recovery, and Pages boundary. The compositor now admits
both sealed native inputs, signs the exact package bytes for updates, constructs the complete candidate, reopens it,
and promotes it atomically without receiving Authenticode authority.

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

The implemented preparation slice derives its roots from the validated current-user native identity, accepts only a
newer exact authorization with both NSIS package expectations, and creates one version 3 attempt behind the exclusive
outcome boundary. It preserves and reopens the authenticated package pair, complete runnable predecessor, and online
SQLite backup before publishing a no-clobber active pointer. Portable Rust tests reject changed authority before state
creation, clean an interrupted private staging attempt, preserve the first active attempt, detect package, runnable,
library, and manifest mutation, reject redirected filesystem objects, and prove that the verified active phase is
`prepared`. State-lock-serialized mutation rejects illegal phase changes and persists `launching` only when the PID,
creation `FILETIME`, canonical executable, nonce, and deadline describe the expected replacement. Changed process
evidence leaves the previous durable phase intact. A Windows-target source compilation covers the native no-sharing
and reparse-aware branches. Watchdog context resolution derives authority only from the preserved executable's exact
active layout. Exclusive watchdog and candidate leases then revalidate the attempt, while candidate authority also
requires the persisted PID, creation `FILETIME`, executable, nonce, and target native identity. The held-lock verifier
does not attempt an impossible second open of a Windows no-sharing handle. The hosted native lane remains the execution
authority for those operating-system APIs. Candidate confirmation additionally requires the held lease, active launch
nonce, target native identity, fixed library, running version, target schema, and SQLite integrity; rejection leaves
the durable phase at `launching`. Recovery restores the exact verified SQLite predecessor whether the destination is
present or absent, invokes only the preserved predecessor package, and enters `recovered` only after native source
identity and critical installed files match the runnable image. The two closed native failure reasons retain attempts
one and two for explicit retry and make attempt three terminal. Restart lookup derives its context from the active
attempt, exposes only the privacy-minimized intervention, and starts a retry only after proving watchdog availability.
A prepared attempt can be discarded only under every ownership boundary; replacement-started evidence cannot be
discarded. Terminal maintenance accepts only `confirmed` and `recovered`, revalidates the corresponding native
application/library pair, writes the platform-neutral receipt before removing active authority, and closes all Windows
no-sharing handles before exact attempt deletion. Candidate ownership defers cleanup, while a restart can resume only
the receipt-bound attempt after active-pointer removal. A watchdog transferred into maintenance remains exclusively
owned across a busy candidate or rejected terminal state and is consumed only after the durable terminal mutation
commits. The Windows installation coordinator now prepares the authenticated predecessor, candidate, runnable image,
and library before starting the preserved watchdog; it publishes `replacement-started` only after readiness and stops
and discards a still-quiescent attempt if that handoff fails. The watchdog binds the initiating installed process by
PID, creation `FILETIME`, and canonical executable before readiness. A fresh watchdog alone stops that process and
invokes the candidate NSIS package, while a resumed `replacement-started` watchdog recovers rather than rerunning an
installer with an uncertain result. It launches the validated installed candidate with an operating-system-random
nonce, records exact process evidence before releasing startup, observes confirmation or exit, restores or exposes the
runnable predecessor when required, and retains terminal ownership through receipt-bound cleanup. The desktop host now
routes Windows private startup, candidate leasing and confirmation, ordinary-startup reattachment, intervention,
explicit retry, native installation-target resolution, and terminal maintenance to that platform lifecycle. Portable
tests cover the handoff, restart decisions, nonce protocol, process identity, and failure ownership; an isolated
Windows-target source build covers the native adapter and coordinator branches. Native Windows execution and
release-shaped recovery evidence still remain before this is an admitted recoverable update path.

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

The first implemented parity slice builds an NSIS package whose `fitfreed-e2e` product, executable, current-user
installation, uninstall registration, application-data roots, and `org.fitfreed.desktop.e2e` identifier cannot replace
the production application. A bounded PowerShell adapter refuses pre-existing test state, verifies the silent
installation and executable identity, runs the same seven functional, restart, sport-catalogue, adaptive-session, and
performance scenarios against the installed executable, then requires silent package removal to preserve every
synthetic library before removing only the isolated test application data it created. Restart evidence uses `ps` on
macOS and Linux and an exact executable-path `Win32_Process` query on Windows; a process name or reused identifier is
not accepted. The separate read-only `windows-2025` capability job runs only when complete verification is required,
retains only privacy-safe failure diagnostics, and is required before the executable fingerprint can receive complete
reusable evidence. Local contract tests validate this topology; the hosted job has not yet supplied native execution
evidence, and this slice does not close Windows file-dialog, external-link, display-scaling, update, or exact Windows 11
acceptance.

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
