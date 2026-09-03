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
Ubuntu 24.04 owns separate package-shaped capability and native-update campaigns; Milestone 5 adds Windows through
the same versioned project commands rather than parallel CI-only test paths.

Hosted verification is impact-aware. Every revision runs the versioned impact classifier, documentation links, and independent repository-safety gate. README, product-status, static product-page, and the closed set of publication-only compositor, verifier, test, and Pages-workflow changes additionally install the locked JavaScript toolchain; verify SSOT rendering, local resources, release-state honesty, automated accessibility, compositor and update-subtree preservation, workflow topology, and publication tests; and build and preflight the Pages artifact without rebuilding or repackaging unchanged application inputs. The closed documentation-verification set similarly runs its focused tests and workflow lint without entering a native package lane; those files are excluded from the application fingerprint because they cannot enter the application or release artifact. The impact classifier, its tests, and the CI workflow remain release-affecting control-plane inputs and therefore require the portable lane, complete macOS lane, Linux capability lane, and Linux native-update lane whenever they change. Application, shared dependency, updater-client, release-candidate, or unknown changes run all four lanes, as does every explicit release-candidate or manual verification request. Within the macOS lane, the production package and cold-launch gate precede the long synthetic import and Insights campaigns so a startup failure stops expensive downstream work early; every gate still runs after that check passes. Both Linux package-shaped lanes start only after the portable lane succeeds. A non-application revision may reuse prior evidence only when its Git-tree fingerprint for every executable and release input has an immutable evidence marker written after all admitted complete lanes succeeded. A missing marker, an unknown path, an unavailable comparison, or a newly introduced path fails closed by requiring every admitted complete lane. Evidence-only documentation commits must not recursively rebuild an unchanged application merely to record the preceding successful run.

Pre-purge hosted proof on 2026-08-17 established both sides of the then-current impact-aware path: a release-affecting revision passed the complete portable and macOS lanes and recorded its executable-input fingerprint, then a documentation-only revision restored that marker, reported `verified-inputs-unchanged`, ran documentation links, and skipped every other portable step plus the complete macOS job. Both revisions independently passed repository safety. Their obsolete run records are not retained after privacy history cleanup. Current hosted evidence must re-establish the behavior across every admitted lane without weakening a product gate.

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

`npm run check:public-release-signing-config` validates the separate versioned Linux checksum-signing trust set on
every complete quality run. Its canonical inactive state admits no key; activation remains an accountable human gate.

`npm run verify:linux-public-release -- <candidate-directory>` independently reopens the complete Linux release and
Pages snapshots. It cryptographically authenticates the checksum inventory, stable metadata, the Debian updater
package, and the retained macOS updater package; binds manifest, inventory, upgrade, and provenance subjects; and
rejects any extra, absent, cross-version, cross-target, or byte-divergent artifact.

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
channel over loopback HTTPS, and drives
the real `pkexec` and `dpkg` replacement boundary under Xvfb. Temporary Polkit rules grant only the current test user
permission to install exact candidate or predecessor packages retained below one isolated recovery root; cleanup
removes the rule and package after every scenario. The campaign covers successful replacement, automatic native
rollback after candidate rejection or a real Debian pre-installation failure, and recovery when predecessor
authorization is initially unavailable. That last scenario first permits only candidate installation, verifies the
runnable fallback and visible first-attempt intervention, then grants the predecessor boundary and activates the real
retry action. A separate authorization-exhaustion scenario preserves the denial through three real package-manager
attempts and verifies the final manual-reinstall state, retained library, and retained evidence. The restart scenario
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

The current executable entry points are `npm run doctor` for prerequisite diagnosis, `npm run test:fast` for the contributor loop, `npm run benchmark:import` for the release-mode 10,000-entry and 5-GiB import, exact-repeat, query, and memory budgets, `npm run benchmark:dense-history` for long supported-signal import, storage, discovery, overview, and exact-page budgets, `npm run benchmark:insights` for production activity, training, sleep, recovery, and integrated longitudinal read-model budgets, `npm run verify:e2e` for the shared functional and in-WebView performance instrumented journey, and `npm run verify:linux-e2e` for that same campaign through an installed Debian package. `npm run verify:precommit` composes every acceptance gate that can truthfully run against a changed working tree and prepares a production-shaped package. After that coherent candidate is committed, `npm run verify:full` repeats the complete pre-commit chain against the exact clean revision and adds the source-bound cold-launch, production-bundle, and update-recovery-preparation gates. A clean-gate failure keeps the candidate local; it is corrected in a subsequent focused commit and the complete command is rerun. `npm run render:product-surfaces` projects the canonical public status into the README and product page; `npm run check:product-surfaces` rejects divergence, and `npm run check:site` verifies the static page contract and accessibility. `npm run check:presentation-inventory` follows the production import graph and rejects orphan modules, locale messages, CSS classes, automation scripts, and packaged-test files; dynamic typed dictionaries, generated class families, SVG-owned classes, and Leaflet-owned classes are explicit consumers rather than blanket exclusions. `npm run check:vendored-updater` verifies the exact updater source allowlist, checksums, dependency path, and frontend exclusion; `npm run test:vendor-updater` exercises its bounded-transfer refinement outside the FitFreed workspace package set. `npm run check:workflows` installs and executes checksum-pinned actionlint and ShellCheck binaries, while `npm run check:public-release-workflow` enforces the closed trigger, action-pin, environment, permission, secret, cleanup, and promotion topology. `npm run check:docs` verifies links and the version, section, release-state, locale, support, operations, manual-evaluation, and release-note contracts of the public documentation set. These checks are part of the fast lane, while formatting and strict Clippy cover both Rust source trees. `npm run prepare:development-release -- <version>` requires a clean commit and creates private production artifacts, SBOMs, checksums, a manifest, and draft notes; `npm run verify:development-release` exercises integrity, installation, first launch, failure, relaunch, and removal boundaries. `npm run verify:update-recovery-preparation` uses the production `FitFreed.app`, a temporary synthetic library, and the real macOS copy adapter to prove the complete pre-replacement recovery pair without downloading or installing an update. `npm run verify:update-e2e` creates ephemeral signing and TLS authority, builds isolated instrumented 0.1.0 and 0.2.0 bundles, serves a schema-valid signed channel over loopback HTTPS, and proves native replacement, automatic application/library recovery, receipt-before-deletion terminal cleanup, localized outcome presentation, and explicit acknowledgement. Continuous integration invokes the same underlying versioned tasks as separate diagnosable steps and never uploads the unsigned package.

Every production-shaped Rust build passes compiler arguments through the robust encoded Cargo environment and remaps
the source checkout, build user home, explicit Cargo and Rustup homes, and temporary roots to stable virtual prefixes.
Existing explicit compiler arguments remain effective, including values that contain spaces. Production and
revision-isolated review inspection traverse the complete application bundle and fail when they find a macOS, Linux,
or Windows user-home or temporary path, or any E2E routing marker. The scanner reports only the affected path class;
it never echoes the matched local value into logs.

All three Rust performance campaigns share the dedicated `src-tauri/target/performance-benchmarks` Cargo target.
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
