# Public Origin Version 1

## Purpose

`release/public-origin.json` is the single versioned source for FitFreed's canonical public origin. Product links, Pages publication checks, updater URLs, release evidence, and remote verification derive their public URLs from this contract. [ADR 0023](../../architecture/decisions/0023-use-fitfreed-org-as-the-public-origin.md) owns the decision.

## Contract

The JSON document conforms to `schemas/public-origin-v1.schema.json` and contains exactly:

| Field | Type | Meaning |
|---|---|---|
| `format` | fixed string | `org.fitfreed.public-origin`. |
| `schemaVersion` | integer | Contract version; exactly `1`. |
| `canonicalOrigin` | HTTPS URL | Credential-free apex origin with the default HTTPS port, `/` path, and no query or fragment. |

Version 1 selects `https://fitfreed.org/`. The stable metadata endpoint is derived as `updates/stable.json`; versioned updater packages are derived beneath `updates/<version>/`. The generated GitHub project address is not a second origin and cannot be used by the no-redirect update transport.

## Operational boundary

The contract does not prove DNS ownership, GitHub organization verification, certificate issuance, or remote byte identity. Those are external publication gates. Changing `canonicalOrigin` requires a new architecture decision, coordinated DNS and Pages configuration, complete URL-contract verification, and hosted reacceptance before the new value is production-ready.
