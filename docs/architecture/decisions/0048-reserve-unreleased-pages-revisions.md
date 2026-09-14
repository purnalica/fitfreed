# ADR 0048: Reserve unreleased revisions for exact release Pages deployment

- **Status:** Accepted
- **Date:** 2026-09-14
- **Decision owners:** FitFreed project owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [automation strategy](../../automation-strategy.md), [public release operations](../../development/public-release-operations.md)
- **Refines:** [ADR 0020](0020-compose-product-and-update-pages.md)

## Context

FitFreed publishes the product site and authenticated update channel as one complete GitHub Pages artifact. A normal
source push can compose the current product sources with the active immutable Release, while a protected release
workflow deploys the exact product-and-update snapshot sealed inside its candidate.

During the 0.1.12 Linux expansion, the source push and protected release workflow created different complete Pages
artifacts from the same Git revision. The source workflow preserved the earlier 0.1.7 update snapshot because 0.1.12
was not public yet. The later release workflow contained the correct 0.1.12 snapshot. Both deployments supplied the
same Git revision as their Pages build identity. GitHub reported the second deployment as successful, but the public
origin continued serving the first artifact. Final remote verification correctly rejected that divergence.

Byte-preserving composition prevented either workflow from creating a partial tree, but it could not distinguish two
different complete artifacts that shared one external deployment identity.

## Decision drivers

- One Git revision must identify at most one deployable Pages artifact.
- A release workflow must be able to deploy the exact snapshot sealed with its immutable Release.
- Product-site validation must continue on every applicable source change without publishing unreleased download or
  update state.
- Recovery must reuse immutable Release bytes and the retained exact candidate rather than rebuild them.

## Considered alternatives

### Give the release deployment a synthetic build identity

The pinned GitHub Pages deployment action derives its build identity from the workflow revision. Replacing that input
would require maintaining a divergent deployment action or changing the protected publication topology.

### Permit both workflows to deploy and rely on ordering

Serialization orders the deployments but does not make two distinct artifacts with the same revision identity
unambiguous to the external service. This alternative is rejected.

### Reserve an unreleased revision for the release workflow

The source workflow still validates and composes its complete artifact, but deploys it only when the repository source
version already equals the latest immutable public Release version. An unreleased version therefore leaves its
revision identity available to the exact tagged release workflow. This is the selected alternative.

## Decision

1. The ordinary product-site workflow always renders, validates, and composes the complete Pages artifact for every
   applicable source revision.
2. After authenticating the latest immutable GitHub Release, it compares that Release version with the repository
   package version. It uploads, deploys, and remotely verifies the artifact only when the versions are equal.
3. When the repository version is newer, the workflow ends successfully after validation and composition without
   creating a Pages deployment. The protected exact-tag release workflow is the sole deployment owner for that
   unreleased revision.
4. A later source revision whose package version equals the public Release may deploy product-site changes together
   with the authenticated active update snapshot. Its distinct revision provides a distinct Pages build identity.
5. Release-before-Pages ordering, immutable Release bytes, complete-tree composition, serialized deployment,
   preflight byte preservation, and final remote byte verification remain mandatory.

## Consequences

### Positive

- Distinct Pages artifacts cannot compete under one Git revision identity.
- Exact release snapshots retain an unambiguous deployment path.
- Product-site checks remain continuous without publishing an unreleased channel.
- Recovery after immutable publication can deploy current Release bytes from a new source revision and then rerun only
  the failed remote verifier.

### Negative

- Product-site changes committed while the repository version is ahead of the public Release are validated but not
  deployed until the release workflow or a later public-version revision publishes them.
- A successful product-site workflow may intentionally contain no deployment job execution; its composition output
  must be inspected when deployment is expected.

## Verification

Unit tests cover matching, mismatching, and invalid versions. Workflow contract tests require the composition decision
and require upload, deployment, preflight, and remote verification to share its guard. Acceptance still requires the
public stable envelope, every current and recovery package, and every product-site object to match the exact expected
bytes with redirects disabled.
