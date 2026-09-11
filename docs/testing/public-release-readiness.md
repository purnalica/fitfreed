# Public macOS Release Readiness

## Decision status

FitFreed 0.1.7 is the first supported public release for Apple Silicon on macOS 15.0 or later. Immutable Release
[`v0.1.7`](https://github.com/purnalica/fitfreed/releases/tag/v0.1.7) contains the exact admitted candidate from source
`e610d7e89f97dcade9384241847233b2bb78733d`. Protected workflow
[`34650206971`](https://github.com/purnalica/fitfreed/actions/runs/34650206971), attempt 2, completed publication,
Pages deployment, provenance checks, and remote byte verification on 2026-09-12. Its release-manifest SHA-256 is
`7bd4fd147f1fe5eefb4b563d5da580c3a3e399afbe6daf97e22a67fddbf34eea`. The earlier rejected tags remain immutable
historical evidence. The public `v0.1.0` tag is fixed at a source revision whose
secret-free dispatch failed before any protected authority was admitted. The public `v0.1.1` tag is fixed at source
`e4746ac`; [dispatch `34535866497`](https://github.com/purnalica/fitfreed/actions/runs/34535866497) passed preflight,
the first protected approval, immutable-Release verification, and ephemeral authority installation, then stopped
before candidate construction because preparation lacked its job-scoped read-only GitHub token. Authority cleanup
passed. The public `v0.1.2` tag is fixed at source `104570f`; [dispatch `34611861394`](https://github.com/purnalica/fitfreed/actions/runs/34611861394)
passed both preflights, built and Developer ID-signed the application, received Apple's accepted notarization result,
stapled the application, and built and signed the DMG. It then stopped before updater signing because the protected
installer supplied only Tauri's signer-subcommand path variable, not the distinct variable consumed by Tauri's bundle
path. Cleanup passed; no candidate was sealed, retained, or published, and none of the three tags will be moved or
reused. The public `v0.1.3` tag is fixed at source `5fe834e`; [dispatch `34619731032`](https://github.com/purnalica/fitfreed/actions/runs/34619731032)
proved the corrected private-key handoff, repeated both preflights, built and Developer ID-signed the application,
received Apple's accepted notarization result, stapled the application, and built and signed the DMG. It then stopped
before updater signing because Tauri's updater-artifact configuration still received the empty ordinary public-key
value instead of selecting the complete reviewed public key already present in FitFreed's canonical active trust set.
Cleanup passed; no candidate was sealed, retained, or published, and no rejected tag will be moved or reused.
The public `v0.1.4` tag is fixed at source `5200bf8`; exact-source [product site
`34622199380`](https://github.com/purnalica/fitfreed/actions/runs/34622199380), [repository safety
`34622199403`](https://github.com/purnalica/fitfreed/actions/runs/34622199403), and [continuous integration
`34622199331`](https://github.com/purnalica/fitfreed/actions/runs/34622199331) passed without repeating unchanged
packaged E2E. [Dispatch `34623724477`](https://github.com/purnalica/fitfreed/actions/runs/34623724477) proved the
public-key correction by emitting the updater archive and signature after Apple accepted and Tauri stapled the
application. Objective trust then stopped at an indistinguishable code-signing stage. Source inspection established
that Tauri's later DMG receives only generic signing rather than the independent final-container notarization and
stapling required by FitFreed. Cleanup passed; no candidate was sealed, retained, or published. Current source adds
that explicit final-DMG boundary and stage-specific privacy-safe diagnostics. No rejected tag will be moved or reused.
The public `v0.1.5` tag is fixed at source `3ad0ef5`; exact-source [repository safety
`34627485220`](https://github.com/purnalica/fitfreed/actions/runs/34627485220) and [continuous integration
`34627485182`](https://github.com/purnalica/fitfreed/actions/runs/34627485182) passed, while unchanged packaged E2E
jobs were skipped. [Dispatch `34628632360`](https://github.com/purnalica/fitfreed/actions/runs/34628632360) proved the
explicit final-DMG signing, notarization-log inspection, and stapling boundary after Tauri emitted the signed updater
archive. Objective trust then identified the exact failing stage: the leaf-certificate extraction command supplied
the output prefix as a separate argument, which `codesign` interpreted as another candidate path. Reproduction against
an existing signed application established that the operational syntax is the single
`--extract-certificates=<prefix>` argument. Cleanup passed; no candidate was sealed, retained, or published. Current
source corrects that command and makes its exact argument shape part of the synthetic contract. No rejected tag will
be moved or reused.
The public `v0.1.6` tag is fixed at source `575efec`; exact-source [product site
`34630394106`](https://github.com/purnalica/fitfreed/actions/runs/34630394106), [repository safety
`34630394235`](https://github.com/purnalica/fitfreed/actions/runs/34630394235), and [continuous integration
`34630394151`](https://github.com/purnalica/fitfreed/actions/runs/34630394151) passed without repeating packaged
E2E. [Dispatch `34636087709`](https://github.com/purnalica/fitfreed/actions/runs/34636087709) proved the corrected
leaf-certificate extraction and complete application and final-DMG trust boundary. Stable-channel assembly then
stopped before metadata signing because Tauri's standalone signer received both private-key environment names, which
it maps to mutually exclusive inline and path options. Cleanup passed; no candidate was sealed, retained, or
published. Current source gives that child process only the protected path and inherited password while preserving
both names for the parent packaging boundary. No rejected tag will be moved or reused.
The public `v0.1.7` tag is fixed at source `e610d7e89f97dcade9384241847233b2bb78733d`; exact-source [product site
`34638238735`](https://github.com/purnalica/fitfreed/actions/runs/34638238735), [repository safety
`34638238739`](https://github.com/purnalica/fitfreed/actions/runs/34638238739), and [continuous integration
`34638238731`](https://github.com/purnalica/fitfreed/actions/runs/34638238731) passed without repeating unchanged
packaged E2E. The protected build in [dispatch `34650206971`](https://github.com/purnalica/fitfreed/actions/runs/34650206971)
completed application and final-DMG signing, notarization, stapling, objective trust inspection, updater and stable
metadata signing, complete candidate reopening, and digest-bound sealing. It retained Actions artifact `10283667124`
under the exact candidate name with transport SHA-256
`6fee894364db633ee08b5ba61e43caef00e0184881fddca839cadab7531e87cc`. Protected promotion and final remote
verification subsequently passed in workflow attempt 2. Independent local reopening on 2026-09-11 authenticated the same digest, version, revision, complete
manifest, stable update signature, and Pages staging. Native admission of the downloaded bytes then passed the exact
DMG-to-application identity, Developer ID, notarization, stapling, Gatekeeper, isolated first-launch, restart, private
schema-37 library, removal, and retained-library boundaries. The current automation-only descendant adds the
secret-free hosted admission record for those unchanged bytes. [Hosted admission
`34653219570`](https://github.com/purnalica/fitfreed/actions/runs/34653219570) independently authenticated the
originating protected run and artifact, reopened the digest-bound transport, installed the sealed DMG, repeated the
two-launch and private-library lifecycle, removed the application, and retained the library. Exact-delta review
established that the sole later presentation change only applies the existing reveal-and-focus contract with explicit
start alignment; it changes no content, task, control, data, hierarchy, or layout. The accepted experience baseline
therefore remains applicable without another product-owner session.
X7-R8.0 through X7-R8.12 retain their machine evidence. The
repeated independent audit, complete local campaign, exact repository-safety and hosted workflows, and
revision-isolated production-native bundle inspection pass for source `f082725` and executable-input fingerprint
`e0e09a5db6af35e6a7e074a27083acc59d3130590d9e7b0c893e57634722f4a8`. The bounded product-owner review rejected the
later production-native application from source `3e280ca` on 2026-08-30 because most represented sports and sessions
remained unknown. The [human evaluation](../research/x6-product-experience-human-evaluation.md) is the authoritative
rejection record. The X7-R8.13 public-source catalogue and private-reference recognition predicate pass locally;
complete changed-tree regression and the repeated independent audit also pass. Reviewed source `512972e` passes the
complete clean local campaign, exact repository safety, and every hosted portable and macOS gate before final
update-recovery. GitHub cancelled that healthy final gate at the obsolete fixed 75-minute job boundary, without an
assertion failure. The focused orchestration correction retains all gates and raises only the aggregate allowance to
95 minutes. Exact source `e0e722c` proves that allowance through every preceding product gate, the complete functional
journey, and real-process restart, then exposes a transient-status race in the adaptive-session E2E synchronizer. The
current changed tree centralizes the atomic renderer-snapshot pattern already used by the main journey; its focused
regression, both affected packaged scenarios, and complete packaged campaign pass locally. Corrected exact source
`a447910` passes [repository safety `33414102039`](https://github.com/purnalica/fitfreed/actions/runs/33414102039), the
complete [hosted campaign `33414102138`](https://github.com/purnalica/fitfreed/actions/runs/33414102138), immutable
executable-input evidence, and local revision-isolated native inspection. Its bounded product-owner review accepted
recognizable sport identity and rejected the application at XH-30 when pointer range adjustment made further use
impossible. X7-R8.14 now passes the complete changed-tree local campaign with bounded ECharts zoom, coalesced exact
route-preview work, distinct-process restart, update replacement and recovery, and production packaging. Exact
executable source `7b2983a` passes the complete local gate. The repeated independent audit reports no unresolved
critical or major product finding, and documentation-only descendant `d917882` passes local revision-isolated native
inspection with unchanged executable inputs. Synchronized source `7583ca9` passes [repository safety
`33554185450`](https://github.com/purnalica/fitfreed/actions/runs/33554185450), the complete [hosted campaign
`33554185602`](https://github.com/purnalica/fitfreed/actions/runs/33554185602), and immutable executable-input fingerprint
`9348e7b463ec58d600ec3c4cdcf335e2686827381d0496353c184b3e58f86302`. Those results remain the admitted product
baseline. Later release-affecting source `e4026bd` adds the Windows expansion workflow and changes shared package-build
and packaged-E2E entry points. It passes [repository safety `33957366645`](https://github.com/purnalica/fitfreed/actions/runs/33957366645),
the [product-site workflow `33957366763`](https://github.com/purnalica/fitfreed/actions/runs/33957366763), and the portable
quality and Linux-host job of [hosted campaign `33957366674`](https://github.com/purnalica/fitfreed/actions/runs/33957366674).
That campaign is not accepted: its Windows-native host job exposed checkout-time CRLF conversion in domain source
consumed by the data-contract validator. Exact source `16bf050` fixes that byte policy and passes [repository safety
`33958691562`](https://github.com/purnalica/fitfreed/actions/runs/33958691562), the [product-site workflow
`33958691540`](https://github.com/purnalica/fitfreed/actions/runs/33958691540), the portable and Linux-host boundary,
packaged Linux capability, and packaged Linux update recovery in [hosted campaign
`33958691589`](https://github.com/purnalica/fitfreed/actions/runs/33958691589). Exact descendant `fff7df8` passes
[repository safety `33977220156`](https://github.com/purnalica/fitfreed/actions/runs/33977220156), the complete portable
and Linux-host job, packaged Linux capability, packaged Linux update recovery, and the complete packaged macOS job in
[campaign `33977220148`](https://github.com/purnalica/fitfreed/actions/runs/33977220148). That campaign remains
unaccepted because the Windows host exposed a slow synthetic text-entry interaction and the installed Windows package
exposed an impossible second open of an exclusive library-parent handle. The current changed tree pastes the bulk test
value while preserving its exact validation contract, and performs DACL and optional owner normalization through the
initial verified Windows handle. Its complete presentation, Rust, lint, documentation, repository-content, and
repair-planning evidence passes locally, but the correction has no exact hosted result. Human re-evaluation remains
open. Exact correction `26a231d` passes [repository safety
`33993588622`](https://github.com/purnalica/fitfreed/actions/runs/33993588622), but [continuous integration
`33993588621`](https://github.com/purnalica/fitfreed/actions/runs/33993588621) stops in the portable presentation suite
before any native job. A personal-range component test treated a synchronously rendered list heading as proof that its
asynchronous selected-summary command had already run. The current tree waits for that exact command without removing
or weakening its revision-bound query assertion, and the focused plus complete constrained-worker presentation suites
pass locally. No hosted result exists for this latest correction.
Exact descendant `5e531e4` passes [repository safety
`33993889053`](https://github.com/purnalica/fitfreed/actions/runs/33993889053), the complete portable and Linux-host job,
installed Linux capability, packaged Linux update recovery, and the complete packaged macOS job in [continuous
integration `33993889001`](https://github.com/purnalica/fitfreed/actions/runs/33993889001). Its Windows host stops before
Rust compilation because one presentation test serializes four independent interaction contracts beyond the
five-second boundary. Its isolated NSIS package passes the corrected local-library parent protection, then ordinary
startup rejects the package because recovery reattachment still requests the fixed production identity instead of the
package's compiled `fitfreed-e2e` identity. The aborted WebView also retains a transient application-data lock, and
immediate cleanup masks that primary failure. The current tree separates the interaction contracts without dropping an
assertion, derives only ordinary startup identity from the compiled package and exact running executable, preserves
fixed production identity for every update and recovery authority, and makes isolated cleanup bounded while retaining
both failures. Its focused and complete local presentation, Rust, Windows automation, lint, format, documentation,
architecture, data-contract, release-contract, and repository-content evidence passes. No exact hosted result exists
for this correction.
Exact source `b94a8f4` then passes [repository safety
`34031313021`](https://github.com/purnalica/fitfreed/actions/runs/34031313021), the complete portable and Linux-host job,
both packaged Linux jobs, and the complete packaged macOS job in [continuous integration
`34031313078`](https://github.com/purnalica/fitfreed/actions/runs/34031313078). The packaged Windows application passes
its complete capability journey. Native installation inventory then collapses an otherwise unclassified native
failure into a generic wrapper phase, and packaged update recovery stops after building both NSIS packages because
one stale local script reference is undefined. Manual [Windows performance run
`34032179775`](https://github.com/purnalica/fitfreed/actions/runs/34032179775) independently builds and installs the
production NSIS package, then proves that the GUI-subsystem executable cannot transport its painted-shell signal
through standard output. Exact descendant `9e88fdb` passes the complete Windows presentation, build, Rust, strict
Clippy, updater, and release-shaped NSIS construction boundary in focused [run
`34054394508`](https://github.com/purnalica/fitfreed/actions/runs/34054394508), then its native inventory reports only
the generic `native-installation` phase. Local commit `0048f52` preserves closed returned-evidence failures through
both JavaScript layers, while `bfeec51` adds a package-only Windows dispatch so the next experiment cannot repeat the
already successful host checks. Their 195 Windows automation contracts, workflow validation, documentation,
repository-content, secret, and public-identity gates pass. Exact native evidence remains pending synchronization.
Exact source `6d0b51f` then exercises only the package boundary in focused [run
`34059108525`](https://github.com/purnalica/fitfreed/actions/runs/34059108525): NSIS construction passes and every
packaged E2E campaign is skipped, while native inventory now reports the precise
`native-installation/evidence-entry-order` rejection. The adapter invokes Windows PowerShell 5.1, but the installed
file sort introduced by `7b50b90` supplied ordered dictionaries whose `sortKey` key is not a sortable object property
on that runtime. The current tree materializes those temporary records as `PSCustomObject` values and preserves the
existing UTF-8 hexadecimal key plus independent JavaScript byte-order validation. Focused installation and inventory
contracts pass. Exact source `ae59828` then passes the complete package-only Windows boundary in focused [run
`34060294715`](https://github.com/purnalica/fitfreed/actions/runs/34060294715): the NSIS package builds, installs into
the clean current-user profile, emits the validated package inventory, removes package-owned state, preserves
application data, and records reusable Windows host evidence. Every packaged E2E campaign is skipped. The Windows
installation and engineering-inventory boundary is closed; public Authenticode authority, update recovery,
performance, exact-candidate, Windows 11 acceptance, and promotion remain separate open boundaries.
Exact source `fb802e6` subsequently passes all six native Windows update-recovery scenarios in focused [run
`34296638466`](https://github.com/purnalica/fitfreed/actions/runs/34296638466). Exact descendant `43b04ff` builds and
installs the production NSIS package and accepts 100 fresh-data launches at p95 `2,175.046 ms` in focused [run
`34315586139`](https://github.com/purnalica/fitfreed/actions/runs/34315586139). Exact descendant `23b0f1e` passes
[repository safety `34333179144`](https://github.com/purnalica/fitfreed/actions/runs/34333179144), complete [continuous
integration `34333179226`](https://github.com/purnalica/fitfreed/actions/runs/34333179226), and focused [Windows
recovery-and-data run `34334118449`](https://github.com/purnalica/fitfreed/actions/runs/34334118449). The latter
reopens the accepted package and cold-launch identities, skips both expensive accepted gates, and passes native NTFS
disk-exhaustion recovery, full-scale import, dense-history, concurrent-navigation, Insights, report-export, memory,
and database-size budgets. This closes hosted Windows Server 2025 performance and reliability engineering without
claiming Authenticode authority, exact Windows 11 candidate behavior, human acceptance, or promotion. Those machine
results do not overrule the earlier observed failure; the later human acceptance is recorded below.
The ADR 0020 Pages compositor and localized product site are live. The macOS workflow subsequently published 0.1.7;
the Linux-expansion and Windows-expansion release workflows remain gated and preserve the ordered publication
dependency.
Revision-isolated source `47a521e953e8e21003fe21755cb4462418288a90` subsequently passes native inspection, exact
[repository safety `34342290451`](https://github.com/purnalica/fitfreed/actions/runs/34342290451), and exact
[continuous integration `34342290498`](https://github.com/purnalica/fitfreed/actions/runs/34342290498). The bounded
product-owner review ended on 2026-09-09 with explicit acceptance of the current result as sufficient for the first
FitFreed public product version. Its six observations are future improvements, not acceptance blockers. The later
0.1.7 release established production updater and Apple authority, protected GitHub controls, an exact sealed
candidate, and immutable public bytes. The 0.1.8 Linux expansion must establish its separate checksum authority and
exact-candidate evidence.

This is the single current readiness ledger for public macOS evidence and the active Linux expansion. The former
[private-alpha ledger](private-alpha-readiness.md) remains the detailed source for its completed and deferred
Milestone 2 evidence; it no longer owns the current release decision.

The 2026-09-09 completion audit retains D0 and E1 through E5 as implemented engineering evidence. Historical E6
experience acceptance remains invalid because its independent audit failed; X7-R8.14 is the verified replacement and
the 2026-09-09 bounded product-owner review accepts the resulting 0.1.0 experience. Windows update recovery plus hosted
Windows Server 2025 performance and reliability pass for the current executable inputs. Exact Windows 11 candidate,
platform trust, and public-candidate acceptance remain open release gates; they do not reopen the completed D0–E6
product-experience objective.

The states mean:

- **Passed**: complete durable evidence exists for the named version-independent or unchanged capability boundary.
- **Passed locally**: deterministic local evidence exists, but the exact source still requires its hosted result.
- **In progress**: the accepted implementation boundary is actively being completed and has not reached its evidence gate.
- **Pending hosted verification**: a required GitHub result for the exact release-affecting source is absent or running.
- **Awaiting human evaluation**: every automatable prerequisite for the named profile passes, but its bounded
  acceptance requires human observation and judgment.
- **Open external gate**: accountable configuration, credential, or third-party trust evidence does not exist.
- **Awaiting exact candidate**: the procedure exists but can run only against production-authority bytes.
- **Not authorized**: the irreversible external action has not been approved.

No row changes state by implication. A green source build does not prove Apple trust, environment protection, human usability, public bytes, or publication authority.

### D0–E6 completion audit

This audit evaluates the retained [MVP experience delivery plan](../plans/mvp-experience-delivery.md) against the
current product rather than treating its historical completion labels as proof. Presentation evidence rejected by a
later independent review is not reused. The [production migration plan](../plans/mvp-redesign-production-migration.md)
owns the corrective implementation and maps every retained baseline to its current replacement.

| Baseline | Required outcome | Current authoritative evidence | Verdict |
|---|---|---|---|
| D0 | Decide the smallest complete deep-session and report-authoring boundaries from source, interaction, library, privacy, accessibility, and licence evidence | The accepted [boundary assessment](../research/mvp-experience-boundary-assessment.md), requirements, roadmap, and ADRs [0021](../architecture/decisions/0021-model-training-as-attributed-evidence.md) and [0022](../architecture/decisions/0022-persist-reproducible-evidence-reports.md) agree on both boundaries. Later implementation preserves them. | **Passed** |
| E1 | Deliver the first-run shell, Sources, persistent Settings, acquisition actions, navigation, restart, localization, zoom, theme, accessibility, and concurrency behavior through real adapters | Retained E1 functional evidence is replaced in presentation by X5-R2 and corrected by X7-R1 and X7-R3. Exact source `7583ca9` passes the complete hosted product campaign and revision-isolated native inspection. | **Passed for the implemented automatable boundary** |
| E2 | Turn committed import state into an immediate provider-neutral answer and restore a valid Home or workspace after restart and reimport | The versioned Library Home contract and retained E2 composition, persistence, migration, packaged, restart, and performance evidence remain in use. X5-R3 and X7-R1 replace the rejected presentation and long-operation behavior without adding a second calculation path. | **Passed for the implemented automatable boundary** |
| E3 | Provide full-history sport and session discovery, classification, filtering, chronology, calendar, comparison, exact navigation, restoration, and bounded performance | Retained E3 domain, query, migration, full-scale, packaged, and hosted evidence is strengthened by X7-R2 and X7-R8.9 through X7-R8.13. The privacy-minimized private-reference procedure confirms recognition of every represented source sport for the supplied compatibility case. | **Passed for the implemented automatable boundary** |
| E4 | Preserve and explore supported structure, routes, signals, zones, provenance, and authored segmentation with exact alternatives, safe reimport enrichment, bounded memory, accessibility, and route privacy | Retained E4 contract, migration, million-sample, packaged, and hosted evidence remains valid. X5-R6 through X5-R8 and X7-R4, X7-R5, and X7-R8.14 replace the rejected presentation, add the accepted structured-training behavior, and bound sustained chart and route-range interaction. | **Passed for the implemented automatable boundary** |
| E5 | Create, persist, reopen, refresh, duplicate, navigate, privacy-review, and deterministically export portable result-first reports through authoritative queries | Retained E5 domain, application, persistence, migration, independent-output, packaged, restart, and hosted evidence remains valid. X5-R9 and X7-R6 replace the rejected hierarchy and complete built-in examples, duplication, explicit subjects, and transient run parameters. | **Passed for the implemented automatable boundary** |
| E6 | Remove superseded paths safely, harden the complete release-shaped journey, keep all documentation current, pass one exact evidence matrix, and finish with an independent audit that has no unresolved material finding | X5-R10 and X7-R8.14 pass the automatable hardening, documentation, audit, exact hosted, and native-inspection boundaries. Earlier human reviews rejected the product and therefore invalidate historical E6 acceptance. Revision-isolated source `47a521e953e8e21003fe21755cb4462418288a90` passes complete-bundle inspection with production adapters, exact repository safety, and exact continuous integration. Its bounded product-owner review ended on 2026-09-09 with explicit acceptance of the current result for FitFreed 0.1.0; six observations remain non-blocking future improvements. | **Passed** |

The objective's transversal delivery obligations have separate evidence and do not inherit a phase verdict:

| Obligation | Evidence | Verdict |
|---|---|---|
| Clean Architecture and DDD | Versioned dependency rules, thematic architecture, domain/application/adapter separation, and the architecture checker cover every implemented vertical. No current platform correction changes the domain direction. | **Passed** |
| TDD and behavior-based unit, integration, presentation, packaged, migration, accessibility, and performance verification | Each retained and corrective increment records its affected contract and focused evidence before its complete candidate campaign. The current Windows correction adds focused failing-then-passing contract coverage without removing or weakening a product assertion. | **Passed for implemented increments** |
| Complete canonical documentation | Requirements, current architecture, data formats, schemas, migrations, user guidance, contributor guidance, troubleshooting, operations, active plans, and this ledger are versioned and checked together. Candidate-specific public guidance remains intentionally open until sealed candidate bytes exist. | **Passed for the current non-public candidate state** |
| Focused commit and synchronization discipline | Every completed correction is a focused local commit. The complete outgoing range passes repository-content, secret, and public-identity safeguards. Exact source `23b0f1e` is synchronized with `origin/main` and passes [repository safety run `34333179144`](https://github.com/purnalica/fitfreed/actions/runs/34333179144). | **Passed** |
| Exact current-source native platform evidence | Focused Windows [run `34060294715`](https://github.com/purnalica/fitfreed/actions/runs/34060294715) accepts NSIS construction, installation, inventory, removal, and application-data preservation without packaged E2E. Focused Linux [run `34061136225`](https://github.com/purnalica/fitfreed/actions/runs/34061136225) accepts the corrected Insights interaction and package lifecycle while every unrelated scenario and platform job is skipped. Exact source `fb802e6` passes all six Windows update-recovery scenarios in focused [run `34296638466`](https://github.com/purnalica/fitfreed/actions/runs/34296638466). Exact descendant `43b04ff` accepts installed Windows cold launch; descendant `23b0f1e` passes exact CI and repository safety, then reopens retained evidence and accepts native filesystem recovery plus every data-performance budget in focused [run `34334118449`](https://github.com/purnalica/fitfreed/actions/runs/34334118449). | **Passed for hosted platform engineering; exact candidates remain separate** |

## Readiness ledger

| Gate | State | Current evidence | Required closure |
|---|---|---|---|
| Confirmed 0.1.0 product scope, provider compatibility, canonical formats, persistence, migrations, and reimport semantics | Passed | E1 through E5 and X7-R8.9 through X7-R8.13 retain their earlier evidence. X7-R8.14 bounds both sustained ECharts zoom and exact route-preview scheduling; the complete exact local and hosted campaigns, repeated independent audit, revision-isolated native inspection, and bounded 2026-09-09 product-owner review pass without changing persistence contracts. | Reopen only after a material product-scope, importer, persistence, or experience-contract change. |
| Supplied private-reference compatibility | Passed locally for the documented four-domain and sport-identity predicates | The privacy-minimized acceptance described in the [private-reference procedure](private-reference-acceptance.md) passed on 2026-08-31 after activating the bundled catalogue. It established complete coverage, one opaque origin, every required history domain, exact reimport, and recognition of every represented source sport while accepting records with no source sport as unavailable. It retained no private path, value, date, count, identifier, name, distribution, account response, or fingerprint. | Re-run after a relevant importer, mapping, catalogue, reconciliation, or persistence change. A single export never establishes universal compatibility. |
| Environment-qualified import, Insights, packaged UI, update-recovery, and cold-launch budgets | Passed for the hosted engineering environments | [Hosted campaign `33554185602`](https://github.com/purnalica/fitfreed/actions/runs/33554185602) remains the accepted product baseline for source `7583ca9`. Exact source `b94a8f4` passes packaged capability on macOS, Linux, and Windows plus Linux update recovery. Focused [Windows package run `34060294715`](https://github.com/purnalica/fitfreed/actions/runs/34060294715) accepts native NSIS construction, installation, inventory, removal, and data preservation. Focused [Linux Insights run `34061136225`](https://github.com/purnalica/fitfreed/actions/runs/34061136225) accepts the corrected resize interaction and package lifecycle without repeating any other packaged scenario. Exact-source focused [Windows update run `34296638466`](https://github.com/purnalica/fitfreed/actions/runs/34296638466) accepts successful replacement and every recovery path. Windows [cold-launch run `34315586139`](https://github.com/purnalica/fitfreed/actions/runs/34315586139) and [recovery-and-data run `34334118449`](https://github.com/purnalica/fitfreed/actions/runs/34334118449) accept the remaining hosted Windows budgets for exact executable descendant `23b0f1e`. | Reserve the complete matrix for each exact sealed candidate in its documented native environment. |
| Apple Silicon on macOS 15.0 or later platform boundary | Passed | [ADR 0016](../architecture/decisions/0016-support-apple-silicon-on-macos-15-or-later.md), Tauri configuration, release contracts, Mach-O inspection, and the hosted Apple Silicon runner share the boundary. | Re-run bundle, launch, performance, installation, and update evidence after a platform, toolchain, dependency, or packaging change. |
| Public stable-channel contracts, compile-time trust, replay protection, withdrawal, compatibility policy, and atomic Pages staging | Passed for public 0.1.7 | The [update-trust architecture](../architecture/update-trust.md), version 2 channel schemas, versioned configuration and policy, synthetic signing, local TLS packaged-update journey, closed update snapshot verifier, and ADR 0020 compositor tests cover the update contract. The published sequence 8 envelope authenticates `stable.primary-1`, the exact 0.1.7 updater archive, and the byte-identical Pages snapshot. The first public release has no application-version predecessor. | Exercise every real application predecessor declared by a later release's upgrade matrix. |
| Signed/notarized evidence, candidate preparation, sealed transport, separate technical and human admission, immutable Release, provenance, Pages ordering, and remote verification automation | Passed for public 0.1.7 | The [public release guide](../development/public-release.md), [operations runbook](../development/public-release-operations.md), ADRs [0019](../architecture/decisions/0019-separate-candidate-build-from-public-promotion.md), [0020](../architecture/decisions/0020-compose-product-and-update-pages.md), [0046](../architecture/decisions/0046-separate-windows-candidate-build-and-admission-hosts.md), and [0047](../architecture/decisions/0047-permit-bootstrap-solo-release-approval.md), plus the release and admission workflow policies, cover the trust topology. Exact `v0.1.7` workflow `34650206971` passed build, publication, Pages, provenance, and remote-verification stages. Read-only hosted admission `34653219570` independently authenticated and exercised the same sealed bytes before promotion. | Reopen for every later exact candidate. |
| Exact-source continuous integration and repository safety | Passed for 0.1.7 | Exact source `e610d7e` passes product site `34638238735`, repository safety `34638238739`, and impact-classified continuous integration `34638238731` without repeating unchanged packaged E2E. The protected build independently reopens that source identity in the sealed candidate. | Re-run only after an applicable source or control change; do not repeat unchanged product E2E or performance campaigns. |
| Version-matched public user, maintainer, support, security, disclaimer, release-note, and evaluation guidance | Passed for public 0.1.7 | Requirements, roadmap, experience specification, migration plan, readiness state, generated product surfaces, 0.1.7 release notes, and localized user guides describe the same supported public macOS boundary. | Update atomically with every later complete-platform release. |
| Production updater authority and embedded public trust | Passed for the sealed 0.1.7 candidate | On 2026-09-10 the project owner confirmed external generation of the production updater key pair. The checked-in configuration activates the reviewed `stable.primary-1` public key after canonical Tauri/Minisign validation. The private-key file has restricted local permissions, and both the private key and its separately supplied password enter only the protected build. Dispatch `34650206971` generated the updater archive and stable metadata signatures, then complete local and independently downloaded reopening authenticated both without exposing authority. | Preserve external custody and revocation readiness; a later update must exercise every declared predecessor. |
| Developer ID Application and App Store Connect notarization authority | Passed for the sealed 0.1.7 candidate | The workflow admits the exact certificate fingerprint and App Store Connect team API key through ephemeral files and a temporary keychain. Dispatch `34650206971` signed and notarized both the application and final DMG, stapled both tickets, inspected Apple's accepted notarization logs, matched the leaf certificate, and passed objective Gatekeeper assessment. Independent admission repeated signature, ticket, Gatekeeper, architecture, deployment-target, and certificate checks after downloading and installing the sealed bytes. Unconditional authority cleanup passed. | Preserve external custody and revocation procedures. An interactive Apple ID is not required by the release workflow. |
| Protected GitHub environment, immutable Releases, and Actions-backed HTTPS Pages | Passed for repository configuration and 0.1.7 publication | Repository-level immutable Releases are enabled. Actions-backed Pages is configured at the verified `fitfreed.org` origin with enforced HTTPS and exact-byte publication checks. `public-macos-release` admits only `v*` tags. The first Pages deployment attempt exposed that `github-pages` admitted only `main`; deployment stopped before a runner started. Adding the matching `v*` tag policy corrected the environment boundary, and the failed jobs alone were re-run successfully in workflow attempt 2. No secret value was read or retained as evidence. | The secret-free preflight must verify both protected environments before every later candidate build and after any policy change. |
| Sealed Developer ID-signed and Apple-notarized 0.1.7 candidate | Passed and published unchanged | Exact workflow `34650206971` retained artifact `10283667124` under the version-and-revision-bound name. Its transport SHA-256 `6fee894364db633ee08b5ba61e43caef00e0184881fddca839cadab7531e87cc` matches the independently admitted archive and the bytes promoted in attempt 2. | Never rebuild, alter, or replace immutable 0.1.7. |
| Corrected product experience: comprehension, trust, usefulness, natural navigation, and presentation quality | Passed for 0.1.0 | The X7-R8.13 review accepted recognizable sport identity and rejected source `a447910` at XH-30. X7-R8.14 corrects both pointer-range systems and passes complete exact verification. The bounded 2026-09-09 review of revision-isolated source `47a521e` ended with explicit acceptance; its six observations are future improvements. | Reopen after a material experience change; preserve the separate sealed-candidate review below. |
| Clean install, Gatekeeper launch, import, exploration, update, interruption recovery, library preservation, and removal against the sealed public candidate | Passed for every applicable first-release boundary | The accepted fingerprint-bound product campaign proves import, exploration, accessibility, performance, and synthetic update recovery for the candidate source. Exact downloaded 0.1.7 bytes pass DMG installation, Gatekeeper launch through the first painted shell, restart, private schema-37 library integrity, application removal, and retained-library integrity. Complete reopening authenticates the exact updater payload and embedded production trust. Read-only hosted admission `34653219570` independently repeats the exact-artifact provenance, installation, two launches, private-library integrity, removal, and retained-library checks. No application-version update applies because the first release declares no predecessor. | Reopen for a different sealed candidate. Do not ask the product owner to repeat functional QA. |
| Exact-candidate product experience | Passed through the accepted baseline | Revision-isolated source `47a521e` passed native inspection, exact hosted checks, and the bounded product-owner profile on 2026-09-09. Candidate source adds only the tested start-aligned application of the existing reveal-and-focus contract for the personal-range editor; it changes no content, task, control, data, hierarchy, or layout. All other later executable changes belong to versioning, release trust, or update-recovery acceptance. A repeated subjective session is therefore not applicable. Functional correctness, keyboard behavior, scaling, appearance, localized update, recovery, and automatable accessibility remain exact-candidate automation responsibilities. | Reopen only after a material experience change; never repeat the functional matrix manually. |
| Public tag, immutable GitHub Release, Pages deployment, and binary availability | Passed for 0.1.7 | `v0.1.7` is fixed at `e610d7e`; the immutable [FitFreed 0.1.7 Release](https://github.com/purnalica/fitfreed/releases/tag/v0.1.7), signed DMG, release evidence, and complete Pages snapshot are public. Earlier tags remain rejected and immutable. | A later platform expansion uses a new version and tag. |
| Public Release, build provenance, release-linked assets, stable endpoint, and updater bytes | Passed for 0.1.7 | Workflow `34650206971`, attempt 2, verified the immutable Release, source-bound attestations, exact linked assets, direct stable endpoint, current updater bytes, and complete localized Pages snapshot after publication. | Reopen for every later public version. |
| Assigned complete macOS-plus-Linux version and predecessor contract | Passed for proposed 0.1.8 | Publication metadata assigns stable sequence 9 to version 0.1.8. Upgrade-matrix version 2 declares 0.1.7 on `darwin-aarch64` with library schema 37 as the exact recovery baseline. Stable-v3 retains the active `stable.primary-1` updater trust. | Keep the version, target set, predecessor, release notes, guides, manifest, and public snapshot identical in the exact candidate. |
| Independent release-checksum authority | Open external gate for 0.1.8 | The versioned release-signing configuration is deliberately inactive and contains no public key. No checksum signature can be admitted until the separately held public key is reviewed and activated. | Generate and preserve the independent key outside the repository, activate its public key as `release.primary-1`, and install the private authority only in the protected release environment. |
| Exact 0.1.8 macOS-plus-Linux candidate, native admission, and publication | Awaiting exact candidate | Linux package and complete-platform composition engineering pass for the frozen product baseline. No immutable 0.1.8 tag, sealed candidate, Ubuntu 24.04 and 26.04 admission record, GitHub Release, or stable sequence 9 snapshot exists. | Build once from the authorized tag, admit the sealed bytes on both Ubuntu versions, then explicitly promote and remotely verify the same candidate. |

## Final acceptance rule

FitFreed 0.1.7 satisfies this rule and is the supported public macOS release. Every applicable row is **Passed** for
one exact immutable source and candidate, both GitHub approval records correspond to workflow `34650206971`, and no
required evidence belongs only to a development, synthetic, ad-hoc, private-alpha, earlier-source, or rebuilt
artifact.

The release decision must record the exact tag, source revision, immutable workflow run, Release URL, Pages deployment, manifest digest, sealed-candidate experience result or documented non-applicability decision, and final remote verification. It must not record secret values, personal data, participant identity, machine-local paths, exact workstation details, or raw diagnostics.
