# Autonomous Execution Policy

## Objective

Implementation proceeds autonomously through the agreed roadmap. Human interruption is reserved for decisions or actions that require product ownership, credentials, legal authority, external account control, or acceptance of material irreversible risk.

Autonomy does not change product scope, lower quality, or grant authority for public, destructive, or credentialed actions.

## Continue without interruption

Execution continues without asking for routine confirmation when work involves:

- Technology evaluation and reversible implementation choices within confirmed constraints.
- Domain modeling, architecture refinement, code structure, naming inside the codebase, and test design.
- Root-cause diagnosis and correction of build, test, integration, performance, packaging, or user-interface defects.
- Creation and maintenance of source code, synthetic fixtures, tests, documentation, automation, and local artifacts inside the workspace.
- Refactoring required to preserve behavior, architecture, maintainability, or agreed quality targets.
- Running documented local checks and non-destructive diagnostics.
- Selecting the next planned increment after the current increment meets its acceptance gate.
- Creating a focused local commit after a coherent increment passes its applicable documentation, privacy, security, and quality checks.
- Pushing each verified commit with a normal fast-forward push to the exact `origin/main` target after the complete outgoing range passes repository, secret, and identity checks.

## Human intervention gates

Execution pauses only for:

1. **Product authority:** changing confirmed scope, priorities, acceptance criteria, supported platforms, licensing, governance, or another product decision with materially different outcomes.
2. **External publication beyond the standing push authority:** creating or changing a public repository, pushing to another remote or branch, force-pushing, publishing packages or releases, withdrawing a release, or communicating externally as the project owner.
3. **Credentials and legal identity:** GitHub identity, Apple Developer membership, signing keys, notarization credentials, translation-platform accounts, domains, or acceptance of third-party legal terms.
4. **Destructive or irreversible action:** deleting or irreversibly migrating user data, rewriting shared history, replacing published artifacts, or removing external resources.
5. **Security or privacy exception:** weakening a confirmed control, exposing personal data, granting broad access, or accepting a known supply-chain risk.
6. **Unavailable evidence:** required private input, external state, hardware, account access, or a product fact that cannot be discovered safely.
7. **Contradictory requirements:** two confirmed constraints cannot both be satisfied and no interpretation preserves both.

## Pause protocol

A necessary pause reports:

- The exact blocking condition.
- Why no safe in-scope alternative remains.
- Work completed and verification evidence available.
- Any temporary state that must be preserved.
- The smallest specific action or decision required from the project owner.
- The next operation that will run after the blocker is resolved.

## Continuity

- `docs/requirements.md` is the source of product scope and constraints.
- `docs/roadmap.md` is the source of milestone order and MVP boundaries.
- A detailed versioned execution plan will track the active milestone and its evidence.
- Architecture and process knowledge will remain in thematic versioned documentation rather than transient conversation memory.
- Each increment will leave the workspace in a diagnosable state and record incomplete verification explicitly.
- A project-owner reply, correction, or non-blocking question does not pause the active plan. Incorporate it and continue with the next safe in-scope operation in the same working session.
- Do not end a working session by handing routine next steps back to the project owner. Continue executing them until a documented human intervention gate is reached or the agreed objective is complete.
- Progress reports are informational and never require an acknowledgement before execution continues.
- A local sandbox or graphical-session restriction does not by itself create a human intervention gate. Move repeatable verification to a versioned headless or hosted-CI lane when possible. Do not repeatedly use the project owner as a command runner or log relay; reserve a manual platform check for evidence that cannot be automated safely and is required at the current release gate.
- An environment limitation is never grounds for omitting an applicable test or treating unverified behavior as accepted. Make the test environment reproducible, provide an equivalent automated lane, or keep the acceptance gate explicitly open until the required evidence runs successfully.
- SSH authentication is provided locally through Secretive and may require the project owner to be present. Remote synchronization is best-effort and non-blocking: attempt an authorized push with a bounded wait, then record it as pending and continue local commits and in-scope work if authentication is denied or stalls. Retry later without treating the unavailable key as a human intervention gate unless the current objective strictly requires confirmed remote state.
- An explicit project-owner instruction to suspend pushes while unavailable overrides the normal synchronization policy. Do not attempt another push until a later project-owner message lifts the suspension; continue safe local work and record synchronization as pending.
- If repository metadata is temporarily read-only, do not bypass the restriction. Keep verified changes in the working tree, continue work that does not require Git metadata writes, and resume focused commits when repository write access returns.

## Repository and private-data boundaries

- Private reference exports may be read only when they have been explicitly supplied for local analysis. They may not be modified, copied into the workspace, committed, or published.
- Project files and non-destructive local verification may be created or changed within the active task and confirmed scope.
- The project owner has authorized focused local commits throughout autonomous execution. Each commit must contain one coherent verified increment, use public-safe identity metadata, and pass the repository publication safeguards before creation.
- The project owner has authorized a normal push to `origin/main` after every verified commit. The complete outgoing range must pass content, secret, and identity checks immediately before each push.
- Creating tags, force-pushing, pushing another target, publishing releases or packages, or changing remote settings remains a separate action that requires explicit authority. The project owner authorized the GitHub Pages product-site setting and deployment on 2026-08-18; this does not authorize an application release or update channel.
- Creating or changing external repositories, packages, releases, update channels, or public communications requires explicit authority for the exact target and action.
- Credentials, signing identities, notarization access, and destructive personal-data operations remain separate human gates.

Repository content classification and the pre-publication gate are defined in `repository-content-policy.md`.
