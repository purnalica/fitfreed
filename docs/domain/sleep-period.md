# Sleep Period Domain Model

## Purpose

Sleep history owns the provider-neutral language and invariants needed to explore one source-assigned sleep period. It does not own daily-activity sleep summaries, nightly recovery, physiological samples, alarms, device identity, or provider algorithms.

The first implemented aggregate is `SleepPeriod`. It preserves timing, declared duration, interruption, phase, self-rating, and score evidence without treating a provider's JSON object as the domain model.

## Aggregate boundary

A sleep period is identified by one observation origin and one source-assigned sleep date. The date is part of the source observation: it is not derived from the start date, end date, current computer time zone, or import date. This distinction is required because an evaluated source may assign a date that differs from either boundary's local calendar date.

The aggregate owns:

- offset-aware start and end boundaries;
- declared span and asleep durations;
- interruption durations and counts;
- optional aggregate phase durations and an optional ordered stage timeline;
- optional sleep goal, cycle count, self-reported rating, and source-derived score set; and
- measurement-availability distinctions.

Daily activity may contain a sleep-derived summary, but that summary is neither an alternative identity nor a substitute for a primary sleep-period artifact. Recovery observations may refer to the same night while retaining their own meaning and life cycle.

## Invariants

1. Identity is `(originId, sleepDate)` and is scoped to one observation origin.
2. Start and end retain their explicit UTC offsets. Daylight-saving transitions never pass through the host's current time zone.
3. The end instant is later than the start instant, but declared `spanMilliseconds` is not recalculated from those boundaries.
4. `asleepMilliseconds + interruptionMilliseconds = spanMilliseconds`.
5. Long and short interruption durations and counts add to their corresponding totals.
6. When a phase summary exists, all durations add to the declared span and all non-wake durations add to the declared asleep duration.
7. Stage transitions are ordered, start at offset zero, and remain inside the declared span.
8. Missing phases, scores, goals, ratings, and cycles remain unavailable. They never become zero-valued measurements.
9. Scores retain their documented scale and remain comparable only within compatible scoring evidence. They are not objective health diagnoses.

## Reimport behavior

The evaluated split result and score artifacts have no per-record creation or modification time. Import order, ZIP entry order, delivery tokens, and package creation time therefore cannot order competing revisions.

- Equal canonical content is equivalent.
- A record that adds previously unavailable optional groups without changing known content is an enrichment.
- A record that omits optional content already retained is preserved without data loss.
- Any other difference is a conflict until orderable source revision evidence or explicit conflict resolution exists.

This rule makes cumulative reimport useful without silently treating the newest selected file as the truth.

## Product language

- **Sleep date:** calendar date assigned to a period by its source adapter.
- **Sleep span:** declared elapsed sleep window, including interruptions.
- **Asleep duration:** declared time asleep within the span.
- **Interruption:** wake time inside the sleep span.
- **Sleep phase:** wake, rapid-eye-movement, light, deep, or unrecognized state.
- **Sleep score:** source-derived value on a documented scale; not a medical assessment.
- **Self-reported rating:** the person's own rating on a five-point scale.

The normative field contract is [canonical sleep period version 1](../data-formats/canonical/sleep-period.md).
