# Daily Activity Domain Candidate

## Status

Proposed first vertical concept for Milestone 1. This is a domain-design candidate, not yet a released canonical data-format version. Acceptance depends on the technology spike and synthetic contract proof.

## Why this concept is first

Daily activity can deliver a useful longitudinal view with a smaller semantic surface than a complete training session, sleep analysis, or recovery model. It still exercises the hard architectural path: source detection, optional and historical structure, local-time semantics, sample streaming, identity, reimport, provenance, persistence, querying, visualization, localization, and coverage reporting.

Selecting it does not make the provider's activity JSON a domain aggregate. Physical-information snapshots and sleep-derived summary fields found in that artifact belong to separate mappings and cannot be copied into daily activity merely because they share a file.

## Candidate model

### Daily Activity Observation

A provider-neutral account of activity attributed by one observation origin to one local calendar day.

**Candidate identity:** `ObservationOriginId + LocalDate`.

The origin component is required because two providers can report different or overlapping activity for the same person and date. They are not semantic duplicates merely because the dates match. Cross-origin comparison or composition belongs to an explicit insight or later reconciliation policy.

Candidate components:

- local calendar date;
- optional daily summary;
- ordered step samples in source-local time;
- ordered metabolic-equivalent samples in source-local time;
- sample-source classifications when their semantics are established;
- provenance for every accepted component and its mapping version.

The canonical specification will use semantic field names and explicit units. A source field whose unit, scale, or meaning has not been established remains unsupported or source-specific; it is not normalized by guesswork.

## Candidate invariants

1. One origin has at most one visible daily activity observation for a local date.
2. The local date is preserved independently of the computer's current time zone.
3. A local sample time belongs to that local date unless the source family contract explicitly establishes rollover semantics.
4. Ordered samples remain ordered deterministically; input file order cannot define canonical identity.
5. Missing summary, missing sample collection, empty sample collection, and a present zero value remain distinct states where the source distinguishes them.
6. Counts and durations cannot be negative; additional value ranges require documented source semantics rather than assumptions.
7. Physical-information snapshots and source-derived sleep fields do not become daily activity components.
8. Every component retains traceable source and mapping provenance without exposing personal values in diagnostics.

## Candidate reconciliation

For the same candidate identity:

- **Equivalent:** every mapped canonical component is semantically equal after documented unit and precision normalization. No duplicate is created; provenance may be extended.
- **Enrichment amendment:** one observation is a strict compatible enrichment of another—shared components are equivalent and only previously absent information is added. The richer state becomes visible with both provenances.
- **Competing change:** any shared component differs without a documented authoritative revision or precision rule. The result is a conflict, not last-import-wins.
- **Invalid:** the candidate violates a canonical invariant or requires an interpretation that has not been established.

Package timestamp, import order, filename UUID, artifact hash, and storage key are never amendment precedence.

## Source evidence supporting the candidate

The evaluated Polar Flow export contains one observed activity artifact per source `date`; every observed date is a valid ISO calendar date, matches the filename date, and is unique within that package. Daily summaries are optional. When present in the evaluated package, summary interval endpoints are local time-of-day values and can be combined with the source date without consulting the operating-system time zone.

This evidence supports a candidate and synthetic tests, not a universal provider guarantee. The public structural reference and its open questions live in [`../data-formats/providers/polar-flow.md`](../data-formats/providers/polar-flow.md).

## Required contract evidence before acceptance

- A normative canonical field and unit specification with machine-readable schema where applicable.
- A Polar-to-canonical mapping table covering every activity source field, including physical and sleep fields that map elsewhere or remain unsupported.
- Synthetic minimal, absent-summary, empty-samples, duplicate, enrichment, conflict, time-rollover, unknown-field, incompatible-type, interruption, and realistic-scale scenarios.
- Domain tests for identity, invariants, equivalence, enrichment, and conflict.
- Adapter tests proving filename date agreement is validation evidence but the filename token is not identity.
- Persistence tests proving one visible observation per origin/date and atomic reimport.
- A localized desktop journey that imports a synthetic package and displays a useful daily history with explicit gaps.

## Open decisions

- The stable evidence and user-recovery flow used to match a Polar source subject across packages.
- Canonical units and precision for every supported summary and sample value.
- Source-local sample rollover behavior and handling of daylight-saving gaps or repetitions.
- Whether sample-source classifications have provider-neutral meaning or remain source-specific observations.
- Whether an MVP insight presents multiple origins separately or defines a user-controlled composition policy.
