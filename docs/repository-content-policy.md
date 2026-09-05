# Repository Content Policy

## Status

Confirmed policy. The initial workspace audit was performed on 2026-08-15, and the publication candidate and reachable GitHub history were reviewed before public publication on 2026-08-17. A later audit found exact local benchmark-host fields in older documentation. The reachable history was rewritten from the first affected snapshot, affected workflow records were removed, default-branch force-push protection was restored, and every snapshot reachable from a fresh public clone was rescanned. Invalidation of the provider's now-unreachable direct-commit cache requires GitHub Support and remains open; no affected branch or tag is published. Public visibility was approved only with a confidential security-reporting route and default-branch protection. Version control, regardless of visibility, is not an approved store for personal exports, credentials, or machine-local state.

## Purpose

The repository is the durable, reviewable source of truth needed to build, test, understand, translate, package, and contribute to FitFreed from a clean clone. It is not a backup of a maintainer's workstation or a store for private research inputs.

Every versioned artifact must have a current, durable purpose for at least one defined audience or automated process. Material does not belong in the repository merely because it was useful during discovery, records a discussion, or might conceivably be useful later. Historical deliberation remains local unless its rationale is still needed to understand or safely evolve a confirmed decision; in that case, the durable rationale belongs in the relevant canonical document or architecture decision record rather than in an uncurated transcript of alternatives.

## Content that belongs in version control

- Product source code, database schemas and migrations, tests, and deterministic build configuration.
- Dependency lockfiles used by the application and its build or documentation toolchains.
- Small synthetic fixtures and versioned generators that satisfy the fixture review rules below.
- Canonical English requirements, architecture, decisions, plans, compatibility documentation, user documentation sources, and contributor documentation.
- `en-US`, `es-ES`, and later localization resources containing no personal values.
- Reproducible automation for development, continuous integration, packaging, security, licensing, translation, documentation, and release preparation.
- Repository community and governance files, including the README, license, contribution guide, code of conduct, security policy, support policy, governance policy, issue templates, and pull-request template.
- Small original visual assets and third-party assets whose provenance, license, and redistribution terms are documented and compatible with the project.
- Public verification material such as checksums or public signing keys when its publication is intentional. Private signing material never belongs in the repository.

## Content that remains local

- Real Polar Flow, Garmin, or other provider exports, whether compressed, extracted, transformed, redacted, or partially copied.
- Values derived from a person's export, including local databases, Parquet files, cached queries, reports, routes, screenshots, logs, benchmarks, crash dumps, and diagnostic bundles.
- Exact local paths, archive identifiers, user identifiers, device identifiers, account metadata, timestamps, coordinates, physiological values, and other information that can identify or characterize a private reference data set.
- Exact maintainer or participant workstation details, including hardware model, processor model, memory capacity, display configuration, operating-system version or build, free-storage figures, and host identifiers. Local benchmark and evaluation tools may collect these details for validity, but their raw outputs remain local.
- Credentials, tokens, cookies, environment overrides, signing keys, certificates containing private keys, notarization profiles, and recovery material.
- Git internals, IDE user state, operating-system metadata, caches, temporary files, build outputs, installers, update payloads, and generated large-scale benchmark data.
- External analyses, exploratory notes, and research reports are non-binding inputs rather than project decisions. The current `docs/reports/` directory is local-only. A conclusion from it enters version control only after independent verification and incorporation into the appropriate canonical English requirement, architecture decision, roadmap, or research document.
- Session-specific authority, account, or tool state that would become stale or grant unintended permissions to another contributor or automation agent.

Local project material should live under the ignored `.local/` directory when it must remain inside the workspace. Particularly sensitive or large personal inputs should remain outside the workspace entirely.

## Content requiring explicit review

### Synthetic fixtures

A fixture may be versioned only when all of the following are true:

- It is independently constructed from documented structural knowledge rather than copied and edited from a real export.
- Its names, identifiers, timestamps, routes, measurements, free text, and relationships are deliberately fictional.
- It is the smallest artifact that proves a documented behavior or compatibility case.
- A reviewer can trace every field to the scenario it exercises.
- Privacy and secret scans find no personal or credential material.

Schema names and structural observations may be documented when required for interoperability, but examples must use independently created values.

### Screenshots, recordings, reports, and benchmark baselines

These may be versioned only when generated entirely from synthetic state, stripped of machine metadata and local paths, small enough for normal Git review, and needed by durable documentation or regression verification. Versioned benchmark evidence contains only the source and application identity, scenario, run policy, aggregate measurements, result, and whether the run used hosted macOS or local Apple Silicon. Exact local host details and raw benchmark runs remain local. Large generated scenarios remain local or in access-controlled continuous-integration artifacts with an explicit retention policy. Provider-controlled metadata exposed by a linked public continuous-integration run is governed by that provider and must not be copied into project documentation.

