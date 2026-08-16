# Polar Flow Personal Data Export Format

## Status

Discovery baseline, last verified on 2026-08-16. Polar Flow is the only provider export in MVP scope.

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
| [Polar AccessLink Dynamic API](https://www.polar.com/polar-api-v4/) | The public `TrainingSession` field contract, units, time semantics, nested structures, and separate authenticated sports catalogue that correspond to the observed training-session artifacts | The takeout ZIP layout, filename grammar, archive compatibility guarantees, or inclusion of the sports catalogue in a takeout |
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
| Training | Sessions, exercises, laps, zones, routes, and sample series | Session summaries are supported; routes, full-resolution samples, laps, zones, and nested exercise measurements are deliberately not persisted by summary mapping version 1 |
| Planning | Calendar entries, targets, favorites, programs, and personal events | Recognized and unsupported |
| Sleep | Sleep timing, phases, interruptions, continuity, and scores | Recognized and unsupported pending the sleep increment |
| Recovery | Nightly recovery measurements, recommendations, and related physiological observations | Recognized and unsupported pending the recovery increment |
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

The official contract also defines optional names, notes, device and product references, feelings, coordinates, energy-source percentages, recovery time, targets, training benefit and load, tests, hills, comments, exercise statistics, laps, zones, routes, and sample series. They remain outside training-summary version 1 until their domain meaning, privacy boundary, relationship, or product use is specified.

### Relationships and variants

**Evidence: Official and observed.** A session is the aggregate root and `exercises` is an optional child collection. The evaluated package contains sessions without the collection, single-exercise sessions, and multiple-exercise sessions. For single-exercise sessions, aggregate start, stop, duration, distance, and other summary values may agree or differ from the child. Multiple exercises may use different sport references. FitFreed therefore maps the aggregate fields directly and never substitutes, sums, or otherwise derives them from exercises.

The optional top-level `sport.id` is present for the evaluated single- and multiple-exercise variants and absent for the evaluated no-exercise variant. When both the aggregate and every exercise have sport references, evaluated single-exercise references agree with the aggregate, while evaluated multiple-exercise sessions may contain different child references. These observations describe compatibility evidence rather than a universal invariant.

Polar documents an authenticated `/v4/data/sports/list` catalogue that resolves sport identifiers to names and parent sports. That catalogue is not present in the evaluated takeout, and the observed `sport-profiles` artifact contains user settings keyed by a different source field rather than the required identifier-to-name catalogue. Training-summary version 1 preserves the aggregate sport reference as opaque source classification evidence. It does not publish, guess, or present a sport name from that value.

### Identity, revision, time, and loss implications

**Evidence: Interpretation.** The supported source identity candidate is the resolved source subject plus exact `identifier.id`. The delivery filename UUID, filename timestamp, artifact hash, import order, and nested exercise identifiers are not session identity. Reimport safety treats a later record with the same identity and equivalent content as equivalent. Source `modified` ordering is revision evidence: a newer differing record is an amendment, an older differing record is preserved without rollback, and equal or unorderable revision evidence with differing canonical content is a conflict.

Local start and stop values are parsed without using the computer's current time zone. The optional offset is preserved separately. When it is present, an absolute instant may be calculated as local time minus the documented offset; when it is absent, FitFreed must not invent an instant or a time zone. Calendar grouping uses the preserved local start date.

Training-summary version 1 deliberately does not persist `latitude`, `longitude`, nested route waypoints, interval samples, transition samples, RR samples, laps, zones, notes, comments, physical information, device identifiers, or product metadata. Ignoring those fields is known loss in the canonical summary, not evidence that the original ZIP lacks them. The archive member remains classified as supported when its summary is valid; excluded nested content does not become a second successful artifact and is disclosed by the mapping contract.

The normative transformation is specified in the [Polar Flow training-session mapping](../mappings/polar-flow-training-session.md). The provider reference remains descriptive evidence and does not define FitFreed behavior by itself.

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
