# FitFreed Update Recovery Version 1

## Purpose and boundary

This contract records one local update attempt whose previous application and library must remain recoverable until the replacement is confirmed. It is operational state, not a portable user export, update-channel payload, release artifact, diagnostic attachment, or public evidence file.

Version 1 is the macOS private-alpha contract. Later platform adapters may retain its lifecycle and semantic fields while extending platform-path and application-asset rules through a new compatible schema version.

The files live under the operating system's FitFreed application-data directory. They can contain local paths and must never be committed, uploaded, or included in a support bundle.

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
        └── previous/
            ├── FitFreed.app/
            └── fitfreed.sqlite
```

`active` is UTF-8 text containing exactly one 64-character lowercase hexadecimal `recoveryId` followed by one line feed. It is promoted atomically only after every recovery asset and `manifest.json` have been written, synchronized, reopened, and verified. At most one active attempt exists.

`manifest.json` is UTF-8 JSON conforming to [`update-recovery-v1.schema.json`](../../../schemas/update-recovery-v1.schema.json). Its maximum encoded size is 64 KiB. Unknown fields are invalid. Writers replace it atomically through a sibling temporary file and synchronize the containing directory.

`last-outcome.json` is an optional UTF-8 JSON receipt conforming to [`update-recovery-outcome-v1.schema.json`](../../../schemas/update-recovery-outcome-v1.schema.json). Its maximum encoded size is 4 KiB. It retains only the latest completed result needed for user-visible reporting after the recovery assets have been removed. It contains no local path, timestamp, signing material, provider data, fitness data, or diagnostic detail. A new terminal outcome atomically replaces an older unacknowledged receipt.

`outcome.lock` is a persistent private empty regular file with the same ownership, link-count, permission, and symbolic-link rules as the process locks. Writers hold its exclusive operating-system lock while reading, replacing, or acknowledging `last-outcome.json`, and while deciding whether a receipt-bound orphan still blocks a new attempt.

`state.lock` is a private empty regular file. Recovery actors hold its operating-system exclusive lock across active-pointer validation, lifecycle compare-and-transition, and atomic manifest replacement. The file does not convey a phase or authority; `manifest.json` remains the state source of truth. Symbolic links and unsupported platforms fail closed.

`candidate.lock` is a second private empty regular file. The launched candidate holds its operating-system exclusive lock for the lifetime of its validated recovery startup. Restoration must acquire that lock before changing either installed destination and therefore fails closed while a candidate can still access the application or library. The lock file must be owned by the current user, have one link, contain no bytes, grant no group or other permissions, and never be a symbolic link. The persisted process identity remains the source of process authority; the lock is the cross-process quiescence boundary.

`watchdog.lock` has the same private-file boundary. One watchdog holds its non-blocking operating-system exclusive lock for the complete runner lifetime. Another invocation cannot announce readiness or act on the recovery lifecycle until the prior watchdog exits and releases the lock. The manifest remains the lifecycle source of truth; this lock prevents concurrent actors from racing on observation and process control between atomic state transitions.

The watchdog executable derives `update-recovery`, `attempts`, `recoveryId`, `previous`, and `FitFreed.app` solely by walking its own canonical executable path and requiring every fixed segment. It receives only the independently known installed `FitFreed.app` path, which must equal the canonical manifest destination. The library destination is derived as the recovery root's canonical parent plus `fitfreed.sqlite`; it is not a caller-selected watchdog argument.

The relative backup paths are fixed by the schema. Readers never interpret a manifest-provided relative path containing traversal, another filename, or another application identity.

## Manifest fields

| Field | Meaning |
|---|---|
| `format` | Constant `org.fitfreed.update-recovery`. |
| `schemaVersion` | Contract version `1`. |
| `recoveryId` | Unique lowercase SHA-256 identifier for this attempt. It is an identifier, not an authentication secret. |
| `phase` | Current persisted lifecycle phase. |
| `preparedAt` | RFC 3339 UTC instant at second precision (`YYYY-MM-DDTHH:MM:SSZ`) at which the recovery pair was prepared. |
| `replacementProcess.processId` | Process identifier of the candidate launched by the watchdog. Values zero, one, and values outside the signed platform process range are invalid. |
| `replacementProcess.startedAtUnixSeconds` | Candidate start time reported by the operating system, as whole seconds since the Unix epoch. |
| `replacementProcess.startedAtMicroseconds` | Microsecond fraction of the operating-system process start time. |
| `replacementProcess.launchNonce` | Fresh 256-bit launch nonce encoded as 64 lowercase hexadecimal characters. It binds the manifest record, private candidate invocation, startup gate, lease, and confirmation claim. |
| `replacementProcess.confirmationDeadline` | RFC 3339 UTC instant at second precision by which the exact candidate must confirm successful startup. |
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

## Terminal outcome receipt and cleanup

The receipt format is `org.fitfreed.update-recovery-outcome` with `schemaVersion` `1`. Its fields are:

| Field | Meaning |
|---|---|
| `recoveryId` | Exact attempt identifier whose terminal result was retained. |
| `outcome` | `updated` when the target application and library reached `confirmed`; `recovered` when the exact source pair reached `recovered`. |
| `sourceVersion` | Semantic version of the application preserved before replacement. |
| `targetVersion` | Semantic version authorized for the replacement. |

Terminal cleanup requires exclusive ownership of `watchdog.lock`, `candidate.lock`, and `state.lock`. It revalidates the complete preserved attempt and independently supplied installed destinations. For `confirmed`, the installed application must be `target.version` and the library must have `target.librarySchemaVersion` and pass integrity checking. For `recovered`, the installed application and library must exactly match the preserved source pair. `recovery-failed` is never cleaned automatically because its assets and active authority remain necessary for manual recovery.

Cleanup is ordered and restart-safe:

1. atomically write and synchronize `last-outcome.json`;
2. remove the matching `active` pointer and synchronize `update-recovery`;
3. for a recovered attempt, remove only the fixed failed-candidate sibling after verifying its bundle identity and `target.version`;
4. remove only `attempts/<recoveryId>` and synchronize `attempts`.

If interruption occurs after the receipt is durable, maintenance may resume deletion only for the exact `recoveryId` named by that valid receipt. It must revalidate the attempt, receipt, installed pair, private locks, and absence or exact match of `active`. An unrelated orphan, a receipt mismatch, a symbolic link, a busy process lock, or a changed destination fails closed. Once the identified attempt has gone, the valid receipt remains until the user acknowledges it; acknowledgement removes only `last-outcome.json` and synchronizes the recovery root.

A `prepared` attempt may be discarded only before any replacement transition and only while the caller simultaneously owns `watchdog.lock`, `candidate.lock`, and `state.lock`. Discard removes the matching active pointer, synchronizes the recovery root, removes that one attempt directory, and synchronizes `attempts`. It is used when watchdog readiness fails or when the watchdog has been stopped before `replacement-started` can be recorded. Once replacement has started, the persisted lifecycle and watchdog own every recovery decision; discard is forbidden.

`replacementProcess` is `null` through `replacement-installed`. The only operation permitted to enter `launching` atomically stores the complete replacement-process record with that transition. `launching` and `confirmed` require the record. Recovery phases retain it when a candidate was launched so an interrupted watchdog can distinguish that exact operating-system process from a reused process identifier. The confirmation deadline must be later than `preparedAt` and no later than sixteen minutes after it.

The replacement starts with the private marker `--fitfreed-update-recovery-candidate` followed by the exact active recovery identifier and launch nonce. The host accepts only that closed three-argument shape and two 64-character lowercase hexadecimal values. Before initializing Tauri, it also requires the exact bounded standard-input record `FITFREED-UPDATE-CANDIDATE-GO <recoveryId> <launchNonce>\n` within ten seconds. The watchdog spawns the process first, obtains its executable path and start time from macOS, atomically records those facts with the `launching` transition, and only then sends the record. A write, timeout, or validation failure stops the child.

After the startup gate, the host acquires `candidate.lock` and validates the active manifest, phase, nonce, process identifier, operating-system start time, exact executable and bundle path, bundle identity, and target version before ordinary startup work. It retains the recovery identifier, nonce, and lease outside React for the candidate process lifetime. After locale startup makes the rendered application responsive, React invokes a no-argument confirmation command. It supplies no path, version, schema, recovery identifier, nonce, or update authority.

The replacement may write `confirmed` only when it is running from the exact manifest installation path, its compiled semantic version equals `target.version`, its compiled library schema equals `target.librarySchemaVersion`, the active library occupies the fixed path and passes that exact schema plus SQLite integrity checks, the complete preserved pair still verifies, and normal startup recovery has completed. The host serializes confirmation claims, derives the recovery root from the active library location, supplies only its compiled facts and current executable, and restores the pending claim if validation fails. The exclusive state lock makes confirmation and watchdog recovery competing atomic transitions from `launching`; exactly one can win.

The installer starts only the fixed executable inside `previous/FitFreed.app` with a private watchdog marker and the absolute installed-application path. That executable parses the marker before initializing Tauri and reconstructs all other authority from its own canonical recovery layout. It validates the active manifest and assets, acquires `watchdog.lock`, reconstructs any candidate process authority from persisted state, and only then announces readiness. Standard input and diagnostics are disconnected. The installer must receive the exact bounded readiness record `FITFREED-UPDATE-WATCHDOG-READY <pid>\n` from the child's standard output within ten seconds before replacement may begin; a malformed record, input/output failure, timeout, early exit, or concurrent watchdog cancels the child and the installation.

After readiness, the watchdog observes persisted phases rather than trusting process messages. The installation deadline is always `preparedAt` plus fifteen minutes, including after watchdog restart; a restart never extends it. The watchdog starts the replacement only from `replacement-installed` before that deadline and gives it sixty seconds to confirm. A replacement exit or confirmation timeout first wins the atomic `launching → recovering` transition and only then stops the candidate. An installation timeout may stop the original application only while its process identifier is still the watchdog's direct parent; this prevents acting on a reused identifier. Recovery retries the idempotent verified restoration at most three times, records `recovery-failed` after exhaustion, and launches the restored application only after the pair reaches `recovered`.

On restart, `prepared`, `replacement-started`, and `replacement-installed` resume against the original absolute installation deadline. For `launching`, the watchdog accepts only the recorded process identifier when macOS reports the exact recorded start time and installed executable path; a missing, exited, or reused identifier enters recovery. Before sending `SIGTERM` or `SIGKILL` to an inherited candidate, the watchdog repeats that exact identity check. For `recovering`, it stops the same surviving candidate when present and must acquire `candidate.lock` before restoration. `confirmed`, `recovered`, and `recovery-failed` retain their terminal behavior. The watchdog never trusts a process identifier alone and never mutates the destinations while a candidate lease remains held.

## Compatibility and failure behavior

Version 1 readers reject another `format`, another `schemaVersion`, unknown fields, invalid phases, malformed versions or digests, unsafe paths, a mismatched active identifier, and incomplete assets. They do not guess or migrate an unknown recovery format.

An invalid active attempt blocks further in-application replacement and yields privacy-safe recovery guidance. It never causes deletion of the application or library. Orphaned non-active attempt directories are not trusted as recovery authority. The sole version 1 exception is the exact receipt-bound attempt described above; all other orphans remain untouched.

The contract contains no health, activity, training, sleep, recovery, route, account, provider-export, or usage data. The library backup itself contains the user's FitFreed data and receives the same protection as the active library.
