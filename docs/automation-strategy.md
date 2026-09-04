# Automation Strategy

## Purpose

Automation reduces contributor friction, prevents undocumented maintainer knowledge, makes quality gates reproducible, and supports frequent reliable releases. Repeatable processes should become versioned, reviewable automation unless human judgment or authority is essential.

## Principles

- Automate repeatable execution and objective verification; do not automate away product judgment or accountability.
- Expose a small set of discoverable project commands that work locally and in continuous integration.
- Prefer idempotent workflows that can be safely rerun after interruption.
- Keep automation behavior in version control and review it like production code.
- Produce actionable failures and machine-readable outputs where downstream tooling benefits.
- Keep credentials and signing authority outside repository content and untrusted execution contexts.
- Test automation on every environment where contributors or release jobs are expected to use it.

## Automation scope

### Developer workflow

- Prerequisite and environment checks.
- Initial project setup and synthetic sample generation.
- Build, run, format, lint, static analysis, architecture validation, and tests.
- Database creation, migration, reset of synthetic development state, and compatibility checks.
- Documentation preview, link validation, localization validation, and accessibility checks.
- Focused fast-loop commands and comprehensive pre-integration commands.

### Continuous integration

GitHub Actions is the selected continuous-integration provider for the GitHub-hosted repository. The product workflow
combines platform-independent checks with mandatory platform-native desktop compilation and packaged evidence for
every platform whose parity admission increment has entered the baseline. macOS has the complete packaged campaign.
Ubuntu 24.04 owns separate package-shaped capability and native-update campaigns. The pinned `windows-2025` lane admits
the x86-64 MSVC desktop host and unsigned NSIS installation boundary through the same versioned project commands
rather than parallel CI-only test paths. The same lane exercises the Authenticode signer and trust inspector with a
short-lived synthetic authority and proves complete cleanup; the separate Windows update, packaged capability, and
manual performance campaigns exercise their admitted Milestone 5 boundaries.

Hosted verification is impact-aware. Every revision runs the versioned impact classifier, documentation links, and independent repository-safety gate. README, product-status, static product-page, and the closed set of publication-only compositor, verifier, test, and Pages-workflow changes additionally install the locked JavaScript toolchain; verify SSOT rendering, local resources, release-state honesty, automated accessibility, compositor and update-subtree preservation, workflow topology, and publication tests; and build and preflight the Pages artifact without rebuilding or repackaging unchanged application inputs. The closed documentation-verification set similarly runs its focused tests and workflow lint without entering a native package lane; those files are excluded from the application fingerprint because they cannot enter the application or release artifact. The impact classifier, its tests, and the CI workflow remain release-affecting control-plane inputs and therefore require the portable lane, Windows host lane, complete macOS lane, Linux capability lane, and Linux native-update lane whenever they change. Application, shared dependency, updater-client, release-candidate, or unknown changes run all five lanes, as does every explicit release-candidate or manual verification request. Within the macOS lane, the production package and cold-launch gate precede the long synthetic import and Insights campaigns so a startup failure stops expensive downstream work early; every gate still runs after that check passes. Both Linux package-shaped lanes start only after the portable lane succeeds. A non-application revision may reuse prior evidence only when its Git-tree fingerprint for every executable and release input has an immutable evidence marker written after all admitted complete lanes succeeded. A missing marker, an unknown path, an unavailable comparison, or a newly introduced path fails closed by requiring every admitted complete lane. Evidence-only documentation commits must not recursively rebuild an unchanged application merely to record the preceding successful run.

Pre-purge hosted proof on 2026-08-17 established both sides of the then-current impact-aware path: a release-affecting revision passed the complete portable and macOS lanes and recorded its executable-input fingerprint, then a documentation-only revision restored that marker, reported `verified-inputs-unchanged`, ran documentation links, and skipped every other portable step plus the complete macOS job. Both revisions independently passed repository safety. Their obsolete run records are not retained after privacy history cleanup. Current hosted evidence must re-establish the behavior across every admitted lane without weakening a product gate.

