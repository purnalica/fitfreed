# Contributor Setup

## Supported development baseline

The product foundation is packaged on macOS first and admits the complete desktop host on Linux and Windows before
platform package work. The repository pins:

- Node.js 22.14.0 in `.nvmrc`;
- npm 10.9.2 in `package.json`;
- Rust 1.97.1 with `rustfmt` and Clippy in `rust-toolchain.toml`.

Install the Xcode command-line tools and a Rustup installation before setup. Node version managers may read `.nvmrc`; Rustup reads the repository toolchain file automatically. The macOS system commands checked by `npm run doctor` include `ditto`, `hdiutil`, `openssl`, `plutil`, `shasum`, `sqlite3`, and `strings`. No separately installed Tauri, WebdriverIO, SQLite library, or fixture tool is required.

The Ubuntu 24.04 quality lane compiles, tests, and lints the complete Tauri desktop host and the pinned updater
refinement. Debian and Ubuntu contributors running that lane need Tauri's native development packages:
`libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`,
`libayatana-appindicator3-dev`, `librsvg2-dev`, and `pkg-config`. GitHub Actions installs them explicitly before
running `npm run doctor`; the doctor checks the required GLib, GIO, GObject, GTK, and WebKitGTK modules before reporting
a usable Linux environment, and it also requires the standard `dpkg-deb` package inspection command.

The Windows host lane runs on the pinned x86-64 `windows-2025` GitHub-hosted image with the MSVC Rust target. Local
Windows contributors need the Microsoft C++ Build Tools and Windows SDK supplied by Visual Studio's Desktop development
with C++ workload, WebView2, Rustup, and the pinned Node.js toolchain. `npm run doctor` verifies the x86-64 MSVC host,
Rust components, Node.js, and npm without relying on Bash. Windows package, installation, update, and recovery tooling
does not follow from host admission: package, installation, inventory, synthetic signing, packaged capability, update
recovery, cold launch, and filesystem reliability are separate explicit gates. Their source contracts pass locally;
native hosted execution and exact Windows 11 candidate evidence remain open Milestone 5 work.

## First setup

From the repository root on macOS or Linux:

```sh
npm run doctor
npm ci
npm run test:fast
```

On Windows, use PowerShell and run the admitted native-host loop:

```powershell
npm ci
npm run doctor
npm run test:windows-scripts
npm test
npm run format:check
npm run test:rust
npm run lint:rust
npm run package:windows
npm run inventory:windows-package
npm run verify:windows-authenticode-smoke
```

The complete `npm run test:fast` composition still contains macOS and Linux workflow-tooling checks. The Windows CI job
runs every portable product contract as separate diagnosable steps in addition to the native-host loop above. The
package and native installation commands require a clean x86-64 Windows environment. Installation verification
refuses to run when FitFreed files, registration, or application data already exist, so use a disposable Windows user
or CI runner rather than a personal profile.

### Windows clean-room scopes

Use native PowerShell, not Git Bash, WSL, MSYS2, or a POSIX compatibility shell, for every Windows-native command. A
fresh ordinary source and package check uses the first-setup sequence above. `npm run inventory:windows-package`
already performs one installation, inspection, inventory, removal, and retained-data check against the package; do not
repeat the same native transition merely to obtain another copy of the same evidence.

Packaged capability and update-recovery campaigns mutate current-user installation state and therefore use a
disposable x86-64 Windows account with no existing FitFreed or `fitfreed-e2e` package, registration, shortcut, or
application-data root:

```powershell
npm run verify:windows-e2e
npm run verify:windows-update-e2e
```

The production cold-launch gate reuses the clean-revision engineering setup and removes its own installation after the
measurement:

```powershell
npm run package:windows
npm run verify:windows-cold-launch
```

The filesystem-reliability gate creates and formats an isolated bounded VHD. Run only that command from an elevated
PowerShell session on a disposable host; never redirect it to a user library or ordinary drive:

```powershell
npm run verify:windows-filesystem-reliability
```

The manual `.github/workflows/windows-performance.yml` workflow owns hosted Windows Server performance evidence. Exact
Windows 11 candidate acceptance later repeats every platform-visible boundary on the sealed Authenticode-signed setup;
neither the hosted Server run nor an unsigned engineering package is that evidence.

For a privacy-safe environment report, record only the first failing command and root-cause message plus these public
tool and operating-system facts:

```powershell
Get-ComputerInfo -Property WindowsProductName,WindowsVersion,OsBuildNumber,OsArchitecture
node --version
npm --version
rustc --version
cargo --version
```

Do not attach a PowerShell transcript, personal export, local library, route, account name, home path, certificate
selector, private key, or unreviewed `.artifacts` directory. The Windows rows in
[troubleshooting](troubleshooting.md) identify each privacy-safe evidence directory and the boundary to diagnose.

`npm run doctor` checks the supported Node.js and npm ranges, pinned Rust toolchain, required Rust components, macOS Xcode command-line toolchain and native commands, or the native Tauri development modules used by the Linux quality lane, without requiring installed project dependencies. `npm ci` installs the exact JavaScript graph from `package-lock.json`. The fast lane verifies compile-enforced architecture boundaries, the pinned updater source and provenance, translation catalogs, the live presentation inventory, presentation behavior, GitHub workflow syntax and policy, the updater refinement test, and all FitFreed Rust workspace tests. Its workflow check installs checksum-verified actionlint 1.7.12 and ShellCheck 0.10.0 under ignored `.tools/`; no global installation is required and shell analysis is identical on supported contributor and CI hosts.

