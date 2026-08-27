# ADR 0034: Bind each report to one evidence library

- **Status:** Accepted
- **Date:** 2026-08-27
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [FR-010](../../requirements.md#fr-010--user-defined-reports-and-export),
  [FR-020](../../requirements.md#fr-020--fitfreed-format-documentation), and
  [FR-027](../../requirements.md#fr-027--structured-training-intent-phases-and-blocks)
- **Related delivery plan:** [X7-R5](../../plans/mvp-redesign-production-migration.md#x7-r5--import-and-explain-structured-training-intent)
- **Related architecture:** [Reporting](../reporting.md), [ADR 0022](0022-persist-reproducible-evidence-reports.md),
  and [ADR 0033](0033-model-planned-training-as-versioned-intent.md)

## Context

Report definitions currently bind every evidence block to one reviewed `sourceSnapshotRef`. Session and
training-period blocks share the recorded-training library revision, so one stale/current decision, one deliberate
refresh, and one optimistic report revision protect the complete result. Planned targets live in a separate library
with their own `planned-snapshot-` identity because authored intent and recorded execution reconcile independently.

Adding a planned-training block to an arbitrary recorded-training report would therefore create two independently
changing source revisions. Reusing the recorded snapshot for the target would be false, while storing a second
snapshot only in presentation or resolving the latest target silently would make report refresh irreproducible. A
generic composite revision would also require a new multi-source aggregate, conflict protocol, persistence contract,
and review experience; those semantics are not established by the MVP requirement to report one structured plan.

## Considered alternatives

### Resolve planned blocks from the latest target

This would avoid a definition migration, but reopening or exporting the same report could produce different content
without a reviewed report revision. Import would become an implicit report edit and stale evidence could not be
distinguished from current evidence.

### Store a planned snapshot inside any block

Per-block snapshots permit mixed-source composition but make one report revision depend on an unbounded set of source
revisions. The existing refresh request and review disclose one candidate snapshot, so adding hidden block revisions
would either refresh only part of the report or advance several sources without showing the exact decision.

### Introduce a composite multi-source report revision

A typed collection of evidence dependencies can support future planned-versus-recorded reports. It requires explicit
rules for partial availability, independent changes, refresh selection, source navigation, and export attribution.
Introducing that aggregate solely to render one planned target would add unverified behavior to the MVP critical path.

### Bind a planned-training report to the planned library

A provider-neutral planned-training origin gives the report one exact target and makes its existing
`sourceSnapshotRef` refer to the planned library. The established stale review, deliberate refresh, optimistic
revision, and deterministic export contracts remain truthful and atomic.

## Decision

Every report definition remains bound to exactly one evidence library revision.

- Definition version 5 adds a `planned-training` origin carrying one stable provider-neutral target reference and a
  matching `planned-training` block.
- For a planned-training origin, `sourceSnapshotRef` is a valid `planned-snapshot-` capability. For session, question,
  exploration, and blank origins it remains a `training-snapshot-` capability. Versions 1–4 retain their original
  recorded-training meaning unchanged.
- A planned-training report contains exactly one matching planned-training evidence block and zero or one authored
  narrative block. It cannot contain session, route, or training-period blocks. Other origins cannot contain a
  planned-training block.
- The block stores the target capability, not copied target fields, provider identifiers, rendered markup, or a second
  snapshot. The report header is the single source of truth for its evidence revision.
- Resolution queries the target through the planned-training application port at the exact saved snapshot. A changed
  planned library yields a complete current candidate with `stale` status; missing target evidence yields
  `unavailable` rather than another target or a cached rendering.
- Deliberate refresh advances only `sourceSnapshotRef` and the report revision after re-resolving the exact current
  target. Import and reimport never refresh a report implicitly.
- Preview and deterministic HTML identify the content as planned intent and do not imply completion, adherence,
  causation, or a recorded session relationship.
- Exact normalized planned-training data exit remains independent from report export. A report is a user-authored
  presentation of one target, not the portable canonical archive.

A future report that combines planned intent with recorded execution requires a separate decision defining a typed
multi-source evidence aggregate and an explicit partial-refresh experience. It must not be approximated by adding an
unreviewed second snapshot to a version-5 block.

## Consequences

### Positive

- Planned reports inherit the existing reproducibility, stale detection, refresh review, revision conflict, and atomic
  export behavior without ambiguous multi-source state.
- One field remains the source-of-truth revision for the whole definition; persistence and transport do not duplicate
  planned snapshots across blocks.
- The domain prevents presentation from composing planned intent with recorded facts under one misleading evidence
  status.
- Existing report versions remain readable with unchanged semantics.

### Negative

- The MVP cannot place a planned target and a recorded session in one report definition.
- A future planned-versus-recorded report needs a new multi-source model rather than relaxing version-5 invariants.
- Report resolution, library projection, source navigation, persistence, transport, and HTML export gain a distinct
  planned-training path.

### Risks and mitigations

- **The single-source boundary may be mistaken for a permanent product limitation.** The decision explicitly reserves
  a typed multi-source successor once its refresh and partial-availability semantics are designed.
- **A plan may be presented as achieved.** All resolved and exported copy identifies provider-authored intent; recorded
  completion remains a separate aggregate and relationship.
- **A target may change during resolution.** Planned snapshot checks bracket target resolution and refresh verifies the
  exact candidate again before compare-and-save.
- **The report may become a data silo.** The normalized planned-training export remains the complete exact exit path,
  while report HTML is an additional deterministic presentation.

## Verification

Acceptance requires domain tests for version-specific snapshot prefixes, origin/block matching, prohibited mixed
evidence, optional narrative, legacy restoration, and refresh preservation; application tests for current, stale,
unavailable, concurrent-change, create, edit, refresh, list, resolve, navigation, and export paths; transactional
SQLite migration and restart tests; schema and compatibility checks; deterministic localized semantic HTML that
preserves exercise, phase, transition, intensity, and repeat meaning; and packaged accessible journeys in both
locales. No test may substitute a copied target result or a heuristic recorded-session relationship.