The Windows host job restores only a closed `windows-host.json` marker whose schema, lane
`windows-2025-x86_64-host-package`, and executable-input fingerprint match the current revision. Reused evidence still enters
the shared fail-closed impact resolver; otherwise the job installs locked dependencies and runs environment diagnosis,
architecture and product contracts, presentation tests and build, Windows-portable automation tests, Rust formatting,
workspace and pinned-updater tests, strict Clippy, and the release-shaped unsigned NSIS build. It installs the setup for
the current user, verifies native identity and removal, proves separately located application data was preserved, and
then signs and verifies a temporary executable copy with a freshly generated non-exportable current-user certificate.
Success requires removal of that certificate, private key, trust entries, environment values, and temporary bytes.
Only that complete success writes the marker. The hosted Windows Server result proves native compilation, automation
portability, engineering package behavior, and Authenticode orchestration; it does not replace timestamped public
signatures, signed Windows 11 exact-candidate evidence, or human evidence.

- Change-scope detection without skipping required dependency checks.
- Unit, integration, E2E, migration, performance, packaging, and platform matrices.
- Code quality, dependency-boundary, security, license, secret, and supply-chain checks.
- Documentation, links, examples, translation catalogs, placeholders, and locale coverage.
- Reproducibility, artifact integrity, software bill of materials, and provenance generation.
- Retention of diagnostic evidence that contains no personal data or secrets.

### Release and distribution

- Version derivation from an explicit reviewed release input.
- Change-log and release-note assembly from required versioned, reviewed inputs.
- Clean release builds and platform-specific packaging.
- Signing and notarization through protected jobs with narrowly scoped credentials.
- Installer, first-run, update, migration, rollback, and removal verification.
- Checksums, signatures, update manifests, software bills of materials, and provenance publication.
- Draft release creation and staged artifact promotion.
- Post-publication verification of downloads and update discovery.

Public release remains an explicit authorized action even when every preparation and verification step is automated.

Unsigned macOS MVP alpha artifacts remain in restricted evaluation workflows. Public macOS release automation must use protected Developer ID credentials, complete notarization, verify the stapled ticket and Gatekeeper result, and refuse promotion when any trust check fails. Linux release automation must bind the exact Debian artifact to checksums, detached release signing, updater signing, SBOM, provenance, installation, recovery, and both supported Ubuntu environments. Windows release automation must additionally use protected Authenticode authority and inspect the signed setup and installed binaries on a supported Windows 11 desktop. Public promotion remains serial even while those engineering lanes advance independently.

Linux package automation uses `npm run package:linux`, which refuses non-Linux hosts and invokes the shared
source-bound production wrapper for only Tauri's `deb` target. Platform metadata remains in
`src-tauri/tauri.linux.conf.json`; hosted jobs and local contributors must use this command rather than reproducing its
arguments or package metadata independently. The overlay supplies the technical `fitfreed` product identity and a
reviewed desktop template with the visible `FitFreed` name. After the source-bound build succeeds, the wrapper admits
only the exact version-derived Tauri output and changes its filename to `FitFreed_<version>_amd64.deb` without changing
the package bytes.

`npm run package:linux-public-candidate` applies the same closed Debian boundary plus the public updater overlay. It
requires active recoverable `stable-v3` public-update configuration and external updater signing authority before
invoking the source-bound build. It then changes the package and updater-signature filenames as one recoverable pair,
without changing either file's contents, so ordinary unsigned package work cannot be mistaken for a public candidate.

`npm run package:linux-expansion-input` is the secret-free build path used by the first complete-platform workflow. It
requires the same active recoverable `stable-v3` public configuration and passes only its endpoint and public trust into
the source-bound Debian build. It does not accept or inspect updater private-key or password inputs and does not ask
Tauri to generate a signature. The protected composer adds that signature later to the exact digest-bound package, so
the executable is update-capable without exposing private authority to the native Linux job.

`npm run check:public-release-signing-config` validates the separate platform-neutral release-checksum trust set on
every complete quality run. Its canonical inactive state admits no key; activation remains an accountable human gate.
The private checksum authority is distinct from updater signing and enters only the protected platform-expansion
composition job.

`npm run verify:linux-public-release -- <candidate-directory>` independently reopens the recoverable manifest version
5 Linux release and Pages snapshots. It cryptographically authenticates the checksum inventory, stable metadata, the Debian updater
package, and the retained macOS updater package; binds manifest, inventory, upgrade, and provenance subjects; and
rejects any extra, absent, cross-version, cross-target, or byte-divergent artifact.

