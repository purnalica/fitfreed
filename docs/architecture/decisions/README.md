# Architecture Decision Records

This directory contains durable FitFreed architecture decisions. Read [the documentation policy](../../documentation-policy.md) for the distinction between decision history and current thematic architecture.

## Workflow

1. Copy `template.md` to the next monotonically numbered `NNNN-short-title.md` file.
2. Set the status to `Proposed` while credible structural alternatives are being evaluated.
3. Link evidence, prototypes, benchmarks, requirements, and affected architecture documents.
4. Change the status to `Accepted` only when the decision owner has the required evidence and authority.
5. Update current thematic architecture in the same change.
6. Never rewrite an accepted decision to make it appear current. Create a new ADR and mark the old one `Superseded by ADR NNNN`.

## Index

- [ADR 0001: Select the Tauri application stack](0001-select-tauri-application-stack.md) — Accepted on 2026-08-16.
- [ADR 0002: Select SQLite as the single system of record](0002-select-sqlite-storage.md) — Accepted on 2026-08-16.
- [ADR 0003: Stage verifiable macOS development releases](0003-stage-verifiable-macos-development-releases.md) — Proposed on 2026-08-16.

Confirmed product constraints remain in `docs/requirements.md`. Visualization and update-implementation choices remain open until their evidence supports separate decisions.
