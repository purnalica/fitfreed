# Ubiquitous Language

## Status

Proposed Milestone 0 baseline. Terms become confirmed as their owning bounded contexts and invariants are accepted. Provider vocabulary remains in provider references and anti-corruption layers unless it also expresses a genuine FitFreed concept.

## Data ownership and portability

| Term | Meaning | Boundary |
|---|---|---|
| **Personal Data Library** | The user's local FitFreed state: canonical fitness history, provenance, import ledger, settings, and the metadata required to maintain it safely. | It is not a copy of a provider archive and must remain recoverable independently of one storage engine. |
| **Canonical Model** | FitFreed's provider-neutral, normative representation of user-meaningful fitness concepts and their invariants. | It does not mirror provider JSON or persistence tables. |
| **Portable Export** | An open, versioned FitFreed representation intended for independent interchange and user exit. | It is a stable public contract, not a database dump. |
| **Portable Backup** | A recoverable package capable of restoring the user's library, including application metadata not intended as a general interchange contract. | Backup and portable export may share components but serve different guarantees. |
| **Persistence Schema** | The implementation-specific layout used to store a library efficiently. | It is documented and migratable but is not the canonical model or portable contract. |

## External source language

| Term | Meaning | Boundary |
|---|---|---|
| **Source Provider** | The external system from which personal data was obtained, such as Polar Flow. | A provider identifies provenance and an importer; it does not define product navigation or canonical types. |
| **Source Subject** | The provider-side account or person to whom an export's observations belong, represented by a protected local identity and supporting match evidence. | Mutable profile values and unverified filename tokens are not assumed to be stable subject identifiers. |
| **Observation Origin** | A locally stable, provider-neutral reference to one source provider and source subject from which comparable measurements originate. | It keeps same-day or same-time observations from different origins distinct until an explicit cross-source composition rule exists. |
| **Export Package** | One provider-produced collection selected for an import attempt. | The current Polar delivery is a ZIP, but package semantics must not be reduced to ZIP mechanics. |
| **Delivery Container** | The transport representation that encloses an export package. | ZIP validation belongs to an adapter; ZIP is not a domain entity. |
| **Source Artifact** | One file-like member discovered inside an export package. | Its path and byte identity are delivery facts, not canonical identity. |
| **Artifact Family** | A set of source artifacts that share an observed role, naming grammar, and structural contract. | A family is provider compatibility vocabulary and does not imply a bounded context. |
| **Source Record** | The smallest source structure for which an importer can establish an independent mapping or compatibility outcome. | It may be an object, collection item, or sample and need not correspond one-to-one with a canonical entity. |
| **Source Record Locator** | Provider-specific evidence sufficient to locate a source record within an export package for reconciliation or diagnosis. | It must be safe for local provenance; it is not exposed in diagnostics when it contains personal data. |
| **Package Fingerprint** | A cryptographic digest of the exact selected package bytes. | It accelerates exact-repeat detection but never proves logical equivalence between different packages. |
| **Artifact Fingerprint** | A cryptographic digest of one exact source artifact. | It identifies byte equality, not the identity of the domain information inside it. |
| **Format Reference** | A descriptive account of an external provider format, with claims labeled as official, observed, interpreted, or unknown. | It must not convert observations into provider guarantees. |

## Import language

