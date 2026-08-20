# Polar Flow Personal Data Export Format

## Status

Discovery baseline, last verified on 2026-08-19. Polar Flow is the only provider export in MVP scope.

This reference describes the personal-data export archive, not the Polar AccessLink API and not the separate export of an individual training session. It contains no copied personal record, personal value, exact source path, archive count, archive size, timestamp sequence, route, identifier, or other private data-set fingerprint.

The observed baseline comes from clean-room structural analysis of one lawfully supplied private export. Analysis retained filename grammars, JSON field paths, structural types, and coarse scale characteristics while excluding record values from publication. Because the observations have not yet been reproduced across independent exports, every resulting claim remains explicitly scoped to the evaluated package.

## Official documentation assessment

No adequate public official specification for the complete Polar Flow personal-data export format was found during the review dated above.

The adequacy test requires public documentation of the archive layout, artifact naming, JSON shapes, fields, types, relationships, versions, and compatibility guarantees. The official sources found cover adjacent concerns but do not meet that test:

| Official source | What it establishes | What it does not establish |
|---|---|---|
| [How to download all your data from Polar Flow](https://support.polar.com/us-en/how-to-download-all-your-data-from-polar-flow) | The request and download workflow and a high-level description of export contents | ZIP layout, filenames, JSON schemas, field semantics, relationships, versions, and compatibility rules |
| [Export training sessions from Polar Flow](https://support.polar.com/us-en/export-training-sessions-flow) | Separate export options for individual training sessions | The account-level personal-data export contract |
| [Polar AccessLink API](https://www.polar.com/accesslink-api/) | A developer API for accessing selected Polar data | The personal-data export archive contract |
| [Polar AccessLink Dynamic API](https://www.polar.com/polar-api-v4/) | Public training-session and sleep contracts, including units, time semantics, sleep phases, interruptions, ratings, scores, and separate authenticated catalogues that correspond to parts of the observed artifacts | The takeout ZIP layout, filename grammar, split sleep-artifact relationship, historical export variants, or archive compatibility guarantees |
| [Polar AccessLink API](https://www.polar.com/accesslink-api/) and [Nightly Recharge documentation](https://support.polar.com/us-en/nightly-recharge-recovery-measurement) | Public nightly-recovery measurements, units, status scales, comparison window, and product meaning that correspond to parts of the observed artifacts | The takeout ZIP layout, field names, split recovery blob, baselines, guidance strings, or archive compatibility guarantees |
| [Polar's official GitHub organization](https://github.com/polarofficial) | Public SDKs, examples, and API-related projects | A complete personal-data export specification found by this review |

This conclusion is deliberately time-bounded. A later official specification takes precedence for facts within its stated scope, while historical observations remain relevant to archives produced before that specification.

### Documented-scope discrepancy

The official download guide states at a high level that the export excludes algorithm-derived activity and sleep data. The evaluated export nevertheless contains artifact families explicitly named for activity, sleep results, sleep scores, and nightly recovery. This reference records both facts without treating filenames as proof of field semantics or assuming that the guide, export composition, or account history is universally representative. The discrepancy remains open until more authoritative or independently reproducible evidence establishes its cause and scope.

## Evidence model

The remainder of this reference will label claims as **Official**, **Observed**, **Interpretation**, or **Unknown** using the definitions in the [data format documentation index](../README.md). Conflicts are recorded rather than silently resolved in favor of an assumption.

## Observed archive-level characteristics

| Characteristic | Evidence | Current finding |
|---|---|---|
| Delivery container | Official and observed | The personal-data download is delivered as a ZIP archive; FitFreed accepts that archive directly. |
| Artifact encodings | Observed | The evaluated archive contains JSON artifacts and binary profile-picture artifacts. |
| Layout | Observed | Evaluated artifacts are stored at the archive root rather than grouped into semantic directories. |
| Granularity | Observed | The format mixes singleton, periodic, daily, per-session, and partitioned high-resolution artifacts. |
| Homogeneity | Observed | JSON roots and nested structures vary by artifact family and historical record. There is no single observed envelope shared by all families. |
| Scale | Observed | Realistic exports may contain thousands of artifacts, multi-gigabyte content, and large sample series. Exact reference-export metrics remain private. |
| Declared format version | Unknown | No archive-wide version contract has been established. Compatibility must be inferred per artifact family until better evidence exists. |

## Artifact family registry

This registry is the public coverage index. Detailed shapes, fields, identities, variants, mapping status, and synthetic examples will be added for each family as clean-room discovery and importer implementation proceed.

| Family | Observed artifact role | MVP evaluation status |
|---|---|---|
| Account and profile | Account attributes, profile, preferences, and profile pictures | Account data is supported only for source-subject correlation; account profile and picture artifacts are deliberately ignored by the MVP |
| Devices | Active and archived products, registrations, and device settings | Recognized and unsupported |
| Daily activity | Daily summaries, activity samples, and inactivity events | Filename grammar, source-subject correlation, filename/content date consistency, duplicate-date rejection, and the documented shape-based canonical step-count mapping are supported; compatibility is limited to the evaluated structural matrix |
| Continuous heart rate | Partitioned high-resolution daily heart-rate samples | Recognized and deliberately ignored because full-resolution physiological exploration is excluded from the MVP |
| Beat-to-beat samples | Partitioned high-resolution physiological samples | Recognized and deliberately ignored because full-resolution physiological exploration is excluded from the MVP |
| Training | Sessions, exercises, laps, zones, routes, and sample series | Session summaries, exercise/lap/pause structure, primary and transition routes, documented regular signal series, and heart-rate, speed, and power zone distributions are supported through training mapping version 5; RR values, irregular samples, unknown series, and unsupported zone kinds remain deliberately unmapped |
| Planning | Calendar entries, targets, favorites, programs, and personal events | Recognized and unsupported |
| Sleep | Sleep timing, phases, interruptions, continuity, and scores | Result and score arrays are supported by mapping version 1; compatibility remains limited to the evaluated split-artifact structure and documented API correspondence |
| Recovery | Nightly recovery measurements, recommendations, and related physiological observations | Dated nightly-recovery summaries are specified for mapping version 1; the undated sample blob is deliberately excluded because no safe record relationship is established |
| Tests | Fitness and orthostatic test results | Recognized and unsupported |
| Physical evolution | Historical physical measurements and thresholds | Recognized inside unsupported account, activity, calendar, and training structures; no separate artifact grammar is claimed |
| Sport configuration | Sport profiles, zones, units, and reminders | Recognized and unsupported |

An artifact that is recognized but unsupported will remain visible as unsupported. An unfamiliar artifact will be reported as unrecognized. Recognized content that fails its structural contract is invalid, while a deliberately excluded family retains its explicit policy reason. None of these states is equivalent to a successful import. The desktop groups these results by family, classification, and reason and provides localized next actions without displaying archive filenames or personal values.

The executable registry matches the complete observed lexical filename grammars, including date, numeric, month, partition, size, and UUID-shaped tokens. A prefix match, shortened synthetic suffix, nested path, or malformed near miss does not claim family compatibility. Strict filename recognition does not establish that delivery tokens are stable identifiers or that the JSON root and fields are valid; those are separate family checks.

## Observed filename grammars and roots

**Evidence: Observed.** The table merges repeated month, partition, date, session, and picture-size instances into grammars. Placeholder names describe lexical shape only; they do not assert that a numeric or UUID-shaped token is an account, record, or stable domain identifier.

| Artifact family | Observed filename grammar | Root shape | Observed top-level fields for object roots |
|---|---|---|---|
| Continuous heart rate | `247ohr_{numeric-token}_{month}-{uuid-token}.json` | object | `deviceDays` |
| Account data | `account-data-{numeric-token}-{uuid-token}.json` | object | `exportVersion`, `firstName`, `lastName`, `linkedApplications`, `linkedOrganisations`, `nickname`, `physicalInformation`, `settings`, `username` |
| Account profile | `account-profile-{numeric-token}-{uuid-token}.json` | object | `city`, `countryCode`, `exportVersion`, `favouriteSports`, `motto`, `phone`, `state`, `street1`, `zip` |
| Daily activity | `activity-{date}-{uuid-token}.json` | object | `date`, `exportVersion`, `physicalInformation`, `samples`, optional `summary` |
| Calendar items | `calendar-items-{numeric-token}-{uuid-token}.json` | object | `exportVersion`, `feedbacks`, `feelings`, `notes`, `perceivedRecovery`, `physicalInformations`, `weights` |
| Favorite targets | `favourite-targets-{numeric-token}-{uuid-token}.json` | array | not applicable |
| Fitness test results | `fitness-test-results-{numeric-token}-{date}-{time}-000-{uuid-token}.json` | object | `created`, `fitnessTestResult`, `modified`, `startTime` |
| Nightly recovery blob | `nightly_recovery_blob_{numeric-token}-{uuid-token}.json` | array | not applicable |
| Nightly recovery | `nightly_recovery_{numeric-token}-{uuid-token}.json` | array | not applicable |
| Orthostatic test result | `orthostatic-test-result-{numeric-token}-{numeric-token}-{uuid-token}.json` | object | `created`, `modified`, `orthostaticTestResult`, `startTime` |
| Beat-to-beat samples | `ppi_samples_{numeric-token}_{month}_{partition}-{uuid-token}.json` | array | not applicable |
| Products and devices | `products-devices-{numeric-token}-{uuid-token}.json` | object | `archivedDevices`, `devices`, `exportVersion`, `productRegistrationEvents` |
| Profile picture | `profile-picture-{numeric-token}-{size}-{uuid-token}.data` | binary | not applicable |
| Event training programs | `programs-eventtrainingprograms-{numeric-token}-{uuid-token}.json` | array | not applicable |
| Fitness-level snapshots | `programs-fitnesslevelsnapshots-{numeric-token}-{uuid-token}.json` | array | not applicable |
| General training programs | `programs-generaltrainingprograms-{numeric-token}-{uuid-token}.json` | array | not applicable |
| Personal events | `programs-personalevents-{numeric-token}-{uuid-token}.json` | array | not applicable |
| Sleep result | `sleep_result_{numeric-token}-{uuid-token}.json` | array | not applicable |
| Sleep score | `sleep_score_{numeric-token}-{uuid-token}.json` | array | not applicable |
| Sport profiles | `sport-profiles-{numeric-token}-{uuid-token}.json` | array | not applicable |
| Training session | `training-session_{date-time}_{numeric-token}-{uuid-token}.json` or `training-session_{date-time}_{uuid-token}-{uuid-token}.json` | object | `application`, `calories`, `carboPercentage`, `created`, `deviceId`, `distanceMeters`, `durationMillis`, `exercises`, `fatPercentage`, `favoriteTarget`, `feeling`, `hrAvg`, `hrMax`, `identifier`, `latitude`, `longitude`, `modified`, `name`, `note`, `physicalInformation`, `product`, `proteinPercentage`, `recoveryTimeMillis`, `sport`, `startTime`, `stopTime`, `timezoneOffsetMinutes`, `trainingBenefit`, `trainingLoad`, `trainingLoadReport`, `trainingTarget` |
| Training target | `training-target-{date}-{numeric-token}-{uuid-token}.json` | object | `description`, `done`, `exercises`, `exportVersion`, `name`, `nonUserEditable`, `startTime` |

Observed periodic grammars use month tokens `01` through `12`; beat-to-beat files also use partition tokens `1` through `4`. This describes the evaluated package only and is not a guarantee that every export contains all periods or that four partitions is a contractual maximum.

## Daily activity family

### Structural contract

**Evidence: Observed.** Each evaluated daily activity artifact is a JSON object. Its `date` is an ISO calendar-date string, matches the date embedded in its filename, and is unique within the evaluated package. These observations support compatibility tests but do not prove cross-export stability by themselves.

| Path | Observed type | Established meaning or limitation |
|---|---|---|
| `date` | string | Local calendar date; no time-zone identifier is present at this level. |
| `exportVersion` | string | Source format metadata; supported values and compatibility semantics remain to be established. |
| `physicalInformation` | object | A physical-information snapshot associated with the day. It is mapped separately from daily activity rather than copied into that canonical concept. |
| `physicalInformation.aerobicThreshold` | integer | Source-named physiological field; unit and semantics are not yet established. |
| `physicalInformation.anaerobicThreshold` | integer | Source-named physiological field; unit and semantics are not yet established. |
| `physicalInformation.birthday` | string | Sensitive profile field; mapping is outside daily activity. |
| `physicalInformation.height, cm` | number | Height with a unit embedded in the source field name. |
| `physicalInformation.maximumHeartRate` | integer | Source-named physiological field. |
| `physicalInformation.restingHeartRate` | integer | Source-named physiological field. |
| `physicalInformation.sex` | string | Sensitive profile classification; observed enumeration is not yet published. |
| `physicalInformation.sleepGoal` | string | Source-named duration or goal field; exact syntax is not yet established publicly. |
| `physicalInformation.vo2Max` | integer | Source-named physiological field; semantic and precision rules remain open. |
| `physicalInformation.weight, kg` | number | Weight with a unit embedded in the source field name. |
| `samples.metSources` | array of strings | Source classifications associated with MET samples; enumeration semantics remain open. |
| `samples.mets[]` | object | Ordered MET sample structure. |
| `samples.mets[].localTime` | string | Source-local sample time; no offset or zone contract is established. |
| `samples.mets[].value` | number | Source-named MET value. |
| `samples.steps[]` | object | Ordered step sample structure. |
| `samples.steps[].localTime` | string | Source-local sample time; no offset or zone contract is established. |
| `samples.steps[].value` | integer | Step sample value. |
| `summary` | object, optional | Daily summary. Absence is observed and is distinct from a present zero-valued summary. |
| `summary.activityLevels[]` | object | Source activity-level entry. |
| `summary.activityLevels[].duration` | string | Duration syntax remains to be specified. |
| `summary.activityLevels[].level` | string | Source enumeration whose values and ordering remain to be specified. |
| `summary.calories` | integer | Unit is not established by the export documentation found. |
| `summary.dailyMetMinutes` | number | Source-named aggregate. |
| `summary.endTime` | string | Local time-of-day in the evaluated package. Together with `date`, it may cross into the following day. |
| `summary.inactivityAlertCount` | integer | Count of source-defined inactivity alerts. |
| `summary.sleepDuration` | string | Source-derived sleep summary; it is not treated as the canonical sleep record. |
| `summary.sleepQuality` | number | Source-derived sleep summary; scale and null semantics remain open. |
| `summary.startTime` | string | Local time-of-day in the evaluated package. |
| `summary.stepCount` | integer | Daily step total. |
| `summary.stepsDistance` | number | Distance unit is not established by the export documentation found. |

### Mapping and identity implications

**Evidence: Interpretation.** The candidate canonical identity is a local source-subject identity plus `date`, not the filename UUID, artifact fingerprint, or import order. A second provider's summary for the same date is a separate observation until an explicit cross-source composition rule exists.

The absence of a time-zone identifier means the date and source-local sample times must be preserved without conversion through the computer's current time zone. A later observation with the same candidate identity is equivalent only when its mapped canonical content is equivalent. A strict, non-conflicting enrichment may be an amendment; competing changed values remain a conflict unless stronger source evidence establishes deterministic precedence.

The evaluated export alone cannot prove a provider-stable account key. The source-subject contract introduced by Polar adapter version 2 and retained by version 3 therefore requires exactly one account-data artifact with a non-empty string `username`, applies exact versioned matching, and passes the transient value to the library-scoped resolver defined by [ADR 0005](../../architecture/decisions/0005-use-library-scoped-source-subject-correlation.md). The raw value is never canonical identity or stored correlation state. A changed or unmatched claim fails closed; no filename token is promoted to identity evidence.

The implemented walking-skeleton transformation is specified normatively in the [Polar Flow daily activity mapping](../mappings/polar-flow-daily-activity.md). This provider reference remains descriptive evidence and does not define FitFreed behavior by itself.

## Training-session family

### Structural contract

The public Polar AccessLink Dynamic API now specifies the same `TrainingSession` object and field names observed in the personal-data export. It is **Official** evidence for those field meanings, types, units, and nested contracts. It is not evidence for the ZIP container, delivery filename, cross-export identifier stability, or which optional fields a particular takeout includes. Those aspects remain **Observed** or **Unknown**.

Each evaluated training-session artifact is an object. The `identifier.id`, `created`, `modified`, `startTime`, `stopTime`, and `durationMillis` fields are present in every evaluated artifact. `identifier.id` is a non-empty string and is unique within the evaluated package; it is not restricted to a UUID lexical form. The filename timestamp matches `startTime` to whole-second precision in the evaluated package. Cross-export stability of `identifier.id` remains unproven by the single-package observation.

| Path | Evidence | Type and optionality | Established meaning or limitation |
|---|---|---|---|
| `identifier.id` | Official and observed | non-empty string; containing object is optional in the official API and present in every evaluated artifact | Polar training-session reference. FitFreed requires it for supported summary identity and scopes it to the resolved source subject. |
| `created` | Official and observed | required string | ISO 8601 creation time with UTC semantics. The evaluated representation uses millisecond precision without an explicit offset marker. |
| `modified` | Official and observed | required string | ISO 8601 last-modification time with UTC semantics. It is source revision evidence, not the time of the training. |
| `startTime` | Official and observed | required string | ISO 8601 local date-time in the user's local time zone. The evaluated representation uses whole-second precision and no embedded offset. |
| `stopTime` | Official and observed | required string | ISO 8601 local date-time. FitFreed preserves it independently from the declared duration. |
| `timezoneOffsetMinutes` | Official and observed | optional signed integer | Offset from UTC in minutes. Absence is unknown offset, not zero. |
| `durationMillis` | Official and observed | required non-negative integer | Declared session duration in milliseconds. Evaluated sessions include cases where it is equal to, shorter than, and longer than the local wall-clock difference, so it must not be derived from `startTime` and `stopTime`. |
| `distanceMeters` | Official and observed | optional finite non-negative number | Distance in metres. Absence means unavailable and is distinct from zero. |
| `calories` | Official and observed | optional non-negative integer | Expended energy in kilocalories. Absence means unavailable and is distinct from zero. |
| `hrAvg` | Official and observed | optional non-negative integer | Average heart rate in beats per minute. |
| `hrMax` | Official and observed | optional non-negative integer | Maximum heart rate in beats per minute. Every comparable evaluated pair has `hrAvg <= hrMax`. |
| `sport.id` | Official and observed | optional string reference | Identifier in Polar's separately managed sports catalogue. The evaluated takeout contains decimal-shaped references but no catalogue that resolves them to public names. |
| `exercises` | Official and observed | optional array | Nested exercise summaries. Absence, one exercise, and multiple exercises are observed. A single nested exercise is not assumed equivalent to the session aggregate. |

Evaluated exercise objects also correspond to the official nested `TrainingSession` contract:

| Path | Evidence | Type and optionality | Established meaning or limitation |
|---|---|---|---|
| `exercises[].identifier.id` | Official and observed | required non-empty string in evaluated exercises | Exercise-scoped reference. It is unique within each evaluated session and does not replace aggregate identity. |
| `exercises[].created` | Official and observed | required string in evaluated exercises | Creation time with UTC semantics; not the exercise start. |
| `exercises[].modified` | Official and observed | required string in evaluated exercises | Child modification evidence. FitFreed uses the aggregate `modified` value for atomic session reconciliation. |
| `exercises[].startTime` | Official and observed | required string in evaluated exercises | Local exercise start without an embedded offset in the evaluated representation. |
| `exercises[].stopTime` | Official and observed | required string in evaluated exercises | Local exercise stop, preserved independently from declared duration. |
| `exercises[].timezoneOffsetMinutes` | Official and observed | optional signed integer | Offset from UTC in minutes; absence remains unknown. |
| `exercises[].durationMillis` | Official and observed | required non-negative integer in evaluated exercises | Declared exercise duration in milliseconds. |
| `exercises[].distanceMeters` | Official and observed | optional finite non-negative number | Exercise distance in metres. |
| `exercises[].calories` | Official and observed | optional non-negative integer | Exercise energy in kilocalories. |
| `exercises[].sport.id` | Official and observed | optional string reference | Exercise-level reference in Polar's separate sports catalogue. |
| `exercises[].laps` | Official and observed | optional object | Container for separately ordered source/manual and automatic laps. |
| `exercises[].laps.laps[]` | Official and observed | optional object array | Source/manual laps with `splitTimeMillis`, `durationMillis`, and optional `distanceMeters`. |
| `exercises[].laps.autoLaps[]` | Official and observed | optional object array | Automatic laps with the same supported measurement shape. |
| `exercises[].pauseTimes[]` | Official and observed | optional object array | Ordered pauses with local `startTime` and `endTime`; evaluated exports mix minute, second, and fractional-second precision. |
| `exercises[].routes` | Observed with official route correspondence | optional object | Container whose absence differs from a present object without route kinds. |
| `exercises[].routes.route` | Observed with official route correspondence | optional object | Primary exercise route with a local `startTime` and ordered `wayPoints`. |
| `exercises[].routes.transitionRoute` | Observed with official route correspondence | optional object | Separately attributed transition route in multisport-compatible source structure. |
| route `.startTime` | Official correspondence and observed | required string in evaluated route objects | Source-local route start without an embedded offset in the evaluated representation. |
| route `.wayPoints[]` | Official correspondence and observed | required ordered array in evaluated route objects | Recorded locations; an empty array is structurally valid for current mapping. |
| `.wayPoints[].latitude` | Official correspondence and observed | required finite number | WGS84 latitude in degrees. |
| `.wayPoints[].longitude` | Official correspondence and observed | required finite number | WGS84 longitude in degrees. |
| `.wayPoints[].altitude` | Official correspondence and observed | optional finite number | Recorded altitude in metres. |
| `.wayPoints[].elapsedMillis` | Observed | optional non-negative integer | Elapsed route offset in milliseconds; the API location model uses a duration-valued time field rather than this takeout field name. |
| `exercises[].samples` | Observed with official sample correspondence | optional object | Container whose absence differs from present primary or transition collections. |
| `exercises[].samples.samples` | Observed with official interval-series correspondence | optional ordered array | Regular measurements attributed to the exercise. |
| `exercises[].samples.transitionSamples` | Observed with official interval-series correspondence | optional ordered array | Regular measurements separately attributed to a transition. |
| regular series `.type` | Official correspondence and observed | required string in evaluated series | Source measurement enumeration; only explicitly mapped meanings enter the canonical vocabulary. |
| regular series `.intervalMillis` | Official correspondence and observed | required positive integer in evaluated series | Regular interval in milliseconds. |
| regular series `.values[]` | Official correspondence and observed | required ordered array of numbers or the string `NaN` | Source slot values; `NaN` represents an unavailable slot rather than zero. |
| `exercises[].zones` | Official and observed | optional ordered array | Aggregate zone groups attributed to the exercise; absence differs from present-empty. |
| zone group `.type` | Official correspondence and observed | required string | The API enum defines `HEART_RATE`, `SPEED`, `POWER`, `FIT_FAT`, and `UNSPECIFIED`; the takeout uses corresponding `ZONE_TYPE_` tokens in the evaluated shapes. |
| zone group `.zones` | Official and observed | optional ordered array | Aggregate bands for one zone kind; absence differs from present-empty. |
| zone band `.lowerLimit` | Official and observed | required number in the API and every mapped evaluated band | Lower bound in the group type's unit. |
| zone band `.higherLimit` | Official and observed | required number in the API and every mapped evaluated band | Higher bound in the group type's unit. |
| zone band `.inZone` | Official and observed | required integer in the API; absent or integer in the evaluated takeout | Aggregate time in milliseconds. Takeout absence is unknown, not zero. |
| zone band `.distanceMeters` | Official and observed | optional number for speed zones | Aggregate distance in metres. |
| zone band `.muscleLoad` | Official and observed | optional number for power zones | Source-recorded muscle load; no cross-kind or medical meaning is inferred. |

**Evidence: Official correspondence and observed.** The evaluated regular-series type set includes altitude,
cadence, distance, heart rate, speed, temperature, explicit left-crank current power, and more specialized
crank-mechanics series. Polar's current interval-series contract establishes the series container and type
enumeration; its training-sample contracts establish beats per minute for heart rate, kilometres per hour for
speed, metres for distance and altitude, rotations per minute for cadence, degrees Celsius for temperature,
and watts for power. This correspondence does not make the API a specification of takeout field names or
historical archive compatibility.

**Evidence: Official correspondence and observed.** Polar's current zone contract establishes heart-rate,
speed, power, fit-versus-fat, and unspecified group meanings, milliseconds for time in zone, metres for speed
zone distance, and power-zone muscle load. The evaluated takeout uses `ZONE_TYPE_HEART_RATE`,
`ZONE_TYPE_SPEED`, `ZONE_TYPE_POWER`, and `ZONE_TYPE_FIT_FAT`; it also contains a mapped band without
`inZone`, although the current API marks that field required. FitFreed therefore documents the takeout
absence explicitly instead of treating the API as a stricter archive guarantee.

Absent, present-empty, and populated nested collections occur as distinct structural states and are not
interchangeable. The public API additionally defines optional names, notes, device and product references,
feelings, coordinates, energy-source percentages, recovery time, targets, training benefit and load, tests,
hills, comments, exercise statistics, zones, and sample series. Only the explicitly documented regular-series
and zone meanings enter the current mapping; every other optional field remains outside it until its domain
meaning, privacy boundary, relationship, and product use are specified.

### Relationships and variants

**Evidence: Official and observed.** A session is the aggregate root and `exercises` is an optional child collection. The evaluated package contains sessions without the collection, single-exercise sessions, and multiple-exercise sessions. For single-exercise sessions, aggregate start, stop, duration, distance, and other summary values may agree or differ from the child. Multiple exercises may use different sport references. FitFreed therefore maps the aggregate fields directly and never substitutes, sums, or otherwise derives them from exercises.

The optional top-level `sport.id` is present for the evaluated single- and multiple-exercise variants and absent for the evaluated no-exercise variant. When both the aggregate and every exercise have sport references, evaluated single-exercise references agree with the aggregate, while evaluated multiple-exercise sessions may contain different child references. Regular signal and zone collections occur on exercises rather than at aggregate identity level. These observations describe compatibility evidence rather than a universal invariant.

Polar documents an authenticated `/v4/data/sports/list` catalogue that resolves sport identifiers to names and parent sports. That catalogue is not present in the evaluated takeout, and the observed `sport-profiles` artifact contains user settings keyed by a different source field rather than the required identifier-to-name catalogue. Training-summary version 1 preserves the aggregate sport reference as opaque source classification evidence. It does not publish, guess, or present a sport name from that value.

### Identity, revision, time, and loss implications

**Evidence: Interpretation.** The supported source identity candidate is the resolved source subject plus exact `identifier.id`. The delivery filename UUID, filename timestamp, artifact hash, import order, and nested exercise identifiers are not session identity. Reimport safety treats a later record with the same identity and equivalent content as equivalent. Source `modified` ordering is revision evidence: a newer differing record is an amendment, an older differing record is preserved without rollback, and equal or unorderable revision evidence with differing canonical content is a conflict.

Local start and stop values are parsed without using the computer's current time zone. The optional offset is preserved separately. When it is present, an absolute instant may be calculated as local time minus the documented offset; when it is absent, FitFreed must not invent an instant or a time zone. Calendar grouping uses the preserved local start date.

Training-structure version 1 persists evaluated exercises, source/manual laps, automatic laps, and pauses while preserving collection absence. Training-route version 1 separately persists primary and transition route waypoints so lightweight structure reads never load sensitive geometry. Training-signal version 1 persists supported primary and transition regular series with exact unavailable slots, while counting unmapped regular types without publishing their tokens or values. Training-zone version 1 persists exact heart-rate, speed, and power aggregate bands while counting unsupported groups without retaining their tokens or values. The current mapping deliberately does not persist standalone session or exercise `latitude` and `longitude`, RR samples, irregular samples, unsupported zone values, notes, comments, physical information, device identifiers, or product metadata. Ignoring those fields is known loss, not evidence that the original ZIP lacks them. The archive member remains classified as supported when its current mapping contract passes; excluded nested content does not become a second successful artifact and is disclosed by the mapping contract.

The normative transformation is specified in the [Polar Flow training-session mapping](../mappings/polar-flow-training-session.md). The provider reference remains descriptive evidence and does not define FitFreed behavior by itself.

## Sleep family

### Artifact relationship and record identity

**Evidence: Observed.** Sleep history is split across one result-array grammar and one score-array grammar. Both arrays use a required `night` calendar-date string. Each evaluated array contains at most one entry for a given `night`; every evaluated score date references a result date, while some result dates have no score. Delivery filename tokens do not appear as record fields and have no established identity meaning.

**Evidence: Interpretation.** The supported source identity candidate is the resolved source subject plus exact `night`. It is a source-assigned date, not a date derived from the local component of `sleepStart` or `sleepEnd`: evaluated start and end boundaries may fall on the assigned date or the preceding date. An export containing multiple result or score entries for the same source subject and `night` is incompatible with mapping version 1.

### Sleep-result structure

Each evaluated result artifact is an array of objects with required `night`, `evaluation`, and `sleepResult` members. Optionality below describes the evaluated package, not a cross-export guarantee.

| Path | Evidence | Observed type and optionality | Established meaning or limitation |
|---|---|---|---|
| `night` | Official correspondence and observed | required date string | Source-assigned sleep date. The Dynamic API names the corresponding concept `sleepDate`. |
| `sleepResult.hypnogram.sleepStart` | Official correspondence and observed | required offset date-time string | Local sleep-start boundary with an explicit numeric UTC offset. |
| `sleepResult.hypnogram.sleepEnd` | Official correspondence and observed | required offset date-time string | Local sleep-end boundary with an explicit numeric UTC offset. |
| `sleepResult.hypnogram.sleepStartOffset` | Official correspondence and observed | required integer | The Dynamic API documents a similarly named seconds field used for sleep trimming, but the takeout field omits the unit suffix and its arithmetic relationship is not established. |
| `sleepResult.hypnogram.sleepEndOffset` | Official correspondence and observed | required integer | Same limitation as the start offset. |
| `sleepResult.hypnogram.rating` | Official correspondence and observed | required string enumeration | Self-reported sleep rating. Observed values are members of the current official rating enumeration without its API prefix. |
| `sleepResult.hypnogram.sleepGoal` | Official correspondence and observed | required ISO 8601 duration string | User-selected sleep-duration goal. |
| `sleepResult.hypnogram.birthday` | Official correspondence and observed | required date string | Sensitive scoring input; it belongs to physical history rather than canonical sleep identity. |
| `sleepResult.hypnogram.deviceId` | Official correspondence and observed | required string | Sensitive source device reference; no public value is retained in this reference. |
| `sleepResult.hypnogram.batteryRanOut` | Official correspondence and observed | required boolean | Source indication that device power ended during the recording. |
| `sleepResult.hypnogram.alarmSnoozeTimes` | Official correspondence and observed | required array | Alarm behavior; element values are not part of the supported canonical sleep contract. |
| `sleepResult.hypnogram.sleepStateChanges[]` | Official correspondence and observed | required ordered object array | Sleep-state transitions expressed as an ISO 8601 duration offset plus a state enumeration. The official Dynamic API describes the list but does not establish a takeout offset boundary. |
| `sleepResult.sleepCycles` | Official correspondence and observed | optional object | Present for the evaluated staged-sleep variant. Its takeout nesting differs from the current API array. |
| `sleepResult.sleepCycles.cycles.sleepCycleModels[]` | Observed | object array when cycles are present | Each item has numeric `secondsFromSleepStart` and `sleepDepthStart`; exact depth semantics are not established by the takeout. |
| `evaluation.sleepType` | Official correspondence and observed | required string | Evaluated values distinguish historical result variants, but current API descriptions conflict with observed phase availability and are not treated as a stable export contract. |
| `evaluation.sleepSpan` | Official correspondence and observed | required ISO 8601 duration | Declared span including interruptions. It does not always equal the difference between the recorded boundary instants. |
| `evaluation.asleepDuration` | Official correspondence and observed | required ISO 8601 duration | Declared time asleep. |
| `evaluation.age` | Observed | required number | Source algorithm input; it is not canonical sleep identity. |
| `evaluation.analysis.efficiencyPercent` | Official correspondence and observed | required number | Sleep efficiency percentage. Evaluated values agree with asleep duration divided by declared span within source precision. |
| `evaluation.analysis.continuityIndex` | Official correspondence and observed | required number | Continuity index on the official 0-to-5 scale. |
| `evaluation.analysis.continuityClass` | Official correspondence and observed | required integer | Source continuity classification on the official 0-to-5 scale. |
| `evaluation.analysis.feedback` | Official correspondence and observed | required integer in the takeout | The current API documents a five-character encoded feedback string. The type difference is historical compatibility evidence and the takeout integer is not decoded by mapping version 1. |
| `evaluation.interruptions` | Official correspondence and observed | required object | Total, long, and short ISO 8601 durations plus corresponding integer counts. |
| `evaluation.phaseDurations` | Official correspondence and observed | optional object | Present for every evaluated staged-sleep entry and absent for the evaluated earlier variant. |
| `evaluation.phaseDurations.wake` | Official correspondence and observed | duration string when phase data exists | Wake time inside the sleep span. |
| `evaluation.phaseDurations.rem` | Official correspondence and observed | duration string when phase data exists | REM sleep duration. |
| `evaluation.phaseDurations.light` | Official correspondence and observed | duration string when phase data exists | Light non-REM duration. |
| `evaluation.phaseDurations.deep` | Official correspondence and observed | duration string when phase data exists | Deep non-REM duration. |
| `evaluation.phaseDurations.unknown` | Official correspondence and observed | duration string when phase data exists | Unrecognized phase duration. |
| `evaluation.phaseDurations.remPercentage` | Official correspondence and observed | number when phase data exists | Source-calculated percentage; no independent takeout denominator contract is established. |
| `evaluation.phaseDurations.deepPercentage` | Official correspondence and observed | number when phase data exists | Source-calculated percentage with the same limitation. |

The evaluated arithmetic is internally coherent: asleep plus interruption durations equals the declared span; long plus short interruptions equals the total; phase durations total the span; and non-wake phases total asleep duration. These are compatibility findings for the evaluated package and mapping version 1 validation rules, not a claim that malformed future data should be repaired automatically.

The Dynamic API documents wake, REM, three non-REM levels, and unknown states. The takeout uses corresponding shorter names. FitFreed combines non-REM levels 1 and 2 as light sleep, maps level 3 to deep sleep, and retains unknown time explicitly.

**Evidence: Observed.** Every evaluated transition that affects the declared span is ordered inside that span. Some sequences append one final `WAKE` transition after the span; no evaluated sequence has another out-of-span form. **Evidence: Interpretation.** Mapping version 1 treats that final wake transition as an out-of-period terminal marker, excludes it from the canonical in-period timeline, and rejects any other out-of-span transition rather than generalizing from one package.

### Sleep-score structure

Each evaluated score artifact is an array of objects with required `night`, `sleepScoreResult`, and `sleepScoreBaselines` members. `sleepScoreResult` corresponds to the current official score model while the separate artifact and baseline object are not an officially documented takeout contract.

| Path | Evidence | Observed type and optionality | Established meaning or limitation |
|---|---|---|---|
| `sleepScoreResult.sleepScore` | Official correspondence and observed | required number | Overall score on the official 1-to-100 scale. |
| `sleepScoreResult.sleepTimeOwnTargetScore` | Official correspondence and observed | required number | Duration component relative to the user's own goal. |
| `sleepScoreResult.sleepTimeRecommendationScore` | Official correspondence and observed | required number | Duration component relative to a source recommendation. |
| `sleepScoreResult.continuityScore` | Official correspondence and observed | required number | Continuity component score. |
| `sleepScoreResult.efficiencyScore` | Official correspondence and observed | required number | Efficiency component score. |
| `sleepScoreResult.remScore` | Official correspondence and observed | required number | REM component score. |
| `sleepScoreResult.n3Score` | Official correspondence and observed | required number | Deep non-REM component score. |
| `sleepScoreResult.longInterruptionsScore` | Official correspondence and observed | required number | Long-interruption component score. The current API uses the longer `longInterruptionsTimeScore` name. |
| `sleepScoreResult.groupDurationScore` | Official correspondence and observed | required number | Aggregate duration-theme score. |
| `sleepScoreResult.groupSolidityScore` | Official correspondence and observed | required number | Aggregate solidity-theme score. |
| `sleepScoreResult.groupRefreshScore` | Official correspondence and observed | required number | Aggregate regeneration or refresh-theme score. |
| `sleepScoreResult.scoreRate` | Official correspondence and observed | optional integer | Five-point comparison with the user's source-defined usual level. |
| `sleepScoreBaselines.sleepTimeAverageMinutes` | Observed | required integer | Source baseline duration average in minutes. |
| `sleepScoreBaselines.longInterruptionsAverageTimeMinutes` | Observed | required integer | Source baseline long-interruption average in minutes. |
| remaining `sleepScoreBaselines` fields | Observed | optional numbers | Baseline score and phase-percentage values. Their lookback window and source revision semantics are not established by the takeout. |

The score arrays contain no observed per-record creation or modification timestamp. Changed content for an existing identity cannot be ordered safely by import time, ZIP order, or delivery filename. The normative join, validation, known-loss, and reconciliation behavior is defined by [Polar Flow sleep mapping version 1](../mappings/polar-flow-sleep.md).

## Nightly recovery family

### Official correspondence and artifact boundary

Polar's official AccessLink Nightly Recharge contract defines a dated recovery record with average beat-to-beat interval in milliseconds, HRV as RMSSD in milliseconds, average breathing rate, a six-level overall status, an autonomic charge from -10 through 10, a five-level autonomic status, and five-minute HRV and breathing samples. Polar's product documentation explains that the overall result combines sleep and autonomic-system charge and compares the night with the preceding 28-day usual level. Neither source documents the personal-data ZIP, its field names, its split artifacts, baseline fields, guidance strings, or their compatibility history.

**Evidence: Observed.** The takeout uses a dated `nightly_recovery` array and a separate `nightly_recovery_blob` array. The dated records contain summaries, optional baselines, optional statuses, and optional guidance. The blob contains only HRV and breathing sample groups; it has no date, record identifier, or documented relationship to a dated record.

**Evidence: Interpretation.** Mapping may use exact `night` as source identity for the dated summary. It must not associate blob entries by file order, array position, sample values, or filename delivery tokens.

### Dated nightly-recovery structure

| Path | Evidence | Observed type and optionality | Established meaning or limitation |
|---|---|---|---|
| `night` | Official correspondence and observed | required date string | Source-assigned recovery date and candidate identity component. |
| `meanNightlyRecoveryRri` | Official correspondence and observed | required positive integer | Mean beat-to-beat interval. The official corresponding unit is milliseconds. |
| `meanNightlyRecoveryRmssd` | Official correspondence and observed | optional non-negative integer | Mean heart-rate variability using RMSSD. The official corresponding unit is milliseconds. |
| `meanNightlyRecoveryRespirationInterval` | Observed | required positive integer | Mean interval between breaths. The API instead publishes breaths per minute, so the takeout interval is preserved without a derived rate. |
| `ansStatus` | Official correspondence, observed, and interpretation | optional finite number | Observed range corresponds to the official -10-through-10 autonomic-charge scale. |
| `ansRate` | Official correspondence, observed, and interpretation | optional integer | Observed range corresponds to the official five-level autonomic status. It appears and disappears with `ansStatus`. |
| `recoveryIndicator` | Official correspondence, observed, and interpretation | optional integer | Observed range corresponds to the official six-level overall Nightly Recharge status. |
| `recoveryIndicatorSubLevel` | Observed | optional integer | Finer source-defined status with no public scale semantics found. It appears and disappears with the other status fields. |
| `meanBaselineRri`, `sdBaselineRri` | Observed | optional integer pair | Source-computed beat-to-beat baseline mean and standard deviation. |
| `meanBaselineRmssd`, `sdBaselineRmssd` | Observed | optional integer pair | Independently optional RMSSD baseline mean and standard deviation. |
| `meanBaselineRespirationInterval`, `sdBaselineRespirationInterval` | Observed | optional integer pair | Source-computed breathing-interval baseline mean and standard deviation. |
| `exerciseTip`, `sleepTip`, `vitalityTip` | Observed | optional string group | Source-generated guidance. All three are present or absent together in the evaluated package. |

The status fields form one observed all-or-nothing group. The baseline is either absent, present without both RMSSD fields, or complete; its lookback, eligibility, and estimator are not documented by the takeout. Guidance availability is independent of status and baseline availability. Missing optional fields remain unavailable rather than zero or an inferred status.

### Nightly-recovery blob structure

Each blob entry contains optional `hrvData` and `breathingRateData` arrays. A present group contains `startTime`, positive integer `samplingIntervalInMillis`, and a numeric non-negative `samples` array. These structures correspond broadly to the official five-minute sample concepts, but the takeout's record relationship and time-zone semantics are unknown.

The complete evaluated blob sample content cannot be matched to a dated record through a documented key. Mapping version 1 therefore classifies the blob as deliberately ignored unidentifiable high-resolution content rather than silently joining it or claiming a successful import. The normative supported summary mapping is defined by [Polar Flow nightly recovery mapping version 1](../mappings/polar-flow-nightly-recovery.md).

## Family documentation template

Each supported family will document:

1. observed filename grammar and top-level JSON shape;
2. field paths, observed types, optionality, units, and enumeration evidence;
3. record identity, relationships, ordering, time semantics, and overlap behavior;
4. historical variants and incompatible observations;
5. mapping into the FitFreed canonical model, including ignored and lossy information;
6. import coverage and unknown-field behavior;
7. synthetic valid, boundary, malformed, unsafe, duplicate, overlapping, and amended examples;
8. verification date and evidence level for every claim.

## Open compatibility questions

- Whether Polar maintains a non-public schema or archive-wide version that can be cited publicly.
- Whether export composition depends on account age, locale, region, device history, enabled features, or export-generation date.
- Which identifiers are stable across repeated exports and which filenames are delivery-only details.
- Whether absent fields represent unsupported features, unavailable measurements, historical variants, or null domain values.
- Which source units and enumerations are contractual rather than implementation observations.
