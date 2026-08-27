# Canonical Report Definition Version 5

## Status and authority

Version 5 extends [version 4](report-definition-v4.md) with a provider-neutral planned-training origin and evidence
block. It preserves the central report invariant established by
[ADR 0034](../../architecture/decisions/0034-bind-each-report-to-one-evidence-library.md): one definition is bound to
one evidence library revision. Every newly created or edited report uses `definitionVersion` 5; versions 1 through 4
remain readable with their historical meaning.

The definition stores authored composition and opaque capabilities. It stores no copied target structure, resolved
result, provider account, source filename, rendered output, or hidden presentation state.

## Header, origin, and snapshot family

Version 5 retains `reportRef`, `title`, `locale`, `sourceSnapshotRef`, `provenancePolicy`, `authorship`, `revision`, and
ordered `blocks`. It retains the version-4 `session`, `question`, `exploration`, and `blank` origins and adds:

| `origin.kind` | Additional fields | Required source revision | Meaning |
|---|---|---|---|
| `planned-training` | `targetRef` | `planned-snapshot-` | Began from one exact provider-neutral planned-training target. |

Every other origin continues to require a `training-snapshot-` source. A definition never uses the snapshot prefix as
a heuristic: origin and snapshot family are validated together. Planned target capabilities use the
`planned-target-` prefix.

## Planned-training block

A `planned-training` block contains `blockRef`, `kind`, and `targetRef`. The target capability must equal the origin's
`targetRef`. The block does not copy name, schedule, completion state, exercise sport, phases, goals, intensity,
transition, or repeat values. Those values remain normalized planned-training evidence resolved at the report's exact
`sourceSnapshotRef`.

A planned-training definition has exactly one matching planned-training block and zero or one non-empty `narrative`
block. It prohibits session evidence, routes, findings, comparisons, charts, exact tables, and coverage blocks. Other
origins prohibit planned-training blocks. This prevents one saved revision from silently depending on both the
recorded-training and planned-training libraries.

The application validates semantic equality between origin and block target capabilities. Portable JSON Schema
validates both opaque identifier shapes and their origin-specific placement but cannot express that cross-field
equality portably; consumers must apply the canonical domain invariant.

## Resolution, staleness, and provenance

Resolution reads the exact target at the saved `planned-snapshot-` capability. The resulting evidence preserves target
kind, schedule and completion metadata when present, editability, mapping coverage, plan shape, relationship state,
ordered exercises, provider-neutral sport identity, ordered phases, goals, intensity constraints, transitions, and
repeat graphs. It is labelled planned intent and never treated as recorded completion.

When the planned library advances, resolution returns the complete compatible current candidate with `stale` status
without editing the saved definition. Missing target evidence is `unavailable`; no target is substituted. Deliberate
refresh verifies the saved report revision, saved source snapshot, and reviewed candidate snapshot, then advances only
`sourceSnapshotRef` and `revision`. Import and reimport never refresh a report implicitly.

Planned evidence uses `planned-training-snapshot` provenance. Session evidence retains session attribution;
question/exploration evidence uses `library-snapshot`; and narrative-only blank reports use `authored-only`.

## Portability and exit

The portable representation is [report definition version 5](../portable/report-definition-v5.md). Deterministic
report HTML is a presentation of authorized evidence, not the canonical target archive. Exact normalized objectives,
exercises, phases, transitions, and repetitions leave through [planned-training export version
1](../portable/planned-training-v1.md) as
`application/vnd.fitfreed.planned-training+json;version=1`, independently from report composition.

A future report that compares planned intent with recorded execution requires a typed multi-source report aggregate
and explicit partial-refresh semantics. It must not be represented by adding a recorded block to this version.
