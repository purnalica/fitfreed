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

- Change-scope detection without skipping required dependency checks.
- Unit, integration, E2E, migration, performance, packaging, and platform matrices.
- Code quality, dependency-boundary, security, license, secret, and supply-chain checks.
- Documentation, links, examples, translation catalogs, placeholders, and locale coverage.
- Reproducibility, artifact integrity, software bill of materials, and provenance generation.
- Retention of diagnostic evidence that contains no personal data or secrets.

### Release and distribution

- Version derivation from an explicit reviewed release input.
- Change-log and release-note assembly.
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

Repository-safety automation begins before the application stack is selected:

- `scripts/check-repository-content.sh` checks candidate files and public Git metadata for local paths, personal export names, email disclosure, credential-shaped content, unreviewed binaries, and other publication-policy violations.
- `scripts/run-secret-scan.sh` scans both candidate working-tree content and complete Git history using a checksum-verified, pinned Gitleaks CLI.
- `scripts/check-initial-publication.sh` enforces the reviewed initial allowlist, staged scope, repository-local public-safe Git identity, expected remote, content checks, secret scans, and staged diff integrity.
- `.github/workflows/repository-safety.yml` runs the content and secret checks with complete history and a SHA-pinned checkout action.

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
- Continuous-integration provider and supported runner matrix.
- Release-channel and artifact-promotion model.
- Dependency-update and scheduled-maintenance tooling.
- Collaborative translation platform and synchronization mechanism.
- Signing and notarization infrastructure for each supported operating system.
