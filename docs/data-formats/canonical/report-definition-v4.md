# Canonical Report Definition Version 4

## Status and authority

Version 4 generalizes the version-3 analytical composition so a report can begin from a question, an
existing exploration, a training session, or a blank page. The origin records the user's stable starting
intent; blocks record the evolving authored answer. The two concepts are deliberately independent: adding
or removing evidence never rewrites the origin.

The definition remains a durable, provider-agnostic value. It stores no copied result, provider account,
source filename, rendered output, or hidden UI state. Versions 1–3 remain readable with their immutable
meanings. Every newly created or edited definition uses `definitionVersion` 4.

## Header and origin

Version 4 retains `reportRef`, `title`, `locale`, `sourceSnapshotRef`, `provenancePolicy`, `authorship`,
`revision`, and ordered `blocks`. `origin` is exactly one of:

| `kind` | Additional fields | Meaning |
|---|---|---|
| `session` | `sessionRef` | Began from one selected training session. |
| `question` | `question`, `questionVersion` | Began from the named versioned question. Version 4 supports `training-period-comparison` version 1. |
| `exploration` | `query` | Began from an exact completed exploration, including its two date ranges. |
| `blank` | none | Began with the user's own narrative structure. |

An exploration `query` contains `question`, `questionVersion`, `baselineRange`, and `comparisonRange`.
Ranges retain the version-3 valid-Gregorian, ordered, inclusive, and maximum-366-day rules. A question
origin stores the stable question identity but not a transient suggested date range.

## Composition invariants

Every definition has zero or one non-empty `narrative` block and 1–32 blocks in semantic order. A factual
title plus supported evidence is complete without authored commentary; when a narrative exists, its
plain-text authorship and validation remain unchanged. At most one `session-evidence`, `training-finding`, `training-comparison`, `training-chart`,
`training-exact-table`, or `training-coverage` block is allowed.

Origin-specific invariants are:

- a session origin requires exactly one matching `session-evidence` block and permits matching `route`
  blocks;
- question and exploration origins prohibit session and route blocks and require at least one analytical
  block;
- every analytical block in a question-origin report answers that origin's question;
- every analytical block in an exploration-origin report uses the origin's exact query; and
- a blank origin prohibits session and route blocks but may be narrative-only or gain coherent analytical
  blocks later without changing its origin.

All analytical blocks in any one definition use the same query. The metric, route, block-identity, and
privacy invariants defined by versions 2 and 3 remain in force.

## Resolution and provenance

The application resolves evidence only from the exact `sourceSnapshotRef`. Session reports expose current
provider attribution for their selected session. Question, exploration, and evidence-bearing blank reports
use local-library snapshot attribution. Narrative-only blank reports use `authored-only` attribution and do
not invent a provider relationship.

A source change makes the definition stale. Resolution returns a complete candidate from the current
compatible library revision without mutating the saved definition, and export and editing remain blocked.
The person may retain the saved definition or explicitly refresh it after reviewing that candidate. Refresh
requires the exact saved definition revision, saved `sourceSnapshotRef`, and candidate snapshot; it resolves
the candidate again, rejects concurrent changes, advances `sourceSnapshotRef` and `revision`, and preserves
all authored and compositional fields.

The canonical library does not retain historical snapshots. FitFreed therefore does not reconstruct or
invent old numeric results for a before-and-after display. The current candidate, the preservation boundary,
and this limitation are disclosed before confirmation. Missing evidence is reported, never replaced by stored
results or silently accepted against a different snapshot. Import and reimport never trigger report refresh.

## Removal

Removal is an explicit aggregate decision bound to `reportRef` and the exact positive `revision` the person
reviewed. A successful decision names that report and revision, then persistence removes its definition and
owned blocks atomically. A missing or concurrently revised report is not substituted or partially removed.
Imported history, other reports, exports already written outside the library, and source archives are outside
the deletion boundary.
