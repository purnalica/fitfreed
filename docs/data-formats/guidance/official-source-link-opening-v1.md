# Official Source Link Opening Version 1

## Status

Normative FitFreed presentation-to-application request and application-to-presentation outcome contract. The
machine-readable schema is
[`../../../schemas/official-source-link-opening-v1.schema.json`](../../../schemas/official-source-link-opening-v1.schema.json).
[ADR 0028](../../architecture/decisions/0028-own-official-destination-opening-in-the-application.md) owns the
authority boundary.

## Purpose

This contract lets a person explicitly ask FitFreed to open one destination from a validated source-acquisition
guide without granting presentation arbitrary native URL authority. It covers synchronous delegation to the
operating system. An accepted outcome does not assert that a particular browser window became visible or that
the provider page loaded successfully.

## Media type and encoding

- JSON representation encoded as UTF-8 through the desktop command boundary.
- Schema identifier: `https://fitfreed.org/schemas/official-source-link-opening-v1.schema.json`.
- Contract version: `1`, carried by the command and schema name rather than a payload field.
- Unknown properties are rejected.

## Request object

| Field | Type | Cardinality | Meaning |
|---|---|---:|---|
| `sourceId` | lower kebab-case string | 1 | Stable source-adapter identifier from the validated guide. |
| `purpose` | enum | 1 | `account` or `instructions`; it identifies a guide destination rather than a URL. |
| `locale` | enum | 1 | Supported presentation locale: `en-US` or `es-ES`. |

The application queries and validates the complete guide set, finds `sourceId`, then selects the link whose
`purpose` and `locale` match exactly. If none exists, it selects the locale-neutral link for the same `purpose`.
No other fallback is allowed. Unknown sources, purposes, locales, or missing destinations are rejected before
the native launcher is called.

## Accepted outcome object

| Field | Type | Cardinality | Meaning |
|---|---|---:|---|
| `sourceId` | lower kebab-case string | 1 | Source whose validated guide authorized the destination. |
| `purpose` | enum | 1 | `account` or `instructions`, copied from the accepted request. |
| `url` | HTTPS URI | 1 | Exact destination selected by the application and accepted by the native launcher. |

The outcome is returned only after the operating-system launcher accepts synchronous delegation. The `url` is
safe to present as the exact attempted destination. It is not provider response evidence.

## Failure behavior

The desktop boundary returns one stable code and no partial outcome:

| Code | Meaning |
|---|---|
| `invalid-official-source-link-request` | Request shape, purpose, or locale is unsupported. |
| `source-guide-query-failed` | The complete validated guide set could not be obtained. |
| `official-source-link-unavailable` | The source or requested destination is absent. |
| `official-source-link-unsupported` | The platform cannot open web destinations. |
| `official-source-link-permission-denied` | The operating system denied the request. |
| `official-source-link-launcher-unavailable` | No default web destination handler could be launched. |
| `official-source-link-os-failed` | The operating system reported another launcher failure. |
| `official-source-link-delegation-failed` | The infrastructure adapter could not delegate the request. |

Raw plug-in, process, path, command, and operating-system error content never crosses this contract.

## Synthetic valid examples

Request:

```json
{
  "sourceId": "synthetic-source",
  "purpose": "instructions",
  "locale": "es-ES"
}
```

Accepted outcome:

```json
{
  "sourceId": "synthetic-source",
  "purpose": "instructions",
  "url": "https://support.example.test/es/export"
}
```

Synthetic invalid evidence covers an unknown purpose, unsupported locale, blank source, insecure outcome URL,
and unknown properties. Contract verification runs in `npm run check:data-contracts`.

## Compatibility

Adding a locale or link purpose changes the closed request vocabulary and requires a versioned successor.
Adding fields, changing fallback order, accepting non-HTTPS destinations, or changing accepted-outcome meaning
also requires a new contract version. Adding a source guide or changing its destination does not change this
contract when the version 1 vocabulary remains sufficient.
