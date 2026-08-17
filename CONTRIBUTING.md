# Contributing to FitFreed

## Current project stage

FitFreed is implementing Milestone 3 public macOS readiness on its Tauri 2, Rust, TypeScript, React, and SQLite foundation. No supported release is available, and public contribution workflows use independently constructed synthetic fixtures only. Contributions are currently most useful when they close a documented readiness gate, improve a bounded behavior without widening MVP scope, or strengthen architecture, tests, data contracts, localization, user guidance, and contributor automation together.

Review the [requirements](docs/requirements.md), [roadmap](docs/roadmap.md), [data format documentation](docs/data-formats/README.md), and [repository content policy](docs/repository-content-policy.md) before starting work.

Follow the [contributor setup](docs/development/getting-started.md) to install the pinned toolchains and run the same commands as continuous integration.

## Before proposing a change

- Check the existing issue tracker and documentation for the relevant decision or requirement.
- Use an issue to propose a product-scope, architecture, dependency, data-format, security, or user-experience change before investing in implementation.
- Keep proposals within the current milestone and MVP boundary.
- Explain the user or contributor outcome, not only the requested implementation.
- Never use a real provider export as an example or attach personal diagnostics.

Small corrections that preserve confirmed behavior and scope do not require a separate design proposal.

## Contribution workflow

1. Create a focused branch from the current default branch.
2. Make the smallest complete change that proves its intended outcome.
3. Add or update behavioral tests and canonical documentation in the same change.
4. Run `npm run test:fast` during development and `npm run verify:full` before proposing the completed change.
5. Review the complete diff for personal data, secrets, generated files, dependency licenses, and unrelated changes.
6. Open a pull request using the repository template and report any verification that could not be executed.

Do not weaken tests, architecture rules, accessibility, localization, installation, update, privacy, or data-integrity requirements to make a change pass.

## Language and localization

English is the canonical project language for source code, identifiers, tests, technical documentation, issues, pull requests, and release material. User-interface translations live in locale resources; the initial locales are `en-US` and `es-ES`.

Do not place translated interface strings directly in source code or mix languages in canonical technical artifacts.

Follow the [localization guide](docs/development/localization.md) when changing interface copy, formatting, locale persistence, or supported languages.

## Personal data and fixtures

Real exports and anything derived from them must remain outside version control, including databases, reports, screenshots, logs, routes, physiological values, identifiers, and benchmark results.

Versioned fixtures must be independently constructed, synthetic, minimal, and traceable to a documented scenario. Replacing obvious values in a copied real record does not make it synthetic.

If a defect can only be reproduced with private data, describe the structural condition without submitting the data. Security-sensitive cases follow [SECURITY.md](SECURITY.md).

## Architecture and quality

- Keep provider parsing and terminology inside source adapters and their compatibility documentation.
- Keep domain and application code independent of the UI, persistence, operating system, and provider formats.
- Protect logical identity, reconciliation, idempotency, provenance, and recovery as explicit behavior.
- Update provider references, FitFreed specifications, mappings, schemas, migrations, and synthetic contract evidence together with any data-contract change.
- Prefer a complete vertical slice over disconnected layer work.
- Test user-visible and persisted outcomes, including error and recovery paths.
- Keep developer and continuous-integration commands equivalent.

## Commits and identity privacy

Use concise English commit messages that describe the outcome. Configure a public-safe Git identity before committing. GitHub contributors who wish to keep their address private should use the exact ID-based `users.noreply.github.com` address provided by their GitHub account settings.

Do not add email-bearing trailers such as `Co-authored-by` or `Signed-off-by` unless every address is intentionally public or an approved `noreply` address.

## Pull-request expectations

A pull request must identify:

- The problem and intended outcome.
- The requirement, issue, or decision it implements.
- Behavioral verification performed.
- Documentation and localization impact.
- Privacy, security, migration, installation, and update impact where applicable.
- Remaining limitations or unverified paths.

Review is evidence-based. Approval is not implied by prior discussion, passing automation alone, or the size of a change.
