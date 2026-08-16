# Project Instructions

## Language

- Use English exclusively for canonical engineering and source artifacts.
- This rule covers source code, identifiers, comments, technical documentation, tests, fixtures, logs, configuration, scripts, issue and pull-request content, commit messages, and release materials.
- It also covers local project-authored drafts and proposed assets. Externally authored reference material may remain in its source language only while it stays in an ignored local research directory and is not treated as project documentation.
- Localized user-interface and localized user-documentation resources are the only permitted multilingual artifacts.
- Keep all canonical user-facing source strings in English and maintain translations in separate locale resources.
- The initial user interface supports English for the United States (`en-US`) and Spanish for Spain (`es-ES`).
- Design localization resources for established collaborative translation tools and make additional locales additive.

## Requirements

- Treat `docs/requirements.md` as the canonical source for product requirements and confirmed constraints.
- Follow `docs/naming.md` for the approved `FitFreed` product identity and its technical identifiers.
- Follow `docs/product-thesis.md` for the central product argument: GDPR-enabled portability plus open-source software enables meaningful user freedom.
- Follow `docs/repository-content-policy.md` before staging, committing, packaging, or publishing any project artifact.
- Do not claim that the GDPR mandates a particular ZIP or that the product provides legal compliance; verify legal claims against authoritative sources.
- Do not replace a provider silo with an application silo: preserve local-first use, documented portability, provenance, recoverability, and a supported exit path.
- Update the canonical documentation in the same change whenever behavior, architecture, installation, operation, or contribution procedures change.
- Follow `docs/documentation-policy.md`; user, developer, operational, compatibility, and architecture documentation are part of the acceptance criteria for every affected increment.
- Follow `docs/data-formats/README.md`; every provider format and every FitFreed-owned canonical, mapping, portable, persistence, and migration contract must remain completely documented and verified with synthetic contract evidence.
- Record durable structural decisions as ADRs under `docs/architecture/decisions/` and update current thematic architecture in the same change.
- Never add the provided Polar Flow export or any derived personal data to the repository.
- Keep the product name, visual identity, domain model, and general product language vendor-neutral.
- Confine provider schemas and terminology to importer adapters, source-specific compatibility documentation, and factual attribution.
- Follow `docs/architecture/source-integration.md` for importer boundaries and provider-neutral modeling.
- License project source under `GPL-3.0-or-later` and verify dependency compatibility before adoption.
- Implement only the confirmed MVP scope in `docs/requirements.md` before post-MVP capabilities.

## Delivery

- Build the product gradually through small, runnable, end-to-end vertical increments.
- Make every increment observable and suitable for early user or contributor evaluation.
- Do not present disconnected user-interface, application, domain, or persistence work as a completed product increment.
- Preserve the full architecture, testing, documentation, localization, accessibility, privacy, and quality requirements in every increment.
- Record evaluation feedback and update canonical requirements before changing agreed scope or constraints.
- Maintain the product roadmap in `docs/roadmap.md` and create a detailed execution plan for the current milestone before implementation.
- Keep the roadmap, milestone execution plans, and implementation backlog distinct and traceable.
- Protect the MVP critical path from post-MVP features and speculative infrastructure.
- Reduce MVP scope when explicitly decided, never the quality of behavior included in that scope.
- Treat installation, signed distribution, update notification, safe migration, and update recovery as MVP product behavior on every supported platform.
- The MVP is a private macOS alpha and is explicitly unsigned and non-notarized.
- Never publish or promote an unsigned macOS binary to a public release channel.
- Require Developer ID signing, Apple notarization, and Gatekeeper verification for the first public macOS release.
- Linux follows the public macOS release, and Windows follows Linux.

## Autonomous Execution

