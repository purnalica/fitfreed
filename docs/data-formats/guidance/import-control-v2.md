# Import Control Transport Version 2

## Status and scope

This is the normative desktop transport contract for import progress and terminal outcomes. It replaces version 1
without changing the progress contract. Version 2 adds an independent, persisted package-identity classification so
that a terminal result can state both what kind of package FitFreed observed and why processing stopped.

The contract is provider-neutral. Provider-specific filename recognition and mapping remain in the selected source
adapter. The machine-readable contracts are
[`import-progress-v1.schema.json`](../../../schemas/import-progress-v1.schema.json) and
[`import-outcome-v2.schema.json`](../../../schemas/import-outcome-v2.schema.json).

The transport contains no archive path, member name, account evidence, source hash, route, or measurement. Those
values remain inside the protected local library or transient source adapter.

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

The desktop transport coalesces producer updates before they cross into the WebView. It always emits the first update,
phase and cancellation-boundary changes, exact bounded completion, and terminal updates. Within a phase it emits at
least every 250 completed artifacts, every 8 MiB of fingerprinted input, or every 100 milliseconds of continuing work,
whichever boundary is reached first. Regressive same-phase updates are rejected.

## Package identity and protection outcome

The source adapter classifies the central-directory member-name inventory before the complete archive-protection scan.
That classification is persisted independently as nullable `packageIdentity`:

| `packageIdentity` | Meaning |
|---|---|
| `expected-provider-export` | the inventory matches the current selected provider export grammar |
| `unsupported-provider-export` | provider-shaped evidence exists, but its ordinary version or layout is outside the current adapter |
| `unrecognized` | the inventory contains no recognized evidence for the selected provider |
| null | a historical outcome, or a failure before package identity could be established |

Package identity is evidence about the names in the inventory. It does not authorize extraction, establish content
validity, weaken a resource limit, or replace `terminalCode`. No member content is decoded before central-directory,
path, link, encryption, duplicate-name, expanded-size, compression-ratio, member-count, and nesting protections pass.

The current terminal categories are:

| `terminalCode` | Meaning | Primary recovery |
|---|---|---|
| `not-supported-export` | a valid ZIP has no recognized provider-export evidence | choose the original supported provider export |
| `malformed-supported-export` | the current provider format was recognized but required supported content is invalid | retain the original ZIP and report compatibility |
| `unsupported-provider-version` | provider-shaped evidence exists, but the archive version or ordinary layout is outside the current adapter | retain the original ZIP and report compatibility |
| `suspicious-archive-layout` | a path, link, encryption, or duplicate-name pattern cannot be processed safely | obtain a fresh original export |
| `archive-entry-count-limit` | the ZIP contains more than 10,000 members | confirm that this is the original provider export; retain it and report the file count |
| `archive-expanded-member-size-limit` | one member declares more than 64 MB of expanded content | retain the original ZIP and report the per-file limit |
| `archive-total-expanded-size-limit` | declared expanded content exceeds 8 GB in total | confirm that this is the original provider export; retain it and report the approximate expanded size |
| `archive-compression-ratio-limit` | one member expands beyond a 1,000:1 ratio or declares expanded content without compressed content | obtain a fresh original export or report the ratio limit |
| `archive-bounded-read-limit` | a member supplies more content than declared and crosses the 64 MB read boundary | obtain a fresh original export |

Historical libraries may contain the preceding `invalid-supported-artifact`, `invalid-source-subject-evidence`,
`unsafe-archive-member`, `duplicate-archive-member`, `archive-resource-limit`, or `archive-safety-limit` codes. They
remain readable and localized but are not emitted by the current adapter. Source-subject conflict, local I/O,
database, coordination, recovery, and internal-failure codes remain separate because they do not describe package
compatibility.

An ordinary directory entry or nested ordinary archive with no recognized provider evidence is
`not-supported-export`, not a security or provider-compatibility incident. Traversal, absolute paths, symbolic links,
encryption, duplicate names, and resource-limit violations remain rejected without extraction. Resource-limit errors
retain only the typed category and bounded numeric facts in process memory. Persisted terminal outcomes expose the
stable category and package identity, never an archive member name or path.

For a protection or resource-limit rejection, presentation renders package identity and the exact terminal cause as
separate factual statements. An `unrecognized` identity does not itself call the archive unsafe, while the protection
that stopped processing remains explicit and unchanged.

## Terminal outcome

Every terminal outcome has `operationRef`, `state`, `sourceProvider`, `sourceAdapterVersion`, `mappingVersion`,
`packageIdentity`, `exactRepeat`, `coverageComplete`, `coverage`, `artifactFamilies`, `report`,
`canonicalHistoryChanged`, `terminalCode`, and `recoveryNote`.

`state` is `completed`, `rejected`, `cancelled`, or `failed`. `coverage` contains `total`, `supported`, `unsupported`,
`deliberatelyIgnored`, `unrecognized`, and `invalid`. Each `artifactFamilies` item contains only `familyCode`,
`classification`, `reasonCode`, and `artifactCount`. `report` contains `exactRepeat`, `recognizedArtifacts`,
`newObservations`, `equivalentObservations`, `enrichedObservations`, `amendedObservations`, `preservedObservations`, and
`conflicts`.

For `rejected` and `failed`, the localized meaning of `terminalCode` and its safest next action are primary result
content. Coverage is supporting detail and cannot contain the only explanation. `canonicalHistoryChanged` is false for
every non-completed outcome. A completed outcome and its canonical effect cross the same SQLite transaction boundary.

## Compatibility

Version 1 remains an immutable historical contract. Version 2 adds the required nullable `packageIdentity` field and
otherwise preserves version-1 semantics. Unknown fields are rejected. New phases, fields, states, identity values, or
classification semantics require a new transport schema. New terminal codes that refine the existing terminal-code
string namespace require documentation, localization, valid and invalid synthetic contract evidence, and persistence
compatibility evidence in the same change.
