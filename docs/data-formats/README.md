# FitFreed Data Format Documentation

## Purpose

This directory is the canonical index for every machine-readable data contract that FitFreed consumes, owns, or publishes. Complete format documentation is a product capability: users and independent implementations must be able to understand and recover data without reverse-engineering FitFreed itself.

## Contract classes

| Class | Authority | Documentation style | Compatibility responsibility |
|---|---|---|---|
| Provider export | The provider where an adequate public specification exists; otherwise clean-room observation | Descriptive, with every statement labeled by evidence level | Each importer declares exactly what it recognizes, maps, ignores, or rejects |
| FitFreed canonical model | FitFreed | Normative and provider-neutral | Domain versions evolve through explicit compatibility rules |
| Source-to-canonical mapping | FitFreed | Normative for importer behavior | Every supported source field has a documented outcome |
| FitFreed portable export | FitFreed | Normative, open, and independently implementable | Versions, deprecations, and migration paths preserve user exit |
| Persistence schema | FitFreed implementation | Exact but explicitly non-portable | Every schema version and migration is documented and tested |

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
- `portable/` will contain the normative FitFreed export specification before portable export is implemented.
- `persistence/` will contain implementation schema and migration references once a storage architecture is selected.

Directories are created with their first real contract; empty specifications are not used as placeholders.

## Current references

- [Polar Flow personal data export](providers/polar-flow.md)
- [Canonical daily activity](canonical/daily-activity.md)
- [Polar Flow daily activity mapping](mappings/polar-flow-daily-activity.md)
- [SQLite schema version 1](persistence/sqlite-v1.md)
- [SQLite schema version 2](persistence/sqlite-v2.md)
- [SQLite schema version 3](persistence/sqlite-v3.md)