`npm run verify:linux-candidate-installation -- <install|remove> <candidate-directory> <version> <ubuntu-version>` is
the privileged hosted-candidate boundary for the complete manifest version 6 set. It accepts only x86-64 Ubuntu 24.04
or 26.04 matching the declared matrix row, a clean exact source revision, and the Debian artifact returned by the
generic complete-candidate verifier. The install phase verifies package-manager identity, installed executable,
desktop entry, icons, GPL text, dynamic linking, graphical first launch, and one private integral library. The remove
phase verifies the manifest-declared library schema, purge, and retention of that same library. It changes native
package state and is not a routine local contributor command.

`npm run inventory:linux-package` selects that one version-derived artifact, reads its complete Debian control record,
extracts it privately, and atomically writes the schema-validated adjacent inventory. Its deterministic entries cover
every installed path, permission mode, file digest, and non-escaping symbolic-link target. CI generates this evidence
from the package it has just inspected; an inventory from another build is not reusable.

`npm run verify:linux-installation` owns the repeatable clean Ubuntu 24.04 package-manager check. It admits only an
x86-64 Linux host and the exact version-derived Debian name, passes only that file into a digest-pinned container,
reports a bounded privacy-safe failure phase, and verifies installation, dynamic dependencies, package identity, and
purge. Updating the pinned image digest is a reviewed dependency change and must preserve the declared distribution
and architecture inside the container.

`npm run verify:linux-update-e2e` runs only on x86-64 Linux. Its project entry point first generates the versioned
application icons required by Tauri, so the campaign remains executable from a clean clone. It then builds signed
instrumented 0.1.0 and 0.2.0 Debian packages, installs the predecessor, serves a signed recoverable `stable-v3`
channel over loopback HTTPS, and drives the real `pkexec` and `dpkg` replacement boundary under Xvfb. Each Tauri build
first emits the technical `fitfreed_<version>_amd64.deb` name and then passes those exact bytes through the same
closed normalizer as the production build before the canonical `FitFreed_<version>_amd64.deb` artifact is signed and
served. The harness moves each normalized package into its closed scenario package store before reusing the Cargo
target for another version, so the bundle directory cannot mix candidate and predecessor outputs and the retained
bytes remain unchanged. Temporary Polkit rules grant only the current test user
permission to install exact candidate or predecessor packages retained below one isolated recovery root; cleanup
removes the rule and package after every scenario. The campaign covers successful replacement, automatic native
rollback after candidate rejection or a real Debian pre-installation failure, and recovery when predecessor
authorization is initially unavailable. That last scenario first permits only candidate installation, verifies the
runnable fallback and visible first-attempt intervention, then grants the predecessor boundary and activates the real
retry action. The loopback transport remains unavailable from that grant through the terminal recovery outcome and
must receive no request; an explicit completion handshake restores it before the separate application restart that
verifies the retained user notice and may perform ordinary update discovery. A separate authorization-exhaustion
scenario preserves the denial through three real package-manager attempts and verifies the final manual-reinstall
state, retained library, and retained evidence. The restart scenario
uses an E2E-only synchronization point after durable `replacement-started`, terminates both live actors, and launches
the installed application normally so production startup reattachment must finish recovery. Completed terminal paths
check database integrity, locale persistence, package identity, terminal cleanup, localized result presentation, and
explicit acknowledgement; the deliberately unresolved exhaustion path instead requires active evidence retention.
Only privacy-safe synthetic diagnostics and the closed result are eligible for short-lived failure retention;
packages, libraries, recovery identifiers, signing keys, and recovery paths remain transient.

`npm run verify:linux-e2e` runs the complete capability campaign against a Debian-installed application rather than a
loose build-tree executable. Its `fitfreed-e2e` package, `/usr/bin/fitfreed-e2e` executable, and
`org.fitfreed.desktop.e2e` application identity are all distinct from the production package. The command refuses to
replace an existing test package or executable, verifies the generated control metadata and executable entry, installs
the package, drives every shared functional and performance scenario under Xvfb, purges only that isolated package,
and proves that package removal did not delete the synthetic libraries. Successful runs remove their generated
libraries; failed local runs preserve synthetic diagnostic state outside the upload path, while CI uploads only the
privacy-safe WebdriverIO diagnostics eligible for short-lived retention.

