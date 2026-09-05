# Milestone 5 Execution Plan

## Status

In progress as of 2026-09-04, with independent portability engineering authorized by ADR 0039. Public promotion
remains ordered after the accepted public Linux MVP.

| Increment | Status | Current evidence boundary |
|---|---|---|
| M5.0 Native portability admission | In progress | The first hosted run exposed Git line-ending conversion in checksum-governed vendored source before native compilation. The next exact run passed that boundary and the portable Node.js entry points, then exposed CRLF conversion in domain source consumed by the data-contract validator. The changed tree pins every detected text file to LF while preserving binary bytes and retains locked Node.js package entry points without platform-specific npm shims. Local portability tests pass; acceptance awaits a successful immutable `windows-2025-x86_64-host-package` run for the exact revision. |
| M5.1 Windows package identity and trust | In progress | The closed unsigned NSIS source-build, dual-profile clean installation/removal and inventory, fail-closed Authenticode signer and inspector, synthetic authority-cleanup campaign, protected non-exportable public-authority lifecycle, authority-separated three-file Windows expansion input, digest-bound transport, version 7 three-platform release contract, authority-separated candidate composition, and independent complete-candidate reopening are implemented and locally verified. Native execution awaits the hosted lane; production authority and exact Windows 11 trust remain open. |
| M5.2 Windows-native update recovery | In progress | Native adapters derive current-user NSIS identity, invoke only recovery-owned silent installers, distinguish installer failure from an invalid resulting native identity, bind process control to creation time plus canonical executable path, preserve digest- and PE-identity-checked packages with a bounded complete runnable predecessor tree, and verify recovered critical files against that image. The closed version 3 state contract and Rust preparation atomically bind and reopen both packages, the runnable tree, matching library, manifest, lock files, and active authority. Serialized lifecycle mutation admits only legal transitions and binds `launching` to exact Windows process evidence; exclusive watchdog and candidate leases revalidate their distinct authorities, confirmation requires the exact leased target installation and library, restoration atomically recovers the verified source pair with a closed three-attempt failure policy, and terminal maintenance validates the complete pair before durable receipt and cleanup. A production-identity NSIS campaign now covers successful replacement, native installer failure, candidate rejection, restart resumption after an instrumented watchdog interruption, runnable fallback, offline retry, and terminal exhaustion; its contracts pass locally, while the native hosted run remains open. |
| M5.3 Packaged capability parity | In progress | The first hosted run reached fixture creation, then exposed direct execution of the extensionless Unix npm shim before NSIS construction. The changed tree invokes the locked Tauri and WebdriverIO JavaScript entry points through Node.js and records packaged benchmark evidence under the actual macOS, Linux, or Windows WebView runtime. The isolated identity, build/install/removal orchestration, process-restart evidence, and hosted lane remain locally contract-tested; native execution of the seven shared scenarios and the remaining Windows-visible paths remain open. |
| M5.4 Windows performance and reliability admission | In progress | The manual hosted performance workflow, production NSIS cold-launch lifecycle, portable Windows benchmark paths, native peak-memory measurement, isolated NTFS disk-exhaustion recovery, and version 2 private-library filesystem boundary are implemented and locally contract-tested. Native execution and exact Windows 11 evidence remain open. |
| M5.5 Installation, operations, and documentation | In progress | The version-matched inactive Windows user guide covers the complete user lifecycle. Native PowerShell contributor scopes and the maintainer runbook distinguish ordinary packaging, destructive isolated gates, protected Authenticode input, authority-free transport, version 7 composition, privacy-safe diagnostics, reproducibility, certificate rotation, and compromise. The application exposes offline `en-US` and `es-ES` Windows lifecycle help only on a Windows runtime. One protected Apple Silicon command now authenticates both native inputs and complete predecessor distributions before generating and independently reopening an exact manifest version 7 candidate. Candidate Pages derive their localized exact-platform installer links from manifest versions 3, 6, or 7 while the ordinary site remains inactive. Native packaged execution remains open. |
| M5.6 Exact candidate and promotion | In progress | The inactive manual Windows workflow, protected builder, complete-predecessor downloader, version 7 composition, exact Ubuntu and Windows 11 admission topology, distinct product-acceptance gate, independent promotion, immutable publication, and remote reconstruction are implemented and locally contract-tested. Production authorities and environments, disposable native runners, an immutable macOS-plus-Linux predecessor, exact candidate execution, human acceptance, and publication remain open. |

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

