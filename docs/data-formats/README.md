# FitFreed Data Format Documentation

## Purpose

This directory is the canonical index for every machine-readable data contract that FitFreed consumes, owns, or publishes. Complete format documentation is a product capability: users and independent implementations must be able to understand and recover data without reverse-engineering FitFreed itself.

## Contract classes

| Class | Authority | Documentation style | Compatibility responsibility |
|---|---|---|---|
| Provider export | The provider where an adequate public specification exists; otherwise clean-room observation | Descriptive, with every statement labeled by evidence level | Each importer declares exactly what it recognizes, maps, ignores, or rejects |
| FitFreed canonical model | FitFreed | Normative and provider-neutral | Domain versions evolve through explicit compatibility rules |
| Source-to-canonical mapping | FitFreed | Normative for importer behavior | Every supported source field has a documented outcome |
| Source acquisition guidance | FitFreed importer adapter | Normative, versioned, offline-capable, and provider-specific | Every guide identifies its verification date, expected archive, content keys, provider constraints, troubleshooting, and exact official destinations |
| FitFreed insight read model | FitFreed | Normative, provider-neutral, and question-specific | Report calculations, gaps, ordering, and transport versions evolve explicitly |
| FitFreed portable export | FitFreed | Normative, open, and independently implementable | Versions, deprecations, and migration paths preserve user exit |
| Persistence schema | FitFreed implementation | Exact but explicitly non-portable | Every schema version and migration is documented and tested |
| Release evidence | FitFreed | Normative, machine-verifiable, and free of user data | Every staged package identifies its source, compatibility, inventories, and integrity |
| Update channel | FitFreed above the native updater | Normative, cryptographically authenticated, replay-aware, and free of user data | Every candidate binds policy and localized information to exact signed package expectations |
| Update recovery | FitFreed around the native updater | Normative, local, restart-safe, and application/library-pair aware | Every replacement remains recoverable until the expected application and library confirm startup |

The canonical model, portable export, and persistence schema are related but not interchangeable. Domain meaning belongs to the canonical specification. The portable format is the stable user-facing interchange contract. A persistence schema may change for implementation reasons and must never be the only recovery path.

## Evidence levels for external formats

- **Official:** stated by a public provider specification that covers the export artifact in question.
- **Observed:** found through clean-room structural analysis of a lawfully obtained export, without publishing personal values or private data-set fingerprints.
- **Interpretation:** FitFreed's documented semantic reading or mapping of an observed structure.
- **Unknown:** not established by adequate evidence and therefore not presented as a guarantee.

An API specification, an individual-session export guide, or a high-level takeout help page is not automatically evidence for the structure of a personal-data export archive.

## Completeness standard

A FitFreed-owned representation is completely documented only when all applicable items below are both specified and covered by automated contract evidence:

- media type, encoding, container layout, schema identifier, and version;
- entities, value objects, fields, types, units, optionality, cardinality, and enumerations;
- identity, ordering, relationships, invariants, provenance, and duplicate behavior;
- date, time, duration, time-zone, precision, and missing-value semantics;
- unknown-field behavior, validation failures, compatibility, deprecation, and migration rules;
- known information loss and source-to-canonical transformations;
- independently constructed synthetic valid and invalid examples;
- machine-readable schemas wherever the representation supports them.

Documentation, schemas, fixtures, implementation, and migrations form one change. Continuous integration will reject a contract change when these artifacts disagree.

## Publication structure

- [`providers/`](providers/) contains descriptive references for source exports.
- `canonical/` will contain normative domain specifications as concepts enter implementation.
- `mappings/` will contain normative source-to-canonical mapping tables for supported importers.
- `guidance/` contains normative application-to-presentation contracts for importer-owned acquisition guidance.
- `insights/` contains normative query and report read models derived from canonical facts.
- `portable/` contains normative FitFreed capability-export and report-artifact specifications. A complete normalized
  library export is not implied until every supported domain has an indexed contract and one composed delivery path.
- `persistence/` will contain implementation schema and migration references once a storage architecture is selected.
- `release/` contains machine-readable release evidence contracts; it never contains generated packages or user data.

Directories are created with their first real contract; empty specifications are not used as placeholders.

## Current references

