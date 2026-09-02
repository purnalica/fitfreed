# ADR 0039: Decouple platform engineering from public promotion

- **Status:** Accepted
- **Date:** 2026-09-02
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [product roadmap](../../roadmap.md)

## Context

FitFreed's frozen first-MVP capability baseline must become available on macOS, Linux, and Windows before functional
growth resumes. The roadmap originally made Linux engineering depend on an accepted and published macOS release and
Windows engineering depend on an accepted and published Linux release. That sequence coupled reversible platform work
to human experience verdicts, credentials, signing, and public-promotion authority even when the later work did not use
the outcome of those gates.

The current macOS candidate has complete machine admission but still requires a bounded product-owner experience
verdict. No candidate is accepted, and no application release is authorized. The product owner has nevertheless
authorized Linux and Windows parity engineering to begin. This decision changes engineering order only; it does not
accept a candidate, weaken a platform gate, authorize publication, or expand the frozen functional baseline.

## Decision drivers

- Obtain cross-platform evidence without leaving independent work idle behind credentials or human availability.
- Preserve one complete, explicit acceptance boundary for every supported platform.
- Keep public rollout ordered so installation, support, update, and recovery learning reaches one platform at a time.
- Prevent passing automation on one platform from being represented as product acceptance on another.
- Keep post-MVP capabilities outside the cross-platform parity sequence.

## Considered alternatives

### Keep all engineering and publication strictly serial

Linux work would start only after public macOS promotion, and Windows work only after public Linux promotion. This is
simple to describe, but it makes independent portability work wait on product-owner verdicts and signing or publication
authority that provide no technical input to that work.

### Engineer the next platform after the preceding human verdict

This removes credential and publication delays from the engineering path, but still couples Linux and Windows work to
an earlier product-experience verdict even where the frozen capability contract and automated evidence are already
sufficient inputs.

### Engineer platform parity independently and promote serially

Linux and Windows investigation, implementation, and automated evidence proceed when their actual inputs are stable.
Acceptance and public promotion remain independent and ordered per platform.

## Decision

FitFreed will engineer the frozen first-MVP baseline for Linux and Windows without waiting for an unrelated open human,
credential, or public-promotion gate on a preceding platform.

- Platform work may advance only where its required product and technical inputs are stable.
- An open macOS gate remains open and is never inferred to pass from Linux or Windows evidence.
- Each platform must satisfy its own capability parity, packaging, installation, first-launch, update, migration,
  interrupted-update recovery, removal, accessibility, localization, security, privacy, performance, documentation,
  and supported-environment evidence.
- Public promotion remains macOS first, Linux second, and Windows third.
- No post-MVP functional capability enters implementation before the first supported public release exists on all
  three platforms.

## Consequences

### Positive

- Independent portability defects can be found and corrected earlier.
- Human availability and signing credentials do not become artificial engineering dependencies.
- Platform-specific work can share a stable functional contract while preserving distinct native evidence.

### Negative

- Several platform candidates may have open gates at the same time.
- Later-platform work may need revision if a macOS human verdict changes the frozen cross-platform behavior.
- Status reporting must distinguish engineering completion, machine admission, human acceptance, and public promotion.

### Risks and mitigations

- Parallel status could be mistaken for release readiness. The roadmap records engineering and publication dependencies
  separately, and every public workflow retains its own gate.
- Work could drift into functional growth under the label of parity. The cross-platform scope lock remains normative,
  and differences require traceability to platform integration or correction of the frozen baseline.
- Shared changes could invalidate prior evidence. Exact-revision campaigns remain mandatory for every affected
  platform before acceptance or promotion.

## Verification

Each platform execution plan must identify its stable inputs, native test matrix, package and trust boundaries, update
and recovery path, human gates, and publication dependency. Automation and status documentation must report evidence
per platform and reject promotion when the preceding public-platform dependency or the target platform's own complete
gate is open. Reconsider this decision if later-platform engineering cannot remain behaviorally isolated from an open
earlier-platform verdict.