The protected public-authority lifecycle accepts one PFX and password only inside the x86-64 Windows install process,
verifies its independently configured SHA-256 fingerprint and code-signing purpose, imports it without exportable key
permission, discovers the x86-64 Windows SDK SignTool, and deletes the PFX immediately. It exposes only the five values
required by the authority-free adapter. Cleanup removes the exact current-user certificate and private key and clears
that process contract. Post-import validation failure cleans immediately; cleanup failure remains non-acceptable and
preserves only its private runner-local retry state. This closes authority orchestration, not the external production
certificate or exact supported-Windows-11 trust gate.

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

The first release-shaped Windows campaign builds instrumented 0.1.0 and 0.2.0 production-identity NSIS packages,
signs their exact updater bytes with an ephemeral authority, and serves one schema-valid `stable-v3` channel over
loopback HTTPS with an ephemeral local certificate authority. Each scenario requires a clean current-user production
identity on the disposable host, installs 0.1.0, and drives the installed WebView. The success scenario requires 0.2.0
confirmation; a signed candidate variant terminates from its NSIS preinstall hook and requires automatic restoration;
the candidate-rejection scenario requires the same restoration of the 0.1.0 package and library; and the restart
scenario terminates only the exact preserved watchdog after the candidate installer has durably reached
`replacement-installed`, then launches the installed application normally and requires startup reattachment to
finish the update. A test-only gate in the signed predecessor package is inert during initial installation and can
then deny only native recovery. The retry scenario requires the retained runnable predecessor, localized intervention,
and one successful explicit retry while update transport is unavailable. The exhaustion scenario denies all three
attempts and requires retained recovery evidence plus localized manual-reinstall guidance without another update or
retry action. Terminal scenarios require locale and library preservation, exact installed version, terminal cleanup,
localized outcome presentation, and acknowledgement. This production identity cannot safely run beside an existing
FitFreed installation, registration, shortcut, or application-data root, so preflight rejects rather than modifies
such state. Generated authority, packages, recovery files, and libraries remain transient; only privacy-safe failure
evidence is retained. The hosted native run is still pending, and this slice does not replace the exact Windows 11 gate.

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

The first implemented slice adds a read-only manual `windows-2025` performance workflow rather than repeating the
multi-gigabyte campaign for every revision. It builds the exact clean-revision production NSIS package, refuses any
pre-existing production identity or data, measures 100 fresh installed-application cold launches, always removes the
owned package and state, and then runs the shared import, exact and equivalent reimport, dense-history,
concurrent-navigation, Insights, report-resolution, and export read-model budgets. Benchmark executables resolve the
native `.exe` suffix, and Rust measures Windows peak working set instead of reporting unavailable memory. These
contracts pass locally. Fresh Windows launches use the current user's actual native known-folder roots: the fixed
package identity is revalidated and only its non-reparse roaming and local data roots are cleared before each timer
starts. It then verifies that the installed non-empty `%APPDATA%` library has the exact protected private directory and
file ACLs and no reparse descendants. The second slice creates a bounded 64 MiB NTFS VHD only on the elevated disposable runner, fills it through
actual Windows disk-full behavior, requires failed-import invisibility, restores capacity, exercises ordinary startup
recovery, verifies the retained history and SQLite integrity, and retries successfully. Cleanup always detaches the
exact VHD and removes only its validated temporary directory. The same native campaign rejects junction and symbolic
redirection without target mutation, rejects multiple hard links, repairs private ACLs without changing bytes, keeps
validation compatible with a concurrently open SQLite library, retries only bounded transient sharing denials, and
accepts long Unicode paths. Native execution and exact Windows 11 measurements remain open.

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

