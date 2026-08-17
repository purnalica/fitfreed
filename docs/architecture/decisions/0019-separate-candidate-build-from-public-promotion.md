# ADR 0019: Separate candidate build from public promotion

- **Status:** Accepted
- **Date:** 2026-08-18
- **Supersedes:** [ADR 0018](0018-publish-through-one-protected-evidence-pipeline.md)
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [public release operations](../../development/public-release-operations.md)

## Context

ADR 0018 protected credentials and publication inside one approved build-and-publish job. That ordering proved the final signed and notarized bytes objectively, but the environment approval happened before those bytes existed. The candidate therefore could not complete the required independent keyboard, VoiceOver, scaling, realistic-usability, installation, update, and recovery evaluation before the same job made it public.

Rebuilding after evaluation would not preserve the exact candidate: code-signing timestamps and notarization can produce different bytes from the same source. A second workflow could retrieve a prior run, but it would add cross-run selection and authorization state where GitHub already provides a same-run job dependency and protected-environment gate.

## Decision

The public workflow has five ordered jobs:

1. Secret-free preflight verifies the exact tag, source, channel, hosted checks, Pages, immutable-release setting boundary, and protected environment policy.
2. `build-candidate` uses the first `public-macos-release` approval to access Apple and updater authority. It prepares and verifies the signed candidate but has read-only repository permission and no release, attestation, or Pages write authority.
3. The build packs only the candidate's closed `release/` and `pages/` trees into one transport archive, records its SHA-256 digest as a job output, retains it for seven days, and unconditionally removes signing and notarization authority.
4. `publish-candidate` waits at the same protected environment for a second approval. During that wait, an evaluator downloads and tests the sealed artifact. Promotion receives no Apple or updater credential, downloads only that run's named artifact, checks the job-bound digest, safely reopens the complete candidate, and only then attests and publishes it.
5. Pages deployment follows the immutable GitHub Release, and secret-free remote verification follows Pages.

The promotion reviewer approves only after the versioned manual procedure passes on the sealed bytes and the signed channel statement remains within its seven-day validity window. A failed or expired evaluation cancels promotion; it never causes the archive, manifest, signature, or release assets to be edited.

## Alternatives considered

### Treat pre-build environment approval as release acceptance

Rejected because it authorizes credentials and an unknown future output, not the exact candidate required by the product acceptance criteria.

### Rebuild after a separately evaluated package

Rejected because the rebuilt signed and notarized bytes need not match the evaluated package even at the same source revision.

### Publish a draft and evaluate its assets before making it public

Rejected because a partial draft introduces remote mutable state and recovery authority before evaluation. The private Actions artifact provides a smaller, digest-bound candidate boundary.

### Use a separate promotion workflow

Rejected for the first release because selecting and authenticating an artifact across runs adds more mutable operator input than a same-run dependency. A future long-duration evaluation need may revisit this only with an equally exact artifact-identity and expiry contract.

## Consequences

- Signing authority and publication authority cannot coexist in one job.
- Two protected deployments and approvals are visible in the same workflow run.
- The evaluator receives the exact public-shaped application and evidence without making it a Release or update endpoint.
- The candidate expires with its seven-day signed channel window and seven-day Actions retention; delayed evaluation requires a fresh candidate.
- Re-running only failed downstream jobs can recover a Release-before-Pages failure without rebuilding immutable bytes.
- A complete workflow rerun after immutable publication is not a recovery mechanism.

## Verification

Versioned transport automation verifies the complete candidate before packing, rejects existing output, permits only the closed `release/` and `pages/` roots, binds extraction to the exact SHA-256 job output, reopens all evidence after extraction, and removes partial destinations on failure.

The workflow policy checker requires two protected jobs, read-only build permissions, unconditional authority cleanup, retained sealed evidence, digest-bound promotion, no protected secrets in promotion, Release-before-Pages ordering, full action pins, and the final secret-free remote gate. Actionlint validates workflow syntax, and synthetic tests cover successful transport, byte mutation, unsafe entries, approval bypass, digest bypass, and job-order drift.
