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

GitHub Actions is the selected continuous-integration provider for the GitHub-hosted repository. The product workflow combines platform-independent checks with a mandatory macOS packaged-E2E and private-release-evidence job. Local and hosted execution call the same versioned project commands; the workflow does not encode a parallel test path.

Hosted verification is impact-aware. Every revision runs the versioned impact classifier, documentation links, and independent repository-safety gate. The complete portable lane and the costly macOS packaging, installation, recovery, cold-launch, import, query, rendering, and packaged-E2E lane run when any executable or release-affecting input changes, and they always run for an explicit release-candidate or manual verification request. Within the macOS lane, the production package and cold-launch gate precede the long synthetic import and Insights campaigns so a startup failure stops expensive downstream work early; every gate still runs after that check passes. A documentation-only revision may reuse prior evidence only when its Git-tree fingerprint for every executable and release input has an immutable evidence marker written after both complete lanes succeeded. A missing marker, an unknown path, an unavailable comparison, or a newly introduced path fails closed by requiring both complete lanes. Evidence-only documentation commits must not recursively rebuild an unchanged application merely to record the preceding successful run.

Pre-purge hosted proof on 2026-08-17 established both sides of the impact-aware path: a release-affecting revision passed the complete portable and macOS lanes and recorded its executable-input fingerprint, then a documentation-only revision restored that marker, reported `verified-inputs-unchanged`, ran documentation links, and skipped every other portable step plus the complete macOS job. Both revisions independently passed repository safety. Their obsolete run records are not retained after privacy history cleanup. Current hosted evidence must re-establish the behavior without weakening either product gate.

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

Unsigned macOS MVP alpha artifacts remain in restricted evaluation workflows. Public macOS release automation must use protected Developer ID credentials, complete notarization, verify the stapled ticket and Gatekeeper result, and refuse promotion when any trust check fails.

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

The current executable entry points are `npm run doctor` for prerequisite diagnosis, `npm run test:fast` for the contributor loop, `npm run benchmark:import` for the release-mode 10,000-entry and 5-GiB import, exact-repeat, query, and memory budgets, `npm run benchmark:insights` for production activity, training, sleep, recovery, and integrated longitudinal read-model budgets, `npm run verify:e2e` for the functional and in-WebView performance instrumented journey, and `npm run verify:full` for every local acceptance gate followed by a clean production package. `npm run check:vendored-updater` verifies the exact updater source allowlist, checksums, dependency path, and frontend exclusion; `npm run test:vendor-updater` exercises its bounded-transfer refinement outside the FitFreed workspace package set. Both are part of the fast lane, while formatting and strict Clippy cover both source trees. `npm run prepare:development-release -- <version>` requires a clean commit and creates private production artifacts, SBOMs, checksums, a manifest, and draft notes; `npm run verify:development-release` exercises integrity, installation, first launch, failure, relaunch, and removal boundaries. `npm run verify:update-recovery-preparation` uses the production `FitFreed.app`, a temporary synthetic library, and the real macOS copy adapter to prove the complete pre-replacement recovery pair without downloading or installing an update. `npm run verify:update-e2e` creates ephemeral signing and TLS authority, builds isolated instrumented 0.1.0 and 0.2.0 bundles, serves a schema-valid signed channel over loopback HTTPS, and proves native replacement, automatic application/library recovery, receipt-before-deletion terminal cleanup, localized outcome presentation, and explicit acknowledgement. Continuous integration invokes the same underlying versioned tasks as separate diagnosable steps and never uploads the unsigned package.

Repository-safety automation begins before the application stack is selected:

- `scripts/check-repository-content.sh` checks candidate files and publishable branch, remote, and tag metadata for local paths, personal export names, exact workstation fingerprints in public documentation, email disclosure, credential-shaped content, unreviewed binaries, and other publication-policy violations.
- `scripts/run-secret-scan.sh` scans both candidate working-tree content and complete branch, remote, and tag history using a checksum-verified, pinned Gitleaks CLI.
- `scripts/check-initial-publication.sh` enforces the reviewed initial allowlist, staged scope, repository-local public-safe Git identity, expected remote, content checks, secret scans, and staged diff integrity.
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

- Primary cross-platform task runner and environment provisioning approach.
- Linux and Windows runner expansion after their platform milestones begin.
- Release-channel and artifact-promotion model.
- Dependency-update and scheduled-maintenance tooling.
- Collaborative translation platform and synchronization mechanism.
- Signing and notarization infrastructure for each supported operating system.
