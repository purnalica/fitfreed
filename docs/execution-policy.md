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

## Evidence-efficient iteration

Autonomous execution optimizes for resolved acceptance uncertainty, not for the number of commands, tests, commits, or
documents produced. Quality means obtaining the right independent evidence at the right boundary without repeating
evidence that is already valid.

Every implementation loop must:

1. Name the nearest unproven acceptance outcome and the concrete uncertainty preventing it from passing.
2. Trace a failure to its owning contract and causal layer before changing code.
3. Map the changed contract to the smallest sufficient local unit, integration, contract, or focused packaged test
   set. A broad gate is not a substitute for this mapping.
4. Use the target-native hosted lane for operating-system behavior that a development host cannot prove.
5. Run one complete clean-revision campaign only when executable inputs have changed and the revision is ready to be
   admitted as a candidate. Do not start an equivalent local campaign after the same revision is already undergoing
   authoritative hosted verification.
6. Reuse valid fingerprint-bound evidence when executable inputs are unchanged. Documentation-only descendants do not
   repeat native package, performance, or E2E campaigns.
7. After a failure, rerun only the failed boundary and its affected contracts until the correction is stable; return
   to the complete campaign once, at the candidate boundary.
8. Stop or avoid superseded work whose result cannot change the current decision. Record genuinely useful partial
   evidence, but do not keep a campaign alive merely because it has already consumed resources.

The complete acceptance matrix remains mandatory. This policy changes when evidence is gathered, not which product,
security, recovery, accessibility, localization, performance, or documentation requirements must pass.

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
- A human acceptance or publication gate for one platform blocks that platform's acceptance or promotion, not safe
  engineering and automated evidence for a later platform. Later-platform work proceeds when its inputs are stable and
  it does not presume the open gate's outcome. Public promotion still follows the order fixed in `docs/roadmap.md`.
- A local sandbox or graphical-session restriction does not by itself create a human intervention gate. Move repeatable verification to a versioned headless or hosted-CI lane when possible. Do not repeatedly use the project owner as a command runner or log relay; reserve a manual platform check for evidence that cannot be automated safely and is required at the current release gate.
- An environment limitation is never grounds for omitting an applicable test or treating unverified behavior as accepted. Make the test environment reproducible, provide an equivalent automated lane, or keep the acceptance gate explicitly open until the required evidence runs successfully.
- SSH authentication may depend on an interactive local signing agent. Remote synchronization is best-effort and non-blocking: attempt an authorized push with a bounded wait, then record it as pending and continue local commits and in-scope work if authentication is denied or stalls. Retry later without treating unavailable authentication as a human intervention gate unless the current objective strictly requires confirmed remote state.
- An explicit project-owner instruction to suspend pushes while unavailable overrides the normal synchronization policy. Do not attempt another push until a later project-owner message lifts the suspension; continue safe local work and record synchronization as pending.
- If repository metadata is temporarily read-only, do not bypass the restriction. Keep verified changes in the working tree, continue work that does not require Git metadata writes, and resume focused commits when repository write access returns.

## Repository and private-data boundaries

- Private reference exports may be read only when they have been explicitly supplied for local analysis. They may not be modified, copied into the workspace, committed, or published.
- Project files and non-destructive local verification may be created or changed within the active task and confirmed scope.
- The project owner has authorized focused local commits throughout autonomous execution. Each commit must contain one coherent verified increment, use public-safe identity metadata, and pass the repository publication safeguards before creation.
- Run the dirty-tree-compatible `npm run verify:precommit` gate before creating an executable candidate commit. Then
  run `npm run verify:full` from that exact clean revision so startup identity, production bundle, and recovery evidence
  remain source-bound. A failed clean-revision gate keeps the candidate local and requires a corrective focused commit
  plus a complete rerun before push.
- The project owner has authorized a normal push to `origin/main` after every verified commit. The complete outgoing range must pass content, secret, and identity checks immediately before each push.
- Creating tags, force-pushing, pushing another target, publishing releases or packages, or changing remote settings remains a separate action that requires explicit authority. The project owner authorized the GitHub Pages product-site setting and deployment on 2026-08-18; this does not authorize an application release or update channel.
- Creating or changing external repositories, packages, releases, update channels, or public communications requires explicit authority for the exact target and action.
- Credentials, signing identities, notarization access, and destructive personal-data operations remain separate human gates.

Repository content classification and the pre-publication gate are defined in `repository-content-policy.md`.
