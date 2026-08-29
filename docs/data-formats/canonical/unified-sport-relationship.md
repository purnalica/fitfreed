# Canonical Unified Sport Relationship Version 1

## Status and authority

This is the normative provider-neutral domain contract for a deliberate relationship between represented FitFreed
sport collections. It records user authorship, not provider evidence, catalogue authority, or a reusable source
mapping. [ADR 0036](../../architecture/decisions/0036-unify-sport-collections-through-explicit-user-authorship.md)
owns the structural decision.

## Fields

| Field | Type | Required | Semantics |
|---|---|---|---|
| `relationshipRef` | non-empty opaque string | yes | Stable local identity; created as `unified:` plus the initial primary collection capability. |
| `primarySessionFilterRef` | non-empty opaque string | yes | Member whose usable visible identity takes precedence. |
| `memberSessionFilterRefs` | ordered array of opaque strings | yes | Canonically sorted set of two through 64 represented collections. |
| `authorship` | `user` | yes | The relationship is always a deliberate personal assertion. |
| `revision` | positive integer | yes | Starts at one and advances once for each effective revision. |

References contain no outer whitespace or control characters and are at most 200 Unicode scalar values. Member
references are unique, and the primary reference is one of the members. Canonical ordering has no precedence meaning.
Equal labels, families, source profiles, candidate order, or provider codes cannot create a relationship.

## Authorship and revision

Creation requires a complete current preview of every member's visible identity, represented session count, date
range, and the selected primary. Reordering the same member set is idempotent. Changing the primary or member set
retains `relationshipRef` and advances the revision once. Removal requires the expected current revision and returns
the removed identity without deleting any member evidence.

One represented collection belongs to at most one active relationship. The application rejects overlapping
relationships rather than selecting one by order. A primary must have a usable recognized or personally classified
identity at save time; an unknown, ambiguous, or export-missing member may participate only under another explicit
primary.

## Reconciliation

Import and source-evidence changes do not mutate the aggregate. When every opaque member still resolves and the
primary remains usable, the relationship is active and the projection may combine member coverage. A missing member,
overlap, or unusable primary makes the relationship review-required. Review-required state shows current members
separately and permits an explicit revision or removal; it never guesses a replacement.

Filters, report questions, and saved exploration state retain underlying member collection references. They do not
persist a synthetic merged predicate. Whole-library backup and restore preserve the relationship. A future open
portable library format must include this aggregate before it can claim complete sport-identity portability.

Changing identity derivation, membership limits, authorship, revision, overlap, reconciliation, or removal semantics
requires a new major canonical version.

