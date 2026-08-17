# ADR 0017: Split public download and update hosting

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [update trust](../update-trust.md)

## Context

The first public macOS release needs two different delivery experiences. A person needs a recognizable release page with a DMG, notes, checksums, dependency inventories, and provenance. The application needs one direct static HTTPS metadata URL and one direct updater-package URL that preserve the no-redirect transport boundary selected by [ADR 0009](0009-bound-package-transfer-inside-tauri-updater.md).

GitHub Releases provides the appropriate human release record and accepts assets well beyond FitFreed's current package size. Its browser download URLs redirect to an asset host, so they cannot serve the existing updater transport without weakening or replacing the accepted no-redirect contract. GitHub Pages can deploy one static artifact atomically and serve repository-owned direct URLs, but it has a 1 GiB published-site limit and a 100 GB monthly soft bandwidth limit. It is therefore suitable for the small current update channel, not for the complete human download and evidence archive.

No Apple signing identity, notarization credential, production Minisign key, live Pages deployment, tag, or GitHub release currently exists. This decision defines the delivery topology and authority boundary without creating or publishing any of them.

## Decision drivers

- Keep update metadata and package retrieval inside the existing direct-HTTPS, no-redirect boundary.
- Give users a conventional, durable, versioned download and evidence page.
- Publish metadata and package bytes as one consistent channel snapshot.
- Keep release credentials out of source, artifacts, logs, and unprotected jobs.
- Avoid a new hosting account, domain, runtime service, or mutable server implementation for the first release.
- Permit replacement of the update host when measured scale or availability requires it.

## Considered alternatives

### Use GitHub Releases for every artifact

This provides one durable release record and generous asset limits. Release asset browser URLs redirect, while FitFreed deliberately refuses metadata and package redirects. Supporting this topology would require a new package-redirect trust decision and implementation before it creates any user value.

### Use GitHub Pages for every artifact

This supplies direct static URLs and one atomic deployment unit. It makes the public DMG and evidence less discoverable, duplicates release-management capabilities, and consumes a service whose published-size and bandwidth limits are materially lower than GitHub Releases.

### Use an external object store or content-delivery network

An external store can provide direct immutable URLs and higher scale. It introduces another account, credential set, billing and retention policy, operational dependency, and possibly a domain before actual demand justifies them.

### Split human downloads from the application update channel

GitHub Releases can own the immutable human-facing release record. GitHub Pages can own only the current authenticated update envelope and its exact updater package at direct project URLs. One protected workflow can build both outputs and promote the Pages snapshot only after the signed and notarized release evidence passes.

## Decision

FitFreed will use the split topology for its first public macOS release.

- GitHub Releases hosts the signed and notarized DMG, release notes, checksums, release manifest, upgrade matrix, CycloneDX inventories, updater archive and signature, and provenance-verifiable evidence.
- GitHub Pages hosts only the current stable update envelope and the exact updater archive named by its signed payload. Both files enter one Pages deployment artifact so a deployment cannot publish metadata without its package.
- The production metadata endpoint is `https://purnalica.github.io/fitfreed/updates/stable.json`. Package paths are versioned and direct beneath the same origin. Neither request contains installed version, locale, library, account, installation, or usage information.
- The public application embeds the stable endpoint and active public Minisign trust set at compile time. An ordinary development build with no complete public configuration remains unconfigured and performs no update request. A partial or invalid build-time configuration fails closed.
- The production private Minisign key and Apple credentials exist only as protected environment secrets. Public keys, key identifiers, endpoint configuration, schemas, and workflow logic are versioned public inputs.
- Public release preparation is manual, exact-tag-bound, and non-publishing until a protected GitHub environment permits promotion. Build and verification jobs do not receive release secrets. A publication job cannot create an unsigned or non-notarized public release.
- Pages deployment and GitHub Release publication are one release operation. Failure before promotion leaves the existing public channel untouched. Withdrawal creates a newly signed higher-sequence channel snapshot and follows the documented incident procedure; published release assets are not silently replaced.
- The first public release may legitimately have no previous public application baseline. Synthetic packaged-update evidence remains mandatory; a later public release must additionally pass the supported real-version upgrade matrix before promotion.
- Pages bandwidth, availability, package size, and direct-response behavior are monitored as operational constraints. Reaching a service limit or needing multiple platforms triggers a new hosting decision rather than silently weakening integrity or privacy controls.

Creating the protected environment, production signing key, Apple identity, live Pages deployment, tag, release, or withdrawal remains an accountable external action. Versioned automation may be completed and tested with synthetic credentials before those gates close.

## Consequences

### Positive

- Human downloads use the established release experience while the application keeps a direct static transport.
- The channel has no application server, database, analytics, cookies, or user-specific request state.
- Metadata and package promotion can be atomic and independently authenticated.
- Release secrets can remain confined to a protected environment and short-lived workflow execution.

### Negative

- The updater archive is duplicated between Releases and Pages.
- Maintainers must operate two GitHub publication surfaces as one transaction.
- Pages limits make this an initial-scale solution rather than a permanent multi-platform assumption.
- A failure after creating a GitHub Release but before Pages promotion needs an explicit recovery or withdrawal action; it cannot be hidden by replacing assets.

### Risks and mitigations

- A workflow could expose secrets to untrusted source. Secret-bearing jobs require a protected environment, exact tagged source, minimal permissions, pinned actions, and pre-secret verification.
- A partial publication could announce an unavailable update. The existing channel remains unchanged until the complete candidate is published and remotely verified; only then is promotion accepted.
- A mutable Pages path could serve older bytes. The signed sequence, expiry, payload digest, updater signature, byte length, and SHA-256 checks reject replay, equivocation, or substitution.
- A Pages limit could interrupt downloads. The application treats transport failure as offline and remains usable; release downloads and evidence remain available through GitHub Releases.

## Verification

Acceptance requires synthetic production-shaped tests for complete, absent, partial, and malformed compile-time channel configuration; stable-channel envelope authentication; exact package retrieval from direct HTTPS URLs; atomic Pages staging; protected-workflow permissions; signed and notarized artifact inspection; Gatekeeper assessment; release-manifest and checksum binding; provenance attestation; clean installation; update; interruption recovery; migration; removal; and remote post-publication verification.

The delivery assumptions are grounded in [GitHub's release asset limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), and [GitHub's custom Pages workflow contract](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
