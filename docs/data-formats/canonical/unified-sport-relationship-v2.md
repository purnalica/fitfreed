# Canonical Unified Sport Relationship Version 2

## Status and authority

This is the normative provider-neutral domain contract for a deliberate, reusable relationship between represented
FitFreed sport collections. It retains every version-1 authorship, revision, precedence, reversibility, and evidence
preservation invariant while adding the later-import semantics accepted in
[ADR 0037](../../architecture/decisions/0037-apply-reusable-local-sport-correlation-rules.md).

[Version 1](unified-sport-relationship.md) remains the fixed-member predecessor.

## Reviewed aggregate

| Field | Type | Required | Semantics |
|---|---|---|---|
| `relationshipRef` | non-empty opaque string | yes | Stable local identity; `unified:` plus the initial primary collection capability. |
| `primarySessionFilterRef` | non-empty opaque string | yes | Reviewed member whose usable visible identity takes precedence. |
| `memberSessionFilterRefs` | ordered array of opaque strings | yes | Canonically sorted reviewed set of two through 64 represented collections. |
| `authorship` | `user` | yes | Deliberate personal assertion. |
| `revision` | positive integer | yes | Starts at one and advances once for each effective authored revision. |

Reference syntax, membership uniqueness, primary membership, optimistic revision, overlap, removal, and usable-primary
rules are unchanged from version 1. The reviewed fields describe the evidence visible at the authored revision; an
import never pretends to be another authored revision.

## Reusable local matching

For each reviewed member with source-profile identity, the persistence adapter derives one private selector from its
resolved observation origin and exact source sport reference. The selector is provider-specific matching state, not a
canonical sport identifier, label, global mapping, or public transport field. Members without that evidence retain
only their reviewed opaque capability.

At query time, the adapter resolves each retained selector against the current represented collections. A present
reviewed member remains effective. A later collection matching the same selector joins the effective member set. If a
reviewed capability disappeared because later exact evidence split or replaced its collection, at least one current
match for its retained selector replaces that missing capability. A missing member without a current selector match
remains review-required.

Effective membership remains bounded to 64 exact collections. Resolving more members is a coherent-query error; the
adapter must not select an arbitrary subset or return a truncated relationship.

The reviewed primary remains primary while available. If it was replaced, exactly one current usable collection for
its explicitly marked selector may supply precedence. Zero or several usable replacements retain review-required
state; order, frequency, and label equality never choose one.

Effective matching does not change `relationshipRef`, `authorship`, or `revision`. Revising the relationship replaces
the reviewed member set and all derived selectors atomically. Removing it removes both sets and no imported evidence.
One private selector belongs to at most one relationship; overlap fails closed.

## Provider normalization

Reusable personal matching is distinct from a shipped provider-normalization rule. A provider adapter may assign the
same opaque normalization capability to separate exact represented collections only when a versioned source contract
establishes equal provider-neutral meaning. The Polar rule version 1 normalizes equal exact documented detailed-sport
codes inside one observation origin, even when session records use distinct opaque sport identifiers. It does not
extend that identity to an unresolved session merely because the opaque identifier is equal.

Provider-normalized visible collections retain every exact base capability for filtering and drill-down. They carry
no user-authored relationship value. A deliberate personal relationship has precedence and can retain or extend the
reviewed collection set.

## Recovery and portability

Schema-37 whole-library backup and migration preserve the reviewed aggregate, private selectors, member-to-selector
relationships, and primary-selector marker. A future portable normalized-library contract must preserve equivalent
reusable semantics before it can claim complete sport-identity portability; the current product makes no such claim.

Changing reviewed fields, selector scope, replacement rules, provider-normalization authority, precedence, conflict,
or portability semantics requires a new major canonical version.
