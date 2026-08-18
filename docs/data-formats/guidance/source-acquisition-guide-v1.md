# Source Acquisition Guide Version 1

## Status

Normative FitFreed application-to-presentation contract. The machine-readable schema is [`../../../schemas/source-acquisition-guide-v1.schema.json`](../../../schemas/source-acquisition-guide-v1.schema.json).

## Purpose

This contract lets an importer adapter explain how a person can obtain its supported historical archive without making the provider-neutral application core understand provider pages or terminology. The guide is bundled with FitFreed and remains usable offline. Official pages are optional follow-up destinations opened only after an explicit user action.

The contract does not automate credentials, account access, export requests, delivery polling, or downloads. It describes the last independently verified official process and identifies provider-controlled constraints without turning them into FitFreed guarantees.

## Media type and encoding

- JSON representation encoded as UTF-8 when transported through the desktop command boundary.
- Schema identifier: `https://fitfreed.org/schemas/source-acquisition-guide-v1.schema.json`.
- Contract version: integer `schemaVersion` value `1`.
- Unknown properties are rejected at every object level.

## Root object

| Field | Type | Cardinality | Meaning |
|---|---|---:|---|
| `schemaVersion` | integer | 1 | FitFreed contract version; exactly `1`. |
| `sourceId` | lower kebab-case string | 1 | Stable source-adapter identifier, never a user or account identifier. |
| `guideVersion` | versioned identifier | 1 | Adapter-owned semantic guide version such as `synthetic-source-acquisition@1`. |
| `verifiedOn` | ISO 8601 full date | 1 | Date on which the documented official procedure and destinations were last checked. |
| `expectedArchive` | enum | 1 | Archive selected by the importer; version 1 supports `zip`. |
| `instructionKeys` | ordered unique key array | 1..32 | Offline procedure in execution order. Keys select localized source-specific copy; they are not rendered as text. |
| `constraintKeys` | ordered unique key array | 0..16 | Provider-controlled preparation, delivery, availability, or retention constraints. |
| `troubleshootingKeys` | ordered unique key array | 1..16 | Offline recovery information for common acquisition problems. |
| `officialLinks` | unique link array | 1..16 | Exact HTTPS destinations supplied by the adapter. |

Content keys use lower-case dot or hyphen separated identifiers. A key's localized meaning is owned jointly by the adapter version and locale catalogs. Reordering, adding, removing, or changing the meaning of a key requires a new `guideVersion`.

## Official link object

| Field | Type | Cardinality | Meaning |
|---|---|---:|---|
| `purpose` | enum | 1 | `account` opens the provider account entry; `instructions` opens the official procedure. |
| `locale` | BCP 47 language tag or null | 1 | Locale-specific destination, or `null` when the destination is locale-independent. |
| `url` | HTTPS URI | 1 | Exact official destination. Redirect behavior remains provider-controlled. |

The adapter may supply one locale-independent account link and multiple localized instruction links. Presentation selects an exact locale match and otherwise exposes the available official instruction language explicitly; it never fabricates a translated URL. The Tauri capability independently allowlists the shipped destinations, so a valid contract alone cannot authorize an arbitrary URL.

## Ordering, identity, and duplicate behavior

- `sourceId` identifies the source capability and is unique in one query result.
- `guideVersion` identifies the meaning of one guide revision; it is not a timestamp.
- Array order is meaningful for instructions, constraints, and troubleshooting.
- Duplicate content keys and duplicate `(purpose, locale)` official-link identities are invalid.
- Query results are sorted by `sourceId` after full validation so adapter enumeration order cannot alter presentation behavior.

## Validation and failure behavior

FitFreed rejects the complete guide query when any guide has an unsupported `schemaVersion`, blank or malformed identifier, invalid date, non-HTTPS URL, empty required collection, duplicate identity, or unsupported archive kind. Invalid or absent guidance is reported as unavailable. Presentation does not guess steps or silently substitute a provider page.

Provider website content is outside this contract and may change after `verifiedOn`. The bundled procedure remains the last verified offline description; the interface identifies the verification date and makes the boundary explicit.

## Synthetic valid example

```json
{
  "schemaVersion": 1,
  "sourceId": "synthetic-source",
  "guideVersion": "synthetic-source-acquisition@1",
  "verifiedOn": "2026-01-15",
  "expectedArchive": "zip",
  "instructionKeys": [
    "open-account",
    "request-export",
    "wait-for-delivery",
    "download-archive"
  ],
  "constraintKeys": ["delivery-time-varies", "download-window-limited"],
  "troubleshootingKeys": ["email-not-received", "archive-expired"],
  "officialLinks": [
    {
      "purpose": "account",
      "locale": null,
      "url": "https://account.example.test/"
    },
    {
      "purpose": "instructions",
      "locale": "en-US",
      "url": "https://support.example.test/en/export"
    }
  ]
}
```

Synthetic invalid evidence covers an unsupported schema version, a duplicate content key, an invalid date, an insecure URL, and duplicate official-link identity. Contract verification runs in `npm run check:data-contracts`.

## Compatibility

Additive locale catalogs and additional `officialLinks` do not change `schemaVersion`. New root fields, archive kinds, link purposes, or changed field semantics require a new contract schema version. A source procedure change updates `guideVersion` even when the version 1 shape remains sufficient.
