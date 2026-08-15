# Polar Flow Personal Data Export Format

## Status

Discovery baseline, last verified on 2026-08-15. Polar Flow is the only provider export in MVP scope.

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
| Account and profile | Account attributes, profile, preferences, and profile pictures | Discovery in progress |
| Devices | Active and archived products, registrations, and device settings | Discovery in progress |
| Daily activity | Daily summaries, activity samples, heart-rate samples, and inactivity events | Discovery in progress |
| Beat-to-beat samples | Partitioned high-resolution physiological samples | Discovery in progress; detailed exploration excluded from MVP |
| Training | Sessions, exercises, laps, zones, routes, and sample series | Discovery in progress; full-resolution and route exploration excluded from MVP |
| Planning | Calendar entries, targets, favorites, programs, and personal events | Discovery in progress |
| Sleep | Sleep timing, phases, interruptions, continuity, and scores | Discovery in progress |
| Recovery | Nightly recovery measurements, recommendations, and related physiological observations | Discovery in progress |
| Tests | Fitness and orthostatic test results | Discovery in progress |
| Physical evolution | Historical physical measurements and thresholds | Discovery in progress |
| Sport configuration | Sport profiles, zones, units, and reminders | Discovery in progress |

An artifact that is recognized but unsupported will remain visible as unsupported. An unfamiliar artifact will be reported as unrecognized. Neither state is equivalent to a successful import.

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

The stable Polar account key required to correlate the source subject across export packages is still an open compatibility question. No filename token is promoted to that role without evidence.

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