The first documentation slice adds the inactive version-matched Windows guide and indexes it from user and support
entry points without activating a download. Its automated contract rejects drift in the exact NSIS name, supported
Windows family, current-user mode, Authenticode verification, SmartScreen interpretation, offline dependency,
localized application behavior, local-data lifecycle, unsupported deployment modes, and private reporting boundary.
The second slice closes ordinary contributor and protected release-operator guidance without inventing a public
workflow: its contract rejects drift in native PowerShell execution, Authenticode authority separation, version 7
composition, reproducibility, rotation, compromise, and the inactive Windows-publication boundary. The third slice adds Windows-only installed help:
the browser-evidence adapter detects the runtime platform, Settings exposes no irrelevant category elsewhere, and the
bundled locale catalogs cover verification and SmartScreen, current-user setup, updates and recovery, offline use,
removal versus explicit library deletion, unsupported setups, and private support evidence. Unit and application tests
pass locally; the platform-conditional packaged E2E assertion still requires the native Windows lane. The fourth slice
adds the protected complete-platform preparation entry point. It rejects unsupported hosts, inactive or shared trust,
changed native inputs, certificate drift, and loose predecessor packages before composition. Matrix-declared Linux and
Windows recovery bytes enter only after the complete predecessor Release evidence reopens under manifest
version 6 or 7. Generation creates one exact ignored version directory, reopens it independently, and removes partial
output after failure; it does not grant publication authority. Public-site activation remains a separate later slice.
The fifth slice closes release-site integration without activating the current public site. Ordinary source and
product-only builds retain no download links. A sealed candidate instead derives the exact localized macOS, Linux, and
Windows installer surface from manifest version 3, 6, or 7, and candidate, distribution, and remote verifiers
reconstruct those bytes. The links become public only after the matching immutable GitHub Release exists and promotion
deploys the exact accepted Pages artifact.

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

The first M5.6 slice extended the shared authority-free boundaries. The generic verifier dispatches manifest version 7
to complete-platform candidate or distribution reopening; transport retains all three ordered targets; publication
derives every exact asset and the Windows workflow provenance identity; and remote acceptance downloads the current
macOS, Linux, and Windows packages plus every declared native recovery package before reconstructing Pages. Synthetic
end-to-end tests cover the full remote distribution.

The second M5.6 slice adds the manual-only, inactive Windows expansion workflow and its exact host-admission boundary.
Secret-free preflight verifies the immutable predecessor, independent trust, and all protected environments. A
protected disposable Windows 11 x86-64 builder seals the Authenticode-signed native input; the Apple Silicon composer
downloads and reopens every complete predecessor Release before creating manifest version 7. Separate Ubuntu and
secret-free Windows 11 jobs reopen the exact candidate. The native host must match the versioned reviewed edition,
display-version, build, architecture, and lifecycle policy. Exact-package trust, install, removal, and cold launch stay
separate from the source-matched instrumented capability campaign. A distinct protected product-experience verdict
precedes the independent publication approval.

The workflow, policy schema, static topology checks, predecessor downloader, and portable admission contracts pass
locally. Production Authenticode and release authority, repository-scoped disposable Windows 11 runners, the immutable
macOS-plus-Linux predecessor, exact native execution, bounded human product acceptance, tag creation, and publication
remain open external gates. No public Windows candidate or release exists.

## Human intervention boundary

Engineering and hosted evidence proceed autonomously. Final acceptance requires accountable Authenticode signing
authority, protected release configuration, a clean supported Windows 11 x86-64 evidence environment, the bounded
product-owner usability verdict, explicit tag and publication authority, and the public Linux dependency. A hosted
Windows Server run or unsigned NSIS file cannot substitute for those gates.
