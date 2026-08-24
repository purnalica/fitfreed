# MVP Product-Experience Reaudit

## Status and verdict

Audited on 2026-08-24 against the packaged macOS application built from source
`da8c0ee8c7f36b8e76178ef60b9df90abd5b0b64`.

The machine-assisted X6 audit is **accepted with no unresolved critical or major finding**. The
redesigned application now composes the implemented MVP into a coherent first-use journey: it explains
its local boundary, turns a safe import into recognizable history, leads an outdoor session with its
route, adapts detail to available evidence, keeps exact source facts available on request, and makes a
saved report readable and exportable before exposing composition controls.

Two defects were found and corrected during the audit. One duplicated the accessible name of the import
coverage region; the other repeated unavailable measurements throughout a partial-session overview. Both
corrections have focused regression tests and passed the fresh packaged audit. They are recorded below
rather than omitted from the verdict.

This verdict does not complete product acceptance. Exact [repository-safety run
`32743509862`](https://github.com/purnalica/fitfreed/actions/runs/32743509862) and [hosted campaign
`32743509696`](https://github.com/purnalica/fitfreed/actions/runs/32743509696) pass for corrected source
`246faed` and executable-input fingerprint
`3e0c2eb1dddc33cd295c8b6b504650b32e392589d396b7f835f53dec4f68e9d8`. The documented human gate must
still evaluate real native archive selection, complete keyboard use, VoiceOver in both locales, scaling,
contrast, reduced motion, realistic comprehension, and the subjective desire to continue using the product.
FitFreed 0.1.0 remains unavailable as a public application.

## Audit question

The reaudit asks whether the ordinary application now lets a person reach and retain useful control over
owned fitness evidence without understanding FitFreed's architecture:

> understand the local tool → obtain and import an export safely → recognize personal history → find and
> investigate a session → define personal meaning → preserve and export a useful result

The historical [product-experience audit](mvp-product-experience-audit.md) remains the immutable diagnosis
that triggered the redesign. This document records the new inspection and disposition; it does not rewrite
that baseline.

## Method and independence boundary

The inspection began from a clean synthetic library and used the release-shaped packaged Tauri
application rather than a browser preview or prototype. It deliberately treated only observable behavior
as evidence and did not accept milestone status, implementation intent, or existing test names as proof.
It covered three complementary journeys:

1. clean first run through acquisition guidance, import, Home, a remembered routed session, personal
   range creation, every evidence section, origin-aware return, History, report creation, editing, export,
   deletion, settings, Spanish, dark appearance, compact layout, and 200% content zoom;
2. active import, cancellation, invalid input, deliberate recovery, exact repeat, cumulative extension,
   explicit coverage, and preservation of an existing library after rejection; and
3. focused-map use, an honest route-to-signal relationship boundary, a genuinely partial session, and a
   report becoming stale and current again only after explicit refresh review.

The three fresh runs captured 47 application states. None had page-level horizontal overflow and none
produced an Axe violation within the main application surface. All fixtures, databases, exported reports,
screenshots, and observations were synthetic, local, ignored evidence; no personal export, personal value,
machine-local path, or workstation fingerprint is versioned.

After the focused corrections, the maintained packaged campaign also passed its complete functional
journey, real-process restart, adaptive-session journey, adaptive-session restart, and two-year Insights
performance suite. The partial-session E2E assertion was adapted from fixed positional cells to the same
semantic contract: absent measurements create no rows, recorded zero remains present, and the rest of the
session summary retains its ordered meaning.

The exact hosted campaign then passed the portable lane in 4 minutes and 27 seconds and the complete macOS
lane in 1 hour, 3 minutes, and 27 seconds. It retained every product-performance budget and operation
watchdog while exercising cold launch, full-scale import, dense History, two-year Insights, update recovery,
installation boundaries, the complete functional package, native replacement, and rejected-candidate recovery.
The immutable evidence job records the executable-input fingerprint above.

This is independent from implementation claims, not an organizationally independent human study. The
same development process constructed the audit harness. The final human gate therefore remains essential.

## X6 outcome matrix

| X6 question | Observable result | Boundary still requiring a human |
|---|---|---|
| Five-second purpose and trust | Clean first run leads with owned history, local processing, no account, one import action, and restrained factual language. | Confirm first-impression comprehension without prior project context. |
| Acquisition and archive selection | Provider guidance is available from the empty state and Sources; choosing, cancelling, replacing, and importing a ZIP have coherent application states. | The deterministic audit substituted the native path return. Exercise the real macOS sheet and cancellation path. |
| Safe import, repeat, extension, and recovery | Active progress remains visible; cancellation and rejection preserve the library; exact repeat is distinguished from extension; coverage is explicit on request. | Confirm the language feels calm and understandable with a realistic export. |
| First recognizable result | Import completion returns to a result-led Home with time span, sports, recent sessions, useful questions, and one direct continuation into owned evidence. | Decide whether the first result is personally compelling with recognizable history. |
| Session discovery and return | A recent session opens directly, History begins with results, filters remain secondary, and return restores the exact origin and focus. | Confirm recall and orientation with personally remembered sessions. |
| Outdoor investigation and partial honesty | Route evidence leads the session, expands into a focused map, supports point movement and named ranges, keeps signals and exact evidence accessible, and does not imply an unproven route-to-signal relationship. Partial sessions omit unavailable sections and repeated empty measurements. | Assess real route usefulness, map interaction quality, and comprehension of relationship boundaries. |
| Personal control | A person can create, name, adjust, save, reopen, and inspect a range against recorded evidence; source structure and reusable criteria remain separate from authored ranges. | Evaluate whether the Alpha interaction is understandable without coaching. |
| Reports and data exit | A report opens as a result, enters editing deliberately, becomes stale after library change, refreshes only after review, exports self-contained HTML to a chosen destination, and can be deleted without deleting the exported file. | Evaluate whether the Alpha report identity and export review match ordinary expectations. |
| Settings and adaptive access | Language, appearance, and zoom are durable tasks; the inspected Spanish, dark, compact, 200% state remains coherent; semantic automation is clean. | Traverse every control by keyboard; use VoiceOver in both locales; observe contrast, reduced motion, and all required geometries. |
| Reason to continue | The product offers recognizable history, evidence-backed questions, route investigation, personal ranges, durable reports, and independent export without an account. | Desire and perceived long-term value are human judgments and are not inferred from automation. |

## Findings corrected during the audit

| ID | Severity | Finding | Root cause and correction | Regression evidence |
|---|---|---|---|---|
| XR-01 | Accessibility defect | Expanded import coverage exposed two regions with the same accessible name. | The outer semantic section and inner scrollable table region shared one label. Only the operable scroll region now owns the heading relationship. | The coverage panel asserts exactly one named region; the fresh import journey reports no Axe violation. |
| XR-02 | Major experience defect | A partial-session overview repeated `Not recorded` across fixed distance, energy, and heart-rate cards after already explaining the evidence boundary. | The overview rendered a fixed measurement inventory instead of composing from recorded evidence. Optional rows are now present only when the source value exists; exact zero remains visible. | Focused and maintained packaged tests protect omission, ordered meaning, and zero semantics; the fresh adaptive audit confirms the concise composition. |

No assertion was removed or weakened. Each new regression test preserves the user-facing behavior that
exposed the defect.

## Historical-finding disposition

| Baseline finding | Reaudit disposition |
|---|---|
| PX-01 — inventory-led Home | Resolved: Home leads with recognizable history and a supported personal continuation. |
| PX-02 — displaced import progress | Resolved: the active protected operation remains the primary Sources task. |
| PX-03 — unqualified dense-history storage | Resolved before the redesign and retained by schema 24+ and the hosted dense-history gate. |
| PX-04 — alarming compatibility language | Resolved: consequence and preservation lead; exact compatibility and coverage detail are deliberate disclosures. |
| PX-05 — filter-first History | Resolved: session results lead and structured refinements open on request. |
| PX-06 — anonymous sports | Resolved: distinct unknown identities remain recognizable and have contextual classification paths without guessing. |
| PX-07 — disconnected session sections | Resolved: an evidence-adaptive story and route workbench lead; deeper source evidence remains navigable. |
| PX-08 — weak visual context | Resolved for the MVP boundary: Answer Canvases and the local route workbench explain supported relationships without inventing them. |
| PX-09 — editor-first reports | Resolved: reports open as results and editing is a deliberate mode. |
| PX-10 — oversized repeated introductions | Resolved in inspected ordinary and compact states; useful content enters the initial task hierarchy. |

## Remaining gates

The following absence of evidence is deliberate and is not converted into an automated claim:

- a real native macOS archive sheet was not automated because the deterministic harness supplies a
  synthetic path through the dialog boundary;
- Axe and component focus assertions do not establish VoiceOver quality or complete keyboard usability;
- screenshots and geometry checks do not establish perceived contrast, motion comfort, comprehension, or
  usefulness; and
- synthetic histories prove composition and safety, not whether a person recognizes and values their own
  history.

The final evaluation follows the privacy-safe
[macOS candidate manual procedure](../testing/macos-candidate-manual-evaluation.md). A critical or major
human finding reopens the owning increment. Acceptance of this machine-assisted audit cannot override it.

## Disposition

The machine-assisted and exact hosted X6 boundaries pass. The next authorized action is the final product-owner
usability and accessibility gate under the X6 product-experience profile of the manual procedure. Public signing,
notarization, release creation, updater authority, exact-candidate acceptance, and download publication remain
separate Milestone 3 decisions.
