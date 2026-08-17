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
| Complete portable, release, installation, recovery, packaged-application, packaged-update, and repository-safety automation | Passed for the current executable and release inputs | The complete hosted campaign for source `e35969c06a001070ac7e3f92ec4eec1f5bb099ad` passed and recorded its immutable executable-input fingerprint. | Re-run when the fail-closed impact classifier identifies an executable or release-input change. |
| Full-scale import regression budgets | Passed as regression evidence; reference acceptance open | The clean, source-bound campaign recorded below passes all import, exact-repeat, query, and memory budgets. The [benchmark method](../development/performance-benchmarks.md) prevents this non-reference local result from substituting for the provisional 8 GB profile. | Pass the unchanged command on the reference profile, retaining only privacy-safe aggregate evidence. |
| Read-model and packaged-UI performance budgets | Passed as regression evidence; reference acceptance open | Existing local and hosted synthetic campaigns exercise all four detailed domains and the integrated longitudinal view under the [versioned performance method](../development/performance-benchmarks.md). | Run the exact candidate commands on the provisional reference profile. |
| Cold launch p95 at or below 2.5 seconds | Passed as local and hosted regression evidence; reference acceptance open | The strengthened clean campaign passed locally and in hosted automation. The unchanged estimator and budget run over one hundred fresh processes and report the maximum separately. | Run the unchanged command on the provisional reference profile. |
| Minimum supported macOS version and processor boundary | Open acceptance gate | Apple Silicon is the provisional MVP processor family; no final minimum macOS version has been accepted. The current bundle inherits Tauri's 10.13 metadata default while its Apple Silicon executable requires at least macOS 11, so the package metadata is not a support claim and is not ready for handoff. | Select a tested support boundary, configure the deployment target and bundle metadata to the same value, verify the resulting package, and update all candidate documentation. |
| Private HTTPS update endpoint and protected production signing authority | Open acceptance gate | Test-only signed channels prove mechanics. The ordinary build deliberately has no endpoint or production trust key; see [update trust](../architecture/update-trust.md). | An accountable release owner must provide and verify the private endpoint and protected signing authority for distinct authorized versions. |
| Controlled DMG handoff, integrity evidence, and exact unsigned launch procedure | Open acceptance gate | The release-shaped package and evidence contract are automated in [private release preparation](../development/release-preparation.md). No participant distribution has been authorized. | Verify the exact candidate handoff and a per-application macOS launch procedure that never weakens system security globally. |
| Keyboard, VoiceOver, scaling, contrast, realistic usability, update, and recovery evaluation | Open acceptance gate | The privacy-safe [manual evaluation procedure](private-alpha-manual-evaluation.md) is ready; automated accessibility and packaged journeys do not replace it. | An authorized participant and evaluator must complete every applicable scenario with no blocking or undisposed serious finding. |
| Public binary, public GitHub release, signing, or notarization publication | Not authorized | The private alpha is intentionally unsigned and outside public release channels. | Requires a separate future public-release decision plus Developer ID signing, notarization, Gatekeeper, channel-operation, and publication evidence. |

## Current cold-launch regression evidence

The 2026-08-17 baseline used clean production source `06e45756e4afd80d5db04342192c9b41f08dd717` and twenty fresh processes with fresh application data and no existing library. Local median launch was 428.905 ms and p95 and maximum launch were 832.764 ms; hosted median launch was 1,709.264 ms and hosted p95 and maximum launch were 3,987.298 ms against the 2,500 ms p95 budget.

Progressive startup source `2dca6460f83c73a7b8a2470e93fef26a2706523a` passed the same local campaign with a 430.559 ms median and 972.535 ms p95 and maximum. Hosted source `626464fe65fb24815297b0bea151dabd3a6ff07c`, whose later changes only strengthened tests, improved the median to 1,411.689 ms and p95 and maximum to 3,246.513 ms, but still failed the unchanged budget. These privacy-safe comparisons are non-reference regression evidence. The failed campaign was not retried, relaxed, or reclassified. Its total-only signal could not assign the remaining delay responsibly, so the current source adds bounded aggregate phase diagnostics before any further remediation.

Phase-instrumented source `495b7bcc207be24149da02cc7a752fa32c1f925a` passed the clean local campaign with a 429.143 ms median and 849.550 ms p95 and maximum. Local phase p95 values were 411.160 ms for process creation plus evidence transport, 295.066 ms for host setup, 222.096 ms between setup completion and renderer startup plus command transport, 23 ms for renderer startup through locale readiness, and 27 ms from locale readiness through the painted-shell signal.

