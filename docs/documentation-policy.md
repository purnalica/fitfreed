# Documentation Policy

## Purpose

Documentation is part of the FitFreed product and its engineering system. A change is incomplete when users, contributors, maintainers, translators, packagers, or operators cannot understand and safely use the behavior it introduces.

Documentation evolves in the same reviewed increment as the product, architecture, automation, or process it describes. It is not postponed to a cleanup milestone.

## Single source of truth

Single source of truth (SSOT) is a mandatory, cross-cutting FitFreed principle. Every requirement,
decision, contract, status, procedure, compatibility fact, and product claim has exactly one
canonical source. Application surfaces, the product page, the README, plans, tests, automation, and
other documentation may derive from or link to that source; they must not establish a competing
copy with an independent lifecycle.

When a fact changes, the canonical source changes first in the same increment. Every affected
consumer is then regenerated, updated, or reduced to a link. Review must reject unexplained
duplication even when the copies still agree, because agreement at one point in time does not create
a maintainable contract. If the canonical home is unclear, it is selected explicitly before new
knowledge is recorded.

## Audiences and canonical homes

| Audience or knowledge | Canonical home |
|---|---|
| Product purpose, scope, behavior, and acceptance | `docs/requirements.md` |
| Product argument, GDPR framing, and public messaging constraints | `docs/product-thesis.md` |
| Milestone order and outcome boundaries | `docs/roadmap.md` |
| Accepted screen, interaction, navigation, and adaptive experience contracts | `docs/design/` |
| Public available, active, and later capability snapshot | `docs/product-status.json`, rendered into entry surfaces by `npm run render:product-surfaces` |
| Repository and public-product entry surfaces | `README.md` and `site/`, derived from and linked to their canonical product sources |
| Current thematic architecture | `docs/architecture/` |
| Durable architecture decisions and their rationale | `docs/architecture/decisions/` |
| User installation, import, exploration, update, recovery, privacy, and removal guidance | Versioned user-documentation sources selected with the application stack |
| Contributor setup, build, run, test, package, and release workflows | `README.md`, `CONTRIBUTING.md`, and versioned developer documentation |
| Provider exports, canonical data, source mappings, portable exports, persistence schemas, and migrations | [`docs/data-formats/`](data-formats/) |
| Current public-release readiness state and evidence links | [`docs/testing/public-release-readiness.md`](testing/public-release-readiness.md) |
| Security, support, governance, and community behavior | Root community health files |
| Temporary or external research inputs | Ignored local research directories under `docs/reports/` or `.local/` |

The table assigns canonical homes; it does not authorize duplication between them. Cross-cutting
facts are split by responsibility, and each consumer links to the one source that owns the exact
claim it uses.

## Documentation required with a change

Every change review determines whether it affects:

- User behavior, workflows, errors, recovery, data handling, or known limitations.
- Development prerequisites, setup, commands, test selection, debugging, packaging, or release procedures.
- Architecture boundaries, domain language, invariants, data models, schemas, migrations, or integrations.
- Provider compatibility, provenance, transformations, unsupported information, or reconciliation behavior.
- Accessibility, localization, privacy, security, performance, installation, updates, or platform support.
- Product scope, roadmap sequencing, governance, support, or contributor workflow.

Affected canonical documentation is updated in the same commit. A pull request that legitimately requires no documentation change states why.

Review also identifies every affected downstream consumer of the changed source of truth. Updating
only the canonical document while leaving a stale derived UI, test, page, plan, or command is not a
complete change.

Commands and examples must be executed from a clean or controlled environment before publication. Screenshots, fixtures, logs, and examples use synthetic data exclusively.

## Architecture decision records

An architecture decision record is required when a choice:

- Establishes or changes a durable system boundary, technology, data model, persistence strategy, security posture, distribution mechanism, or cross-cutting engineering policy.
- Selects between credible structural alternatives with consequences that future contributors need to understand.
- Is expensive or risky to reverse.
- Supersedes an earlier accepted decision.

ADRs do not replace current architecture documentation. The ADR records the context, decision, alternatives, consequences, and verification at the time of the choice; thematic architecture documents describe the current system. Accepted ADRs are immutable except for status and links to a superseding ADR or corrections that do not rewrite the original decision.

ADR statuses are `Proposed`, `Accepted`, `Superseded`, `Deprecated`, or `Rejected`. Files use the form `NNNN-short-title.md`, with monotonically increasing four-digit identifiers. The index and template in `docs/architecture/decisions/` define the workflow.

## Quality and lifecycle

- All project-authored artifacts are English, including local drafts and proposed asset guides. Spanish appears only in `es-ES` localization resources. Externally authored reference material may retain its source language only in ignored local research storage and never becomes canonical project documentation as-is.
- Links, headings, code examples, command output assumptions, and locale catalogs are validated automatically where practical.
- Documentation must state its status and distinguish current behavior from proposals or open decisions.
- Stale instructions are defects. A behavior change never leaves obsolete instructions in the current tree.
- Historical exploration is removed from the current tree when it no longer has a durable audience; Git history and ADRs preserve the rationale that still matters.
- User-facing releases include version-matched documentation and known limitations.
- Release notes describe observable change and required user action without substituting for permanent documentation.

## Acceptance evidence

An increment is documentation-complete when:

1. Every affected audience can find the canonical current guidance.
2. Documented commands and examples have verification evidence.
3. Architectural consequences are reflected in current thematic documentation and, when required, an ADR.
4. User-visible behavior and recovery paths are documented for every supported locale and release channel in scope.
5. Affected data contracts, mappings, schemas, migrations, and synthetic examples agree with automated contract evidence.
6. No private data, secrets, machine-local paths, or unlicensed assets appear in published material.
