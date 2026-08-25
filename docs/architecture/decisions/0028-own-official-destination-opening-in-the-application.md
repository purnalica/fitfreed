# ADR 0028: Own official destination opening in the application

- **Status:** Accepted
- **Date:** 2026-08-25
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [NFR-002](../../requirements.md#nfr-002--privacy-of-reference-data),
  [NFR-008](../../requirements.md#nfr-008--user-experience-quality),
  [NFR-009](../../requirements.md#nfr-009--developer-experience-quality), and
  [NFR-022](../../requirements.md#nfr-022--vendor-neutral-domain-and-application-core)
- **Related delivery plan:** [MVP redesign production migration](../../plans/mvp-redesign-production-migration.md)
- **Related architecture:** [Source integration](../source-integration.md) and
  [module map](../module-map.md)

## Context

Source-acquisition guidance contains validated official destinations, but opening those destinations was a
frontend plug-in action that accepted an arbitrary URL. The operating-system request had no owned application
outcome, a successful delegation left no persistent visible result, and plug-in or operating-system failures
were collapsed into a distant generic source error. Instrumented E2E replaced the plug-in call, so it could
verify the requested URL but not the production boundary that selected and delegated it.

The guide is already owned and validated by the application layer. Selecting a destination from a source,
purpose, and locale is therefore application behavior. The native operating-system launcher remains an
infrastructure concern. Presentation must not become a second authority for which URL may be opened.

## Considered alternatives

### Keep the frontend opener plug-in and improve only presentation feedback

This would improve the visible result, but the frontend would retain arbitrary URL authority and native failure
classification would remain coupled to a plug-in IPC error. The production selection path would still differ
from the validated application guide path.

### Pass an arbitrary URL to a new host command

This would make native errors easier to classify, but it would merely move the same authority from one outer
adapter to another. Capability allowlists would become a second destination registry that could drift from the
versioned source guide.

### Send a typed source, purpose, and locale request through an application use case

The application can validate the complete guide, choose an exact locale or locale-neutral fallback, and pass
only that validated destination to an infrastructure launcher port. The host can expose stable failure codes
without serializing platform errors or granting generic frontend URL access.

## Decision

Official source destinations will be opened through an application-owned use case:

- Presentation sends only `sourceId`, typed purpose, and supported locale. It may display the guide URL, but
  that display value is not native opening authority.
- The application revalidates the adapter guide, resolves exact-locale then locale-neutral fallback, rejects an
  unknown source or missing purpose, and delegates the selected HTTPS URL through
  `OfficialSourceLinkOpenerPort`.
- Infrastructure calls the operating system's detached URL launcher and classifies unsupported-platform,
  permission-denied, missing-handler, operating-system, and adapter-delegation failures.
- The host returns the selected source, purpose, and URL on accepted delegation and maps each failure category
  to a stable public code. Raw operating-system errors are not serialized.
- The frontend opener package, plug-in registration, and URL capability allowlist are removed. The native Rust
  launcher dependency remains an infrastructure implementation detail.
- Instrumented E2E replaces only the final launcher action under a distinct test marker and continues to verify
  the exact selected destination. Application and infrastructure tests verify production selection and failure
  classification. A revision-isolated human review remains necessary to confirm real browser appearance.

## Consequences

### Positive

- The validated source guide is the single authority for official destinations.
- React cannot request an arbitrary native URL, and destination scope cannot drift into a capability file.
- Presentation receives a factual accepted result and actionable, stable failure categories beside the action.
- Future source adapters enter through the same provider-neutral request without adding frontend permissions.

### Negative

- Desktop transport gains another typed command and outcome contract.
- E2E cannot prove that a browser window became visible because it deliberately replaces the operating-system
  surface; the human production-package gate remains mandatory.
- Native error classification is necessarily limited to failures reported synchronously by the operating-system
  launcher. An accepted request does not prove that a particular browser window became visible.

## Verification

- Application tests cover localized selection, neutral fallback, missing destinations, exact delegation, and
  every preserved launcher failure category.
- Infrastructure tests cover stable classification of native launcher errors.
- Transport tests cover strict request validation, outcome serialization, and stable public failure codes.
- React tests cover persistent accepted and failed outcomes, explicit copyable destinations, local focus, and
  concurrent-action exclusion.
- Packaged E2E verifies exact English and Spanish destinations through the instrumented final launcher boundary.
- The revision-isolated production package is reviewed manually with the actual default browser.
