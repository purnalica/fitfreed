# Contributor Troubleshooting

## Diagnostic order

Start from the repository root and preserve the first failing command and its complete non-sensitive output:

```sh
npm run doctor
npm ci
npm run test:fast
```

If the fast lane passes, run the smallest command that owns the failing boundary before returning to `npm run verify:full`. Do not bypass a failed check, delete its assertion, disable framework validation, or replace the required packaged journey with a browser preview.

## Failure ownership

| Symptom | Owning boundary | Diagnostic action |
|---|---|---|
| Node.js, npm, Rust, `rustfmt`, Clippy, or Xcode tool mismatch | Development environment | Run `npm run doctor` and correct the unsupported version or missing component it reports. |
| `npm ci` rewrites `package-lock.json` | JavaScript toolchain or an already inconsistent lockfile | Confirm `npm run doctor` passes, restore no files automatically, and inspect the lockfile diff before continuing. |
| Domain or application dependency rejection | Clean Architecture contract | Run `npm run check:architecture` and remove the outward dependency from the inner crate. |
| Schema, mapping, or field mismatch | Data contract | Run `npm run check:data-contracts`; update implementation, immutable migration, specification, and synthetic evidence together. |
| Missing translation or plural structure | Locale catalog | Run `npm run check:i18n` and compare the affected key with canonical `en-US`. |
| Presentation behavior failure | React presentation | Run `npm test`; preserve the user behavior protected by the failing assertion. |
| Rust behavior failure | Domain, application, or adapter | Run `npm run test:rust` and diagnose the first causal failure before editing production code. |
| Windows host job rejects the environment, portable command, or evidence marker | Windows native portability boundary | Run `npm run doctor`, `npm run test:windows-scripts`, and `npm run check:windows-ci-workflow` from PowerShell. The supported host is x86-64 MSVC with the pinned toolchains. Do not substitute a POSIX shell, edit the cache marker, or treat hosted Windows Server success as packaged Windows 11 evidence. |
| Packaged Windows capability setup, restart, or removal fails | Isolated NSIS E2E boundary | Preserve `.artifacts/e2e/evidence`, diagnose the first failed `preflight`, `install`, journey, or `remove` phase, and rerun `npm run verify:windows-e2e` from native x86-64 Windows PowerShell. Do not delete a pre-existing `fitfreed-e2e` installation or application-data directory automatically; it is rejected to protect unrelated local state. Hosted success is not exact Windows 11 desktop evidence. |
| Dense-history import, changed-container reimport, active-reconciliation navigation, storage, session-page, overview, or exact-page budget fails | Archive mapping, reconciliation, Tauri command dispatch, SQLite physical storage, or application query boundary | Run `npm run benchmark:dense-history` once and retain its privacy-safe JSON. Separate first import, exact repeat, logically equivalent changed-container reconciliation, late-reconciliation Home and History latency, checkpointed database bytes, session discovery, bounded overview, and exact pagination before changing code. A storage failure is not a query-budget failure, and the accepted workload or budget must not be reduced to obtain a pass. |
| Daily-activity or training read-model p95 exceeds its budget | SQLite query or application calculation | Run `npm run benchmark:insights`; retain the synthetic scale, host, run policy, domain, and per-interaction JSON fields, then isolate query and calculation time without changing the budget. |
| Packaged picker, restart, or accessibility failure | Desktop E2E boundary | Run `npm run verify:e2e` and inspect `.artifacts/e2e/evidence`. The WebdriverIO service embeds its driver; a global `tauri-driver` is not required. |
| Archive chooser reports that it cannot open in a manually launched bundle | Packaging identity boundary | Quit that bundle. Build the ordinary application with `npm run package:app`, verify it with `npm run check:production-bundle`, and open `src-tauri/target/release/bundle/macos/FitFreed.app`. The instrumented application lives only under `src-tauri/target/e2e` and requires WebdriverIO mocks. |
| Packaged Insights p95 exceeds its budget | Tauri transport, React update, or WebView rendering | Compare the failing domain in the packaged JSON with `npm run benchmark:insights`. Investigate only the remaining transport and render boundary after confirming the read-model result; WebDriver transport is outside the timed interval. |
| Cold launch reports no interactive shell while the application process remains alive | macOS graphical-session and painted-shell evidence boundary | Confirm that no prior FitFreed test process remains, the production bundle passes inspection, and an isolated launch reaches schema and preference initialization. If no startup signal follows, the WebView did not deliver the application-owned animation-frame boundary in the current graphical session. Do not extend the timeout, substitute process lifetime, or count the unpainted fallback as evidence. Preserve the failed gate and run the unchanged bundle in an active logged-in macOS graphical session or the maintained hosted environment. |
| Production package contains test capabilities | Packaging boundary | Rebuild with `npm run package`, then run `npm run check:production-bundle`. Do not distribute the instrumented E2E package. |
| Linux package identity, dependency, installation, or removal verification fails | Debian package boundary | Run `npm run package:linux`, `npm run verify:linux-package`, and then `npm run verify:linux-installation` on an x86-64 Linux host. Diagnose the first failed phase and preserve the exact package bytes; do not extract, rename internally, convert, or manually copy files to obtain a pass. |
| Linux disk-exhaustion gate fails | SQLite durability or isolated-filesystem boundary | Run `npm run verify:linux-filesystem-reliability` once on Linux with working `sudo mount` and `sudo umount`. Distinguish mount admission, real `ENOSPC`, failed-import invisibility, startup recovery, committed-history equality, SQLite integrity, retry, and unmount. Never point the test environment variable at a normal library or replace the real filesystem boundary with an injected error. |
| FitFreed rejects an existing Linux application-data directory or database before startup | Local-library filesystem boundary | Preserve the exact directory without changing links or ownership. Check whether the direct application-data directory is a symbolic link, belongs to another user, or permits group or other access, and whether `fitfreed.sqlite` is not a single-link regular file owned by the current user. Do not follow, replace, or relax the rejected object as an automated repair. |
| A corrupt Linux library or concurrent writer blocks an operation | SQLite library boundary | Preserve the original library and first error. Corrupt input must remain byte-identical; an active competing writer must leave committed history readable and permit the same operation after the lock is released. Do not delete the database, its sidecars, or the competing process state as a test shortcut. |
| macOS packaging remains inside `bundle_dmg.sh` with `osascript` waiting on Finder | Interactive DMG layout boundary | Confirm the `.app` build has completed and inspect the exact `osascript` and mounted temporary image before interrupting anything. A graphical Finder session and macOS Automation permission may be required. `npm run tauri -- build --bundles app` can isolate application-bundle diagnosis, but it does not replace the required DMG release gate. |
| Update installation is not offered | Update policy or ordinary unconfigured build | Run an explicit check. An install action exists only for a newer compatible release authenticated by the configured channel; ordinary development builds intentionally have no endpoint or trust key. |
| Verified update cannot start its recovery monitor | Installation recovery boundary | Preserve the fixed localized error code and run the packaged update E2E gate. Do not delete `update-recovery`, the application, or the library as a retry strategy. |
| Application does not reopen after an update attempt | Watchdog or candidate confirmation boundary | Wait for bounded automatic recovery, then reopen FitFreed. Preserve the application-data directory before further installation attempts and report only sanitized evidence. |
| Updated or recovered notice cannot be dismissed | Recovery outcome acknowledgement boundary | Keep the notice visible and retry from the application. Do not remove `last-outcome.json` or another recovery file manually; preserve the application-data directory if the failure persists. |
| Synthetic packaged update does not reach `confirmed` or `recovered` | Signed-channel, native replacement, candidate, or watchdog boundary | Run `npm run verify:update-e2e` and inspect only `.artifacts/update-e2e/evidence`. Confirm `npm run doctor` passes and no unrelated FitFreed test process is active. The command creates isolated ports and state; a global `tauri-driver`, external endpoint, or production key is not required. |

## Generated and private state

Builds, synthetic fixtures, isolated E2E libraries, and failure evidence live in ignored output directories. The normal development application uses the operating system's application-data directory and must never be treated as disposable test state.

Before sharing diagnostic output, remove machine-local paths and verify that it contains no provider export name, personal value, credential, application library content, or private email address. The repository [content policy](../repository-content-policy.md) and [security policy](../../SECURITY.md) remain applicable to issue and pull-request evidence.

## Escalation evidence

A useful report includes the failing command, operating-system version and architecture, the first root-cause error, whether the failure reproduces after a clean `npm ci`, and the smallest independently constructed synthetic scenario. It does not include a personal export or a modified copy of one.
