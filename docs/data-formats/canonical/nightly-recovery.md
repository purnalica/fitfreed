# Canonical Nightly Recovery Version 1

## Status and authority

This is the normative provider-neutral contract for one FitFreed nightly recovery observation. Version 1 is introduced with Polar Flow mapping version `polar-flow-nightly-recovery@1`, but its shared identity, measurement names, and units do not depend on Polar archive layout.

[ADR 0006](../../architecture/decisions/0006-use-typed-source-specific-recovery-components.md) defines the controlled boundary for source-derived assessments, baselines, and guidance. The aggregate records source evidence; it does not diagnose health, prescribe behavior, or assert measurement accuracy.

## Aggregate and identity

`NightlyRecovery` has identity `(originId, recoveryDate)`:

- `originId` is the non-empty opaque library-local source-subject identity;
- `recoveryDate` is the valid ISO 8601 calendar date assigned by the source adapter;
- neither component is a user-facing label or cross-provider person identity; and
- the date is not derived from an optional sample timestamp or a related sleep period.

Version 1 permits at most one recovery observation per origin and date. A source with multiple distinct recovery observations on one date requires a later identity contract.

## Shared fields

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `originId` | string | yes | Opaque library-local source-subject identity. |
| `recoveryDate` | ISO 8601 date | yes | Source-assigned calendar date and identity component. |
| `beatToBeatIntervalMilliseconds` | positive signed 64-bit integer | yes | Mean interval between successive heart beats over the source-defined nightly measurement window. |
| `heartRateVariabilityRmssdMilliseconds` | non-negative signed 64-bit integer or null | yes | Root mean square of successive beat-to-beat interval differences; null means unavailable. |
| `breathingIntervalMilliseconds` | positive signed 64-bit integer | yes | Mean interval between breaths over the source-defined nightly measurement window. It is not silently converted into an average breathing rate. |
| `sourceAssessment` | `SourceSpecificRecoveryAssessment` or null | yes | Algorithm-derived source assessment; null means unavailable. |
| `sourceBaseline` | `SourceSpecificRecoveryBaseline` or null | yes | Source-computed comparison baseline; null means unavailable. |
| `sourceGuidance` | `SourceSpecificRecoveryGuidance` or null | yes | Source-generated guidance; null means unavailable. |

The measurement window remains source-defined because the takeout does not carry explicit start and end boundaries. A later source that provides those boundaries may extend the canonical contract without changing the meaning of the recorded summaries.

## `SourceSpecificRecoveryAssessment`

| Field | Type | Required | Semantics |
|---|---|---|---|
| `scheme` | string | yes | Non-empty versioned semantic namespace assigned by the source adapter. |
| `autonomicCharge` | finite binary64 | yes | Source algorithm's autonomic charge value. Its range is defined by `scheme`. |
| `autonomicStatus` | signed 64-bit integer | yes | Source algorithm's ordinal autonomic status. Its labels and range are defined by `scheme`. |
| `overallStatus` | signed 64-bit integer | yes | Source algorithm's ordinal overall recovery status. Its labels and range are defined by `scheme`. |
| `overallSublevel` | signed 64-bit integer | yes | Finer source-defined overall status. It has no cross-scheme ordering contract. |

## `SourceSpecificRecoveryBaseline`

| Field | Type | Required | Unit or semantics |
|---|---|---|---|
| `scheme` | string | yes | Non-empty versioned semantic namespace assigned by the source adapter. |
| `meanBeatToBeatIntervalMilliseconds` | positive signed 64-bit integer | yes | Source-computed baseline mean. |
| `standardDeviationBeatToBeatIntervalMilliseconds` | non-negative signed 64-bit integer | yes | Source-computed baseline standard deviation. |
| `meanHeartRateVariabilityRmssdMilliseconds` | non-negative signed 64-bit integer or null | yes | Source-computed RMSSD baseline mean; null means unavailable. |
| `standardDeviationHeartRateVariabilityRmssdMilliseconds` | non-negative signed 64-bit integer or null | yes | Source-computed RMSSD baseline standard deviation; null means unavailable. |
| `meanBreathingIntervalMilliseconds` | positive signed 64-bit integer | yes | Source-computed breathing-interval baseline mean. |
| `standardDeviationBreathingIntervalMilliseconds` | non-negative signed 64-bit integer | yes | Source-computed breathing-interval baseline standard deviation. |

The two optional RMSSD baseline fields are both null or both present. Baseline window, inclusion rules, and statistical method are defined only by `scheme`; version 1 does not claim that every source uses the same lookback or estimator.

## `SourceSpecificRecoveryGuidance`

| Field | Type | Required | Semantics |
|---|---|---|---|
| `scheme` | string | yes | Non-empty versioned semantic namespace assigned by the source adapter. |
| `exercise` | string | yes | Non-empty source-generated exercise guidance. |
| `sleep` | string | yes | Non-empty source-generated sleep guidance. |
| `vitality` | string | yes | Non-empty source-generated daily-energy guidance. |

Each text is limited to 4,096 Unicode scalar values. Text is preserved as user-owned source content, displayed as source-generated and non-diagnostic, and never written to logs, diagnostics, public fixtures, or telemetry.

## Invariants

- Identity strings and every present `scheme` are non-empty.
- `recoveryDate` is a real ISO 8601 calendar date.
- Required intervals are positive; RMSSD values and standard deviations are non-negative.
- A present baseline has either both RMSSD fields or neither.
- Every floating-point assessment value is finite.
- Null means unavailable. It never means zero, an empty string, an unknown status, or a false assessment.
- Source-specific values from different `scheme` codes are not aggregated or compared as equivalent.

## Reconciliation

Canonical equality is equivalent. With no orderable source revision evidence:

- all shared required measurements must remain equal;
- an absent optional measurement or typed component may be added as an enrichment;
- a later omission preserves the known value;
- adding the optional RMSSD pair inside an otherwise equal baseline is an enrichment, and omitting it is preservation;
- a changed known value, scheme, component, or mixed add-and-remove case is a conflict and changes no visible state.

Every decision retains protected source provenance. Import or ZIP entry order never decides precedence.

## Known loss and compatibility

Version 1 does not contain raw beat-to-beat, HRV, or breathing samples; a derived average heart rate; explicit measurement-window boundaries; localized status labels; device identifiers; provider baselines outside the typed component; or undocumented recovery fields. A mapping must disclose each omission and must not attach an undated sample collection by array position.

A change to identity, shared units, null semantics, component typing, scheme compatibility, reconciliation, or guidance retention requires a new canonical version.