## Primary commands

| Outcome | Command |
|---|---|
| Diagnose the development environment | `npm run doctor` |
| Audit production and build dependencies | `npm run audit:dependencies` |
| Run the desktop application in development | `npm run tauri -- dev` |
| Verify architecture boundaries | `npm run check:architecture` |
| Verify canonical, mapping, and persistence contracts | `npm run check:data-contracts` |
| Verify release identity and version contracts | `npm run check:release-contracts` |
| Verify the application and library upgrade matrix | `npm run check:upgrade-matrix` |
| Verify documentation links and public-release guidance | `npm run check:docs` |
| Verify locale catalogs | `npm run check:i18n` |
| Verify live presentation, locale, style, test, and script ownership | `npm run check:presentation-inventory` |
| Verify reduced-motion presentation contracts | `npm run check:ui-contracts` |
| Verify pinned updater source and provenance | `npm run check:vendored-updater` |
| Verify GitHub workflow syntax and both public-release policies | `npm run check:workflows && npm run check:public-release-workflow && npm run check:public-linux-expansion-workflow` |
| Build the unsigned update-capable Debian input on x86-64 Linux | `npm run package:linux-expansion-input` |
| Build the exact secret-free Linux expansion input | `npm run prepare:linux-expansion-input -- <version> <directory>` |
| Seal an exact Linux expansion input | `npm run pack:linux-expansion-input -- <input> <archive> <version> <revision> <schema>` |
| Reopen a digest-bound Linux expansion input | `npm run unpack:linux-expansion-input -- <archive> <sha256> <output> <version> <revision> <schema>` |
| Seal a verified public candidate for protected handoff | `npm run pack:public-release -- <candidate-directory> <archive>` |
| Reopen an exact digest-bound public candidate | `npm run unpack:public-release -- <archive> <sha256> <candidate-directory>` |
| Run presentation tests | `npm test` |
| Run project automation tests | `npm run test:scripts` |
| Run all Rust tests | `npm run test:rust` |
| Run the pinned updater refinement test | `npm run test:vendor-updater` |
| Compile the complete desktop host with all targets and features | `npm run build:windows-host` |
| Verify Windows-portable host automation and its CI contract | `npm run test:windows-scripts && npm run check:windows-ci-workflow` |
| Build the unsigned x86-64 current-user NSIS package on Windows | `npm run package:windows` |
| Verify NSIS identity, current-user installation, removal, and retained application data | `npm run verify:windows-installation` |
| Perform one native cycle and write the exact Windows package inventory | `npm run inventory:windows-package` |
| Verify synthetic Authenticode signing, independent inspection, and complete authority cleanup | `npm run verify:windows-authenticode-smoke` |
| Install or remove the temporary Authenticode identity on a protected Windows release builder | `npm run authority:windows-public-release -- install` or `npm run authority:windows-public-release -- cleanup` |
| Build, install, drive, and remove the isolated NSIS capability-test package | `npm run verify:windows-e2e` |
| Verify production-identity NSIS replacement, candidate rollback, and restart resumption | `npm run verify:windows-update-e2e` |
| Measure the installed production NSIS cold-launch boundary and remove it | `npm run verify:windows-cold-launch` |
| Verify Windows library protection and disk-exhaustion recovery on an isolated NTFS volume | `npm run verify:windows-filesystem-reliability` |
| Build the Authenticode-signed update-capable Windows input under protected authority | `npm run package:windows-expansion-input` |
| Build the exact authority-free Windows expansion handoff | `npm run prepare:windows-expansion-input -- <version> <directory>` |
| Seal an exact Windows expansion input | `npm run pack:windows-expansion-input -- <input> <archive> <version> <revision> <schema> <certificate-sha256>` |
| Reopen a digest-bound Windows expansion input | `npm run unpack:windows-expansion-input -- <archive> <sha256> <output> <version> <revision> <schema> <certificate-sha256>` |
| Run the fast contributor lane | `npm run test:fast` |
| Check Rust formatting | `npm run format:check` |
| Run Clippy with warnings denied | `npm run lint:rust` |
| Generate independent E2E fixtures | `npm run fixture:e2e` |
| Generate the cancellation-scale fixture | `npm run fixture:large` |
| Generate the dense supported-signal fixture | `npm run fixture:dense-history` |
| Generate the Insights performance fixture | `npm run fixture:insights-performance` |
| Verify full-scale import and exact-repeat budgets | `npm run benchmark:import` |
| Verify dense signal import, storage, and query budgets | `npm run benchmark:dense-history` |
| Verify detailed and longitudinal read-model performance | `npm run benchmark:insights` |
| Build only the unsigned production application bundle | `npm run package:app` |
| Verify cold launch against that clean production bundle | `npm run benchmark:cold-launch` |
| Build the unsigned production package | `npm run package` |
| Build the Linux Debian package on Linux | `npm run package:linux` |
| Inspect the generated Debian identity and installed layout | `npm run verify:linux-package` |
| Generate the deterministic exact Debian package inventory | `npm run inventory:linux-package` |
| Install and remove the Debian package in a clean Ubuntu 24.04 container | `npm run verify:linux-installation` |
| Verify native Debian replacement and automatic recovery | `npm run verify:linux-update-e2e` |
| Build, install, drive, and remove the isolated Debian capability-test package | `npm run verify:linux-e2e` |
| Verify Linux disk-exhaustion recovery on an isolated filesystem | `npm run verify:linux-filesystem-reliability` |
| Verify a complete signed Linux public candidate | `npm run verify:linux-public-release -- <candidate-directory>` |
| Install or remove an exact complete-platform candidate on its hosted Ubuntu admission row | `npm run verify:linux-candidate-installation -- <install\|remove> <candidate-directory> <version> <ubuntu-version>` |
| Install the pinned local release evidence tool | `npm run install:release-tools` |
| Install the pinned local workflow validator | `npm run install:workflow-tools` |
| Prepare release-shaped private evidence | `npm run prepare:development-release -- 0.1.0` |
| Verify macOS installation and failure boundaries | `npm run verify:development-release` |
| Verify recovery-pair preparation against the production app | `npm run verify:update-recovery-preparation` |
| Build and run the instrumented functional, real-process restart, and performance E2E campaigns | `npm run verify:e2e` |
| Build, inspect, and launch the revision-isolated native X6 human-review application | `npm run review:x6` |
| Verify signed packaged update replacement and recovery | `npm run verify:update-e2e` |
| Run every acceptance gate that supports a changed working tree before creating a candidate commit | `npm run verify:precommit` |
| Re-run the broad product-verification lane and clean-revision gates from the exact candidate commit | `npm run verify:full` |

