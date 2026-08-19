# Canonical Report Definition Version 3

## Status and authority

Version 3 extends the immutable [version-2 definition](report-definition-v2.md) with a coherent family of
training-period comparison blocks. It remains a session-origin definition so existing session-led reports
can combine their selected session, routes, user narrative, and broader historical context before the later
question-led and exploration-led start paths are introduced.

The five analytical block kinds are different presentations of one versioned application question. They do
not store copied totals, chart coordinates, conclusions, coverage percentages, or persistence identities.

## Versioned question reference

Every analytical block stores the following `training-period-comparison` question reference:

| Field | Type | Semantics |
|---|---|---|
| `questionVersion` | integer | Exactly `1`; changing calculation semantics requires another version. |
| `baselineRange` | local-date range | Ordered inclusive range of at most 366 days. |
| `comparisonRange` | local-date range | Ordered inclusive range of at most 366 days. |

A local-date range contains canonical Gregorian `from` and `through` values in `YYYY-MM-DD` form. The two
ranges may overlap because the authored question, not a guessed statistical interpretation, is preserved.
Every analytical block in one version-3 definition must reference exactly the same question parameters.
This deliberate repetition keeps each portable block self-describing while the equality invariant prevents
contradictory comparison periods inside one report.

## Analytical block family

Version 3 adds at most one block of each kind:

- `training-finding` presents a conservative signed result for one selected metric;
- `training-comparison` presents baseline, comparison, and signed change values;
- `training-chart` visualizes one selected metric while retaining an exact accessible alternative;
- `training-exact-table` presents the complete supported comparison metrics by source series; and
- `training-coverage` presents calendar, training-day, measurement-availability, and limitation evidence.

`training-finding` and `training-chart` additionally select one of `session-count`, `training-days`,
`duration`, `distance`, or `energy`. Optional distance or energy remains unavailable unless both periods
contain enough recorded evidence for the authoritative comparison query. A missing value is never rendered
as zero.

The application resolves the block family exclusively through training comparison query version 1. It keeps
source series separate, preserves exact integer values as decimal text at the transport boundary, and does
not infer performance, causation, health meaning, or advice. Presentation and export label recorded input,
FitFreed calculation, coverage, and limitations explicitly.

## Composition and compatibility

Version 3 retains the version-2 header, session origin, route privacy authority, 2–32 block bound, exactly
one session-evidence block, exactly one narrative block, distinct route references, global block identity,
and semantic ordering. Analytical blocks are optional and independently addable, removable, configurable,
and reorderable. Removing every analytical block does not downgrade or rewrite the definition.

Version-1 and version-2 definitions remain readable without mutation. Editing either through the current
composition use case preserves existing block identities and upgrades the authored successor to version 3.
Unknown question versions, invalid dates, ranges longer than 366 days, mixed comparison parameters,
duplicate analytical kinds, or unsupported metrics make a version-3 definition incompatible rather than
silently changing its meaning.
