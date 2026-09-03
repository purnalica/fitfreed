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

Network acquisition is limited to preparation. The adapter uses the active package-signing key selected by the
authenticated authorization, rejects redirects and mutable URLs, and streams no more than the signed size to a private
temporary file. It calculates SHA-256 and the prehashed updater signature during that stream, synchronizes the file,
then reopens it without following a symbolic link and repeats size, digest, and signature verification. Handoff into an
attempt uses no-clobber publication; every error removes the temporary file without changing existing recovery
evidence.

Native identity discovery uses only `/usr/bin/dpkg-query --show` and `--listfiles` for the fixed `fitfreed` package.
The accepted identity is an installed `amd64` package with a SemVer version that owns the fixed
`/usr/bin/fitfreed` executable and `/usr/share/applications/fitfreed.desktop` entry. Both paths must reopen as
non-symbolic regular files, and the executable must carry an execute bit. Native
rollback derives `previous/package.deb` from the canonical attempt directory, rejects an absent, empty, non-regular,
or symbolic package, invokes only `/usr/bin/pkexec /usr/bin/dpkg --install` with that derived path, and repeats the
native identity and installed-file validation after success.

Candidate installation derives `candidate/package.deb` through the same canonical attempt boundary, applies the same
non-empty regular-file and no-symbolic-link checks, invokes only `/usr/bin/pkexec /usr/bin/dpkg --install` with that
derived path, and repeats native identity validation. The resulting package version must equal `target.version` before
the attempt can enter `replacement-installed`.

The adapter extracts that same package without executing maintainer scripts into `previous/runnable`, validates the
complete tree and required `usr/bin/fitfreed`, records a deterministic tree digest, and binds it back to the predecessor
package SHA-256. This image is a last runnable predecessor, not a replacement for native rollback. The independently
verified candidate package is copied to `candidate/package.deb`; the matching SQLite backup retains the version 1
online-backup, integrity, digest, synchronization, and atomic-promotion rules. All four assets must reopen and validate
before `active` is published. Recovery after that point requires no network access.

Preparation applies the updater's 1 GiB package bound to each package even though the storage schema reserves a wider
forward-compatible integer range. Extraction is limited to 65,536 entries and 4 GiB of expanded regular-file content.
An exceeded bound, unsupported filesystem object, non-UTF-8 or over-4,096-byte relative path, missing required file,
non-executable application, absolute link, or relative link that escapes the image invalidates the complete
preparation. Failure removes only the package and runnable directories created by that preparation and preserves any
pre-existing attempt evidence.

## Runnable tree digest

`runnablePredecessor.treeSha256` is SHA-256 over every descendant entry sorted by UTF-8 relative-path bytes; the root
directory itself is excluded. Each entry contributes its one-byte kind (`D`, `F`, or `L`), the unsigned 64-bit
big-endian path byte length, the path bytes, and the unsigned 32-bit big-endian permission mode. File and directory
modes retain the low twelve Unix permission bits; a symbolic link uses `0777`.

A regular file then contributes its unsigned 64-bit big-endian byte length and the raw 32-byte SHA-256 of its content.
A symbolic link contributes the unsigned 64-bit big-endian target byte length and its UTF-8 target bytes. Directories
add no further value. The adapter calculates this digest before and after publishing the runnable tree and recalculates
it whenever recovery state is reopened. The package digest remains independently authoritative for the source bytes;
the tree digest proves the exact extracted fallback image derived from those bytes.

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

The process adapter reads the boot identifier from `/proc/sys/kernel/random/boot_id`, the start-time clock ticks from
field 22 of `/proc/<pid>/stat`, and the executable target from `/proc/<pid>/exe`. It accepts only the exact
`/usr/bin/fitfreed` target and compares every recorded component when determining whether a process still owns the
identity. A PID match alone never authorizes process control or lifecycle mutation.

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

The installer launches the watchdog only from `previous/runnable/usr/bin/fitfreed`, passes the fixed private watchdog
argument and exact installed path, and requires an exact process-bound readiness record before replacement starts.
The watchdog launches the installed candidate with a fresh recovery identifier and nonce handshake, records complete
`/proc` process identity before releasing startup, and controls that process only while every identity component still
matches. A runnable predecessor fallback receives no private candidate argument or nonce and is observed at its exact
preserved executable path before the watchdog exits. Failure to establish that ownership terminates the spawned child
and retains the recovery attempt.

An ordinary Linux startup resolves restart authority only from the active pointer and the fully verified preserved
executable layout. The application-layer lifecycle policy requests reattachment for `prepared`,
`replacement-started`, `replacement-installed`, `launching`, and `recovering`; it never reopens a terminal state and
leaves `native-recovery-unavailable` waiting for an explicit user retry. The adapter probes the exclusive watchdog
lease before spawning, treats a held lease as an already active monitor, and resolves a concurrent start in the same
way after a failed readiness handshake. A replacement watchdog receives the separate fixed private
`--fitfreed-update-recovery-watchdog-resume` argument. It discards an interrupted `prepared` attempt immediately and
moves an interrupted `replacement-started` attempt directly into recovery rather than waiting for the original
installation deadline. Later phases retain their ordinary persisted-state behavior. No caller supplies a recovery
identifier, attempt path, or executable path for reattachment.

An ordinary application process exposes a read-only intervention view only after resolving the active pointer and
revalidating the complete attempt. The view is either `native-recovery-retry-available` or
`manual-reinstall-required` and contains only the source version, target version, completed attempt count, and fixed
maximum of three attempts. It never exposes the recovery identifier, paths, package evidence, failure detail, or
process identity. An unreadable or invalid active attempt fails closed and cannot be replaced by an ordinary update.

Only an explicit no-argument application action can authorize the transition from `native-recovery-unavailable` to
`recovering`. The application policy rejects every other phase and rejects a third retry. The Linux adapter proves
that no watchdog owns the attempt before writing the transition, and the new watchdog must acquire the matching
exclusive lease and acknowledge readiness. If that spawn fails before another watchdog acquires the lease, the
adapter restores `native-recovery-unavailable` without incrementing the attempt count. Once the watchdog runs, each
failed native installation increments the durable count exactly once; the third failure enters `recovery-failed` and
the intervention view becomes `manual-reinstall-required`. Every package, runnable image, library backup, and
manifest remains retained in either intervention state.

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
