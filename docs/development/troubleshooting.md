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
| Packaged picker, restart, or accessibility failure | Desktop E2E boundary | Run `npm run verify:e2e` and inspect `.artifacts/e2e/evidence`. The WebdriverIO service embeds its driver; a global `tauri-driver` is not required. |
| Production package contains test capabilities | Packaging boundary | Rebuild with `npm run package`, then run `npm run check:production-bundle`. Do not distribute the instrumented E2E package. |

## Generated and private state

Builds, synthetic fixtures, isolated E2E libraries, and failure evidence live in ignored output directories. The normal development application uses the operating system's application-data directory and must never be treated as disposable test state.

Before sharing diagnostic output, remove machine-local paths and verify that it contains no provider export name, personal value, credential, application library content, or private email address. The repository [content policy](../repository-content-policy.md) and [security policy](../../SECURITY.md) remain applicable to issue and pull-request evidence.

## Escalation evidence

A useful report includes the failing command, operating-system version and architecture, the first root-cause error, whether the failure reproduces after a clean `npm ci`, and the smallest independently constructed synthetic scenario. It does not include a personal export or a modified copy of one.