Generated application, database, fixture, log, screenshot, icon, and bundle output is ignored. Never replace the synthetic generators with a real provider export or a record copied from one.

The unsigned macOS production application and DMG are generated under `src-tauri/target/release/bundle/`. `npm run package:app` builds only `FitFreed.app` for the cold-launch campaign; `npm run package` builds the complete application and DMG set. Both commands bind the exact Git revision and clean-tree state into the host and normalize compiler source paths to stable virtual prefixes. The production-bundle check traverses the complete `.app` and rejects build-host paths as well as test routing. The instrumented behavioral E2E executable and application bundle use the separate `src-tauri/target/e2e/` target and must never be opened as a user build, used for human evaluation, or distributed. Its build deliberately omits an instrumented DMG because WebdriverIO consumes only the `.app`; production packaging and installation verification retain the DMG boundary. WebdriverIO is contractually pinned to that isolated executable, so an E2E campaign cannot replace the native application a reviewer launches. The X6 human-review profile instead uses a separate revision-derived bundle identity under `src-tauri/target/x6-review/`, production native adapters, and no test routing; CI and `npm run review:x6` inspect that complete bundle for both forbidden content classes before use. Packaged-update test builds, ephemeral keys and certificates, isolated installed bundles, libraries, recovery state, logs, and screenshots live under ignored `.artifacts/update-e2e`; its Cargo output is further isolated under `.artifacts/update-e2e/target`.

On Linux, `npm run package:linux` is the production-bound engineering entry point for the single supported package
family. It rejects another host operating system, requests only Tauri's `deb` target, and merges
`src-tauri/tauri.linux.conf.json`. That overlay gives Tauri the technical product identity `fitfreed`, uses a reviewed
desktop template to retain the visible `FitFreed` name, and fixes the package homepage, GPL identifier and license file,
fitness category, descriptions, Debian `utils` section, and `optional` priority. It deliberately claims no generic ZIP
file association: taking ownership of every ZIP on the desktop would be misleading. A successful build is written as
`src-tauri/target/release/bundle/deb/FitFreed_<version>_amd64.deb`; the wrapper changes only Tauri's generated filename
and never rewrites the package bytes. `npm run verify:linux-package` then extracts that package into an isolated
temporary directory and fails unless its artifact name, `fitfreed` Debian control identity, Ubuntu runtime
dependencies, executable permissions, `usr/share/applications/fitfreed.desktop` entry and visible name, icons, and
installed GPL text agree. Neither command constitutes an accepted or public Linux release until the remaining
Milestone 4 installation, trust, recovery, parity, and exact-candidate gates pass.

On x86-64 Windows, `npm run package:windows` is the production-bound engineering entry point for the single NSIS
package. It rejects another operating system, architecture, target, configuration overlay, or caller-supplied build
option and asks Tauri to produce only `FitFreed_<version>_x64-setup.exe` under
`src-tauri/target/release/bundle/nsis/`. The setup installs for the current user, contains English and Spanish installer
resources selected from the operating-system locale, and bundles the silent WebView2 offline installer. It may
reinstall an older version only so the separately authenticated recovery flow can restore an exact predecessor.

This ordinary engineering package is unsigned. By itself it is not a public candidate and does not prove installation,
registry, Start Menu, Add or Remove Programs, WebView2, Authenticode, update, or recovery behavior.
`npm run inventory:windows-package` performs one real install-inspect-inventory-remove cycle and writes the
schema-validated digest-bound evidence beside the setup. The synthetic Authenticode, packaged capability, update,
recovery, cold-launch, and filesystem-reliability gates are separate commands because each proves a different native
boundary. Protected public Authenticode authority, the public Windows workflow, and exact-candidate acceptance remain
open Milestone 5 work. Do not add certificate selection, signer commands, timestamps, account identities, or
machine-local protected paths to `tauri.windows.conf.json`.

