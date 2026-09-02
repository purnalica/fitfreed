# Milestone 4 Execution Plan

## Status

Active as of 2026-09-02. The frozen first-MVP capability baseline has macOS machine-admission evidence, while its human
acceptance and public-promotion gates remain open. ADR 0039 authorizes independent Linux parity engineering without
changing either macOS status or public promotion order.

## Objective

Deliver the unchanged first-MVP capability baseline on x86-64 Ubuntu Desktop 24.04 and 26.04 LTS through one native
Debian package with complete capability, installation, update, recovery, accessibility, localization, performance,
documentation, support, and release evidence.

The milestone is not complete when the Rust host merely compiles or Tauri emits a `.deb`. It is complete only when one
exact Linux candidate passes every automated and human gate and the already published macOS release permits Linux
promotion.

## Scope protection

This milestone ports the accepted product; it does not add user-facing capability. Defect, portability, native
integration, package, update, recovery, accessibility-parity, localization-parity, performance, and required
documentation work are in scope. Product API synchronization, MCP, additional providers, external cartography, new
reporting capability, and advanced personalization remain locked.

ADR 0040 fixes the initial boundary to Ubuntu Desktop 24.04 and 26.04 LTS on x86-64 through a Debian package. AppImage,
RPM, Flatpak, Snap, AUR, ARM64, and other distributions are not implicitly supported by a successful compile.

## Stable inputs and independent gates

- The accepted product behavior is the source, application, domain, presentation, and data-contract baseline inherited
  from Milestones 1 and 2 plus the completed X7 corrective increments.
- macOS machine admission does not prove Linux parity and an open macOS human gate does not block Linux engineering.
- Linux public promotion remains blocked until the public macOS release exists and the exact Linux candidate passes
  its own gate.
- Signing authority, exact candidate creation, clean Ubuntu 26.04 access, and public publication are human or protected
  environment gates. Ordinary engineering continues without them.

## Execution ledger

| Increment | State | Current evidence or next gate |
|---|---|---|
| M4.0 | Complete | Hosted Ubuntu portability, source compilation, shared tests, input classification, and bounded failure evidence are versioned and enforced. |
| M4.1 | Engineering complete; candidate gate pending | The Debian identity, exact inventory, clean Ubuntu 24.04 installation, signed public candidate, release manifest, and multiplatform Pages evidence are verified. Exact graphical-candidate evidence and production signing authority remain later gates rather than repository material. |
| M4.2 | Active | Linux recovery version 2, stable channel version 3, upgrade matrix version 2, recoverable Linux manifest version 5, exact predecessor discovery, Rust authorization, public build mapping, atomic staging, complete candidate/Pages verification, native package identity and rollback commands, full `/proc` process identity, bounded authenticated predecessor transfer, exact package preservation, bounded Debian extraction, and deterministic runnable-image verification exist. Manifest-bound handoff and lifecycle integration are next. |
| M4.3–M4.6 | Pending | Begin only through their ordered technical dependencies; protected signing, clean Ubuntu 26.04, human acceptance, and promotion remain explicit gates. |

## Increment M4.0 — Native portability admission

**Outcome:** ordinary CI detects Linux host regressions before packaging work can hide them.

**Work:**

1. Add a pinned Ubuntu 24.04 job that installs the documented Tauri prerequisites.
2. Compile, test, format-check, and lint the complete Rust workspace and desktop host, including all targets and
   features that are meaningful on Linux.
3. Test the production frontend, architecture, data contracts, localization, documentation, dependency policy, and
   production bundle inputs through the same versioned commands used locally.
4. Make E2E executable resolution and temporary paths platform-aware; retain rejection of a production executable in
   instrumented tests.
5. Record only privacy-safe failure evidence and keep CI impact classification keyed by the exact platform inputs so
   unchanged executable inputs reuse prior complete evidence.

**Acceptance evidence:** full desktop compilation and tests pass on `ubuntu-24.04`; workflow contract tests prove that
documentation-only changes do not repeat the native campaign while any Linux executable input invalidates its cached
evidence.

## Increment M4.1 — Linux package identity and trust

**Outcome:** one release-shaped Debian package has a closed identity, installed layout, dependency set, and public trust
contract.

**Work:**

1. Configure Tauri for the `deb` target only in the Linux release profile and generate x86-64 metadata, icons, desktop
   entry, MIME behavior where applicable, copyright, and GPL license material.
2. Inspect declared runtime dependencies and verify installation from a clean Ubuntu 24.04 Desktop image without a
   compiler, Node.js, Rust, or project checkout.
3. Extend release manifests, inventories, checksums, SBOMs, provenance subjects, and bundle-content policy with a
   closed `linux-x86_64-deb` artifact kind.
4. Add detached FitFreed release signing for the public Debian artifact while retaining the independent mandatory
   updater signature and signed update envelope.
5. Fail closed when a release mixes a package, target, architecture, version, signature, or installed identity.

**Acceptance evidence:** schema and automation tests reject cross-platform or incomplete candidates; the package
installs graphically and its installed files, application identity, license, dependencies, version, and removal entry
match the release manifest.

## Increment M4.2 — Platform-native update recovery

**Outcome:** an Ubuntu update cannot begin without an authenticated, runnable, and natively reinstallable predecessor.

**Work:**

