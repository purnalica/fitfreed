# Local Library Filesystem Contract Version 2

## Scope

This contract defines the filesystem boundary around the local SQLite library on supported macOS, Linux, and Windows
systems. It applies before SQLite opens the library and before every later command that reopens it. The database schema
and its migrations remain separate versioned contracts. Version 2 extends the Unix-only version 1 contract to Windows;
it does not weaken the preceding Unix guarantees.

## Application data directory

The direct parent of `fitfreed.sqlite` must be a real directory owned by the application user. It must not be a symbolic
link, a Windows reparse point, or another filesystem object. FitFreed creates a missing directory before admitting it.
The contract does not claim that every ancestor is application-owned: operating-system, profile, and home-directory
ancestors remain under their platform policies.

On Unix, FitFreed requires effective-user ownership and mode `0700`. It repairs broader permissions on an
owner-controlled directory before opening the library.

On Windows, the production directory is the current user's roaming application-data directory resolved by the native
application host. FitFreed opens the direct parent itself with reparse-point-aware, no-sharing semantics and requires
current-user ownership. Windows can initially assign a newly created object to the creating access token's default
owner SID rather than its user SID. FitFreed admits that exact token-default owner only as a repairable creation state,
then sets the owner to the token user and verifies the result. It applies a protected DACL containing exactly three
allowed full-control identities: the current user, LocalSystem, and Builtin Administrators. Directory access-control
entries inherit to child containers and objects. An existing current-user-owned directory with a different DACL is
normalized to this form before SQLite access. A directory owned by neither the token user nor that same token's
default owner is rejected rather than taken over.

## SQLite library file

`fitfreed.sqlite` must be a real regular file owned by the application user with exactly one hard link. Opening the
file never follows a Unix symbolic link or a Windows reparse point. FitFreed validates both the path inspection and the
opened handle so a substituted link or non-regular object cannot be accepted between those operations.

On Unix, FitFreed creates the file with mode `0600` and repairs broader permissions on an owner-controlled file. On
Windows, it opens the file with the same read/write sharing required by SQLite so validation remains available while
an import or query holds the library open. The validation handle requires current-user ownership and applies a
protected DACL containing exactly the current user, LocalSystem, and Builtin Administrators with full control and no
inheritance flags. The same exact token-default-owner admission and user-owner normalization applies to a newly
created file. Existing current-user-owned files are normalized without changing their bytes. Foreign-owned, multiply
linked, redirected, or non-regular files are rejected without modifying their target.

Creation and permission repair synchronize the affected library file and application data directory before the
boundary is admitted where the platform exposes that durability operation. An unchanged private boundary avoids this
extra write path during ordinary queries. SQLite owns the transactional creation, synchronization, rollback, and
removal of its journal and WAL sidecars; the private parent directory confines those files to the same user boundary.

## Windows contention policy

Windows access denial, sharing violation, and lock violation can be transient while security software or another
process releases a handle. FitFreed retries only those native errors after 10, 20, 40, and 80 milliseconds, for a fixed
total delay of 150 milliseconds before one final attempt. Other failures return immediately. A persistent denial fails
closed without selecting an alternate library or weakening the ACL, ownership, link, or reparse-point checks.

The same boundary accepts native long Unicode paths beyond the legacy 260-character limit. Path length and character
encoding do not relax any validation.

## Failure behavior

An invalid parent, symbolic link, reparse point, non-regular file, foreign owner, multiple hard links, unsupported ACL,
or persistent permission or sharing failure rejects the library before application queries or mutations begin.
FitFreed does not follow the object, choose a fallback library, disclose the local path to the renderer, or modify an
external target. The desktop host exposes the provider-neutral `library-unavailable` outcome.

Invalid SQLite bytes reject startup without rewriting the file. An import that encounters an existing SQLite writer
leaves committed history readable and may be retried after the competing writer releases the library. Storage
exhaustion may prevent the failed-operation outcome itself from being persisted; after capacity is restored, normal
startup recovery rolls back any non-terminal import operation, verifies committed history, and permits an explicit
retry. None of these failures silently discards the original file.

## Verification

Unix adapter tests retain the version 1 evidence: exact `0700` and `0600` creation and repair, idempotent reopening,
byte retention, and rejection of directory links, file links, and multiple hard links without target mutation.

Windows adapter tests cover create and reopen, validation beside an open SQLite connection, retained bytes, multiple
hard links, bounded transient sharing denial, long Unicode paths, token-default-owner normalization, symbolic files,
and a real NTFS junction without target mutation. The elevated filesystem
admission constructs the junction and executes the native boundary test on the same isolated VHD used for real
disk-exhaustion recovery. The installed-package cold-launch admission then verifies that the production library exists
under the exact current-user `%APPDATA%` root, is non-empty, contains no reparse-point descendants, and has the exact
protected directory and file DACLs. Every packaged command traverses the same production adapter rather than a
test-only filesystem shortcut.

## Compatibility

[Local library filesystem contract version 1](local-library-filesystem-v1.md) is the preceding Unix-only contract.
Libraries already admitted by version 1 keep their bytes and schema. Version 2 may tighten their surrounding Windows
or Unix filesystem metadata before SQLite access, but does not migrate or reinterpret database content.
