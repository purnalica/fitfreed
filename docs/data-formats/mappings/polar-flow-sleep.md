# Polar Flow Sleep Mapping Version 1

## Status

This is the normative anti-corruption-layer contract for joining compatible Polar Flow personal-data-export sleep-result and sleep-score artifacts into [canonical sleep period version 1](../canonical/sleep-period.md).

- Source provider: `polar-flow`
- Source adapter version introducing support: `polar-flow-archive@5`
- Current source adapter version: `polar-flow-archive@9`
- Mapping version: `polar-flow-sleep@1`
- Current operation mapping set: `polar-flow-mapping-set@4`; historical operations may retain `polar-flow-mapping-set@1`, `polar-flow-mapping-set@2`, or `polar-flow-mapping-set@3`
- Source evidence: [Polar Flow personal data export reference](../providers/polar-flow.md)

## Supported artifact boundary

The two documented filename grammars are separately recognized. Each compatible artifact has an array root. Result and score entries are joined by exact `night` inside the same package after both arrays are validated; delivery filename tokens never become identity.

Unknown object fields are accepted. Known fields with incompatible types, invalid values, duplicate `night` inside one family, or a score whose `night` has no result in the same package are invalid. A result without a score is valid and retains unavailable score data. All validation and joining complete before canonical visibility changes.

## Sleep-result mapping

| Source path | Requirement and validation | Canonical outcome |
|---|---|---|
| resolved source subject | exactly one verified package subject | `originId` |
| `night` | required unique ISO 8601 calendar-date string | `sleepDate` by exact value; it is not derived from a boundary date |
| `sleepResult.hypnogram.sleepStart` | required RFC 3339 offset date-time | normalized `startedAt` |
| `sleepResult.hypnogram.sleepEnd` | required RFC 3339 offset date-time later as an instant | normalized `endedAt` |
| `evaluation.sleepSpan` | required non-negative ISO 8601 duration representable in whole milliseconds | `spanMilliseconds` without boundary derivation |
| `evaluation.asleepDuration` | required non-negative ISO 8601 duration | `asleepMilliseconds` |
| `evaluation.interruptions.totalDuration` | required non-negative ISO 8601 duration | `interruptionMilliseconds` |
| `evaluation.interruptions.longDuration` | required non-negative ISO 8601 duration | `longInterruptionMilliseconds` |
| `evaluation.interruptions.shortDuration` | required non-negative ISO 8601 duration | `shortInterruptionMilliseconds` |
| `evaluation.interruptions.totalCount` | required non-negative integer | `interruptionCount` |
| `evaluation.interruptions.longCount` | required non-negative integer | `longInterruptionCount` |
| `evaluation.interruptions.shortCount` | required non-negative integer | `shortInterruptionCount` |
| `evaluation.analysis.efficiencyPercent` | required finite number from 0 through 100 | `efficiencyPercent` |
| `evaluation.analysis.continuityIndex` | required finite number from 0 through 5 | `continuityIndex` |
| `evaluation.analysis.continuityClass` | required integer from 0 through 5 | `continuityClass` |
| `sleepResult.hypnogram.sleepGoal` | absent or non-negative ISO 8601 duration | `sleepGoalMilliseconds`; absence maps to null |
| `sleepResult.hypnogram.rating` | required supported enumeration | `selfReportedRating`: `UNKNOWN` becomes null; `SLEPT_BAD`, `SLEPT_QUITE_BAD`, `SLEPT_NEITHER_BAD_NOR_WELL`, `SLEPT_QUITE_WELL`, and `SLEPT_WELL` map to 1 through 5 |
| `sleepResult.hypnogram.batteryRanOut` | absent or boolean | `recordingEndedByPowerLoss`; absence maps to null |
| `evaluation.phaseDurations` | absent or complete phase-duration object satisfying canonical arithmetic | `phaseSummary`; absence maps to null |
| `sleepResult.hypnogram.sleepStateChanges` | absent or ordered array of valid changes | `stageTransitions`; absence maps to null |
| `sleepResult.sleepCycles.cycles.sleepCycleModels` | absent or structurally valid array | `cycleCount` from array length; absence maps to null |

