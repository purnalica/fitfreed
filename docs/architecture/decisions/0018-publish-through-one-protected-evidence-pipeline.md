# ADR 0018: Publish through one protected evidence pipeline

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [ADR 0017](0017-split-public-download-and-update-hosting.md)

## Context

The split delivery topology needs one accountable operation across Apple signing and notarization, GitHub artifact attestations, an immutable GitHub Release, and the direct GitHub Pages update snapshot. These systems do not provide one cross-service transaction. Publishing Pages first could announce an update before its human-facing download and evidence record exists. Publishing a Release first can leave the prior update channel active if Pages later fails, which is incomplete but does not expose an unavailable update to installed applications.

GitHub protects environment secrets only after its environment rules pass. A workflow that merely names an absent environment can cause GitHub to create it without the intended protections. A tagged source can also differ from its local or remote main history, and a successful check on another revision is not release evidence. The pipeline therefore needs independent policy inspection before secrets become available.

## Decision

The first public macOS release uses one manually dispatched, exact-tag-bound workflow with four ordered jobs.

1. A secret-free Linux preflight verifies the canonical public repository, exact local and origin tag, source reachability from `origin/main`, active stable trust, versioned release policy, self-review-resistant protected environment rules, Actions-backed HTTPS Pages configuration, and successful CI plus repository-safety push runs for that exact revision.
2. A GitHub-hosted Apple Silicon job enters `public-macos-release` only after preflight and reviewer approval. It independently requires repository release immutability, materializes Apple and updater authority in a private runner directory, imports the certificate into an ephemeral keychain, repeats preflight, builds, notarizes, staples, objectively inspects, and assembles the closed candidate.
3. The protected job attests every checksum subject and `SHA256SUMS`, uploads the still-private Pages artifact, creates or validates an exact GitHub Release draft, verifies provenance, and only then publishes it. Publication must immediately report an immutable release with the exact final names, sizes, and SHA-256 digests.
4. A separate `github-pages` job deploys the already-uploaded two-file snapshot. A final secret-free job downloads the immutable Release, revalidates its complete distributed evidence and attestations against the exact workflow, source ref, and revision, then retrieves both direct Pages objects without redirects until their final bytes converge or a bounded deadline expires.

All third-party action references are full commit hashes from a closed allowlist. The workflow has no automatic trigger, does not cancel an active release, and uses job-specific minimum permissions. Apple certificate material, App Store Connect private authority, updater private authority, and passwords are neither workflow inputs nor repository files. Cleanup restores the runner keychain state and removes materialized authority even after failure.

Release immutability is verified before Apple work with a fine-grained, repository-scoped Administration-read token held by the protected environment. GitHub's job token retains the separate `contents: write` publication authority. This prevents a broad personal publication token from becoming the release writer.

## Consequences

### Positive

- Untrusted or automatic events cannot reach signing or publication authority.
- A green check from another commit, an unpushed tag, a legacy Pages source, or an implicit environment cannot authorize a release.
- Attestations bind final signed bytes to the exact tagged workflow execution before public promotion.
- A Pages deployment failure leaves the authenticated installed-application channel on its previous complete snapshot.
- Post-publication verification consumes public bytes rather than trusting local staging claims.

### Negative

- The operation depends on two protected GitHub environments and one additional read-only administrative credential.
- GitHub Release and Pages cannot be made atomically visible as one transaction.
- A failure after immutable Release publication but before Pages deployment needs an explicit resume procedure; immutable assets cannot be replaced.
- Real Apple trust and remote publication behavior cannot be accepted with synthetic local credentials.

### Failure boundaries

- Failure before Release publication leaves no new public binary or update snapshot. A complete draft may remain private to maintainers for diagnosis.
- Failure after Release publication but before Pages deployment leaves a downloadable immutable release while installed applications continue using the previous stable snapshot.
- Failure after Pages deployment leaves signed metadata and independently authenticated package bytes public, but the release remains unaccepted until remote verification passes.
- A full workflow rerun must never overwrite an existing draft or public asset. Recovery either resumes the exact retained evidence or follows the documented withdrawal procedure.

## Verification

Versioned tests reject automatic triggers, moving action references, cancellation, unprotected jobs, misplaced secrets, permission loss, reordered promotion, non-final cleanup, missing exact-revision checks, release mutation, provenance mismatch, redirects, byte divergence, and partial Pages convergence. Hosted acceptance additionally requires the protected environments, release immutability, active public trust, exact tag, production credentials, Apple trust, publication authority, and successful remote verification.

The platform assumptions follow GitHub's documentation for [protected environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [immutable releases](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes), [artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), and [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
