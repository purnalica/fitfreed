# ADR 0020: Compose the product site and update channel in one Pages deployment

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** FitFreed maintainers and product owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [ADR 0017](0017-split-public-download-and-update-hosting.md), [ADR 0019](0019-separate-candidate-build-from-public-promotion.md)

## Context

FitFreed needs a public entrance that explains the problem, demonstrates the product's value, distinguishes current behavior from future direction, and gives people useful paths to evaluate, download, document, support, or contribute to the project. The repository README remains the concise contributor and repository gateway; it cannot provide the same visual product narrative as a dedicated site.

GitHub Pages is already the selected direct, no-redirect origin for the authenticated application update channel. A custom Pages deployment replaces the complete published artifact; independent workflows that deploy the product site and `/updates/` separately could therefore erase one another. GitHub Releases remains the immutable human-facing record for signed installers, release evidence, checksums, and notes.

No public application release or supported download currently exists. This decision selects the publication topology without authorizing a release or permitting the site to claim unavailable behavior.

## Decision drivers

- Give FitFreed a memorable, visual, product-led public entrance before asking a visitor to inspect repository internals.
- Turn interest into an honest next action: understand, evaluate, download when supported, read documentation, report a problem, or contribute.
- Preserve the direct and atomic update-channel contract without creating a second hosting account or runtime service.
- Keep product claims, capability status, and release readiness derived from their canonical sources.
- Prevent competing Pages deployments from replacing parts of the public surface.
- Keep immutable release binaries and evidence in the service designed to host them.

## Considered alternatives

### Keep Pages limited to the update channel

This preserves the existing transport design but wastes the repository's natural public product URL and leaves discovery to a code-oriented README and Releases interface. It does not meet the product-adoption need.

### Host the product site on a separate service or repository

This isolates deployments but introduces another public origin, operational boundary, configuration source, and possible account or billing dependency before demand justifies them.

### Store installers and the complete evidence archive on Pages

This creates one visible host but duplicates GitHub Releases, weakens the immutable release record, and consumes the more constrained Pages publication and bandwidth budget.

### Compose the product site and update channel into one Pages artifact

This provides one public origin and preserves atomic publication. The product root can link to immutable GitHub Release assets while `/updates/` continues to serve the exact authenticated files required by the application.

## Decision

`https://purnalica.github.io/fitfreed/` is the canonical FitFreed product site.

- The site root is the public product and adoption surface. It explains the user problem and outcomes, presents the current product truth, demonstrates the intended experience, and links to documentation, support, security, contribution, and releases.
- Supported download calls to action link to immutable assets and evidence in GitHub Releases. Installers and the complete release evidence archive are not duplicated into the product-site tree.
- No supported-download call to action appears until the applicable release-readiness gate passes. Before then, the site may offer truthful source, documentation, contribution, and development-evaluation paths.
- `/updates/` remains the direct, no-redirect application update channel selected by ADR 0017. Its signed stable envelope and exact updater archive remain one inseparable snapshot.
- A single compositor owns the complete Pages artifact. Every Pages deployment contains the full product site and either no active update snapshot before channel activation or one complete, verified update snapshot after activation. No workflow may deploy a partial Pages subtree.
- Public release promotion composes the product site from the exact tagged source with the accepted update candidate. A product-site-only publication after update activation must preserve and verify the currently published update snapshot or fail closed.
- Pages deployments share one protected deployment environment and one repository-wide concurrency boundary so product and release publication cannot race.
- Public capability claims derive from `docs/product-status.json`; requirements, roadmap, release readiness, and release evidence remain authoritative in their existing canonical sources.
- The static site has no analytics, cookies, account, imported-data processing, or external runtime dependency by default. Any future measurement or third-party service requires a separate privacy and architecture decision.

Publishing or replacing the live Pages site remains an accountable external action. This decision authorizes the topology and versioned automation design, not a binary release or unsupported product claim.

## Consequences

### Positive

- FitFreed gains a dedicated acquisition surface without adding a hosting provider or application backend.
- Visitors reach product value, trustworthy status, downloads, documentation, and contribution paths from one stable URL.
- GitHub Releases and Pages retain distinct responsibilities while appearing as one coherent product experience.
- Atomic composition prevents the product site and update channel from overwriting each other.

### Negative

- Product-site changes after update activation must carry forward a verified update snapshot.
- The publication compositor and concurrency contract become release-critical infrastructure.
- The site must be maintained alongside product behavior and readiness evidence.

### Risks and mitigations

- A partial deployment could remove the update channel. The compositor rejects incomplete artifacts and is the only Pages deployment entry point.
- A stale site could overstate the product. Generated capability status and readiness-gated download actions fail verification when they diverge from canonical sources.
- A site deployment could race with release promotion. One environment and concurrency group serialize both operations.
- Pages limits or availability could become unsuitable. Measured pressure triggers a new hosting decision; release assets remain independently available from GitHub Releases.

## Verification

Acceptance requires automated checks for a complete product root, internal links, generated capability status, accessibility, narrow and wide layouts, absence of unsupported download actions, absence of external tracking dependencies, and preservation of a complete `/updates/` snapshot after activation. Deployment tests must prove that product-only and release promotions use the same compositor, serialize through the same concurrency boundary, and cannot publish a partial tree. Remote verification must check the canonical site URL, the direct update objects when active, and every enabled release link.

The deployment contract follows [GitHub's custom Pages workflow model](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), in which one uploaded Pages artifact becomes the deployed site.
