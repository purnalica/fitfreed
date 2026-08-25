# X6 Product-Experience Human Evaluation

## Status and boundary

**Paused since 2026-08-25 because the prepared application was not valid for native-boundary evaluation.
X6 is not accepted.**

This document is the canonical privacy-safe record of the human product-experience evaluation required by
the [X6 profile](../testing/macos-candidate-manual-evaluation.md#x6-product-experience-profile). It records
observable behavior and bounded participant impact without retaining personal fitness data, source paths,
screenshots, raw logs, routes, dates, values, participant identity, or exact workstation details.

The initial application was a clean, manually launched instrumented macOS build from source
`52fa9e949f5aaf5b4e4fccab995bfa646f0bc497`. Its executable inputs match hosted fingerprint
`3e0c2eb1dddc33cd295c8b6b504650b32e392589d396b7f835f53dec4f68e9d8`, which passed [repository
safety](https://github.com/purnalica/fitfreed/actions/runs/32743509862) and the [complete hosted
campaign](https://github.com/purnalica/fitfreed/actions/runs/32743509696). The application uses an isolated,
ignored library on local Apple Silicon. A participant-authorized personal export may be imported, but no
personal observation enters this record. That build was later proven unsuitable for this human session
because its instrumented native-boundary commands do not provide the production dialogs and external-opening
behavior. No observation from this invalid session is accepted as production-product evidence.

This evaluation can accept or reopen the X6 product experience only. It cannot accept signing,
notarization, installation trust, update recovery, a release candidate, or public distribution.

## Findings

### XH-01 — Acquisition actions produced no observable result in the invalid instrumented build

- **Status:** requires reproduction in the production build; not currently classified as a product defect.
- **Observed task:** obtain guidance from the empty-library `Import your fitness history` journey using a
  pointer.
- **Observed behavior:** `Show me how` produced no visible transition. `Open official account page` and
  `Open official instructions` produced no visible application response and did not open the default browser.
- **Expected behavior:** the in-application guidance action reaches the promised acquisition guidance, and
  each explicitly external action opens its stated official destination or presents an actionable failure.
- **Participant impact:** a new person cannot complete the promised provider-export acquisition journey and
  receives no explanation that the action failed. This breaks a primary empty-library route before personal
  value can be reached.
- **Disposition:** do not reopen X5-R2.2 from this evidence alone. Repeat each action in the production build
  after correcting the evaluation procedure. The in-application action and external actions share one observed
  failure surface, but no shared technical cause is assumed before diagnosis.

### XH-02 — Instrumented application invalidated the native-boundary evaluation

- **Status:** open; major evaluation-process failure and session blocker.
- **Observed task:** select a personal ZIP from the empty-library import journey.
- **Observed behavior:** no native macOS file-selection sheet appeared. The participant recognized the same
  instrumented-build limitation encountered during earlier E2E work and closed the application.
- **Expected behavior:** the X6 human profile launches production native-boundary commands against an isolated
  library so archive selection, cancellation, external guidance, and browser opening can be evaluated directly.
- **Impact:** archive import could not begin, the acquisition observations cannot be attributed to production,
  and continuing would create false human evidence.
- **Disposition:** invalidate the session, correct the manual X6 launch profile, prove the production build uses
  the isolated library without changing its native commands, and restart evaluation from clean first use.

## Evaluation state

The session is stopped. X6 remains failed until the evaluation-process defect is corrected, every valid
critical or major product finding receives regression evidence and applicable exact hosted verification,
and the human evaluation is repeated successfully from a clean production build.
