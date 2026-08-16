# Private Reference Export Acceptance

## Purpose and boundary

This maintainer-only check evaluates the explicitly supplied private Polar Flow reference ZIP against the production importer without touching the normal FitFreed library. It is a local compatibility gate, not a fixture generator, user workflow, or hosted-CI job.

The archive remains read-only at its original location. The verifier creates a random operating-system temporary directory, imports into a temporary SQLite library, repeats the same package, queries only existence and source-consistency predicates, and removes the temporary directory when the process exits. It never prints the archive path, temporary path, artifact names, source-subject claim, scoped digest, opaque origin, fitness values, dates, counts, durations, coverage distribution, or database contents.

## Command

Run from the repository root and supply the original ZIP directly:

```sh
cargo run --quiet --manifest-path src-tauri/Cargo.toml \
  --example private_import_acceptance -- /absolute/path/to/original-export.zip
```

The command emits one JSON object containing only:

- acceptance and terminal state;
- a fixed privacy-safe terminal code on failure;
- whether coverage completed;
- whether daily-activity and training history are each present;
- whether all supported history used one opaque origin; and
- exact-repeat behavior.

Exit status `0` requires a completed first import, complete artifact coverage, non-empty daily-activity and training history under one opaque origin, and a successful exact-repeat fast path. Any other result keeps the current private-reference acceptance open.

## Evidence handling

The predicate JSON is local ephemeral evidence and must not be transcribed, committed, or uploaded. The milestone plan may record only whether the complete acceptance predicate passed for a named source revision and verifier version; it must not record paths, identifiers, values, dates, counts, durations, coverage distribution, or fingerprints. Never redirect or upload stderr from an experimental build, because an unexpected runtime failure outside the verifier's controlled outcomes could contain local process context.

Do not commit, attach, upload, copy, rename, repackage, or generate screenshots from the private ZIP or temporary library. Hosted workflows use only independent synthetic fixtures. A failure is investigated locally through fixed terminal codes and synthetic reproduction; the private artifact never becomes a regression fixture.