`evaluation.sleepType` is validated as a string but does not determine phase availability. In the evaluated takeout, its historical labels and the current Dynamic API descriptions do not provide a sufficiently stable cross-version contract. Actual phase and cycle structures determine canonical availability.

### Phase mapping

Each state change has a non-negative ISO 8601 `offsetFromStart` duration and a source `state`. The mapping is:

| Source `state` | Canonical `stage` |
|---|---|
| `WAKE` | `wake` |
| `REM` | `rem` |
| `NONREM1` or `NONREM2` | `light` |
| `NONREM3` | `deep` |
| `WS_UNKNOWN` | `unrecognized` |

Unknown state values reject mapping version 1 rather than being guessed. In-period offsets must start at zero, be non-decreasing, and not exceed the declared span. The evaluated export can append one final `WAKE` transition strictly after that span. Mapping version 1 treats this as an out-of-period terminal marker and excludes it from the canonical timeline. Any other transition beyond the span is invalid.

`evaluation.phaseDurations.wake`, `rem`, `light`, `deep`, and `unknown` map to the corresponding canonical durations. Source percentages are range-validated when present but are not persisted or recalculated as source facts.

## Sleep-score mapping

`sleepScoreResult` is required for every score entry. Every component is a finite number from 1 through 100.

| Source path | Canonical `score` field |
|---|---|
| `sleepScoreResult.sleepScore` | `overall` |
| `sleepScoreResult.sleepTimeOwnTargetScore` | `ownTargetDuration` |
| `sleepScoreResult.sleepTimeRecommendationScore` | `recommendedDuration` |
| `sleepScoreResult.continuityScore` | `continuity` |
| `sleepScoreResult.efficiencyScore` | `efficiency` |
| `sleepScoreResult.remScore` | `rem` |
| `sleepScoreResult.n3Score` | `deep` |
| `sleepScoreResult.longInterruptionsScore` | `longInterruptions` |
| `sleepScoreResult.groupDurationScore` | `duration` |
| `sleepScoreResult.groupSolidityScore` | `solidity` |
| `sleepScoreResult.groupRefreshScore` | `regeneration` |
| `sleepScoreResult.scoreRate` | `relativeRating`, absent or integer from 1 through 5 |

The score file's `night` must reference one result entry in the same package. A missing score artifact or a result date absent from the score artifact maps to null `score`.

## Arithmetic and time validation

Source durations are parsed directly and must satisfy every canonical arithmetic invariant. The evaluated source confirms that phase totals, asleep duration, and interruption totals form a coherent declared span. It does not confirm that `sleepSpan` always equals the instant difference between `sleepStart` and `sleepEnd`; mapping therefore preserves all three values independently.

Offset date-times are compared as instants, so a period spanning midnight or a daylight-saving transition remains valid. The source-assigned `night` is retained even when it differs from the local date component of either boundary.

## Reimport and split-artifact reconciliation

Identity is `(originId, night)`. Result and score artifacts have no observed record-level revision timestamp. Consequently:

- canonical equality is equivalent;
- adding a previously unavailable score, phase group, timeline, goal, cycle count, power-loss flag, self-reported rating, or score-relative rating without changing known content is an enrichment;
- omitting already retained optional content is preserved;
- changed known content or a changed score is a conflict;
- duplicate result or score dates inside one package are invalid independently of array or ZIP order.

A whole-package exact repeat may reuse a completed compatible outcome. Per-period provenance retains both protected result and optional score artifact locators and hashes.

## Deliberately unmapped information

Mapping version 1 does not persist:

- `sleepResult.hypnogram.alarmSnoozeTimes`, alarm stop metadata, or other alarm behavior;
- `sleepResult.hypnogram.birthday` and `deviceId`;
- `sleepResult.hypnogram.sleepStartOffset` and `sleepEndOffset`, whose export-specific unit and relationship to the declared span are not established;
- `evaluation.age`, `evaluation.analysis.feedback`, phase percentages, and raw `sleepType` labels;
- cycle start offsets and depth models beyond `cycleCount`;
- the out-of-period final `WAKE` marker described above; and
- any `sleepScoreBaselines` value.

These omissions are known loss from the canonical version, not claims that the ZIP lacks the information. The provider reference documents the source structures so independent tooling can use them.