`npm run verify:windows-e2e` provides the equivalent installed-package boundary on native x86-64 Windows. It generates
the shared fixtures, builds the isolated `fitfreed-e2e` current-user NSIS package, refuses pre-existing test package or
application-data state, silently installs and verifies that exact identity, and drives all seven shared scenarios
against the installed executable. Its process-restart evidence queries the exact executable path through native
Windows process metadata. Silent removal must leave every synthetic library intact; only then does the harness remove
the exact isolated application-data roots and successful run state. The command neither installs nor replaces the
production `FitFreed` package and provides no public-signing or Windows 11 desktop evidence.

`npm run verify:windows-update-e2e` is the separate native x86-64 Windows update-recovery boundary. It builds
instrumented 0.1.0 and 0.2.0 NSIS packages with the canonical production identity, creates ephemeral updater and local
TLS authority, and serves signed `stable-v3` metadata only over loopback HTTPS. It runs successful replacement,
native installer failure, candidate rejection with automatic predecessor restoration, and ordinary-startup resumption
after an exact post-install watchdog interruption. It also drives retained runnable-predecessor fallback, offline retry,
and terminal exhaustion through a recovery-time-only NSIS gate. Each scenario starts only after production
installation, registration, shortcut, and application-data preflight proves the disposable user has no existing
FitFreed state. Cleanup is then limited to the exact package identity and the application-data roots created by that
scenario, after rejecting reparse points.
The command is therefore CI-oriented and must not run on a contributor account that contains a real FitFreed library.
Its synthetic signing authority is not Authenticode authority, and hosted Windows Server evidence does not satisfy the
exact Windows 11 candidate gate.

`.github/workflows/linux-performance.yml` is the explicit Ubuntu 24.04 data-performance admission boundary. It has
read-only repository permission, accepts only a manual dispatch, and never runs from a push, pull request, or
schedule. This prevents an unchanged multi-gigabyte campaign from consuming hosted capacity again merely because
time passed or unrelated documentation changed. The autonomous delivery flow dispatches it for an exact revision
when Linux performance inputs or the release candidate change. It builds, verifies, installs, and always purges the
source-bound production Debian package; measures 100 fresh application processes under Xvfb through the same
`benchmark:cold-launch` command as macOS; then runs the same `benchmark:import`, `benchmark:dense-history`, and
`benchmark:insights` commands used locally. It retains no package or generated library and relies on the job result
and privacy-safe machine-readable log as environment-qualified evidence.

The same workflow runs `npm run verify:linux-filesystem-reliability` after purging the measured production package.
The command mounts an isolated 32 MiB `tmpfs` with `nodev`, `nosuid`, and `noexec`, admits it only through a private
sentinel and bounded-capacity check, fills that filesystem to a real `ENOSPC`, and executes only the exact ignored
release-mode recovery test. Its unconditional trap unmounts the filesystem. It never redirects a normal user library,
weakens SQLite durability, or treats an injected adapter error as Linux filesystem evidence.

`.github/workflows/windows-performance.yml` is the corresponding explicit Windows Server 2025 engineering admission.
It is read-only, manual-dispatch only, secret-free, and concurrency-cancelled, so unrelated revisions or elapsed time
cannot repeat the multi-gigabyte campaign. It builds the source-bound production NSIS package and invokes
`npm run verify:windows-cold-launch`, whose fixed-identity boundary refuses all pre-existing production package and
application state, installs the exact setup, and measures 100 processes after revalidating the package identity and
removing only the non-reparse `org.fitfreed.desktop` roots returned by the current user's native Windows known-folder
APIs before every process. That reset occurs before measurement begins. A finalizer removes the owned package and
data. After the installed launch, it verifies that the non-empty production library resides under the exact native
`%APPDATA%` root with no reparse descendants and the protected current-user, LocalSystem, and Builtin Administrators
ACL defined by the version 2 filesystem contract. The same workflow creates an isolated 64 MiB NTFS VHD on its
elevated disposable runner, admits only the expected filesystem and capacity, drives the exact release-mode SQLite
recovery test through real disk exhaustion, and exercises a real NTFS junction plus the native long-Unicode-path,
hard-link, and transient-sharing-denial matrix. It unconditionally detaches and removes the VHD before continuing.
The workflow then runs the unchanged full-scale
import, dense-history, and Insights
commands. Rust benchmark executables use the native `.exe` suffix and obtain peak resident memory from the Windows
process peak working set. A successful hosted run is Windows Server environment-qualified evidence, not the clean
supported Windows 11 exact-candidate result.

