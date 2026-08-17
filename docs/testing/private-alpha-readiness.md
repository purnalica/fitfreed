# Private Alpha Readiness

## Decision status

FitFreed 0.1.0 is **not accepted** and no supported alpha is available. The intended candidate remains an unsigned, non-notarized, privately distributed macOS evaluation. It must not be published through a public binary channel.

This document is the single current readiness ledger. It records status and links to the canonical requirement, procedure, architecture, and evidence sources; those linked documents own the underlying contracts and methods.

The states used below are:

- **Passed**: complete evidence exists for the named source or candidate boundary.
- **Pending hosted verification**: local evidence exists, but the corresponding immutable hosted result for the current executable inputs does not.
- **Open acceptance gate**: the required evidence or accountable decision does not yet exist.
- **Not authorized**: the action is deliberately outside the private-alpha authority boundary.

## Readiness ledger

| Gate | State | Current evidence | Required closure |
|---|---|---|---|
| Version-matched candidate scope, limitations, release notes, disclaimer, support, and participant guidance | Passed | The [candidate guide](../user/private-alpha-candidate.md), [reviewed 0.1.0 notes](../../release/notes/0.1.0.md), [disclaimer](../../DISCLAIMER.md), and [support boundary](../../SUPPORT.md) are versioned and checked. | Keep them synchronized with any candidate change. |
| Provider compatibility, canonical contracts, persistence, migrations, and exact reimport behavior | Passed for the implemented 0.1.0 scope | The [data-contract index](../data-formats/README.md), [Milestone 2 plan](../plans/milestone-2.md), and automated contract, migration, integration, and reimport suites define and verify the boundary. | Any behavior change must update its contract, documentation, and tests in the same increment. |
| Supplied private reference compatibility | Passed locally | The privacy-minimized [four-domain acceptance predicate](private-reference-acceptance.md) passed before privacy history cleanup and remains covered by the normal Rust suite. No private path, value, date, count, identifier, coverage distribution, or fingerprint is retained. | Re-run after a relevant importer, mapping, reconciliation, or persistence change. |
| Complete portable, release, installation, recovery, packaged-application, packaged-update, and repository-safety automation | Pending hosted verification | The complete pre-purge product and safety lanes passed, but their obsolete workflow records and source identities are not current evidence. The rewritten executable inputs add the full-scale import and cold-launch gates and pass the complete local fast suite. | Obtain successful hosted evidence for the rewritten executable fingerprint or a later candidate that contains it. |
| Full-scale import regression budgets | Pending clean local verification; reference acceptance open | Privacy history cleanup invalidated the prior source identity, so its result is not retained as current evidence. The [benchmark method](../development/performance-benchmarks.md) still prevents a non-reference local result from substituting for the provisional 8 GB profile. | Pass the unchanged command from a clean rewritten revision locally and on the reference profile, retaining only privacy-safe aggregate evidence. |
| Read-model and packaged-UI performance budgets | Passed as regression evidence; reference acceptance open | Existing local and hosted synthetic campaigns exercise all four detailed domains and the integrated longitudinal view under the [versioned performance method](../development/performance-benchmarks.md). | Run the exact candidate commands on the provisional reference profile. |
| Cold launch p95 at or below 2.5 seconds | Pending clean local verification; reference acceptance open | Privacy history cleanup invalidated the prior source identity. The source-bound [process-to-painted-shell command](../development/performance-benchmarks.md#cold-launch-benchmark) and its p95 budget remain versioned. | Pass the unchanged command from a clean rewritten revision locally and on the provisional reference profile. |
| Minimum supported macOS version and processor boundary | Open acceptance gate | Apple Silicon is the provisional MVP processor family; no final minimum macOS version has been accepted. | Select the support boundary from tested package, WebView, database, installation, and recovery evidence, then update all candidate documentation. |
| Private HTTPS update endpoint and protected production signing authority | Open acceptance gate | Test-only signed channels prove mechanics. The ordinary build deliberately has no endpoint or production trust key; see [update trust](../architecture/update-trust.md). | An accountable release owner must provide and verify the private endpoint and protected signing authority for distinct authorized versions. |
| Controlled DMG handoff, integrity evidence, and exact unsigned launch procedure | Open acceptance gate | The release-shaped package and evidence contract are automated in [private release preparation](../development/release-preparation.md). No participant distribution has been authorized. | Verify the exact candidate handoff and a per-application macOS launch procedure that never weakens system security globally. |
| Keyboard, VoiceOver, scaling, contrast, realistic usability, update, and recovery evaluation | Open acceptance gate | The privacy-safe [manual evaluation procedure](private-alpha-manual-evaluation.md) is ready; automated accessibility and packaged journeys do not replace it. | An authorized participant and evaluator must complete every applicable scenario with no blocking or undisposed serious finding. |
| Public binary, public GitHub release, signing, or notarization publication | Not authorized | The private alpha is intentionally unsigned and outside public release channels. | Requires a separate future public-release decision plus Developer ID signing, notarization, Gatekeeper, channel-operation, and publication evidence. |

## Current cold-launch regression evidence

No current source-bound result is retained after privacy history cleanup. The next clean local campaign must record only privacy-safe aggregate evidence here; exact host details remain local. A non-reference result will remain regression evidence rather than an estimate of 8 GB behavior or reference-profile acceptance.

## Current full-scale regression evidence

No current source-bound result is retained after privacy history cleanup. The next clean local campaign must record only the deterministic synthetic scale, privacy-safe aggregate measurements, result, and reference-profile classification here; exact host details remain local.

## Reference-profile campaign

Use a clean checkout of the exact candidate on an Apple Silicon Mac with 8 GB of memory, sufficient SSD space, and the proposed minimum macOS version. Keep the exact host, operating-system, and free-storage details in the controlled local evidence. Versioned readiness evidence records the application version, source revision, clean-tree state, synthetic scenario, run policy, aggregate timings, memory result, pass or fail result, and whether the host satisfies the reference profile.

Run the existing versioned gates without changing their scenarios or budgets:

```sh
npm ci
npm run doctor
npm run package:app
npm run benchmark:cold-launch
npm run benchmark:import
npm run benchmark:insights
npm run verify:e2e
```

Run the cold-launch command immediately after its production build and before the instrumented E2E build can replace target-directory executables. The [performance benchmark guide](../development/performance-benchmarks.md) owns the exact measurement boundaries and evidence interpretation.

## Acceptance rule

The private alpha may be called accepted only when every applicable row is **Passed** for one exact candidate and no required evidence belongs only to an earlier executable revision. A green build, a successful local package, a private reference pass, or one manual session cannot close another row by implication.