After `npm run package:windows`, `npm run verify:windows-authenticode-smoke` signs only a temporary copy of the unsigned
release executable. It creates a non-exportable self-signed certificate in the current-user store, verifies the copy
through SignTool and Windows Authenticode policy, proves the original digest is unchanged, and removes the certificate,
private key, trust entries, process values, and temporary directory before success. Run it only in a disposable Windows
user or CI runner. Its untimestamped synthetic result is automation evidence, never a distributable or publicly trusted
binary.

`tauri.windows.public-signing.conf.json` is a reviewed authority-free overlay for a future protected candidate build.
It contains only the signing command and Tauri binary placeholder. Production certificate selection, its independent
SHA-256 fingerprint, the Windows SDK SignTool path, and the credential-free HTTPS RFC 3161 service enter only as
protected process values; they must not be added to source, retained evidence, or ordinary CI. The signer
requires SHA-256 for file and timestamp digests, and the inspector independently requires Windows application-policy
trust, the admitted leaf certificate, timestamp, unchanged file digest, x86-64 architecture, and exact product name and
version. Do not pass protected values through contributor-facing command arguments or logs. Public signing remains a
release-operator boundary and is not a contributor setup step.

`npm run package:windows-expansion-input` is that protected native-builder entry point. It deliberately cannot run from
the ordinary contributor environment: active `stable-v3` public update trust and the complete public Authenticode
process profile must be present, while every updater private-key input is rejected. It selects the Authenticode overlay,
embeds only public update trust, removes stale NSIS output, builds the exact setup, and reinspects its final bytes through
the independent Windows trust adapter. Failure removes the unverified output directory. The later complete-platform
composer signs the sealed setup for the updater under separate authority. Do not use this command to create an
engineering package, and do not retain its protected process values in shell profiles, scripts, logs, or evidence.

`npm run prepare:windows-expansion-input -- <version> <directory>` requires the same protected Windows process and a
clean source revision. It audits dependencies, builds and reinspects the setup, runs the public-profile installation
and data-preserving removal cycle, and atomically stages exactly three files: the setup, its complete inventory, and
source-bound build evidence. Existing output is never replaced. The retained evidence includes the public certificate
fingerprint and embedded updater trust identifiers, but excludes certificate selectors, SignTool paths, private keys,
machine paths, and updater or publication authority. This command prepares a native handoff; it neither creates a
complete candidate nor authorizes a release.

The paired Windows pack and unpack commands verify the three-file input on both sides of its compressed tar transport.
The pack result exposes the public archive SHA-256 digest; the unpack command requires that digest together with the
expected source, schema, and public Authenticode fingerprint. Archive entries, internal digests, package identity,
certificate trust, and updater trust must all agree before an atomically prepared output becomes visible. These are
release-automation handoff commands, not routine contributor packaging steps.

`npm run package:linux-expansion-input` is reserved for the first complete-platform workflow. It retains the same
Debian package contract but requires active recoverable `stable-v3` configuration and embeds only that channel's public
endpoint and updater trust in the executable. It receives no private updater key or password and emits no signature;
the protected composer signs those exact package bytes after the native input has been verified and digest-sealed.
This distinction prevents a normal engineering package without public-channel trust from entering the expansion.

`npm run inventory:linux-package` reopens the same exact `.deb` and writes
`FitFreed_<version>_amd64.deb.inventory.json` beside it only after the complete schema, target, control, path, digest,
permission, and symbolic-link contract passes. Repeating it against unchanged package bytes produces identical evidence.
The inventory is not an SBOM, signature, or publication authorization.

`npm run verify:linux-public-release -- <candidate-directory>` reopens a candidate's `release/` and `pages/`
directories. It verifies the recoverable version 5 manifest, every artifact digest, the package inventory's binding to
the Debian bytes, upgrade matrix version 2, the exact checksum set, the detached checksum signature, both
stable-channel signatures, and the complete macOS-plus-Linux Pages snapshot. Every predecessor named by `stable-v3`
must exist at its canonical version path and match its authenticated size, digest, and updater signature. The command
uses only the active public trust configurations; an inactive or unknown key fails closed. Passing verifies candidate
consistency but does not grant publication authority.

Release preparation obtains each Linux predecessor from ignored original-release evidence at
`<evidence-root>/<version>/linux-x86_64-deb/release/`. Discovery derives the exact required directories from
`supported-upgrades.json`; it rejects stale or missing entries and reopens the prior manifest, inventory, checksum
set, release signature, and updater signature before the package can enter staging. Never copy a package from an
installed system, rebuild an old version, or enter a predecessor path manually.

The clean-installation command additionally requires Docker on an x86-64 Linux host. It mounts only the exact Debian
artifact, read-only, into a digest-pinned Ubuntu 24.04 base image. The gate first proves that Node.js, npm, Cargo,
Rustc, Git, and GCC are absent; it then installs the package and its repository dependencies, verifies package-manager
identity and dynamic linking, purges FitFreed, and verifies removal. The repository and build toolchains never enter
the clean environment. This repeatable engineering check does not replace graphical desktop installation or exact
candidate evaluation on either supported Ubuntu release.

