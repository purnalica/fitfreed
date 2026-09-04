# ADR 0046: Separate Windows candidate build and admission hosts

- **Status:** Accepted
- **Date:** 2026-09-04
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [Milestone 5 plan](../../plans/milestone-5.md)

## Context

The public Windows input needs Authenticode authority, while candidate acceptance must establish that the exact final
setup behaves correctly on a supported Windows 11 consumer desktop. The
[standard GitHub-hosted runner catalogue](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
offers x86-64 Windows Server labels and a Windows 11 ARM label, but no Windows 11 x86-64 label. Server results are
valuable engineering evidence but cannot establish the promised Windows 11 desktop boundary. GitHub explicitly
supports Windows 11 x86-64 for [self-hosted runners](https://docs.github.com/en/actions/reference/runners/self-hosted-runners).

Using one long-lived self-hosted machine for both signing and admission would mix protected authority, build residue,
candidate installation state, and supposedly independent acceptance. It would also make the product support claim
depend on undocumented operating-system assumptions that change as Microsoft release servicing evolves.

The production executable intentionally excludes WebDriver capability. Full automated UI behavior therefore requires
a source-matched isolated test package, while native trust and installation must operate on the exact public setup.
Neither evidence type can silently stand in for the other.

## Decision drivers

- Test the supported Windows 11 consumer boundary rather than relabeling Windows Server evidence.
- Keep Authenticode authority outside the independent candidate-admission environment.
- Make time-sensitive Windows release support an explicit, reviewable, fail-closed policy.
- Retain useful admission evidence without retaining machine, account, or filesystem identity.
- Preserve exhaustive automated functional evidence without adding test control surfaces to a production binary.

## Considered alternatives

### Treat the GitHub-hosted Windows Server lane as Windows acceptance

This is repeatable and inexpensive, but it does not exercise the operating-system family promised to users. Server
success remains engineering evidence only.

### Build and admit on one protected Windows 11 runner

This can exercise the correct operating system, but signing authority and build residue remain present while the same
machine claims independent acceptance. Cleanup assertions reduce residue but do not create an independent boundary.

### Use separate disposable Windows 11 build and admission runners

One protected runner owns native signing and sealed input creation. A different authority-free runner reopens the
complete candidate and executes exact native admission. A versioned policy matches public operating-system facts to
the Microsoft servicing state reviewed near candidate issuance.

## Decision

The public Windows expansion uses two separately labeled, disposable, x86-64 Windows 11 runner boundaries.

- `fitfreed-windows-11-builder` runs only the protected native-input job under `public-windows-release`. The
  environment supplies the certificate bundle, password, independently admitted public fingerprint, and timestamp
  endpoint. The fingerprint is not selectable through workflow dispatch.
- `fitfreed-windows-11-admission` runs without a protected environment, secret, signing key, or publication
  permission. It receives only the exact sealed candidate and public evidence from the same workflow run.
- Each runner is provisioned from a reviewed clean Windows 11 x86-64 image for one job, registered only with its exact
  label and repository scope, and destroyed or reverted after unconditional cleanup. A personal workstation or a
  reusable general-purpose self-hosted runner is not an admission environment.
- `release/windows-candidate-admission.json` lists the reviewed supported release, base-build, edition, and servicing
  rows. Candidate issuance rejects a policy older than 45 days, a release already outside support, and any host that
  is not x86-64 Windows 11 Client workstation or does not match exactly one row.
- Retained host evidence contains only public Windows release facts and closed gate results. Machine name, account,
  network identity, local path, and SignTool path are excluded.
- Exact production setup admission owns Authenticode, current-user installation, installed-file identity,
  data-preserving removal, and cold launch. A separately built source-matched isolated package owns exhaustive UI,
  localization, accessibility, restart, update-recovery, and performance automation because the production package
  contains no WebDriver capability.
- Product-experience judgment remains a distinct human gate under `public-windows-product-acceptance`, after Linux and
  Windows technical admission and before a separate publication approval.

## Consequences

### Positive

- The Windows 11 support statement rests on native consumer-desktop evidence.
- Candidate admission cannot use or leak Authenticode authority.
- Lifecycle drift becomes an explicit review failure instead of an undocumented environment change.
- Production packages remain free of E2E control surfaces while complete behavior stays automated.
- Retained evidence is privacy-safe and meaningful outside the machine that produced it.

### Negative

- The first Windows publication requires two ephemeral Windows 11 x86-64 environments that GitHub does not currently
  provide as standard hosted runners.
- Provisioning, one-job registration, clean-image reversion, and teardown remain accountable operational gates.
- Exact package and source-matched behavioral evidence are separate results that must both pass for the same revision.

### Risks and mitigations

- A persistent public-repository runner could execute unrelated work. Only ephemeral, repository-scoped, custom-label
  registration is admissible; the workflow remains inactive until the runner boundary is reviewed.
- A stale support table could admit an obsolete release. The versioned policy expires 45 days after review and rejects
  servicing dates before issuance.
- Behavioral tests could accidentally be presented as exact-package evidence. The workflow names and verifies the two
  package identities separately and requires the sealed production setup for every native trust transition.
- Environment approval could be mistaken for product acceptance. The product gate is reachable only after technical
  admission, and its procedure records a separately completed bounded evaluation against those exact candidate bytes.

## Verification

Static workflow tests reject automatic triggers, unpinned actions, unreviewed runner labels, certificate selection by
dispatch, missing transport digests, protected admission, skipped cleanup, and promotion before technical and human
acceptance. Policy tests reject stale, malformed, unsupported, ended, unordered, and privacy-expanded evidence.

The first public Windows candidate must additionally pass on the provisioned native hosts: protected signed-input
creation and cleanup; complete candidate reopening; exact Windows 11 host admission; setup and installed Authenticode
trust; current-user installation, launch, removal, and data preservation; source-matched packaged E2E; update recovery;
filesystem reliability; performance budgets; and the bounded product-experience review. No synthetic or Windows
Server result closes those gates.
