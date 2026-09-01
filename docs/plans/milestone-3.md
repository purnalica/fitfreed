# Milestone 3 Execution Plan

## Status

Active as of 2026-08-18. The pre-intervention Milestone 2 capability and Milestone 3 engineering baselines are complete. Source `3f462add258f8bf4b233c3f99cb6f97559c8e3fe` passed the complete local campaign, [hosted continuous integration](https://github.com/purnalica/fitfreed/actions/runs/32084588520), and [repository safety](https://github.com/purnalica/fitfreed/actions/runs/32084588507) with production trust deliberately inactive. The accepted E1–E6 experience scope and ADR 0020 Pages compositor reopen final release readiness without invalidating that historical evidence. The milestone also remains open for production authority, protected GitHub configuration, the exact signed and notarized candidate, human evaluation, and public publication.

## Objective

Deliver the evaluated FitFreed MVP to Apple Silicon users on macOS 15.0 or later through a signed, notarized, integrity-verifiable, recoverable, documented, and supportable public distribution path.

The milestone is complete only when one exact public candidate passes every automated and human release gate. Implementing a workflow, generating an unsigned DMG, or obtaining an Apple credential is not independently sufficient evidence.

## Scope protection

This plan adds public macOS distribution to the implemented MVP. It does not add product analytics, new data domains, another provider, Intel support, Linux, Windows, an application server, forced updates, telemetry, a custom domain, or a general release platform.

Public macOS release begins a product-wide functional scope lock rather than opening post-MVP feature growth. The
same accepted capability baseline proceeds next to Linux and then Windows under the roadmap's Milestones 4 and 5.
Only defect, security, compatibility, platform-integration, distribution, accessibility-parity,
localization-parity, and required documentation work may change the baseline before all three public platform
releases exist.

No unsigned binary may enter a public channel. No production private key, password, certificate export, API key, personal account value, private export, application library, or machine-local path may enter Git, GitHub artifacts, logs, Pages, or Releases.

## Increment M3.1 — Executable platform boundary

**Status:** implementation and hosted engineering acceptance complete. The exact public candidate must preserve and reverify this boundary.

**Outcome:** the public macOS target is stated and enforced consistently as Apple Silicon on macOS 15.0 or later.

**Work:**

1. Record the minimum-version decision and its maintained evidence environment.
2. Set Tauri's minimum macOS version and verify both bundle metadata and Mach-O deployment target.
3. Keep public documentation, release contracts, and the hosted Apple Silicon runner aligned.

**Acceptance evidence:** [ADR 0016](../architecture/decisions/0016-support-apple-silicon-on-macos-15-or-later.md), release-contract tests, production bundle inspection, local packaging, and the complete hosted macOS campaign pass for one source revision.

## Increment M3.2 — Public channel and embedded trust

**Status:** implementation and hosted engineering acceptance complete with production trust deliberately inactive. Production-key activation and exact-candidate acceptance remain separate gates.

**Outcome:** a public production build can discover only an authenticated stable channel through a direct privacy-minimizing HTTPS endpoint, while ordinary builds remain deliberately unconfigured.

**Work:**

1. Define version 2 of the update envelope and payload for the public `stable` channel without rewriting the closed private-alpha version 1 contract.
2. Make the verifier select an explicit supported contract and reject cross-channel or cross-version metadata.
3. Add compile-time production endpoint and public-key configuration with all-absent, all-complete, and fail-closed partial states.
4. Keep E2E-only roots and endpoints isolated from ordinary and public builds.
5. Generate and validate one atomic Pages staging tree containing the signed stable envelope and exact versioned updater package.
6. Exercise the complete stable path with synthetic keys and local TLS through the packaged application.

**Acceptance evidence:** schema, exact-byte signature, configuration, transport, package, replay, expiry, withdrawal, privacy, packaged-update, atomic-staging, repository-content, and secret-scan tests pass. No production private key or live channel is created by this increment.

Local evidence on 2026-08-17: both closed update-channel schemas and the public build-configuration schema passed valid, invalid, and cross-channel contract checks. Rust tests authenticated stable version 2 while rejecting private-alpha version 1 under stable trust and vice versa; ordinary, partial, invalid, stable, rotation, and instrumented configuration boundaries passed. Automation staged only `updates/stable.json` and its exact versioned package, preserved the prior snapshot when signing failed, and rejected a signing key outside the active public trust set. The packaged Apple Silicon journey used local TLS and fresh synthetic Minisign keys to install 0.2.0 over 0.1.0 through the stable version 2 contract, then deliberately rejected candidate startup and restored the matching 0.1.0 application and library. Both scenarios passed through the production updater and recovery boundaries. The versioned public configuration remains `inactive`, contains no key, and creates no live endpoint or publication.

## Increment M3.3 — Signed, notarized release automation

**Status:** the update-only engineering baseline, local acceptance, and exact-source normal CI are complete. ADR 0020 reopens Pages assembly and publication verification so the product site and update snapshot are composed atomically. Production workflow execution remains gated separately by the production trust root, protected GitHub configuration, exact release tag, and explicit public-release authority.

**Outcome:** one manually authorized, exact-tag-bound workflow can build, sign, notarize, staple, inspect, attest, stage, and publish a public candidate without exposing release credentials to untrusted jobs.

**Work:**

1. Extend release evidence with signed/notarized state, minimum macOS version, updater archive and signature, stable-channel snapshot, and provenance subjects.
2. Add a secret-free preflight that verifies version, tag, source, upgrade matrix, notes, configuration, action pins, permissions, and protected-environment prerequisites.
3. Build with Developer ID hardened-runtime signing, submit with supported Apple notarization credentials, staple tickets, and verify `codesign`, `spctl`, and `stapler` results.
4. Generate checksums and SBOMs from the final signed bytes, attest every public subject, and reject any post-verification mutation.
5. Prepare GitHub Release and Pages deployment inputs without automatically publishing them in normal CI.
6. Seal the exact candidate for independent evaluation, publish only after a second protected-environment approval, then verify remote bytes and the direct stable endpoint before accepting promotion.

**Acceptance evidence:** all preparation and inspection behavior passes with synthetic or ad-hoc test identities where Apple permits it; the exact public candidate additionally requires a real Developer ID, successful Apple notarization, Gatekeeper acceptance, protected-environment execution, provenance, and remote byte verification.

Local evidence on 2026-08-18: the complete fast lane passed 115 automation tests, 51 presentation tests, 2 bounded-updater tests, 162 desktop-host tests, 52 application tests, 6 domain tests, and 2 private-reference acceptance predicate tests. The workflow passed its closed topology and permission contract plus pinned `actionlint` 1.7.12 and ShellCheck 0.10.0 validation. Synthetic release boundaries covered ephemeral authority materialization and cleanup, exact source and tag resolution, immutable asset publication, source-bound attestations, release-link verification, direct non-redirecting Pages convergence, complete distributed-byte reopening, sealed candidate transport, and temporary evidence removal.

Hosted evidence on 2026-08-18: source `3f462add258f8bf4b233c3f99cb6f97559c8e3fe` passed portable checks and the complete Apple Silicon campaign, including clean packaging, one hundred cold launches, full-scale import, Insights performance, update-recovery preparation, installation and failure boundaries, packaged UI behavior, and successful replacement plus forced rollback. The workflow recorded the exact executable-input fingerprint for fail-closed reuse by documentation-only revisions. This evidence does not claim Developer ID, Apple notarization, production updater authority, GitHub environment protection, public publication, or remote production bytes.

## Increment M3.4 — Public operation, user guidance, and readiness

**Status:** engineering preparation, local regression, and hosted documentation acceptance are complete. Version-matched public user guidance, a shared candidate-evaluation procedure, maintainer operations and incident recovery, sealed pre-publication evaluation, and the consolidated readiness ledger are implemented. Exact-candidate automated and human evaluation plus public operation remain acceptance gates.

**Outcome:** users and maintainers can install, verify, update, recover, remove, support, and withdraw a public FitFreed release without hidden project knowledge.

**Work:**

1. Publish version-matched `en-US` and `es-ES` application guidance plus English web documentation for download, Gatekeeper-safe installation, first launch, updates, offline behavior, recovery, data retention, removal, and support.
2. Document key custody, rotation, compromise, release promotion, partial-publication recovery, release withdrawal, Pages rollback, and incident communication.
3. Verify clean installation, first launch, update, migration, interruption recovery, preserved library behavior, and removal from public-release-shaped artifacts.
4. Complete automated keyboard, scaling, appearance, localized update, recovery, and automatable accessibility verification for the exact candidate; keep the product-owner review limited to experience quality and schedule separate specialist judgment only for irreducibly subjective accessibility properties.
5. Consolidate Milestone 2 deferred gates and Milestone 3 release gates into one readiness ledger with no implicit closure.

**Acceptance evidence:** the exact candidate has complete hosted automation, real Apple trust evidence, public-channel evidence, version-matched user and maintainer documentation, and completed human evaluation. Every applicable readiness row is passed; no open or unauthorized gate is described as complete.

## Human intervention boundary

Engineering continues without an Apple account or production release key. Final acceptance alone requires:

- Apple Developer membership, an authorized Developer ID Application identity, and an App Store Connect notarization credential;
- accountable creation and custody of the production Minisign key;
- protected GitHub environment and Pages source configuration;
- immutable GitHub Releases and its protected read-only configuration check;
- explicit authority to create the tag, GitHub Release, Pages deployment, and public binary publication; and
- completion of the exact-candidate human accessibility and usability evaluation.

Until those gates close, automation must report the public release as inactive rather than substituting an unsigned package, synthetic identity, unprotected secret, or unverified manual claim.