The same source failed hosted regression evidence with a 1,394.405 ms median and 3,039.768 ms p95 and maximum. Its phase median/p95 values were 8.390/16.221 ms for process creation plus evidence transport, 141.284/1,459.140 ms for host setup, 1,131.425/1,346.533 ms between setup completion and renderer startup plus command transport, 103/204 ms through locale readiness, and 13/36 ms through the painted-shell signal. Phase percentiles are not additive, but they exclude the outer process boundary and post-locale rendering as material causes. Combined with the startup implementation and its history, the evidence identifies synchronous SQLite import recovery followed by WebView/renderer startup as independent costs currently paid in sequence. The remediation overlaps them behind a library-readiness barrier rather than weakening recovery, the measurement, or the budget.

Recovery/WebView overlap source `a34e80cbde24bf9950a50dc4d3c11c359583362d` passed the unchanged clean local campaign with a 467.926 ms median and 901.470 ms p95 and maximum. Its phase median/p95 values were 5.428/425.234 ms for process creation plus evidence transport, 241.927/334.056 ms for host setup, 189.196/269.160 ms between setup completion and renderer startup plus command transport, 21/29 ms through locale readiness, and 11/19 ms through the painted-shell signal.

The same overlap source failed hosted regression evidence with a 1,445.062 ms median and 3,012.315 ms p95 and maximum. Its phase median/p95 values were 8.101/16.984 ms for process creation plus evidence transport, 148.683/1,274.322 ms for host setup, 1,164.907/1,508.009 ms between setup completion and renderer startup plus command transport, 127/204 ms through locale readiness, and 9/35 ms through the painted-shell signal. The overlap preserved the recovery boundary but did not materially reduce hosted tail latency; the evidence does not justify another product optimization by itself.

With twenty measurements, the versioned zero-based `ceil((n - 1) * 0.95)` estimator selects index 19 and therefore makes p95 identical to the maximum. This is too small a campaign for the declared percentile, not evidence that the 2.5-second budget should change. The estimator, budget, fresh-process boundary, distinct application data, and no-warm-up policy remain unchanged; the strengthened campaign uses one hundred measurements, selects index 95, and continues to report the maximum independently. It passes only when at least 96 of 100 launches meet the budget.

Strengthened-campaign source `e35969c06a001070ac7e3f92ec4eec1f5bb099ad` passed the clean local campaign with a 437.716 ms median, 555.344 ms p95, and 918.082 ms maximum. Its phase p95 values were 7.942 ms for process creation plus evidence transport, 291.703 ms for host setup, 214.454 ms between setup completion and renderer startup plus command transport, 26 ms through locale readiness, and 14 ms through the painted-shell signal. This non-reference result does not close reference-profile acceptance.

The [complete hosted campaign](https://github.com/purnalica/fitfreed/actions/runs/32049298734) for the same source passed with a 1,785.674 ms median, 1,908.258 ms p95, and 4,057.276 ms maximum. Its phase p95 values were 19.416 ms for process creation plus evidence transport, 280.726 ms for host setup, 1,465.856 ms between setup completion and renderer startup plus command transport, 191 ms through locale readiness, and 37 ms through the painted-shell signal. All portable, release preparation, full-scale import, Insights, recovery preparation, installation, packaged application, and packaged update jobs also passed, and the workflow recorded the executable-input fingerprint for later documentation-only reuse. This hosted result is regression evidence and does not replace the required reference-profile campaign.

## Current full-scale regression evidence

The 2026-08-17 campaign used clean production source `06e45756e4afd80d5db04342192c9b41f08dd717` and seven fresh processes, each with a fresh library. Its independently authored deterministic archive contained 10,000 entries, 5,999 daily-activity observations, 4,000 training sessions, two million deliberately excluded time-series samples, and 5,453,138,315 expanded bytes.

The first-import p95 was 14,657.823 ms against a 600,000 ms budget; exact-repeat p95 was 92.873 ms against 30,000 ms; query p95 was 1.389 ms against 500 ms; and peak-resident-memory p95 was 33.484 MiB against the exclusive 1,536 MiB limit. Every budget passed. This privacy-safe result is non-reference regression evidence, not reference-profile acceptance.

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