| Term | Meaning | Boundary |
|---|---|---|
| **Import Operation** | One durable attempt to inspect and integrate an export package into a personal data library. | It has its own identity, state, timing, progress, and outcome even when the package was imported before. |
| **Package Assessment** | The safe, read-only result of container validation, provider detection, artifact inventory, and compatibility planning. | It does not make canonical data visible. |
| **Coverage Item** | The reported outcome for a source artifact or record family. | The outcome is exactly one of supported, unsupported, deliberately ignored, unrecognized, or invalid, with an explanation. |
| **Supported** | Recognized, structurally accepted, mapped, and eligible for integration in the current version. | Successful parsing alone is insufficient. |
| **Unsupported** | Recognized but not integrated by the current version. | It remains visible and is not reported as successful. |
| **Deliberately Ignored** | Recognized and intentionally excluded under an explicit documented policy. | The reason is user-visible; this state is never a silent default. |
| **Unrecognized** | Not matched to any known artifact family or source contract. | It is preserved in the coverage outcome and may indicate format evolution. |
| **Invalid** | Intended to match a known contract but violates container, syntax, schema, relationship, or safety rules. | Invalid content cannot silently degrade to unsupported. |
| **Normalized Observation** | A typed, provider-neutral candidate emitted by an anti-corruption layer for domain evaluation. | It is not canonical history until identity, invariants, and reconciliation succeed. |
| **Import Plan** | The deterministic set of artifact classifications and mapping work derived from a package assessment. | The plan can be explained before integration and must not depend on artifact iteration order. |
| **Import Outcome** | The terminal account of coverage, integration decisions, warnings, failures, and recovery guidance for an import operation. | It distinguishes package processing from changes to canonical history. |

## Identity and reconciliation

| Term | Meaning | Boundary |
|---|---|---|
| **Logical Identity** | The domain rule that determines whether two normalized observations refer to the same user-meaningful thing. | It is defined per canonical concept; no universal filename-, hash-, or timestamp-based rule exists. |
| **Exact Repeat** | An export package with the same byte fingerprint as an already assessed package. | It may skip redundant parsing, but the import operation still receives an explainable outcome. |
| **Semantic Duplicate** | A candidate with the same logical identity and equivalent canonical content as known history. | It creates no duplicate canonical entity while provenance may be extended. |
| **Overlap** | Two packages contain observations whose logical identities or covered ranges intersect. | Overlap is expected and is resolved per concept rather than treated as a package error. |
| **Amendment** | A later candidate has the same logical identity but contains a legitimate changed or more complete representation. | Its acceptance rule, retained provenance, and replaced information are explicit. |
| **Conflict** | Competing candidates refer to the same logical identity but cannot be deterministically reconciled under the current rules. | A conflict remains visible; source order or last write cannot silently decide it. |
| **Reconciliation** | The domain decision that classifies a candidate as new, equivalent, amended, conflicting, or rejected and determines the resulting canonical state. | Source parsing and artifact iteration order do not own this decision. |
| **Provenance** | The minimum traceable relationship between canonical information and the provider, import operation, artifact, source record, mapping version, and reconciliation decision that produced it. | It must support explanation without leaking personal values into logs or public diagnostics. |

## Fitness history language

The initial product vocabulary includes **Daily Activity Observation**, **Training Session**, **Sleep Period**, **Recovery Observation**, **Physical Measurement**, **Fitness Test**, **Training Target**, **Device Registration**, and **Sport Profile**. Their precise identities, values, relationships, and invariants are defined only when evidence supports a canonical specification; source field names are not definitions.

A **Training Session** is a source-scoped aggregate summary of one recorded workout. Its declared duration is independent of local wall-clock subtraction. Child exercises, laps, routes, and samples are not substitute aggregate identities. An unresolved **Sport Reference** is opaque same-source classification evidence, never a human-readable name or cross-provider taxonomy by itself.

The first candidate concept is specified in [`daily-activity.md`](daily-activity.md).

## Insight language

| Term | Meaning | Boundary |
|---|---|---|
| **Exploration** | Interactive navigation and filtering of canonical history. | It does not modify source evidence or reconciliation rules. |
| **Report** | A reproducible interpretation of canonical history for a defined question, period, and parameter set. | It states inputs, units, gaps, and calculation rules. |
| **Visualization** | A visual encoding of canonical or report data designed to reveal patterns and relationships. | It must preserve accessible non-visual meaning and must not imply unsupported medical conclusions. |

## Terms to avoid in the core

- Provider filenames, JSON field names, branded metrics, and API resource names outside their adapter or mapping specification.
- **Record ID** without naming whether it is a source locator, canonical identity, import-operation identity, or persistence key.
- **Duplicate** without distinguishing exact package repetition from semantic duplication.
- **Raw data** when the intended meaning is source artifact, source record, unsupported field, or high-resolution sample.
- **Imported successfully** when any detected content is unsupported, ignored, unrecognized, invalid, or left in conflict without that qualification.
