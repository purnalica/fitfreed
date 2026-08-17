# Documentation Policy

## Purpose

Documentation is part of the FitFreed product and its engineering system. A change is incomplete when users, contributors, maintainers, translators, packagers, or operators cannot understand and safely use the behavior it introduces.

Documentation evolves in the same reviewed increment as the product, architecture, automation, or process it describes. It is not postponed to a cleanup milestone.

## Audiences and canonical homes

| Audience or knowledge | Canonical home |
|---|---|
| Product purpose, scope, behavior, and acceptance | `docs/requirements.md` |
| Milestone order and outcome boundaries | `docs/roadmap.md` |
| Current thematic architecture | `docs/architecture/` |
| Durable architecture decisions and their rationale | `docs/architecture/decisions/` |
| User installation, import, exploration, update, recovery, privacy, and removal guidance | Versioned user-documentation sources selected with the application stack |
| Contributor setup, build, run, test, package, and release workflows | `README.md`, `CONTRIBUTING.md`, and versioned developer documentation |
| Provider exports, canonical data, source mappings, portable exports, persistence schemas, and migrations | [`docs/data-formats/`](data-formats/) |
| Current public-release readiness state and evidence links | [`docs/testing/public-release-readiness.md`](testing/public-release-readiness.md) |
| Security, support, governance, and community behavior | Root community health files |
| Temporary or external research inputs | Ignored local research directories under `docs/reports/` or `.local/` |

Each fact has one canonical source. Other documents link to it rather than copying a second version that can drift.

## Documentation required with a change

Every change review determines whether it affects:

- User behavior, workflows, errors, recovery, data handling, or known limitations.
- Development prerequisites, setup, commands, test selection, debugging, packaging, or release procedures.
- Architecture boundaries, domain language, invariants, data models, schemas, migrations, or integrations.
- Provider compatibility, provenance, transformations, unsupported information, or reconciliation behavior.
- Accessibility, localization, privacy, security, performance, installation, updates, or platform support.
- Product scope, roadmap sequencing, governance, support, or contributor workflow.

Affected canonical documentation is updated in the same commit. A pull request that legitimately requires no documentation change states why.

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
