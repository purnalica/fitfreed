# Import Control Transport Version 1

## Status and scope

This is the normative desktop transport contract for import progress and terminal outcomes. It is provider-neutral;
provider-specific package recognition and mapping remain in the source adapter. The machine-readable contracts are
[`import-progress-v1.schema.json`](../../../schemas/import-progress-v1.schema.json) and
[`import-outcome-v1.schema.json`](../../../schemas/import-outcome-v1.schema.json).

The transport contains no archive path, member name, account evidence, source hash, route, or measurement. Those values
remain inside the protected local library or transient source adapter.

## Progress

Every progress message has `phase`, `completedArtifacts`, `totalArtifacts`, `completedBytes`, `totalBytes`, and
`cancellable`.

| `phase` | Bounded unit | Cancellation |
|---|---|---|
| `fingerprinting` | `completedBytes` of `totalBytes` | accepted |
| `validating` | ZIP members checked against structural and resource protections | accepted |
| `importing` | supported source artifacts decoded and mapped | accepted |
| `reconciling` | canonical library items evaluated inside the rollback-safe transaction | accepted |
| `committing` | no count or percentage; the atomic visibility boundary is resolving | deferred |
| `completed` | recognized artifact total for the terminal operation | not accepted |
| `cancelled` | no bounded total | not accepted |

Within one phase and one total, completed work is monotonic and never exceeds the total. A new phase may use another
bounded unit and therefore starts its own count. `committing` must not inherit a finished artifact count: it is a
factual indeterminate boundary, not a disguised reconciliation phase. Presentation may explain that an unchanged
progress message is taking longer than usual, but the watchdog cannot terminate the operation, invent a duration, or
claim that it is stalled.

## Package classification

Package inventory is inspected before a user-facing compatibility category is assigned. No member content is decoded
before central-directory, path, link, encryption, duplicate-name, expanded-size, compression-ratio, member-count, and
nesting protections pass. Provider identity does not weaken those protections.

The current terminal categories are:

| `terminalCode` | Meaning | Primary recovery |
|---|---|---|
| `not-supported-export` | a valid ZIP has no recognized provider-export evidence | choose the original supported provider export |
| `malformed-supported-export` | the current provider format was recognized but required supported content is invalid | retain the original ZIP and report compatibility |
| `unsupported-provider-version` | provider-shaped evidence exists, but the archive version or ordinary layout is outside the current adapter | retain the original ZIP and report compatibility |
| `suspicious-archive-layout` | a path, link, encryption, or duplicate-name pattern is unsafe to process | obtain a fresh original export |
| `archive-safety-limit` | a count, expanded-size, member-size, or compression-ratio limit was exceeded | retain the ZIP and report bounded size information |

Historical libraries may contain the preceding `invalid-supported-artifact`, `invalid-source-subject-evidence`,
`unsafe-archive-member`, `duplicate-archive-member`, or `archive-resource-limit` codes. They remain readable and
localized but are not emitted by the current adapter. Source-subject conflict, local I/O, database, coordination,
recovery, and internal-failure codes remain separate because they do not describe package compatibility.

An ordinary directory entry or nested ordinary archive with no recognized provider evidence is
`not-supported-export`, not a security or provider-compatibility incident. Traversal, absolute paths, symbolic links,
encryption, duplicate names, and resource-limit violations remain rejected without extraction.

## Terminal outcome

Every terminal outcome has `operationRef`, `state`, `sourceProvider`, `sourceAdapterVersion`, `mappingVersion`,
`exactRepeat`, `coverageComplete`, `coverage`, `artifactFamilies`, `report`, `canonicalHistoryChanged`, `terminalCode`,
and `recoveryNote`.

`state` is `completed`, `rejected`, `cancelled`, or `failed`. `coverage` contains `total`, `supported`, `unsupported`,
`deliberatelyIgnored`, `unrecognized`, and `invalid`. Each `artifactFamilies` item contains only `familyCode`,
`classification`, `reasonCode`, and `artifactCount`. `report` contains `exactRepeat`, `recognizedArtifacts`,
`newObservations`, `equivalentObservations`, `enrichedObservations`, `amendedObservations`, `preservedObservations`, and
`conflicts`.

For `rejected` and `failed`, the localized meaning of `terminalCode` and its safest next action are primary result
content. Coverage is supporting detail and cannot contain the only explanation. `canonicalHistoryChanged` is false for
every non-completed outcome. A completed outcome and its canonical effect cross the same SQLite transaction boundary.

## Compatibility

Unknown fields are rejected. New phases, fields, states, or classification semantics require a new transport schema.
New terminal codes that refine the existing terminal-code string namespace require documentation, localization, valid
and invalid synthetic contract evidence, and persistence compatibility evidence in the same change.
