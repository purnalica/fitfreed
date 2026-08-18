# Canonical Sport Classification Version 1

## Status and authority

This is the normative provider-neutral contract for a FitFreed sport classification. It implements the
user-authored classification boundary accepted by FR-026 and ADR 0021. It does not define a provider sport
catalogue and does not turn an opaque source reference into a display name.

## Identity and source relationship

`SportClassification` is scoped to the exact pair `(originId, sourceSportRef)`:

- `originId` is the non-empty opaque library-local observation-origin identity;
- `sourceSportRef` is the non-empty exact source reference retained by a canonical training session;
- both values are source evidence and remain unchanged by classification;
- the application exposes a stable opaque `sportRef` to presentation instead of either identity component;
- equal labels or families do not merge classifications, origins, or sessions; and
- a session without a source sport reference remains `unavailable` and cannot be classified by inference.

The classification read model always has one of three states:

- `unknown`: a source reference exists but has no user-authored meaning;
- `classified`: the user supplied a family, display label, or both; or
- `unavailable`: the source session supplied no sport reference.

An absent persistence row is read as `unknown` at revision zero. Returning a prior classification to
`unknown` is itself an authored revision and remains persisted.

## User-authored fields

| Field | Type | Required | Semantics |
|---|---|---|---|
| `state` | `unknown` or `classified` | yes | Explicit current interpretation. |
| `canonicalFamily` | family code or null | yes | Optional broad FitFreed category; null means no family was chosen. |
| `displayLabel` | string or null | yes | Optional user text for this exact source classification. |
| `authorship` | `user` or null | yes | Null only for unresolved revision zero. |
| `revision` | non-negative integer | yes | Zero for an unresolved value; otherwise increased by one for each authored change. |

Version 1 family codes are `running`, `cycling`, `swimming`, `walking`, `hiking`, `strength`, `mobility`,
`racket-sport`, `team-sport`, `winter-sport`, `water-sport`, and `other`. They are deliberately broad,
localized by presentation, and additive in future compatible versions. They are not provider identifiers.

A classified value must contain a family, a display label, or both. A display label is trimmed, contains
one through 80 Unicode scalar values, and contains no control character. User text is preserved exactly
after outer whitespace is removed; it is not translated or normalized into a family.

## Revision and reconciliation

Saving requires the revision the editor observed. A matching save creates revision one or increments the
existing revision. A stale revision changes nothing and returns a conflict. Saving an identical authored
value is idempotent and retains the current revision.

Archive import and reimport never create, revise, delete, or suggest a user classification. Source session
amendment may introduce a new exact source reference; that reference begins as unknown while every existing
classification remains unchanged. A future provider suggestion is separate attributed evidence and cannot
replace this aggregate silently.

## Portability and compatibility

The classification is user-owned library data and must survive restart, schema migration, whole-library
backup, and restore. It will enter the open portable format when that format is implemented; SQLite is not
its portable representation. Removing a family code, changing identity, weakening revision checks, or
changing unknown semantics requires a new major contract version.
