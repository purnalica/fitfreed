# Private Development Packages

## Current status

FitFreed has no supported alpha release. A private development package is unsigned, non-notarized evidence for synthetic-data evaluation; it is not a public release and must not be used with a real personal export. Read the [project disclaimer](../../DISCLAIMER.md) before handling one.

## Verify before opening

Keep the complete version directory together. From that directory, verify the regular evidence files before mounting the DMG:

```bash
shasum -a 256 -c SHA256SUMS
```

Every line must report `OK`. The machine-readable `release-manifest.json` identifies the exact source revision, version, architecture, storage schema, unsigned status, artifact digests, and dependency-inventory generator versions. A checksum failure means the package must not be mounted, copied, or launched.

## Evaluation boundary

The automated verification command in the source repository is the canonical installation test. It uses the real DMG but installs and launches only inside a disposable directory with an isolated synthetic library.

Do not weaken macOS security settings or remove quarantine metadata to force an unsigned package to open. If macOS refuses it, stop and report the exact privacy-safe message. Do not install a private development package over an application or library that matters.

Removing the application bundle does not remove its separate library. This protects data from accidental application removal, but it also means removal is not a privacy erasure operation. Supported installation, update, backup, recovery, complete removal, and real-data instructions will arrive with the release that implements those product contracts.

## Reporting a problem

Include the manifest version and source revision, macOS version, architecture, failed checksum file name or sanitized error, and the step that failed. Never attach the package if its sharing authority is unclear. Never attach a real export, application library, route, screenshot, log, or diagnostic containing personal data.
