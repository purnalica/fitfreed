# FitFreed Linux Update Recovery Version 2

## Purpose and boundary

Version 2 records one x86-64 Debian-package update whose previous native package state, runnable application, and
library must remain recoverable together. It is Linux-local operational state. It is not a portable export, release
artifact, diagnostic attachment, or update-channel payload and must never be committed or uploaded.

The closed macOS version 1 contract remains unchanged. Another operating system, architecture, or package family
requires an explicit later contract rather than reinterpretation of version 2.

## Layout

```text
update-recovery/
├── active
├── last-outcome.json
├── outcome.lock
└── attempts/
    └── <recoveryId>/
        ├── candidate.lock
        ├── manifest.json
        ├── state.lock
        ├── watchdog.lock
        ├── candidate/
        │   └── package.deb
        └── previous/
            ├── package.deb
            ├── runnable/
            │   └── usr/bin/fitfreed
            └── fitfreed.sqlite
```

The `active`, outcome, lock, ownership, no-follow, durability, bounded-read, atomic-replacement, receipt, and
receipt-bound cleanup rules are identical to version 1. The version 2 `manifest.json` conforms to
[`update-recovery-v2.schema.json`](../../../schemas/update-recovery-v2.schema.json), remains limited to 64 KiB, and
uses only the fixed relative locations above. Package extraction must preserve the complete validated Debian layout;
the abbreviated tree shows only the required executable.

## Preparation and authenticated assets

Before candidate replacement, the Linux adapter derives the installed package identity through the native package
manager and obtains the exact predecessor package from a verified local cache or its authenticated immutable release
URL. It verifies the signed-channel entry, updater signature, size, SHA-256, Debian control identity, installed version,
architecture, and complete package inventory before copying it to `previous/package.deb`.

The adapter extracts that same package without executing maintainer scripts into `previous/runnable`, validates the
complete tree and required `usr/bin/fitfreed`, records a deterministic tree digest, and binds it back to the predecessor
package SHA-256. This image is a last runnable predecessor, not a replacement for native rollback. The independently
verified candidate package is copied to `candidate/package.deb`; the matching SQLite backup retains the version 1
online-backup, integrity, digest, synchronization, and atomic-promotion rules. All four assets must reopen and validate
before `active` is published. Recovery after that point requires no network access.

## Manifest fields

| Field | Meaning |
|---|---|
| `format` | Constant `org.fitfreed.update-recovery`. |
| `schemaVersion` | Contract version `2`. |
| `recoveryId` | Unique lowercase SHA-256 attempt identifier. |
| `phase` | Persisted version 2 lifecycle phase. |
| `preparedAt` | UTC preparation instant at second precision. |
| `platform` | Fixed Linux, x86-64, Debian, `linux-x86_64-deb` identity. |
| `source.version` | Installed predecessor application version. |
| `source.librarySchemaVersion` | Schema of the paired preserved library. |
| `source.libraryPath` | Canonical FitFreed Linux library path derived by the adapter. |
| `source.nativePackage` | Exact installed `fitfreed` Debian identity, version, architecture, executable, and desktop entry. |
| `target.*` | Authenticated candidate version, library schema, channel sequence, and payload digest. |
| `predecessorPackage.*` | Fixed local path plus authenticated version, source URL, size, digest, key identifier, and updater signature. |
| `runnablePredecessor.*` | Fixed extraction root, executable path, tree digest, and predecessor-package digest binding. |
| `libraryBackup.*` | Fixed backup path, size, and digest. |
| `targetPackage.*` | Fixed local path plus authenticated candidate package evidence. |
| `replacementProcess.processId` | Candidate process identifier; never sufficient as authority. |
| `replacementProcess.bootId` | Exact Linux boot identifier read from `/proc/sys/kernel/random/boot_id`. |
| `replacementProcess.startTimeClockTicks` | Candidate start time from field 22 of its validated `/proc/<pid>/stat` record. |
| `replacementProcess.executablePath` | Fixed installed executable `/usr/bin/fitfreed`. |
| `replacementProcess.launchNonce` | Fresh 256-bit launch binding encoded as lowercase hexadecimal. |
| `replacementProcess.confirmationDeadline` | Candidate confirmation deadline at UTC second precision. |
| `nativeRecovery.attempts` | Persisted native rollback attempts, from zero through three. |
| `nativeRecovery.lastFailure` | Closed reason for the latest failed native rollback, or `null`. |

The source version must equal both the installed native-package version and predecessor-package version. The target
version must equal the target-package version and be newer than the source. The target schema cannot precede the source
schema. `runnablePredecessor.sourcePackageSha256` must equal `predecessorPackage.sha256`. Package URLs are canonical,
credential-free HTTPS locations without queries or fragments and authenticated by the signed update payload. Unknown,
duplicate, cross-platform,
cross-version, cross-package, or mismatched evidence is invalid.

## Lifecycle and native recovery

The allowed transitions are:

```text
prepared → replacement-started
replacement-started → replacement-installed | recovering
replacement-installed → launching | recovering
launching → confirmed | recovering
recovering → recovered | native-recovery-unavailable | recovery-failed
native-recovery-unavailable → recovering
```

`replacementProcess` is absent until `launching`; `launching` and `confirmed` require it, and recovery phases retain it
only when a candidate was launched. A replacement process is authoritative only when its process identifier, boot
identifier, start-time clock ticks, canonical executable path, launch nonce, held candidate lease, and manifest record
all agree.

During recovery the watchdog first quiesces the exact candidate, restores the verified library backup, and invokes the
platform adapter's fixed predecessor-package installation path through the operating system's authorization boundary.
It then verifies native package-manager identity, installed version, executable bytes, desktop entry, and library pair.
Only that complete state may enter `recovered`.

If authorization is unavailable, the package manager fails, or installed state cannot be validated, the manifest
records the closed reason and enters `native-recovery-unavailable` before launching the validated runnable predecessor.
This state is non-terminal: it retains every asset, blocks another update, tells the user that native installation is
not yet restored, and permits an explicit retry through `native-recovery-unavailable → recovering`. Three failed
native attempts enter `recovery-failed`; no recovery asset is automatically removed. The fallback image can provide
access to the previous application and matching library but can never be reported as `recovered`.

## Process, privacy, and failure behavior

Linux actors derive fixed paths from the canonical recovery root or native package identity. They use no-follow file
opens, private ownership and permissions, one-link regular lock files, non-blocking advisory locks, directory
synchronization, and `/proc` process evidence. Installer commands and destinations come only from the closed Linux
adapter; callers and React provide neither paths nor commands.

Readers reject another format, schema, platform, architecture, package kind, phase, path, package identity, process
shape, unknown field, invalid transition, or incomplete asset. Invalid active state blocks replacement and preserves
all evidence. The manifest contains operational paths and public package evidence but no fitness, health, route,
provider, account, interaction, credential, private signing, or imported source data. The library backup contains the
user's FitFreed data and receives the same protection as the active library.