The `verify:linux-candidate-installation` entry point is reserved for the public-release workflow's secret-free Ubuntu
24.04 and 26.04 matrix. It requires x86-64 Linux, passwordless package-manager elevation, the exact clean tagged
source, and a complete digest-reopened manifest version 6 candidate; it changes native package state. Contributors
should use the package, clean-installation, Linux E2E, and Linux update commands above for ordinary engineering work.

Run `npm run verify:linux-update-e2e` on an x86-64 Linux desktop or CI host with Xvfb, WebKitWebDriver, SQLite,
Polkit, and passwordless `sudo` for the isolated package-test setup. The command builds and signs two instrumented
Debian versions after generating Tauri's required application icons, installs and replaces the native package, and
removes both its narrowly scoped temporary Polkit rule and package state. It covers successful replacement, candidate
and native-installer failure, and authorization that becomes available only after the verified runnable predecessor
exposes the explicit retry. It also drives
authorization through the third failed attempt and requires manual reinstall guidance, then separately interrupts
both recovery actors before native installation and proves ordinary startup resumes the durable attempt. It never uses
production update trust or publishes an artifact. Generated packages, keys, certificates, databases, recovery state,
and privacy-safe failure evidence remain under ignored
`.artifacts/linux-update-e2e`. This update-specific command does not replace the complete packaged capability journey.

Run `npm run verify:linux-e2e` on an x86-64 Linux desktop or CI host with Xvfb, WebKitWebDriver, the documented Tauri
build dependencies, and passwordless `sudo` for installation of the isolated test package. It generates the shared
synthetic fixtures, builds `fitfreed-e2e` under the dedicated E2E target, verifies its Debian metadata, installs only
`/usr/bin/fitfreed-e2e`, and drives all seven functional, restart, sport-catalogue, adaptive-session, and performance
scenarios against that installed executable. The command refuses to overwrite an existing test package or executable.
After the campaign it purges `fitfreed-e2e`, verifies package-owned removal, proves the synthetic libraries remain,
and then removes successful run data. It neither installs nor replaces the production `fitfreed` package.

The loose instrumented executable resolves to `fitfreed` on macOS and Linux and `fitfreed.exe` on Windows. macOS builds
an isolated application bundle; Linux capability parity additionally builds and installs the isolated
`fitfreed-e2e` Debian package. Windows capability parity builds and installs the isolated `fitfreed-e2e` current-user
NSIS package through `npm run verify:windows-e2e`; run it only from native x86-64 Windows PowerShell. The command refuses
pre-existing test identity, drives the same seven packaged scenarios, silently removes the package, and verifies that
removal preserves the synthetic libraries. The instrumented macOS application has its own stable bundle identity. To keep local E2E windows away from
an active Desktop, run `npm run build:e2e`, open the generated
`src-tauri/target/e2e/release/bundle/macos/FitFreed.app`, then use **Dock → Options → Assign To → This Desktop** once.
macOS retains that assignment for subsequent E2E rebuilds. This is a local development preference rather than a test
prerequisite; macOS does not expose a supported API for automation to move an arbitrary application window between
Spaces. Use `npm run verify:e2e` for acceptance evidence because it always rebuilds the instrumented application before
the packaged journeys. A direct WebdriverIO command deliberately reuses the existing package and is suitable only for
repeating a test against the exact source from which that package was built.

Run `npm run verify:windows-update-e2e` only from native x86-64 Windows PowerShell in a disposable user account. Unlike
the isolated capability package, this campaign must use the canonical production identity to exercise Windows native
recovery. It refuses to start if any FitFreed installation, registration, shortcut, or application-data root already
exists. It then builds and installs synthetic 0.1.0 and 0.2.0 NSIS packages, serves signed update metadata over local
HTTPS, and verifies successful replacement, native installer failure, candidate rejection with rollback, and restart
resumption after a bounded watchdog interruption. It also verifies runnable fallback, a successful offline recovery
retry, and manual guidance after three failed recovery attempts. It removes only state created after its successful
preflight. Do not run it on an account that contains a real FitFreed library; hosted success remains engineering
evidence rather than exact Windows 11 acceptance.

Run `npm run verify:windows-cold-launch` only after `npm run package:windows`, from native x86-64 Windows PowerShell in
a disposable user account with no existing FitFreed package, registration, shortcut, roaming data, or local data. It
installs the production identity and measures 100 processes. Before each process, it revalidates that installation,
stops only its exact executable if necessary, rejects reparse points, and removes only the fixed
`org.fitfreed.desktop` roaming and local roots returned by native Windows known-folder APIs. The reset is outside the
measured interval. It uninstalls and removes only state it owns even after a failed measurement. The command
deliberately refuses pre-existing state; never clear that state to make the gate pass on a user account that contains
a real library. The manual Windows performance workflow runs this gate before the shared import, dense-history, and
Insights campaigns.

Run `npm run verify:linux-filesystem-reliability` only on Linux with permission to use `sudo mount` and `sudo umount`.
The command creates its own isolated 32 MiB `tmpfs`, refuses an arbitrary directory or unsuitable capacity, runs only
the ignored production SQLite disk-exhaustion acceptance test in release mode, and unmounts the filesystem on success
or failure. It proves committed-history recovery rather than package installation, so it complements rather than
replaces `verify:linux-installation`, `verify:linux-update-e2e`, or `verify:linux-e2e`. Never point the underlying test
environment variable at a normal application-data directory.

