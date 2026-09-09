# Governance

## Status

FitFreed currently uses a bootstrap governance model suitable for its pre-release stage. The repository is owned by the `purnalica` GitHub organization, and `@matutet` is the initial project owner and maintainer.

This document describes the current decision path rather than promising a permanent governance structure. It will evolve transparently as sustained contributors assume responsibility.

## Roles

### Project owner

The project owner is accountable for product purpose, confirmed scope, licensing, public identity, governance changes, release authority, and appointment or removal of maintainers.

### Maintainers

Maintainers review contributions, protect architecture and quality constraints, triage reports, maintain automation and documentation, and prepare releases. Maintainer status requires a sustained record of sound contributions and explicit appointment recorded in this document.

### Contributors

Contributors propose and review changes through the documented issue and pull-request workflow. Contribution does not require maintainer status, and decisions must be based on product evidence and published constraints rather than personal authority.

## Decision making

- Confirmed product scope and constraints are maintained in `docs/requirements.md`.
- Milestone order and boundaries are maintained in `docs/roadmap.md`.
- Durable architecture choices use architecture decision records once implementation design begins.
- Reversible implementation choices are resolved by maintainers through evidence, tests, and documented trade-offs.
- Material changes to scope, license, governance, security posture, public identity, platform order, or release policy require the project owner's explicit decision.
- Security reports and conduct incidents are handled confidentially and never decided by public vote.

Consensus is preferred when several maintainers are active. Until that point, the project owner resolves unresolved material decisions and records the rationale. Passing automation is required where applicable but does not override product, architecture, privacy, security, accessibility, or licensing review.

## Bootstrap release approvals

While the project has one active maintainer, the project owner may initiate and approve both protected deployments in
the release workflow: candidate construction and the later promotion of the exact evaluated candidate. Each remains a
separate explicit approval. Release environments require the project owner as a reviewer, allow initiator approval,
disable administrator bypass, and admit only version tags.

This bootstrap policy does not bypass signing, notarization, sealed-candidate evaluation, native-platform admission,
immutable publication, or remote verification. Person-level separation will be reconsidered through an explicit
governance decision when at least two active maintainers can assume release responsibility. [ADR 0047](docs/architecture/decisions/0047-permit-bootstrap-solo-release-approval.md)

## Becoming a maintainer

There is no application quota or automatic threshold. A prospective maintainer should demonstrate sustained contributions, respectful review, sound judgment across project constraints, reliable follow-through, and willingness to perform maintenance work beyond feature implementation.

Appointments, responsibility areas, and departures will be recorded here through a reviewed change.

## Governance evolution

The model should distribute authority as the contributor base becomes capable of sustaining it. Changes must preserve clear accountability for releases, security, data integrity, and community safety.
