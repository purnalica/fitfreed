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
| Full-scale import regression budgets | Passed as regression evidence; reference acceptance open | The clean, source-bound campaign recorded below passes all import, exact-repeat, query, and memory budgets. The [benchmark method](../development/performance-benchmarks.md) prevents this non-reference local result from substituting for the provisional 8 GB profile. | Pass the unchanged command on the reference profile, retaining only privacy-safe aggregate evidence. |
| Read-model and packaged-UI performance budgets | Passed as regression evidence; reference acceptance open | Existing local and hosted synthetic campaigns exercise all four detailed domains and the integrated longitudinal view under the [versioned performance method](../development/performance-benchmarks.md). | Run the exact candidate commands on the provisional reference profile. |
| Cold launch p95 at or below 2.5 seconds | Hosted regression failed; reference acceptance open | The clean local campaign recorded below passed, but the same source exceeded the unchanged budget in the hosted macOS campaign. The gate remains failed while progressive-startup remediation is under verification. | Pass the unchanged command locally and in hosted automation, then run it on the provisional reference profile. |
| Minimum supported macOS version and processor boundary | Open acceptance gate | Apple Silicon is the provisional MVP processor family; no final minimum macOS version has been accepted. | Select the support boundary from tested package, WebView, database, installation, and recovery evidence, then update all candidate documentation. |
| Private HTTPS update endpoint and protected production signing authority | Open acceptance gate | Test-only signed channels prove mechanics. The ordinary build deliberately has no endpoint or production trust key; see [update trust](../architecture/update-trust.md). | An accountable release owner must provide and verify the private endpoint and protected signing authority for distinct authorized versions. |
| Controlled DMG handoff, integrity evidence, and exact unsigned launch procedure | Open acceptance gate | The release-shaped package and evidence contract are automated in [private release preparation](../development/release-preparation.md). No participant distribution has been authorized. | Verify the exact candidate handoff and a per-application macOS launch procedure that never weakens system security globally. |
| Keyboard, VoiceOver, scaling, contrast, realistic usability, update, and recovery evaluation | Open acceptance gate | The privacy-safe [manual evaluation procedure](private-alpha-manual-evaluation.md) is ready; automated accessibility and packaged journeys do not replace it. | An authorized participant and evaluator must complete every applicable scenario with no blocking or undisposed serious finding. |
| Public binary, public GitHub release, signing, or notarization publication | Not authorized | The private alpha is intentionally unsigned and outside public release channels. | Requires a separate future public-release decision plus Developer ID signing, notarization, Gatekeeper, channel-operation, and publication evidence. |

## Current cold-launch regression evidence

The 2026-08-17 local campaign used clean production source `06e45756e4afd80d5db04342192c9b41f08dd717` and twenty fresh processes with fresh application data and no existing library. Median launch was 428.905 ms; p95 and maximum launch were 832.764 ms against the 2,500 ms p95 budget. The same source failed the hosted campaign: median launch was 1,709.264 ms and p95 and maximum launch were 3,987.298 ms. This privacy-safe comparison is non-reference regression evidence. It identified startup contention before the interactive-shell boundary; the budget was not retried, relaxed, or reclassified. Replacement evidence is required from the remediated source.

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