- Follow `docs/execution-policy.md` as the canonical autonomy and intervention policy.
- Continue through planned in-scope work without asking whether to proceed.
- Create a focused local commit whenever a coherent increment passes its applicable verification gates. Do not batch unrelated completed increments into one commit.
- After each verified commit, scan the complete outgoing range and perform a normal fast-forward push to `origin/main`. This standing authority does not permit force-push, tags, releases, other branches or remotes, or repository-setting changes.
- SSH authentication uses Secretive and may be denied or wait while the project owner is away. Keep push attempts bounded; if authentication is unavailable, record synchronization as pending and continue local commits and useful in-scope work. Retry later unless confirmed remote state is strictly required by the active objective.
- An explicit project-owner instruction to suspend pushes while unavailable overrides the standing push authority and retry behavior. Continue safe local work and do not attempt another push until a later project-owner message lifts the suspension.
- If repository metadata is temporarily read-only, do not bypass the restriction. Preserve verified working-tree changes and continue work that does not require Git metadata writes until focused commits can resume.
- Resolve ordinary reversible technical decisions through evidence and document material trade-offs.
- Diagnose failures to their root cause and continue safe in-scope work.
- Pause only at a documented human intervention gate when no safe in-scope path remains.
- Never treat autonomy as permission to change scope, weaken constraints, publish releases or packages, use credentials, create tags, force-push, push another target, or perform destructive actions without the required authority. Focused local commits and normal pushes to `origin/main` are explicitly authorized by the project owner.
- Preserve cryptographic verification of update artifacts even while the macOS MVP lacks Apple code signing and notarization.
- Block publication when clean installation, any supported update path, interrupted-update recovery, or data preservation has not been verified with release-shaped artifacts.

## Testing

- Treat unit, integration, and end-to-end tests as required product-quality evidence.
- Follow `docs/testing-strategy.md` as the canonical testing policy.
- Add or update tests in the same increment as the behavior they protect.
- Test behavior and persisted outcomes rather than production-code structure.
- Use synthetic fixtures only; never copy personal values from the reference export.
- Do not remove or weaken assertions to accommodate structural changes.
- Keep strict test-double validation enabled and declare test dependencies where they are consumed.
- Diagnose root causes before changing tests or production code.
- Treat flaky tests as defects; do not hide them through retries or disabled quality gates.
- Use `docs/quality-targets.md` as the canonical source for performance, accessibility, localization, and reliability budgets.

## Automation

- Follow `docs/automation-strategy.md` as the canonical automation policy.
- Automate every reliable repeatable process and document any justified manual step.
- Reuse the same underlying versioned commands locally and in continuous integration.
- Keep automation deterministic, non-interactive by default, diagnosable, and safe to rerun.
- Never embed secrets, signing material, personal data, or sensitive diagnostics in automation or artifacts.
- Preserve explicit human approval for scope, architecture, security exceptions, signing authority, public releases, and irreversible user-data operations.

## Git and GitHub Email Privacy

- The local repository and private `purnalica/fitfreed` remote exist. Focused local commits and normal fast-forward pushes to `origin/main` are authorized after the applicable gates pass. Tags, force-pushes, other targets, public release artifacts, and remote-setting changes are not authorized by that standing permission.
- Stage the first public history through an explicit reviewed allowlist. Do not use a broad `git add .` for initial publication.
- Never use or publish a private personal email address in commits, tags, signatures, trailers, package metadata, documentation, fixtures, logs, generated artifacts, issues, pull requests, or release materials.
- Use the GitHub-provided `noreply` address associated with the intended account for repository-local `user.email`.
- Obtain the exact ID-based `noreply` address from the GitHub account email settings; do not construct or guess it from the username.
- Enable both GitHub email settings: `Keep my email addresses private` and `Block command line pushes that expose my email`.
- Do not assume that global Git identity settings are safe for a public repository.
- Verify author, committer, tagger, signature-identity, and trailer metadata before every initial publication, history import, or automated release.
- Scan the complete outgoing commit and tag range locally. GitHub's account-level command-line protection checks only the most recent pushed commit and is not a complete history audit.
- Use GitHub handles instead of email addresses for attribution and ownership where supported.
- Do not add `Co-authored-by`, `Signed-off-by`, or similar trailers containing an email unless that exact address is explicitly approved for public use or is an appropriate `noreply` address.
- Prevent email exposure before publication; do not rely on rewriting public history as a routine correction.
- Validate privacy without printing the configured private or global email address into logs or conversation output.
