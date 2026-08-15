# External Feasibility Analysis Assessment

## Status

Active Milestone 0 decision input reviewed on 2026-08-15. The source report is an external, non-binding analysis stored under the ignored local `docs/reports/` directory. It is not a project requirement, decision record, or citable source of truth.

This document remains in the current tree only while it informs open technology and feasibility decisions. After those decisions are recorded in canonical requirements or architecture decision records, it must be removed unless it still provides distinct, durable rationale needed by contributors.

## Evaluation method

Consequential claims were checked against primary sources or the referenced implementation where possible. Confirmed product requirements and architecture constraints take precedence over recommendations in the report. Claims that cannot be established through the available evidence remain hypotheses and must not be presented publicly as facts.

## Executive assessment

The report identifies the correct opportunity: a local application that turns full provider exports into an understandable, durable personal history can deliver value that provider applications and bounded APIs do not. Its strongest recommendation is to prove that value through an early end-to-end import and exploration slice.

The report is weaker as an implementation plan. It understates logical reconciliation, overstates what an existing file-hash importer proves, recommends postponing already confirmed product constraints, and treats promising technologies as decisions before representative benchmarks exist. Its legal and competitive observations are useful inputs, but some are too broad or time-sensitive to reuse without qualification.

## Claim assessment

| Report proposition | Assessment | Project consequence |
|---|---|---|
| No existing open-source product fills the complete market gap. | Plausible but not proven. A search can establish known alternatives, not the absence of every current or future project. | Treat the gap as a product hypothesis. Create a repeatable, dated landscape review before making comparative public claims. |
| Polar AccessLink offers only a short recent window and cannot provide full history. | Directionally correct but imprecise. Current endpoint limits differ: activity queries can reach dates up to 365 days old in bounded ranges, while several sleep, recovery, and transactional resources expose shorter or post-registration windows. None of this is equivalent to a complete multi-year export. | Keep full-history takeout import as a differentiator. Never publish a universal API-history number; document each endpoint and date of verification. |
| `polar-loop-analyzer` demonstrates the required idempotent, incremental architecture. | Rejected. Its implementation uses whole-file JSON loading, filename-based dispatch, and SHA-256 file tracking. Identical-file detection is useful transport deduplication, but it does not establish logical entity identity, overlap reconciliation, atomic recovery, or explicit format coverage. Unknown files can be recorded as completed, and failures can leave tracking and imported data out of step. No repository license was detected at review time. | Use the project only as a behavioral reference. Do not reuse its code. FitFreed must distinguish archive, file, source-record, and domain identity and prove reconciliation through tests. |
| Complete the importer before building the desktop product shell. | Accepted only as an emphasis on early value, not as a separate prototype product. | The first executable increment will import a small synthetic ZIP through the real adapter and use cases, persist provider-neutral data, and display one useful historical result. A headless driver may support development and testing, but it must exercise the same application path as the desktop UI. |
| Defer Clean Architecture, DDD boundaries, automated testing, localization, documentation, and update design until after the first MVP. | Rejected. These are confirmed product constraints and several prevent expensive rework or unsafe distribution when established at the walking-skeleton stage. | Preserve the constraints from the first vertical slice while keeping their implementation proportional to that slice. Do not build speculative plug-in infrastructure or post-MVP product features. |
| DuckDB plus Parquet is the correct persistence stack. | Credible spike candidate, not a decision. DuckDB supports analytical queries, Parquet, and larger-than-memory workloads, but its own documentation identifies workload-specific memory limitations. FitFreed also needs transactional reconciliation, recoverable migrations, packaging, and predictable desktop resource use. | Benchmark DuckDB/Parquet against at least one transactional alternative using representative synthetic workloads and import-failure scenarios before selecting storage. |
| Tauri 2 is the correct desktop framework. | Credible spike candidate, not a decision. Its official tooling addresses installers, signing, notarization, release automation, and cryptographically signed updater artifacts, which align with FitFreed's distribution requirements. Accessibility, visualization performance, packaging size, recovery, testing, and contributor experience still require evidence. | Include Tauri in the technology spike. Select it only if the complete macOS-first build, test, package, update, and recovery path satisfies the quality targets. |
| A CLI, Datasette, or Grafana should be the first user-facing product. | Rejected as the MVP route. It would validate data plumbing but not the agreed desktop exploration experience, installation path, accessibility, localization, or update lifecycle. | Permit internal headless tooling and diagnostics only when they share production use cases and materially improve verification. Do not create a parallel product path. |
| Automatic updates can be deferred beyond the MVP. | Rejected. Safe update notification and cryptographic verification are confirmed MVP requirements, and update architecture affects packaging from the foundation milestone. | Preserve the private-alpha update path in the MVP and public signed/notarized distribution in the subsequent macOS milestone. |
| MIT, Apache-2.0, or AGPL should be considered. | Rejected because the project license is already confirmed as `GPL-3.0-or-later`. | Evaluate dependencies and third-party assets for GPL compatibility; do not reopen the product license without an explicit product decision. |
| Real export schemas or examples should be published directly to accelerate collaboration. | Rejected for real or derived personal material. Structural interoperability knowledge is valuable, but a personal export can contain routes, physiology, account details, device identifiers, and other sensitive values. | Publish independently constructed synthetic fixtures, compatibility documentation, and schema observations under the repository content policy. Never sanitize by copying a real record and merely replacing obvious values. |
| The EU Data Act strengthens the user-freedom argument. | Accepted as complementary legal context. The Regulation has applied since 12 September 2025, expressly covers connected-product data, and official Commission guidance includes medical and fitness devices. Its design obligation in Article 3(1) applies to connected products and related services placed on the market after 12 September 2026. | Keep GDPR-enabled portability plus open source as the founding thesis. Use the Data Act as a supporting modern context for connected-device data access and third-party innovation, with precise wording and no compliance claims. |

## Accepted implementation implications

1. Prioritize an observable import-to-insight vertical slice before broad visualization or reporting work.
2. Keep the import application workflow independent of the graphical interface and drive it through explicit ports.
3. Treat full format-family coverage, provenance, logical reconciliation, and failure recovery as differentiators rather than importer internals.
4. Evaluate technology with representative synthetic archives and release-shaped workflows instead of relying on feature lists.
5. Keep public differentiation claims dated, evidence-based, and narrower than the evidence they summarize.

## Explicit non-decisions

This assessment does not select a programming language, desktop framework, database, columnar format, charting library, packaging service, or release channel. It does not add a CLI product, hosted service, runtime plug-in system, or legal-compliance feature to the roadmap.

## Primary evidence reviewed

- [Polar AccessLink API documentation](https://www.polar.com/accesslink-api/)
- [Regulation (EU) 2023/2854, including Articles 3 and 50](https://eur-lex.europa.eu/eli/reg/2023/2854/oj/eng)
- [European Commission: Data Act explained](https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained)
- [DuckDB: Tuning Workloads](https://duckdb.org/docs/stable/guides/performance/how_to_tune_workloads.html)
- [DuckDB: Parquet Overview](https://duckdb.org/docs/stable/data/parquet/overview.html)
- [Tauri: Distribute](https://v2.tauri.app/distribute/)
- [Tauri Updater plugin](https://v2.tauri.app/plugin/updater/)
- [`neatnettech/polar-loop-analyzer`](https://github.com/neatnettech/polar-loop-analyzer)
