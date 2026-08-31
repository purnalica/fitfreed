# ADR 0038: Isolate confidential provider OAuth from the desktop application

- **Status:** Proposed
- **Date:** 2026-08-30
- **Decision owners:** FitFreed product owner and maintainers
- **Related requirements:** [FR-024](../../requirements.md#fr-024--incremental-connected-provider-synchronization),
  [NFR-002](../../requirements.md#nfr-002--privacy-of-reference-data), and
  [NFR-022](../../requirements.md#nfr-022--vendor-neutral-domain-and-application-core)
- **Related architecture:** [Connected provider synchronization](../connected-provider-synchronization.md) and
  [source integration](../source-integration.md)

## Context

Polar AccessLink v4 documents OAuth authorization-code and refresh-token exchanges authenticated with a registered
client identifier and client secret. The public documentation reviewed on 2026-08-30 does not document PKCE, device
authorization, or another public native-client flow. A secret shipped in a GPL desktop binary is public and therefore
cannot authenticate FitFreed as a confidential client.

The connection is optional and the product is local-first. A solution must not turn FitFreed into a hosted fitness
data service, force every user to become an API developer, or place provider credentials in the repository, desktop
binary, frontend, logs, backups, or portable exports.

The decision remains proposed because project-side review must first establish that the published client contract
admits a GPL client and the selected native redirect and token-exchange topology, and the product owner must accept the
operational responsibility of a minimal public broker. Provider assistance is not an implementation dependency. If
Polar documents a public-client PKCE flow, that simpler topology takes precedence.

## Decision drivers

- Preserve the confidentiality of provider client credentials.
- Keep fitness records and library queries between the provider and the person's device.
- Provide a normal consent experience without requiring user-owned developer credentials.
- Minimize retained server state, breach impact, telemetry, and operational coupling.
- Keep authorization replaceable per provider and outside the application and domain core.

## Considered alternatives

### Embed the registered client secret in the application

Any user or automated scanner can recover it from the binary or source. Rotation would also couple every installed
version to one leaked credential. This does not satisfy the provider's confidential-client contract.

### Require every person to register a provider client

This avoids a FitFreed secret but turns ordinary connection into developer administration and agreement acceptance.
It may remain a contributor-only diagnostic path, but it is not the supported product experience.

### Centralize tokens and synchronization in a FitFreed service

This simplifies background synchronization but creates accounts, long-lived credential custody, a personal fitness
data processor, remote availability dependency, deletion workflows, and a materially different threat model. It
conflicts with the local-first product boundary.

### Use a minimal secret-isolating OAuth broker

The broker can protect the confidential client secret while leaving tokens in operating-system protected desktop
storage and sending fitness data directly from Polar to the desktop. Its narrow function can be independently audited
and replaced if the provider later supports public native clients.

## Proposed decision

Use a documented public-client PKCE flow when Polar provides one. Otherwise, and only when published-contract review,
security review, and product authority accept the boundary, operate a minimal open-source OAuth broker with these
invariants:

- it performs only authorization-code and refresh-token exchanges;
- it validates exact redirects, state, expiry, one-use handoff, and the requesting desktop's ephemeral key;
- it returns an encrypted one-use token envelope and deletes transient exchange state;
- it never receives archives, provider API data, canonical history, routes, samples, reports, or library queries;
- it retains no access or refresh token and emits no credential-bearing logs or diagnostics;
- the desktop stores tokens only in the operating-system credential store and calls provider data endpoints directly;
- requested scopes are capability-specific and scope expansion requires renewed visible consent; and
- provider-specific authorization remains behind an infrastructure port so another provider can use PKCE, device
  authorization, or a different approved mechanism without changing the core.

## Consequences

### Positive

- The client secret is absent from public source and desktop artifacts.
- Personal fitness data remains provider-to-device rather than passing through FitFreed infrastructure.
- Ordinary users receive a supported connection flow rather than developer setup.
- A later provider-native PKCE flow can remove the broker without changing ingestion or reconciliation.

### Negative

- FitFreed acquires a small but security-critical hosted component and its availability, monitoring, deployment, abuse
  protection, incident response, and privacy documentation.
- Refresh-token exchange still exposes the token transiently to the broker unless Polar provides another approved
  mechanism.
- Connection cannot ship until published-contract eligibility, product risk acceptance, and independent security
  review close.

### Risks and mitigations

- **Broker compromise:** no persistent tokens or fitness data, encrypted one-use handoff, minimal code, strict egress,
  rotation, external audit, and revocation procedures bound impact.
- **The published contract does not admit the topology:** keep the feature unavailable; do not embed the secret or
  silently fall back to user developer credentials.
- **Broker outage:** local history remains usable and refresh reports factual staleness.
- **Terms change:** automated monitoring blocks new authorization until the change is reviewed.

## Verification

Acceptance requires a dated project-side determination of eligibility under the published provider contract,
product-owner approval of the hosted boundary and residual risk, threat modeling, independent security review,
protocol tests for replay and redirect attacks, secret scanning of every public artifact, proof that no fitness
response reaches the broker, packaged consent and disconnect E2E evidence, and a documented shutdown and
token-revocation exercise. A documented provider public-client flow supersedes the broker path before implementation
when available.