- [Polar Flow personal data export](providers/polar-flow.md)
- [Provider sport catalogue evidence version 1](providers/provider-sport-catalogue-v1.md)
- [Canonical daily activity](canonical/daily-activity.md)
- [Canonical training session summary](canonical/training-session.md)
- [Canonical training-session structure](canonical/training-session-structure.md)
- [Canonical training-session route](canonical/training-session-route.md)
- [Canonical training-session signal](canonical/training-session-signal.md)
- [Canonical training-session zone](canonical/training-session-zone.md)
- [Canonical planned training](canonical/planned-training.md)
- [Canonical segment criterion](canonical/segment-criterion.md)
- [Canonical training-session range version 3](canonical/training-session-range-v3.md)
- [Canonical training-session range version 2](canonical/training-session-range-v2.md) — preceding contract
- [Canonical training-session range version 1](canonical/training-session-range.md) — initial contract
- [Canonical report definition version 1](canonical/report-definition.md)
- [Canonical report definition version 2](canonical/report-definition-v2.md)
- [Canonical report definition version 3](canonical/report-definition-v3.md)
- [Canonical report definition version 5](canonical/report-definition-v5.md)
- [Canonical report definition version 4](canonical/report-definition-v4.md) — preceding contract
- [Canonical sport classification](canonical/sport-classification.md)
- [Canonical sleep period](canonical/sleep-period.md)
- [Canonical nightly recovery](canonical/nightly-recovery.md)
- [Polar Flow daily activity mapping](mappings/polar-flow-daily-activity.md)
- [Polar Flow training session mapping](mappings/polar-flow-training-session.md)
- [Polar Flow training-target sport-evidence mapping](mappings/polar-flow-training-target-sport.md)
- [Polar Flow planned-training mapping](mappings/polar-flow-planned-training.md)
- [Portable planned-training export version 1](portable/planned-training-v1.md)
- [Polar Flow sleep mapping](mappings/polar-flow-sleep.md)
- [Polar Flow nightly recovery mapping](mappings/polar-flow-nightly-recovery.md)
- [Source acquisition guide version 1](guidance/source-acquisition-guide-v1.md)
- [Official source link opening version 1](guidance/official-source-link-opening-v1.md)
- [Import control transport version 1](guidance/import-control-v1.md)
- [Daily activity overview read model version 1](insights/daily-activity-overview-v1.md)
- [Daily activity overview read model version 2](insights/daily-activity-overview-v2.md)
- [Daily activity comparison read model version 1](insights/daily-activity-comparison-v1.md)
- [Training overview read model version 1](insights/training-overview-v1.md)
- [Training comparison read model version 1](insights/training-comparison-v1.md)
- [Planned-training read models version 1](insights/planned-training-v1.md)
- [Training sport identity version 2](insights/training-sport-identity-v2.md)
- [Training sport identity version 1](insights/training-sport-identity-v1.md) — preceding contract
- [Training sports read model version 3](insights/training-sports-v3.md)
- [Training sports read model version 2](insights/training-sports-v2.md) — preceding contract
- [Training sports read model version 1](insights/training-sports-v1.md) — preceding contract
- [Training-session search read model version 3](insights/training-session-search-v3.md)
- [Training-session search read model version 2](insights/training-session-search-v2.md) — preceding contract
- [Training-session search read model version 1](insights/training-session-search-v1.md) — preceding contract
- [Training-session structure read model version 2](insights/training-session-structure-v2.md)
- [Training-session structure read model version 1](insights/training-session-structure-v1.md) — preceding contract
- [Training-session route read models version 1](insights/training-session-route-v1.md)
- [Training-session signal read models version 1](insights/training-session-signal-v1.md)
- [Training-session zone read model version 1](insights/training-session-zone-v1.md)
- [Training-session provenance read model version 1](insights/training-session-provenance-v1.md)
- [Composed session story version 5](insights/session-story-v5.md)
- [Composed session story version 4](insights/session-story-v4.md) — preceding response contract
- [Composed session story version 3](insights/session-story-v3.md) — preceding response contract
- [Composed session story version 2](insights/session-story-v2.md) — preceding response contract
- [Composed session story version 1](insights/session-story-v1.md) — initial response contract
- [Training-session segmentation read model version 1](insights/training-session-segmentation-v1.md)
- [Training-session range read model version 3](insights/training-session-range-v3.md)
- [Training-session range read model version 2](insights/training-session-range-v2.md) — preceding contract
- [Training-session range read model version 1](insights/training-session-range-v1.md) — initial contract
- [Training-session range summary read model version 2](insights/training-session-range-summary-v2.md)
- [Training-session range summary read model version 1](insights/training-session-range-summary-v1.md) — preceding contract
- [Session report read models version 5](insights/session-report-v5.md)
- [Session report read models version 4](insights/session-report-v4.md) — preceding contract
- [Session report read models version 3](insights/session-report-v3.md) — preceding contract
- [Session report read models version 2](insights/session-report-v2.md) — preceding contract
- [Session report read models version 1](insights/session-report-v1.md) — initial contract
- [Report workflow version 8](insights/report-v8.md)
- [Report workflow version 7](insights/report-v7.md) — preceding contract
- [Report workflow version 6](insights/report-v6.md) — preceding contract
- [Report workflow version 5](insights/report-v5.md) — preceding contract
- [Report workflow version 4](insights/report-v4.md) — preceding contract
- [Training-discovery workspace version 2](insights/training-discovery-workspace-v2.md)
- [Training-discovery workspace version 1](insights/training-discovery-workspace-v1.md) — preceding contract
- [Sleep overview and detail read model version 1](insights/sleep-overview-v1.md)
- [Sleep comparison read model version 1](insights/sleep-comparison-v1.md)
- [Nightly recovery overview and detail read model version 1](insights/nightly-recovery-overview-v1.md)
- [Nightly recovery comparison read model version 1](insights/nightly-recovery-comparison-v1.md)
- [Longitudinal overview and comparison read model version 1](insights/longitudinal-overview-v1.md)
- [Library Home read model version 6](insights/library-home-v6.md)
- [Library Home read model version 5](insights/library-home-v5.md) — preceding contract
- [Library Home read model version 4](insights/library-home-v4.md) — preceding contract
- [Library Home read model version 3](insights/library-home-v3.md) — preceding contract
- [Library Home read model version 2](insights/library-home-v2.md) — preceding contract
- [Library Home read model version 1](insights/library-home-v1.md) — initial contract
- [Portable report definition version 5](portable/report-definition-v5.md)
- [Portable report definition version 4](portable/report-definition-v4.md) — preceding contract
- [Portable report definition version 3](portable/report-definition-v3.md) — preceding contract
- [Portable report definition version 2](portable/report-definition-v2.md) — preceding contract
- [Portable report definition version 1](portable/report-definition-v1.md) — initial contract
- [Self-contained report HTML version 7](portable/report-html-v7.md)
- [Self-contained report HTML version 6](portable/report-html-v6.md) — preceding contract
- [Self-contained report HTML version 5](portable/report-html-v5.md) — preceding contract
- [Self-contained report HTML version 4](portable/report-html-v4.md) — preceding contract
- [Self-contained report HTML version 3](portable/report-html-v3.md) — preceding contract
- [Self-contained report HTML version 2](portable/report-html-v2.md) — preceding contract
- [Self-contained report HTML version 1](portable/report-html-v1.md) — initial contract
- [SQLite schema version 1](persistence/sqlite-v1.md)
- [SQLite schema version 2](persistence/sqlite-v2.md)
- [SQLite schema version 3](persistence/sqlite-v3.md)
- [SQLite schema version 4](persistence/sqlite-v4.md)
- [SQLite schema version 5](persistence/sqlite-v5.md)
- [SQLite schema version 6](persistence/sqlite-v6.md)
- [SQLite schema version 7](persistence/sqlite-v7.md)
- [SQLite schema version 8](persistence/sqlite-v8.md)
- [SQLite schema version 9](persistence/sqlite-v9.md)
- [SQLite schema version 10](persistence/sqlite-v10.md)
- [SQLite schema version 11](persistence/sqlite-v11.md)
- [SQLite schema version 12](persistence/sqlite-v12.md)
- [SQLite schema version 13](persistence/sqlite-v13.md)
- [SQLite schema version 14](persistence/sqlite-v14.md)
- [SQLite schema version 15](persistence/sqlite-v15.md)
- [SQLite schema version 16](persistence/sqlite-v16.md)
- [SQLite schema version 17](persistence/sqlite-v17.md)
- [SQLite schema version 18](persistence/sqlite-v18.md)
- [SQLite schema version 19](persistence/sqlite-v19.md)
- [SQLite schema version 20](persistence/sqlite-v20.md)
- [SQLite schema version 21](persistence/sqlite-v21.md)
- [SQLite schema version 22](persistence/sqlite-v22.md)
- [SQLite schema version 23](persistence/sqlite-v23.md)
- [SQLite schema version 24](persistence/sqlite-v24.md)
- [SQLite schema version 25](persistence/sqlite-v25.md)
- [SQLite schema version 26](persistence/sqlite-v26.md)
- [SQLite schema version 27](persistence/sqlite-v27.md)
- [SQLite schema version 32](persistence/sqlite-v32.md)
- [SQLite schema version 31](persistence/sqlite-v31.md) — preceding schema
- [SQLite schema version 30](persistence/sqlite-v30.md) — preceding schema
- [SQLite schema version 29](persistence/sqlite-v29.md) — preceding schema
- [SQLite schema version 28](persistence/sqlite-v28.md) — preceding schema
- [Release manifest version 1](release/release-manifest-v1.md)
- [Release manifest version 2](release/release-manifest-v2.md)
- [Public release manifest version 3](release/release-manifest-v3.md)
- [Upgrade matrix version 1](release/upgrade-matrix-v1.md)
- [Update channel version 1](release/update-channel-v1.md)
- [Public stable update channel version 2](release/update-channel-v2.md)
- [Public update build configuration version 1](release/public-update-configuration-v1.md)
- [Public release policy version 1](release/public-release-policy-v1.md)
- [Public origin version 1](release/public-origin-v1.md)
- [Update recovery version 1](release/update-recovery-v1.md)
- [Update recovery outcome version 1](../../schemas/update-recovery-outcome-v1.schema.json)
