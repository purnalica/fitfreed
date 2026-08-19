# Canonical Report Definition Version 1

## Status and authority

This is the normative provider-neutral contract for the first durable FitFreed report definition. Version 1
delivers one complete session-origin composition: ordered session evidence followed by a person's plain-text
interpretation. It is intentionally narrower than the complete report-builder scope in FR-005. New block
kinds require a later compatible definition version and an explicit migration; unimplemented block names or
generic property bags are not valid version-1 content.

The independently usable JSON representation is specified by the
[portable report-definition contract](../portable/report-definition-v1.md). SQLite is an implementation
detail and never the portability boundary.

## Identity and lifecycle

| Field | Type | Required | Semantics |
|---|---|---|---|
| `reportRef` | opaque `report-` capability | yes | Stable local identity containing 64 lowercase hexadecimal characters after the prefix. |
| `title` | string | yes | Trimmed user-authored title of 1 through 120 Unicode scalar values, without control characters. |
| `locale` | `en-US` or `es-ES` | yes | Language used to resolve and export this definition; it is independent from a later application preference. |
| `sourceSnapshotRef` | opaque `training-snapshot-` capability | yes | Training-library revision against which the definition was last deliberately saved or refreshed. |
| `origin` | session origin | yes | Canonical provider-neutral destination that can reopen the originating session. |
| `provenancePolicy` | `current-attribution` | yes | Version-1 output includes the current contributing provider and interpretation versions, not the full import audit. |
| `authorship` | `user` | yes | The definition and narrative are personal authored information. |
| `definitionVersion` | integer | yes | Exactly `1`. |
| `revision` | positive integer | yes | Starts at 1 and advances once for each effective authored edit. |
| `blocks` | ordered block collection | yes | Exactly the two version-1 blocks below with unique opaque `report-block-` identities. |

An unchanged edit preserves the revision. Saving against an older expected revision fails instead of
overwriting newer authorship. Imports never rewrite a report definition. A changed training snapshot makes
the definition stale; current values may be presented only as a refresh candidate and cannot be exported as
though they belonged to the saved revision.

## Ordered blocks

### Session evidence

Ordinal zero has kind `session-evidence`. Its `sessionRef` must equal the session origin. It stores only the
stable canonical reference and the authored `includePhysiologicalContext` choice. Summary measurements,
sport labels, provider versions, coverage, and limitations are resolved through authoritative application
queries and are never copied into the durable definition.

When physiological context is false, resolved presentation and output omit average and maximum heart rate.
An export review may change true to false for that export without mutating the definition. It may not change
false to true.

### Narrative

Ordinal one has kind `narrative`. `body` is 1 through 10,000 Unicode scalar values after outer whitespace is
removed and CRLF or CR line endings become LF. LF and horizontal tab are allowed; other control characters
are invalid. Version 1 treats the body as plain text. It is never parsed as HTML or Markdown.

## Resolution, provenance, and limitations

The saved snapshot and exact session identity are resolved through the training-session selection use case.
Current attribution is resolved through the training-session provenance use case at the same snapshot.
Presentation, HTML rendering, and persistence do not recreate those queries or read canonical tables.

A resolution is `current` only when the resolved training snapshot equals `sourceSnapshotRef`. A later
snapshot is `stale` even when the referenced session's visible values happen to be unchanged. This
conservative version-1 rule prevents unrelated source evolution from being silently treated as the saved
interpretation. A later report version may narrow invalidation only with an authoritative dependency
fingerprint.

Resolved output explicitly reports unavailable distance, energy, heart rate, and sport meaning. Missing is
not zero. Provider attribution, FitFreed interpretation versions, recorded session facts, and the user's
narrative remain distinct.

## Privacy and compatibility

Definitions are local sensitive authored data. They contain no provider identifier, source subject,
package digest, artifact locator, local export path, or copied route coordinate. Portable export is a
separate explicit action.

Changing identity, normalization, ordering, block kinds, authorship, sensitivity authority, refresh
semantics, provenance policy, or limits requires a new canonical version. Readers reject unsupported
versions without dropping the stored bytes.
