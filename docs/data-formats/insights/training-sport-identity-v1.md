# Training Sport Identity Version 1

## Status and boundary

Normative provider-neutral read-model fragment shared by Home, History, session stories, reports, and export
rendering. JSON conforms to
[`training-sport-identity-v1.schema.json`](../../../schemas/training-sport-identity-v1.schema.json).
It combines a library-local capability, optional personal classification, and verifiable recognition
evidence without exposing `sourceProvider`, `sourceIdentifier`, provider name keys, or provider hierarchy.

`sportRef` is an opaque `sport-` capability with 64 lowercase hexadecimal characters. It supports later
local commands and is never a visible sport name. `classification` is the independent
[user-authored sport classification](../canonical/sport-classification.md). `recognition` is a disposable
provider-neutral projection derived from an activated
[provider catalogue](../providers/provider-sport-catalogue-v1.md). `recognitionCandidateCount` preserves the
resolution cardinality even when no single candidate can be exposed.

## Exact `state` values

- `recognized` requires one recognition candidate, an unresolved revision-zero classification, and a
  non-null `recognition` object.
- `ambiguous` requires at least two candidates, an unresolved classification, and null `recognition`; no
  candidate is selected or displayed as fact.
- `unknown` requires zero candidates, an unresolved classification, and null `recognition`.
- `personally-overridden` requires a positive-revision classification with `authorship` `user`. It may retain
  zero, one, or multiple source candidates, but the personal family or label always controls presentation.
  Two null meaning fields represent an explicit personal choice to keep the sport unknown.
- `unavailable` has null `sportRef`, `classification`, and `recognition`, with zero candidates, because the
  source did not identify a sport.

An unresolved classification has null `canonicalFamily`, `displayLabel`, and `authorship` at revision zero.
A personal classification allows a nullable provider-neutral `canonicalFamily` and nullable one-through-80
character `displayLabel`; at least one may be null, including both for explicit personal unknown. Personal
text is never translated.

## Recognition and locale fallback

Recognition contains nullable provider-neutral `canonicalFamily`, one or more `localizedNames`,
`catalogueRevision`, RFC 3339 `retrievedAtUtc`, `mappingVersion`, and an opaque `evidenceRef`. The evidence
reference starts with `sport-evidence-` and has a 64-character lowercase hexadecimal digest. It supports
diagnosis and reproducibility without revealing the provider identifier used for the join.

Presentation chooses a recognized name in this order: case-insensitive exact locale, requested base
language, `en`, then the first deterministically ordered available name. A recognized family is only a
fallback when no name exists. A personal display label wins over its family; a personal family wins over
all recognition. Ambiguous and unknown identities receive localized generic labels and the unknown symbol.

## Snapshot, reimport, and compatibility

Catalogue activation or mapping enrichment increments training discovery revision. Earlier snapshots fail
as stale rather than combining old grouping with new identity. Exact archive reimport does not erase
recognition or a personal override. A later activated catalogue can change recognized, ambiguous, and
unknown resolution, while personal identity remains authoritative and source evidence remains inspectable.

Provider identifiers, raw catalogue entries, inferred sport names, and opaque capability values are never
rendered in Home, History, session, report, or HTML output. Changing state meaning, precedence, candidate
cardinality, locale fallback, provenance fields, or privacy behavior requires a new identity version and new
versions of every response that embeds it.