## Synthetic fixture workflow

`npm run fixture:e2e` generates the current valid, malformed, unrelated, cumulative-overlap, and isolated sport-catalogue ZIP packages under `.artifacts/e2e/fixtures`. `npm run fixture:large` generates the 10,000-entry mixed activity, training, excluded-sample, expanded-volume, and cancellation scenario. `npm run fixture:dense-history` generates a ten-year, 520-session history with 7,490,080 exact supported signal samples, while `npm run fixture:insights-performance` generates the two-year packaged-UI activity, training, sleep, recovery, and integrated longitudinal performance history. None of their output is added to Git. The behavioral source of truth is the [synthetic import scenario specification](../testing/synthetic-import-scenarios.md); every implemented scenario must keep its generator, expected outcome, data-format documentation, and tests consistent.

## Architecture navigation

- `src-tauri/crates/fitfreed-domain` contains provider-neutral concepts and reconciliation policy and has no dependencies.
- `src-tauri/crates/fitfreed-application` contains use cases, ports, provider-neutral domain Insights calculations, longitudinal composition, source-acquisition guide validation, progress, and cancellation coordination and depends only on the domain, calendar arithmetic, and its error helper.
- `src-tauri/src/infrastructure.rs` contains the Polar Flow ZIP/JSON anti-corruption layer, daily-activity, training-summary, sleep, and nightly-recovery mappings, SQLite adapter, and bundled Polar Flow acquisition-guide adapter.
- `src-tauri/src/infrastructure/update_recovery.rs` owns the macOS recovery-pair copy, deterministic application digest, SQLite verification, local manifest, and active-attempt persistence.
- `src-tauri/src/infrastructure/update_installation.rs` coordinates verified package installation with recovery preparation, watchdog readiness, native replacement, and failure handoff.
- `src-tauri/src/infrastructure/update_watchdog.rs` owns the preserved-executable process runner, restart-safe candidate observation, confirmation deadline, and recovery execution.
- `src-tauri/src/lib.rs` and `presentation.rs` are the Tauri host and serialized transport boundary.
- `src-tauri/vendor/tauri-plugin-updater` is the provenance-checked source refinement selected by ADR 0009; its `README.fitfreed.md` is the mandatory review and upgrade guide.
- `src` contains the React presentation, its desktop archive-picker and official-link adapters, and test-only presentation instrumentation; localized copy exists only under `src/locales`. `ApplicationShell` owns the persistent Home, History, Reports, Sources, and Settings navigation. Home owns first-run acquisition entry and the versioned result-led composition of recorded evidence, usable history, one explicitly scoped primary range, training identity, recent sessions, one conservative comparison or historical fallback, supported questions, and subordinate coverage. Library Home version 5 prevents one domain's boundary from being presented as another domain's history, distinguishes recorded-but-unusable evidence from first run, and carries recognized, ambiguous, unknown, personally overridden, and unavailable sport identity without provider identifiers. Each unresolved profile retains its opaque presentation capability only to route the exact shared classification task; that capability is never rendered or exported. Its exact initiating control is the return-focus origin for History. `SourcesPanel` owns acquisition guidance, filename-only selection, active-task dominance, cancellation, and source-action recovery; `ImportOutcomePanel` owns the consequence-led terminal result and deliberate reason, incorporation, and family-coverage disclosures. History owns analytical workspaces. `SportClassificationTask` is the only React mutation task for family and personal sport labels; Home and History may route or compose it in context and in the full Sports workspace, but must not duplicate its command, validation, conflict, progress, or reset behavior. `training-sports.ts` owns shared locale fallback, personal precedence, and icon-family resolution for Home, History, sessions, and Reports. `TrainingInsightsPanel` orders each successful classification event across both workspaces and the application owner. `TrainingSessionLibraryPanel` re-resolves its complete active context against one fresh snapshot, while `App` refreshes Home without navigation. Its ordinary discovery cards use the human-scale locale formatters in `training-format.ts`, omit absent optional evidence, and never replace the exact values retained by application results and deliberate detail surfaces. Reports owns durable starts, ordered composition, stale-evidence review, privacy review, local export, and contextual source return; Settings owns durable presentation preferences. The internal `explore` destination name remains an implementation identifier rather than user-facing terminology.
- `src/presentation/analytical-chart.ts` owns the validated provider-neutral live-chart model, including overlay and stacked-lane layouts plus exact elapsed and UTC-safe local-date coordinates. `AnalyticalChart` owns validation, localized loading and failure states, and lazy loading; `EChartsAnalyticalChart` owns delayed mounting, in-place model updates, geometry-aware resizing, and disposal; and `echarts-analytical-chart-adapter.ts` is the only source allowed to import ECharts or construct its options. The React adapter retains the last rendered width, height, and device pixel ratio and does not resize a renderer merely because an unchanged hidden chart becomes visible again. Stable feature models must be memoized across unrelated disclosure and exact-table state; a changed model replaces only ECharts' grid, axes, zoom, and series components rather than recreating the renderer. `TrainingRouteSignalLanes` projects one through four application-authorized route-linked measurements, `TrainingCrossSignalPanel` orders and projects one through four independently scaled exercise signals, and `LongitudinalInsightsPanel` projects four source-separated domains over one exact local-date coordinate. Cross-signal defaults are speed plus heart rate when both exist and otherwise follow canonical sport-family relevance; cumulative distance is last and excluded from a multi-series default. The feature supplies concise horizontal lane identities, adds source ordinals only when repeated kinds need disambiguation, and retains exact-sample actions plus matching non-color line patterns while the ECharts adapter owns collision-free axis titles, sparse-series symbols, dense-series marker suppression, and renderer mechanics. These features preserve missing values as gaps, keep pace axes in `M:SS`, retain recorded training zero, and enable zoom only for dense evidence. None draws its own SVG, normalizes values, or creates another chart contract. Feature code builds evidence meaning and keeps semantic controls plus exact alternatives outside the renderer. Run the focused analytical-chart, adapter, boundary, route-workbench, cross-signal, and longitudinal tests together with `npm run check:architecture`, `npm run check:ui-contracts`, `npm run check:i18n`, `npm test`, and `npm run build` after changing this boundary. The architecture and UI checks reject an additional ECharts importer, renderer-internal CSS coupling, local chart formatting, obsolete custom analytical renderers, or missing high-zoom sizing.
- `TrainingRouteWorkbench` owns the semantic route controls and common selected point derived from one `SessionStory`; `TrainingRouteSignalLanes` owns the application-authorized route-linked analytical projection, one shared native position control, semantic lane summaries, and exact source actions; `route-workbench-model.ts` owns anti-meridian handling, direction, exact ordinal retention, timeline selection, and overlay projection; `route-viewport.ts` owns the renderer-neutral port and pure map-keyboard mapping; `keyboard-key.ts` is the sole adapter for literal embedded-driver special-key codes and the shared bounded stepping policy used by route and signal range handles; and `leaflet-route-adapter.ts` is the sole allowed Leaflet import. The viewport adapter receives bounded prepared points, performs no command, and must remain vector-only and local. Exact workbench actions calculate the containing page from the retained source ordinal, reuse the existing paginated commands, and focus the validated exact row; do not query from a lane or derive a sample ordinal from proximity. Chart selection may navigate the already established shared elapsed coordinate but never manufactures an exact sample relationship. The element-scoped key listener is the supported-macOS-WebView compatibility boundary and still delegates every spatial operation to Leaflet. Keep driver codes out of feature components and normalize them only through `keyboard-key.ts`. Run `npm run check:ui-contracts`, the focused keyboard, analytical-chart, workbench, viewport, and session-library tests, and packaged E2E after changing this boundary. [Training exploration architecture](../architecture/training-exploration.md), [ADR 0026](../architecture/decisions/0026-use-leaflet-for-the-local-route-workbench.md), and the [user route guide](../user/session-routes.md) are the canonical design, decision, and behavior references.
- `TrainingRangeInteractionProvider` owns the session-level personal-range query, selected durable range, editor draft, atomic command lifecycle, optimistic-conflict recovery, guarded removal, and revision-bound summary disclosure. Its route-draft preview controller waits for 150 milliseconds of stable boundaries, runs at most one complete-evidence query at a time, and preserves only the latest pending request; do not move this pointer-input scheduling into the application query or weaken the exact full-coordinate calculation. `TrainingRangesPanel` composes its library and result, while the single `TrainingRangeEditor` form is shared with `TrainingRouteWorkbench`, `TrainingSignalWorkbench`, and `TrainingRangeEvidenceEditor`. `TrainingRangeEvidencePicker` turns an explicit interval or ordered timed evidence entry into a preset for that controller; it never invokes a command. `TrainingStructureWorkbench` supplies only valid recorded exercise/lap intervals, while exact route and signal pages supply only entries with their owning returned coordinate. `training-session-range.ts` mirrors the public desktop transport, while `training-range-editor-model.ts` owns exact `BigInt` elapsed parsing, choice labeling, immutable established-coordinate lookup, and local validation. Presentation receives coordinates only from the application context and re-queries durable state after remount. The route map projects exact returned point indexes, and the signal chart projects exact returned sample ordinals; neither snaps a typed boundary to nearby evidence or treats equal offsets from independent clocks as alignment. Run the focused route-workbench, picker, structure-workbench, session-library, packaged Insights-performance, and UI-contract checks after changing this composition. The [training exploration architecture](../architecture/training-exploration.md) and [personal range guide](../user/session-ranges.md) are canonical.
- `assets/sport/sport-icons.svg` owns the provider-neutral sport icon geometry shared by the React application and self-contained HTML report adapter. Add or change a symbol there, keep the `sport-icon-<code>` identifier aligned with the stable family or state code, and verify both consumers; do not copy its paths into a component or exporter.
- Sport recognition starts with [ADR 0027](../architecture/decisions/0027-resolve-sport-identity-from-versioned-provider-evidence.md), the [provider catalogue contract](../data-formats/providers/provider-sport-catalogue-v1.md), and the [shared identity contract](../data-formats/insights/training-sport-identity-v1.md). `ProviderSportCatalogueEvidence` and `install_provider_sport_catalogue` are infrastructure adapter boundaries: provider identifiers must not enter either inner crate, transport, React, or HTML. Installation validates and commits one immutable snapshot atomically; startup activates the reviewed asset under `assets/provider-compatibility`; activation advances the training-discovery revision; personal classification stays independent and wins in presentation. `npm run check:data-contracts` verifies schema, manifest, input metadata, family coverage, output digest, and runtime inclusion. Repository behavior tests use synthetic catalogue inputs, while the bundled public interoperability asset has one bounded installation and recognition contract test. Refresh the asset only through the documented deterministic acquisition and generation procedure.

