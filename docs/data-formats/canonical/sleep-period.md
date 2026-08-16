# Canonical Sleep Period Version 1

## Status and authority

This is the normative provider-neutral contract for a FitFreed sleep period. Version 1 is introduced with Polar Flow mapping version `polar-flow-sleep@1`, but its identity, field names, units, and invariants do not depend on Polar archive layout.

The aggregate represents one source observation. It does not merge records from different origins or assert medical accuracy.

## Aggregate and identity

`SleepPeriod` has identity `(originId, sleepDate)`:

- `originId` is the non-empty opaque library-local source-subject identity;
- `sleepDate` is the valid ISO 8601 calendar date assigned by the source adapter;
- neither component is a user-facing label or cross-provider person identity; and
- `sleepDate` is not recalculated from either boundary because source assignment may differ from both boundary dates.

An adapter that can produce multiple primary sleep periods for one source-assigned date requires a later identity contract. Version 1 rejects duplicate identities inside one package instead of inventing sequence numbers.

## Fields

### Period summary

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `originId` | string | yes | Opaque library-local source-subject identity. |
| `sleepDate` | ISO 8601 date | yes | Source-assigned calendar date and identity component. |
| `startedAt` | RFC 3339 offset date-time | yes | Start boundary with its recorded numeric UTC offset. |
| `endedAt` | RFC 3339 offset date-time | yes | End boundary with its recorded numeric UTC offset. |
| `spanMilliseconds` | non-negative signed 64-bit integer | yes | Declared sleep span, including interruptions. It is independent of the boundary difference. |
| `asleepMilliseconds` | non-negative signed 64-bit integer | yes | Declared time asleep inside the span. |
| `interruptionMilliseconds` | non-negative signed 64-bit integer | yes | Total declared interruption duration. |
| `longInterruptionMilliseconds` | non-negative signed 64-bit integer | yes | Declared duration of long interruptions. |
| `shortInterruptionMilliseconds` | non-negative signed 64-bit integer | yes | Declared duration of short interruptions. |
| `interruptionCount` | non-negative signed 64-bit integer | yes | Total interruption count. |
| `longInterruptionCount` | non-negative signed 64-bit integer | yes | Long-interruption count. |
| `shortInterruptionCount` | non-negative signed 64-bit integer | yes | Short-interruption count. |
| `efficiencyPercent` | finite binary64 | yes | Declared sleep efficiency from 0 through 100 percent. |
| `continuityIndex` | finite binary64 | yes | Declared continuity index from 0 through 5. |
| `continuityClass` | integer | yes | Declared continuity class from 0 through 5; zero means unclassified. |
| `sleepGoalMilliseconds` | non-negative signed 64-bit integer or null | yes | User-selected duration goal; null means unavailable. |
| `selfReportedRating` | integer or null | yes | Person's rating from 1 through 5; null means unavailable. |
| `cycleCount` | non-negative unsigned count or null | yes | Declared or mapped sleep-cycle count; null means unavailable. |
| `recordingEndedByPowerLoss` | boolean or null | yes | Whether source evidence reports power loss during the recording; null means unavailable. |
| `phaseSummary` | `SleepPhaseSummary` or null | yes | Aggregate phase durations; null means phase data is unavailable. |
| `stageTransitions` | ordered `SleepStageTransition` array or null | yes | Phase timeline; null means timeline data is unavailable and an empty array means explicitly present with no transitions. |
| `score` | `SleepScore` or null | yes | Source-derived score set; null means score data is unavailable. |

### `SleepPhaseSummary`

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `wakeMilliseconds` | non-negative signed 64-bit integer | yes | Wake time inside the span. |
| `remMilliseconds` | non-negative signed 64-bit integer | yes | Rapid-eye-movement sleep. |
| `lightMilliseconds` | non-negative signed 64-bit integer | yes | Light non-REM sleep. |
| `deepMilliseconds` | non-negative signed 64-bit integer | yes | Deep non-REM sleep. |
| `unrecognizedMilliseconds` | non-negative signed 64-bit integer | yes | Time whose phase could not be classified. |

### `SleepStageTransition`

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `offsetMilliseconds` | non-negative signed 64-bit integer | yes | Offset from the declared period start. |
| `stage` | enumeration | yes | `wake`, `rem`, `light`, `deep`, or `unrecognized`. |

Transitions describe the state beginning at the given offset. Adjacent identical stages are valid source evidence and are not automatically coalesced in version 1.

### `SleepScore`

Every numeric score below is finite and ranges from 1 through 100. `relativeRating` is independently optional.

| Field | Type | Required | Semantics |
|---|---|---|---|
| `overall` | binary64 | yes | Overall sleep score. |
| `ownTargetDuration` | binary64 | yes | Duration score relative to the person's own goal. |
| `recommendedDuration` | binary64 | yes | Duration score relative to a source recommendation. |
| `continuity` | binary64 | yes | Continuity component score. |
| `efficiency` | binary64 | yes | Efficiency component score. |
| `rem` | binary64 | yes | REM component score. |
| `deep` | binary64 | yes | Deep-sleep component score. |
| `longInterruptions` | binary64 | yes | Long-interruption component score. |
| `duration` | binary64 | yes | Aggregate duration-theme score. |
| `solidity` | binary64 | yes | Aggregate solidity-theme score. |
| `regeneration` | binary64 | yes | Aggregate regeneration-theme score. |
| `relativeRating` | integer or null | yes | Rating from 1 through 5 relative to the source-defined usual level. |

Score values are algorithm-derived evidence. A value imported from one origin, provider, device generation, or scoring version must not be assumed comparable with another without an explicit compatibility rule.

## Invariants

- `startedAt` and `endedAt` retain explicit offsets and normalize to RFC 3339 without using the host time zone.
- The represented end instant is strictly later than the start instant.
- Every duration and count is non-negative and arithmetically representable.
- `asleepMilliseconds + interruptionMilliseconds = spanMilliseconds`.
- `longInterruptionMilliseconds + shortInterruptionMilliseconds = interruptionMilliseconds`.
- `longInterruptionCount + shortInterruptionCount = interruptionCount`.
- A present `phaseSummary` totals exactly `spanMilliseconds`; all non-wake phases total `asleepMilliseconds`.
- A present non-empty `stageTransitions` begins at zero, is non-decreasing, and has no offset greater than `spanMilliseconds`.
- Null means unavailable. It never means zero, false, an empty collection, or an unknown enumeration value.

## Reconciliation

Canonical equality is equivalent. With unorderable source revision evidence, a differing record may be enriched only when all existing known values remain equal and at least one null optional group or the optional score `relativeRating` becomes known. The inverse is preserved without removing known data. Any changed known value, changed optional group, or mixed add-and-remove case is a conflict and changes no visible state.

Every decision retains protected source provenance. Import or ZIP entry order never decides precedence.

## Known loss and compatibility

Version 1 does not retain alarms, snooze events, birthdays, device identifiers, trim offsets, encoded feedback, scoring baselines, phase percentages, raw source algorithm labels, cycle-depth models, or source timeline markers outside the canonical period. A mapping must disclose each omitted source field and must not treat omission as absence from the original package.

A change to identity, units, null semantics, score scale, phase mapping, time interpretation, reconciliation, or invariants requires a new canonical version.