### Generated and third-party content

Generated files are versioned only when a clean clone cannot reliably reproduce them at the point where they are required or when they are an intentional distribution source. The generating command and source of truth must be documented. Third-party content requires recorded provenance and license compatibility before staging.

The pinned Tauri updater source under `src-tauri/vendor/tauri-plugin-updater/` is an approved third-party source refinement governed by [ADR 0009](architecture/decisions/0009-bound-package-transfer-inside-tauri-updater.md). Its local README, machine-readable file and checksum allowlist, original Apache-2.0 and MIT licenses, exact path dependency, dedicated tests, and update procedure are mandatory. Git attributes pin every detected text file to LF and preserve detected binary bytes, independent of a checkout's `core.autocrlf` setting. The complete checksum-governed updater subtree retains an explicit LF rule. Crate-local lockfiles, build output, and generated permission schemas remain local and must not be staged.

Proposed visual resources under `docs/reports/art/` are local design inputs, not documentation or approved application assets. They were provided by the project owner as original, AI-assisted work with no declared third-party source assets. This provenance does not replace verification of the generator terms, redistribution rights, embedded material, or confusing similarity to third-party identities. Before any file is moved or versioned, inventory the complete directory and every incoming reference, then evaluate authorship, source material, license, embedded metadata, external resources, accessibility, scalability, identity consistency, and concrete product use. Approved assets move to the canonical asset location selected for their actual consumer; rejected or superseded proposals remain local and must not be published.

### Editor configuration

User-specific editor directories remain local. A minimal shared editor recommendation may be introduced later through an explicit, reviewed decision when it improves contributor onboarding without imposing one editor.

## Staging and publication gate

Before the first commit, every public release, and any initial publication of previously private history:

1. Stage an explicit allowlist of reviewed paths. Do not use a broad `git add .` as the initial-publication workflow.
2. Inspect tracked, untracked, ignored, and symbolic-link state.
3. Scan the complete candidate content and outgoing Git range for secrets, private email addresses, personal values, archive identifiers, machine-local paths, and exact maintainer or participant workstation details.
4. Review file sizes, binary files, generated artifacts, provenance, and license compatibility.
5. Inspect the staged diff and Git author, committer, tagger, signature, and trailer metadata.
6. Verify that a clean clone contains everything required by the documented contributor workflow and none of the local-only inputs used by maintainers.

`.gitignore` reduces accidental staging but is not a security boundary. Once the technology stack is selected, versioned local and continuous-integration checks will enforce this policy and fail closed before publication.

## Current workspace classification

| Path | Classification | Required action before first commit |
|---|---|---|
| `.gitignore` | Versioned | Keep local-data exclusions and extend them for the selected stack. |
| `AGENTS.md` | Versioned | Keep durable project rules; exclude session-specific permission state. |
| `docs/**/*.md` except `docs/reports/` | Versioned after review | Remove private paths and data-set fingerprints; retain canonical English knowledge. |
| `docs/reports/` | Local, external, and non-binding | Preserve for consultation. Independently verify any useful conclusion and incorporate it into its canonical English destination rather than versioning the source report. |
| `docs/reports/art/` | Local, proposed AI-assisted visual material | Inventory and evaluate every resource. Version only approved assets after provenance and redistribution review and relocation to their canonical consumer-owned location. |
| `.idea/` | Local | Keep ignored. |
| `.git/` | Local | Never copy, package, or stage. |
| Private reference exports outside the workspace | Local and sensitive | Read only for authorized local analysis; never copy into the workspace or repository. |

## Public-repository completeness gate

The repository remains private until the reviewed initial history also contains, at minimum, a concise README, the complete `GPL-3.0-or-later` license text, contribution guidance, a code of conduct, a security-reporting policy, a support policy, governance information, and the automation needed to detect secrets and private email disclosure.

## Public repository operation

Public GitHub Actions logs and artifacts are part of the publication boundary. Workflows must not receive real provider exports or other personal data, and diagnostic artifacts must be generated exclusively from synthetic inputs. Raw synthetic failure evidence is retained for no more than seven days unless a shorter retention period is configured.

[GitHub private vulnerability reporting](https://github.com/purnalica/fitfreed/security/advisories/new) is the canonical confidential channel for suspected vulnerabilities. Public issues, discussions, pull requests, and social channels must not be used for security reports.

The default branch must reject force pushes and deletion. Repository safety and continuous-integration workflows use standard GitHub-hosted runners so that public-project automation remains available without consuming private-repository runner minutes. Security scanning and dependency alerts remain enabled whenever GitHub supports them for the repository.