`.github/workflows/public-linux-expansion.yml` is the manual complete-platform publication boundary. Secret-free
preflight requires the immutable public macOS predecessor and active `stable-v3` updater and neutral checksum trust.
Ubuntu 24.04 embeds that public update trust, then builds, inventories, clean-installs, removes, and seals the exact
unsigned Debian input with no private signing material or protected environment. The first protected macOS job verifies
that transport digest and source/schema identity before installing
ephemeral Apple, updater, and checksum authority; it creates and seals one same-version macOS-plus-Linux candidate.
Before the second approval, a secret-free x86-64 matrix on `ubuntu-24.04` and `ubuntu-26.04` verifies the sealed
transport digest and complete manifest version 6 candidate, installs and graphically launches the exact
manifest-declared Debian package under Xvfb, verifies native package identity, dynamic linking, private-library
creation, and the production cold-launch budget, then purges package-owned files while retaining the integral private
library. An unconditional finalizer removes residual package state after a failed admission. The second protected job
depends on both matrix rows, has no signing credentials, reopens only those exact bytes, attests the manifest-derived
checksum subjects, checksum inventory, and detached checksum signature, publishes the immutable Release, and supplies the exact complete Pages snapshot. Remote verification derives
the expected provenance workflow and direct download set from the immutable manifest version, so the initial macOS
and later expansion workflows cannot authenticate one another accidentally.

### Maintenance and community

- Dependency-update proposals with compatibility and quality checks.
- Vulnerability, license, stale-documentation, broken-link, and unsupported-schema monitoring.
- Issue and pull-request templates, labeling assistance, and required-check reporting.
- Translation synchronization and validation with the selected collaborative platform.
- Scheduled verification of installation and update paths against supported platform versions.
- Git author configuration validation and private-email scanning for commit history, tags, trailers, package metadata, documentation, generated artifacts, and release inputs.
- Complete outgoing-range checks rather than relying only on GitHub's protection for the most recent pushed commit.

Automation may assist triage but will not close contributor reports or make product-scope decisions without accountable review.

## Command design

The selected technology stack will define the concrete command runner. Regardless of tooling, the project will provide documented entry points for at least:

- Setup.
- Fast verification.
- Full verification.
- Run with synthetic data.
- Generate and validate fixtures.
- Build release-shaped packages.
- Verify installation and update journeys.
- Prepare a release draft.

Commands will compose smaller versioned tasks, return meaningful exit codes, avoid hidden global state, and identify generated outputs.

`npm run build:windows-host` is the portable all-target, all-feature desktop-host build. Rust formatting, strict Clippy,
workspace tests, the pinned-updater test, and complete host builds use a Node.js process wrapper so environment
variables and executable paths retain the same semantics on PowerShell and POSIX hosts.

`npm run package:windows` is the x86-64 Windows-only production-package entry point. It validates the closed Windows
overlay before allowing Tauri to build only NSIS, and accepts only a diagnostic verbosity flag from callers. The
ordinary command intentionally has no Authenticode authority and cannot produce public-candidate evidence.

`npm run verify:windows-installation` admits exactly one version-derived NSIS setup on a clean x86-64 Windows host. It
refuses an existing FitFreed installation, registration, or application-data directory before making any change. The
native adapter verifies the current-user location, package-manager identity, executable metadata, canonical shortcuts,
WebView2 availability, and the deliberately unsigned engineering boundary. It invokes the real uninstaller and
requires package-owned files, registration, and shortcuts to disappear while canonical application data remains
unchanged. Output is a closed path-tokenized record; failures expose only a bounded phase and cleanup status.

`npm run inventory:windows-package` performs that native cycle once and writes
`FitFreed_<version>_x64-setup.exe.inventory.json` beside the exact setup only after installation, identity, complete
installed-file hashing, removal, application-data preservation, schema, and privacy checks pass. The hosted Windows
lane uses this composed command instead of separately repeating installation verification. The direct verification
command remains available for focused diagnosis. Neither command grants public Authenticode trust.

