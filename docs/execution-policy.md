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

A release-workflow, release-policy, documentation, or semantic-version-only correction does not by itself invalidate
functional, performance, packaged-E2E, installation, update-recovery, or platform evidence for otherwise unchanged
application behavior. Verify the changed release contract at its owning boundary and reuse existing fingerprint-bound
product evidence. Run a complete product campaign only when product behavior or a target-native artifact property has
changed, or when the final sealed candidate must prove the exact bytes that earlier evidence could not cover. Never
run the same complete E2E journey both before and after a metadata-only commit.

The complete acceptance matrix remains mandatory. This policy changes when evidence is gathered, not which product,
security, recovery, accessibility, localization, performance, or documentation requirements must pass.

## Goal lifecycle discipline

An autonomous goal must represent one reviewable product or delivery outcome. It must not remain open as a historical
umbrella for several completed milestones, later corrective programmes, and unrelated release gates.

Before implementation starts, the owning execution plan must state:

- The exact outcome whose acceptance state will change when the goal completes.
- The finite exit criteria and the evidence owner for each criterion.
- The capabilities explicitly outside the goal, including valuable adjacent work that does not block its outcome.
- The human gates that may remain open after all autonomous work is complete.

Only one unresolved implementation boundary may be active at a time. New findings enter the owning backlog unless
they invalidate that boundary or make its evidence untrustworthy. Progress is the proportion of exit criteria proved,
not elapsed time, commands run, commits made, tests executed, or documentation produced.

A goal closes when its finite autonomous exit criteria pass and every remaining external decision is recorded at its
documented human gate. A later milestone, platform, corrective programme, or publication decision starts a separate
goal instead of silently extending the existing one.

The execution loop must stop for a process review before further broad verification when either condition occurs:

- The same acceptance boundary fails after two causal corrections.
- An equivalent complete campaign would run more than once for unchanged executable inputs.

The review must identify the repeated uncertainty, challenge the current test or implementation boundary, remove
superseded work, and record the narrower next experiment. It must not weaken an acceptance criterion or raise a
product budget merely to make the loop end.

## Iteration admission and verification levels

The written policy is not sufficient unless the execution topology enforces it. Before changing executable inputs or
starting hosted verification, the active execution plan must contain one current iteration record with:

- The single acceptance boundary being advanced and the exact source revision of its evidence.
- The observed failure, its causal hypothesis, and the layer that owns the violated contract.
- The smallest test capable of falsifying that hypothesis.
- The contracts and files allowed to change in the iteration.
- Evidence that remains valid and therefore must not run again.
- The exit condition and the condition that stops the experiment without another correction.

Only one iteration record may be active. If these fields cannot be stated, further implementation or broad
verification is premature.

Verification advances through four levels:

1. **Focused contract:** the smallest unit, integration, automation, or source-level test proving the correction.
2. **Affected boundary:** the relevant package, operating-system adapter, or focused packaged journey.
3. **Native parity:** target-native verification for every platform whose executable behavior changed.
4. **Candidate admission:** one complete clean-revision campaign across the acceptance matrix.

A failed candidate does not go directly to another candidate campaign. Its correction must first pass levels 1 and 2,
then level 3 when native behavior is involved. Candidate admission runs once after all known failed boundaries are
closed together.

Push automation must distinguish ordinary verified increments from candidate admission. An ordinary push runs fast
portable checks and only the affected native boundary; it must not start unrelated packaged operating-system
campaigns. The complete campaign is an explicit autonomous candidate action after the execution plan records that all
focused boundaries are closed. If the workflow cannot express that distinction, correcting the workflow topology is
the next task; repeatedly paying for an undifferentiated campaign is not an acceptable substitute.

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
- Run impact-mapped focused checks before creating a commit. `npm run verify:precommit` is the broad portable source
  gate and deliberately excludes benchmarks, packaged E2E, update recovery, and packaging. Run `npm run verify:full`
  once from an exact clean revision only when changed product behavior or a target-native artifact property requires
  candidate admission. A release-workflow, release-policy, documentation, or semantic-version-only correction uses
  its focused contracts and the protected exact-artifact pipeline instead of a local product campaign. A failed
  clean-revision gate requires a focused causal correction followed by one new complete run; it does not authorize a
  dirty-tree rehearsal of that same campaign.
- The project owner has authorized a normal push to `origin/main` after every verified commit. The complete outgoing range must pass content, secret, and identity checks immediately before each push.
- Creating tags, force-pushing, pushing another target, publishing releases or packages, or changing remote settings remains a separate action that requires explicit authority. The project owner authorized the GitHub Pages product-site setting and deployment on 2026-08-18; this does not authorize an application release or update channel.
- Creating or changing external repositories, packages, releases, update channels, or public communications requires explicit authority for the exact target and action.
- Credentials, signing identities, notarization access, and destructive personal-data operations remain separate human gates.

Repository content classification and the pre-publication gate are defined in `repository-content-policy.md`.