The detailed dependency map is [`../architecture/module-map.md`](../architecture/module-map.md), the importer ownership boundary is [`../architecture/source-integration.md`](../architecture/source-integration.md), and the machine-readable contract index is [`../data-formats/README.md`](../data-formats/README.md). Source-format, acquisition-guide, canonical-format, mapping, or persistence changes must update their normative documentation, localized content when applicable, and synthetic contract evidence in the same increment.

Report work starts with [`../architecture/reporting.md`](../architecture/reporting.md). The domain owns versioned block invariants, the application resolves block references only through authoritative query ports, SQLite stores intent rather than copied evidence, and the HTML adapter receives only an authorized bounded projection. A new block kind therefore requires domain and application behavior, transport, persistence migration, canonical and portable schemas, independently constructed contract evidence, both locale catalogs, complete editor controls, privacy review where applicable, deterministic output, and component plus packaged E2E coverage in one vertical increment. Do not begin by adding a React control or by reading report data directly from SQLite.

The host starts one process-lifetime update schedule after setup. The ready interface still requests the immediate launch evaluation; later successful scheduled evaluations cross the host boundary through `fitfreed://update-check-completed`. The architecture check prevents the Rust and TypeScript event names from drifting. Tokio's paused clock makes the 24-hour cadence, repeated execution, no-burst behavior, and occupied-operation skip deterministic in the Rust fast lane; no developer should shorten the production interval to make these tests run.

