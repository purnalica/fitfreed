# Local Library Filesystem Contract Version 1

## Scope

This contract defines the Unix filesystem boundary around the local SQLite library. It applies before SQLite opens
the library on supported macOS and Linux systems. The database schema and its migrations remain separate versioned
contracts.

## Application data directory

The direct parent of `fitfreed.sqlite` must be a real directory owned by the effective application user. It must not
be a symbolic link or another filesystem object. FitFreed creates a missing directory with user-only access and
repairs an existing owner-controlled directory to mode `0700` before opening the library.

The contract does not claim that every ancestor is application-owned. Operating-system and home-directory ancestors
remain under their respective platform policies.

## SQLite library file

`fitfreed.sqlite` must be a real regular file owned by the effective application user with exactly one hard link.
FitFreed creates a missing file without following a symbolic link and with mode `0600`. An existing owner-controlled
file with broader permissions is repaired to `0600` without changing its bytes. The same validation is repeated on
the opened file so a substituted symbolic, non-regular, foreign-owned, or multiply linked object cannot be accepted
through a stale path inspection.

SQLite transaction and recovery files remain confined by the private application data directory. SQLite owns their
transactional creation, synchronization, rollback, and removal.

## Failure behavior

A symbolic directory or file, a non-directory parent, a non-regular library, foreign ownership, multiple hard links,
or a permission failure rejects the library boundary before application queries or mutations begin. FitFreed does
not follow the object, choose a fallback library, or modify an external target. The desktop host exposes the existing
provider-neutral `library-unavailable` outcome rather than a filesystem path or machine-local diagnostic.

## Verification

Unix adapter tests create and repair both modes, reopen the boundary idempotently, retain exact pre-existing bytes,
and reject directory symlinks, file symlinks, and multiply linked files without changing their targets. Packaged
macOS and Linux E2E exercise the same path preparation before startup recovery and every library command.
