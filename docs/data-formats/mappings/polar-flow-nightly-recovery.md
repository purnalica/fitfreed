# Polar Flow Nightly Recovery Mapping Version 1

## Status

This is the normative anti-corruption-layer contract for mapping compatible Polar Flow personal-data-export nightly-recovery artifacts into [canonical nightly recovery version 1](../canonical/nightly-recovery.md).

- Source provider: `polar-flow`
- Source adapter version introducing support: `polar-flow-archive@6`
- Current source adapter version: `polar-flow-archive@8`
- Mapping version: `polar-flow-nightly-recovery@1`
- Current operation mapping set: `polar-flow-mapping-set@3`; historical operations may retain `polar-flow-mapping-set@1` or `polar-flow-mapping-set@2`
- Source-specific scheme: `polar-nightly-recharge@1`
- Source evidence: [Polar Flow personal data export reference](../providers/polar-flow.md)

## Supported artifact boundary

The `nightly_recovery_{numeric-token}-{uuid-token}.json` grammar is supported when its root is an array and every entry satisfies the mapping below. Unknown object fields are accepted. Known fields with incompatible types, invalid values, duplicate `night` identities, partial all-or-nothing groups, or inconsistent optional RMSSD baseline pairs are invalid and reject the package before canonical visibility changes.

The separately recognized `nightly_recovery_blob_{numeric-token}-{uuid-token}.json` grammar is deliberately ignored by mapping version 1. Its array entries contain HRV and breathing sample groups but no date, record identifier, or documented link to a nightly-recovery entry. File order, array position, sample content, and delivery tokens are not identity. The blob remains visible in coverage as excluded unidentifiable high-resolution content.

## Shared measurement mapping

| Source path | Requirement and validation | Canonical outcome |
|---|---|---|
| resolved source subject | exactly one verified package subject | `originId` |
| `night` | required unique ISO 8601 calendar-date string | `recoveryDate` by exact value |
| `meanNightlyRecoveryRri` | required positive integer | `beatToBeatIntervalMilliseconds` |
| `meanNightlyRecoveryRmssd` | absent or non-negative integer | `heartRateVariabilityRmssdMilliseconds`; absence maps to null |
| `meanNightlyRecoveryRespirationInterval` | required positive integer | `breathingIntervalMilliseconds` |

The official AccessLink Nightly Recharge contract establishes milliseconds for average beat-to-beat interval and RMSSD. The takeout's respiration field is an interval rather than the API's breaths-per-minute average; mapping preserves the interval in milliseconds and does not derive a rate.

## Source assessment mapping

The four fields below are either all absent or all present. Absence maps to null `sourceAssessment`. Presence creates `SourceSpecificRecoveryAssessment` with scheme `polar-nightly-recharge@1`.

| Source path | Validation | Canonical field |
|---|---|---|
| `ansStatus` | finite number from -10 through 10 | `autonomicCharge` |
| `ansRate` | integer from 1 through 5 | `autonomicStatus` |
| `recoveryIndicator` | integer from 1 through 6 | `overallStatus` |
| `recoveryIndicatorSubLevel` | signed 64-bit integer | `overallSublevel` |

The ranges correspond to the official AccessLink autonomic-charge and Nightly Recharge status contracts. Field correspondence is a documented FitFreed interpretation of the takeout, not an official ZIP specification. The source integers are retained; localized labels belong to presentation and never replace stored facts.

## Source baseline mapping

The six baseline fields are either all absent, present without the two RMSSD fields, or all present. The two RMSSD fields must appear together. Absence of the required baseline core maps to null `sourceBaseline`; presence creates `SourceSpecificRecoveryBaseline` with scheme `polar-nightly-recharge@1`.

| Source path | Validation | Canonical field |
|---|---|---|
| `meanBaselineRri` | positive integer | `meanBeatToBeatIntervalMilliseconds` |
| `sdBaselineRri` | non-negative integer | `standardDeviationBeatToBeatIntervalMilliseconds` |
| `meanBaselineRmssd` | absent or non-negative integer | `meanHeartRateVariabilityRmssdMilliseconds` |
| `sdBaselineRmssd` | absent or non-negative integer with matching mean | `standardDeviationHeartRateVariabilityRmssdMilliseconds` |
| `meanBaselineRespirationInterval` | positive integer | `meanBreathingIntervalMilliseconds` |
| `sdBaselineRespirationInterval` | non-negative integer | `standardDeviationBreathingIntervalMilliseconds` |

Polar describes Nightly Recharge components as comparisons against the preceding 28-day usual level, but the takeout does not document the exact baseline estimator, eligibility rules, or historical algorithm version. The scheme retains that source-specific boundary.

## Source guidance mapping

`exerciseTip`, `sleepTip`, and `vitalityTip` are either all absent or all present as non-empty strings of at most 4,096 Unicode scalar values. Absence maps to null `sourceGuidance`; presence creates `SourceSpecificRecoveryGuidance` with scheme `polar-nightly-recharge@1` and maps the fields to `exercise`, `sleep`, and `vitality` respectively.

Guidance is retained verbatim as user-owned source content. It is not translated by FitFreed, interpreted as medical advice, placed in diagnostics, or used to derive canonical measurements.

## Identity, reimport, and provenance

Identity is `(originId, night)`. The source records have no observed creation, modification, or orderable revision field. Consequently:

- canonical equality is equivalent;
- adding a previously unavailable nightly RMSSD value, assessment, baseline, baseline RMSSD pair, or guidance is an enrichment;
- omitting already retained optional content is preserved;
- changed known content or a mixed add-and-remove representation is a conflict;
- duplicate dates inside one package are invalid independently of array or ZIP order.

Per-observation provenance retains the protected source artifact locator, source-record index, and hash. Public outcomes expose only stable coverage and reason codes.

## Deliberately unmapped information

Mapping version 1 does not persist:

- the contents of `nightly_recovery_blob` because no safe record relationship is established;
- a calculated heart-rate average or breathing rate;
- provider status labels, which are localized presentation for stored ordinal facts;
- assumed measurement-window boundaries; or
- any unknown future fields.

These omissions are known loss or explicit incompatibility boundaries, not claims that the ZIP lacks the information.
