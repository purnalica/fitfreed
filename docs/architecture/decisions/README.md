# Architecture Decision Records

This directory contains durable FitFreed architecture decisions. Read [the documentation policy](../../documentation-policy.md) for the distinction between decision history and current thematic architecture.

## Workflow

1. Copy `template.md` to the next monotonically numbered `NNNN-short-title.md` file.
2. Set the status to `Proposed` while credible structural alternatives are being evaluated.
3. Link evidence, prototypes, benchmarks, requirements, and affected architecture documents.
4. Change the status to `Accepted` only when the decision owner has the required evidence and authority.
5. Update current thematic architecture in the same change.
6. Never rewrite an accepted decision to make it appear current. Create a new ADR and mark the old one `Superseded by ADR NNNN`.

## Index

- [ADR 0001: Select the Tauri application stack](0001-select-tauri-application-stack.md) — Accepted on 2026-08-16.
- [ADR 0002: Select SQLite as the single system of record](0002-select-sqlite-storage.md) — Accepted on 2026-08-16.
- [ADR 0003: Stage verifiable macOS development releases](0003-stage-verifiable-macos-development-releases.md) — Accepted on 2026-08-16.
- [ADR 0004: Adopt capability and lifecycle bounded contexts](0004-adopt-capability-and-lifecycle-bounded-contexts.md) — Accepted on 2026-08-16.
- [ADR 0005: Use library-scoped source-subject correlation](0005-use-library-scoped-source-subject-correlation.md) — Accepted on 2026-08-16.
- [ADR 0006: Use typed source-specific recovery components](0006-use-typed-source-specific-recovery-components.md) — Accepted on 2026-08-17.
- [ADR 0007: Compose longitudinal Insights by origin and date](0007-compose-longitudinal-insights-by-origin-and-date.md) — Accepted on 2026-08-17.
- [ADR 0008: Authenticate update policy above the Tauri updater](0008-authenticate-update-policy-above-tauri.md) — Accepted on 2026-08-17.
- [ADR 0009: Bound package transfer inside the Tauri updater](0009-bound-package-transfer-inside-tauri-updater.md) — Accepted on 2026-08-17.
- [ADR 0010: Run update recovery from the preserved application](0010-run-update-recovery-from-the-preserved-application.md) — Accepted on 2026-08-17.
- [ADR 0011: Schedule update discovery in the desktop host](0011-schedule-update-discovery-in-the-desktop-host.md) — Accepted on 2026-08-17.
- [ADR 0012: Publish two-dimensional upgrade support](0012-publish-two-dimensional-upgrade-support.md) — Accepted on 2026-08-17.
- [ADR 0013: Render MVP visualizations with semantic HTML](0013-render-mvp-visualizations-with-semantic-html.md) — Accepted on 2026-08-17.
- [ADR 0014: Drive packaged macOS E2E with WebdriverIO](0014-drive-packaged-macos-e2e-with-webdriverio.md) — Accepted on 2026-08-17.
- [ADR 0015: Qualify performance evidence by execution environment](0015-qualify-performance-evidence-by-execution-environment.md) — Accepted on 2026-08-17.
- [ADR 0016: Support Apple Silicon on macOS 15 or later](0016-support-apple-silicon-on-macos-15-or-later.md) — Accepted on 2026-08-17.
- [ADR 0017: Split public download and update hosting](0017-split-public-download-and-update-hosting.md) — Superseded by ADR 0020 on 2026-08-18.
- [ADR 0018: Publish through one protected evidence pipeline](0018-publish-through-one-protected-evidence-pipeline.md) — Superseded by ADR 0019 on 2026-08-18.
- [ADR 0019: Separate candidate build from public promotion](0019-separate-candidate-build-from-public-promotion.md) — Accepted on 2026-08-18.
- [ADR 0020: Compose the product site and update channel in one Pages deployment](0020-compose-product-and-update-pages.md) — Accepted on 2026-08-18.
- [ADR 0021: Model training detail as attributed evidence](0021-model-training-as-attributed-evidence.md) — Accepted on 2026-08-18.
- [ADR 0022: Persist reproducible evidence reports](0022-persist-reproducible-evidence-reports.md) — Accepted on 2026-08-18.
- [ADR 0023: Use fitfreed.org as the public origin](0023-use-fitfreed-org-as-the-public-origin.md) — Accepted on 2026-08-18.
- [ADR 0024: Generate localized product pages from one source](0024-generate-localized-product-pages.md) — Accepted on 2026-08-18.
- [ADR 0025: Normalize dense signal storage by series identity](0025-normalize-dense-signal-storage.md) — Accepted on 2026-08-20.
- [ADR 0026: Use Leaflet for the local route workbench](0026-use-leaflet-for-the-local-route-workbench.md) — Accepted on 2026-08-22.
- [ADR 0027: Resolve sport identity from versioned provider evidence](0027-resolve-sport-identity-from-versioned-provider-evidence.md) — Accepted on 2026-08-25.

Confirmed product constraints remain in `docs/requirements.md`. Public release execution and any future mandatory-update policy remain open until their evidence and product authority gates close.
