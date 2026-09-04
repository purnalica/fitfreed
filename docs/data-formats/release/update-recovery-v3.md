# FitFreed Windows Update Recovery Version 3

## Purpose and boundary

Version 3 records one x86-64 current-user NSIS update whose authenticated predecessor installer, complete runnable
installation, and library remain recoverable together. It is Windows-local operational state. It is not a portable
export, release artifact, diagnostic attachment, or update-channel payload and must never be committed or uploaded.

The closed macOS version 1 and Linux version 2 contracts remain unchanged. Another operating system, architecture,
installation scope, or package family requires an explicit later contract rather than reinterpretation of version 3.

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
        │   └── package.exe
        └── previous/
            ├── package.exe
            ├── runnable/
            │   ├── fitfreed.exe
            │   └── uninstall.exe
            └── fitfreed.sqlite
```

The `active`, outcome, bounded-read, atomic-replacement, receipt, and receipt-bound cleanup rules are semantically
identical to versions 1 and 2. The version 3 `manifest.json` conforms to
[`update-recovery-v3.schema.json`](../../../schemas/update-recovery-v3.schema.json), is UTF-8 JSON limited to 64 KiB,
rejects unknown fields, and uses only the fixed relative locations above. The abbreviated runnable tree shows the two
required files; preservation covers every validated entry in the installed FitFreed directory.

`state.lock`, `candidate.lock`, `watchdog.lock`, and `outcome.lock` are private, empty, non-reparse regular files.
Windows actors open them with sharing disabled for the complete protected operation. A conflicting open means that
another actor owns the lease; it is never treated as absence. The manifest is the state source of truth, while the
native handle is the cross-process exclusion boundary. Readers verify the exact final path, file identity, zero
length, and absence of reparse attributes before trusting a lease.

## Preparation and authenticated assets

Before replacement, the Windows adapter derives the installed application and data roots from the Windows known
folders and the fixed current-user Add or Remove Programs registration. It requires the registered FitFreed name,
version, publisher, homepage, main binary, install location, and uninstaller to agree with non-reparse
`fitfreed.exe` and `uninstall.exe` beneath the derived installation directory. Per-machine installations are outside
version 3.

The exact predecessor package comes from a verified local cache or its authenticated immutable release URL. Both
predecessor and candidate packages must match the signed-channel URL, size, SHA-256, updater signature, target, and
version. Each must also be an x86-64 PE whose `ProductName`, `FileDescription`, `FileVersion`, and `ProductVersion`
match FitFreed and its recorded semantic version. The predecessor package version must equal the installed native
version; the candidate must be newer. Package bytes are copied through private no-clobber staging files and reopened
before authority is published.

Preparation copies the complete current installation directory into `previous/runnable` without following reparse
points. It accepts only directories and regular files with valid Windows path components, at most 65,536 descendant
entries, 4 GiB of regular-file content, and 4,096 UTF-8 bytes per relative path. Device names, alternate-data-stream
separators, control characters, trailing dots or spaces, and paths that collide under ASCII case folding are invalid.
The result must contain `fitfreed.exe` with the exact predecessor PE identity and `uninstall.exe`. A deterministic tree
digest is calculated before and after no-clobber promotion. `runnablePredecessor.sourcePackageSha256` binds the image
to the authenticated package for the same validated installed version; it does not claim that NSIS installation is a
byte-for-byte archive extraction.

The library is copied through SQLite's online backup API to `previous/fitfreed.sqlite`, closed, reopened, checked for
the exact source schema and `PRAGMA integrity_check = ok`, hashed, synchronized, and promoted without overwriting an
existing asset. The active pointer is published only after both packages, the complete runnable tree, the library
backup, and the manifest reopen and validate. Recovery after publication requires no network access. Preparation
failure removes only private staging or attempt assets created by that operation.

## Runnable tree digest

`runnablePredecessor.treeSha256` is SHA-256 over every descendant entry sorted by its normalized UTF-8 relative-path
bytes; the root directory is excluded. A normalized path uses `/` separators for digest input while its on-disk path
uses Windows separators. Each entry contributes its one-byte kind (`D` or `F`), the unsigned 64-bit big-endian path
byte length, and the path bytes. A regular file additionally contributes its unsigned 64-bit big-endian byte length
and the raw 32-byte SHA-256 of its content. A directory adds no further value.

The digest is encoded as 64 lowercase hexadecimal characters. The adapter recalculates it after promotion and whenever
the attempt is reopened. Windows access-control-list details are not part of the portable digest; the private
directory and no-sharing handle rules are validated independently on every use.

## Manifest fields

| Field | Meaning |
|---|---|
| `format` | Constant `org.fitfreed.update-recovery`. |
| `schemaVersion` | Contract version `3`. |
| `recoveryId` | Unique lowercase SHA-256 attempt identifier. |
| `phase` | Persisted version 3 lifecycle phase. |
| `preparedAt` | UTC preparation instant at second precision. |
| `platform` | Fixed Windows, x86-64, current-user NSIS, `windows-x86_64-nsis` identity. |
| `source.version` | Installed predecessor application version. |
| `source.librarySchemaVersion` | Schema of the paired preserved library. |
| `source.libraryPath` | Canonical local library path derived from the application-data known folder. |
| `source.nativePackage` | Exact product, version, architecture, install directory, executable, uninstaller, and application-data directory. |
| `target.*` | Authenticated candidate version, library schema, channel sequence, and payload digest. |
| `predecessorPackage.*` | Fixed local path plus authenticated version, source URL, size, digest, key identifier, and updater signature. |
| `runnablePredecessor.*` | Fixed copy root, executable, uninstaller, tree digest, and predecessor-package digest binding. |
| `libraryBackup.*` | Fixed backup path, size, and digest. |
| `targetPackage.*` | Fixed local path plus authenticated candidate-package evidence. |
| `replacementProcess.processId` | Windows process identifier; never sufficient as authority. |
| `replacementProcess.creationTimeFiletime` | Non-zero process creation `FILETIME`, encoded as a decimal string to avoid JSON integer precision loss. |
| `replacementProcess.executablePath` | Canonical installed `fitfreed.exe` path. |
| `replacementProcess.launchNonce` | Fresh 256-bit launch binding encoded as lowercase hexadecimal. |
| `replacementProcess.confirmationDeadline` | Candidate confirmation deadline at UTC second precision. |
| `nativeRecovery.attempts` | Persisted native rollback attempts, from zero through three. |
| `nativeRecovery.lastFailure` | Closed reason for the latest failed native rollback, or `null`. |

Windows paths are absolute drive paths in ordinary or verbatim form, contain no control characters or reserved
punctuation beyond the drive-prefix colon, and are limited to 4,096 UTF-8 bytes. Schema acceptance alone is not path
authority. The adapter reopens each object without following a reparse point, obtains its final canonical path, and
requires the library, executable, and uninstaller to be the fixed children of their independently derived roots.
Path comparisons follow Windows case-insensitive semantics.

The source version equals both the installed native-package version and predecessor-package version. The target
version equals the target-package version and is newer than the source. The target schema cannot precede the source
schema. Package URLs are canonical, credential-free HTTPS locations without queries or fragments and are authenticated
by the signed update payload. Unknown, duplicate, cross-platform, cross-version, cross-package, or mismatched evidence
is invalid.

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

`replacementProcess` is absent through `replacement-installed`; `launching` and `confirmed` require it. Recovery
phases retain it only when a candidate was launched. A replacement process is authoritative only while a native handle
reports the exact process identifier, creation `FILETIME`, canonical executable path, launch nonce, held candidate
lease, and manifest record. A process identifier alone never authorizes control or lifecycle mutation. Before
termination, the adapter opens one handle with query, synchronization, and termination rights and repeats the complete
identity check on that same handle.

The coordinator starts the watchdog from `previous/runnable/fitfreed.exe` and receives readiness before publishing
`replacement-started`. Before readiness, the watchdog binds its direct parent to the fixed installed executable by
PID, creation `FILETIME`, and canonical path. Only that fresh watchdog may stop the parent and launch the fixed
candidate installer in silent mode from `candidate/package.exe`; a replacement-started watchdog reconstructed after
an interruption must recover instead of repeating an installer whose outcome is uncertain. The watchdog then repeats
the complete current-user native identity and target-version validation before entering `replacement-installed`. It
launches the installed candidate behind the same nonce-bound startup gate used by the other platform contracts. The
nonce contains 256 bits from the operating-system random source. Native process identity is recorded before startup is
released. Confirmation requires the target executable and native registration, target library schema and integrity,
fixed destinations, complete preserved attempt, exact process record, and held candidate lease.

During recovery, the watchdog first quiesces the exact candidate, restores the verified matching library, and silently
invokes only `previous/package.exe`. It then verifies the native registration, source version, install directory,
critical installed files, and equality between the installed critical files and their preserved runnable counterparts.
Only that complete native and library state may enter `recovered`.

An NSIS failure records `installer-failed`; a completed installer whose native state does not match records
`installed-state-invalid`. Either reason enters `native-recovery-unavailable` for the first two attempts, retains every
asset, blocks another update, and permits an explicit retry. The validated runnable predecessor may be launched in a
separate recovery mode so the user can access the matching preserved library, but that state is not reported as
recovered. The third failed native attempt enters `recovery-failed` and requires manual recovery; no evidence is
automatically removed.

## Restart, terminal cleanup, and failure behavior

Ordinary startup resolves recovery authority from the active pointer and fully verified version 3 attempt. A watchdog
restart never extends the original installation or confirmation deadline. A reconstructed watchdog treats `prepared`
as a pre-replacement interruption and `replacement-started` as an uncertain native replacement that must recover; it
never repeats candidate installation from either phase. It resumes later launch or recovery work only after acquiring
the watchdog handle and reconciling the persisted phase with the exact native process identity. It does not
automatically repeat a previously failed native rollback; retry from `native-recovery-unavailable` is an explicit
application action without caller-supplied identifiers, paths, packages, or commands.

Terminal cleanup requires exclusive watchdog, candidate, state, and outcome handles. For `confirmed`, the installed
native identity and library must match the target. For `recovered`, they must match the source and preserved critical
files. Cleanup first writes the shared version 1 outcome receipt, then removes the matching active pointer and only the
verified attempt directory. An interrupted cleanup can continue solely for the exact receipt-bound attempt. A failed,
invalid, busy, unrelated, redirected, or tampered attempt retains all evidence and blocks replacement.

Version 3 readers reject another format, schema, platform, architecture, package kind, installation scope, phase, path,
package identity, process shape, unknown field, invalid transition, or incomplete asset. They do not guess, migrate,
or delete an unknown recovery format.

The manifest contains local operational paths and public package evidence but no fitness, health, route, provider,
account, interaction, credential, private-signing, or imported source data. The library backup contains the user's
FitFreed data and receives the same protection as the active library.