`npm run verify:windows-authenticode-smoke` runs only on x86-64 Windows after the unsigned release executable exists.
It discovers the x86-64 Windows SDK SignTool, creates a short-lived non-exportable self-signed code-signing certificate,
trusts it in the disposable current-user stores, signs a temporary executable copy through the production signing
adapter, and performs full independent trust, architecture, identity, version, and digest inspection. A `finally`
boundary removes the personal certificate and private key, Root and TrustedPublisher copies, protected process values,
and temporary directory after success or failure. The command emits only a closed Boolean result and cannot represent
public trust because the synthetic profile forbids timestamp authority.

The authority-free `tauri.windows.public-signing.conf.json` overlay contains only `node`, the reviewed adapter path,
and Tauri's `%1` target placeholder. A protected public build must explicitly select that overlay and supply
`FITFREED_WINDOWS_AUTHENTICODE_PROFILE=public`, an absolute Windows SDK SignTool path, the selected certificate's SHA-1
store thumbprint, the independently established lowercase SHA-256 certificate fingerprint, and a credential-free HTTPS
RFC 3161 endpoint. The adapter never accepts these values as command-line arguments, never prints native output, and
immediately invokes the independent trust inspector. The ordinary package command never selects this overlay.

`npm run package:windows-expansion-input` is the only build entry point that selects the Authenticode overlay while
embedding active recoverable `stable-v3` public update trust. It rejects updater private-key authority so the
Authenticode builder and later complete-platform updater signer remain separate. Before deleting stale NSIS output it
requires the public timestamped Authenticode profile. After the build it admits only the exact setup and independently
verifies its final digest and identity. The public installation profile repeats independent inspection over the setup,
installed executable, and uninstaller while their exact files exist, cross-checks the trust digests against
package-inventory digests, then proves removal without removing application data. The compositor later signs the
sealed setup bytes for the updater and binds that signature to stable metadata and provenance. These commands establish
a fail-closed release boundary; only a protected native run can produce its evidence.

`npm run prepare:windows-expansion-input -- <version> <directory>` composes the dependency audit, clean source
identity, protected package build, public-profile native installation and removal, complete inventory, and atomic
three-file staging boundary. Its build evidence binds the exact setup and inventory digests to the source revision,
storage schema, admitted Authenticode certificate fingerprint, and source-controlled public updater trust identifiers.
The staging verifier rejects extra or multiply linked files, artifact or identity drift, a different certificate, and
channel-trust drift. Protected Authenticode process values and machine paths never enter the retained evidence; updater
and publication authority remain absent.

The paired `pack:windows-expansion-input` and `unpack:windows-expansion-input` commands carry only that closed input
between protected jobs. Packing admits only GNU tar or bsdtar, uses that implementation's explicit neutral-ownership
arguments, verifies the source input and archive entry set before atomically exposing the archive
and its SHA-256 digest. Reopening authenticates the transport digest before extraction, validates native line endings
without weakening entry identity, extracts into a private sibling directory, repeats the complete input verification,
and promotes it atomically. An existing destination, partial archive, path escape, duplicated or additional entry,
certificate mismatch, or any internal evidence drift fails closed and removes temporary output.

The complete-platform manifest version 7 generator and validator own the exact macOS, Linux, and Windows target set,
Windows Authenticode declaration, version-derived NSIS names, target-specific updater signature, checksum subjects,
and provenance subjects. Stable-channel staging resolves the NSIS setup through the same package contract and admits
Windows only after the macOS and Linux targets are both present. Manifest validation cannot sign, publish, or satisfy
the independent Windows 11 candidate gate.

The version 7 candidate verifier reuses the established platform-expansion reopening kernel without reinterpreting
the immutable version 6 contract. It adds Windows-specific inventory, native build, Authenticode, update-trust, stable
metadata, checksum, release-signature, recovery, and Pages checks. It accepts neither a Windows package whose native
evidence belongs to another source nor a published copy that differs from the Authenticode-signed and updater-signed
setup admitted by the manifest.

