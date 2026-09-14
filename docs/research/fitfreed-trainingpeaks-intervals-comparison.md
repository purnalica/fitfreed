# FitFreed, TrainingPeaks, and Intervals.icu

## Status and method

This comparison records the publicly described product capabilities observed on 2026-09-14. It compares the
current FitFreed 0.1.12 release with the current TrainingPeaks athlete product and Intervals.icu. It is not a
hands-on usability benchmark of all three products, and it does not treat a marketing claim as independently
verified behavior.

FitFreed statements come from its versioned requirements, product-status source, and public 0.1.12 guides.
TrainingPeaks and Intervals.icu statements use only their official product, help, API, pricing, and privacy pages.
Prices and hosted-service features can change after the observation date.

## Executive assessment

The three products have overlapping screens but different centers of gravity:

- **FitFreed** is currently a local, account-free, open-source desktop library for reclaiming, reconciling,
  exploring, and reporting on an exported personal history. Its primary promise is durable user control.
- **TrainingPeaks** is a mature commercial training, planning, analysis, and coaching platform. Its primary
  promise is helping an athlete execute a structured training process, often with a coach.
- **Intervals.icu** is a highly configurable hosted analysis and planning platform with broad device
  connectivity, advanced self-service analytics, and an unusually open integration surface.

FitFreed 0.1.12 is not a present substitute for either hosted platform when the user's main need is automated
daily synchronization, advanced training-load modelling, interactive map analysis, workout prescription, or
coach collaboration. Its credible distinction is not feature parity. It is the combination of local custody,
whole-export ingestion, deterministic reimport, explicit provenance and coverage, an inspectable GPL codebase,
offline use, and self-contained report output.

That distinction is meaningful but incomplete. FitFreed can currently export self-contained HTML reports, yet
0.1.12 has no supported normalized-library export or user-controlled backup and restore workflow. A product
founded on data freedom cannot treat that gap as incidental.

## Product model

| Dimension | FitFreed 0.1.12 | TrainingPeaks | Intervals.icu |
| --- | --- | --- | --- |
| Primary job | Recover and use a provider-exported personal history without depending on that provider or another hosted account. | Plan, perform, analyze, and coach structured endurance training. | Analyze, plan, and share multisport training through a configurable hosted service. |
| Delivery model | Installed desktop application; local SQLite library; offline exploration; no FitFreed account. | Hosted account with web and mobile experiences plus connected applications and devices. | Hosted account with web-oriented analysis, planning, coaching, and integrations. |
| Commercial model | GPL-3.0-or-later software with no subscription. | The athlete pricing page lists Premium at USD 19.95 monthly or USD 134.99 annually, with coaching and training plans priced separately. | Core use is free; Supporter pricing is USD 4 per month. |
| Current platform boundary | Apple Silicon macOS 15 or later and x86-64 Ubuntu Desktop 24.04/26.04 LTS. No public Windows binary. | The reviewed official material describes a web platform, mobile application, connected devices, and TrainingPeaks Virtual. | The reviewed official material describes a hosted platform designed across desktop, tablet, and mobile layouts. |
| Source transparency | Publicly inspectable implementation and documented provider, canonical, persistence, migration, and report contracts. | Commercial product and approved-partner API; no source-code license is offered by the reviewed product material. | Hosted product with an open API and user-authored JavaScript/Plotly extensions; an open API is not the same as an open-source service. |

