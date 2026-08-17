# ADR 0008: Authenticate update policy above the Tauri updater

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Update trust](../update-trust.md), [release delivery](../release-delivery.md)

## Context

The private macOS alpha must discover and install updates without accepting metadata or an application package whose origin and integrity cannot be verified. Update discovery must not transmit library, account, health, location, locale, or usage data. A failed replacement or library migration must not strand the person with an unusable application or unreadable library.

Tauri's official updater supports macOS, Windows, and Linux, requires a signature for every update package, and does not permit artifact-signature verification to be disabled. Its static feed carries a version, package URL, and package signature; those feed fields and optional release notes are not themselves covered by the package signature. A party able to alter only the feed could therefore change policy or pair a trusted old package with an invented higher version even though it could not create a newly signed package.

No private-alpha endpoint, production update key, participant distribution, or uploaded package is currently authorized. This decision defines the trust and recovery boundary before any such external resource exists.

## Decision drivers

- Both metadata and package bytes require authenticated origin and integrity.
- The application must reject metadata replay, equivocation, downgrade, expiry, incompatible application baselines, and incompatible library schemas before download or installation.
- Release notes, withdrawal guidance, and compatibility policy are security-relevant metadata and must be signed.
- Tauri's maintained cross-platform installer should remain responsible for native package verification and replacement.
- A private-alpha implementation must not embed a synthetic key as production trust or require a live service for offline use.
- Recovery must preserve application binaries and library state as separate assets.

## Considered alternatives

### Use the standard Tauri updater feed as the complete contract

This retains the smallest integration and benefits from Tauri's mandatory package signature. It does not authenticate release notes, withdrawal state, compatibility policy, digest, or the association between the announced version and signed package. HTTPS protects transport to an authenticated server but does not make the downloaded feed a durable signed release statement or provide replay state. It does not satisfy the FitFreed metadata requirement.

### Add a FitFreed signed envelope above the Tauri updater

An application-owned payload can sign all policy and package expectations as exact bytes while retaining the Tauri-compatible outer fields. The application verifies the envelope, policy, and exact equality of the duplicated Tauri fields before allowing Tauri to download. Tauri then verifies its mandatory package signature, and FitFreed verifies the signed size and SHA-256 digest before installation. This introduces one versioned contract and replay state but preserves the maintained native installer.

### Adopt a full update-framework repository

A framework such as TUF adds threshold signatures, delegated roles, separate root rotation, and standardized rollback and freeze protection. Those properties are valuable for a multi-maintainer public distribution system, but adopting the repository roles, client state, ceremonies, hosting, and Tauri bridge now would create a second distribution platform before FitFreed has a production signing authority or endpoint. The operational system would dominate the private-alpha increment without removing the need for Tauri package installation and application-specific library recovery.

## Decision

FitFreed will use the signed-envelope alternative.