The complete-platform compositor has updater and release-checksum authority but no Authenticode authority. It admits
the closed native Linux and Windows inputs for one version, revision, and storage schema; adds target-specific updater
signatures without changing either package; derives the stable recovery set from the upgrade matrix; composes Pages,
manifest, checksums, and release signature; and promotes only after the independent version 7 verifier reopens the
entire candidate. Missing authority, mixed identity, input drift, invalid signing output, or reopening failure removes
the staging tree and cannot replace an existing destination.

`npm run authority:windows-public-release -- install` is the sole protected Windows authority-materialization command.
It accepts a base64 PFX and password only in the install process, verifies an independently supplied lowercase SHA-256
fingerprint and credential-free HTTPS timestamp endpoint, imports exactly one non-exportable code-signing identity into
the current-user personal store, deletes the PFX immediately, and exports only the five public or machine-local process
values required by the authority-free signing adapter. `npm run authority:windows-public-release -- cleanup` removes
that exact certificate and private key and clears all five values. Installation failure performs immediate cleanup;
cleanup failure preserves only the private runner-local retry state and remains a failed gate. The future workflow must
invoke cleanup through an unconditional finalizer and must never place certificate material in the checkout, command
line, cache, artifact, transcript, or retained evidence.

The current executable entry points are `npm run doctor` for prerequisite diagnosis, `npm run test:fast` for the contributor loop, `npm run benchmark:import` for the release-mode 10,000-entry and 5-GiB import, exact-repeat, query, and memory budgets, `npm run benchmark:dense-history` for long supported-signal import, storage, discovery, overview, and exact-page budgets, `npm run benchmark:insights` for production activity, training, sleep, recovery, and integrated longitudinal read-model budgets, `npm run verify:windows-cold-launch` for the installed production NSIS startup boundary, `npm run verify:e2e` for the shared functional and in-WebView performance instrumented journey, `npm run verify:linux-e2e` and `npm run verify:windows-e2e` for that same campaign through isolated installed packages, `npm run verify:linux-update-e2e` and `npm run verify:windows-update-e2e` for native installed update recovery, `npm run verify:linux-filesystem-reliability` for the isolated Linux `ENOSPC` recovery boundary, and `npm run authority:windows-public-release -- install` or `npm run authority:windows-public-release -- cleanup` for the protected Windows authority lifetime. `npm run verify:precommit` composes every acceptance gate that can truthfully run against a changed working tree and prepares a production-shaped package. After that coherent candidate is committed, `npm run verify:full` repeats the complete pre-commit chain against the exact clean revision and adds the source-bound cold-launch, production-bundle, and update-recovery-preparation gates. A clean-gate failure keeps the candidate local; it is corrected in a subsequent focused commit and the complete command is rerun. `npm run render:product-surfaces` projects the canonical public status into the README and product page; `npm run check:product-surfaces` rejects divergence, and `npm run check:site` verifies the static page contract and accessibility. `npm run check:presentation-inventory` follows the production import graph and rejects orphan modules, locale messages, CSS classes, automation scripts, and packaged-test files; dynamic typed dictionaries, generated class families, SVG-owned classes, and Leaflet-owned classes are explicit consumers rather than blanket exclusions. `npm run check:vendored-updater` verifies the exact updater source allowlist, checksums, dependency path, and frontend exclusion; `npm run test:vendor-updater` exercises its bounded-transfer refinement outside the FitFreed workspace package set. `npm run check:workflows` installs and executes checksum-pinned actionlint and ShellCheck binaries, while `npm run check:public-release-workflow` and `npm run check:public-linux-expansion-workflow` enforce the closed trigger, action-pin, native-input, environment, permission, secret, cleanup, and promotion topologies. `npm run check:docs` verifies links and the version, section, release-state, locale, support, operations, manual-evaluation, and release-note contracts of the public documentation set. These checks are part of the fast lane, while formatting and strict Clippy cover both Rust source trees. `npm run prepare:development-release -- <version>` requires a clean commit and creates private production artifacts, SBOMs, checksums, a manifest, and draft notes; `npm run verify:development-release` exercises integrity, installation, first launch, failure, relaunch, and removal boundaries. `npm run verify:update-recovery-preparation` uses the production `FitFreed.app`, a temporary synthetic library, and the real macOS copy adapter to prove the complete pre-replacement recovery pair without downloading or installing an update. `npm run verify:update-e2e` creates ephemeral signing and TLS authority, builds isolated instrumented 0.1.0 and 0.2.0 bundles, serves a schema-valid signed channel over loopback HTTPS, and proves native replacement, automatic application/library recovery, receipt-before-deletion terminal cleanup, localized outcome presentation, and explicit acknowledgement. Continuous integration invokes the same underlying versioned tasks as separate diagnosable steps and never uploads the unsigned package.