The [localization guide](localization.md) documents locale resolution, durable preferences, formatting, translation-catalog rules, and the complete acceptance path for adding a language.

The [performance benchmark guide](performance-benchmarks.md) documents cold launch, synthetic scales, timed boundaries, run counts, percentile calculation, budgets, machine-readable evidence, and interpretation limits.

The [private release preparation guide](release-preparation.md) owns the clean-revision package and installation evidence lane. It remains separate from `verify:full` because preparation must bind its output to a clean, reviewable commit.

The [public release guide](public-release.md) owns the inactive production trust boundary, exact-tag preflight, protected inputs, signed candidate, immutable Release, Pages deployment, provenance, and remote verification workflow. `npm run check:docs` also binds the version-matched public user guide, maintainer runbook, product-owner experience evaluation, readiness ledger, supporting policies, reviewed release notes, release policy, and both initial locale catalogs. Contributor commands may verify that workflow, but normal setup and CI cannot publish a binary.

## Continuous integration

GitHub Actions classifies every pull request and `main` revision through a closed non-application allowlist.
Documentation links and repository safety always run; README, canonical product-status, static product-page, and
publication-only automation changes additionally run the focused generated-content, page, compositor,
update-preservation, workflow, and publication contracts. Such a revision skips application verification only when
the exact Git-tree fingerprint of every executable and release input has evidence that all admitted complete lanes
previously passed; missing evidence fails closed. Application, shared-dependency, release-candidate, unknown, and
explicitly requested changes run portable checks plus complete workspace and desktop-host tests and strict linting on
the pinned Ubuntu 24.04 runner. They also run the complete desktop-host build, tests, formatting, strict linting, and
pinned updater refinement on `windows-2025`; the job may reuse only an exact
`windows-2025-x86_64-host-package` executable-input fingerprint marker produced after all those checks passed. A missing,
malformed, stale, or mismatched marker fails closed by running the Windows checks, native NSIS installation inventory,
and synthetic Authenticode cleanup campaign. The mandatory macOS packaged-E2E
job verifies full-scale import, dense supported-signal import and storage, exact-repeat, detailed-domain, longitudinal
read-model, and production cold-launch budgets, prepares and installation-tests a normal private production package, and then builds
separate test variants. It drives the packaged application through validation, progress, cancellation, both locales,
exact and cumulative reimport, accessibility, a second application process recovering the first process's controlled
library and preferences, and in-WebView performance budgets for all four detailed Insights areas and their integrated
longitudinal view. It also exercises a real signed 0.1.0-to-0.2.0 native update through loopback HTTPS, including
successful confirmation and automatic rollback after deliberate candidate rejection.

The instrumented build routes the archive picker, explicit official-link opener, and report-destination picker
through WebdriverIO mocks because these operating-system surfaces cannot be driven reliably through the embedded
macOS WebView. The E2E test verifies each complete invocation before observing its result and independently
opens the generated report bytes. Normal development and production builds use Tauri's native dialogs and the
application-owned official-destination command backed by the operating-system launcher. The production-bundle
check rejects both Rust and presentation WebDriver markers.

When E2E fails, the job retains only synthetic screenshots and tool logs for seven days. It never uploads generated libraries, applications, updater packages, recovery pairs, signing material, fixture paths, real exports, or personal values.

The [troubleshooting guide](troubleshooting.md) is the canonical failure guide. It maps common symptoms to their owning boundary and lists privacy-safe escalation evidence.
