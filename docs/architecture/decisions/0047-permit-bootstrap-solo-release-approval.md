# ADR 0047: Permit solo-maintainer release approval during bootstrap governance

- **Status:** Accepted
- **Date:** 2026-09-09
- **Decision owners:** FitFreed project owner
- **Related requirements:** [Product requirements](../../requirements.md), [governance](../../../GOVERNANCE.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [public release operations](../../development/public-release-operations.md)
- **Refines:** [ADR 0019](0019-separate-candidate-build-from-public-promotion.md)

## Context

FitFreed has one active maintainer during its bootstrap stage. The release pipeline requires two distinct protected
deployments: one admits production signing authority to build a sealed candidate, and a later one authorizes
publication of the exact evaluated bytes. The original environment policy also prevented the workflow initiator from
approving either deployment, which made a second GitHub user mandatory even though no second maintainer currently
holds accountable release responsibility.

That person-level separation would block the first public release. A second account controlled by the project owner
would satisfy the GitHub setting without providing independent judgment, while an uninvolved nominal reviewer would
add ceremony without accountable product or release knowledge. Removing protected approvals entirely would instead
collapse valuable decision boundaries around production credentials and irreversible publication.

This decision changes who may approve during bootstrap governance. It does not change candidate identity, signing,
notarization, platform admission, product evaluation, immutable publication, update trust, or remote verification.

## Decision drivers

- The bootstrap project must be releasable by its only accountable maintainer.
- A control must express real accountability rather than encourage a nominal or duplicate-account reviewer.
- Production signing and public promotion must remain separate, explicit decisions.
- Future governance must be able to restore person-level separation without redesigning the release pipeline.

## Considered alternatives

### Require a distinct reviewer before the first release

This provides person-level separation but is not currently operable. It would make an unavailable role, rather than
product or release evidence, the blocking dependency.

### Remove protected environment approvals

This would let a dispatch proceed directly into production authority and publication. It is rejected because it
removes both the credential-admission decision and the exact-candidate promotion decision.

### Permit accountable self-review during bootstrap

The only active maintainer remains the required environment reviewer and may approve a deployment they initiated.
The two protected deployments, intervening candidate evaluation, restricted job permissions, and all objective gates
remain unchanged. This is the selected alternative.

## Decision

While FitFreed uses the bootstrap governance model:

1. Every release environment requires at least one explicitly configured reviewer, permits the workflow initiator to
   approve, disables administrator bypass, and admits only `v*` tags through its custom deployment policy.
2. Candidate construction and public promotion remain separate protected deployments. The same accountable release
   owner may approve both, but promotion may be approved only after the exact sealed candidate has passed its
   applicable automated admission and product evaluation.
3. The Windows product-acceptance environment follows the same bootstrap reviewer policy. Its responsibility remains
   distinct from Windows signing authority and from the later publication decision even when one person performs the
   accountable approvals.
4. Appointing another user as a nominal reviewer or using another account controlled by the same person is not a
   substitute for future independent governance.
5. Person-level separation will be reconsidered through an explicit governance decision when at least two active
   maintainers can assume release responsibility. It does not activate automatically and must not be represented as
   present until a superseding decision and matching environment configuration exist.

## Consequences

### Positive

- One accountable maintainer can execute the documented public release path.
- Both irreversible decisions remain visible and deliberate.
- The candidate evaluated before promotion remains byte-identical to the candidate that is published.
- Future independent approval can reuse the existing two-deployment architecture.

### Negative

- The same person can authorize credential use and publication, so the bootstrap process lacks person-level
  separation of duties.
- Compromise or error affecting the sole maintainer account has a larger governance impact.

### Risks and mitigations

- Account compromise is mitigated by protected environment secrets, disabled administrator bypass, tag-only
  admission, ephemeral authority installation, restricted job permissions, immutable Releases, and remote byte
  verification.
- Premature promotion is mitigated by a separate second deployment, exact candidate transport binding, mandatory
  automated admission, explicit product evaluation, and the seven-day candidate validity window.
- The provisional policy becoming permanent by accident is mitigated by recording it in governance and requiring an
  explicit superseding decision when a second accountable maintainer exists.

## Verification

The secret-free preflight rejects an environment without a configured reviewer, with administrator bypass, with
self-review prevention enabled during bootstrap, or with any deployment policy other than the single `v*` tag rule.
Workflow contract tests continue to require distinct protected build and promotion jobs, exact sealed transport,
authority cleanup, admission before promotion, and secret-free remote verification.