Every production-shaped Rust build passes compiler arguments through the robust encoded Cargo environment and remaps
the source checkout, build user home, explicit Cargo and Rustup homes, and temporary roots to stable virtual prefixes.
Existing explicit compiler arguments remain effective, including values that contain spaces. Production and
revision-isolated review inspection traverse the complete application bundle and fail when they find a macOS, Linux,
or Windows user-home or temporary path, or any E2E routing marker. The scanner reports only the affected path class;
it never echoes the matched local value into logs.

All three Rust performance campaigns share the dedicated `src-tauri/target/performance-benchmarks` Cargo target and
one host contract. Maintained macOS hosts plus x86-64 Linux and Windows are admitted; other systems and unsupported
architectures fail before compilation. The benchmark-only Rust support reads `ru_maxrss` as bytes on macOS and
kibibytes on Linux, and reads the process peak working set on Windows. It normalizes every result to mebibytes before
any shared memory budget is evaluated.
They never build into or reuse the default production target, and temporary comparison sources must use a separate
target of their own. This keeps benchmark compilation reusable without allowing a deleted comparison checkout or its
absolute build-script paths to contaminate production or later benchmark builds.

The manually dispatched public workflow is a separate publication boundary. Its secret-free preflight, ephemeral authority installation, signed candidate preparation, sealed digest-bound transport, independent candidate-evaluation pause, second protected approval, GitHub attestations, exact draft promotion, Pages deployment, and remote verification reuse versioned project commands. The protected build has no publication permission; promotion receives no Apple or updater authority. Normal CI can parse and test every deterministic part but has no trigger, environment, key, tag, approval, or publication authority that could create a release.

Repository-safety automation begins before the application stack is selected:

- `scripts/check-repository-content.sh` checks candidate files and publishable branch, remote, and tag metadata for local paths, personal export names, exact workstation fingerprints in public documentation, email disclosure, credential-shaped content, unreviewed binaries, and other publication-policy violations.
- `scripts/run-secret-scan.sh` scans both candidate working-tree content and complete branch, remote, and tag history using a checksum-verified, pinned Gitleaks CLI.
- `.github/workflows/repository-safety.yml` runs the content and secret checks with complete history and a SHA-pinned checkout action.

Local tool-managed Git notes are not part of a normal branch or tag publication and are excluded from publication-metadata checks. Any workflow that intentionally publishes another ref namespace must add that namespace to the same checks before publication.

## Human approval boundaries

Explicit approval remains required for:

- Changing confirmed product scope or acceptance criteria.
- Accepting an architectural or security exception.
- Granting or changing secret and signing permissions.
- Promoting artifacts to a public release channel.
- Withdrawing a release or changing supported upgrade policy.
- Actions that can delete or irreversibly migrate user data.

## Automation acceptance criteria

- A new contributor can discover and execute the primary workflows from repository documentation.
- The same underlying tasks produce equivalent outcomes locally and in continuous integration.
- Repeating an interrupted safe workflow does not corrupt project or synthetic application state.
- A failed workflow identifies its failed stage, relevant evidence, and remediation path.
- Release preparation produces all required artifacts and verification evidence without undocumented manual modification.
- No workflow exposes credentials, signing material, personal data, or sensitive diagnostics.
- Repository initialization and publication fail closed when Git identity is unset, uses an unapproved email, or public content exposes a private email address.
- Signed commits and tags use a signing identity that does not disclose an unapproved private email address.

## Pending decisions

- Reproducible clean Ubuntu 26.04 Desktop and supported Windows 11 candidate environments when stable hosted desktop
  equivalents are unavailable.
- Dependency-update and scheduled-maintenance tooling.
- Collaborative translation platform and synchronization mechanism.
- Custody provider and protected execution mechanism for the Linux detached release key and Windows Authenticode
  authority.
