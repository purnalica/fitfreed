# ADR 0012: Publish two-dimensional upgrade support

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md)

## Context

FitFreed must verify every supported application update and SQLite migration before a release. Those are related but different promises. An application version identifies a distributed executable and its release-shaped package. A library schema version identifies a persistent-data layout and can exist in development libraries before any supported application release exists.

FitFreed 0.1.0 is the first intended private alpha. No earlier FitFreed release, tag, or GitHub release exists. SQLite schemas 1 through 9 do exist and have migration coverage. Treating those schemas as application releases would invent an upgrade history; treating the synthetic 0.1.0 and 0.2.0 packages built from one source revision as published releases would make the same mistake.

## Decision drivers

- Release notes and update metadata must state exactly which installed application versions are supported.
- A user retaining an older library must be able to determine whether the current application can open and migrate its schema.
- Every declared baseline must have executable evidence at the appropriate boundary.
- First-release evidence must not manufacture a predecessor merely to make a matrix non-empty.
- Future release preparation must fail when compatibility declarations, source versions, schemas, and evidence drift.

## Considered alternatives

### Use only the update channel's minimum application version

A single lower bound is compact, but it assumes every intervening version and library combination works. It cannot express a withdrawn intermediate baseline or distinguish application-package evidence from direct library migration evidence.

### Use one flat list containing application and schema versions

A flat list hides which identifier names an executable and which names a storage layout. It encourages claims that a schema proves a release upgrade and cannot attach platform-specific package evidence to an application baseline.

### Publish unrelated application and library documents

Separate documents preserve the distinction but can drift on target version and target schema. Release preparation would need another authority to prove that both documents describe the same candidate.

### Publish one release-bound document with two explicit dimensions

One closed contract can bind the target application and schema while retaining separate application and library baseline collections. Each collection can carry its own semantics and evidence requirements.

## Decision

Every FitFreed release candidate will carry one versioned upgrade-matrix document with two independent support dimensions.

- `supportedApplicationBaselines` lists only actual prior FitFreed releases accepted for in-application upgrade to the target release. Each entry binds a source semantic version, exact package targets, and the source library schemas supported for that application version.
- `supportedLibrarySchemaVersions` lists library schemas that the target application can open directly. Older listed schemas must migrate atomically to the target schema; the target schema is the no-op compatibility case.
- The matrix binds one exact target application version and target library schema. Repository and release checks reject disagreement with npm, Tauri, Cargo, compiled storage code, or the immutable migration sequence.
- Application baselines are not inferred from schema versions, Git commits, development builds, or SemVer ranges. Adding one requires a preserved release-shaped source package and passing clean update, migration, failed-update recovery, retained-library, and restart evidence for every declared package target and source schema combination.
- Synthetic packages built from the target source with overridden versions may test updater mechanics, but they never satisfy an application-baseline declaration.
- Schema 0 represents creation of a new library, not a retained supported library, and is excluded. A future schema is rejected. Supported historical schemas are explicit and ordered rather than inferred from the existence of a migration file.
- The first 0.1.0 matrix has no supported application baseline because no prior release exists. It declares library schemas 1 through 9, with schema 9 as the current no-op case.
- The exact matrix is included as a digest-bound release artifact. A new incompatible document shape requires a new matrix schema version; historical schemas and their normative documentation remain available.

## Consequences

### Positive

- Compatibility statements remain truthful for a first release and precise for later releases.
- Users and maintainers can distinguish package upgrade support from direct library recovery or migration.
- Release automation has one candidate-bound source of truth without collapsing two kinds of evidence.
- Removing an old baseline becomes an explicit support-policy change rather than an accidental migration-code change.

### Negative

- Each release version change must update the matrix and regenerate release evidence.
- Future releases must retain or retrieve previous release-shaped packages to verify declared application baselines.
- A schema can remain technically readable while no application release carrying it is an officially supported update source.

### Risks and mitigations

- A developer could mistake the empty first-release application list for missing work. Normative documentation states that emptiness is required until a real predecessor exists.
- A migration unit test could pass while a packaged application path fails. Library migration evidence and application update evidence remain separate mandatory gates.
- A synthetic updater journey could be reported as release compatibility. The contract validator and testing documentation classify it only as updater-mechanics evidence.

## Verification

Contract tests must reject malformed, unordered, duplicate, future, or identity-mismatched matrices. A table-driven storage integration test must migrate every declared historical library schema, verify the exact target marker and SQLite integrity, and prove rollback before retry. Release staging and integrity verification must bind the exact matrix bytes. Once an application baseline exists, packaged update E2E must derive its source version, target, and library-schema cases from the matrix and fail if any declared combination lacks evidence.