1. Introduce the next update-recovery schema and documentation rather than reinterpreting macOS version 1.
2. Extend signed channel metadata with exact recovery artifacts for every declared Linux application baseline.
3. Extract shared lifecycle policy from macOS layout mechanics and implement Linux installation, package, runtime-image,
   durability, lock, process-identity, process-control, and launch adapters under ADR 0042.
4. Preserve and verify the predecessor Debian package, runnable predecessor, and matching library before replacement.
5. Restore the old package and library after installation failure, rejected startup, timeout, interruption, or crash;
   keep the runnable predecessor and recovery evidence when operating-system authorization prevents terminal rollback.
6. Resume recovery after restart, prohibit concurrent updates, and clean only a fully validated terminal attempt after
   explicit acknowledgement.

**Acceptance evidence:** unit and integration suites cover every transition and platform primitive; package-shaped E2E
proves success, native installer failure, candidate failure, offline restoration, authorization-unavailable fallback,
retry, data preservation, cleanup, and restart resumption.

## Increment M4.3 — Packaged capability parity

**Outcome:** the real Debian-installed application provides the same accepted product experience as the admitted macOS
baseline.

**Work:**

1. Build the instrumented Debian package and run WebdriverIO through the embedded provider under Xvfb.
2. Exercise every critical journey with synthetic data: first run, provider guidance and official links, ZIP selection,
   validation, import, cancellation, reimport, live reconciliation navigation, restart, sport recognition and
   correlation, History, planned training, maps and range interaction, analytical charts, reports, export, settings,
   update notices, and removal boundaries.
3. Run `en-US` and `es-ES`, keyboard-only operation, Axe, focus restoration, 100% and 200% zoom, light and dark
   appearance, compact and ordinary window sizes, and long translated copy.
4. Protect the signal-range regression by driving repeated pointer selection and adjustment against a dense chart;
   assert continued responsiveness and bounded rendering rather than only final DOM presence.
5. Verify official URLs open through the Linux desktop boundary and that all exported files persist and reopen.

**Acceptance evidence:** packaged Linux E2E passes without retries, disabled assertions, mocked business behavior, or a
development server. Every operating-system adapter replacement remains limited to otherwise undriveable selection or
destination boundaries and verifies its exact invocation contract.

## Increment M4.4 — Linux performance and reliability admission

**Outcome:** the Linux package meets the same product budgets and data-safety invariants.

**Work:**

1. Run cold launch, representative import, exact and equivalent reimport, dense history, Insights, chart interaction,
   and report export benchmarks from release-shaped binaries.
2. Prove long reconciliation leaves navigation and settings responsive within their budgets.
3. Run SQLite migration, interruption, disk-full, permissions, corrupt-input, corrupt-library, and concurrent-instance
   boundaries through Linux filesystem semantics.
4. Verify local data permissions, directory synchronization behavior, symbolic-link rejection, temporary cleanup, and
   no personal or machine-local values in artifacts or diagnostics.
5. Establish measured Ubuntu 24.04 baselines; run the release candidate on Ubuntu 26.04 before making that support claim.

**Acceptance evidence:** all applicable `quality-targets.md` budgets pass on the recorded environment and every safety
scenario leaves an exact supported state.

## Increment M4.5 — Installation, operations, and documentation

**Outcome:** users and contributors can install, understand, update, recover, remove, debug, and support the Linux
release without private project knowledge.

**Work:**

1. Add localized user guidance for Debian download verification, graphical installation, first launch, update
   authorization, recovery, offline behavior, removal, and explicit library retention or deletion.
2. Document the exact Ubuntu support boundary and truthful behavior on an unsupported distribution.
3. Extend contributor setup, packaging, E2E, performance, release, incident, withdrawal, and reproducibility guidance.
4. Generate version-matched release notes, checksums, detached signatures, SBOMs, provenance, known limitations, and
   support links from one release input.
5. Update the product site from the same support matrix only after candidate acceptance; no generic Linux download
   appears early.

**Acceptance evidence:** documentation checks, clean-room contributor commands, localized content checks, artifact
reopening, and support-link tests pass for the exact candidate.

## Increment M4.6 — Exact candidate and promotion

**Outcome:** one immutable Linux candidate is independently admitted and, only after macOS publication, promoted.

**Work:**

1. Build the exact tagged candidate on the protected Ubuntu 24.04 environment with ephemeral release authority.
2. Seal it before independent evaluation; never rebuild accepted bytes during promotion.
3. Run clean Ubuntu Desktop 24.04 and 26.04 installation, update, recovery, removal, accessibility, localization, and
   product-experience evaluation.
4. Attest and publish only the accepted bytes, atomically add versioned download and update metadata, and verify remote
   bytes and direct endpoints.
5. Keep Linux promotion blocked until the macOS public-release dependency is objectively satisfied.

**Acceptance evidence:** every row in the Linux readiness ledger passes for one revision and artifact digest; the
public download, update channel, GitHub Release, Pages links, signatures, provenance, and documentation converge on
those exact bytes.

## Human intervention boundary

Engineering and hosted evidence proceed autonomously. Final acceptance alone requires accountable release-signing
authority, a protected publication environment, a clean Ubuntu 26.04 Desktop evidence environment if no stable hosted
equivalent exists, the bounded product-owner usability verdict, explicit tag and publication authority, and the public
macOS dependency. None may be replaced by an unsigned, untested, or merely compilable package.