- The endpoint response is a closed Tauri static-feed object with a FitFreed envelope. The outer `version`, `platforms`, package URLs, and Tauri signatures are transport mirrors and remain untrusted until verification completes.
- The envelope identifies a trusted key and carries an exact UTF-8 JSON payload as Base64 plus a Minisign Ed25519 signature. Verification covers the decoded payload bytes, not a parsed-and-reserialized JSON value.
- The payload signs its format and schema versions, `private-alpha` channel, monotonically increasing sequence, issue and expiry times, release version, minimum supported application version, readable and target library-schema versions, localized release notes, per-platform URL, byte size, SHA-256 digest, Tauri package signature, and withdrawn versions with localized guidance.
- One protected release-signing authority signs both the metadata payload and each Tauri update package. Each object has its own signature and signed bytes. A key identifier permits an application release to trust an overlap of old and new public keys during planned rotation. Losing or compromising the private key requires a release-security response and cannot be repaired by changing an endpoint.
- A static HTTPS endpoint is requested without current version, locale, library schema, installation identifier, or usage parameters. Installed version, target, architecture, library compatibility, and locale selection are evaluated locally. The HTTP client sends no FitFreed account, library, or usage headers and stores no cookies.
- The configured updater exposes every signed snapshot to the application policy, including an equal or older latest release. Only the application policy decides whether the candidate is newer and compatible. Normal updates never install a SemVer downgrade. A functional rollback is delivered as a newer version containing reverted code.
- A lower sequence is rejected as replay. The same sequence and payload digest are idempotent; the same sequence with a different digest is rejected as equivocation. Expired metadata is rejected. The accepted sequence and digest survive restart.
- A withdrawn installed version produces persistent guidance that cannot be dismissed as an ordinary update. Installation remains an explicit action; this decision does not introduce forced updates. A withdrawn candidate is never installed. Any future mandatory-action policy remains a product decision.
- Dismissal and postponement apply only to a verified, non-withdrawn candidate and are local preferences. A higher sequence, different candidate, or withdrawal supersedes them.
- Before package replacement, FitFreed preserves and verifies a recovery copy of the current application and a consistent library backup. The Tauri updater verifies the package signature during download; FitFreed additionally verifies the signed size and SHA-256 digest before installation. A pending-update record coordinates first-launch library migration and an external recovery watchdog. Failure to replace, launch, migrate, or confirm the new application restores both assets to their matching prior versions.
- No real updater is active when the endpoint or production public key is absent. Synthetic keys and endpoints are available only to tests and instrumented packages. Production channel configuration, protected private-key use, package upload, participant distribution, and withdrawal are separate human authority gates.

The normative wire contract is [update channel version 1](../../data-formats/release/update-channel-v1.md). Current runtime and recovery responsibilities are described in [update trust architecture](../update-trust.md).

## Consequences

### Positive

- Release policy, release information, and package expectations share one authenticated statement.
- A compromised cache or endpoint cannot invent a trusted release, alter guidance, substitute a differently signed old package as a higher version, or silently relax compatibility.
- Tauri continues to own maintained native package verification and replacement instead of FitFreed creating a platform installer.
- Static discovery minimizes transmitted technical information and preserves normal offline use.
- Application rollback and library rollback are coordinated without treating either as a substitute for the other.

### Negative

- Release preparation must generate, sign, validate, and publish one additional contract.
- Some Tauri feed fields are duplicated inside signed bytes and require exact equality checks.
- A recovery watchdog and persistent pre-update evidence are required around Tauri's native replacement operation.
- One signing authority is a deliberate private-alpha operational simplification; it does not provide threshold trust or delegated release roles.

### Risks and mitigations

- A compromised signing key could authorize both metadata and packages; protected release environments, key identifiers, overlap rotation, and an explicit compromise procedure mitigate the single-authority risk. A public distribution may replace this model with threshold trust.
- A frozen but still valid snapshot can delay discovery; a maximum 14-day validity interval and persistent sequence state limit that window. Offline use remains available after expiry, but installation does not.
- Restoring an old copy of the entire application library outside FitFreed can also restore older replay state; expiry still limits accepted snapshots. Strong rollback resistance against an attacker who controls local storage and the system clock is outside the private-alpha threat boundary.
- Tauri's native replacement could fail after moving the current bundle; FitFreed keeps its own verified recovery copy outside Tauri's temporary backup and tests interruption at each owned boundary.

## Verification

Acceptance requires machine-readable envelope and payload schemas, valid and invalid synthetic contract examples, exact-byte Minisign verification, unknown-key and invalid-signature rejection, mirror mismatch, oversize, expiry, replay, equivocation, downgrade, withdrawal, application-baseline, library-schema, digest, and size tests. Persistence tests must prove idempotent high-water state, dismissal, postponement, and restart behavior.

Release-shaped macOS tests must update between distinct synthetic application versions, preserve locale and library content, interrupt download and replacement, reject a tampered package, recover from failed launch and migration, and prove removal keeps the library. The updater remains unconfigured in an ordinary production build until a real endpoint and protected public trust configuration are explicitly supplied. Reconsider this decision before public distribution if multiple release authorities, threshold signatures, offline root rotation, or delegated channels become requirements.
