# ADR 0005: Use library-scoped source-subject correlation

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Source integration](../source-integration.md), [import lifecycle](../import-lifecycle.md), [storage](../storage.md), [canonical daily activity](../../data-formats/canonical/daily-activity.md)

## Context

Repeated and overlapping provider exports must resolve to the same observation origin without making a provider username, email address, filename token, package fingerprint, or artifact UUID part of canonical identity. A wrong merge would silently combine histories belonging to different accounts; a delivery-only identifier would also make the library depend on an undocumented provider detail.

The evaluated Polar Flow reference contains exactly one account-data artifact with a non-empty string username. Structural analysis also shows that the trailing UUID-shaped token is distinct for every artifact and that numeric filename tokens have several family-specific roles. One export cannot prove that any filename token is stable across exports. These observations are evidence about compatibility, not personal values, and no reference value enters this decision or the repository.

The GDPR treats data minimization and safeguards such as pseudonymisation as data-protection-by-design measures. FitFreed uses that principle as a product-design input without claiming that this design alone establishes legal compliance, anonymization, or a complete security boundary. The authoritative legal text is [Regulation (EU) 2016/679, including Articles 4, 25, and 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/).

## Decision drivers

- Preserve deterministic reimport and overlap reconciliation across compatible exports from one provider account.
- Prevent automatic merging when provider evidence is missing, changed, or contradictory.
- Keep provider identifiers and mutable profile values out of canonical identity, logs, public diagnostics, and user-facing errors.
- Avoid a globally stable derived identifier that could correlate separate FitFreed libraries.
- Keep backup, restore, migration, and offline operation self-contained.
- Leave a provider-neutral boundary for later Garmin and other importers.

## Considered alternatives

### Raw provider identifier as canonical origin

The provider username or a filename token could become `originId`. Reimports would be simple when that value remained stable, but canonical history would expose provider-specific personal data and inherit undocumented mutation and delivery semantics.

### Globally deterministic digest as canonical origin

A public hash of a normalized username could avoid storing the source string directly. The same input would still create a stable cross-library identifier, low-entropy usernames could be guessed, and changing the provider value would change canonical identity.

### One implicit subject per local library

Every import could reuse one fixed local identity. This would avoid retaining correlation evidence, but importing a different account would silently merge unrelated histories and future multi-provider support would have no safe origin boundary.

### Opaque origin with library-scoped correlation evidence

Canonical observations use a random opaque local origin. The library stores only versioned, library-scoped evidence digests that map compatible provider claims to that origin. Ambiguous or contradictory claims fail closed.

## Decision

FitFreed adopts an opaque observation origin with library-scoped source-subject correlation evidence.

- `originId` is a random, opaque identifier created inside one personal data library. It contains no provider name, username, email address, filename token, package hash, or import order.
- Source Translation owns extraction and exact versioned normalization of provider evidence. Polar Flow correlation version 1 requires exactly one structurally valid account-data artifact with one non-empty string username. Filename tokens and profile fields are not correlation evidence.
- Library Stewardship owns a random correlation key generated once per library. It stores an HMAC-SHA-256 digest over a domain separator, provider code, evidence kind and version, and the exact normalized evidence bytes. The raw evidence bytes are discarded after resolution and never persisted or logged.
- The digest is supporting personal-library metadata, not canonical fitness identity and not anonymized data. Keeping the correlation key in the library makes backup and restore self-contained and prevents direct equality comparison across separate libraries, but it does not prevent offline guessing by an attacker who possesses the library. Operating-system protection, encryption, and stronger key management remain separate security controls.
- The first valid strong claim for a provider creates one origin and evidence record in the same atomic visibility transaction as the imported canonical history. A failed, rejected, cancelled, or interrupted import cannot leave an empty subject or correlation record.
- A later claim with the same scoped digest reuses the origin. An exact package repeat may reuse the origin linked by the earlier completed operation without reparsing.
- Missing, malformed, multiple, changed, or contradictory strong claims never fall back to a filename, package hash, existing-history count, or first-import assumption. While the MVP has no account-separation interface, an unmatched claim when that provider already has a verified origin is rejected with privacy-safe recovery guidance. It is never merged automatically.
- Import operations link to the resolved origin when available. Public outcomes expose only stable reason codes and aggregate coverage; they never expose the raw claim, its digest, or filename identity tokens.
- Legacy development origins migrate as unverified local origins without invented evidence. They cannot authorize a real-export fast path.

The decision establishes correlation inside one provider namespace. It does not define whether accounts from different providers represent the same person, merge two origins, support multiple accounts per provider in the UI, or publish correlation evidence in the portable normalized export.

## Consequences

### Positive

- Canonical identity stays stable when delivery filenames or package bytes change.
- Different provider accounts cannot be silently merged by the MVP.
- Raw usernames and email addresses are not retained merely to support reimport.
- Separate libraries do not expose directly comparable evidence digests.
- The same provider-neutral origin contract can be implemented by later adapters.

### Negative

- A provider username change cannot be correlated automatically and requires a future explicit recovery or account-separation flow.
- A library copy contains both the scoped digest and its correlation key, so a guessed username can still be tested offline.
- Legacy development history has no trustworthy evidence and remains explicitly unverified.
- Source resolution adds schema, migration, backup, import-order, and failure-path complexity before richer fitness families can be enabled.

### Risks and mitigations

- **Accidental merge through normalization:** version 1 uses exact provider string bytes after structural validation; any future case folding or Unicode normalization requires new evidence-version compatibility tests.
- **Partial state after failure:** origin creation, evidence insertion, provenance, canonical changes, and operation completion share the visibility transaction.
- **Sensitive diagnostics:** errors use fixed reason codes and aggregate counts; tests and content scans reject raw values, digests, and private paths in public evidence.
- **False confidence from a digest:** documentation states that scoped correlation is neither anonymization nor a substitute for device, file-permission, backup, or future encryption controls.

## Verification

Synthetic tests must prove first-subject creation, same-evidence reimport, byte-different overlap, exact-repeat inheritance, missing and malformed account data, multiple account artifacts, changed evidence, conflicting evidence, migration from every released schema, cancellation, interruption, backup, restart, and the absence of raw evidence from persistence and diagnostics. Contract tests must keep provider extraction outside the canonical model, and packaged E2E must exercise both successful correlation and a privacy-safe rejection.

A local acceptance run may use the supplied private reference export only as read-only input. It may record aggregate counts and fixed outcome codes, but no personal value, evidence digest, filename token, private path, database, screenshot, or log may enter version control or hosted CI.