Official pricing references: [TrainingPeaks athlete pricing](https://www.trainingpeaks.com/pricing/for-athletes/)
and [Intervals.icu pricing](https://www.intervals.icu/pricing/).

## Data acquisition and continuity

| Capability | FitFreed 0.1.12 | TrainingPeaks | Intervals.icu |
| --- | --- | --- | --- |
| Provider input | Imports a Polar Flow personal-data-export ZIP. The domain model and importer boundary are provider-neutral, but no other provider importer is currently available. | Connects to fitness devices and applications and also accepts manual workout-file uploads. | Advertises 250-plus integrations, including Polar and Garmin, and accepts FIT, TCX, and GPX uploads. |
| Ongoing synchronization | None. New data requires another provider export and import. | Connected services can send completed workouts; planned structured workouts can be synchronized to compatible devices and platforms. | Retrieves activities and wellness data from connected services and exposes integrations through its API. |
| Historical ingestion | Treats the provider takeout as a historical package, records import coverage, and reconciles exact or cumulative reimports without duplicating canonical history. | Imports workout files individually or through connected services. Official export tooling is organized into periods of at most 12 months. | Can retrieve complete history from some connected providers and upload common activity files. |
| Collision and provenance model | Documents source identities, mapping versions, reuse conditions, amendments, conflicts, ignored data, and unsupported data. | Parses uploaded files and can recalculate derived metrics against account thresholds; the reviewed material does not describe a takeout-level deterministic reconciliation contract. | Maps external identifiers through the API and combines connected-service and uploaded activity flows; the reviewed material does not describe a takeout-level deterministic reconciliation contract. |
| Offline continuity | Imported history remains usable without network access. | Ordinary use depends on the hosted account and service. | Ordinary use depends on the hosted account and service. |

Sources: [TrainingPeaks manual upload](https://help.trainingpeaks.com/hc/en-us/articles/204072994-How-do-I-manually-upload-a-workout-file-into-TrainingPeaks),
[TrainingPeaks structured workout sync and export](https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export),
[Intervals.icu integrations and product overview](https://www.intervals.icu/), and
[Intervals.icu Open API](https://www.intervals.icu/features/open-api/).

## Activity and session analysis

### FitFreed

The current release provides complete-history search, calendar discovery, sport recognition and personal
classification, session comparison, recorded exercise/lap/pause structure, route traces, supported signal charts,
recorded zones, exact samples, personal ranges, and provenance. It preserves exact-value and table alternatives
for visual evidence.

The material limitations are substantial:

- route exploration has no external basemap;
- route overlays and signal lanes appear only when an importer certifies their exact recorded relationship, and
  the current Polar Flow mapping supplies no such relationship;
- unsupported training-signal and provider-zone kinds remain unavailable; and
- current analysis does not offer the depth, maturity, or customization described by either hosted platform.

### TrainingPeaks

TrainingPeaks provides a mature workout-analysis workflow. Its current Analyze 360 documentation describes channel
ordering, overlays of up to five channels, point inspection, selected-range minimum/average/maximum values,
time-or-distance axes, source and custom laps, automatic interval and climb detection, and lap comparison. Maps,
zones, smoothing, charts, and selections are also part of its established analysis model. Some channels and
features require Premium.

Sources: [TrainingPeaks Analyze 360](https://help.trainingpeaks.com/hc/en-us/articles/36837856738957-Beta-Charts),
[How to analyze a file](https://help.trainingpeaks.com/hc/en-us/articles/208916857-How-to-Analyze-a-file-in-TrainingPeaks),
and [Laps and splits](https://help.trainingpeaks.com/hc/en-us/articles/204072044-Laps-and-Splits).

### Intervals.icu

Intervals.icu describes an especially broad analytical workbench: automatic interval detection; detailed interval
tables; route maps with historical weather; activity comparison; power, heart-rate, pace, and decoupling analysis;
heatmaps; spike correction; more than 50 metrics for intervals and selected chart portions; and user-authored
JavaScript charts rendered with Plotly. Its map can follow the selected chart position and highlight intervals.

Sources: [Intervals.icu activity analysis](https://www.intervals.icu/features/analyze/),
[Intervals.icu product overview](https://www.intervals.icu/), and
[Intervals.icu map interaction announcement](https://forum.intervals.icu/t/popup-activity-map-with-privacy-settings/14641).

## Longitudinal insight, planning, and coaching

| Capability | FitFreed 0.1.12 | TrainingPeaks | Intervals.icu |
| --- | --- | --- | --- |
| Period exploration | Provides question-led activity, training, sleep, recovery, and aligned-history answers with bounded comparisons and exact evidence. | Provides dashboards, weekly summaries, peak performances, charts, and Performance Management modelling for fitness, fatigue, and form. | Provides fitness, fatigue, form, ramp rate, totals, comparisons, power curves, wellness trends, and configurable charts. |
| Training planning | No workout planner or prescription workflow. Imported provider-recorded plans and structure can be inspected where supported. | Calendar, Annual Training Plan, Workout Library, structured Workout Builder, plan marketplace, and device delivery are central capabilities. | Calendar, workout builder, reusable plans, planned load, future fitness projection, and device/app delivery are established capabilities. |
| Coaching and collaboration | None. The library is deliberately account-free and local. | Athlete/coach communication, coach accounts, Coach Match, and a training-plan marketplace are central to the product. | Coach/athlete access, activity chat, teams, shared libraries, and coaching organizations are available. |
| Guidance model | Factual exploration with explicit non-causality, non-diagnostic, and non-advisory boundaries. | Training analysis and planning vocabulary is explicitly oriented around goals and coach-supported performance. | Advanced self-service analysis exposes models and extensive configuration; the user or coach determines how to apply them. |

Sources: [TrainingPeaks athlete guide](https://help.trainingpeaks.com/hc/en-us/articles/231472468-TrainingPeaks-Athlete-User-Guide),
[TrainingPeaks athlete pricing](https://www.trainingpeaks.com/pricing/for-athletes/),
[Intervals.icu product overview](https://www.intervals.icu/), and
[Intervals.icu pricing](https://www.intervals.icu/pricing/).

## Reports, customization, and data exit

### FitFreed

FitFreed saves reproducible report definitions and opens reports result-first. Four curated examples can be
duplicated and adapted. A report can include applicable facts, comparisons, charts, exact tables, commentary,
coverage, and optionally protected route shapes. Export produces a privacy-reviewed, self-contained HTML document.

This is a recognizable document-oriented reporting workflow, but its output surface is narrow. Version 0.1.12 has
no native PDF or spreadsheet export, free-form layout, exact-sample or lap report blocks, normalized-library export,
or supported user-controlled backup and restore.

### TrainingPeaks

The reviewed TrainingPeaks material emphasizes dashboards, chart layouts, workout analysis, and training plans
rather than durable user-authored report documents. It provides concrete exit routes: original workout files,
workout-summary CSV, and custom-metric CSV can be exported in periods of at most 12 months. A single workout is
downloaded in its uploaded format. Structured planned workouts can be exported to formats including FIT, ERG, MRC,
and ZWO where applicable.

Its API is not a general personal API: TrainingPeaks states that it is available to approved developers and is not
for personal use.

Sources: [TrainingPeaks data export](https://help.trainingpeaks.com/hc/en-us/articles/204985370-Data-Export),
[TrainingPeaks structured workout export](https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export),
and [TrainingPeaks API](https://help.trainingpeaks.com/hc/en-us/articles/234441128-TrainingPeaks-API).

### Intervals.icu

Intervals.icu offers extensive interface and chart customization, per-sport activity layouts, custom fields,
computed streams, JavaScript/Plotly charts, CSV output from interval tables and custom charts, and activity-file
download through its API. Every user can create a personal API key, while third-party applications can use OAuth 2
with granular scopes and webhooks.

This is a stronger programmable and analytical extension surface than either competitor currently exposes to an
ordinary FitFreed user. It remains a hosted-account integration surface, not a locally owned application runtime or
a documented export of the complete service state.

Sources: [Intervals.icu Open API](https://www.intervals.icu/features/open-api/),
[Intervals.icu activity analysis](https://www.intervals.icu/features/analyze/), and
[Intervals.icu API access guide](https://forum.intervals.icu/t/api-access-to-intervals-icu/609).

## Privacy and user control

FitFreed's strongest structural difference is that imported facts and preferences remain in a local application
directory and ordinary exploration has no account, analytics, or synchronization service. Its implementation and
data contracts can be inspected, forked, and maintained independently. Update checks contact a fixed public
endpoint without sending imported facts or a usage identity.

TrainingPeaks and Intervals.icu both provide legitimate privacy and exit controls, but their ordinary product model
requires data processing by a hosted service. TrainingPeaks documents GDPR access and erasure requests, account
deletion, and periodic file/CSV export. Its privacy policy describes processing and disclosure to service providers
and selected API partners. Intervals.icu states that activity and wellness data are private by default, documents
account deletion and GDPR rights, and identifies cloud processing in Germany and Finland.

Local custody is not automatically complete control. FitFreed's lack of normalized-library export and supported
backup/restore means that 0.1.12 still depends on the application and its internal persistence contract for full
library continuity. Keeping the original provider archive remains mandatory.

Sources: [TrainingPeaks data export](https://help.trainingpeaks.com/hc/en-us/articles/204985370-Data-Export),
[TrainingPeaks GDPR requests](https://help.trainingpeaks.com/hc/en-us/articles/360004230212-General-Data-Protection-Regulation-GDPR-Request),
[TrainingPeaks privacy policy](https://www.trainingpeaks.com/static-files/trainingpeaks-privacy-policy/index.html),
and [Intervals.icu privacy policy](https://www.intervals.icu/privacy-policy/).

## Genuine differentiation and exposed gaps

### Where FitFreed is strongest

1. **Account-free local custody.** Imported history is usable without surrendering it to another mandatory
   service.
2. **Whole-export interpretation.** FitFreed treats a provider takeout as an auditable historical package rather
   than only a stream of activity files.
3. **Deterministic reimport.** Exact and cumulative imports have explicit identity, revision, conflict, and reuse
   rules.
4. **Provenance and coverage.** Supported, ignored, unrecognized, invalid, and unavailable information remains
   distinguishable instead of being silently flattened.
5. **Open implementation and contracts.** The application and its interpretations can survive the original
   maintainer or provider.
6. **Portable report artifact.** A self-contained HTML result can leave the application and be inspected without a
   FitFreed account or service.

### Where TrainingPeaks is strongest

1. Integrated planning, execution, analysis, and coaching.
2. A mature calendar, workout builder, plan marketplace, and device-delivery ecosystem.
3. Guided workout assessment, planned-versus-completed context, and polished lap/channel analysis.
4. Established athlete/coach workflows and commercial support.

### Where Intervals.icu is strongest

1. Analytical breadth and configurability for technically engaged athletes.
2. Interactive interval, chart, map, weather, power, and longitudinal analysis.
3. Broad provider connectivity and ongoing ingestion.
4. A personal API, OAuth, webhooks, custom fields, computed streams, and user-created Plotly charts.
5. A generous free tier and low-cost supporter model.

### Gaps that most weaken FitFreed's proposition

1. **The exit path is incomplete.** Report HTML is useful, but it is not a normalized export or restorable library
   backup.
2. **Daily continuity is manual.** Requiring repeated provider takeouts makes FitFreed less useful as an everyday
   training companion.
3. **Session analysis trails both references.** External maps, synchronized map/chart selection, flexible overlays,
   interval discovery, and mature chart interaction define the expected standard for outdoor and structured
   training analysis.
4. **Longitudinal training interpretation is shallow.** Current question-led comparisons do not equal the mature
   fitness, fatigue, form, load, power-curve, peak, or season analysis of the hosted products.
5. **Planning and collaboration are absent.** This is acceptable only while FitFreed clearly presents itself as a
   personal-history product rather than implying full training-platform parity.
6. **Platform coverage is incomplete.** The accepted desktop baseline has not yet reached Windows users.

## Product conclusions

FitFreed should not imitate the total scope of either mature platform. TrainingPeaks demonstrates the value of a
guided path from plan to completed workout to explanation. Intervals.icu demonstrates how much control an advanced
athlete can use when maps, intervals, signals, longitudinal models, export, and APIs are coherent rather than
separate feature islands.

The relevant quality bar is therefore two-sided:

- the ordinary user should receive an immediate, restrained, evidence-backed answer without learning a data model;
  and
- the engaged user should be able to move naturally from that answer into exact sessions, route ranges, aligned
  signals, intervals, calculations, provenance, reusable reports, and genuine data exit.

FitFreed's local-first and open-source model can make that progression more trustworthy than a hosted black box,
but it does not make a weaker analytical experience acceptable. Ownership is valuable only when the owned history
is both understandable and practically usable.

## FitFreed evidence boundary

The FitFreed claims in this comparison are bounded by the current [product status](../product-status.json),
[requirements](../requirements.md), [product thesis](../product-thesis.md),
[macOS 0.1.12 guide](../user/public-macos-0.1.12.md), and
[Linux 0.1.12 guide](../user/public-linux-0.1.12.md). Capabilities listed there as later work are not counted as
available merely because an architectural boundary or intended behavior has been documented.
