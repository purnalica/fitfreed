# FitFreed Update Recovery Version 1

## Purpose and boundary

This contract records one local update attempt whose previous application and library must remain recoverable until the replacement is confirmed. It is operational state, not a portable user export, update-channel payload, release artifact, diagnostic attachment, or public evidence file.

Version 1 is the macOS private-alpha contract. Later platform adapters may retain its lifecycle and semantic fields while extending platform-path and application-asset rules through a new compatible schema version.

The files live under the operating system's FitFreed application-data directory. They can contain local paths and must never be committed, uploaded, or included in a support bundle.

## Layout

```text
update-recovery/
├── active
└── attempts/
    └── <recoveryId>/
        ├── manifest.json
        ├── state.lock
        └── previous/
            ├── FitFreed.app/
            └── fitfreed.sqlite
```

`active` is UTF-8 text containing exactly one 64-character lowercase hexadecimal `recoveryId` followed by one line feed. It is promoted atomically only after every recovery asset and `manifest.json` have been written, synchronized, reopened, and verified. At most one active attempt exists.

`manifest.json` is UTF-8 JSON conforming to [`update-recovery-v1.schema.json`](../../../schemas/update-recovery-v1.schema.json). Its maximum encoded size is 64 KiB. Unknown fields are invalid. Writers replace it atomically through a sibling temporary file and synchronize the containing directory.

`state.lock` is a private empty regular file. Recovery actors hold its operating-system exclusive lock across active-pointer validation, lifecycle compare-and-transition, and atomic manifest replacement. The file does not convey a phase or authority; `manifest.json` remains the state source of truth. Symbolic links and unsupported platforms fail closed.

The relative backup paths are fixed by the schema. Readers never interpret a manifest-provided relative path containing traversal, another filename, or another application identity.

## Manifest fields

| Field | Meaning |
|---|---|
| `format` | Constant `org.fitfreed.update-recovery`. |
| `schemaVersion` | Contract version `1`. |
| `recoveryId` | Unique lowercase SHA-256 identifier for this attempt. It is an identifier, not an authentication secret. |
| `phase` | Current persisted lifecycle phase. |
| `preparedAt` | RFC 3339 UTC instant at second precision (`YYYY-MM-DDTHH:MM:SSZ`) at which the recovery pair was prepared. |
| `source.version` | Semantic version of the preserved application. |
| `source.librarySchemaVersion` | Exact SQLite `user_version` of the preserved library. |
| `source.applicationPath` | Absolute installed application path validated by the macOS adapter. |
| `source.libraryPath` | Absolute active library path validated against FitFreed's application-data location. |
| `target.version` | Semantic version authorized for installation. |
| `target.librarySchemaVersion` | Library schema expected after successful startup. |
| `target.trustedSequence` | Authenticated update-channel sequence that authorized the attempt. |
| `target.trustedPayloadSha256` | SHA-256 of the authenticated update payload. |
| `target.packageSha256` | SHA-256 of the verified native update package. |
| `applicationBackup.relativePath` | Constant `previous/FitFreed.app`. |
| `applicationBackup.treeSha256` | Deterministic digest of the complete preserved application tree. |
| `libraryBackup.relativePath` | Constant `previous/fitfreed.sqlite`. |
| `libraryBackup.sizeBytes` | Exact byte length of the closed backup file. |
| `libraryBackup.sha256` | SHA-256 of the closed backup file. |

## Application-tree digest

The application digest covers every descendant of the `FitFreed.app` root without following symbolic links. Paths must be valid UTF-8, use `/` separators, be relative, and sort by their UTF-8 byte sequence. A symbolic-link target must be relative and resolve lexically inside the bundle root. Unsupported filesystem entry types are invalid.

Each sorted entry contributes this binary record to SHA-256:

1. one kind byte: `D` for directory, `F` for regular file, or `L` for symbolic link;
2. the relative-path byte length as an unsigned 64-bit big-endian integer;
3. the relative-path UTF-8 bytes;
4. Unix permission bits masked to `0777` as an unsigned 32-bit big-endian integer, or zero for a symbolic link;
5. for a file, its byte length as unsigned 64-bit big-endian plus the 32 raw SHA-256 bytes of its content;
6. for a symbolic link, its target byte length as unsigned 64-bit big-endian plus its exact UTF-8 target bytes; and
7. no payload for a directory.

The digest is encoded as 64 lowercase hexadecimal characters. Copy preparation requires equal source and backup tree digests plus matching bundle identifier, version, executable name, and executable presence.

## Library backup

The library copy uses SQLite's online backup API. Preparation requires the source to have the current schema and pass `PRAGMA integrity_check`. The destination is written under a temporary sibling name, closed, reopened read-only, checked for the exact source schema and `PRAGMA integrity_check = ok`, hashed, synchronized, and only then promoted to `previous/fitfreed.sqlite`.

Restoration verifies the recorded size, SHA-256, SQLite integrity, and source schema again before atomically replacing the inactive library. Stale `-wal` and `-shm` sidecars from the failed candidate are removed only after its process is stopped and the verified replacement is ready.

Application restoration first copies and verifies the preserved bundle at the fixed destination's sibling `.FitFreed.app.fitfreed-recovery-<recoveryId>.staging`. The failed candidate moves to `.FitFreed.app.fitfreed-recovery-<recoveryId>.failed` before the verified staging bundle is promoted. These names are internal recovery state, never caller-selected paths. A restart can discard an incomplete staging bundle, continue after candidate quarantine, or verify an already promoted source bundle. The failed candidate remains until terminal cleanup.

Library restoration uses a private sibling staging file, checks the recorded byte length, digest, schema, and integrity, removes only the fixed `fitfreed.sqlite-wal` and `fitfreed.sqlite-shm` sidecars, and atomically replaces `fitfreed.sqlite`. The recovery root's canonical parent must be the canonical library parent. The installed application and library destinations must exactly match the manifest and independently supplied expected paths before any mutation.

## Lifecycle

The allowed transitions are:

```text
prepared → replacement-started
replacement-started → replacement-installed | recovering
replacement-installed → launching | recovering
launching → confirmed | recovering
recovering → recovered | recovery-failed
```

The complete phase vocabulary is `prepared`, `replacement-started`, `replacement-installed`, `launching`, `confirmed`, `recovering`, `recovered`, and `recovery-failed`.

`confirmed`, `recovered`, and `recovery-failed` are terminal. A skipped, reversed, or repeated transition is invalid. Repeating restoration work while the persisted phase remains `recovering` is safe and must converge on `recovered` or `recovery-failed`.

## Compatibility and failure behavior

Version 1 readers reject another `format`, another `schemaVersion`, unknown fields, invalid phases, malformed versions or digests, unsafe paths, a mismatched active identifier, and incomplete assets. They do not guess or migrate an unknown recovery format.

An invalid active attempt blocks further in-application replacement and yields privacy-safe recovery guidance. It never causes deletion of the application or library. Orphaned non-active attempt directories are not trusted as recovery authority and may be removed only by bounded maintenance that proves they are not referenced.

The contract contains no health, activity, training, sleep, recovery, route, account, provider-export, or usage data. The library backup itself contains the user's FitFreed data and receives the same protection as the active library.
